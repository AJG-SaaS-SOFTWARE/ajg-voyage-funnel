-- ELTARA commercial cost gate.
-- Non-beta accounts may draft a preview, but variable-cost features stay locked
-- until Stripe confirms the first paid invoice for the site.

alter table public.site_subscriptions
  add column if not exists first_payment_confirmed_at timestamptz;

create or replace function private.apply_builder_site_billing_provider_event(
  p_provider text,
  p_event_id text,
  p_event_type text,
  p_site_id uuid,
  p_owner_id uuid,
  p_provider_status text,
  p_paid_through timestamptz default null,
  p_failed_at timestamptz default null,
  p_provider_subscription_id text default null
)
returns text
language plpgsql
security definer
set search_path=''
as $$
declare
  v_result text := 'ignored';
  v_plan text;
begin
  if not exists(
    select 1 from public.sites
    where id=p_site_id and owner_id=p_owner_id
  ) then
    raise exception 'site_owner_mismatch';
  end if;

  insert into public.billing_provider_events(provider,event_id,event_type)
  values(p_provider,p_event_id,p_event_type)
  on conflict(provider,event_id) do nothing;

  if not found then return 'duplicate'; end if;

  select coalesce(ss.plan_key,us.plan_key,'free')
  into v_plan
  from public.sites s
  left join public.site_subscriptions ss on ss.site_id=s.id
  left join public.user_subscriptions us on us.user_id=s.owner_id
  where s.id=p_site_id;

  insert into public.site_subscriptions(
    site_id,owner_id,plan_key,status,provider,
    provider_subscription_id,current_period_end
  )
  values(
    p_site_id,p_owner_id,v_plan,p_provider_status,p_provider,
    p_provider_subscription_id,p_paid_through
  )
  on conflict(site_id) do update
  set status=excluded.status,
      provider=excluded.provider,
      provider_subscription_id=coalesce(
        excluded.provider_subscription_id,
        public.site_subscriptions.provider_subscription_id
      ),
      current_period_end=coalesce(
        excluded.current_period_end,
        public.site_subscriptions.current_period_end
      ),
      updated_at=now();

  if p_event_type in ('payment_failed','subscription_past_due') then
    perform private.start_builder_payment_grace(
      p_site_id,p_owner_id,coalesce(p_failed_at,now()),
      p_provider_status,p_provider||':'||p_event_id
    );
    v_result := 'grace_started';
  elsif p_event_type='payment_succeeded' then
    update public.site_subscriptions
    set first_payment_confirmed_at=coalesce(first_payment_confirmed_at,now()),
        updated_at=now()
    where site_id=p_site_id and owner_id=p_owner_id;

    perform private.reactivate_builder_site(
      p_site_id,p_owner_id,p_paid_through,
      p_provider_status,p_provider||':'||p_event_id
    );
    v_result := 'reactivated';
  elsif p_event_type='subscription_active' then
    v_result := 'projection_updated';
  end if;

  update public.billing_provider_events
  set processed_at=now(),
      processing_status=case when v_result='ignored' then 'ignored' else 'processed' end
  where provider=p_provider and event_id=p_event_id;

  return v_result;
exception
  when others then
    update public.billing_provider_events
    set processed_at=now(),
        processing_status='failed',
        last_error=left(sqlerrm,500)
    where provider=p_provider and event_id=p_event_id;
    raise;
end
$$;

revoke all on function private.apply_builder_site_billing_provider_event(
  text,text,text,uuid,uuid,text,timestamptz,timestamptz,text
) from public,anon,authenticated;
grant execute on function private.apply_builder_site_billing_provider_event(
  text,text,text,uuid,uuid,text,timestamptz,timestamptz,text
) to service_role;

create or replace function public.get_my_site_capabilities(p_site_id uuid)
returns table(
  billing_state text,
  can_read boolean,
  can_edit boolean,
  can_publish boolean,
  can_generate_ai boolean,
  can_import boolean,
  can_export boolean,
  can_collect_leads boolean,
  can_view_billing boolean,
  public_site_available boolean
)
language sql
security invoker
set search_path=''
as $$
with owned as (
  select s.id,s.owner_id,s.privacy_state
  from public.sites s
  where s.id=p_site_id and s.owner_id=(select auth.uid())
),
entitlement as (
  select e.plan_key,e.subscription_status
  from public.get_my_site_entitlements(p_site_id) e
  limit 1
),
subscription_projection as (
  select ss.first_payment_confirmed_at
  from public.site_subscriptions ss
  where ss.site_id=p_site_id
    and ss.owner_id=(select auth.uid())
  limit 1
),
resolved as (
  select
    o.privacy_state,
    public.has_active_beta_access() as beta_active,
    coalesce(e.plan_key,'free') plan_key,
    coalesce(e.subscription_status,'active') subscription_status,
    sp.first_payment_confirmed_at,
    coalesce(bs.state,'free') stored_state
  from owned o
  left join public.site_billing_states bs on bs.site_id=o.id
  left join entitlement e on true
  left join subscription_projection sp on true
),
flags as (
  select
    privacy_state,
    beta_active,
    plan_key,
    subscription_status,
    first_payment_confirmed_at,
    case
      when beta_active then 'active'
      when first_payment_confirmed_at is not null
       and plan_key in ('essential','growth')
       and subscription_status in ('active','past_due')
      then case when stored_state='free' then 'active' else stored_state end
      else 'free'
    end state,
    (
      beta_active
      or (
        first_payment_confirmed_at is not null
        and plan_key in ('essential','growth')
      )
    ) ever_paid_or_beta,
    (
      beta_active
      or (
        first_payment_confirmed_at is not null
        and plan_key in ('essential','growth')
        and subscription_status='active'
      )
    ) current_paid_or_beta
  from resolved
)
select
  state,
  state in ('free','active','grace','restricted','public_suspended','retention'),
  privacy_state='active' and state in ('free','active','grace'),
  privacy_state='active' and ever_paid_or_beta
    and ((current_paid_or_beta and state='active') or state='grace'),
  privacy_state='active' and current_paid_or_beta and state='active',
  privacy_state='active' and ever_paid_or_beta
    and ((current_paid_or_beta and state='active') or state='grace'),
  ever_paid_or_beta
    and state in ('active','grace','restricted','public_suspended','retention'),
  privacy_state='active' and ever_paid_or_beta
    and ((current_paid_or_beta and state='active') or state='grace'),
  true,
  privacy_state='active' and ever_paid_or_beta
    and state in ('active','grace','restricted')
from flags
$$;

revoke all on function public.get_my_site_capabilities(uuid) from public,anon;
grant execute on function public.get_my_site_capabilities(uuid)
to authenticated,service_role;

create or replace function public.can_modify_site_media(p_site_id uuid)
returns boolean
language sql
security invoker
set search_path=''
stable
as $$
select exists(
  select 1
  from public.sites s
  left join public.site_billing_states bs on bs.site_id=s.id
  left join public.site_subscriptions ss
    on ss.site_id=s.id and ss.owner_id=s.owner_id
  where s.id=p_site_id
    and s.owner_id=(select auth.uid())
    and s.privacy_state='active'
    and (
      public.has_active_beta_access()
      or (
        ss.plan_key in ('essential','growth')
        and ss.first_payment_confirmed_at is not null
        and ss.status in ('active','past_due')
        and coalesce(bs.state,'active') in ('active','grace')
      )
    )
)
$$;

revoke all on function public.can_modify_site_media(uuid) from public,anon;
grant execute on function public.can_modify_site_media(uuid)
to authenticated,service_role;
