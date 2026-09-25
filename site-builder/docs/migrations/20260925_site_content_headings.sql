-- Titres personnalisables des rubriques existantes.
alter table public.sites
  add column if not exists hero_tagline text not null default '',
  add column if not exists about_heading text not null default '';
