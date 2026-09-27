-- Removes the one-time secret-retrieval helper from 20260924120000 now that
-- the Edge Function's LONG_FORM_SCRIPT_ADVANCE_SECRET has been synced to
-- match the vault-generated value it created, and a manual
-- `select private.trigger_long_form_script_advance();` returned a 200 from
-- advance-long-form-script (confirmed via net._http_response) — this was a
-- bootstrapping tool, not a capability meant to stick around. Mirrors
-- Research's own 20260915120500 cleanup exactly.
drop function if exists public.get_long_form_script_advance_secret_once();
