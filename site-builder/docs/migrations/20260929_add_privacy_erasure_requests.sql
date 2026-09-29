-- GDPR/data-rights workflow kept separate from billing arrears.
alter table public.sites
  add column if not exists privacy_state text not null default 'active'
    check (privacy_state in ('active','erasure_requested')),
  add column if not exists erasure_requested_at timestamptz;

create table if not exists public.data_erasure_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  site_id uuid references public.sites(id) on delete set null,
  scope text not null check (scope in ('site','account')),
  status text not null default 'requested'
    check (status in ('requested','processing','completed','canceled')),
  requested_at timestamptz not null default now(),
  processing_started_at timestamptz,
  completed_at timestamptz,
  canceled_at timestamptz,
  systems_processed jsonb not null default '[]'::jsonb,
  constraint erasure_scope_site_check check (
    (scope='site' and site_id is not null) or scope='account'
  )
);

alter table public.data_erasure_requests enable row level security;
revoke all on public.data_erasure_requests from public,anon;
grant select on public.data_erasure_requests to authenticated;
grant select,insert,update,delete on public.data_erasure_requests to service_role;

drop policy if exists "users read own erasure requests" on public.data_erasure_requests;
create policy "users read own erasure requests"
on public.data_erasure_requests
for select
to authenticated
using (user_id=(select auth.uid()));

create index if not exists data_erasure_requests_user_requested_idx
  on public.data_erasure_requests(user_id,requested_at desc)
  where user_id is not null;
create index if not exists data_erasure_requests_site_open_idx
  on public.data_erasure_requests(site_id,status)
  where site_id is not null and status in ('requested','processing');

