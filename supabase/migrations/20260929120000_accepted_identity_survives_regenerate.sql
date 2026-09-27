-- Real incident, reconstructed from actual Mars timestamps: the user
-- approved an Identity/Outfit sheet (99fea9d4), then clicked Regenerate.
-- The instant the new candidate row existed (qa_status still null, not yet
-- reviewed), accepted_reference_identity's old "not exists a newer
-- NON-REJECTED replacer" rule treated that in-flight candidate as
-- disqualifying the OLD APPROVED anchor — a ~19-second real window where
-- Face/Profile (had their rows existed) would have been wrongly blocked
-- despite a genuinely approved identity sitting right there in history.
-- Regenerating an accepted identity must never revoke it until the NEW
-- candidate is ALSO explicitly approved (Part 4): a row with
-- qa_status='approved' is now ALWAYS eligible regardless of whether a newer
-- non-approved candidate exists — `order by created_at desc limit 1` then
-- naturally promotes to the newest one once (and only once) IT is also
-- approved. This is a derived "accepted_asset_id" (always the most recent
-- qa_status='approved' row), not a separately stored pointer — avoids a
-- second piece of state that could itself drift out of sync.
--
-- The one race this closes on top of that: a BRAND NEW row can sit
-- status='succeeded', qa_status=null for the brief window between its own
-- job finishing and its own QA checkpoint recording a verdict (QA runs
-- synchronously in the same tick, so this window is normally milliseconds,
-- but a crash mid-tick could stretch it). Without a guard, that null-qa
-- window would make the new row look exactly like a "legacy, never-QA'd"
-- row and could win the `order by created_at desc` race against the truly
-- accepted older row. Once ANY row for this entity's identity-anchor angle
-- has ever recorded a real qa_status, a later null-qa_status row is no
-- longer trusted as "legacy approved" — it must earn its own qa_status.
create or replace function public.accepted_reference_identity(p_world uuid,p_entity text)
returns uuid language sql stable set search_path='' as $$
 select a.id from public.long_form_reference_assets a
 where a.visual_world_version_id=p_world and a.entity_id=p_entity
 and a.reference_type='character_reference' and a.angle_or_view in ('three_quarter_neutral','identity_outfit_sheet')
 and a.status='succeeded' and a.result_url is not null
 and a.generation_type='provider'
 and coalesce(a.qa_expectations->>'reviewStatus','approved')='approved'
 and (
   a.qa_status='approved'
   or (
     a.qa_status is null
     and not exists(select 1 from public.long_form_reference_assets n where n.replaces_asset_id=a.id
       and n.generation_type<>'turnaround_master' and coalesce(n.qa_expectations->>'reviewStatus','approved')<>'rejected')
     and not exists(select 1 from public.long_form_reference_assets q where q.visual_world_version_id=a.visual_world_version_id and q.entity_id=a.entity_id
       and q.angle_or_view in ('three_quarter_neutral','identity_outfit_sheet') and q.qa_status is not null)
   )
 )
 order by a.created_at desc limit 1
$$;
revoke all on function public.accepted_reference_identity(uuid,text) from public,anon,authenticated;
grant execute on function public.accepted_reference_identity(uuid,text) to service_role;
