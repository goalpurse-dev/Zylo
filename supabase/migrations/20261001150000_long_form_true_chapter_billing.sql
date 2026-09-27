-- Durable chapter-scoped billing on the existing episode generation run.
-- The renderer, scene plans and jobs remain shared with normal episode mode.

create table if not exists public.long_form_chapter_generation_charges (
  id uuid primary key default gen_random_uuid(),
  generation_run_id uuid not null references public.long_form_episode_generation_charges(id) on delete cascade,
  project_id uuid not null references public.long_form_projects(id) on delete cascade,
  visual_plan_version_id uuid not null references public.long_form_visual_plan_versions(id),
  chapter_id text not null,
  chapter_index integer not null,
  credits_charged integer not null check (credits_charged >= 0),
  cost_breakdown jsonb not null,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  unique (generation_run_id, chapter_id)
);
alter table public.long_form_chapter_generation_charges enable row level security;
revoke all on public.long_form_chapter_generation_charges from public, anon, authenticated;

-- One server-side quote for both the UI and the charge transaction. It only
-- considers the current adopted plan/world and current scene rows. Historical
-- or superseded worlds cannot affect the result.
create or replace function public.quote_long_form_generation(
  p_project_id uuid, p_user_id uuid, p_tier text, p_chapter_mode boolean default false
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  proj public.long_form_projects; compat jsonb; run public.long_form_episode_generation_charges;
  latest public.long_form_chapter_generation_charges; chosen_id text; chosen_index integer;
  chosen_title text; expected_count integer; terminal_count integer; in_progress boolean := false;
  counts jsonb; total integer; ready_count integer; beat_ids jsonb; scope_beat_ids jsonb; scope_label text;
begin
  select * into proj from public.long_form_projects where id=p_project_id;
  if not found then raise exception 'PROJECT_NOT_FOUND'; end if;
  if proj.user_id is distinct from p_user_id then raise exception 'FORBIDDEN'; end if;
  if p_tier not in ('v2','v3','v4') then raise exception 'INVALID_TIER'; end if;
  compat := public.long_form_visual_world_compatibility(p_project_id);
  if not coalesce((compat->>'compatible')::boolean,false) then
    return jsonb_build_object('ready',false,'reason',compat->>'reason','missingRequiredReferenceCount',coalesce((compat->>'missingRequiredReferenceCount')::integer,0));
  end if;

  if p_chapter_mode then
    select * into run from public.long_form_episode_generation_charges
      where id=proj.active_generation_charge_id and status='charged'
        and visual_plan_version_id=proj.current_visual_plan_version_id and chapter_gate_enabled=true;
    if found then
      select * into latest from public.long_form_chapter_generation_charges
        where generation_run_id=run.id order by chapter_index desc limit 1;
      if found then
        select count(*) into expected_count
        from public.long_form_visual_plan_versions p, jsonb_array_elements(p.visual_plan->'visualBeats') b
        where p.id=proj.current_visual_plan_version_id and b->>'chapterId'=latest.chapter_id;
        select count(*) into terminal_count
        from public.long_form_scenes s
        join public.long_form_scene_render_plans rp on rp.id=s.scene_render_plan_id
        where s.generation_run_id=run.id and rp.visual_plan_version_id=proj.current_visual_plan_version_id
          and rp.chapter_id=latest.chapter_id and s.status in ('succeeded','failed')
          and not exists(select 1 from public.long_form_scenes n where n.replaces_scene_id=s.id);
        in_progress := terminal_count < expected_count;
        if in_progress then
          return jsonb_build_object('ready',true,'scope','chapter','inProgress',true,'complete',false,
            'chapterId',latest.chapter_id,'chapterIndex',latest.chapter_index,'totalVisuals',expected_count,
            'processedVisuals',terminal_count,'totalCredits',0,'generationRunId',run.id);
        end if;
      end if;
    end if;

    select x.chapter_id,x.chapter_index,x.chapter_title into chosen_id,chosen_index,chosen_title
    from (
      select b->>'chapterId' chapter_id,
        dense_rank() over(order by min((b->>'sequenceIndex')::integer))-1 chapter_index,
        coalesce(nullif(max(b->>'chapterTitle'),''),nullif(max(b->>'sequenceTitle'),'')) chapter_title,
        min((b->>'sequenceIndex')::integer) first_sequence
      from public.long_form_visual_plan_versions p, jsonb_array_elements(p.visual_plan->'visualBeats') b
      where p.id=proj.current_visual_plan_version_id group by b->>'chapterId'
    ) x
    where run.id is null or not exists (
      select 1 from public.long_form_chapter_generation_charges cc
      where cc.generation_run_id=run.id and cc.chapter_id=x.chapter_id
    ) order by x.first_sequence limit 1;
    if chosen_id is null then
      return jsonb_build_object('ready',true,'scope','chapter','inProgress',false,'complete',true,'totalCredits',0,'generationRunId',run.id);
    end if;
    scope_label := 'chapter';
  else
    chosen_id := null; chosen_index := null; chosen_title := null; scope_label := 'episode';
  end if;

  with beats as (
    select b
    from public.long_form_visual_plan_versions p, jsonb_array_elements(p.visual_plan->'visualBeats') b
    where p.id=proj.current_visual_plan_version_id and (chosen_id is null or b->>'chapterId'=chosen_id)
  ), current_ready as (
    select distinct rp.visual_beat_id
    from public.long_form_scene_render_plans rp
    join public.long_form_scenes s on s.scene_render_plan_id=rp.id
    where rp.visual_plan_version_id=proj.current_visual_plan_version_id
      and rp.visual_world_version_id=(compat->>'visualWorldVersionId')::uuid
      and s.status='succeeded' and not exists(select 1 from public.long_form_scenes n where n.replaces_scene_id=s.id)
  ), outstanding as (
    select b from beats where not exists(select 1 from current_ready r where r.visual_beat_id=b->>'id')
  ), categorized as (
    select b->>'id' beat_id, public.categorize_long_form_render_method(b->>'renderMethod') category from outstanding
  )
  select jsonb_build_object(
      'freshGenerations',count(*) filter(where category='freshGenerations'),
      'edits',count(*) filter(where category='edits'),
      'reused',count(*) filter(where category='reused'),
      'crops',count(*) filter(where category='crops'),
      'graphics',count(*) filter(where category='graphics')),
    coalesce(jsonb_agg(beat_id order by beat_id),'[]'::jsonb)
  into counts,beat_ids from categorized;

  select count(*) into expected_count from public.long_form_visual_plan_versions p,
    jsonb_array_elements(p.visual_plan->'visualBeats') b
    where p.id=proj.current_visual_plan_version_id and (chosen_id is null or b->>'chapterId'=chosen_id);
  ready_count := expected_count-jsonb_array_length(beat_ids);
  select coalesce(jsonb_agg(b->>'id' order by (b->>'sequenceIndex')::integer),'[]'::jsonb) into scope_beat_ids
  from public.long_form_visual_plan_versions p, jsonb_array_elements(p.visual_plan->'visualBeats') b
  where p.id=proj.current_visual_plan_version_id and (chosen_id is null or b->>'chapterId'=chosen_id);
  total := (counts->>'freshGenerations')::integer*public.long_form_tier_generate_credits(p_tier)
    +(counts->>'edits')::integer*public.long_form_tier_edit_credits(p_tier);
  return jsonb_build_object('ready',true,'scope',scope_label,'inProgress',false,'complete',jsonb_array_length(beat_ids)=0,
    'chapterId',chosen_id,'chapterIndex',chosen_index,'chapterTitle',chosen_title,
    'totalVisuals',expected_count,'alreadyReady',ready_count,'outstandingVisuals',jsonb_array_length(beat_ids),
    'billableOperations',(counts->>'freshGenerations')::integer+(counts->>'edits')::integer,
    'totalCredits',total,'tier',p_tier,'breakdown',counts,'beatIds',beat_ids,'scopeBeatIds',scope_beat_ids,'generationRunId',run.id);
end $$;
revoke all on function public.quote_long_form_generation(uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.quote_long_form_generation(uuid,uuid,text,boolean) to service_role;

create or replace function public.charge_long_form_episode_generation(
  p_project_id uuid, p_user_id uuid, p_tier text, p_preflight jsonb, p_chapter_gate boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  proj public.long_form_projects; world public.long_form_visual_world_versions; plan public.long_form_visual_plan_versions;
  existing public.long_form_episode_generation_charges; stale public.long_form_episode_generation_charges;
  quote jsonb; total integer; balance integer; idem_key text; new_id uuid; compat jsonb;
  chapter_id text; chapter_index integer; gate_boundary integer; ledger_id uuid;
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
    select credit_balance into balance from public.profiles where id=p_user_id for update;
    if balance is null or balance<total then raise exception 'INSUFFICIENT_CREDITS'; end if;
    update public.profiles set credit_balance=credit_balance-total,credits_spent_today=coalesce(credits_spent_today,0)+total where id=p_user_id;
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
  select credit_balance into balance from public.profiles where id=p_user_id for update;
  if balance is null or balance<total then raise exception 'INSUFFICIENT_CREDITS'; end if;
  select * into stale from public.long_form_episode_generation_charges where project_id=p_project_id and status='charged';
  if stale.id is not null then update public.long_form_episode_generation_charges set status='superseded',superseded_at=now() where id=stale.id; end if;
  update public.profiles set credit_balance=credit_balance-total,credits_spent_today=coalesce(credits_spent_today,0)+total where id=p_user_id;
  idem_key:=p_project_id::text||':episode_generation:'||plan.id::text;
  insert into public.long_form_episode_generation_charges(project_id,visual_world_version_id,visual_plan_version_id,user_id,tier,credits_charged,cost_breakdown,idempotency_key,rebuild_of_charge_id,chapter_gate_enabled)
    values(p_project_id,world.id,plan.id,p_user_id,p_tier,total,quote,idem_key,stale.id,false) returning id into new_id;
  update public.long_form_projects set scene_generation_tier=p_tier,current_scene_generation_status='charged',active_generation_charge_id=new_id,updated_at=now() where id=p_project_id;
  return jsonb_build_object('charged',true,'alreadyCharged',false,'creditsCharged',total,'breakdown',quote->'breakdown','tier',p_tier,'scope','episode','generationRunId',new_id,'beatIds',quote->'scopeBeatIds');
end $$;
revoke all on function public.charge_long_form_episode_generation(uuid,uuid,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.charge_long_form_episode_generation(uuid,uuid,text,jsonb,boolean) to service_role;
