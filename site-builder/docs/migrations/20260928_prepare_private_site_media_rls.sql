-- Policies for the private working-media bucket.
-- Create the bucket itself through Supabase Storage API/Dashboard as PRIVATE before enabling client uploads.
-- Expected bucket id: site-private-media. Keep site-media public only for publishable assets.

drop policy if exists "owners select private site media objects" on storage.objects;
create policy "owners select private site media objects" on storage.objects for select to authenticated using (
 bucket_id='site-private-media'
 and (storage.foldername(name))[1]=(select auth.uid())::text
 and array_length(storage.foldername(name),1)>=2
);

drop policy if exists "authenticated upload private site media" on storage.objects;
create policy "authenticated upload private site media" on storage.objects for insert to authenticated with check (
 bucket_id='site-private-media'
 and (storage.foldername(name))[1]=(select auth.uid())::text
 and array_length(storage.foldername(name),1)>=2
 and public.can_modify_site_media(((storage.foldername(name))[2])::uuid)
);

drop policy if exists "owners update private site media objects" on storage.objects;
create policy "owners update private site media objects" on storage.objects for update to authenticated using (
 bucket_id='site-private-media'
 and (storage.foldername(name))[1]=(select auth.uid())::text
 and array_length(storage.foldername(name),1)>=2
 and public.can_modify_site_media(((storage.foldername(name))[2])::uuid)
) with check (
 bucket_id='site-private-media'
 and (storage.foldername(name))[1]=(select auth.uid())::text
 and array_length(storage.foldername(name),1)>=2
 and public.can_modify_site_media(((storage.foldername(name))[2])::uuid)
);

drop policy if exists "owners delete private site media objects" on storage.objects;
create policy "owners delete private site media objects" on storage.objects for delete to authenticated using (
 bucket_id='site-private-media'
 and (storage.foldername(name))[1]=(select auth.uid())::text
 and array_length(storage.foldername(name),1)>=2
 and public.can_modify_site_media(((storage.foldername(name))[2])::uuid)
);
