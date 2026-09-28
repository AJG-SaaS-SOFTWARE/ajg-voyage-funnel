-- Feedback authors can submit/read their own records; only admins can triage status.
revoke update,delete,truncate,references,trigger on public.user_feedback from authenticated;
grant select,insert on public.user_feedback to authenticated;
drop policy if exists "admins update feedback" on public.user_feedback;
create policy "admins update feedback" on public.user_feedback for update to authenticated
using(exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='admin'))
with check(exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='admin'));
grant update on public.user_feedback to authenticated;
