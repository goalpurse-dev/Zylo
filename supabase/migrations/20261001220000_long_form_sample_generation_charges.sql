-- 2026-09-23 "systemic production stabilization" pass, Item E — the real
-- dispatch half of "Generate Test Sample." generate-long-form-scene-sample/
-- index.ts already ships the QUOTE half (selects up to 3 representative
-- beats, estimates their credits, charges nothing) — this migration adds the
-- missing charge+authorize step for EXACTLY those beats, without disturbing
-- the existing chapter/episode billing this table already carries.
--
-- Design constraint this migration exists to satisfy: long_form_episode_
-- generation_charges(project_id) has a partial UNIQUE index WHERE
-- status='charged' — a project can have at most one ACTIVE charge. A sample
-- charge reuses this SAME table (never a parallel wallet) but MUST NOT ever
-- supersede a real, in-progress chapter/episode generation the way a second
-- real charge legitimately supersedes a first (charge_long_form_episode_
-- generation's own existing 'stale' handling) — canceling real paid
-- generation just because the user clicked "Generate Test Sample" would be a
-- severe, silent, unacceptable regression. charge_long_form_sample_
-- generation below refuses outright (GENERATION_ALREADY_ACTIVE) instead of
-- ever touching an existing 'charged' row. It also never writes
-- project.active_generation_charge_id/current_scene_generation_status —
-- those remain the exclusive signal for "has the user actually pressed the
-- paid Generate Chapter/Episode action" (sceneCardModel.js's
-- isEpisodeGenerationCommitted), which a sample must never be mistaken for.

alter table public.long_form_episode_generation_charges
  add column if not exists sample_beat_ids jsonb null;
comment on column public.long_form_episode_generation_charges.sample_beat_ids is
  'Non-null only for a "Generate Test Sample" charge: the exact small beat-id set this charge authorizes, never the whole chapter/episode. Null for every normal chapter/episode charge (unchanged meaning).';

