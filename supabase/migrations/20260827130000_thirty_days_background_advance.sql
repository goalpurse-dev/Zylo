-- 30 Days Series generations were entirely client-driven: the browser tab
-- polled/sequenced every reference and scene job itself. Closing the tab
-- mid-generation didn't lose any data (everything already persists to these
-- tables), but nothing FURTHER happened until the user reopened the app —
-- no next job got submitted, no settlement, no episode completion.
--
-- This adds the plumbing for a real server-side background worker
-- (thirty-days-generation-advance edge function) that periodically nudges
-- forward any series generation that's gone quiet, independent of whether
-- any browser tab is open. Pattern mirrors the existing abandoned-checkout
-- processor (claim-with-SKIP-LOCKED + a private trigger function reading its
-- own vault secrets) — see 20260823020000_abandoned_checkout_processor_infra.sql.
--
-- Per that same file's established convention: this migration creates the
-- plumbing but does NOT call cron.schedule(...) itself. The schedule is only
-- enabled after a manual invocation is verified to work. See deployment
-- notes for the exact statement to run once verified.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS supabase_vault;
CREATE SCHEMA IF NOT EXISTS private;

ALTER TABLE public.thirty_days_generations
  ADD COLUMN IF NOT EXISTS advancing_until timestamptz;

