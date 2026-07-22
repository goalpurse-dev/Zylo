-- Add refresh token storage columns to social_accounts.
-- refresh_token_encrypted: stores the encrypted Google refresh token (YouTube OAuth).
--   Nullable so existing Instagram rows are unaffected.
-- refresh_token_expires_at: Google refresh tokens don't typically expire, but
--   stored for future-proofing (e.g. token rotation policies).
alter table public.social_accounts
  add column if not exists refresh_token_encrypted    text,
  add column if not exists refresh_token_expires_at   timestamptz;
