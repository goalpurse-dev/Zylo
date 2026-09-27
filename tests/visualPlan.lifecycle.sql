-- Transaction-only tests: same existing unclaimed row; no provider, new version, Script mutation or committed claim.
do $$
declare source public.long_form_visual_plan_versions; claimed public.long_form_visual_plan_versions; next_claim public.long_form_visual_plan_versions;
  owner_id uuid; a public.long_form_visual_plan_versions; b public.long_form_visual_plan_versions;
begin
  select * into source from public.long_form_visual_plan_versions where id='eb25a8ee-9785-4b16-9e48-0a44c723d2a0' for update;
  if source.status<>'planning' or source.stage_attempt<>0 then raise exception 'Expected unclaimed test target'; end if;
  select * into claimed from public.claim_long_form_visual_plan_stage_by_id(source.id);
  assert claimed.id=source.id and claimed.stage_attempt=1, 'same row + atomic attempt';
  assert claimed.stage_started_at is not null and claimed.workflow_started_at=claimed.stage_started_at and claimed.worker_lock_until>now(), 'claim timestamps';
  assert not exists(select 1 from public.claim_long_form_visual_plan_stage_by_id(source.id)), 'active lease prevents duplicates';
  update public.long_form_visual_plan_versions set worker_lock_until=now()-interval '1 second' where id=source.id;
  select * into next_claim from public.claim_long_form_visual_plan_stage_by_id(source.id);
  assert next_claim.id=source.id and next_claim.stage_attempt=2 and next_claim.workflow_started_at=claimed.workflow_started_at, 'expired lease same row + preserved clock';
  update public.long_form_visual_plan_versions set meta='{"providerCallLimit":1}' where id=source.id;
  assert public.reserve_visual_plan_provider_call(source.id,next_claim.stage_started_at), 'first paid reservation';
  assert not public.reserve_visual_plan_provider_call(source.id,next_claim.stage_started_at), 'one-call ceiling';
  select user_id into owner_id from public.long_form_projects where id=source.project_id;
  a:=public.start_visual_plan_version(source.project_id,owner_id,false);
  b:=public.start_visual_plan_version(source.project_id,owner_id,true);
  assert a.id=source.id and b.id=source.id, 'refresh + regenerate double Start return same active row';
  update public.long_form_visual_plan_versions set stage_attempt=3,worker_lock_until=now()-interval '1 second' where id=source.id;
  assert not exists(select 1 from public.claim_long_form_visual_plan_stage_by_id(source.id)), 'max attempts stop';
  assert (select status='failed' from public.long_form_visual_plan_versions where id=source.id), 'exhausted row terminal';
  assert not has_function_privilege('anon','public.reserve_visual_plan_provider_call(uuid,timestamptz)','EXECUTE'), 'reservation private';
  assert not has_function_privilege('authenticated','public.claim_long_form_visual_plan_stage_by_id(uuid)','EXECUTE'), 'worker claim private';
end $$;
select 'Visual Plan claim, lease, timestamp, max-attempt, one-call and duplicate-start assertions passed' as result;
