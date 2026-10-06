create table public.beta_followups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  site_id uuid references public.sites(id) on delete set null,
  mission_next_action text not null check (mission_next_action in ('essential','publish','compare','growth_explore','feedback')),
  channel text not null default 'email' check (channel in ('email','other')),
  admin_user_id uuid references auth.users(id) on delete set null,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index beta_followups_user_sent_idx
  on public.beta_followups(user_id, sent_at desc);
create index beta_followups_site_idx
  on public.beta_followups(site_id);
create index beta_followups_admin_idx
  on public.beta_followups(admin_user_id);

alter table public.beta_followups enable row level security;

revoke all on public.beta_followups from anon, authenticated;
grant select, insert, update, delete on public.beta_followups to service_role;
