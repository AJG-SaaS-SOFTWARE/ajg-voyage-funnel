-- Preserve incurred spend when a customer deletes a site or closes an account.
-- Deletion must not reset AJG's global budget or the owner's other-site budget.
alter table public.ai_cost_reservations
  drop constraint ai_cost_reservations_site_id_fkey,
  drop constraint ai_cost_reservations_user_id_fkey,
  alter column site_id drop not null,
  alter column user_id drop not null,
  add constraint ai_cost_reservations_site_id_fkey foreign key(site_id) references public.sites(id) on delete set null,
  add constraint ai_cost_reservations_user_id_fkey foreign key(user_id) references auth.users(id) on delete set null;

alter table public.ai_request_admissions
  drop constraint ai_request_admissions_site_id_fkey,
  alter column site_id drop not null,
  add constraint ai_request_admissions_site_id_fkey foreign key(site_id) references public.sites(id) on delete set null;
