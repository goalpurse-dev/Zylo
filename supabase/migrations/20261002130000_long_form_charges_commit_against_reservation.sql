-- 2026-10-02 "one project commitment" pass — Section 7's "Visuals -> commit
-- actual scenes" requirement, applied to the EXISTING, already-live scene
-- generation charge RPCs. This is the additive, non-breaking wiring: at each
-- point these functions previously debited public.profiles.credit_balance
-- directly, they now first ask commit_long_form_reservation_spend whether
-- an active reservation exists for this project.
--
--   'NO_RESERVATION' -> falls through to the EXACT SAME direct-debit code
--   these functions already ran — byte-for-byte unchanged behavior for
--   every legacy project (Atlantis included) that never reserves anything.
--
--   'COMMITTED' -> the reservation already moved the money out of the
--   user's balance at reservation time; committing against it must NOT
--   debit the balance a second time, so the direct-debit step is skipped.
--
-- RESERVATION_CEILING_EXCEEDED propagates as a real exception (never
-- silently drawing more than the user authorized) — the caller (the edge
-- function) is expected to surface this as "this generation needs more
-- credits than reserved; authorize more to continue," per Section 7.
--
-- Every other line of both functions is reproduced VERBATIM from their
-- current live definitions (20261001150000_long_form_true_chapter_billing.sql,
-- 20261001220000_long_form_sample_generation_charges.sql) — only the debit
-- blocks change.

