-- Legacy account-wide provider adapter is intentionally disabled.
-- Billing events must target one site so an arrears event for site A can never restrict site B.
revoke all on function public.apply_builder_billing_provider_event(text,text,text,uuid,text,timestamptz,timestamptz) from public,anon,authenticated,service_role;
revoke all on function private.apply_builder_billing_provider_event(text,text,text,uuid,text,timestamptz,timestamptz) from public,anon,authenticated,service_role;
