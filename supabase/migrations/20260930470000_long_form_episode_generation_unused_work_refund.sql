-- 2026-09-21 EMERGENCY (Priority 2 — credit safety): the paused Sun
-- generation charged 459 credits upfront (153 freshGenerations x 3cr,
-- v3 tier; 34 REUSE + 27 PROGRAMMATIC_GRAPHIC entries are informational —
-- always 0 credits, never contributed to the total). 70 of the 153
-- GENERATE beats never had a job created for any of their attempt rows
-- (job_id null on every long_form_scenes row for that beat) — i.e. never
-- actually submitted to Runware — while the other 83 did (succeeded or
-- failed; either way a real paid provider call happened and that credit
-- was genuinely consumed, so it is deliberately NOT refunded here: "Do NOT
-- refund paid provider work that already completed/submitted"). EDIT/
-- REUSE/PROGRAMMATIC_GRAPHIC beats are excluded from this refund
-- entirely — they were charged 0 credits, so there is nothing to give
-- back for them.
--
-- This is a PARTIAL, per-charge refund, not the existing full 'charged' ->
-- 'refunded' status flip (which would incorrectly imply the ENTIRE charge,
-- including the 83 beats' worth of real consumed work, was refunded). Two
-- new columns track it distinctly and make the operation idempotent —
-- calling this twice for the same charge is a safe no-op the second time.

alter table public.long_form_episode_generation_charges
  add column if not exists credits_refunded int not null default 0,
  add column if not exists unused_work_refunded_at timestamptz;

-- Idempotent, callable any time a charge is paused (or otherwise stalled)
-- with GENERATE beats that never reached a provider. Computes the refund
-- from ACTUAL long_form_scenes/long_form_scene_render_plans state at call
-- time — never trusts a client-supplied count — and is safe to call more
-- than once: the second call finds unused_work_refunded_at already set and
-- returns the previously-computed amount unchanged, crediting nothing
-- further.
create or replace function public.refund_long_form_episode_generation_unused_work(p_charge_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  chg public.long_form_episode_generation_charges;
  never_submitted_beats int;
  per_generation_credits int;
  refund_amount int;
begin
  select * into chg from public.long_form_episode_generation_charges where id = p_charge_id for update;
  if not found then raise exception 'CHARGE_NOT_FOUND'; end if;

  if chg.unused_work_refunded_at is not null then
    return jsonb_build_object('alreadyRefunded', true, 'creditsRefunded', chg.credits_refunded, 'refundedAt', chg.unused_work_refunded_at);
  end if;

  -- A GENERATE beat counts as "never submitted" only if NONE of its
  -- long_form_scenes attempt rows (across every plan_version, including
  -- pre-rebuild ones) ever got a job_id — exactly mirroring the
  -- claim/enqueue gate's own "has this beat ever touched the provider"
  -- test, so this can never disagree with what actually happened.
  select count(*) into never_submitted_beats
  from (
    select sc.visual_beat_id
    from public.long_form_scenes sc
    join public.long_form_scene_render_plans rp on rp.id = sc.scene_render_plan_id
    where sc.generation_run_id = p_charge_id and rp.render_strategy = 'GENERATE'
    group by sc.visual_beat_id
    having bool_or(sc.job_id is not null) = false
  ) never_submitted;

  per_generation_credits := public.long_form_tier_generate_credits(chg.tier);
  refund_amount := never_submitted_beats * per_generation_credits;

  if refund_amount > 0 then
    update public.profiles set credit_balance = credit_balance + refund_amount, credits_spent_today = greatest(0, coalesce(credits_spent_today, 0) - refund_amount)
    where id = chg.user_id;
  end if;

  update public.long_form_episode_generation_charges
  set credits_refunded = refund_amount, unused_work_refunded_at = now()
  where id = p_charge_id;

  return jsonb_build_object('alreadyRefunded', false, 'creditsRefunded', refund_amount, 'neverSubmittedBeats', never_submitted_beats, 'creditsPerGenerate', per_generation_credits);
end $$;
revoke all on function public.refund_long_form_episode_generation_unused_work(uuid) from public, anon, authenticated;
grant execute on function public.refund_long_form_episode_generation_unused_work(uuid) to service_role;
