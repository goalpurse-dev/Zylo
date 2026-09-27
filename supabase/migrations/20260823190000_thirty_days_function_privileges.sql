-- Supabase projects can carry explicit default EXECUTE grants for anon and
-- authenticated. Clear those role grants explicitly; revoking from PUBLIC
-- alone does not remove a grant made directly to either API role.

REVOKE ALL ON FUNCTION public.begin_thirty_days_generation(text, boolean, text, jsonb, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.begin_thirty_days_generation(uuid, text, boolean, text, jsonb, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.authorize_thirty_days_asset_job(uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.sync_thirty_days_generation_assets(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_thirty_days_scene_qa(uuid, integer, uuid, boolean, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_thirty_days_generation(uuid, integer, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_thirty_days_generation(uuid)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.begin_thirty_days_generation(uuid, text, boolean, text, jsonb, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.authorize_thirty_days_asset_job(uuid, text, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_thirty_days_generation_assets(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_thirty_days_scene_qa(uuid, integer, uuid, boolean, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.settle_thirty_days_generation(uuid)
  TO authenticated;
