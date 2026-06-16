-- Insert the affiliate plan into app_plans with starter-equivalent features.
-- Affiliates get credits granted manually; no Stripe subscription required.
INSERT INTO public.app_plans (code, name, features)
VALUES (
  'affiliate',
  'Affiliate',
  '{
    "tools": {
      "photos": true,
      "t2i:v2": true,
      "t2i:v3": true,
      "t2i:v4": true,
      "ads:sora": false,
      "ads:veo-3.1-fast": true
    },
    "daily_job_limit": 30,
    "brands_max": 2,
    "products_per_brand_max": 2,
    "avatars_max": 5,
    "queue": "standard"
  }'::jsonb
)
ON CONFLICT (code) DO UPDATE
  SET name     = EXCLUDED.name,
      features = EXCLUDED.features;
