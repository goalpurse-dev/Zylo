-- 2026-10-02 "one project commitment" pass — Section 6/7/8.
--
-- The credit ledger investigation (see the accompanying report) found NO
-- existing true reservation/hold semantics in Long Form — every charge RPC
-- debits the exact computed amount immediately. The one real, proven
-- "estimate an upper bound, debit it now, refund the unused portion later"
-- pattern in this codebase is 30 Days' begin_thirty_days_generation /
-- settle_thirty_days_generation. This migration adapts that SAME shape as
-- its own small, standalone table (never a second unrelated wallet — reads
-- and writes the exact same public.profiles.credit_balance /
-- credits_spent_today columns every other Zyvo product already uses),
-- following Long Form's OWN established `SELECT ... FOR UPDATE` + direct
-- balance-math convention (not deduct_credits — Long Form's other billing
-- RPCs never call it either, for consistency with its siblings).
--
-- Scope: ONE reservation covers the WHOLE project commitment (research +
-- story + narration + visuals), not just scene rendering — broader than
-- long_form_episode_generation_charges' existing scope, so this is
-- deliberately a NEW, sibling concept rather than an overload of
-- active_generation_charge_id (which stays exactly what it already means:
-- the current episode/chapter scene-generation charge).

create table if not exists public.long_form_project_reservations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.long_form_projects(id) on delete cascade,
  generation_profile_id uuid not null references public.long_form_generation_profiles(id),
  user_id uuid not null,
  status text not null default 'reserved' check (status in ('reserved', 'settled', 'released')),
  reserved_credits integer not null check (reserved_credits >= 0),
  committed_credits integer not null default 0 check (committed_credits >= 0),
  released_credits integer not null default 0 check (released_credits >= 0),
  -- The quote's own itemization, shown to the user at commitment time and
  -- kept for audit — e.g. {"research": 40, "narration": 60, "visuals": 500, "qaRetryAllowance": 20}.
  breakdown jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  constraint long_form_project_reservations_committed_within_reserved check (committed_credits <= reserved_credits)
);

-- At most one ACTIVE (status='reserved') reservation per project — the
-- structural guarantee that a double-click on "Create Video" can never
-- reserve twice, mirroring long_form_episode_generation_charges' own
-- "one active charge per project" partial unique index exactly.
create unique index if not exists long_form_project_reservations_one_active_per_project
  on public.long_form_project_reservations(project_id) where status = 'reserved';
create index if not exists long_form_project_reservations_project
  on public.long_form_project_reservations(project_id, created_at desc);

alter table public.long_form_project_reservations enable row level security;
revoke all on public.long_form_project_reservations from public, anon, authenticated;
create policy "Users can view their own project's reservations" on public.long_form_project_reservations
  for select using (exists (select 1 from public.long_form_projects p where p.id = long_form_project_reservations.project_id and p.user_id = auth.uid()));

-- Idempotent by construction: idempotency_key is deterministic from
-- (project_id, generation_profile_id) — a retried/double-clicked "Create
-- Video" for the SAME profile finds the existing row via ON CONFLICT and
-- returns it unchanged, never reserving twice. A DIFFERENT profile (the
-- user changed Setup and tried again) gets its own fresh idempotency key,
-- which is correct — that's a genuinely new commitment.
create or replace function public.reserve_long_form_project_credits(
  p_project_id uuid, p_user_id uuid, p_generation_profile_id uuid, p_reserved_credits integer, p_breakdown jsonb
) returns public.long_form_project_reservations
language plpgsql security definer set search_path = '' as $$
declare
  proj public.long_form_projects;
  existing public.long_form_project_reservations;
  active public.long_form_project_reservations;
  balance integer;
  idem_key text;
  new_row public.long_form_project_reservations;
begin
  select * into proj from public.long_form_projects where id = p_project_id for update;
  if not found then raise exception 'PROJECT_NOT_FOUND'; end if;
  if proj.user_id is distinct from p_user_id then raise exception 'FORBIDDEN'; end if;
  if p_reserved_credits <= 0 then raise exception 'INVALID_RESERVATION_AMOUNT'; end if;

  idem_key := p_project_id::text || ':reservation:' || p_generation_profile_id::text;
  select * into existing from public.long_form_project_reservations where idempotency_key = idem_key;
  if existing.id is not null then return existing; end if;

  -- Only one ACTIVE reservation per project is structurally allowed (the
  -- unique index above) — a project with an existing 'reserved' row for a
  -- DIFFERENT profile must settle/release it first (an explicit, separate
  -- decision — see Section J: "changing this setting requires
  -- regenerating downstream stages," never a silent supersede of real
  -- reserved money).
  select * into active from public.long_form_project_reservations where project_id = p_project_id and status = 'reserved' for update;
  if active.id is not null then raise exception 'RESERVATION_ALREADY_ACTIVE_FOR_DIFFERENT_PROFILE'; end if;

  select credit_balance into balance from public.profiles where id = p_user_id for update;
  if balance is null or balance < p_reserved_credits then raise exception 'INSUFFICIENT_CREDITS'; end if;
  update public.profiles set credit_balance = credit_balance - p_reserved_credits, credits_spent_today = coalesce(credits_spent_today, 0) + p_reserved_credits where id = p_user_id;

  insert into public.long_form_project_reservations (project_id, generation_profile_id, user_id, reserved_credits, breakdown, idempotency_key)
  values (p_project_id, p_generation_profile_id, p_user_id, p_reserved_credits, coalesce(p_breakdown, '{}'::jsonb), idem_key)
  returning * into new_row;
  return new_row;
