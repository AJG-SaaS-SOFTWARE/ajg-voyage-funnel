-- AJG Site Builder — schéma initial
-- À appliquer dans un projet Supabase dédié après validation du coût.

create extension if not exists pgcrypto;

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid,
  slug text not null unique,
  status text not null default 'draft' check (status in ('draft','published','suspended')),
  primary_language text not null default 'fr' check (primary_language in ('fr','en')),
  enabled_languages text[] not null default array['fr']::text[],
  brand_name text not null,
  first_name text not null,
  last_name text not null,
  hero_title text not null,
  hero_subtitle text not null default '',
  about_text text not null default '',
  booking_label text not null default 'Réserver une présentation',
  booking_url text not null default '',
  instagram_url text not null default '',
  facebook_url text not null default '',
  profile_image_url text not null default '',
  show_travel_journals boolean not null default true,
  compliance_profile text not null default 'mwr-life-independent-ambassador-v1',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  media_type text not null check (media_type in ('image','video')),
  storage_path text not null,
  alt_text text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.travel_journals (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  slug text not null,
  title text not null,
  excerpt text not null default '',
  body jsonb not null default '[]'::jsonb,
  cover_media_id uuid references public.media(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(site_id, slug)
);

create table if not exists public.domains (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  hostname text not null unique,
  kind text not null check (kind in ('managed_subdomain','custom_domain')),
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','failed')),
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.sites enable row level security;
alter table public.media enable row level security;
alter table public.travel_journals enable row level security;
alter table public.domains enable row level security;

-- Les policies seront ajoutées avec l'authentification.
-- Aucun accès public en écriture ne doit être activé avant cette étape.
