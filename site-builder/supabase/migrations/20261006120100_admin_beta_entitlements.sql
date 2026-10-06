create or replace function public.has_active_beta_access()
returns boolean
language sql
stable
set search_path to ''
as $function$
  select
    coalesce((
      select g.active and g.starts_at <= now() and g.expires_at > now()
      from public.beta_access_grants g
      where g.user_id = (select auth.uid())
      limit 1
    ), false)
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = (select auth.uid())
        and ur.role = 'admin'
    )
$function$;

create or replace function public.get_my_beta_access()
returns table(active boolean, starts_at timestamptz, expires_at timestamptz)
language sql
stable
set search_path to ''
as $function$
  with grant_row as (
    select
      (g.active and g.starts_at <= now() and g.expires_at > now()) as active,
      g.starts_at,
      g.expires_at
    from public.beta_access_grants g
    where g.user_id = (select auth.uid())
    limit 1
  ),
  admin_row as (
    select exists (
      select 1
      from public.user_roles ur
      where ur.user_id = (select auth.uid())
        and ur.role = 'admin'
    ) as active
  )
  select gr.active, gr.starts_at, gr.expires_at
  from grant_row gr
  union all
  select true, null::timestamptz, null::timestamptz
  from admin_row ar
  where ar.active
    and not exists (select 1 from grant_row)
  limit 1
$function$;
