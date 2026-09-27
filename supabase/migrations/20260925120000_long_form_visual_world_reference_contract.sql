-- Visual World reference-contract hardening (UI/architecture patch — see
-- companion code changes in advance-long-form-visual-world,
-- _shared/visualWorldStyle.ts, _shared/visualWorldJobs.ts). Purely additive:
-- no backfill of existing rows, no touching of the current Mars project's
-- already-generated reference assets. New columns default to null/false and
-- only get populated going forward by the updated planning/generation code.

alter table public.long_form_reference_assets
  add column qa_expectations jsonb,
  add column edit_instruction text;

comment on column public.long_form_reference_assets.qa_expectations is
  'Structural QA expectations computed deterministically at plan time (Part 17) — expectedFraming/expectedOrientation/expectedBackgroundMode/allowReadableText/identityAnchorId for characters, expectedCameraAnchor/charactersAllowed for locations, isolationPreferred for objects. No paid AI QA pass reads this yet — a clean place for one to plug in later.';
comment on column public.long_form_reference_assets.edit_instruction is
  'Set only on a row created by edit_long_form_reference_asset() — a natural-language instruction for a controlled transformation of the parent (replaces_asset_id) image, as opposed to a plain Regenerate (null here) which is a fresh attempt from the canonical spec.';

