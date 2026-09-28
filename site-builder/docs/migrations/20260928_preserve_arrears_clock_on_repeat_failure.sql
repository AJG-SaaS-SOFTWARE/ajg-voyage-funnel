-- Repeated payment failures must not restart the arrears clock or relax restrictions.
create or replace function private.start_builder_payment_grace(p_site_id uuid,p_owner_id uuid,p_failed_at timestamptz,p_provider_status text,p_provider_event_id text default null)
returns void language plpgsql security definer set search_path='' as $$
declare old_state text;
begin
 if p_provider_event_id is not null and exists(select 1 from public.billing_state_events where provider_event_id=p_provider_event_id) then return; end if;
 select state into old_state from public.site_billing_states where site_id=p_site_id;
 if old_state in ('grace','restricted','public_suspended','retention','closed') then
   update public.site_billing_states set provider_status=p_provider_status,updated_at=now() where site_id=p_site_id and owner_id=p_owner_id;
   insert into public.billing_state_events(site_id,owner_id,from_state,to_state,reason,provider_event_id)
   values(p_site_id,p_owner_id,old_state,old_state,'payment_failed_repeat',p_provider_event_id);
   return;
 end if;
 insert into public.site_billing_states(site_id,owner_id,state,provider_status,grace_started_at,grace_until,restricted_at,public_suspend_at,export_until,delete_after,updated_at)
 values(p_site_id,p_owner_id,'grace',p_provider_status,p_failed_at,p_failed_at+interval '14 days',p_failed_at+interval '14 days',p_failed_at+interval '28 days',p_failed_at+interval '104 days',p_failed_at+interval '104 days',now())
 on conflict(site_id) do update set owner_id=excluded.owner_id,state='grace',provider_status=excluded.provider_status,grace_started_at=excluded.grace_started_at,grace_until=excluded.grace_until,restricted_at=excluded.restricted_at,public_suspend_at=excluded.public_suspend_at,export_until=excluded.export_until,delete_after=excluded.delete_after,updated_at=now();
 update public.sites set public_access_state='live' where id=p_site_id and owner_id=p_owner_id;
 insert into public.billing_state_events(site_id,owner_id,from_state,to_state,reason,provider_event_id) values(p_site_id,p_owner_id,old_state,'grace','payment_failed',p_provider_event_id);
 perform private.seed_builder_billing_notifications(p_site_id,p_owner_id,p_failed_at);
end $$;
revoke all on function private.start_builder_payment_grace(uuid,uuid,timestamptz,text,text) from public,anon,authenticated;
grant execute on function private.start_builder_payment_grace(uuid,uuid,timestamptz,text,text) to service_role;
