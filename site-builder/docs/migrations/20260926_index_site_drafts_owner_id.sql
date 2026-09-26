-- Keep owner lookups efficient as the number of sites grows.
create index if not exists site_drafts_owner_id_idx
  on public.site_drafts(owner_id);
