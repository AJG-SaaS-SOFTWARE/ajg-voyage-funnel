-- Harden publication/domain operations against direct Supabase API bypasses.
-- Existing published sites are grandfathered until they are unpublished; any new
-- publication/republication requires BETA or a confirmed first paid period.

create or replace function private.eltara_cost_gate_unlocked(p_site_id uuid)
returns boolean
language sql
security definer
set search_path=''
stable
as $$
select
  current_user = 'service_role'
  or exists(
    select 1
    from public.sites s
    where s.id=p_site_id
      and (
        exists(
          select 1
          from public.beta_access_grants b
          where b.user_id=s.owner_id
            and b.active=true
            and b.starts_at<=now()
            and b.expires_at>now()
        )
        or exists(
          select 1
          from public.site_subscriptions ss
          left join public.site_billing_states bs on bs.site_id=ss.site_id
          where ss.site_id=s.id
            and ss.owner_id=s.owner_id
            and ss.plan_key in ('essential','growth')
            and ss.first_payment_confirmed_at is not null
            and coalesce(bs.state,'active') in ('active','grace')
        )
      )
  )
$$;

revoke all on function private.eltara_cost_gate_unlocked(uuid) from public,anon;
grant execute on function private.eltara_cost_gate_unlocked(uuid)
to authenticated,service_role;

create or replace function private.enforce_eltara_publication_cost_gate()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if current_user='service_role' then
    return new;
  end if;

  if tg_op='INSERT' and new.status='published' then
    raise exception 'first_paid_period_required_for_publication'
      using errcode='42501';
  end if;

  if tg_op='UPDATE'
     and old.status is distinct from 'published'
     and new.status='published'
     and not private.eltara_cost_gate_unlocked(new.id)
  then
    raise exception 'first_paid_period_required_for_publication'
      using errcode='42501';
  end if;

  return new;
end
$$;

revoke all on function private.enforce_eltara_publication_cost_gate()
from public,anon,authenticated;

drop trigger if exists enforce_eltara_publication_cost_gate on public.sites;
create trigger enforce_eltara_publication_cost_gate
before insert or update of status on public.sites
for each row execute function private.enforce_eltara_publication_cost_gate();

drop policy if exists "owners insert domains" on public.domains;
create policy "owners insert domains"
on public.domains
for insert
to authenticated
with check (
  exists(
    select 1 from public.sites s
    where s.id=domains.site_id
      and s.owner_id=(select auth.uid())
      and s.privacy_state='active'
  )
  and private.eltara_cost_gate_unlocked(domains.site_id)
);

drop policy if exists "owners or admins update domains" on public.domains;
create policy "owners or admins update domains"
on public.domains
for update
to authenticated
using (
  (
    exists(
      select 1 from public.sites s
      where s.id=domains.site_id
        and s.owner_id=(select auth.uid())
        and s.privacy_state='active'
    )
    and private.eltara_cost_gate_unlocked(domains.site_id)
  )
  or exists(
    select 1 from public.user_roles r
    where r.user_id=(select auth.uid()) and r.role='admin'
  )
)
with check (
  (
    exists(
      select 1 from public.sites s
      where s.id=domains.site_id
        and s.owner_id=(select auth.uid())
        and s.privacy_state='active'
    )
    and private.eltara_cost_gate_unlocked(domains.site_id)
  )
  or exists(
    select 1 from public.user_roles r
    where r.user_id=(select auth.uid()) and r.role='admin'
  )
);
