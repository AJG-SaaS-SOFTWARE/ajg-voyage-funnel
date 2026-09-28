-- Site-scoped storage accounting. Counts public publishable assets and future private working assets.
create or replace function public.get_my_site_storage_usage(p_site_id uuid)
returns table(used_bytes bigint, storage_limit_mb integer)
language sql security invoker set search_path='' as $$
 select
   coalesce((
     select sum(coalesce((o.metadata->>'size')::bigint,0))
     from storage.objects o
     where o.bucket_id in ('site-media','site-private-media')
       and o.owner_id=(select auth.uid()::text)
       and (storage.foldername(o.name))[2]=p_site_id::text
   ),0)::bigint,
   coalesce((select e.storage_mb from public.get_my_site_entitlements(p_site_id) e limit 1),250)
$$;
revoke all on function public.get_my_site_storage_usage(uuid) from public,anon;
grant execute on function public.get_my_site_storage_usage(uuid) to authenticated;

create or replace function public.can_upload_site_media(p_site_id uuid,p_bytes bigint)
returns boolean language sql security invoker set search_path='' as $$
 select p_bytes > 0
   and public.can_modify_site_media(p_site_id)
   and coalesce((select u.used_bytes from public.get_my_site_storage_usage(p_site_id) u limit 1),0)+p_bytes
       <= coalesce((select u.storage_limit_mb::bigint*1024*1024 from public.get_my_site_storage_usage(p_site_id) u limit 1),250::bigint*1024*1024)
$$;
revoke all on function public.can_upload_site_media(uuid,bigint) from public,anon;
grant execute on function public.can_upload_site_media(uuid,bigint) to authenticated;
