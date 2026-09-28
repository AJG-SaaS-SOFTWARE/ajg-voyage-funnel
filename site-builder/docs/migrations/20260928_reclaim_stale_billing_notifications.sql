-- Reclaim notification jobs if a worker dies after claiming them.
create or replace function private.claim_due_billing_notifications(p_limit integer default 20)
returns table(id bigint,site_id uuid,owner_id uuid,notification_key text,due_at timestamptz,attempts integer)
language plpgsql security definer set search_path='' as $$
begin
 return query
 with due as (
   select n.id from public.billing_notifications n
   where (
     (n.status in ('pending','failed') and n.due_at<=now())
     or (n.status='processing' and n.updated_at<=now()-interval '30 minutes')
   ) and n.attempts<5
   order by n.due_at for update skip locked limit greatest(1,least(p_limit,100))
 ), claimed as (
   update public.billing_notifications n set status='processing',attempts=n.attempts+1,updated_at=now()
   from due where n.id=due.id
   returning n.id,n.site_id,n.owner_id,n.notification_key,n.due_at,n.attempts
 )
 select * from claimed;
end $$;
revoke all on function private.claim_due_billing_notifications(integer) from public,anon,authenticated;
grant execute on function private.claim_due_billing_notifications(integer) to service_role;
