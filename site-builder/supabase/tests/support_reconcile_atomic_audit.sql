BEGIN;
DO $test$
DECLARE u uuid := gen_random_uuid(); t uuid := gen_random_uuid(); initial_time timestamptz := '2026-10-17T00:00:00Z'; committed boolean; n integer; st text;
BEGIN
 INSERT INTO auth.users(id) VALUES(u);
 INSERT INTO public.support_tickets(id,user_id,category,subject,message,status,updated_at)
 VALUES(t,u,'domain','Synthetic atomic support','Synthetic rollback-only support test','waiting_customer',initial_time);
 BEGIN
  committed := public.reconcile_support_ticket_atomic(t,u,initial_time,'resolved','{"overall":"healthy","checks":[]}'::jsonb,null,null,1);
  IF committed IS DISTINCT FROM true THEN RAISE EXCEPTION 'reservation_failed'; END IF;
  RAISE EXCEPTION 'synthetic_rollback' USING ERRCODE='P0002';
 EXCEPTION WHEN no_data_found THEN NULL;
 END;
 SELECT status INTO st FROM public.support_tickets WHERE id=t;
 SELECT count(*) INTO n FROM public.support_ticket_events WHERE ticket_id=t;
 IF st <> 'waiting_customer' OR n <> 0 THEN RAISE EXCEPTION 'rollback_not_atomic'; END IF;
 IF public.reconcile_support_ticket_atomic(t,gen_random_uuid(),initial_time,'resolved','{}'::jsonb,null,null,1) THEN RAISE EXCEPTION 'wrong_owner_accepted'; END IF;
 IF NOT public.reconcile_support_ticket_atomic(t,u,initial_time,'resolved','{"overall":"healthy","checks":[]}'::jsonb,null,null,1) THEN RAISE EXCEPTION 'commit_failed'; END IF;
 IF public.reconcile_support_ticket_atomic(t,u,initial_time,'resolved','{}'::jsonb,null,null,1) THEN RAISE EXCEPTION 'replay_accepted'; END IF;
 SELECT count(*) INTO n FROM public.support_ticket_events WHERE ticket_id=t AND actor_type='system' AND event_type='resolution';
 IF n<>1 THEN RAISE EXCEPTION 'audit_count_invalid'; END IF;
END;
$test$;
SELECT has_function_privilege('anon','public.reconcile_support_ticket_atomic(uuid,uuid,timestamptz,text,jsonb,text,text,integer)','EXECUTE') AS anon_can_execute,
has_function_privilege('authenticated','public.reconcile_support_ticket_atomic(uuid,uuid,timestamptz,text,jsonb,text,text,integer)','EXECUTE') AS customer_can_execute,
has_function_privilege('service_role','public.reconcile_support_ticket_atomic(uuid,uuid,timestamptz,text,jsonb,text,text,integer)','EXECUTE') AS service_can_execute;
ROLLBACK;
