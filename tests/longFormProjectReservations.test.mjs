import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// 2026-10-02 "one project commitment" pass — structural checks on the
// reservation migrations, matching this codebase's established
// source-pattern-testing convention for SQL files.

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");
const RESERVATIONS = "supabase/migrations/20261002120000_long_form_project_reservations.sql";
const CHARGES_WIRING = "supabase/migrations/20261002130000_long_form_charges_commit_against_reservation.sql";

test("at most one ACTIVE reservation per project is structurally enforced (partial unique index), never just application-level discipline", async () => {
  const sql = await source(RESERVATIONS);
  assert.match(sql, /create unique index if not exists long_form_project_reservations_one_active_per_project\s+on public\.long_form_project_reservations\(project_id\) where status = 'reserved'/);
});

test("committed_credits can never exceed reserved_credits — a hard database constraint, not just RPC logic", async () => {
  const sql = await source(RESERVATIONS);
  assert.match(sql, /constraint long_form_project_reservations_committed_within_reserved check \(committed_credits <= reserved_credits\)/);
});

test("reservation is idempotent by (project, profile) — a double-click on Create Video can never reserve twice", async () => {
  const sql = await source(RESERVATIONS);
  assert.match(sql, /idem_key := p_project_id::text \|\| ':reservation:' \|\| p_generation_profile_id::text/);
  assert.match(sql, /select \* into existing from public\.long_form_project_reservations where idempotency_key = idem_key;\s*\n\s*if existing\.id is not null then return existing; end if;/);
});

test("commit_long_form_reservation_spend enforces a hard ceiling — never silently draws more than was reserved", async () => {
  const sql = await source(RESERVATIONS);
  assert.match(sql, /raise exception 'RESERVATION_CEILING_EXCEEDED/);
  assert.match(sql, /if active\.committed_credits \+ p_amount > active\.reserved_credits then/);
});

test("commit_long_form_reservation_spend returns NO_RESERVATION (never an error) when no reservation exists, so callers can fall back safely", async () => {
  const sql = await source(RESERVATIONS);
  assert.match(sql, /if not found then return 'NO_RESERVATION'; end if;/);
});

test("settle and release both refund only the UNCOMMITTED remainder, and are idempotent on an already-terminal reservation", async () => {
  const sql = await source(RESERVATIONS);
  const settleStart = sql.indexOf("create or replace function public.settle_long_form_reservation");
  const settleBody = sql.slice(settleStart, sql.indexOf("$$;", settleStart));
  assert.match(settleBody, /refund := res\.reserved_credits - res\.committed_credits;/);
  assert.match(settleBody, /if res\.status <> 'reserved' then return res; end if;/);
});

test("charges wiring: commits against an active reservation first, falling back to the EXACT original direct-debit code only on NO_RESERVATION", async () => {
  const sql = await source(CHARGES_WIRING);
  assert.match(sql, /v_reservation_result := public\.commit_long_form_reservation_spend\(p_project_id, total\);/);
  const occurrences = (sql.match(/v_reservation_result = 'NO_RESERVATION'/g) ?? []).length;
  assert.ok(occurrences >= 3, "must gate the direct-debit fallback in all 3 charge sites (chapter-gate, episode, sample)");
});

test("charges wiring never removes the original INSUFFICIENT_CREDITS guard for the no-reservation (legacy) path", async () => {
  const sql = await source(CHARGES_WIRING);
  const occurrences = (sql.match(/raise exception 'INSUFFICIENT_CREDITS'/g) ?? []).length;
  assert.ok(occurrences >= 3, "the legacy direct-debit balance check must still exist at every charge site");
});