-- 'refunded' already means "an actual credit reversal happened" elsewhere in
-- this codebase — reusing it for "a sample finished and its slot is
-- released" would misleadingly suggest the user got their spent credits
-- back, which they did not (a sample is a real, deliberately small paid
-- action). A distinct, honest status value instead.
--
-- 2026-09-23 real incident caught applying this migration directly: the
-- first version of this constraint only listed ('charged','refunded'),
-- copied from this table's ORIGINAL migration — but a later migration
-- (20260930310000_long_form_episode_rebuild.sql) already extended the live
-- constraint to also allow 'superseded' (real rows exist with that status —
-- Atlantis's own charge history has one), so re-deriving the constraint
-- from the wrong source failed outright (23514) against live data instead
-- of silently corrupting anything. Carries 'superseded' forward explicitly.
alter table public.long_form_episode_generation_charges drop constraint if exists long_form_episode_generation_charges_status_check;
alter table public.long_form_episode_generation_charges add constraint long_form_episode_generation_charges_status_check
  check (status in ('charged', 'refunded', 'superseded', 'sample_completed'));

-- Server-authoritative credit total for an ARBITRARY beat-id subset (never
-- the whole plan) — the sample-charge mirror of estimate_long_form_episode_
-- credits, reusing the exact same categorize_long_form_render_method +
-- per-tier credit functions so a sample beat is never priced differently
-- than the identical beat would be under a real chapter/episode charge.
create or replace function public.estimate_long_form_sample_credits(p_project_id uuid, p_tier text, p_beat_ids jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare proj public.long_form_projects; counts jsonb; total integer;
begin
  select * into proj from public.long_form_projects where id = p_project_id;
  if not found then raise exception 'PROJECT_NOT_FOUND'; end if;
  if p_tier not in ('v2','v3','v4') then raise exception 'INVALID_TIER'; end if;

  with beats as (
    select b from public.long_form_visual_plan_versions p, jsonb_array_elements(p.visual_plan->'visualBeats') b
    where p.id = proj.current_visual_plan_version_id and b->>'id' in (select jsonb_array_elements_text(p_beat_ids))
  ), categorized as (
    select b->>'id' beat_id, public.categorize_long_form_render_method(b->>'renderMethod') category from beats
  )
  select jsonb_build_object(
    'freshGenerations', count(*) filter (where category='freshGenerations'),
    'edits', count(*) filter (where category='edits'),
    'reused', count(*) filter (where category='reused'),
    'crops', count(*) filter (where category='crops'),
    'graphics', count(*) filter (where category='graphics'),
    'matchedBeatCount', count(*))
  into counts from categorized;

  if coalesce((counts->>'matchedBeatCount')::integer, 0) <> jsonb_array_length(p_beat_ids) then
    raise exception 'SAMPLE_BEAT_IDS_NOT_IN_CURRENT_PLAN';
  end if;

  total := coalesce((counts->>'freshGenerations')::integer, 0) * public.long_form_tier_generate_credits(p_tier)
    + coalesce((counts->>'edits')::integer, 0) * public.long_form_tier_edit_credits(p_tier);
  return jsonb_build_object('totalCredits', total, 'breakdown', counts, 'tier', p_tier, 'beatIds', p_beat_ids);
end $$;
revoke all on function public.estimate_long_form_sample_credits(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.estimate_long_form_sample_credits(uuid, text, jsonb) to service_role;

-- Charges EXACTLY p_beat_ids (never the whole chapter/episode). Idempotent
-- per (project, plan, exact beat set): a double-click/reload with the SAME
-- selected sample re-returns the same charge, never re-debits; a DIFFERENT
-- beat selection (e.g. the plan changed) gets its own fresh charge.
create or replace function public.charge_long_form_sample_generation(p_project_id uuid, p_user_id uuid, p_tier text, p_beat_ids jsonb, p_expected_credits int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  proj public.long_form_projects; plan public.long_form_visual_plan_versions; world public.long_form_visual_world_versions;
  existing_active public.long_form_episode_generation_charges; quote jsonb; total integer; balance integer;
  idem_key text; new_id uuid; compat jsonb;
begin
  select * into proj from public.long_form_projects where id = p_project_id for update;
  if not found then raise exception 'PROJECT_NOT_FOUND'; end if;
  if proj.user_id is distinct from p_user_id then raise exception 'FORBIDDEN'; end if;
  if p_tier not in ('v2','v3','v4') then raise exception 'INVALID_TIER'; end if;
  if jsonb_array_length(p_beat_ids) = 0 then raise exception 'NO_BEATS_SELECTED'; end if;

  -- The one hard safety rule this migration exists to enforce: never
  -- displace a real, currently-active chapter/episode charge. A sample
  -- charge can only be created when the project's charge slot is free.
  select * into existing_active from public.long_form_episode_generation_charges where project_id = p_project_id and status = 'charged';
  if found then raise exception 'GENERATION_ALREADY_ACTIVE'; end if;

  compat := public.long_form_visual_world_compatibility(p_project_id);
  if not coalesce((compat->>'compatible')::boolean, false) then raise exception 'VISUAL_WORLD_NOT_READY:%', coalesce(compat->>'reason','not_ready'); end if;
  select * into world from public.long_form_visual_world_versions where id = (compat->>'visualWorldVersionId')::uuid;
  select * into plan from public.long_form_visual_plan_versions where id = proj.current_visual_plan_version_id;

  quote := public.estimate_long_form_sample_credits(p_project_id, p_tier, p_beat_ids);
  total := (quote->>'totalCredits')::integer;
  if total <> p_expected_credits then raise exception 'SAMPLE_PRICE_MISMATCH: server computed % credits, caller expected %', total, p_expected_credits; end if;

  idem_key := p_project_id::text || ':sample_generation:' || plan.id::text || ':' || md5((select string_agg(v, ',' order by v) from jsonb_array_elements_text(p_beat_ids) v));
  select * into existing_active from public.long_form_episode_generation_charges where idempotency_key = idem_key;
  if found then
    return jsonb_build_object('charged', true, 'alreadyCharged', true, 'creditsCharged', 0, 'tier', existing_active.tier, 'generationRunId', existing_active.id, 'beatIds', existing_active.sample_beat_ids);
  end if;

  if total > 0 then
    select credit_balance into balance from public.profiles where id = p_user_id for update;
    if balance is null or balance < total then raise exception 'INSUFFICIENT_CREDITS'; end if;
    update public.profiles set credit_balance = credit_balance - total, credits_spent_today = coalesce(credits_spent_today, 0) + total where id = p_user_id;
  end if;

  -- Deliberately does NOT touch long_form_projects.active_generation_charge_id
  -- or current_scene_generation_status — a sample must never register as
  -- "the user started chapter/episode generation" to any other reader of
  -- those columns.
  insert into public.long_form_episode_generation_charges
    (project_id, visual_world_version_id, visual_plan_version_id, user_id, tier, credits_charged, cost_breakdown, idempotency_key, chapter_gate_enabled, sample_beat_ids)
    values (p_project_id, world.id, plan.id, p_user_id, p_tier, total, quote, idem_key, false, p_beat_ids)
    returning id into new_id;

  return jsonb_build_object('charged', true, 'alreadyCharged', false, 'creditsCharged', total, 'breakdown', quote->'breakdown', 'tier', p_tier, 'generationRunId', new_id, 'beatIds', p_beat_ids);
end $$;
revoke all on function public.charge_long_form_sample_generation(uuid, uuid, text, jsonb, int) from public, anon, authenticated;
grant execute on function public.charge_long_form_sample_generation(uuid, uuid, text, jsonb, int) to service_role;

-- Releases a completed sample's charge slot the moment every one of its
-- beats has reached a terminal scene state (succeeded-with-QA-recorded or
-- failed) — called opportunistically from advance-long-form-scene-
-- generation right after it records any scene's QA result, never a
-- separate cron (a sample is exactly 3 scenes; the natural per-scene tick
-- already covers it within moments of the last one finishing). Never
-- touches a normal chapter/episode charge (sample_beat_ids is null there).
create or replace function public.close_long_form_sample_generation_if_done(p_generation_run_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare run public.long_form_episode_generation_charges; total_beats integer; terminal_beats integer;
begin
  select * into run from public.long_form_episode_generation_charges where id = p_generation_run_id and status = 'charged' and sample_beat_ids is not null;
  if not found then return false; end if;

  total_beats := jsonb_array_length(run.sample_beat_ids);
  select count(*) into terminal_beats
  from public.long_form_scene_render_plans rp
  join public.long_form_scenes s on s.scene_render_plan_id = rp.id
  where rp.visual_beat_id in (select jsonb_array_elements_text(run.sample_beat_ids))
    and s.generation_run_id = p_generation_run_id
    and not exists (select 1 from public.long_form_scenes n where n.replaces_scene_id = s.id)
    and (s.status = 'failed' or (s.status = 'succeeded' and s.qa_status is not null));

  if terminal_beats < total_beats then return false; end if;
  update public.long_form_episode_generation_charges set status = 'sample_completed' where id = p_generation_run_id and status = 'charged';
  return true;
end $$;
revoke all on function public.close_long_form_sample_generation_if_done(uuid) from public, anon, authenticated;
grant execute on function public.close_long_form_sample_generation_if_done(uuid) to service_role;
