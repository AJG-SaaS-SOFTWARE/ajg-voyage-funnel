-- AJG Site Builder — structured support tickets and Health Center foundation.
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  site_id uuid references public.sites(id) on delete set null,
  category text not null check (category in ('bug','domain','publication','billing','ai','data','other')),
  severity text not null default 'normal' check (severity in ('low','normal','high','critical')),
  subject text not null check (char_length(subject) between 3 and 160),
  message text not null check (char_length(message) between 10 and 4000),
  status text not null default 'new' check (status in ('new','diagnosed','waiting_customer','in_progress','resolved','closed')),
  diagnosis jsonb not null default '{}'::jsonb,
  client_action text,
  resolution_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists support_tickets_user_created_idx
  on public.support_tickets(user_id, created_at desc);
create index if not exists support_tickets_site_created_idx
  on public.support_tickets(site_id, created_at desc)
  where site_id is not null;
create index if not exists support_tickets_open_idx
  on public.support_tickets(status, created_at desc)
  where status not in ('resolved','closed');

alter table public.support_tickets enable row level security;

revoke all on public.support_tickets from anon;
revoke insert, update, delete on public.support_tickets from authenticated;
grant select on public.support_tickets to authenticated;

drop policy if exists "Users read own support tickets" on public.support_tickets;
create policy "Users read own support tickets"
on public.support_tickets for select to authenticated
using (
  user_id=(select auth.uid())
  or exists(
    select 1 from public.user_roles r
    where r.user_id=(select auth.uid()) and r.role='admin'
  )
);

comment on table public.support_tickets is
  'Server-created client support tickets with deterministic diagnostic snapshots. Direct client writes are intentionally disabled.';
