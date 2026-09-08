-- Removes the one-time secret-retrieval helper from 20260915120000 now that
-- the Edge Function's LONG_FORM_RESEARCH_ADVANCE_SECRET has been synced to
-- match the vault-generated value it created — this was a bootstrapping
-- tool, not a capability meant to stick around.
drop function if exists public.get_long_form_research_advance_secret_once();
