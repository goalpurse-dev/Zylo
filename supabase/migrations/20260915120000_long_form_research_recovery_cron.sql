-- Enables the Research recovery sweeper that 20260910120000 built but left
-- disabled (vault secrets required direct SQL access unavailable at the
-- time). Real-world trigger for enabling it now: a genuine user Research
-- Version sat at stage='planning', never claimed even once, because the
-- self-chain dispatch's FIRST call happened to land while
-- LONG_FORM_RESEARCH_PAUSED was true — nothing was broken, but with no
-- safety net a stalled self-chain (a crashed process, a dropped fetch, any
-- transient failure) would leave a real user's project stuck indefinitely.
--
-- This sweep is deliberately NOT the primary progression path — self-chain
-- dispatch still fires immediately after every successful stage, same as
-- before. This only picks up whatever the self-chain path failed to
-- advance: private.trigger_long_form_research_advance() calls
-- advance-long-form-research with an EMPTY body, which makes the handler
-- use claim_long_form_research_stage() (the generic claim, not
-- claim_..._by_id) — the exact same query that already enforces every
-- safety property requested: status='researching' only (never touches
-- ready/failed), stage_attempt<3 only (never touches already-exhausted
-- rows), worker_lock_until null-or-expired only (never double-executes an
-- active lease), and resumes at whatever `stage` column the row is
-- currently persisted at (never reruns a completed stage, never creates a
-- new version — claim only ever UPDATEs an existing row). Every one of
-- these properties already existed in 20260910120000; this migration only
-- turns the switch on.
--
-- The secret vault.create_secret needs is generated HERE, server-side,
-- specifically so no plaintext secret value ever needs to appear in this
-- migration file's committed source — see the one-time retrieval function
-- below, called once after this migration to sync the Edge Function's own
-- LONG_FORM_RESEARCH_ADVANCE_SECRET to match, then dropped.
do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'long_form_research_advance_url') then
    perform vault.create_secret(
      'https://ilpiwoxubnevmxxikyvx.supabase.co/functions/v1/advance-long-form-research',
      'long_form_research_advance_url'
    );
  end if;

  if not exists (select 1 from vault.decrypted_secrets where name = 'long_form_research_advance_secret') then
    -- gen_random_uuid() is built into core Postgres (no pgcrypto dependency,
    -- which this managed instance doesn't expose gen_random_bytes for) —
    -- two concatenated random UUIDs (mixed with a third for good measure)
    -- give plenty of entropy for an internal shared secret.
    perform vault.create_secret(
      replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
      'long_form_research_advance_secret'
    );
  end if;
end $$;

-- One-time bootstrapping helper: lets the deploying admin client read the
-- freshly generated secret back out (service_role only) so the Edge
-- Function's own env secret can be set to match. Dropped by the very next
-- migration once that sync has happened — this is not meant to be a
-- permanent capability.
create or replace function public.get_long_form_research_advance_secret_once()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'long_form_research_advance_secret' order by created_at desc limit 1;
  return v_secret;
end;
$$;

revoke all on function public.get_long_form_research_advance_secret_once() from public;
grant execute on function public.get_long_form_research_advance_secret_once() to service_role;

-- Conservative cadence — recovery, not primary orchestration. Every 1
-- minute is frequent enough that a stalled project never waits more than
-- ~60s for the sweep (on top of self-chain dispatch already trying
-- immediately), without hammering the function.
select cron.schedule('long-form-research-advance', '*/1 * * * *', 'select private.trigger_long_form_research_advance();');
