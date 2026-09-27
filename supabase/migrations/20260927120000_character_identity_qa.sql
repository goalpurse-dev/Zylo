-- Character-reference architecture redesign: separates GENERATION status
-- (already existed: pending/running/succeeded/failed) from QA/approval
-- status. "Ready" must mean "provider returned an ACCEPTABLE reference",
-- not merely "provider returned an image". qa_status is nullable and left
-- null for every pre-existing row (Part 13 compatibility) and any role the
-- QA gate doesn't cover — only an explicit 'pending'/'rejected' value ever
-- excludes a row; a null qa_status is treated as legacy-approved everywhere
-- this is checked (see referenceRendererPolicy.js's canonicalReference and
-- accepted_reference_identity below).
alter table public.long_form_reference_assets
  add column qa_status text,
  add column qa_result jsonb,
  add column qa_attempts integer not null default 0,
  add column fallback_of_asset_id uuid references public.long_form_reference_assets(id);

alter table public.long_form_reference_assets add constraint reference_qa_status_valid
  check (qa_status is null or qa_status in ('pending','approved','rejected'));

-- Records one Character Pack QA verdict. Only callable against a terminal
-- (succeeded) generation — QA judges a real image, never a queued/failed
-- slot. security definer / service_role only: this is worker-invoked, not
-- user-facing (mirrors every other Visual World RPC in this file's own
-- migration family).
create or replace function public.record_reference_qa_result(p_asset_id uuid, p_approved boolean, p_qa_result jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare a public.long_form_reference_assets;
begin
  select * into a from public.long_form_reference_assets where id = p_asset_id for update;
  if not found then raise exception 'REFERENCE_NOT_FOUND'; end if;
  if a.status <> 'succeeded' then raise exception 'TERMINAL_GENERATION_REQUIRED'; end if;
  update public.long_form_reference_assets
  set qa_status = case when p_approved then 'approved' else 'rejected' end,
      qa_result = p_qa_result, qa_attempts = a.qa_attempts + 1, updated_at = now()
  where id = p_asset_id;
  return p_approved;
end $$;
revoke all on function public.record_reference_qa_result(uuid, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.record_reference_qa_result(uuid, boolean, jsonb) to service_role;

-- accepted_reference_identity is the single choke point every geometry-role
-- dispatch (Profile/Back edit jobs) and the Face crop both go through
-- (enqueue_long_form_reference_job, claim_long_form_reference_asset_for_
-- version) — adding the qa_status check here closes the gate everywhere at
-- once rather than needing to touch every caller. A master sitting in
-- qa_status='pending' review no longer counts as an accepted identity, so
-- nothing derives from an unreviewed master; a 'rejected' master is
-- excluded the same way a 'rejected' qa_expectations.reviewStatus already
-- was for the legacy turnaround/experiment rows.
create or replace function public.accepted_reference_identity(p_world uuid,p_entity text)
returns uuid language sql stable set search_path='' as $$
 select a.id from public.long_form_reference_assets a
 where a.visual_world_version_id=p_world and a.entity_id=p_entity
 and a.reference_type='character_reference' and a.angle_or_view='three_quarter_neutral'
 and a.status='succeeded' and a.result_url is not null
 and a.generation_type='provider'
 and coalesce(a.qa_expectations->>'reviewStatus','approved')='approved'
 and (a.qa_status is null or a.qa_status='approved')
 and not exists(select 1 from public.long_form_reference_assets n where n.replaces_asset_id=a.id
   and n.generation_type<>'turnaround_master' and coalesce(n.qa_expectations->>'reviewStatus','approved')<>'rejected')
 order by a.created_at desc limit 1
$$;
revoke all on function public.accepted_reference_identity(uuid,text) from public,anon,authenticated;
grant execute on function public.accepted_reference_identity(uuid,text) to service_role;
