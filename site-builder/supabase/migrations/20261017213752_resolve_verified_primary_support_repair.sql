-- Narrow server-only resolution: not a general ticket status update API.
create function public.resolve_verified_primary_support_repair(
 p_ticket_id uuid, p_user_id uuid, p_site_id uuid,
 p_expected_updated_at timestamptz, p_diagnosis jsonb, p_root_domain text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
 t public.support_tickets;
 repair_id uuid;
 event_id bigint;
 stamp timestamptz := clock_timestamp();
 expected_hostname text;
 k text;
begin
 if p_diagnosis is null or jsonb_typeof(p_diagnosis) <> 'object'
   or jsonb_typeof(p_diagnosis->'checks') is distinct from 'array'
   or octet_length(p_diagnosis::text)>65536
   or p_root_domain is null or length(p_root_domain)>253
   or p_root_domain !~ '^[a-z0-9][a-z0-9.-]+[a-z0-9]$' then return null; end if;
 select * into t from public.support_tickets where id=p_ticket_id
   and user_id=p_user_id and site_id=p_site_id for update;
 if not found or t.updated_at is distinct from p_expected_updated_at
   or t.category<>'domain' or t.status not in ('diagnosed','waiting_customer')
   or jsonb_typeof(t.diagnosis->'checks') is distinct from 'array' then return null; end if;
 if not exists(select 1 from jsonb_array_elements(t.diagnosis->'checks') c
   where c->>'key'='domain' and c->>'status' in ('action','incident')) then return null; end if;
 foreach k in array array['backend','public_render','domain'] loop
   if not exists(select 1 from jsonb_array_elements(p_diagnosis->'checks') c
       where c->>'key'=k and c->>'status'='healthy')
     or exists(select 1 from jsonb_array_elements(p_diagnosis->'checks') c
       where c->>'key'=k and coalesce(c->>'status','')<>'healthy') then return null; end if;
 end loop;
 select lower(trim(s.slug))||'.'||p_root_domain into expected_hostname from public.sites s
   where s.id=p_site_id and s.owner_id=p_user_id and s.status='published'
     and s.privacy_state='active' and s.public_access_state='live';
 if not found then return null; end if;
 if (select count(*) from public.domains where site_id=p_site_id and kind='managed_subdomain')<>1
   or (select count(*) from public.domains where site_id=p_site_id and is_primary)<>1
   or exists(select 1 from public.domains where site_id=p_site_id and kind='custom_domain')
   or not exists(select 1 from public.domains d where d.site_id=p_site_id and d.kind='managed_subdomain'
      and d.hostname=expected_hostname
      and d.verification_status='verified' and d.is_primary) then return null; end if;
 select id into repair_id from public.support_remediation_runs
   where ticket_id=p_ticket_id and user_id=p_user_id and site_id=p_site_id
     and action='managed_domain_repair' and status='succeeded'
     and result_code='managed_domain_primary_repaired' and created_at>=t.updated_at
   order by created_at desc,id desc limit 1;
 if not found then return null; end if;
 update public.support_tickets set status='resolved',diagnosis=p_diagnosis,
   client_action=null,resolution_code='auto_verified_managed_primary_repair',
   resolved_at=stamp,updated_at=stamp where id=t.id;
 insert into public.support_ticket_events(ticket_id,actor_type,event_type,metadata)
 values(t.id,'system','resolution',jsonb_build_object('previous_status',t.status,
   'status','resolved','resolution_code','auto_verified_managed_primary_repair',
   'repair_run_id',repair_id,'previous_updated_at',t.updated_at,'updated_at',stamp))
 returning id into event_id;
 return jsonb_build_object('ticketId',t.id,'status','resolved','eventId',event_id::text,
   'repairRunId',repair_id,'updatedAt',stamp);
end;
$$;
revoke all on function public.resolve_verified_primary_support_repair(uuid,uuid,uuid,timestamptz,jsonb,text)
 from public,anon,authenticated;
grant execute on function public.resolve_verified_primary_support_repair(uuid,uuid,uuid,timestamptz,jsonb,text)
 to service_role;
