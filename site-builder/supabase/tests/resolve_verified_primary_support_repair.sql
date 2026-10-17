BEGIN;
DO $test$
DECLARE u uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); t uuid:=gen_random_uuid();
 r uuid; v timestamptz:=now()-interval '10 seconds'; proof jsonb; n integer;
 healthy jsonb:='{"checks":[{"key":"backend","status":"healthy"},{"key":"public_render","status":"healthy"},{"key":"domain","status":"healthy"}]}'::jsonb;
BEGIN
 INSERT INTO auth.users(id) VALUES(u);
 INSERT INTO public.sites(id,owner_id,slug,status,brand_name,first_name,last_name,hero_title)
 VALUES(s,u,'proof-'||substr(s::text,1,8),'draft','Synthetic','Test','User','Synthetic test');
 INSERT INTO public.site_subscriptions(site_id,owner_id,plan_key,status,provider,first_payment_confirmed_at,current_period_end)
 VALUES(s,u,'growth','active','internal-e2e',now(),now()+interval '15 minutes');
 UPDATE public.sites SET status='published' WHERE id=s;
 INSERT INTO public.domains(site_id,hostname,kind,verification_status,is_primary)
 SELECT s,slug||'.example.test','managed_subdomain','verified',true FROM public.sites WHERE id=s;
 INSERT INTO public.support_tickets(id,user_id,site_id,category,subject,message,status,updated_at,diagnosis)
 VALUES(t,u,s,'domain','Synthetic domain repair','Rollback-only verification fixture','diagnosed',v,'{"checks":[{"key":"domain","status":"action"}]}');
 IF public.resolve_verified_primary_support_repair(t,u,s,v,healthy,'example.test') IS NOT NULL THEN RAISE EXCEPTION 'missing_audit_accepted'; END IF;
 INSERT INTO public.support_remediation_runs(user_id,site_id,ticket_id,action,trigger_source,status,result_code)
 VALUES(u,s,t,'managed_domain_repair','client','succeeded','managed_domain_primary_repaired') RETURNING id INTO r;
 IF public.resolve_verified_primary_support_repair(t,gen_random_uuid(),s,v,healthy,'example.test') IS NOT NULL THEN RAISE EXCEPTION 'wrong_owner_accepted'; END IF;
 IF public.resolve_verified_primary_support_repair(t,u,s,v-interval '1 second',healthy,'example.test') IS NOT NULL THEN RAISE EXCEPTION 'stale_version_accepted'; END IF;
 IF public.resolve_verified_primary_support_repair(t,u,s,v,'{"checks":[]}','example.test') IS NOT NULL THEN RAISE EXCEPTION 'missing_checks_accepted'; END IF;
 BEGIN
  INSERT INTO public.domains(site_id,hostname,kind,verification_status,is_primary) VALUES(s,'custom.example.test','custom_domain','verified',false);
  IF public.resolve_verified_primary_support_repair(t,u,s,v,healthy,'example.test') IS NOT NULL THEN RAISE EXCEPTION 'custom_domain_accepted'; END IF;
  RAISE EXCEPTION 'rollback_custom_fixture' USING ERRCODE='P0002';
 EXCEPTION WHEN no_data_found THEN NULL; END;
 BEGIN
  proof:=public.resolve_verified_primary_support_repair(t,u,s,v,healthy,'example.test');
  IF proof IS NULL THEN RAISE EXCEPTION 'positive_fixture_refused'; END IF;
  RAISE EXCEPTION 'rollback_commit_fixture' USING ERRCODE='P0002';
 EXCEPTION WHEN no_data_found THEN NULL; END;
 SELECT count(*) INTO n FROM public.support_ticket_events WHERE ticket_id=t;
 IF n<>0 OR (SELECT status FROM public.support_tickets WHERE id=t)<>'diagnosed' THEN RAISE EXCEPTION 'rollback_not_atomic'; END IF;
 proof:=public.resolve_verified_primary_support_repair(t,u,s,v,healthy,'example.test');
 IF proof IS NULL OR proof->>'repairRunId'<>r::text THEN RAISE EXCEPTION 'proof_uncorrelated'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.support_ticket_events WHERE id=(proof->>'eventId')::bigint AND ticket_id=t AND actor_type='system' AND metadata->>'repair_run_id'=r::text) THEN RAISE EXCEPTION 'audit_missing'; END IF;
 IF public.resolve_verified_primary_support_repair(t,u,s,v,healthy,'example.test') IS NOT NULL THEN RAISE EXCEPTION 'replay_accepted'; END IF;
END;
$test$;
SELECT has_function_privilege('anon','public.resolve_verified_primary_support_repair(uuid,uuid,uuid,timestamptz,jsonb,text)','EXECUTE') AS anon_can_execute,
has_function_privilege('authenticated','public.resolve_verified_primary_support_repair(uuid,uuid,uuid,timestamptz,jsonb,text)','EXECUTE') AS customer_can_execute,
has_function_privilege('service_role','public.resolve_verified_primary_support_repair(uuid,uuid,uuid,timestamptz,jsonb,text)','EXECUTE') AS service_can_execute;
ROLLBACK;
