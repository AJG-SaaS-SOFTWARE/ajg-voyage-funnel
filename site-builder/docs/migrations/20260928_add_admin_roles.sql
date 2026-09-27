create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('member','admin')),
  created_at timestamptz not null default now()
);
alter table public.user_roles enable row level security;
revoke all on public.user_roles from anon;
grant select on public.user_roles to authenticated;
create policy "users read own role" on public.user_roles for select to authenticated using ((select auth.uid())=user_id);
create policy "admins read all sites" on public.sites for select to authenticated using (exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='admin'));
create policy "admins read all subscriptions" on public.user_subscriptions for select to authenticated using (exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='admin'));
create policy "admins insert subscriptions" on public.user_subscriptions for insert to authenticated with check (exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='admin'));
create policy "admins update subscriptions" on public.user_subscriptions for update to authenticated using (exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='admin')) with check (exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='admin'));
create policy "admins read all domains" on public.domains for select to authenticated using (exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='admin'));
create policy "admins update domains" on public.domains for update to authenticated using (exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='admin')) with check (exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='admin'));
