-- Second security lockdown (owner's go, 2026-11-02), after 20261128100000_profiles_lockdown.
--   1. Row security on the 8 tables that had none, where anyone with the public key could read, change and delete.
--   2. Credit and billing columns on jobs, two_am_generations and cooking_matic_generations: the server's only.
--   3. contact_messages: anyone can still send one; only the server can read them.
--   4. Every function no browser calls becomes server only (service role). They never checked the caller.
-- Edge functions on the service role and SECURITY DEFINER functions run as their owner: neither is affected.
-- No user data changes here.
-- Rollback: supabase/rollbacks/20261129100000_second_lockdown_rollback.sql

BEGIN;
SET LOCAL lock_timeout = '10s';

-- ---------- 1. the 8 tables ----------
-- A signed-in user's own rows.
ALTER TABLE public.creations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own creations" ON public.creations;
CREATE POLICY "Users can read own creations" ON public.creations FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own creations" ON public.creations;
CREATE POLICY "Users can insert own creations" ON public.creations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own creations" ON public.creations;
CREATE POLICY "Users can update own creations" ON public.creations FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own creations" ON public.creations;
CREATE POLICY "Users can delete own creations" ON public.creations FOR DELETE TO authenticated USING (auth.uid() = user_id);
ALTER TABLE public.user_onboarding ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own onboarding" ON public.user_onboarding;
CREATE POLICY "Users can read own onboarding" ON public.user_onboarding FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own onboarding" ON public.user_onboarding;
CREATE POLICY "Users can insert own onboarding" ON public.user_onboarding FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own onboarding" ON public.user_onboarding;
CREATE POLICY "Users can update own onboarding" ON public.user_onboarding FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
ALTER TABLE public.generation_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own generation feedback" ON public.generation_feedback;
CREATE POLICY "Users can read own generation feedback" ON public.generation_feedback FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own generation feedback" ON public.generation_feedback;
CREATE POLICY "Users can insert own generation feedback" ON public.generation_feedback FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own generation feedback" ON public.generation_feedback;
CREATE POLICY "Users can update own generation feedback" ON public.generation_feedback FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
ALTER TABLE public.brand_avatars ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read their brand avatars" ON public.brand_avatars;
CREATE POLICY "Users can read their brand avatars" ON public.brand_avatars FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.brands WHERE brands.id = brand_avatars.brand_id AND brands.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can insert their brand avatars" ON public.brand_avatars;
CREATE POLICY "Users can insert their brand avatars" ON public.brand_avatars FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.brands WHERE brands.id = brand_avatars.brand_id AND brands.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can update their brand avatars" ON public.brand_avatars;
CREATE POLICY "Users can update their brand avatars" ON public.brand_avatars FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.brands WHERE brands.id = brand_avatars.brand_id AND brands.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.brands WHERE brands.id = brand_avatars.brand_id AND brands.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can delete their brand avatars" ON public.brand_avatars;
CREATE POLICY "Users can delete their brand avatars" ON public.brand_avatars FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.brands WHERE brands.id = brand_avatars.brand_id AND brands.user_id = auth.uid()));
-- image_generations already has its two policies (insert own, read own).
ALTER TABLE public.image_generations ENABLE ROW LEVEL SECURITY;
-- Server only: no page uses these.
ALTER TABLE public.credit_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.image_likes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.credit_grants, public.feedback, public.image_likes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.creations, public.user_onboarding, public.generation_feedback, public.brand_avatars, public.image_generations FROM PUBLIC, anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.creations, public.user_onboarding, public.generation_feedback, public.brand_avatars, public.image_generations FROM authenticated;

-- ---------- 2. credit columns ----------
-- jobs: the browser writes only these on its own rows (src/lib/jobs.ts).
REVOKE UPDATE ON public.jobs FROM anon, authenticated;
GRANT UPDATE (status, result_url, prompt, updated_at) ON public.jobs TO authenticated;
REVOKE ALL ON public.jobs FROM anon;
-- (guard_client_job_writes, 20261007110000, already refuses browser writes to every other jobs column.)

-- two_am_generations: refunds are worked out from reserved_credits, so the browser writes only its scenes and status.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.two_am_generations FROM anon, authenticated;
GRANT UPDATE (scenes, status, updated_at) ON public.two_am_generations TO authenticated;

-- cooking_matic_generations: everything but the credit column; rows are created by begin_cooking_matic_generation.
REVOKE INSERT, UPDATE, TRUNCATE, REFERENCES, TRIGGER ON public.cooking_matic_generations FROM anon, authenticated;
DO $$
DECLARE v_cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ') INTO v_cols FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'cooking_matic_generations'
     AND column_name NOT IN ('id', 'user_id', 'service_credits_charged', 'created_at');
  EXECUTE format('GRANT UPDATE (%s) ON public.cooking_matic_generations TO authenticated', v_cols);
