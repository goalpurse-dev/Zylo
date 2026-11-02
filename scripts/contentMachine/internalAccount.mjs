// The Content Machine's internal account (Phase 0 plan P5; owner's go 2026-10-30 for Studio M3): a real Zyvo user the
// machine records the real tools with. Idempotent: safe to run again.
//   1. every email to it is suppressed FIRST (email_suppressions: the gate refuses marketing AND app emails)
//   2. the user: confirmed, a random password nobody keeps, app_metadata.internal = true
//   3. profile: Starter plan (V2 Fruit needs a paid plan), email_updates off
//   4. credits: grant_credits_once (one grant per external id; CREDITS=<n> to choose, default 250)
//   node scripts/contentMachine/internalAccount.mjs            (prints the state; changes nothing without --apply)
import crypto from "node:crypto";
import { admin } from "file:///C:/Users/Public/Zylo/scripts/blocky/lib.mjs";

export const INTERNAL_EMAIL = "content-machine@tryzyvo.com";
const apply = process.argv.includes("--apply");
const credits = Number(process.env.CREDITS ?? 250);
const db = admin();
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data; };

async function state() {
  const sup = must(await db.from("email_suppressions").select("email, reason").eq("email", INTERNAL_EMAIL), "suppression");
  const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = (list?.users ?? []).find((u) => u.email === INTERNAL_EMAIL) ?? null;
  const profile = user ? must(await db.from("profiles").select("plan_code, email_updates, credit_balance").eq("id", user.id).maybeSingle(), "profile") : null;
  const bal = user ? must(await db.from("user_balances").select("credits").eq("user_id", user.id).maybeSingle(), "balance") : null;
  return { suppressed: sup.length > 0, user: user && { id: user.id, internal: user.app_metadata?.internal ?? false }, profile, balance: bal };
}

console.log("before:", JSON.stringify(await state()));
if (!apply) process.exit(0);

// 1. never email it (before the user exists, so not even a first email can go out). The table allows only
//    bounced / complained / invalid; "invalid" is true: the address has no inbox.
must(await db.from("email_suppressions").upsert({ email: INTERNAL_EMAIL, reason: "invalid", source: "content-machine internal account (no inbox): never email" }, { onConflict: "email" }), "suppress");
// 2. the user
let s = await state();
let uid = s.user?.id;
if (!uid) {
  const r = await db.auth.admin.createUser({ email: INTERNAL_EMAIL, password: crypto.randomBytes(32).toString("base64url"), email_confirm: true, app_metadata: { internal: true, purpose: "content-machine" }, user_metadata: { full_name: "Content Machine (internal)" } });
  uid = must(r, "create user").user.id;
}
// 3. Starter plan, no marketing
must(await db.from("profiles").update({ plan_code: "starter", email_updates: false }).eq("id", uid).select("id"), "profile");
// 4. credits, once per external id
must(await db.rpc("grant_credits_once", { p_user_id: uid, p_amount: credits, p_reason: "content machine internal account (Studio videos)", p_external_id: "cm-internal-studio-m3" }), "credits");
console.log("after:", JSON.stringify(await state()));
