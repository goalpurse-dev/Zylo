-- Global feature switches that take effect without a redeploy.
--
-- fruit_v2 = true: everyone (guests included) gets the new AI Fruit Story;
-- false: back to the old tool for everyone except users with the per-user
-- fruit_v2 flag (public.user_feature_flags). The browser reads this table on
-- page load (anon + authenticated SELECT); nothing in the browser can write
-- (no write grant, no write policy). Flip it with SQL only:
--   UPDATE public.global_feature_flags SET enabled = false, updated_at = now() WHERE key = 'fruit_v2';  -- old tool
--   UPDATE public.global_feature_flags SET enabled = true,  updated_at = now() WHERE key = 'fruit_v2';  -- new tool
-- Rollback: DROP TABLE public.global_feature_flags;

BEGIN;
SET LOCAL lock_timeout = '10s';

CREATE TABLE IF NOT EXISTS public.global_feature_flags (
  key        text PRIMARY KEY,
  enabled    boolean NOT NULL,
  note       text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.global_feature_flags IS
  'Global feature switches read by the browser on page load. Anyone can read; only SQL/service_role can write.';

ALTER TABLE public.global_feature_flags ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.global_feature_flags FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.global_feature_flags TO anon, authenticated;
GRANT ALL ON public.global_feature_flags TO service_role;

DROP POLICY IF EXISTS global_feature_flags_read ON public.global_feature_flags;
CREATE POLICY global_feature_flags_read
  ON public.global_feature_flags
  FOR SELECT
  TO anon, authenticated
  USING (true);

INSERT INTO public.global_feature_flags (key, enabled, note)
VALUES ('fruit_v2', true, 'AI Fruit Story v2 for everyone. false = old tool (per-user fruit_v2 flags still get v2).')
ON CONFLICT (key) DO NOTHING;

COMMIT;