create or replace function public.charge_long_form_episode_generation(
  p_project_id uuid, p_user_id uuid, p_tier text, p_preflight jsonb, p_chapter_gate boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  proj public.long_form_projects; world public.long_form_visual_world_versions; plan public.long_form_visual_plan_versions;
  existing public.long_form_episode_generation_charges; stale public.long_form_episode_generation_charges;
  quote jsonb; total integer; balance integer; idem_key text; new_id uuid; compat jsonb;
  chapter_id text; chapter_index integer; gate_boundary integer; ledger_id uuid;
  v_reservation_result text;
begin
  select * into proj from public.long_form_projects where id=p_project_id for update;
  if not found then raise exception 'PROJECT_NOT_FOUND'; end if;
  if proj.user_id is distinct from p_user_id then raise exception 'FORBIDDEN'; end if;
  if p_tier not in ('v2','v3','v4') then raise exception 'INVALID_TIER'; end if;
  compat := public.long_form_visual_world_compatibility(p_project_id);
  if not coalesce((compat->>'compatible')::boolean,false) then raise exception 'GENERATE_PREFLIGHT_FAILED_VISUAL_WORLD:%',coalesce(compat->>'reason','not_ready'); end if;
  select * into world from public.long_form_visual_world_versions where id=(compat->>'visualWorldVersionId')::uuid;
  select * into plan from public.long_form_visual_plan_versions where id=proj.current_visual_plan_version_id;
  if p_preflight->>'planId' is distinct from plan.id::text or p_preflight->>'worldId' is distinct from world.id::text
    or p_preflight->'plan' is distinct from plan.visual_plan
    or coalesce(jsonb_array_length(plan.visual_plan->'visualBeats'),0)=0
    or (select jsonb_agg(b->>'id' order by b->>'id') from jsonb_array_elements(plan.visual_plan->'visualBeats') b)
       is distinct from (select jsonb_agg(b order by b) from jsonb_array_elements_text(p_preflight->'beatIds') b)
  then raise exception 'GENERATE_PREFLIGHT_FAILED_PLAN_CHANGED_OR_UNCOMPILED'; end if;

  quote := public.quote_long_form_generation(p_project_id,p_user_id,p_tier,p_chapter_gate);
  if not coalesce((quote->>'ready')::boolean,false) then raise exception 'GENERATE_PREFLIGHT_FAILED:%',coalesce(quote->>'reason','not_ready'); end if;
  if coalesce((quote->>'complete')::boolean,false) then raise exception 'GENERATION_SCOPE_COMPLETE'; end if;
  if coalesce((quote->>'inProgress')::boolean,false) then
    select * into existing from public.long_form_episode_generation_charges where id=proj.active_generation_charge_id;
    return jsonb_build_object('charged',true,'alreadyCharged',true,'creditsCharged',0,'tier',existing.tier,
      'scope','chapter','chapterId',quote->>'chapterId','chapterIndex',(quote->>'chapterIndex')::integer,
      'generationRunId',existing.id,'beatIds','[]'::jsonb);
  end if;
  total := (quote->>'totalCredits')::integer;

  if p_chapter_gate then
    select * into existing from public.long_form_episode_generation_charges
      where id=proj.active_generation_charge_id and status='charged' and visual_plan_version_id=plan.id and chapter_gate_enabled=true for update;
    if found and existing.tier is distinct from p_tier then raise exception 'CHAPTER_TIER_LOCKED'; end if;
    chapter_id := quote->>'chapterId'; chapter_index := (quote->>'chapterIndex')::integer;
    if existing.id is null then
      select * into stale from public.long_form_episode_generation_charges where project_id=p_project_id and status='charged' for update;
      if stale.id is not null then update public.long_form_episode_generation_charges set status='superseded',superseded_at=now() where id=stale.id; end if;
      idem_key := p_project_id::text||':chapter_generation:'||plan.id::text;
      insert into public.long_form_episode_generation_charges(project_id,visual_world_version_id,visual_plan_version_id,user_id,tier,credits_charged,cost_breakdown,idempotency_key,rebuild_of_charge_id,chapter_gate_enabled)
      values(p_project_id,world.id,plan.id,p_user_id,p_tier,0,jsonb_build_object('scope','chapter','chapters','[]'::jsonb),idem_key,stale.id,true)
      returning id into new_id;
      existing.id:=new_id;
    end if;
    idem_key:=existing.id::text||':chapter:'||chapter_id;
    insert into public.long_form_chapter_generation_charges(generation_run_id,project_id,visual_plan_version_id,chapter_id,chapter_index,credits_charged,cost_breakdown,idempotency_key)
      values(existing.id,p_project_id,plan.id,chapter_id,chapter_index,total,quote,idem_key)
      on conflict(idempotency_key) do nothing returning id into ledger_id;
    if ledger_id is null then
      return jsonb_build_object('charged',true,'alreadyCharged',true,'creditsCharged',0,'tier',p_tier,'scope','chapter','chapterId',chapter_id,'chapterIndex',chapter_index,'generationRunId',existing.id,'beatIds','[]'::jsonb);
    end if;
    -- Reservation-aware debit (2026-10-02): commit against an active
    -- reservation when one exists; otherwise, unchanged direct debit.
    v_reservation_result := public.commit_long_form_reservation_spend(p_project_id, total);
    if v_reservation_result = 'NO_RESERVATION' then
      select credit_balance into balance from public.profiles where id=p_user_id for update;
      if balance is null or balance<total then raise exception 'INSUFFICIENT_CREDITS'; end if;
      update public.profiles set credit_balance=credit_balance-total,credits_spent_today=coalesce(credits_spent_today,0)+total where id=p_user_id;
    end if;
    select max((b->>'sequenceIndex')::integer) into gate_boundary from jsonb_array_elements(plan.visual_plan->'visualBeats') b where b->>'chapterId'=chapter_id;
    update public.long_form_episode_generation_charges set credits_charged=credits_charged+total,
      cost_breakdown=jsonb_set(cost_breakdown,'{chapters}',coalesce(cost_breakdown->'chapters','[]'::jsonb)||jsonb_build_array(quote),true),
      chapter_gate_enabled=true,chapter_gate_boundary_sequence_index=gate_boundary where id=existing.id;
    update public.long_form_projects set scene_generation_tier=p_tier,current_scene_generation_status='charged',active_generation_charge_id=existing.id,updated_at=now() where id=p_project_id;
    return jsonb_build_object('charged',true,'alreadyCharged',false,'creditsCharged',total,'breakdown',quote->'breakdown','tier',p_tier,
      'scope','chapter','chapterId',chapter_id,'chapterIndex',chapter_index,'generationRunId',existing.id,'beatIds',quote->'scopeBeatIds');
  end if;

  select * into existing from public.long_form_episode_generation_charges where project_id=p_project_id and status='charged' and visual_plan_version_id=plan.id;
  if found then return jsonb_build_object('charged',true,'alreadyCharged',true,'creditsCharged',0,'breakdown',existing.cost_breakdown,'tier',existing.tier,'scope','episode','generationRunId',existing.id,'beatIds','[]'::jsonb); end if;
  -- Reservation-aware debit (2026-10-02): same fallback rule as the
  -- chapter-gate branch above.
  v_reservation_result := public.commit_long_form_reservation_spend(p_project_id, total);
  if v_reservation_result = 'NO_RESERVATION' then
    select credit_balance into balance from public.profiles where id=p_user_id for update;
    if balance is null or balance<total then raise exception 'INSUFFICIENT_CREDITS'; end if;
  end if;
  select * into stale from public.long_form_episode_generation_charges where project_id=p_project_id and status='charged';
  if stale.id is not null then update public.long_form_episode_generation_charges set status='superseded',superseded_at=now() where id=stale.id; end if;
  if v_reservation_result = 'NO_RESERVATION' then
    update public.profiles set credit_balance=credit_balance-total,credits_spent_today=coalesce(credits_spent_today,0)+total where id=p_user_id;
  end if;
  idem_key:=p_project_id::text||':episode_generation:'||plan.id::text;
  insert into public.long_form_episode_generation_charges(project_id,visual_world_version_id,visual_plan_version_id,user_id,tier,credits_charged,cost_breakdown,idempotency_key,rebuild_of_charge_id,chapter_gate_enabled)
    values(p_project_id,world.id,plan.id,p_user_id,p_tier,total,quote,idem_key,stale.id,false) returning id into new_id;
  update public.long_form_projects set scene_generation_tier=p_tier,current_scene_generation_status='charged',active_generation_charge_id=new_id,updated_at=now() where id=p_project_id;
  return jsonb_build_object('charged',true,'alreadyCharged',false,'creditsCharged',total,'breakdown',quote->'breakdown','tier',p_tier,'scope','episode','generationRunId',new_id,'beatIds',quote->'scopeBeatIds');
end $$;
revoke all on function public.charge_long_form_episode_generation(uuid,uuid,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.charge_long_form_episode_generation(uuid,uuid,text,jsonb,boolean) to service_role;

create or replace function public.charge_long_form_sample_generation(p_project_id uuid, p_user_id uuid, p_tier text, p_beat_ids jsonb, p_expected_credits int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  proj public.long_form_projects; plan public.long_form_visual_plan_versions; world public.long_form_visual_world_versions;
  existing_active public.long_form_episode_generation_charges; quote jsonb; total integer; balance integer;
  idem_key text; new_id uuid; compat jsonb; v_reservation_result text;
begin
  select * into proj from public.long_form_projects where id = p_project_id for update;
  if not found then raise exception 'PROJECT_NOT_FOUND'; end if;
  if proj.user_id is distinct from p_user_id then raise exception 'FORBIDDEN'; end if;
  if p_tier not in ('v2','v3','v4') then raise exception 'INVALID_TIER'; end if;
  if jsonb_array_length(p_beat_ids) = 0 then raise exception 'NO_BEATS_SELECTED'; end if;

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

  -- Reservation-aware debit (2026-10-02): identical fallback rule as
  -- charge_long_form_episode_generation.
  if total > 0 then
    v_reservation_result := public.commit_long_form_reservation_spend(p_project_id, total);
    if v_reservation_result = 'NO_RESERVATION' then
      select credit_balance into balance from public.profiles where id = p_user_id for update;
      if balance is null or balance < total then raise exception 'INSUFFICIENT_CREDITS'; end if;
      update public.profiles set credit_balance = credit_balance - total, credits_spent_today = coalesce(credits_spent_today, 0) + total where id = p_user_id;
    end if;
  end if;

  insert into public.long_form_episode_generation_charges
    (project_id, visual_world_version_id, visual_plan_version_id, user_id, tier, credits_charged, cost_breakdown, idempotency_key, chapter_gate_enabled, sample_beat_ids)
    values (p_project_id, world.id, plan.id, p_user_id, p_tier, total, quote, idem_key, false, p_beat_ids)
    returning id into new_id;

  return jsonb_build_object('charged', true, 'alreadyCharged', false, 'creditsCharged', total, 'breakdown', quote->'breakdown', 'tier', p_tier, 'generationRunId', new_id, 'beatIds', p_beat_ids);
end $$;
revoke all on function public.charge_long_form_sample_generation(uuid, uuid, text, jsonb, int) from public, anon, authenticated;
grant execute on function public.charge_long_form_sample_generation(uuid, uuid, text, jsonb, int) to service_role;
