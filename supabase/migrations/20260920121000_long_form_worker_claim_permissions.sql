-- Preserve the original worker-only contract even when project default
-- privileges explicitly grant EXECUTE to anon/authenticated (PUBLIC revoke
-- alone does not remove those grants).
revoke all on function public.claim_long_form_reference_asset(uuid) from public,anon,authenticated;
revoke all on function public.claim_long_form_reference_assets(integer) from public,anon,authenticated;
revoke all on function public.claim_long_form_visual_world_stage(integer) from public,anon,authenticated;
revoke all on function public.claim_long_form_visual_world_stage_by_id(uuid) from public,anon,authenticated;
grant execute on function public.claim_long_form_reference_asset(uuid) to service_role;
grant execute on function public.claim_long_form_reference_assets(integer) to service_role;
grant execute on function public.claim_long_form_visual_world_stage(integer) to service_role;
grant execute on function public.claim_long_form_visual_world_stage_by_id(uuid) to service_role;
