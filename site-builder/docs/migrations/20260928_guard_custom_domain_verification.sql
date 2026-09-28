-- Custom-domain owners can request a hostname but cannot self-verify it.
create or replace function public.request_my_custom_domain(p_site_id uuid,p_hostname text)
returns public.domains language plpgsql security invoker set search_path='' as $$
declare v public.domains; v_host text:=lower(trim(p_hostname));
begin
 if not exists(select 1 from public.sites s where s.id=p_site_id and s.owner_id=(select auth.uid())) then raise exception 'site_not_available'; end if;
 if not exists(select 1 from public.get_my_site_entitlements(p_site_id) e where e.custom_domain) then raise exception 'custom_domain_unavailable'; end if;
 if v_host !~ '^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$' then raise exception 'invalid_domain'; end if;
 insert into public.domains(site_id,hostname,kind,verification_status,is_primary) values(p_site_id,v_host,'custom_domain','pending',false)
 on conflict(hostname) do update set site_id=excluded.site_id,kind='custom_domain',verification_status='pending',is_primary=false
 returning * into v; return v;
end $$;
revoke all on function public.request_my_custom_domain(uuid,text) from public,anon;
grant execute on function public.request_my_custom_domain(uuid,text) to authenticated;

drop policy if exists "owners or admins update domains" on public.domains;
create policy "admins update domains" on public.domains for update to authenticated
using(exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='admin'))
with check(exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='admin'));

revoke update,truncate,references,trigger on public.domains from authenticated;
grant select,insert,delete on public.domains to authenticated;
grant select,insert,update,delete on public.domains to service_role;
