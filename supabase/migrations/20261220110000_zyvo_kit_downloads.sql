-- THE ZYVO STUDIO KIT downloads (docs/zyvo-studio-kit-plan.md C1: "login required, downloads are counted").
-- Safe on live: one new table, service-role only (RLS on, no policies). The zyvo-mcp function writes one row per
-- download (POST /account/kit); run AFTER 20261220100000_zyvo_mcp.sql.
BEGIN;

CREATE TABLE IF NOT EXISTS public.zyvo_kit_downloads (
  id         bigserial PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  version    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS zyvo_kit_downloads_user ON public.zyvo_kit_downloads (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS zyvo_kit_downloads_time ON public.zyvo_kit_downloads (created_at DESC);
ALTER TABLE public.zyvo_kit_downloads ENABLE ROW LEVEL SECURITY;

COMMIT;
