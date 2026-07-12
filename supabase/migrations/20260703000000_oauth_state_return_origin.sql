-- Add return_to_origin to social_oauth_states so callbacks can redirect back
-- to the origin that initiated the flow (supports localhost dev + production).
alter table public.social_oauth_states
  add column if not exists return_to_origin text;
