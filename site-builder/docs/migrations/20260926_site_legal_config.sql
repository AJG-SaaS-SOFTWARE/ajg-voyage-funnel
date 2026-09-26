-- Informations légales et RGPD propres à chaque site publié.
alter table public.sites
  add column if not exists legal_config jsonb not null default '{}'::jsonb;
