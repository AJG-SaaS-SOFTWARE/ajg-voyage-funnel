-- AJG Voyage: extend lead language support for international Spanish.
-- Apply to the Supabase project used by /api/travel-presentation before deploying the Spanish website.
-- Existing FR/EN rows remain valid.
BEGIN;
ALTER TABLE public.ajg_voyage_leads
  DROP CONSTRAINT ajg_voyage_leads_language_check;
ALTER TABLE public.ajg_voyage_leads
  ADD CONSTRAINT ajg_voyage_leads_language_check
  CHECK (language IN ('fr', 'en', 'es'));
COMMIT;
