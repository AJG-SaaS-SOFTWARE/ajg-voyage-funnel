create policy beta_access_grants_select_own
on public.beta_access_grants
for select
to authenticated
using ((select auth.uid()) = user_id);

grant select on table public.beta_access_grants to authenticated;

create or replace function public.get_my_beta_access()
returns table(
  active boolean,
  starts_at timestamptz,
  expires_at timestamptz
)
language sql
stable
security invoker
set search_path=''
as $$
  select
    (
      g.active
      and g.starts_at <= now()
      and g.expires_at > now()
    ) as active,
    g.starts_at,
    g.expires_at
  from public.beta_access_grants g
  where g.user_id = (select auth.uid())
  limit 1
$$;

create or replace function public.has_active_beta_access()
returns boolean
language sql
stable
security invoker
set search_path=''
as $$
  select coalesce(
    (
      select
        g.active
        and g.starts_at <= now()
        and g.expires_at > now()
      from public.beta_access_grants g
      where g.user_id = (select auth.uid())
      limit 1
    ),
    false
  )
$$;
