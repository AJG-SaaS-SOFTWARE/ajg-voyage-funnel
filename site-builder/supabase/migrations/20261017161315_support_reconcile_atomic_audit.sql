-- The trusted service still computes the recovery policy. This function adds
-- atomic CAS + audit; it does not expose a customer-controlled resolution API.
create function public.reconcile_support_ticket_atomic(
  p_ticket_id uuid, p_user_id uuid, p_expected_updated_at timestamptz,
  p_status text, p_diagnosis jsonb, p_client_action text,
  p_severity text, p_age_hours integer
) returns boolean
language plpgsql security invoker set search_path = ''
as $$
declare
  changed uuid;
  resolution text;
  committed_at timestamptz := clock_timestamp();
begin
  if p_status is null or p_status not in ('waiting_customer','diagnosed','resolved')
    or p_diagnosis is null or jsonb_typeof(p_diagnosis) <> 'object'
    or octet_length(p_diagnosis::text) > 65536
    or (p_severity is not null and p_severity not in ('normal','high'))
    or p_age_hours is null or p_age_hours < 0
    or length(p_client_action) > 2000 then
    raise exception 'invalid_support_reconciliation' using errcode = '22023';
  end if;
  if p_status = 'resolved' then
    resolution := 'auto_health_recovered';
  end if;
  update public.support_tickets set
    status = p_status, diagnosis = p_diagnosis, client_action = p_client_action,
    resolution_code = resolution,
    resolved_at = case when p_status = 'resolved' then committed_at else null end,
    updated_at = committed_at, severity = coalesce(p_severity, severity)
  where id = p_ticket_id and user_id = p_user_id
    and status = 'waiting_customer' and updated_at = p_expected_updated_at
  returning id into changed;
  if changed is null then return false; end if;

  insert into public.support_ticket_events(ticket_id,actor_type,event_type,metadata)
  values(changed,'system',case when p_status='resolved' then 'resolution' else 'diagnostic' end,
    jsonb_build_object('previous_status','waiting_customer','status',p_status,
      'diagnosis',p_diagnosis->>'overall','resolution_code',resolution,
      'age_hours',p_age_hours));
  return true;
end;
$$;
revoke all on function public.reconcile_support_ticket_atomic(uuid,uuid,timestamptz,text,jsonb,text,text,integer)
  from public, anon, authenticated;
grant execute on function public.reconcile_support_ticket_atomic(uuid,uuid,timestamptz,text,jsonb,text,text,integer)
  to service_role;
