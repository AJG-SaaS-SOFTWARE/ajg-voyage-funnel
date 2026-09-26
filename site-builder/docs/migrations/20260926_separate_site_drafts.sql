-- Garder le site publié accessible pendant la rédaction de modifications.
alter table public.sites add column if not exists draft_config jsonb;
