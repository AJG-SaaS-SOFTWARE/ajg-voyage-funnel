-- Choix de couleur, motif, image et son du site.
alter table public.sites
  add column if not exists design_assets jsonb not null default '{}'::jsonb;
