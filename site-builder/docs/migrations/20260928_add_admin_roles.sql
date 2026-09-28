create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('member','admin')),
  created_at timestamptz not null default now()
);
alter table public.user_roles enable row level security;
revoke all on public.user_roles from anon;
revoke insert,update,delete,truncate,references,trigger on public.user_roles from authenticated;
grant select on public.user_roles to authenticated;
grant select,insert,update,delete on public.user_roles to service_role;
create policy "users read own role" on public.user_roles for select to authenticated using ((select auth.uid())=user_id);

drop policy if exists "authenticated read accessible sites" on public.sites;
create policy "authenticated read accessible sites" on public.sites for select to authenticated using (
 owner_id=(select auth.uid()) or status='published' or exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='admin')
);
drop policy if exists "users read own subscription" on public.user_subscriptions;
create policy "users or admins read subscriptions" on public.user_subscriptions for select to authenticated using (
 user_id=(select auth.uid()) or exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='admin')
);
create policy "admins insert subscriptions" on public.user_subscriptions for insert to authenticated with check (exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='admin'));
create policy "admins update subscriptions" on public.user_subscriptions for update to authenticated using (exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='admin')) with check (exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='admin'));

drop policy if exists "authenticated read accessible domains" on public.domains;
create policy "authenticated read accessible domains" on public.domains for select to authenticated using (
 exists(select 1 from public.sites s where s.id=domains.site_id and s.owner_id=(select auth.uid())) or
 (verification_status='verified' and is_primary=true) or
 exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='admin')
);
drop policy if exists "owners update domains" on public.domains;
create policy "owners or admins update domains" on public.domains for update to authenticated using (
 exists(select 1 from public.sites s where s.id=domains.site_id and s.owner_id=(select auth.uid())) or exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='admin')
) with check (
 exists(select 1 from public.sites s where s.id=domains.site_id and s.owner_id=(select auth.uid())) or exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='admin')
);
