-- Follow-up to 20260918120000: advance-long-form-visual-world's "generating"
-- stage needs to claim one reference asset SCOPED TO ITS OWN visual world
-- version (never a global sweep from inside a single version's own
-- invocation — that's what claim_long_form_reference_assets, the cron-style
-- sweep, is for). Same atomic contract: increments claim_attempts and
-- assigns a lease in one UPDATE, before any Runware call is even
-- considered, ordered so pending work is claimed before reclaiming
-- previously-abandoned work.
create or replace function public.claim_long_form_reference_asset_for_version(p_visual_world_version_id uuid)
returns setof public.long_form_reference_assets
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.long_form_reference_assets a
  set status = 'running',
      claim_attempts = a.claim_attempts + 1,
      lease_until = now() + interval '3 minutes',
      updated_at = now()
  from (
    select id from public.long_form_reference_assets
    where visual_world_version_id = p_visual_world_version_id
      and claim_attempts < 3
      and (status = 'pending' or (status = 'running' and lease_until < now()))
    order by (status = 'pending') desc, created_at
    limit 1
    for update skip locked
  ) due
  where a.id = due.id
  returning a.*;
end;
$$;

revoke all on function public.claim_long_form_reference_asset_for_version(uuid) from public;
grant execute on function public.claim_long_form_reference_asset_for_version(uuid) to service_role;
