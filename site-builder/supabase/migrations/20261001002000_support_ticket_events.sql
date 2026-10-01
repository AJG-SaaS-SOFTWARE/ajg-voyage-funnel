-- AJG Site Builder — durable support event audit trail.
create table if not exists public.support_ticket_events (
  id bigint generated always as identity primary key,
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  actor_type text not null check (actor_type in ('client','system','admin')),
  event_type text not null check (event_type in ('created','diagnostic','status','note','resolution')),
  message text check (message is null or char_length(message) <= 2000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists support_ticket_events_ticket_created_idx
  on public.support_ticket_events(ticket_id, created_at asc);

alter table public.support_ticket_events enable row level security;
revoke all on public.support_ticket_events from anon;
revoke insert, update, delete on public.support_ticket_events from authenticated;
grant select on public.support_ticket_events to authenticated;

drop policy if exists "users read own support ticket events" on public.support_ticket_events;
create policy "users read own support ticket events"
on public.support_ticket_events for select to authenticated
using (
  exists(
    select 1 from public.support_tickets t
    where t.id=ticket_id
      and (
        t.user_id=(select auth.uid())
        or exists(
          select 1 from public.user_roles r
          where r.user_id=(select auth.uid()) and r.role='admin'
        )
      )
  )
);

comment on table public.support_ticket_events is
  'Privacy-minimized audit trail for support lifecycle changes. Browser roles are read-only; server service clients append events.';
