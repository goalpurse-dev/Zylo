-- 2026-09-22 "chapter-by-chapter testing gate" — real ask while iterating on
-- a new project (Atlantis): generate ONE chapter's worth of scenes,
-- inspect the result, then explicitly ask for the next chapter — instead of
-- the existing single "Generate Episode" charge immediately compiling AND
-- dispatching every scene in the whole episode at once.
--
-- This does NOT change billing: charge_long_form_episode_generation still
-- charges for the full episode upfront exactly as before (Part 8's "charge
-- exactly once" contract is untouched) — the gate only paces WHEN
-- claim_long_form_scene_for_render is willing to hand a scene to a worker,
-- so real provider calls happen chapter by chapter instead of an entire
-- episode's worth firing in one uncontrolled burst.

alter table public.long_form_episode_generation_charges
  add column if not exists chapter_gate_boundary_sequence_index integer,
  add column if not exists chapter_gate_enabled boolean not null default false;

-- Same claim function as 20260930440000 (emergency pause), with ONE new
-- gate added: a scene beyond the run's current chapter boundary is simply
-- not eligible to be claimed yet — everything else (pause gate, claim
-- attempts, source-scene dependency) is unchanged.
create or replace function public.claim_long_form_scene_for_render(p_visual_world_version_id uuid)
returns setof public.long_form_scenes
language plpgsql security definer set search_path = '' as $$
begin
  update public.long_form_scenes s set status='failed', lease_until=null, last_error_code='CLAIMS_EXHAUSTED', last_error_at=now()
  where s.visual_world_version_id = p_visual_world_version_id and s.job_id is null and s.status in ('pending','running')
    and s.claim_attempts >= 3 and (s.lease_until is null or s.lease_until < now());

  return query update public.long_form_scenes s set status='running', claim_attempts=s.claim_attempts+1, lease_until=now()+interval '4 minutes', updated_at=now()
  from (
    select sc.id, srp.source_scene_render_plan_id
    from public.long_form_scenes sc
    join public.long_form_scene_render_plans srp on srp.id = sc.scene_render_plan_id
    where sc.visual_world_version_id = p_visual_world_version_id
      and sc.job_id is null
      and sc.claim_attempts < 3
      and (sc.status = 'pending' or (sc.status = 'running' and sc.lease_until < now()))
      and not exists (select 1 from public.long_form_scenes newer where newer.replaces_scene_id = sc.id)
      -- EMERGENCY PAUSE GATE: never claim a scene belonging to a paused
      -- generation run. A scene with no generation_run_id at all (legacy/
      -- edit rows outside the episode-generation flow) is unaffected.
      and not exists (
        select 1 from public.long_form_episode_generation_charges g
        where g.id = sc.generation_run_id and g.is_paused = true
      )
      -- CHAPTER GATE: a scene attached to a gated generation run is only
      -- claimable up to that run's current chapter boundary. A scene with
      -- no generation_run_id, or whose run never set a boundary, is
      -- unaffected (ordinary ungated behavior).
      and not exists (
        select 1 from public.long_form_episode_generation_charges g
        where g.id = sc.generation_run_id
          and g.chapter_gate_boundary_sequence_index is not null
          and srp.sequence_index > g.chapter_gate_boundary_sequence_index
      )
      and (
        srp.source_scene_render_plan_id is null
        or exists (
          select 1 from public.long_form_scenes src
          where src.scene_render_plan_id = srp.source_scene_render_plan_id
            and src.status in ('succeeded', 'failed')
            and not exists (select 1 from public.long_form_scenes newer2 where newer2.replaces_scene_id = src.id)
        )
      )
    order by srp.sequence_index limit 1 for update skip locked
  ) due
  where s.id = due.id returning s.*;
end $$;
revoke all on function public.claim_long_form_scene_for_render(uuid) from public,anon,authenticated;
grant execute on function public.claim_long_form_scene_for_render(uuid) to service_role;

-- charge_long_form_episode_generation gains one new optional parameter,
-- p_chapter_gate. When true, the freshly-inserted charge starts with its
-- boundary set to the LAST sequenceIndex of the FIRST chapter in the
-- current VisualPlan (chapters are already ordered by sequenceIndex — see
-- GenerateWorkspace.jsx's own deriveChapterLabel grouping) — every beat in
-- later chapters is still compiled into a normal 'pending' scene row exactly
-- as before, it just isn't eligible for claim_long_form_scene_for_render yet.
create or replace function public.charge_long_form_episode_generation(p_project_id uuid, p_user_id uuid, p_tier text, p_preflight jsonb, p_chapter_gate boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  proj public.long_form_projects; world public.long_form_visual_world_versions; plan public.long_form_visual_plan_versions;
  existing public.long_form_episode_generation_charges; stale public.long_form_episode_generation_charges;
  price jsonb; total integer; balance integer; idem_key text; new_id uuid; unclaimed_graphics integer; compat jsonb;
  first_chapter_id text; gate_boundary integer;
begin
  select * into proj from public.long_form_projects where id=p_project_id for update;
  if not found then raise exception 'PROJECT_NOT_FOUND'; end if;
  if proj.user_id is distinct from p_user_id then raise exception 'FORBIDDEN'; end if;
  if p_tier not in ('v2','v3','v4') then raise exception 'INVALID_TIER'; end if;
  select * into existing from public.long_form_episode_generation_charges
    where project_id=p_project_id and status='charged' and visual_plan_version_id=proj.current_visual_plan_version_id;
  if found then return jsonb_build_object('charged',true,'alreadyCharged',true,'creditsCharged',existing.credits_charged,'breakdown',existing.cost_breakdown,'tier',existing.tier); end if;

  compat := public.long_form_visual_world_compatibility(p_project_id);
  if not coalesce((compat->>'compatible')::boolean,false) then
    raise exception 'GENERATE_PREFLIGHT_FAILED_VISUAL_WORLD:%',coalesce(compat->>'reason','not_ready');
  end if;
  select * into world from public.long_form_visual_world_versions where id=(compat->>'visualWorldVersionId')::uuid;
  select * into plan from public.long_form_visual_plan_versions where id=proj.current_visual_plan_version_id;
  if p_preflight->>'planId' is distinct from plan.id::text
    or p_preflight->>'worldId' is distinct from world.id::text
    or p_preflight->'plan' is distinct from plan.visual_plan
    or p_preflight->>'contractId' is distinct from plan.visual_plan->>'narrationContractVersionId'
    or not exists(select 1 from public.long_form_narration_contract_versions c
      where c.id::text=p_preflight->>'contractId' and c.project_id=proj.id
        and c.script_version_id=proj.current_script_version_id and c.status='ready' and jsonb_array_length(c.claims)>0)
    or coalesce(jsonb_array_length(plan.visual_plan->'visualBeats'),0)=0
    or (select jsonb_agg(b->>'id' order by b->>'id') from jsonb_array_elements(plan.visual_plan->'visualBeats') b)
       is distinct from (select jsonb_agg(b order by b) from jsonb_array_elements_text(p_preflight->'beatIds') b)
  then raise exception 'GENERATE_PREFLIGHT_FAILED_PLAN_CHANGED_OR_UNCOMPILED'; end if;
  select count(*) into unclaimed_graphics from jsonb_array_elements(coalesce(plan.visual_plan->'visualBeats','[]'::jsonb)) b
    where b->>'renderMethod'='PROGRAMMATIC_GRAPHIC' and (b->>'narrationClaimId') is null;
  if unclaimed_graphics>0 then raise exception 'GENERATE_PREFLIGHT_FAILED_GRAPHIC_BEATS_NOT_COMPILABLE'; end if;

  select * into stale from public.long_form_episode_generation_charges where project_id=p_project_id and status='charged';
  price := public.estimate_long_form_episode_credits(p_project_id,p_tier); total := (price->>'totalCredits')::integer;
  select credit_balance into balance from public.profiles where id=p_user_id for update;
  if balance is null or balance<total then raise exception 'INSUFFICIENT_CREDITS'; end if;
  if stale.id is not null then update public.long_form_episode_generation_charges set status='superseded',superseded_at=now() where id=stale.id; end if;
  update public.profiles set credit_balance=credit_balance-total,credits_spent_today=coalesce(credits_spent_today,0)+total where id=p_user_id;

  gate_boundary := null;
  if p_chapter_gate then
    select b->>'chapterId' into first_chapter_id
    from jsonb_array_elements(plan.visual_plan->'visualBeats') b
    order by (b->>'sequenceIndex')::integer asc limit 1;
    select max((b->>'sequenceIndex')::integer) into gate_boundary
    from jsonb_array_elements(plan.visual_plan->'visualBeats') b
    where b->>'chapterId' is not distinct from first_chapter_id;
  end if;

  idem_key := p_project_id::text||':episode_generation:'||proj.current_visual_plan_version_id::text;
  insert into public.long_form_episode_generation_charges(
    project_id,visual_world_version_id,visual_plan_version_id,user_id,tier,credits_charged,cost_breakdown,idempotency_key,rebuild_of_charge_id,
    chapter_gate_enabled,chapter_gate_boundary_sequence_index
  )
  values(p_project_id,world.id,proj.current_visual_plan_version_id,p_user_id,p_tier,total,price,idem_key,stale.id,
    coalesce(p_chapter_gate,false),gate_boundary)
  on conflict(idempotency_key) do nothing returning id into new_id;
  if new_id is null then select id into new_id from public.long_form_episode_generation_charges where idempotency_key=idem_key; end if;
  if stale.id is not null then update public.long_form_episode_generation_charges set superseded_by_charge_id=new_id where id=stale.id and superseded_by_charge_id is null; end if;
  update public.long_form_projects set scene_generation_tier=p_tier,current_scene_generation_status='charged',active_generation_charge_id=new_id,updated_at=now() where id=p_project_id;
  return jsonb_build_object('charged',true,'alreadyCharged',false,'creditsCharged',total,'breakdown',price->'breakdown','tier',p_tier);
end $$;
revoke all on function public.charge_long_form_episode_generation(uuid,uuid,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.charge_long_form_episode_generation(uuid,uuid,text,jsonb,boolean) to service_role;
-- Drop the old 4-arg overload so no caller can accidentally resolve to a
-- stale signature missing the new parameter.
drop function if exists public.charge_long_form_episode_generation(uuid,uuid,text,jsonb);

-- "Generate Next Chapter" — advances a gated run's boundary to the next
-- chapter once every scene up to the CURRENT boundary has reached a
-- terminal long_form_scenes.status (succeeded or failed — 'needs review' is
-- a qa_status on a succeeded row, not a separate status, so it already
-- counts as terminal here exactly like claim_long_form_scene_for_render's
-- own pending/running vocabulary).
create or replace function public.advance_long_form_chapter_gate(p_project_id uuid, p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  proj public.long_form_projects; charge public.long_form_episode_generation_charges;
  incomplete_count integer; next_boundary integer; next_chapter_id text;
begin
  select * into proj from public.long_form_projects where id=p_project_id for update;
  if not found then raise exception 'PROJECT_NOT_FOUND'; end if;
  if proj.user_id is distinct from p_user_id then raise exception 'FORBIDDEN'; end if;
  if proj.active_generation_charge_id is null then raise exception 'NO_ACTIVE_GENERATION'; end if;
  select * into charge from public.long_form_episode_generation_charges where id=proj.active_generation_charge_id and status='charged' for update;
  if not found then raise exception 'NO_ACTIVE_GENERATION'; end if;
  if not charge.chapter_gate_enabled or charge.chapter_gate_boundary_sequence_index is null then
    raise exception 'CHAPTER_GATE_NOT_ACTIVE';
  end if;

  select count(*) into incomplete_count
  from public.long_form_scenes sc
  join public.long_form_scene_render_plans srp on srp.id = sc.scene_render_plan_id
  where sc.generation_run_id = charge.id
    and srp.sequence_index <= charge.chapter_gate_boundary_sequence_index
    and sc.status in ('pending','running')
    and not exists (select 1 from public.long_form_scenes newer where newer.replaces_scene_id = sc.id);
  if incomplete_count > 0 then raise exception 'CHAPTER_NOT_COMPLETE'; end if;

  select b->>'chapterId' into next_chapter_id
  from public.long_form_visual_plan_versions p, jsonb_array_elements(p.visual_plan->'visualBeats') b
  where p.id = charge.visual_plan_version_id
    and (b->>'sequenceIndex')::integer > charge.chapter_gate_boundary_sequence_index
  order by (b->>'sequenceIndex')::integer asc limit 1;

  if next_chapter_id is null then
    -- No further chapters remain — open the gate fully so anything already
    -- compiled becomes claimable (functionally the same as an ungated run
    -- from this point on).
    update public.long_form_episode_generation_charges set chapter_gate_boundary_sequence_index=null where id=charge.id;
    return jsonb_build_object('ok',true,'chapterGateComplete',true,'chapterGateBoundary',null,'visualWorldVersionId',charge.visual_world_version_id);
  end if;

  select max((b->>'sequenceIndex')::integer) into next_boundary
  from public.long_form_visual_plan_versions p, jsonb_array_elements(p.visual_plan->'visualBeats') b
  where p.id = charge.visual_plan_version_id and b->>'chapterId' is not distinct from next_chapter_id;

  update public.long_form_episode_generation_charges set chapter_gate_boundary_sequence_index=next_boundary where id=charge.id;
  return jsonb_build_object('ok',true,'chapterGateComplete',false,'chapterGateBoundary',next_boundary,'chapterId',next_chapter_id,'visualWorldVersionId',charge.visual_world_version_id);
end $$;
revoke all on function public.advance_long_form_chapter_gate(uuid,uuid) from public,anon,authenticated;
grant execute on function public.advance_long_form_chapter_gate(uuid,uuid) to service_role;
