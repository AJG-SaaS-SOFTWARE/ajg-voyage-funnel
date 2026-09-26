-- Un brouillon ne doit jamais être une colonne lisible sur la ligne publique du site.
create table if not exists public.site_drafts (
  site_id uuid primary key references public.sites(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  config jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.site_drafts enable row level security;
create policy "owners read site drafts" on public.site_drafts for select to authenticated using (owner_id = (select auth.uid()));
create policy "owners create site drafts" on public.site_drafts for insert to authenticated with check (owner_id = (select auth.uid()) and exists (select 1 from public.sites where id=site_id and owner_id=(select auth.uid())));
create policy "owners update site drafts" on public.site_drafts for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "owners delete site drafts" on public.site_drafts for delete to authenticated using (owner_id = (select auth.uid()));
revoke all on public.site_drafts from anon;
grant select, insert, update, delete on public.site_drafts to authenticated;
alter table public.sites drop column if exists draft_config;
