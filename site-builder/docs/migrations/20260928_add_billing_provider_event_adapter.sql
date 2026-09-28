-- Provider-neutral, service-role-only billing event adapter.
create table if not exists public.billing_provider_events(
 provider text not null,event_id text not null,event_type text not null,received_at timestamptz not null default now(),processed_at timestamptz,
 processing_status text not null default 'received' check(processing_status in ('received','processed','ignored','failed')),last_error text,
 primary key(provider,event_id)
);
alter table public.billing_provider_events enable row level security;
revoke all on public.billing_provider_events from public,anon,authenticated;
grant select,insert,update on public.billing_provider_events to service_role;

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
