-- Admins may manage the subscription of a specific site; owners remain read-only.
drop policy if exists "admins insert site subscriptions" on public.site_subscriptions;
drop policy if exists "admins update site subscriptions" on public.site_subscriptions;
create policy "admins insert site subscriptions" on public.site_subscriptions for insert to authenticated
with check(exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='admin'));
create policy "admins update site subscriptions" on public.site_subscriptions for update to authenticated
using(exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='admin'))
with check(exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='admin'));
grant insert,update on public.site_subscriptions to authenticated;
