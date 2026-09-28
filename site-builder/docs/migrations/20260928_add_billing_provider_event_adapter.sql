-- Provider-neutral, service-role-only billing event adapter.
create table if not exists public.billing_provider_events(
 provider text not null,event_id text not null,event_type text not null,received_at timestamptz not null default now(),processed_at timestamptz,
 processing_status text not null default 'received' check(processing_status in ('received','processed','ignored','failed')),last_error text,
 primary key(provider,event_id)
);
alter table public.billing_provider_events enable row level security;
revoke all on public.billing_provider_events from public,anon,authenticated;
grant select,insert,update on public.billing_provider_events to service_role;
create policy "no client access to billing provider events" on public.billing_provider_events for select to authenticated using(false);

create or replace function private.apply_builder_billing_provider_event(p_provider text,p_event_id text,p_event_type text,p_owner_id uuid,p_provider_status text,p_paid_through timestamptz default null,p_failed_at timestamptz default null)
returns text language plpgsql security definer set search_path='' as $$
declare v_site record; v_result text:='ignored';
begin
 insert into public.billing_provider_events(provider,event_id,event_type) values(p_provider,p_event_id,p_event_type) on conflict(provider,event_id) do nothing;
 if not found then return 'duplicate'; end if;
 if p_owner_id is null then raise exception 'owner_required'; end if;
 update public.user_subscriptions set status=p_provider_status,current_period_end=coalesce(p_paid_through,current_period_end),updated_at=now() where user_id=p_owner_id;
 if p_event_type in ('payment_failed','subscription_past_due') then
  for v_site in select id from public.sites where owner_id=p_owner_id loop
   perform private.start_builder_payment_grace(v_site.id,p_owner_id,coalesce(p_failed_at,now()),p_provider_status,p_provider||':'||p_event_id||':'||v_site.id::text);
  end loop; v_result:='grace_started';
 elsif p_event_type in ('payment_succeeded','subscription_active') then
  for v_site in select id from public.sites where owner_id=p_owner_id loop
   perform private.reactivate_builder_site(v_site.id,p_owner_id,p_paid_through,p_provider_status,p_provider||':'||p_event_id||':'||v_site.id::text);
  end loop; v_result:='reactivated';
 end if;
 update public.billing_provider_events set processed_at=now(),processing_status=case when v_result='ignored' then 'ignored' else 'processed' end where provider=p_provider and event_id=p_event_id;
 return v_result;
exception when others then
 update public.billing_provider_events set processed_at=now(),processing_status='failed',last_error=left(sqlerrm,500) where provider=p_provider and event_id=p_event_id; raise;
