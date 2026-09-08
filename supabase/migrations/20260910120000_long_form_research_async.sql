-- Turns Research from one long synchronous edge-function request into a
-- durable async stage machine. The trigger for this: a real production run
-- was confirmed (twice, identically) to hit Supabase's Edge Function
-- "Request idle timeout" — a flat 150s limit on EVERY plan tier that kills a
-- request if it sends no response bytes in time, wholly separate from the
-- (also real, 150s free / 400s paid) wall-clock execution limit. A pipeline
-- of planner + up to 6 concurrent searches (measured 36-78s each under real
-- load) + extractor + critic + optional gap round + final extractor cannot
-- fit inside that window for a normal topic, and no client-side timeout
-- tuning can fix a gateway-level limit.
--
-- long_form_research_versions becomes the durable workflow state itself
-- (per-task guidance: don't force this into the unrelated `jobs` table just
-- because a queue pattern exists elsewhere — this row already IS the
-- natural parent state record). STATUS (researching/ready/needs_attention/
-- failed) and STAGE (planning/initial_search/.../finalizing) are kept as
-- deliberately separate concepts — status is the coarse, user-facing
-- lifecycle; stage is the fine-grained internal position a worker resumes
-- from.
alter table public.long_form_research_versions
  add column if not exists stage text not null default 'planning',
  add column if not exists stage_attempt integer not null default 0,
  add column if not exists stage_started_at timestamptz,
  add column if not exists worker_lock_until timestamptz,
  add column if not exists last_error_code text,
  add column if not exists last_error_at timestamptz,
  -- Not-yet-finalized artifacts a later stage needs to resume from without
  -- re-running earlier (paid) stages: retrieval findings, candidate source
  -- metadata, the pre-critic fact/source draft, and gap-round findings.
  -- research_plan/fact_graph/coverage/meta remain their own columns since
  -- those are the genuinely durable, inspectable outputs each stage
  -- produces — this jsonb is scratch space for stage-to-stage handoff only.
  add column if not exists intermediate jsonb;

-- Claim: SKIP LOCKED so two worker invocations (a self-chained dispatch and
-- a cron safety-net tick landing at the same moment) never execute the same
-- stage twice. worker_lock_until is a self-healing lease — a worker that
-- dies mid-stage releases automatically once the lease expires, so research
-- can never be permanently bricked by a crashed invocation. Unlike
-- thirty-days' equivalent claim function, there is no "quiet for 90s"
-- staleness gate — Research has no client-driven alternative path to avoid
-- racing, since every stage now only ever runs inside this worker.
create or replace function public.claim_long_form_research_stage(p_limit int default 1)
returns setof public.long_form_research_versions
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.long_form_research_versions v
  set worker_lock_until = now() + interval '3 minutes',
      stage_started_at = now()
  from (
    select id from public.long_form_research_versions
    where status = 'researching'
      and stage_attempt < 3
      and (worker_lock_until is null or worker_lock_until < now())
    order by stage_started_at nulls first
    limit p_limit
    for update skip locked
  ) due
  where v.id = due.id
  returning v.*;
end;
$$;

revoke all on function public.claim_long_form_research_stage(int) from public;
grant execute on function public.claim_long_form_research_stage(int) to service_role;

-- Claims ONE specific research version's current stage (used by the fast,
-- self-chained dispatch path right after the previous stage finished) —
-- same lease semantics, just scoped to an id the caller already knows
-- instead of scanning for whatever's due.
create or replace function public.claim_long_form_research_stage_by_id(p_id uuid)
returns setof public.long_form_research_versions
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.long_form_research_versions v
  set worker_lock_until = now() + interval '3 minutes',
      stage_started_at = now()
  where v.id = p_id
    and v.status = 'researching'
    and v.stage_attempt < 3
    and (v.worker_lock_until is null or v.worker_lock_until < now())
  returning v.*;
end;
$$;

revoke all on function public.claim_long_form_research_stage_by_id(uuid) from public;
grant execute on function public.claim_long_form_research_stage_by_id(uuid) to service_role;

-- ── Cron safety net (mirrors thirty-days-generation-advance's proven
-- pattern in 20260827130000_thirty_days_background_advance.sql) ───────────
-- Primary progression is the self-chained dispatch after each stage; this
-- cron sweep exists purely so a run whose self-chain call failed to fire
-- (or whose worker crashed before dispatching the next one) still finishes
-- instead of sitting stuck until a user happens to reload the page.
create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;
create schema if not exists private;

-- NOTE: cron.schedule(...) is intentionally NOT called here, matching the
-- established convention — enabled only after a manual invocation of
-- advance-long-form-research is verified to succeed. See deployment notes.
create or replace function private.trigger_long_form_research_advance()
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
    where name = 'long_form_research_advance_url' order by created_at desc limit 1;
  select decrypted_secret into v_secret from vault.decrypted_secrets
    where name = 'long_form_research_advance_secret' order by created_at desc limit 1;

  if nullif(v_url, '') is null or nullif(v_secret, '') is null then
    raise exception 'LONG_FORM_RESEARCH_ADVANCE_VAULT_SECRETS_MISSING';
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

revoke all on function private.trigger_long_form_research_advance() from public;
grant execute on function private.trigger_long_form_research_advance() to service_role;

-- Deployment notes (run manually once, in order):
--   select vault.create_secret('<advance-function-url>', 'long_form_research_advance_url');
--   select vault.create_secret('<shared-secret>',         'long_form_research_advance_secret');
-- <shared-secret> must match LONG_FORM_RESEARCH_ADVANCE_SECRET set on the
-- advance-long-form-research function itself. Once a manual invocation
-- returns 2xx:
--   select cron.schedule('long-form-research-advance', '*/1 * * * *', 'select private.trigger_long_form_research_advance();');
