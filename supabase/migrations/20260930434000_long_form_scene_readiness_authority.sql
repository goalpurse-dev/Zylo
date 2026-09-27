-- One source of truth for entering Scenes. The adopted world is authoritative:
-- newer non-adopted worlds and newer unusable regeneration children are history.

alter table public.long_form_reference_assets
  add column if not exists generation_reason text,
  add column if not exists cost_accounted boolean not null default false,
  add column if not exists cost_accounted_at timestamptz;

create or replace function public.set_long_form_reference_generation_reason()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.generation_reason is null then
    if new.fallback_of_asset_id is not null then
      new.generation_reason := 'SYSTEM_REPAIR';
    elsif new.replaces_asset_id is not null then
      new.generation_reason := 'USER_REGENERATE';
    elsif exists (
      select 1 from public.long_form_visual_world_versions w
      where w.id = new.visual_world_version_id
        and w.parent_visual_world_version_id is not null
    ) then
      new.generation_reason := 'REBUILD_WORLD';
    else
      new.generation_reason := 'INITIAL';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists set_long_form_reference_generation_reason on public.long_form_reference_assets;
create trigger set_long_form_reference_generation_reason
before insert on public.long_form_reference_assets
for each row execute function public.set_long_form_reference_generation_reason();

update public.long_form_reference_assets a
set generation_reason = case
  when a.fallback_of_asset_id is not null then 'SYSTEM_REPAIR'
  when a.replaces_asset_id is not null then 'USER_REGENERATE'
  when exists (
    select 1 from public.long_form_visual_world_versions w
    where w.id = a.visual_world_version_id
      and w.parent_visual_world_version_id is not null
  ) then 'REBUILD_WORLD'
  else 'INITIAL'
end
where a.generation_reason is null;

alter table public.long_form_reference_assets
  alter column generation_reason set not null;

do $$ begin
  alter table public.long_form_reference_assets
    add constraint long_form_reference_assets_generation_reason_check
    check (generation_reason in ('INITIAL','REBUILD_WORLD','USER_REGENERATE','SYSTEM_REPAIR'));
exception when duplicate_object then null;
end $$;