end $$;
revoke all on function private.apply_builder_billing_provider_event(text,text,text,uuid,text,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function private.apply_builder_billing_provider_event(text,text,text,uuid,text,timestamptz,timestamptz) to service_role;
create or replace function public.apply_builder_billing_provider_event(p_provider text,p_event_id text,p_event_type text,p_owner_id uuid,p_provider_status text,p_paid_through timestamptz default null,p_failed_at timestamptz default null)
returns text language sql security invoker set search_path='pg_catalog','private','pg_temp' as $$select private.apply_builder_billing_provider_event(p_provider,p_event_id,p_event_type,p_owner_id,p_provider_status,p_paid_through,p_failed_at)$$;
revoke all on function public.apply_builder_billing_provider_event(text,text,text,uuid,text,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.apply_builder_billing_provider_event(text,text,text,uuid,text,timestamptz,timestamptz) to service_role;


-- Site-scoped subscription mapping prevents one unpaid site from restricting every site owned by the same account.
create table if not exists public.site_subscriptions(
 site_id uuid primary key references public.sites(id) on delete cascade,owner_id uuid not null references auth.users(id) on delete cascade,
 plan_key text not null references public.subscription_plans(key),status text not null check(status in ('active','trialing','past_due','canceled','suspended')),
 provider text,provider_customer_id text,provider_subscription_id text unique,current_period_end timestamptz,updated_at timestamptz not null default now()
);
alter table public.site_subscriptions enable row level security;
revoke all on public.site_subscriptions from anon;
grant select on public.site_subscriptions to authenticated;
create policy "owners read site subscriptions" on public.site_subscriptions for select to authenticated using(owner_id=(select auth.uid()) or exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='admin'));
revoke insert,update,delete on public.site_subscriptions from authenticated;
grant select,insert,update,delete on public.site_subscriptions to service_role;
create index if not exists site_subscriptions_owner_id_idx on public.site_subscriptions(owner_id);
create index if not exists site_subscriptions_plan_key_idx on public.site_subscriptions(plan_key);
insert into public.site_subscriptions(site_id,owner_id,plan_key,status,provider,provider_customer_id,provider_subscription_id,current_period_end)
select s.id,s.owner_id,coalesce(us.plan_key,'free'),coalesce(us.status,'active'),us.provider,us.provider_customer_id,
case when us.provider_subscription_id is null then null else us.provider_subscription_id||':'||s.id::text end,us.current_period_end
from public.sites s left join public.user_subscriptions us on us.user_id=s.owner_id on conflict(site_id) do nothing;

create or replace function private.apply_builder_site_billing_provider_event(p_provider text,p_event_id text,p_event_type text,p_site_id uuid,p_owner_id uuid,p_provider_status text,p_paid_through timestamptz default null,p_failed_at timestamptz default null,p_provider_subscription_id text default null)
returns text language plpgsql security definer set search_path='' as $$
declare v_result text:='ignored'; v_plan text;
begin
 if not exists(select 1 from public.sites where id=p_site_id and owner_id=p_owner_id) then raise exception 'site_owner_mismatch'; end if;
 insert into public.billing_provider_events(provider,event_id,event_type) values(p_provider,p_event_id,p_event_type) on conflict(provider,event_id) do nothing;
 if not found then return 'duplicate'; end if;
 select coalesce(ss.plan_key,us.plan_key,'free') into v_plan from public.sites s left join public.site_subscriptions ss on ss.site_id=s.id left join public.user_subscriptions us on us.user_id=s.owner_id where s.id=p_site_id;
 insert into public.site_subscriptions(site_id,owner_id,plan_key,status,provider,provider_subscription_id,current_period_end)
 values(p_site_id,p_owner_id,v_plan,p_provider_status,p_provider,p_provider_subscription_id,p_paid_through)
 on conflict(site_id) do update set status=excluded.status,provider=excluded.provider,provider_subscription_id=coalesce(excluded.provider_subscription_id,public.site_subscriptions.provider_subscription_id),current_period_end=coalesce(excluded.current_period_end,public.site_subscriptions.current_period_end),updated_at=now();
 if p_event_type in ('payment_failed','subscription_past_due') then perform private.start_builder_payment_grace(p_site_id,p_owner_id,coalesce(p_failed_at,now()),p_provider_status,p_provider||':'||p_event_id); v_result:='grace_started';
 elsif p_event_type in ('payment_succeeded','subscription_active') then perform private.reactivate_builder_site(p_site_id,p_owner_id,p_paid_through,p_provider_status,p_provider||':'||p_event_id); v_result:='reactivated'; end if;
 update public.billing_provider_events set processed_at=now(),processing_status=case when v_result='ignored' then 'ignored' else 'processed' end where provider=p_provider and event_id=p_event_id; return v_result;
exception when others then update public.billing_provider_events set processed_at=now(),processing_status='failed',last_error=left(sqlerrm,500) where provider=p_provider and event_id=p_event_id; raise;
end $$;
revoke all on function private.apply_builder_site_billing_provider_event(text,text,text,uuid,uuid,text,timestamptz,timestamptz,text) from public,anon,authenticated;
grant execute on function private.apply_builder_site_billing_provider_event(text,text,text,uuid,uuid,text,timestamptz,timestamptz,text) to service_role;
create or replace function public.apply_builder_site_billing_provider_event(p_provider text,p_event_id text,p_event_type text,p_site_id uuid,p_owner_id uuid,p_provider_status text,p_paid_through timestamptz default null,p_failed_at timestamptz default null,p_provider_subscription_id text default null)
returns text language sql security invoker set search_path='pg_catalog','private','pg_temp' as $$select private.apply_builder_site_billing_provider_event(p_provider,p_event_id,p_event_type,p_site_id,p_owner_id,p_provider_status,p_paid_through,p_failed_at,p_provider_subscription_id)$$;
revoke all on function public.apply_builder_site_billing_provider_event(text,text,text,uuid,uuid,text,timestamptz,timestamptz,text) from public,anon,authenticated;
grant execute on function public.apply_builder_site_billing_provider_event(text,text,text,uuid,uuid,text,timestamptz,timestamptz,text) to service_role;
