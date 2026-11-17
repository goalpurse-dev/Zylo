-- Rollback of 20261217110000_affiliate_onboarding_followup.sql: back to the first affiliate_claim (no platform, no
-- same-IP credit cooldown) and no rate limit. Deploy the matching affiliate-api first, or claims fail until you do.
drop function if exists public.affiliate_claim(uuid, text, text, text, integer, integer, boolean, boolean, integer, text, integer);
drop function if exists public.affiliate_rate_ok(text[], integer, integer);
drop table if exists public.affiliate_rate_events;
alter table public.referrals drop column if exists platform;
-- then re-run the affiliate_claim part of 20261217100000_affiliate_program.sql
notify pgrst, 'reload schema';
