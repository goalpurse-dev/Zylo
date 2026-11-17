-- Rollback of 20261217100000_affiliate_program.sql. DELETES all affiliate data (codes, clicks, referrals,
-- commissions, payout records). Credits already granted (bonus or credit commissions) stay on the accounts.
-- Deploy the previous stripe-webhook first, or leave it: without these functions it skips the affiliate step.
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'affiliate-release';
  end if;
end $$;
drop function if exists public.affiliate_join(uuid, text[], text, numeric, numeric, text);
drop function if exists public.affiliate_set_code(uuid, text, boolean, integer);
drop function if exists public.affiliate_claim(uuid, text, text, text, integer, integer, boolean, boolean, integer);
drop function if exists public.affiliate_record_payment(uuid, text, text, integer, text, text, timestamptz, integer, integer, boolean);
drop function if exists public.affiliate_reverse_payment(text, text, text);
drop function if exists public.affiliate_release_due(uuid);
drop function if exists public.affiliate_mark_paid(uuid, integer, text, text);
drop function if exists public.affiliate_resolve_flag(uuid, boolean, integer, boolean);
drop function if exists public.affiliate_stats(uuid);
drop table if exists public.commissions;
drop table if exists public.payouts;
drop table if exists public.referrals;
drop table if exists public.referral_clicks;
drop table if exists public.affiliates;
notify pgrst, 'reload schema';
