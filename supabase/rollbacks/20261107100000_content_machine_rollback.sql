-- Removes the Content Machine's database objects (20261107100000_content_machine.sql) and nothing else.
-- DESTRUCTIVE for its own data: ideas, the spend ledger and the audit log are gone afterwards.
-- The private content-machine bucket is left in place (Supabase refuses to drop a bucket that still has
-- files); empty it in the dashboard first if it should go too.
BEGIN;
DROP FUNCTION IF EXISTS public.cm_settle_spend(uuid, numeric, text, text, text);
DROP FUNCTION IF EXISTS public.cm_reserve_spend(text, text, numeric, text, uuid, uuid, boolean);
DROP TABLE IF EXISTS public.cm_jobs, public.cm_audit_log, public.cm_cost_estimates, public.cm_spend_ledger,
  public.cm_posts, public.cm_packages, public.cm_generations, public.cm_ideas, public.cm_scout_reports,
  public.cm_runs, public.cm_settings;
COMMIT;