-- Dependency-graph claim gating (Part 5): a character's PROFILE/FACE views
-- are derived FROM its own IDENTITY_3Q anchor (see CHARACTER_REFERENCE_ROLES
-- in _shared/visualWorldStyle.ts), not three independent generations. This
-- means a derived view must never be claimed/dispatched before its own
-- identity anchor has reached a TERMINAL state (succeeded = condition on
-- it; failed = fall back to independent generation rather than stall
-- forever — see stageGenerating's own handling of that fallback). Rows with
-- no identity-anchor sibling at all (e.g. it was excluded via
-- excluded_views) are never blocked, so a plan missing that anchor can't
-- deadlock either.
create or replace function public.claim_long_form_reference_asset_for_version(p_visual_world_version_id uuid)
returns setof public.long_form_reference_assets language plpgsql security definer set search_path = '' as $$
begin
  update public.long_form_reference_assets a set status='failed',lease_until=null,last_error_code='CLAIMS_EXHAUSTED',last_error_at=now()
  where a.visual_world_version_id=p_visual_world_version_id and a.job_id is null and a.status in ('pending','running') and a.claim_attempts>=3 and (a.lease_until is null or a.lease_until<now());

  return query update public.long_form_reference_assets a set status='running',claim_attempts=a.claim_attempts+1,lease_until=now()+interval '3 minutes',updated_at=now()
  from (
    select r.id from public.long_form_reference_assets r
    where r.visual_world_version_id=p_visual_world_version_id
      and r.job_id is null
      and r.claim_attempts<3
      and (r.status='pending' or (r.status='running' and r.lease_until<now()))
      and not exists (select 1 from public.long_form_reference_assets newer where newer.replaces_asset_id=r.id)
      and (
        r.reference_type <> 'character_reference'
        or r.angle_or_view not in ('profile','face_closeup')
        or not exists (
          select 1 from public.long_form_reference_assets anchor
          where anchor.visual_world_version_id = r.visual_world_version_id
            and anchor.entity_id = r.entity_id
            and anchor.angle_or_view = 'three_quarter_neutral'
            and not exists (select 1 from public.long_form_reference_assets a2 where a2.replaces_asset_id = anchor.id)
        )
        or exists (
          select 1 from public.long_form_reference_assets anchor
          where anchor.visual_world_version_id = r.visual_world_version_id
            and anchor.entity_id = r.entity_id
            and anchor.angle_or_view = 'three_quarter_neutral'
            and anchor.status in ('succeeded','failed')
            and not exists (select 1 from public.long_form_reference_assets a2 where a2.replaces_asset_id = anchor.id)
        )
      )
    order by r.created_at limit 1 for update skip locked
  ) due
  where a.id=due.id returning a.*;
end $$;
revoke all on function public.claim_long_form_reference_asset_for_version(uuid) from public,anon,authenticated;
grant execute on function public.claim_long_form_reference_asset_for_version(uuid) to service_role;

-- Reference-conditioned derivation (Part 5) needs a renderer that actually
-- supports reference images — image:flux2.klein9bkv (Runware AIR
-- runware:400@6, see providers.ts) is the one already verified in this
-- codebase to support up to 4 reference images. The plain identity-anchor
-- generation keeps using whatever renderer the Visual World version was
-- configured with (usually image:flux.base); only a DERIVED view's job
-- needs this second tool_key allowed through.
create or replace function public.enqueue_long_form_reference_job(p_asset_id uuid, p_job jsonb, p_claim_attempt integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare a public.long_form_reference_assets; v public.long_form_visual_world_versions; owner_id uuid; job_tool_key text;
begin
  select * into a from public.long_form_reference_assets where id=p_asset_id for update;
  if not found then raise exception 'REFERENCE_NOT_FOUND'; end if;
  if a.job_id is not null then return a.job_id; end if;
  if a.status <> 'running' or a.claim_attempts <> p_claim_attempt or a.lease_until <= now() then raise exception 'CLAIM_EXPIRED'; end if;
  select * into v from public.long_form_visual_world_versions where id=a.visual_world_version_id;
  select user_id into owner_id from public.long_form_projects where id=v.project_id;
  job_tool_key := p_job->>'tool_key';
  if job_tool_key not in ('image:flux.base','image:flux2.klein9bkv') or (p_job->>'user_id')::uuid <> owner_id or (p_job->>'id')::uuid <> a.id then raise exception 'INVALID_REFERENCE_JOB'; end if;
  -- A derived view (has input_reference_asset_ids) is explicitly allowed to
  -- use a different tool_key than the version's own default renderer, since
  -- that renderer may not support reference images at all — the base
  -- identity anchor still must match v.renderer_tool_key exactly.
  if array_length(a.input_reference_asset_ids,1) is null and job_tool_key <> v.renderer_tool_key then raise exception 'INVALID_REFERENCE_JOB'; end if;
  insert into public.jobs (id,user_id,type,tool_key,project_id,prompt,settings,input,status,progress,charge_credits,charged,priority,plan_code,provider,attempts,max_attempts,retry_after)
  values (a.id,owner_id,'image',job_tool_key,null,p_job->>'prompt',p_job->'settings',p_job->'input','queued',0,0,false,9,p_job->>'plan_code','runware',0,3,now());
  update public.long_form_reference_assets set job_id=a.id, prompt_snapshot=p_job->>'prompt', render_model=(case job_tool_key when 'image:flux2.klein9bkv' then 'runware:400@6' else 'runware:400@4' end), updated_at=now() where id=a.id;
  return a.id;
end $$;
revoke all on function public.enqueue_long_form_reference_job(uuid,jsonb,integer) from public,anon,authenticated;
grant execute on function public.enqueue_long_form_reference_job(uuid,jsonb,integer) to service_role;

-- Edit is separate from Regenerate (Part 13): Regenerate is a fresh attempt
-- from the canonical spec (replace_long_form_reference_asset, unchanged);
-- Edit is a controlled transformation of the CURRENT image via a
-- user-supplied instruction, conditioned on that exact image. Both preserve
-- history the same way — a new child row via replaces_asset_id, the parent
-- untouched. The source asset must be succeeded (there is no image yet to
-- edit otherwise) — this is the one difference from replace's own
-- succeeded-or-failed gate.
create or replace function public.edit_long_form_reference_asset(p_asset_id uuid, p_user_id uuid, p_instruction text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare a public.long_form_reference_assets; v public.long_form_visual_world_versions; replacement_id uuid; owner_id uuid; trimmed text;
begin
  trimmed := trim(coalesce(p_instruction, ''));
  if length(trimmed) < 3 or length(trimmed) > 800 then raise exception 'INVALID_INSTRUCTION'; end if;
  select * into a from public.long_form_reference_assets where id=p_asset_id;
  if not found then raise exception 'REFERENCE_NOT_FOUND'; end if;
  select * into v from public.long_form_visual_world_versions where id=a.visual_world_version_id for update;
  select user_id into owner_id from public.long_form_projects where id=v.project_id;
  if owner_id is distinct from p_user_id then raise exception 'FORBIDDEN'; end if;
  select * into a from public.long_form_reference_assets where id=p_asset_id for update;
  select id into replacement_id from public.long_form_reference_assets where replaces_asset_id=a.id;
  if replacement_id is not null then return replacement_id; end if;
  if a.status <> 'succeeded' or a.result_url is null then raise exception 'NOTHING_TO_EDIT'; end if;
  if v.worker_lock_until > now() then raise exception 'WORLD_BUSY'; end if;
  if v.stage='planning' or exists(select 1 from public.long_form_visual_world_versions other where other.project_id=v.project_id and other.id<>v.id and other.status in ('planning','generating')) then raise exception 'WORLD_BUSY'; end if;
  insert into public.long_form_reference_assets(visual_world_version_id,entity_id,reference_type,angle_or_view,replaces_asset_id,render_model,edit_instruction,input_reference_asset_ids)
  values(a.visual_world_version_id,a.entity_id,a.reference_type,a.angle_or_view,a.id,a.render_model,trimmed,array[a.id]) returning id into replacement_id;
  update public.long_form_visual_world_versions set status='generating',stage='generating',stage_attempt=0,worker_lock_until=null,last_error_code=null,updated_at=now() where id=v.id;
  return replacement_id;
end $$;
-- Called from the edit-long-form-reference-asset Edge Function (service
-- role), same pattern as replace_long_form_reference_asset via
-- regenerate-long-form-reference-asset — never directly from the client.
revoke all on function public.edit_long_form_reference_asset(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.edit_long_form_reference_asset(uuid,uuid,text) to service_role;
