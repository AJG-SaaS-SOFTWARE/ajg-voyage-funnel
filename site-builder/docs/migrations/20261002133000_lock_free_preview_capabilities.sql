-- Free preview lock.
-- Free users can draft and inspect a representative preview, but cannot publish,
-- host, collect leads, export, or attach custom domains. Beta grants and paid RUN
-- plans keep their launch capabilities.

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
 resolved as (
   select
     o.privacy_state,
     coalesce(e.plan_key,'free') plan_key,
     coalesce(e.subscription_status,'active') subscription_status,
     coalesce(
       bs.state,
       case
         when coalesce(e.plan_key,'free') in ('essential','growth')
          and coalesce(e.subscription_status,'active') in ('active','trialing','past_due')
         then 'active'
         else 'free'
       end
     ) state
   from owned o
   left join public.site_billing_states bs on bs.site_id=o.id
   left join entitlement e on true
 ),
 flags as (
   select
     privacy_state,
     state,
     plan_key in ('essential','growth')
       and subscription_status in ('active','trialing','past_due') as paid_run,
     plan_key in ('essential','growth')
       and subscription_status in ('active','trialing') as current_run
   from resolved
 )
 select
   state,
   state in ('free','trial','active','grace','restricted','public_suspended','retention'),
   privacy_state='active' and state in ('free','trial','active','grace'),
   privacy_state='active' and paid_run and (
     (current_run and state in ('active','trial')) or state='grace'
   ),
   privacy_state='active' and state in ('free','trial','active'),
   privacy_state='active' and state in ('free','trial','active','grace'),
   paid_run and state in ('active','grace','restricted','public_suspended','retention'),
   privacy_state='active' and paid_run and (
     (current_run and state in ('active','trial')) or state='grace'
   ),
   true,
   privacy_state='active' and paid_run and state in ('active','grace','restricted')
 from flags
$$;

revoke all on function public.get_my_site_capabilities(uuid) from public,anon;
grant execute on function public.get_my_site_capabilities(uuid)
to authenticated,service_role;
