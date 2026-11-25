-- Rollback of 20261218100000_rewards.sql. DELETES submissions, invite codes and invites. Credits already given stay.
-- Deploy a stripe-webhook without the rewards step first, or leave it: without these functions it skips the step.
drop function if exists public.rewards_submit(uuid, text, text, text, bigint, integer);
drop function if exists public.rewards_recheck(uuid, uuid, bigint);
drop function if exists public.rewards_review(uuid, boolean, bigint, integer, text, text);
drop function if exists public.rewards_invite_code(uuid, text);
drop function if exists public.rewards_claim_invite(uuid, text, text, integer);
drop function if exists public.rewards_record_payment(uuid, text, text, integer, integer, integer, integer, text[]);
drop function if exists public.rewards_reverse_payment(text, text, integer, text);
drop function if exists public.rewards_cancel_invite(uuid, text);
drop function if exists public.rewards_take_back(uuid, text, text);
drop table if exists public.invites;
drop table if exists public.invite_codes;
drop table if exists public.reward_submissions;
notify pgrst, 'reload schema';
