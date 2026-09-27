-- Long Form scene reliability pass (2026-09-14):
-- (1) Corrects the V4 Seedream registration — the model actually manually
--     verified against Runware is Seedream 5.0 LITE
--     (bytedance:seedream@5.0-lite), not "Seedream 5.0 Pro" (never tested,
--     registered in error in the prior pass). Renaming image:seedream5pro
--     -> image:seedream5lite everywhere it appears in SQL.
-- (2) Updates V4's credit estimate from the real observed Runware cost
--     ($0.035, identical at both verified resolutions 2848x1600 and
--     4096x2304) rather than the earlier unverified $0.048 guess. Applying
--     the same ~2.2x retail margin this codebase's other entries use
--     (Kling ~2.14x, Qwen ~2.41x): retailUSD ~= $0.08, credits = 4. This
--     specific customer-facing price has not had explicit business sign-
--     off (same disclosed caveat as V3's Kling price) — revisit before wide
--     release.
-- Dimension/reference-count validation itself now lives in
-- supabase/functions/_shared/imageDimensionPolicy.ts (Deno, pre-dispatch)
-- and runware-image's own final provider-boundary snap — SQL's role here
-- is unchanged (tool_key/reference-shape validation only).

create or replace function public.long_form_tier_generate_credits(p_tier text)
returns int language sql immutable as $$
  select case p_tier when 'v2' then 2 when 'v3' then 3 when 'v4' then 4 else 3 end
$$;

create or replace function public.long_form_tier_primary_tool_key(p_tier text)
returns text language sql immutable as $$
  select case p_tier when 'v2' then 'image:flux2.klein9bkv' when 'v4' then 'image:seedream5lite' else 'image:kling.o3' end
$$;

-- Re-declare enqueue_long_form_scene_job unchanged except the render_model
-- display-label mapping's Seedream entry (tool_key -> real airTag string).
-- Every other check in this function is byte-identical to the version in
-- 20260930160000_long_form_scene_generation_pricing.sql.
create or replace function public.enqueue_long_form_scene_job(p_scene_id uuid, p_job jsonb, p_claim_attempt integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  s public.long_form_scenes; v public.long_form_visual_world_versions; rp public.long_form_scene_render_plans; owner_id uuid;
  tk text; expected_tk text; ref_count int; parent_url text;
begin
  select * into s from public.long_form_scenes where id = p_scene_id for update;
  if not found then raise exception 'SCENE_NOT_FOUND'; end if;
  if s.job_id is not null then return s.job_id; end if;
  if s.status <> 'running' or s.claim_attempts <> p_claim_attempt or s.lease_until is null or s.lease_until <= now() then raise exception 'CLAIM_EXPIRED'; end if;
  select * into rp from public.long_form_scene_render_plans where id = s.scene_render_plan_id;
  select * into v from public.long_form_visual_world_versions where id = s.visual_world_version_id;
  select user_id into owner_id from public.long_form_projects where id = v.project_id;
  tk := p_job->>'tool_key';
  ref_count := coalesce(jsonb_array_length(p_job->'input'->'ref_images'), 0);
  expected_tk := case when s.render_strategy = 'EDIT' then 'image:qwen.image-edit-plus' when s.render_strategy = 'GENERATE' then public.long_form_tier_primary_tool_key(rp.render_tier) else null end;
  if expected_tk is null then raise exception 'SCENE_RENDER_STRATEGY_NOT_DISPATCHABLE'; end if;
  if tk is distinct from expected_tk
  or (p_job->>'user_id')::uuid is distinct from owner_id or (p_job->>'id')::uuid is distinct from s.id then raise exception 'INVALID_SCENE_JOB'; end if;
  if s.render_strategy = 'EDIT' then
    if rp.source_scene_render_plan_id is not null then
      select sc2.result_url into parent_url
      from public.long_form_scenes sc2
      where sc2.scene_render_plan_id = rp.source_scene_render_plan_id and sc2.status = 'succeeded'
        and not exists (select 1 from public.long_form_scenes newer3 where newer3.replaces_scene_id = sc2.id)
      order by sc2.created_at desc limit 1;
    elsif s.replaces_scene_id is not null then
      select result_url into parent_url from public.long_form_scenes where id = s.replaces_scene_id;
    end if;
    if parent_url is null or ref_count <> 1
    or p_job->'input'->'ref_images'->0 is distinct from to_jsonb(parent_url)
    then raise exception 'EDIT_SOURCE_IMAGE_REQUIRED'; end if;
  elsif s.render_strategy = 'GENERATE' then
    if ref_count <> coalesce(array_length(rp.reference_asset_ids, 1), 0)
    or exists (
      select 1 from jsonb_array_elements_text(coalesce(p_job->'input'->'ref_images', '[]'::jsonb)) got(url)
      where got.url not in (select coalesce(result_url, '') from public.long_form_reference_assets where id = any(rp.reference_asset_ids))
    )
    then raise exception 'GENERATE_REFERENCE_IMAGES_MUST_MATCH_RESOLVED_PLAN'; end if;
  end if;
  insert into public.jobs(id,user_id,type,tool_key,project_id,prompt,settings,input,status,progress,charge_credits,charged,priority,plan_code,provider,attempts,max_attempts,retry_after)
  values(s.id,owner_id,'image',tk,null,p_job->>'prompt',
  (p_job->'settings')||jsonb_build_object('credits',0,'priceUSD',0,'long_form_internal',true,'long_form_scene_id',s.id),
  p_job->'input','queued',0,0,false,9,p_job->>'plan_code','runware',0,3,now());
  update public.long_form_scenes set job_id = s.id, prompt_snapshot = p_job->>'prompt',
    render_model = case when tk = 'image:kling.o3' then 'klingai:kling-image@o3' when tk = 'image:flux2.klein9bkv' then 'runware:400@6' when tk = 'image:seedream5lite' then 'bytedance:seedream@5.0-lite' when tk = 'image:qwen.image-edit-plus' then 'runware:108@22' else tk end,
    updated_at = now() where id = s.id;
  return s.id;
end $$;