create or replace function private.request_builder_site_erasure(
  p_site_id uuid,
  p_owner_id uuid
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_request_id uuid;
begin
  if not exists(
    select 1 from public.sites
    where id=p_site_id and owner_id=p_owner_id
  ) then
    raise exception 'site_owner_mismatch';
  end if;

  select id into v_request_id
  from public.data_erasure_requests
  where site_id=p_site_id
    and user_id=p_owner_id
    and scope='site'
    and status in ('requested','processing')
  order by requested_at desc
  limit 1;

  if v_request_id is null then
    insert into public.data_erasure_requests(user_id,site_id,scope,status)
    values(p_owner_id,p_site_id,'site','requested')
    returning id into v_request_id;
  end if;

  update public.sites
  set privacy_state='erasure_requested',
      erasure_requested_at=coalesce(erasure_requested_at,now()),
      public_access_state='suspended',
      updated_at=now()
  where id=p_site_id and owner_id=p_owner_id;

  return v_request_id;
end
$$;

revoke all on function private.request_builder_site_erasure(uuid,uuid)
from public,anon,authenticated;
grant execute on function private.request_builder_site_erasure(uuid,uuid)
to service_role;

create or replace function public.request_builder_site_erasure(
  p_site_id uuid,
  p_owner_id uuid
)
returns uuid
language sql
security invoker
set search_path='pg_catalog','private','pg_temp'
as $$
  select private.request_builder_site_erasure(p_site_id,p_owner_id)
$$;

revoke all on function public.request_builder_site_erasure(uuid,uuid)
from public,anon,authenticated;
grant execute on function public.request_builder_site_erasure(uuid,uuid)
to service_role;

create or replace function private.request_builder_account_erasure(
  p_owner_id uuid
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_request_id uuid;
begin
  if not exists(select 1 from auth.users where id=p_owner_id) then
    raise exception 'user_not_found';
  end if;

  select id into v_request_id
  from public.data_erasure_requests
  where user_id=p_owner_id
    and scope='account'
    and status in ('requested','processing')
  order by requested_at desc
  limit 1;

  if v_request_id is null then
    insert into public.data_erasure_requests(user_id,site_id,scope,status)
    values(p_owner_id,null,'account','requested')
    returning id into v_request_id;
  end if;

  update public.sites
  set privacy_state='erasure_requested',
      erasure_requested_at=coalesce(erasure_requested_at,now()),
      public_access_state='suspended',
      updated_at=now()
  where owner_id=p_owner_id;

  return v_request_id;
end
$$;

revoke all on function private.request_builder_account_erasure(uuid)
from public,anon,authenticated;
grant execute on function private.request_builder_account_erasure(uuid)
to service_role;

create or replace function public.request_builder_account_erasure(
  p_owner_id uuid
)
returns uuid
language sql
security invoker
set search_path='pg_catalog','private','pg_temp'
as $$
  select private.request_builder_account_erasure(p_owner_id)
$$;

revoke all on function public.request_builder_account_erasure(uuid)
from public,anon,authenticated;
grant execute on function public.request_builder_account_erasure(uuid)
to service_role;

-- Entitlement/capability reads remain available, but mutation/public capabilities
-- are disabled while an erasure request is pending.
create or replace function public.get_my_site_capabilities(p_site_id uuid)
returns table(
  billing_state text,
  can_read boolean,
  can_edit boolean,
  can_publish boolean,
  can_generate_ai boolean,
  can_import boolean,
  can_export boolean,
  can_collect_leads boolean,
  can_view_billing boolean,
  public_site_available boolean
)
language sql
security invoker
set search_path=''
as $$
 with owned as (
   select s.id,s.owner_id,s.privacy_state
   from public.sites s
   where s.id=p_site_id and s.owner_id=(select auth.uid())
 ),
 b as (
   select coalesce(bs.state,'active') state,o.privacy_state
   from owned o
   left join public.site_billing_states bs on bs.site_id=o.id
 )
 select
   state,
   state in ('free','trial','active','grace','restricted','public_suspended','retention'),
   privacy_state='active' and state in ('free','trial','active','grace'),
   privacy_state='active' and state in ('free','trial','active','grace'),
   privacy_state='active' and state in ('free','trial','active'),
   privacy_state='active' and state in ('free','trial','active','grace'),
   state in ('free','trial','active','grace','restricted','public_suspended','retention'),
   privacy_state='active' and state in ('free','trial','active','grace'),
   true,
   privacy_state='active' and state in ('free','trial','active','grace','restricted')
 from b
$$;

revoke all on function public.get_my_site_capabilities(uuid) from public,anon;
grant execute on function public.get_my_site_capabilities(uuid)
to authenticated,service_role;

create or replace function public.can_modify_site_media(p_site_id uuid)
returns boolean
language sql
security invoker
set search_path=''
stable
as $$
 select exists(
   select 1
   from public.sites s
   left join public.site_billing_states bs on bs.site_id=s.id
   where s.id=p_site_id
     and s.owner_id=(select auth.uid())
     and s.privacy_state='active'
     and coalesce(bs.state,'active') in ('free','trial','active','grace')
 )
$$;

revoke all on function public.can_modify_site_media(uuid) from public,anon;
grant execute on function public.can_modify_site_media(uuid)
to authenticated,service_role;

-- Owner mutations cannot bypass a pending erasure request through the Data API.
drop policy if exists "owners update sites" on public.sites;
create policy "owners update sites"
on public.sites
for update
to authenticated
using(
  owner_id=(select auth.uid())
  and privacy_state='active'
  and not exists(
    select 1 from public.site_billing_states bs
    where bs.site_id=sites.id
      and bs.state in ('restricted','public_suspended','retention','closed')
  )
)
with check(
  owner_id=(select auth.uid())
  and privacy_state='active'
  and not exists(
    select 1 from public.site_billing_states bs
    where bs.site_id=sites.id
      and bs.state in ('restricted','public_suspended','retention','closed')
  )
);

drop policy if exists "owners create site drafts" on public.site_drafts;
create policy "owners create site drafts"
on public.site_drafts
for insert
to authenticated
with check(
  owner_id=(select auth.uid())
  and exists(
    select 1
    from public.sites s
    left join public.site_billing_states bs on bs.site_id=s.id
    where s.id=site_drafts.site_id
      and s.owner_id=(select auth.uid())
      and s.privacy_state='active'
      and coalesce(bs.state,'active') in ('free','trial','active','grace')
  )
);

drop policy if exists "owners update site drafts" on public.site_drafts;
create policy "owners update site drafts"
on public.site_drafts
for update
to authenticated
using(
  owner_id=(select auth.uid())
  and exists(
    select 1
    from public.sites s
    left join public.site_billing_states bs on bs.site_id=s.id
    where s.id=site_drafts.site_id
      and s.owner_id=(select auth.uid())
      and s.privacy_state='active'
      and coalesce(bs.state,'active') in ('free','trial','active','grace')
  )
)
with check(
  owner_id=(select auth.uid())
  and exists(
    select 1
    from public.sites s
    left join public.site_billing_states bs on bs.site_id=s.id
    where s.id=site_drafts.site_id
      and s.owner_id=(select auth.uid())
      and s.privacy_state='active'
      and coalesce(bs.state,'active') in ('free','trial','active','grace')
  )
);

drop policy if exists "owners insert domains" on public.domains;
create policy "owners insert domains"
on public.domains
for insert
to authenticated
with check(
  exists(
    select 1
    from public.sites s
    left join public.site_billing_states bs on bs.site_id=s.id
    where s.id=domains.site_id
      and s.owner_id=(select auth.uid())
      and s.privacy_state='active'
      and coalesce(bs.state,'active') in ('free','trial','active','grace')
  )
);

drop policy if exists "owners delete domains" on public.domains;
create policy "owners delete domains"
on public.domains
for delete
to authenticated
using(
  exists(
    select 1
    from public.sites s
    left join public.site_billing_states bs on bs.site_id=s.id
    where s.id=domains.site_id
      and s.owner_id=(select auth.uid())
      and s.privacy_state='active'
      and coalesce(bs.state,'active') in ('free','trial','active','grace')
  )
);

drop policy if exists "owners or admins update domains" on public.domains;
create policy "owners or admins update domains"
on public.domains
for update
to authenticated
using(
  exists(
    select 1
    from public.sites s
    left join public.site_billing_states bs on bs.site_id=s.id
    where s.id=domains.site_id
      and s.owner_id=(select auth.uid())
      and s.privacy_state='active'
      and coalesce(bs.state,'active') in ('free','trial','active','grace')
  )
  or exists(
    select 1 from public.user_roles r
    where r.user_id=(select auth.uid()) and r.role='admin'
  )
)
with check(
  exists(
    select 1
    from public.sites s
    left join public.site_billing_states bs on bs.site_id=s.id
    where s.id=domains.site_id
      and s.owner_id=(select auth.uid())
      and s.privacy_state='active'
      and coalesce(bs.state,'active') in ('free','trial','active','grace')
  )
  or exists(
    select 1 from public.user_roles r
    where r.user_id=(select auth.uid()) and r.role='admin'
  )
);

-- Public contact collection stops immediately for a site under erasure.
create or replace function private.submit_contact_message_internal(
  p_site_id uuid,
  p_sender_name text,
  p_sender_email text,
  p_subject text,
  p_message text,
  p_consent boolean,
  p_abuse_fingerprint text
)
returns uuid
language plpgsql
security definer
set search_path='pg_catalog','public','private','pg_temp'
as $$
declare v_owner uuid; v_id uuid;
begin
 if p_consent is not true then raise exception 'consent_required' using errcode='22023'; end if;
 if char_length(trim(p_sender_name)) not between 1 and 100
 or char_length(trim(p_sender_email)) not between 3 and 254
 or p_sender_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$'
 or char_length(coalesce(p_subject,'')) > 160
 or char_length(trim(p_message)) not between 10 and 4000
 or char_length(p_abuse_fingerprint) not between 32 and 128
 then raise exception 'invalid_contact_message' using errcode='22023'; end if;

 select s.owner_id into v_owner
 from public.sites s
 where s.id=p_site_id
   and s.status='published'
   and s.public_access_state='live'
   and s.privacy_state='active'
   and not exists(
     select 1 from public.site_billing_states bs
     where bs.site_id=s.id
       and bs.state in ('restricted','public_suspended','retention','closed')
   );

 if v_owner is null then raise exception 'site_not_available' using errcode='22023'; end if;

 if (
   select count(*) from public.contact_messages
   where site_id=p_site_id
     and abuse_fingerprint=p_abuse_fingerprint
     and created_at > now()-interval '15 minutes'
 ) >= 3 then
   raise exception 'rate_limited' using errcode='P0001';
 end if;

 insert into public.contact_messages(
   site_id,owner_id,sender_name,sender_email,subject,message,consent_at,abuse_fingerprint
 )
 values(
   p_site_id,v_owner,trim(p_sender_name),lower(trim(p_sender_email)),
   left(coalesce(p_subject,''),160),trim(p_message),now(),p_abuse_fingerprint
 )
 returning id into v_id;
 return v_id;
end
$$;

revoke all on function private.submit_contact_message_internal(uuid,text,text,text,text,boolean,text)
from public,anon,authenticated;
grant execute on function private.submit_contact_message_internal(uuid,text,text,text,text,boolean,text)
to anon,authenticated,service_role;
