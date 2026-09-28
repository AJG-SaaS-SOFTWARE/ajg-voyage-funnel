-- Manual transactional acceptance suite for the AJG Builder billing state machine.
-- Run against a disposable/test site only. Every scenario rolls back.
-- Replace the UUIDs below before running.
\set site_id '00000000-0000-0000-0000-000000000000'
\set owner_id '00000000-0000-0000-0000-000000000000'

-- Expected policy matrix:
-- J13 grace: edit/publish/import/leads yes; AI no; public yes; export yes.
-- J14 restricted: edit/publish/import/leads/AI no; public yes; export yes.
-- J27 restricted: public yes.
-- J28 public_suspended: public no; export yes.
-- J104 retention: public no; export/read remain available for controlled recovery; no automatic deletion.
-- Payment recovery: active + public live + pending reminders canceled.

begin;
select private.start_builder_payment_grace(:'site_id'::uuid,:'owner_id'::uuid,now()-interval '13 days','past_due','accept-j13');
select * from public.site_billing_states where site_id=:'site_id'::uuid;
rollback;

begin;
select private.start_builder_payment_grace(:'site_id'::uuid,:'owner_id'::uuid,now()-interval '14 days 1 minute','past_due','accept-j14');
select private.advance_builder_billing_states();
select bs.state,s.public_access_state from public.site_billing_states bs join public.sites s on s.id=bs.site_id where bs.site_id=:'site_id'::uuid;
rollback;

begin;
select private.start_builder_payment_grace(:'site_id'::uuid,:'owner_id'::uuid,now()-interval '28 days 1 minute','past_due','accept-j28');
select private.advance_builder_billing_states();
select bs.state,s.public_access_state from public.site_billing_states bs join public.sites s on s.id=bs.site_id where bs.site_id=:'site_id'::uuid;
select private.reactivate_builder_site(:'site_id'::uuid,:'owner_id'::uuid,now()+interval '1 month','active','accept-paid');
select bs.state,s.public_access_state from public.site_billing_states bs join public.sites s on s.id=bs.site_id where bs.site_id=:'site_id'::uuid;
rollback;

begin;
select private.start_builder_payment_grace(:'site_id'::uuid,:'owner_id'::uuid,now()-interval '105 days','past_due','accept-j104');
select private.advance_builder_billing_states();
select bs.state,s.public_access_state from public.site_billing_states bs join public.sites s on s.id=bs.site_id where bs.site_id=:'site_id'::uuid;
rollback;
