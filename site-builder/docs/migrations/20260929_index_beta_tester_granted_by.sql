create index if not exists beta_access_grants_granted_by_idx
on public.beta_access_grants(granted_by)
where granted_by is not null;