END $$;

-- user_balances: an old balance only the navbar reads. No one but the server changes it.
DROP POLICY IF EXISTS balances_update_self ON public.user_balances;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.user_balances FROM anon, authenticated;

-- ---------- 3. contact_messages ----------
DROP POLICY IF EXISTS contact_select_auth ON public.contact_messages;
REVOKE SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.contact_messages FROM PUBLIC, anon, authenticated;

-- the two product image views ran as their owner, so they showed everyone's images: now the caller's own rows only
ALTER VIEW public.v_product_images_recent SET (security_invoker = true);
ALTER VIEW public.v_product_images_counts SET (security_invoker = true);
REVOKE ALL ON public.v_product_images_recent, public.v_product_images_counts FROM anon;

-- The admin feedback page reads totals across all users: with row security on, that needs the owner's rights. It
-- returns only vote counts per tool.
ALTER FUNCTION public.generation_feedback_stats() SECURITY DEFINER SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.generation_feedback_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generation_feedback_stats() TO authenticated, service_role;

-- ---------- 4. server-only functions ----------
REVOKE EXECUTE ON FUNCTION public.app_charge_job_profiles(p_user_id uuid, p_job_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_charge_job_profiles(p_user_id uuid, p_job_id uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.approve_long_form_reference_asset_manually(p_asset_id uuid, p_user_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_long_form_reference_asset_manually(p_asset_id uuid, p_user_id uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.approve_long_form_scene_manually(p_scene_id uuid, p_user_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_long_form_scene_manually(p_scene_id uuid, p_user_id uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.attach_abandoned_checkout_session(p_checkout_id uuid, p_stripe_session_id text, p_checkout_url text, p_expires_at timestamp with time zone, p_session_type text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.attach_abandoned_checkout_session(p_checkout_id uuid, p_stripe_session_id text, p_checkout_url text, p_expires_at timestamp with time zone, p_session_type text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.begin_thirty_days_series_draft(p_user_id uuid, p_universe text, p_premise text, p_visual_style text, p_quality_tier text, p_days_per_episode integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_thirty_days_series_draft(p_user_id uuid, p_universe text, p_premise text, p_visual_style text, p_quality_tier text, p_days_per_episode integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.claim_due_abandoned_checkouts(p_limit integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_abandoned_checkouts(p_limit integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.claim_generation_queue_jobs(worker_id text, max_jobs integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_generation_queue_jobs(worker_id text, max_jobs integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.claim_long_form_research_stage(p_limit integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_long_form_research_stage(p_limit integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.claim_long_form_research_stage_by_id(p_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_long_form_research_stage_by_id(p_id uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.claim_long_form_script_stage(p_limit integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_long_form_script_stage(p_limit integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.claim_long_form_script_stage_by_id(p_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_long_form_script_stage_by_id(p_id uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.claim_stale_thirty_days_generations(p_limit integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_stale_thirty_days_generations(p_limit integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.continue_long_form_episode_generation(p_project_id uuid, p_user_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.continue_long_form_episode_generation(p_project_id uuid, p_user_id uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.create_abandoned_checkout_attempt(p_user_id uuid, p_email text, p_stripe_customer_id text, p_stripe_session_id text, p_checkout_url text, p_purchase_type text, p_plan_code text, p_pack text, p_billing_interval text, p_price_id text, p_amount integer, p_currency text, p_expires_at timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_abandoned_checkout_attempt(p_user_id uuid, p_email text, p_stripe_customer_id text, p_stripe_session_id text, p_checkout_url text, p_purchase_type text, p_plan_code text, p_pack text, p_billing_interval text, p_price_id text, p_amount integer, p_currency text, p_expires_at timestamp with time zone) TO service_role;
REVOKE EXECUTE ON FUNCTION public.create_long_form_generation_profile(p_project_id uuid, p_user_id uuid, p_settings jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_long_form_generation_profile(p_project_id uuid, p_user_id uuid, p_settings jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION public.current_long_form_reference_assets(p_visual_world_version_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_long_form_reference_assets(p_visual_world_version_id uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.current_scene_for_render_plan(p_scene_render_plan_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_scene_for_render_plan(p_scene_render_plan_id uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.debit_credits(uid uuid, amt integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.debit_credits(uid uuid, amt integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.edit_long_form_scene(p_scene_id uuid, p_user_id uuid, p_instruction text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.edit_long_form_scene(p_scene_id uuid, p_user_id uuid, p_instruction text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.enqueue_long_form_scene_job(p_scene_id uuid, p_job jsonb, p_claim_attempt integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_long_form_scene_job(p_scene_id uuid, p_job jsonb, p_claim_attempt integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.ensure_missing_reference_asset_rows(p_visual_world_version_id uuid, p_candidates jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_missing_reference_asset_rows(p_visual_world_version_id uuid, p_candidates jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION public.finalize_two_am_generation_from_jobs(p_generation_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_two_am_generation_from_jobs(p_generation_id uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.find_abandoned_checkout_by_stripe_session(p_stripe_session_id text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_abandoned_checkout_by_stripe_session(p_stripe_session_id text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.freeze_long_form_production_bible(p_project_id uuid, p_user_id uuid, p_generation_profile_id uuid, p_script_version_id uuid, p_recipe_id text, p_recipe_version text, p_bible jsonb, p_llm_calls integer, p_repair_calls integer, p_input_tokens integer, p_output_tokens integer, p_estimated_model_cost_usd numeric, p_warnings jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.freeze_long_form_production_bible(p_project_id uuid, p_user_id uuid, p_generation_profile_id uuid, p_script_version_id uuid, p_recipe_id text, p_recipe_version text, p_bible jsonb, p_llm_calls integer, p_repair_calls integer, p_input_tokens integer, p_output_tokens integer, p_estimated_model_cost_usd numeric, p_warnings jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION public.increment_credit_balance(p_user_id uuid, p_delta integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_credit_balance(p_user_id uuid, p_delta integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.list_expired_generation_references(p_retention interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_expired_generation_references(p_retention interval) TO service_role;
REVOKE EXECUTE ON FUNCTION public.long_form_project_cost_summary(p_project_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.long_form_project_cost_summary(p_project_id uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.long_form_visual_world_compatibility(p_project_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.long_form_visual_world_compatibility(p_project_id uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.pause_long_form_episode_generation(p_project_id uuid, p_user_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pause_long_form_episode_generation(p_project_id uuid, p_user_id uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.prune_system_logs(p_older_than interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_system_logs(p_older_than interval) TO service_role;
REVOKE EXECUTE ON FUNCTION public.reconcile_visual_world_completion_status(p_visual_world_version_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_visual_world_completion_status(p_visual_world_version_id uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.record_scene_qa_result(p_scene_id uuid, p_approved boolean, p_qa_result jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_scene_qa_result(p_scene_id uuid, p_approved boolean, p_qa_result jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION public.refund_credits(uid uuid, amt integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_credits(uid uuid, amt integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.release_abandoned_checkout_claim(p_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_abandoned_checkout_claim(p_id uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.release_cooking_service_request(p_generation_id uuid, p_kind text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_cooking_service_request(p_generation_id uuid, p_kind text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.release_cooking_voice_generation(p_generation_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_cooking_voice_generation(p_generation_id uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.release_thirty_days_advance_claim(p_generation_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_thirty_days_advance_claim(p_generation_id uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.requeue_generation_queue_job(p_id uuid, p_attempts integer, p_retry_after timestamp with time zone, p_error jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.requeue_generation_queue_job(p_id uuid, p_attempts integer, p_retry_after timestamp with time zone, p_error jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION public.resolve_canonical_reference(p_visual_world_version_id uuid, p_entity_id text, p_angle text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_canonical_reference(p_visual_world_version_id uuid, p_entity_id text, p_angle text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.retry_long_form_scene(p_scene_id uuid, p_user_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.retry_long_form_scene(p_scene_id uuid, p_user_id uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.service_commit_thirty_days_series_episode(p_episode_id uuid, p_verified_episode jsonb, p_state_delta jsonb, p_thumbnail_url text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_commit_thirty_days_series_episode(p_episode_id uuid, p_verified_episode jsonb, p_state_delta jsonb, p_thumbnail_url text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.service_complete_thirty_days_series_episode(p_episode_id uuid, p_episode_summary jsonb, p_final_video_url text, p_thumbnail_url text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_complete_thirty_days_series_episode(p_episode_id uuid, p_episode_summary jsonb, p_final_video_url text, p_thumbnail_url text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.service_complete_thirty_days_series_setup(p_series_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_complete_thirty_days_series_setup(p_series_id uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.service_settle_thirty_days_generation(p_generation_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_settle_thirty_days_generation(p_generation_id uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.service_update_thirty_days_series_planning(p_series_id uuid, p_stage text, p_payload_patch jsonb, p_error text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_update_thirty_days_series_planning(p_series_id uuid, p_stage text, p_payload_patch jsonb, p_error text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.trim_old_image_jobs(p_user_id uuid, p_limit integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trim_old_image_jobs(p_user_id uuid, p_limit integer) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
