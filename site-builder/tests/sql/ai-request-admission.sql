begin;
set local role service_role;
do $$
declare s uuid;u uuid;r uuid:=gen_random_uuid(); fp text:=repeat('a',64); kh text:=repeat('b',64);
begin
  select id,owner_id into s,u from public.sites limit 1;
  if s is null then raise exception 'Missing site fixture'; end if;
  if exists(select 1 from pg_constraint where conname in ('ai_cost_reservations_site_id_fkey','ai_cost_reservations_user_id_fkey','ai_request_admissions_site_id_fkey') and confdeltype<>'n') then raise exception 'Deletion resets admission or spend'; end if;
  if has_function_privilege('authenticated','public.admit_ai_request(uuid,uuid,uuid,text,text,text)','EXECUTE') then raise exception 'Client admission access'; end if;
  if public.admit_ai_request(r,u,s,'heroTitle',fp,kh)<>'ok' then raise exception 'Admission failed'; end if;
  if public.admit_ai_request(gen_random_uuid(),u,s,'heroTitle',fp,kh)<>'duplicate_request' then raise exception 'Idempotency duplicate accepted'; end if;
  if public.admit_ai_request(gen_random_uuid(),u,s,'heroTitle',repeat('c',64),kh)<>'idempotency_conflict' then raise exception 'Key payload conflict accepted'; end if;
  if public.admit_ai_request(gen_random_uuid(),u,s,'aboutText',repeat('d',64),null)<>'request_in_progress' then raise exception 'Parallel request accepted'; end if;
  perform public.finish_ai_request(r,u,'failed');
  if public.admit_ai_request(gen_random_uuid(),u,s,'heroTitle',repeat('e',64),null)<>'operation_cooldown' then raise exception 'Cooldown bypass'; end if;
  if public.admit_ai_request(gen_random_uuid(),u,s,'heroTitle',fp,null)<>'duplicate_request' then raise exception 'Semantic duplicate accepted'; end if;
  update public.ai_request_admissions set created_at=now()-interval '3 minutes' where request_id=r;
  if public.admit_ai_request(gen_random_uuid(),u,s,'heroTitle',fp,kh)<>'duplicate_request' then raise exception 'Explicit key not retained'; end if;
  if public.admit_ai_request(gen_random_uuid(),u,s,'heroTitle',fp,null)<>'ok' then raise exception 'New intentional request blocked after cooldown'; end if;
end $$;
rollback;
