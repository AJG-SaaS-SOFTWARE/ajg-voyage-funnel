drop policy if exists "owners update site drafts" on public.site_drafts;
create policy "owners update site drafts" on public.site_drafts for update to authenticated
  using (owner_id = (select auth.uid()) and exists (select 1 from public.sites where id=site_id and owner_id=(select auth.uid())))
  with check (owner_id = (select auth.uid()) and exists (select 1 from public.sites where id=site_id and owner_id=(select auth.uid())));
