-- Operational retry/audit field for controlled GDPR purge processing.
alter table public.data_erasure_requests
  add column if not exists last_error text;

-- Client may see request status/timestamps, but not internal failure details.
revoke insert,update,delete on public.data_erasure_requests from authenticated;
