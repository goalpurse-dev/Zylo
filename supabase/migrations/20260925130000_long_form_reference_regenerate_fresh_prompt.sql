-- Real incident: clicking Regenerate on a reference created a replacement
-- row that copied the SUPERSEDED asset's own prompt_snapshot verbatim
-- (this function's original design intent, per its own comment — "what a
-- Regenerate reuses"). That was harmless before the reference-contract
-- patch (20260925120000): an old prompt just rendered in the old style.
-- After that patch added validateCompiledReferencePrompt as a real safety
-- net, it became actively harmful — stageGenerating's own
-- `asset.prompt_snapshot || compileReferencePrompt(...)` trusted the
-- copied-forward OLD prompt (compiled under the pre-patch contract, so
-- missing the new required framing phrases), the validator correctly
-- rejected it, and the whole stage threw AFTER the asset was already
-- claimed — stranding it at status='running' with job_id still null
-- forever (real asset a5fd4c3c-b1d7-4fea-80a6-898132bd54ae, entity
-- e_protagonist, three_quarter_neutral).
--
-- Regenerate's actual, correct semantics — and what item 11 of this
-- incident's own task explicitly wants verified — is "a fresh attempt from
-- the CURRENT canonical spec," never a frozen replay of whatever prompt
-- text existed when the superseded asset was first created. Dropping
-- prompt_snapshot from the copied columns means the new row starts null,
-- so stageGenerating's own `||` naturally recompiles fresh via
-- compileReferencePrompt — no JS-side change needed, this was purely a
-- stale-data problem at the one place that created it.
create or replace function public.replace_long_form_reference_asset(p_asset_id uuid, p_user_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare a public.long_form_reference_assets; v public.long_form_visual_world_versions; replacement_id uuid; owner_id uuid;
begin
  select * into a from public.long_form_reference_assets where id=p_asset_id;
  if not found then raise exception 'REFERENCE_NOT_FOUND'; end if;
  select * into v from public.long_form_visual_world_versions where id=a.visual_world_version_id for update;
  select user_id into owner_id from public.long_form_projects where id=v.project_id;
  if owner_id is distinct from p_user_id then raise exception 'FORBIDDEN'; end if;
  select * into a from public.long_form_reference_assets where id=p_asset_id for update;
  select id into replacement_id from public.long_form_reference_assets where replaces_asset_id=a.id;
  if replacement_id is not null then return replacement_id; end if;
  if a.status not in ('succeeded','failed') then raise exception 'ALREADY_IN_PROGRESS'; end if;
  if v.worker_lock_until > now() then raise exception 'WORLD_BUSY'; end if;
  if v.stage='planning' or exists(select 1 from public.long_form_visual_world_versions other where other.project_id=v.project_id and other.id<>v.id and other.status in ('planning','generating')) then raise exception 'WORLD_BUSY'; end if;
  insert into public.long_form_reference_assets(visual_world_version_id,entity_id,reference_type,angle_or_view,replaces_asset_id,render_model)
  values(a.visual_world_version_id,a.entity_id,a.reference_type,a.angle_or_view,a.id,a.render_model) returning id into replacement_id;
  update public.long_form_visual_world_versions set status='generating',stage='generating',stage_attempt=0,worker_lock_until=null,last_error_code=null,updated_at=now() where id=v.id;
  return replacement_id;
end $$;
revoke all on function public.replace_long_form_reference_asset(uuid,uuid) from public,anon,authenticated;
grant execute on function public.replace_long_form_reference_asset(uuid,uuid) to service_role;