end $$;
revoke all on function public.reserve_long_form_project_credits(uuid, uuid, uuid, integer, jsonb) from public, anon, authenticated;
grant execute on function public.reserve_long_form_project_credits(uuid, uuid, uuid, integer, jsonb) to authenticated, service_role;

-- The one function every stage-level charge point calls INSTEAD OF
-- debiting the balance directly. Returns 'NO_RESERVATION' when the project
-- has no active reservation (the caller must then fall back to its own
-- normal direct-debit behavior — this is what makes wiring this into
-- existing charge RPCs an ADDITIVE, non-breaking change for every project
-- that isn't using the new flow). Returns 'COMMITTED' on success. Raises
-- RESERVATION_CEILING_EXCEEDED — never silently drawing more from the
-- user's real balance — when committing would exceed the reservation's own
-- upper bound; the caller must then pause and ask the user to authorize
-- more, exactly per Section 7's explicit instruction.
create or replace function public.commit_long_form_reservation_spend(p_project_id uuid, p_amount integer)
returns text language plpgsql security definer set search_path = '' as $$
declare active public.long_form_project_reservations;
begin
  if p_amount < 0 then raise exception 'INVALID_COMMIT_AMOUNT'; end if;
  if p_amount = 0 then return 'COMMITTED'; end if;

  select * into active from public.long_form_project_reservations where project_id = p_project_id and status = 'reserved' for update;
  if not found then return 'NO_RESERVATION'; end if;

  if active.committed_credits + p_amount > active.reserved_credits then
    raise exception 'RESERVATION_CEILING_EXCEEDED: reservation % has % of % remaining, cannot commit %',
      active.id, active.reserved_credits - active.committed_credits, active.reserved_credits, p_amount;
  end if;

  update public.long_form_project_reservations set committed_credits = committed_credits + p_amount where id = active.id;
  return 'COMMITTED';
end $$;
revoke all on function public.commit_long_form_reservation_spend(uuid, integer) from public, anon, authenticated;
grant execute on function public.commit_long_form_reservation_spend(uuid, integer) to service_role;

-- Releases whatever fraction of the reservation was never committed —
-- called once the whole project reaches a terminal state (video complete,
-- or abandoned before anything was spent). Idempotent: settling an
-- already-settled/released reservation is a harmless no-op, never a double
-- refund.
create or replace function public.settle_long_form_reservation(p_reservation_id uuid, p_user_id uuid)
returns public.long_form_project_reservations
language plpgsql security definer set search_path = '' as $$
declare res public.long_form_project_reservations; refund integer;
begin
  select * into res from public.long_form_project_reservations where id = p_reservation_id for update;
  if not found then raise exception 'RESERVATION_NOT_FOUND'; end if;
  if res.user_id is distinct from p_user_id then raise exception 'FORBIDDEN'; end if;
  if res.status <> 'reserved' then return res; end if;

  refund := res.reserved_credits - res.committed_credits;
  if refund > 0 then
    update public.profiles set credit_balance = credit_balance + refund, credits_spent_today = greatest(0, coalesce(credits_spent_today, 0) - refund) where id = res.user_id;
  end if;

  update public.long_form_project_reservations set status = 'settled', released_credits = refund, settled_at = now() where id = p_reservation_id returning * into res;
  return res;
end $$;
revoke all on function public.settle_long_form_reservation(uuid, uuid) from public, anon, authenticated;
grant execute on function public.settle_long_form_reservation(uuid, uuid) to authenticated, service_role;

-- Full release — the project was abandoned/failed before committing
-- anything meaningful (or the user explicitly cancels). Same refund
-- mechanics as settle, distinct status for reporting/analytics honesty
-- ("the user got a full refund" vs "the project actually ran and settled").
create or replace function public.release_long_form_reservation(p_reservation_id uuid, p_user_id uuid)
returns public.long_form_project_reservations
language plpgsql security definer set search_path = '' as $$
declare res public.long_form_project_reservations; refund integer;
begin
  select * into res from public.long_form_project_reservations where id = p_reservation_id for update;
  if not found then raise exception 'RESERVATION_NOT_FOUND'; end if;
  if res.user_id is distinct from p_user_id then raise exception 'FORBIDDEN'; end if;
  if res.status <> 'reserved' then return res; end if;

  refund := res.reserved_credits - res.committed_credits;
  if refund > 0 then
    update public.profiles set credit_balance = credit_balance + refund, credits_spent_today = greatest(0, coalesce(credits_spent_today, 0) - refund) where id = res.user_id;
  end if;

  update public.long_form_project_reservations set status = 'released', released_credits = refund, settled_at = now() where id = p_reservation_id returning * into res;
  return res;
end $$;
revoke all on function public.release_long_form_reservation(uuid, uuid) from public, anon, authenticated;
grant execute on function public.release_long_form_reservation(uuid, uuid) to authenticated, service_role;
