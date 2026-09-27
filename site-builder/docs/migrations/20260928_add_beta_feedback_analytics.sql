create table if not exists public.product_events (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 site_id uuid references public.sites(id) on delete cascade,
 event_name text not null check (event_name in ('builder_open','step_identity','step_story','step_booking','step_review','architect_applied','revision_applied','publish_success')),
 created_at timestamptz not null default now()
);
create index if not exists product_events_user_created_idx on public.product_events(user_id,created_at desc);
create index if not exists product_events_event_created_idx on public.product_events(event_name,created_at desc);
create index if not exists product_events_site_id_idx on public.product_events(site_id);
alter table public.product_events enable row level security;
revoke all on public.product_events from anon;
grant insert,select on public.product_events to authenticated;
create policy "users insert own product events" on public.product_events for insert to authenticated with check ((select auth.uid())=user_id);
create policy "users read own product events" on public.product_events for select to authenticated using ((select auth.uid())=user_id or exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='admin'));

create table if not exists public.user_feedback (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 site_id uuid references public.sites(id) on delete set null,
 category text not null check (category in ('bug','idea','usability','quality','other')),
 rating integer check (rating between 1 and 5),
 message text not null check (char_length(message) between 3 and 2000),
 status text not null default 'new' check (status in ('new','reviewed','planned','resolved','dismissed')),
 created_at timestamptz not null default now()
);
create index if not exists user_feedback_status_created_idx on public.user_feedback(status,created_at desc);
create index if not exists user_feedback_site_id_idx on public.user_feedback(site_id);
create index if not exists user_feedback_user_id_idx on public.user_feedback(user_id);
alter table public.user_feedback enable row level security;
revoke all on public.user_feedback from anon;
grant insert,select on public.user_feedback to authenticated;
create policy "users insert own feedback" on public.user_feedback for insert to authenticated with check ((select auth.uid())=user_id and status='new');
create policy "users read own feedback" on public.user_feedback for select to authenticated using ((select auth.uid())=user_id or exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='admin'));
