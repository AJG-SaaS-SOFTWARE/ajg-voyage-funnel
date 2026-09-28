-- Keep the anonymous contact surface narrow: visitors execute only the public wrapper.
create or replace function public.submit_contact_message(p_site_id uuid,p_sender_name text,p_sender_email text,p_subject text,p_message text,p_consent boolean,p_abuse_fingerprint text)
returns uuid language sql security definer set search_path='pg_catalog','private','pg_temp' as $$
 select private.submit_contact_message_internal(p_site_id,p_sender_name,p_sender_email,p_subject,p_message,p_consent,p_abuse_fingerprint)
$$;
revoke all on function private.submit_contact_message_internal(uuid,text,text,text,text,boolean,text) from public,anon,authenticated;
revoke usage on schema private from anon;
revoke all on function public.submit_contact_message(uuid,text,text,text,text,boolean,text) from public,authenticated;
grant execute on function public.submit_contact_message(uuid,text,text,text,text,boolean,text) to anon;
