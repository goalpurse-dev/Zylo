-- Real incident, caught live during the controlled identity_outfit_side
-- test (third bug in this sequence, found AFTER the dual-reference fix
-- in 20260930130000): reference_geometry_role still hardcoded the OLD
-- sheet-taxonomy angle names ('profile','back') as the only Qwen/geometry
-- roles. The new component taxonomy's geometry roles
-- (identity_outfit_side, identity_outfit_back, face_side, face_back) were
-- never added, so enqueue_long_form_reference_job computed
-- expected_tk='image:flux2.klein9bkv' for identity_outfit_side instead of
-- the Qwen tool key, and the correctly-built Qwen job payload was
-- rejected with INVALID_REFERENCE_JOB before ever reaching Runware.
-- Reproduced directly via RPC call outside the worker to get the real
-- Postgres exception text (the "[object Object]" surfaced in
-- long_form_visual_world_versions.last_error_code is a separate,
-- pre-existing stringification bug in handleStageFailure that hides the
-- real message — noted for a future pass, not fixed here since it did
-- not block this diagnosis).
create or replace function public.reference_geometry_role(p_type text,p_angle text)
returns boolean language sql immutable set search_path='' as $$
 select p_type='character_reference' and p_angle=any(array[
   'profile','back',
   'identity_outfit_side','identity_outfit_back',
   'face_side','face_back'
 ])
$$;
revoke all on function public.reference_geometry_role(text,text) from public,anon,authenticated;
grant execute on function public.reference_geometry_role(text,text) to service_role;
