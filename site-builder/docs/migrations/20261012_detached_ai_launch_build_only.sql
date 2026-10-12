-- ELTARA detached AI Launch: optional BUILD generation with no RUN publication.
-- DO NOT APPLY until sandbox verifies all admission, quota and provider-budget RPCs.
-- This migration deliberately does NOT modify can_publish, public_site_available or can_modify_site_media.
-- Runtime checkout/webhook remain gated by AJG_DETACHED_AI_LAUNCH_ENABLED.
create or replace function public.get_my_site_capabilities(p_site_id uuid)
returns table(
  billing_state text, can_read boolean, can_edit boolean, can_publish boolean,
  can_generate_ai boolean, can_import boolean, can_export boolean,
  can_collect_leads boolean, can_view_billing boolean, public_site_available boolean
)
language sql
stable
security invoker
set search_path=''
as $$
with owned as (
  select s.id,s.owner_id,s.privacy_state
  from public.sites s where s.id=p_site_id and s.owner_id=(select auth.uid())
),
entitlement as (
  select e.plan_key,e.subscription_status
  from public.get_my_site_entitlements(p_site_id) e limit 1
),
subscription_projection as (
  select ss.first_payment_confirmed_at
  from public.site_subscriptions ss
  where ss.site_id=p_site_id and ss.owner_id=(select auth.uid()) limit 1
),
launch as (
  select exists(
    select 1 from public.site_ai_launch_entitlements l
    where l.site_id=p_site_id and l.owner_id=(select auth.uid())
      and l.source='stripe_purchase'
      and l.status='active' and l.operations_total>l.operations_used
      and (l.expires_at is null or l.expires_at>now())
  ) as purchased
),
resolved as (
  select o.privacy_state, public.has_active_beta_access() as beta_active,
    coalesce(e.plan_key,'free') plan_key,
    coalesce(e.subscription_status,'active') subscription_status,
    sp.first_payment_confirmed_at, coalesce(bs.state,'free') stored_state,
    (select purchased from launch) purchased_launch
  from owned o
  left join public.site_billing_states bs on bs.site_id=o.id
  left join entitlement e on true
  left join subscription_projection sp on true
),
flags as (
  select privacy_state, purchased_launch,
    case when beta_active then 'active'
      when first_payment_confirmed_at is not null
        and plan_key in ('essential','growth')
        and subscription_status in ('active','past_due')
      then case when stored_state='free' then 'active' else stored_state end
      else 'free' end as state,
    (beta_active or (first_payment_confirmed_at is not null
       and plan_key in ('essential','growth'))) ever_paid_or_beta,
    (beta_active or (first_payment_confirmed_at is not null
       and plan_key in ('essential','growth') and subscription_status='active'))
       current_paid_or_beta
  from resolved
)
select
  state,
  state in ('free','active','grace','restricted','public_suspended','retention'),
  privacy_state='active' and state in ('free','active','grace'),
  privacy_state='active' and ever_paid_or_beta
    and ((current_paid_or_beta and state='active') or state='grace'),
  privacy_state='active' and
    ((current_paid_or_beta and state='active')
      or (purchased_launch and state='free')),
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
grant execute on function public.get_my_site_capabilities(uuid) to authenticated,service_role;