create or replace function public.long_form_visual_world_compatibility(p_project_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  proj public.long_form_projects;
  plan public.long_form_visual_plan_versions;
  world public.long_form_visual_world_versions;
  missing_count integer := 0;
  missing_slots jsonb := '[]'::jsonb;
begin
  select * into proj from public.long_form_projects where id = p_project_id;
  if not found then raise exception 'PROJECT_NOT_FOUND'; end if;
  if not (proj.user_id = auth.uid() or auth.role() = 'service_role') then raise exception 'PROJECT_NOT_FOUND'; end if;

  if proj.current_visual_plan_version_id is null then
    return jsonb_build_object('compatible',false,'reason','no_current_plan','visualPlanVersionId',null,'visualWorldVersionId',null);
  end if;

  select * into plan from public.long_form_visual_plan_versions
  where id = proj.current_visual_plan_version_id and project_id = proj.id;
  if plan.id is null or plan.status is distinct from 'ready' then
    return jsonb_build_object(
      'compatible',false,'reason','visual_plan_not_ready',
      'visualPlanVersionId',proj.current_visual_plan_version_id,
      'visualPlanStatus',plan.status,'visualWorldVersionId',proj.current_visual_world_version_id
    );
  end if;

  if proj.current_visual_world_version_id is null then
    return jsonb_build_object(
      'compatible',false,'reason','no_current_adopted_world',
      'visualPlanVersionId',plan.id,'visualPlanStatus',plan.status,'visualWorldVersionId',null
    );
  end if;

  select * into world from public.long_form_visual_world_versions
  where id = proj.current_visual_world_version_id and project_id = proj.id;
  if world.id is null then
    return jsonb_build_object(
      'compatible',false,'reason','current_world_missing',
      'visualPlanVersionId',plan.id,'visualPlanStatus',plan.status,
      'visualWorldVersionId',proj.current_visual_world_version_id
    );
  end if;
  if world.visual_plan_version_id is distinct from plan.id then
    return jsonb_build_object(
      'compatible',false,'reason','world_plan_mismatch',
      'visualPlanVersionId',plan.id,'visualPlanStatus',plan.status,
      'visualWorldVersionId',world.id,'worldStatus',world.status
    );
  end if;
  if world.status is distinct from 'ready' then
    return jsonb_build_object(
      'compatible',false,'reason','world_not_ready',
      'visualPlanVersionId',plan.id,'visualPlanStatus',plan.status,
      'visualWorldVersionId',world.id,'worldStatus',world.status
    );
  end if;

  with required_slots as (
    select entity->>'entityId' as entity_id,
           view_spec->>'angle' as angle_or_view,
           view_spec->>'referenceType' as reference_type
    from jsonb_array_elements(coalesce(world.reference_plan->'entities','[]'::jsonb)) entity
    cross join lateral jsonb_array_elements(coalesce(entity->'requiredViews','[]'::jsonb)) view_spec
  ), missing as (
    select s.* from required_slots s
    where not exists (
      select 1 from public.long_form_reference_assets a
      where a.visual_world_version_id = world.id
        and a.entity_id = s.entity_id
        and a.angle_or_view = s.angle_or_view
        and a.status = 'succeeded'
        and a.result_url is not null
        and not coalesce(a.stale,false)
        and (
          coalesce(a.manual_approval,false)
          or case when s.reference_type = 'character_reference'
             then a.qa_status = 'approved'
             else a.qa_status is distinct from 'rejected'
             end
        )
    )
  )
  select count(*), coalesce(jsonb_agg(jsonb_build_object(
    'entityId',entity_id,'angleOrView',angle_or_view,'referenceType',reference_type
  ) order by entity_id,angle_or_view),'[]'::jsonb)
  into missing_count,missing_slots from missing;

  return jsonb_build_object(
    'compatible',missing_count = 0,
    'reason',case when missing_count = 0 then null else 'required_references_missing' end,
    'visualPlanVersionId',plan.id,'visualPlanStatus',plan.status,
    'visualWorldVersionId',world.id,'worldStatus',world.status,
    'missingRequiredReferenceCount',missing_count,'missingRequiredReferences',missing_slots,
    'reusableReferenceCount',world.reused_asset_count,'newReferenceCount',world.new_asset_count
  );
end $$;
revoke all on function public.long_form_visual_world_compatibility(uuid) from public,anon;
grant execute on function public.long_form_visual_world_compatibility(uuid) to authenticated,service_role;

create or replace function public.long_form_project_resume_state(p_project_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  proj public.long_form_projects;
  plan public.long_form_visual_plan_versions;
  compat jsonb;
  world_id uuid;
  charge public.long_form_episode_generation_charges;
  total_beats integer;
  scene_counts jsonb;
  has_current_plans boolean := false;
  charge_matches_exact boolean := false;
begin
  select * into proj from public.long_form_projects where id=p_project_id;
  if not found then raise exception 'PROJECT_NOT_FOUND'; end if;
  if not (proj.user_id=auth.uid() or auth.role()='service_role') then raise exception 'PROJECT_NOT_FOUND'; end if;
  if proj.current_visual_plan_version_id is null then
    return jsonb_build_object('stage','none','route',null);
  end if;
  select * into plan from public.long_form_visual_plan_versions where id=proj.current_visual_plan_version_id;
  compat := public.long_form_visual_world_compatibility(p_project_id);

  if not coalesce((compat->>'compatible')::boolean,false) then
    return jsonb_build_object(
      'stage','visual_world','route','visual-world',
      'visualPlanVersionId',proj.current_visual_plan_version_id,
      'visualWorldVersionId',compat->>'visualWorldVersionId',
      'visualWorldStatus',compat->>'worldStatus',
      'compatibilityReason',compat->>'reason',
      'missingRequiredReferenceCount',coalesce((compat->>'missingRequiredReferenceCount')::integer,0)
    );
  end if;

  world_id := (compat->>'visualWorldVersionId')::uuid;
  if proj.active_generation_charge_id is not null then
    select * into charge from public.long_form_episode_generation_charges where id=proj.active_generation_charge_id;
  end if;
  charge_matches_exact := charge.id is not null and charge.status='charged'
    and charge.visual_plan_version_id=proj.current_visual_plan_version_id
    and charge.visual_world_version_id=world_id;
  select exists(select 1 from public.long_form_scene_render_plans
    where project_id=proj.id and visual_world_version_id=world_id
      and visual_plan_version_id=proj.current_visual_plan_version_id) into has_current_plans;

  select jsonb_build_object(
    'ready',count(*) filter(where sc.status='succeeded' and sc.qa_status='approved'),
    'needsReview',count(*) filter(where sc.status='succeeded' and sc.qa_status='rejected'),
    'failed',count(*) filter(where sc.status='failed'),
    'generating',count(*) filter(where sc.status='running'),
    'queued',count(*) filter(where sc.status='pending'),
    'compiled',count(*)
  ) into scene_counts
  from public.long_form_scenes sc
  join public.long_form_scene_render_plans srp on srp.id=sc.scene_render_plan_id
  where srp.project_id=proj.id and srp.visual_world_version_id=world_id
    and srp.visual_plan_version_id=proj.current_visual_plan_version_id
    and (not charge_matches_exact or sc.generation_run_id=charge.id)
    and not exists(select 1 from public.long_form_scenes newer where newer.replaces_scene_id=sc.id);

  total_beats := coalesce(jsonb_array_length(plan.visual_plan->'visualBeats'),(plan.storyboard_summary->>'totalVisualBeats')::integer,0);
  return jsonb_build_object(
    'stage','generate','route','generate','visualPlanVersionId',proj.current_visual_plan_version_id,
    'visualWorldVersionId',world_id,'visualWorldStatus',compat->>'worldStatus',
    'compatibilityReason',null,'chargeExists',charge_matches_exact,
    'creditsCharged',case when charge_matches_exact then charge.credits_charged else null end,
    'staleChargeForDifferentPairing',charge.id is not null and not charge_matches_exact and not has_current_plans,
    'totalBeats',total_beats,'ready',coalesce((scene_counts->>'ready')::integer,0),
    'needsReview',coalesce((scene_counts->>'needsReview')::integer,0),
    'failed',coalesce((scene_counts->>'failed')::integer,0),
    'generating',coalesce((scene_counts->>'generating')::integer,0),
    'queued',coalesce((scene_counts->>'queued')::integer,0),
    'planned',greatest(0,total_beats-coalesce((scene_counts->>'compiled')::integer,0))
  );
end $$;
revoke all on function public.long_form_project_resume_state(uuid) from public,anon;
grant execute on function public.long_form_project_resume_state(uuid) to authenticated,service_role;

-- The charge boundary independently re-checks the same authority. The Edge
-- preflight also calls it before compiling, so UI, compilation, and billing agree.
create or replace function public.charge_long_form_episode_generation(p_project_id uuid, p_user_id uuid, p_tier text, p_preflight jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  proj public.long_form_projects; world public.long_form_visual_world_versions; plan public.long_form_visual_plan_versions;
  existing public.long_form_episode_generation_charges; stale public.long_form_episode_generation_charges;
  price jsonb; total integer; balance integer; idem_key text; new_id uuid; unclaimed_graphics integer; compat jsonb;
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
  idem_key := p_project_id::text||':episode_generation:'||proj.current_visual_plan_version_id::text;
  insert into public.long_form_episode_generation_charges(project_id,visual_world_version_id,visual_plan_version_id,user_id,tier,credits_charged,cost_breakdown,idempotency_key,rebuild_of_charge_id)
  values(p_project_id,world.id,proj.current_visual_plan_version_id,p_user_id,p_tier,total,price,idem_key,stale.id)
  on conflict(idempotency_key) do nothing returning id into new_id;
  if new_id is null then select id into new_id from public.long_form_episode_generation_charges where idempotency_key=idem_key; end if;
  if stale.id is not null then update public.long_form_episode_generation_charges set superseded_by_charge_id=new_id where id=stale.id and superseded_by_charge_id is null; end if;
  update public.long_form_projects set scene_generation_tier=p_tier,current_scene_generation_status='charged',active_generation_charge_id=new_id,updated_at=now() where id=p_project_id;
  return jsonb_build_object('charged',true,'alreadyCharged',false,'creditsCharged',total,'breakdown',price->'breakdown','tier',p_tier);
end $$;
revoke all on function public.charge_long_form_episode_generation(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.charge_long_form_episode_generation(uuid,uuid,text,jsonb) to service_role;