-- ── Claim (Phase: worker dispatch) ───────────────────────────────────────────
-- Only series generations (setup or episode) that are still reserved, still
-- mid-flight (references/scenes), and haven't been touched — by a client OR
-- a previous advance tick — in the last 90 seconds. That staleness window is
-- what lets an open browser tab keep driving its own generation at full
-- speed without the background worker racing it; the worker only ever picks
-- up what's actually gone quiet. advancing_until is a self-healing claim: a
-- worker that dies mid-tick releases automatically after 3 minutes.
CREATE OR REPLACE FUNCTION public.claim_stale_thirty_days_generations(p_limit int DEFAULT 5)
RETURNS SETOF public.thirty_days_generations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.thirty_days_generations g
  SET advancing_until = now() + interval '3 minutes'
  FROM (
    SELECT id FROM public.thirty_days_generations
    WHERE reservation_status = 'reserved'
      AND generation_mode IN ('series_setup', 'series_episode')
      AND status IN ('references', 'scenes')
      AND updated_at < now() - interval '90 seconds'
      AND (advancing_until IS NULL OR advancing_until < now())
    ORDER BY updated_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  ) due
  WHERE g.id = due.id
  RETURNING g.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_stale_thirty_days_generations(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_stale_thirty_days_generations(int) TO service_role;

-- Always called at the end of a tick (success, partial progress, or error)
-- so the next tick can pick this generation back up instead of waiting out
-- the full 3-minute self-heal window unnecessarily.
CREATE OR REPLACE FUNCTION public.release_thirty_days_advance_claim(p_generation_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.thirty_days_generations SET advancing_until = NULL WHERE id = p_generation_id;
$$;

REVOKE ALL ON FUNCTION public.release_thirty_days_advance_claim(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_thirty_days_advance_claim(uuid) TO service_role;

-- ── Service-role completion RPCs ─────────────────────────────────────────────
-- The user-facing settle_thirty_days_generation / complete_thirty_days_series_*
-- functions all check `user_id = auth.uid()`, which is correct for a browser
-- calling with its own session — but auth.uid() resolves to NULL for a
-- service-role-authenticated call from the background worker, since there's
-- no end-user JWT in that request at all. These are exact behavioral copies
-- with that check replaced by trusting the service_role grant instead
-- (matching claim_due_abandoned_checkouts' own precedent of zero
-- user-identity check for worker-only functions) — never granted to
-- authenticated/anon, so a user can never call these directly.

CREATE OR REPLACE FUNCTION public.service_settle_thirty_days_generation(p_generation_id uuid)
RETURNS public.thirty_days_generations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_generation public.thirty_days_generations;
  v_changed integer := 1;
  v_nonterminal integer;
  v_succeeded integer;
  v_total integer;
  v_refund integer;
  v_refund_delta integer;
BEGIN
  SELECT * INTO v_generation FROM public.thirty_days_generations
  WHERE id = p_generation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'GENERATION_NOT_FOUND'; END IF;
  IF v_generation.reservation_status <> 'reserved' THEN RETURN v_generation; END IF;

  UPDATE public.thirty_days_generation_assets AS asset
  SET status = CASE job.status WHEN 'succeeded' THEN 'succeeded' WHEN 'failed' THEN 'failed'
        WHEN 'canceled' THEN 'canceled' WHEN 'queued' THEN 'queued' ELSE 'running' END,
      result_url = job.result_url, error = job.error
  FROM public.jobs AS job
  WHERE asset.generation_id = p_generation_id AND asset.job_id = job.id
    AND NOT (asset.qa_status = 'failed' AND asset.qa_attempts >= 2);
  WHILE v_changed > 0 LOOP
    UPDATE public.thirty_days_generation_assets AS dependent
    SET status = 'failed', error = 'dependency_failed'
    WHERE dependent.generation_id = p_generation_id
      AND dependent.status IN ('planned', 'queued', 'retrying')
      AND EXISTS (SELECT 1 FROM public.thirty_days_generation_assets AS dependency
        WHERE dependency.generation_id = dependent.generation_id
          AND dependency.asset_key = ANY(dependent.dependency_keys)
          AND dependency.status IN ('failed', 'canceled'));
    GET DIAGNOSTICS v_changed = ROW_COUNT;
  END LOOP;
  SELECT count(*), count(*) FILTER (WHERE status = 'succeeded'),
    count(*) FILTER (WHERE status NOT IN ('succeeded','failed','canceled')),
    COALESCE(sum(cost_credits) FILTER (WHERE status IN ('failed','canceled')), 0)
  INTO v_total, v_succeeded, v_nonterminal, v_refund
  FROM public.thirty_days_generation_assets WHERE generation_id = p_generation_id;
  IF v_total = 0 THEN RAISE EXCEPTION 'GENERATION_ASSETS_MISSING'; END IF;
  IF v_nonterminal > 0 THEN RAISE EXCEPTION 'ASSETS_NOT_TERMINAL'; END IF;

  v_refund_delta := v_refund - v_generation.refunded_credits;
  IF v_refund_delta > 0 THEN
    UPDATE public.profiles SET credit_balance = credit_balance + v_refund_delta,
      credits_spent_today = GREATEST(0, COALESCE(credits_spent_today,0) - v_refund_delta)
    WHERE id = v_generation.user_id;
  END IF;
  INSERT INTO public.thirty_days_credit_ledger (generation_id,user_id,operation,credits)
  VALUES (p_generation_id,v_generation.user_id,'refund',v_refund)
  ON CONFLICT (generation_id,operation) DO UPDATE SET credits = EXCLUDED.credits;
  UPDATE public.thirty_days_generation_assets SET refunded_credits = CASE
    WHEN status IN ('failed','canceled') THEN cost_credits ELSE 0 END
  WHERE generation_id = p_generation_id;
  UPDATE public.thirty_days_generations
  SET refunded_credits = v_refund,
      reservation_status = CASE WHEN v_refund = reserved_credits THEN 'refunded' ELSE 'settled' END,
      status = CASE WHEN v_succeeded = v_total THEN 'voiceover' WHEN v_succeeded = 0 THEN 'failed' ELSE 'partial' END
  WHERE id = p_generation_id RETURNING * INTO v_generation;
  RETURN v_generation;
END;
$$;

REVOKE ALL ON FUNCTION public.service_settle_thirty_days_generation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.service_settle_thirty_days_generation(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.service_complete_thirty_days_series_setup(p_series_id uuid)
RETURNS public.thirty_days_series
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_series public.thirty_days_series;
  v_generation public.thirty_days_generations;
  v_refs jsonb;
BEGIN
  SELECT * INTO v_series FROM public.thirty_days_series WHERE id = p_series_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SERIES_NOT_FOUND'; END IF;
  SELECT * INTO v_generation FROM public.thirty_days_generations
  WHERE id = v_series.setup_generation_id FOR UPDATE;
  IF NOT FOUND OR v_generation.reservation_status = 'reserved' THEN RAISE EXCEPTION 'SETUP_NOT_SETTLED'; END IF;
  v_refs := COALESCE(v_generation.visual_references, '[]'::jsonb);
  IF jsonb_array_length(v_refs) NOT BETWEEN 4 AND 6
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_refs) refs(value)
                WHERE length(COALESCE(value->>'imageUrl', '')) = 0) THEN
    RAISE EXCEPTION 'SETUP_REFERENCES_INCOMPLETE';
  END IF;
  UPDATE public.thirty_days_series
  SET reference_library = v_refs, status = 'ready',
      cover_url = COALESCE(v_refs->0->>'imageUrl', cover_url), last_active_at = now()
  WHERE id = p_series_id RETURNING * INTO v_series;
  RETURN v_series;
END;
$$;

REVOKE ALL ON FUNCTION public.service_complete_thirty_days_series_setup(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.service_complete_thirty_days_series_setup(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.service_complete_thirty_days_series_episode(
  p_episode_id uuid,
  p_episode_summary jsonb,
  p_final_video_url text,
  p_thumbnail_url text
)
RETURNS public.thirty_days_series_episodes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_episode public.thirty_days_series_episodes;
  v_series public.thirty_days_series;
  v_generation public.thirty_days_generations;
BEGIN
  SELECT * INTO v_episode FROM public.thirty_days_series_episodes
  WHERE id = p_episode_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'EPISODE_NOT_FOUND'; END IF;
  SELECT * INTO v_series FROM public.thirty_days_series WHERE id = v_episode.series_id FOR UPDATE;
  SELECT * INTO v_generation FROM public.thirty_days_generations WHERE id = v_episode.generation_id FOR UPDATE;
  IF v_generation.reservation_status = 'reserved' THEN RAISE EXCEPTION 'EPISODE_ASSETS_NOT_SETTLED'; END IF;

  IF v_episode.status = 'completed' THEN
    IF length(trim(COALESCE(p_final_video_url, ''))) > 0 THEN
      UPDATE public.thirty_days_series_episodes
      SET final_video_url = trim(p_final_video_url),
          thumbnail_url = COALESCE(NULLIF(trim(COALESCE(p_thumbnail_url, '')), ''), thumbnail_url),
          narration = COALESCE(v_generation.narration_script, narration),
          narration_take = COALESCE(v_generation.narration_take, narration_take)
      WHERE id = p_episode_id RETURNING * INTO v_episode;
      UPDATE public.thirty_days_series
      SET cover_url = COALESCE(NULLIF(trim(COALESCE(p_thumbnail_url, '')), ''), cover_url), last_active_at = now()
      WHERE id = v_series.id;
    END IF;
    RETURN v_episode;
  END IF;

  IF v_episode.start_day <> v_series.current_day + 1 THEN RAISE EXCEPTION 'EPISODE_OUT_OF_ORDER'; END IF;
  IF jsonb_typeof(COALESCE(p_episode_summary, '{}'::jsonb)) <> 'object' THEN RAISE EXCEPTION 'INVALID_EPISODE_SUMMARY'; END IF;

  UPDATE public.thirty_days_series_episodes
  SET episode_summary = p_episode_summary,
      final_video_url = NULLIF(trim(COALESCE(p_final_video_url, '')), ''),
      thumbnail_url = NULLIF(trim(COALESCE(p_thumbnail_url, '')), ''), status = 'completed', completed_at = now(),
      narration = v_generation.narration_script, narration_take = v_generation.narration_take
  WHERE id = p_episode_id RETURNING * INTO v_episode;

  UPDATE public.thirty_days_series
  SET current_day = v_episode.end_day, current_episode = v_episode.episode_number,
      status = CASE WHEN v_episode.end_day >= total_days THEN 'completed' ELSE 'ready' END,
      current_story_state = p_episode_summary,
      next_episode_tease = COALESCE(NULLIF(v_episode.next_episode_tease, ''), p_episode_summary->>'cliffhanger'),
      reference_library = v_generation.visual_references,
      cover_url = COALESCE(NULLIF(trim(COALESCE(p_thumbnail_url, '')), ''), cover_url),
      last_active_at = now()
  WHERE id = v_series.id;
  RETURN v_episode;
END;
$$;

REVOKE ALL ON FUNCTION public.service_complete_thirty_days_series_episode(uuid, jsonb, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.service_complete_thirty_days_series_episode(uuid, jsonb, text, text) TO service_role;

-- ── Cron trigger (not scheduled yet — see deployment notes) ─────────────────
-- select vault.create_secret('<edge-function-url>', 'thirty_days_advance_url');
-- select vault.create_secret('<shared-secret>',      'thirty_days_advance_secret');
-- The <shared-secret> must match THIRTY_DAYS_ADVANCE_SECRET set on the edge
-- function itself — a static shared secret the function checks in its own
-- code (same pattern as the abandoned-checkout processor), not Supabase JWT
-- verification, since this is a plain HTTP call from Postgres.
CREATE OR REPLACE FUNCTION private.trigger_thirty_days_advance()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public, vault
AS $$
DECLARE
  v_url text;
  v_secret text;
  v_request_id bigint;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets
    WHERE name = 'thirty_days_advance_url' ORDER BY created_at DESC LIMIT 1;
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets
    WHERE name = 'thirty_days_advance_secret' ORDER BY created_at DESC LIMIT 1;

  IF NULLIF(v_url, '') IS NULL OR NULLIF(v_secret, '') IS NULL THEN
    RAISE EXCEPTION 'THIRTY_DAYS_ADVANCE_VAULT_SECRETS_MISSING';
  END IF;

  SELECT net.http_post(
    url     => v_url,
    headers => jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', v_secret
    ),
    body    => '{}'::jsonb
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION private.trigger_thirty_days_advance() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.trigger_thirty_days_advance() TO service_role;

-- NOTE: cron.schedule(...) is intentionally NOT called here.
-- Once the vault secrets above are set and a manual invocation of
-- thirty-days-generation-advance returns 2xx, run:
--   select cron.schedule('thirty-days-advance', '*/1 * * * *', 'select private.trigger_thirty_days_advance();');
