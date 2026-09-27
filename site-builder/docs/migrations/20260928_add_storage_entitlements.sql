-- Read-only Storage metadata is used to meter the authenticated owner's site-media usage.
create or replace function public.get_my_storage_usage()
returns table(used_bytes bigint, storage_limit_mb integer)
language sql security invoker set search_path = ''
as $$
  select coalesce((select sum(coalesce((o.metadata->>'size')::bigint,0)) from storage.objects o where o.bucket_id='site-media' and o.owner_id=(select auth.uid()::text)),0)::bigint,
         coalesce((select e.storage_mb from public.get_my_entitlements() e limit 1),250)
$$;

create or replace function public.can_upload_site_media(p_bytes bigint)
returns boolean
language sql security invoker set search_path = ''
as $$
  select p_bytes > 0 and
    coalesce((select u.used_bytes from public.get_my_storage_usage() u limit 1),0) + p_bytes <=
    coalesce((select u.storage_limit_mb::bigint*1024*1024 from public.get_my_storage_usage() u limit 1),250::bigint*1024*1024)
$$;
revoke all on function public.get_my_storage_usage() from public, anon;
revoke all on function public.can_upload_site_media(bigint) from public, anon;
grant execute on function public.get_my_storage_usage() to authenticated, service_role;
grant execute on function public.can_upload_site_media(bigint) to authenticated, service_role;
