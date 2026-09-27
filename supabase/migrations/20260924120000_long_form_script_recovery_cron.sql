-- Script never got the recovery sweeper Research/Visual World/Visual Plan
-- each have (long-form-research-advance, long-form-visual-world-recovery,
-- long-form-visual-plan-recovery — see their own migrations). Its per-stage
-- retry logic (claim_long_form_script_stage(_by_id), atomic claim-time
-- attempt increment, handleStageFailure's capped backoff in
-- advance-long-form-script/index.ts) is already crash-safe and correct on
-- its own — but self-chain dispatch (dispatchNext) only ever fires on the
-- SUCCESS path. When a stage's provider call times out, handleStageFailure
-- persists a future worker_lock_until and returns; nothing ever calls the
-- function again to let that lock actually expire into a retry. With zero
-- cron jobs matching "script"/"long-form" in pg_cron, that retry simply
-- never happened — a real ScriptVersion sat at status=drafting,
-- stage=critic with an expired lock for 30+ minutes while the frontend kept
-- showing an honest-looking "Phase 2 of 3" (see stale-worker incident,
-- research_version parent 49a18b78-.../script version 63c3df8b-...).
-- This migration closes that gap the same way Research's was closed.
do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'long_form_script_advance_url') then
    perform vault.create_secret(
      'https://ilpiwoxubnevmxxikyvx.supabase.co/functions/v1/advance-long-form-script',
      'long_form_script_advance_url'
    );
  end if;

  if not exists (select 1 from vault.decrypted_secrets where name = 'long_form_script_advance_secret') then
    -- Freshly generated here so no plaintext ever needs to appear in this
    -- migration's committed source (same rationale as Research's
    -- 20260915120000) — must be synced to the advance-long-form-script
    -- Edge Function's own LONG_FORM_SCRIPT_ADVANCE_SECRET afterward via the
    -- one-time retrieval RPC below, since a Deno env var can't be read back
    -- from Postgres to confirm a match either way.
    perform vault.create_secret(
      replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
      'long_form_script_advance_secret'
    );
  end if;
end $$;

-- One-time bootstrapping helper, mirroring
-- get_long_form_research_advance_secret_once() exactly: lets the deploying
-- admin client read the freshly generated secret back out (service_role
-- only) so LONG_FORM_SCRIPT_ADVANCE_SECRET can be set to match. Meant to be
-- dropped by a follow-up migration once that sync is confirmed — not a
-- permanent capability.
create or replace function public.get_long_form_script_advance_secret_once()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'long_form_script_advance_secret' order by created_at desc limit 1;
  return v_secret;
end;
$$;

revoke all on function public.get_long_form_script_advance_secret_once() from public;
grant execute on function public.get_long_form_script_advance_secret_once() to service_role;

-- Mirrors private.trigger_long_form_research_advance() exactly: an empty
-- POST body makes advance-long-form-script's handler use
-- claim_long_form_script_stage() (the generic claim, not _by_id) — the same
-- query that already enforces every safety property this sweep needs:
-- status='drafting' only, stage_attempt<3 only (a row that already
-- exhausted its attempts is instead flipped to a real 'failed' terminal
-- state by that same RPC, never touched again), worker_lock_until
-- null-or-expired only (never double-executes an active lease), and
-- resumes at whatever `stage` the row is currently persisted at (draft /
-- critic / revision / finalizing — never re-runs a completed stage, never
-- creates a new version).
create or replace function private.trigger_long_form_script_advance()
returns bigint
language plpgsql
security definer
set search_path = private, public, vault
as $$
declare
  v_url text;
  v_secret text;
  v_request_id bigint;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets
    where name = 'long_form_script_advance_url' order by created_at desc limit 1;
  select decrypted_secret into v_secret from vault.decrypted_secrets
    where name = 'long_form_script_advance_secret' order by created_at desc limit 1;

  if nullif(v_url, '') is null or nullif(v_secret, '') is null then
    raise exception 'LONG_FORM_SCRIPT_ADVANCE_VAULT_SECRETS_MISSING';
  end if;

  select net.http_post(
    url     => v_url,
    headers => jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', v_secret
    ),
    body    => '{}'::jsonb
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function private.trigger_long_form_script_advance() from public;
grant execute on function private.trigger_long_form_script_advance() to service_role;

-- Deployment note (run manually once, after this migration applies):
--   1. select public.get_long_form_script_advance_secret_once();
--   2. supabase secrets set LONG_FORM_SCRIPT_ADVANCE_SECRET=<value from step 1>
--   3. Once a manual `select private.trigger_long_form_script_advance();`
--      returns a request_id and cron.job_run_details shows a successful
--      (200) row, drop get_long_form_script_advance_secret_once() in a
--      follow-up migration, matching Research's own cleanup migration.
--
-- Enabled immediately (not deferred) — same 1-minute cadence as Research's
-- sweep: frequent enough that a stalled Script never waits more than ~60s
-- on top of self-chain dispatch's own immediate attempt, without hammering
-- the function. Until the secret above is synced, every tick is a safe,
-- silent no-op (the vault secret exists but won't match the Edge
-- Function's env var yet, so advance-long-form-script's own 401 check
-- rejects it — no row is ever claimed or mutated by a mismatched call).
select cron.schedule('long-form-script-advance', '*/1 * * * *', 'select private.trigger_long_form_script_advance();');
