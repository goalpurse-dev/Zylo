// Who may ask Blocky's live API for what, by plan (owner, 2026-10-09). Free: paid calls must be OFF, so a
// request that passes the plan check stops at the paid switch ("PAID_CALLS_DISABLED") before any model is
// called. It writes nothing but a throwaway account with Blocky's switch on, whose plan is changed four
// times and which is deleted at the end.
//   free        ideas pass the plan check; three versions are refused (Starter needed)
//   starter     V2 passes; V3 and V4 are refused
//   pro         V2 and V3 pass; V4 is refused
//   generative  all three pass
//   signed out  everything is refused (the avatar library opens only once Blocky is on for everyone)
//   node scripts/blocky/planGateCheck.mjs
import { SUPABASE_URL, TEST_EMAIL, admin, anonKey, api, userSession } from "./lib.mjs";

const db = admin();
const results = [];
const ok = (name, pass, detail = "") => { results.push(Boolean(pass)); console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); };

const settings = (await db.from("blocky_settings").select("paid_calls").eq("id", true).single()).data;
if (settings?.paid_calls) { console.error("Paid calls are ON. Switch them off first (node scripts/blocky/paid.mjs off): this check must not reach a model."); process.exit(1); }

const owner = await userSession(TEST_EMAIL);
const library = await api(owner.accessToken, "listCharacters");
const castIds = library.data.slice(0, 2).map((c) => c.id);
const draft = (quality) => ({ input: { source: "prompt", prompt: "A new player trades a starter pet for the rarest item, and the pet turns out to own the server.", castIds, quality, lengthSec: 30, aspect: "9:16" } });
const PASSED = "PAID_CALLS_DISABLED";   // the plan check let it through; the paid switch (off) stopped it

const email = "upwardlift6+blockyplantest@gmail.com";
const made = await db.auth.admin.createUser({ email, password: `${crypto.randomUUID()}Aa1!`, email_confirm: true });
if (made.error) { console.error(`Couldn't make the throwaway account: ${made.error.message}`); process.exit(1); }
const userId = made.data.user.id;
try {
  const flag = await db.from("user_feature_flags").upsert({ user_id: userId, flags: { blocky_v1: true } }, { onConflict: "user_id" });
  if (flag.error) throw new Error(`the switch for the throwaway account: ${flag.error.message}`);
  const other = await userSession(email);
  const WANT = { free: { ideas: true, v2: false, v3: false, v4: false }, starter: { ideas: true, v2: true, v3: false, v4: false }, pro: { ideas: true, v2: true, v3: true, v4: false }, generative: { ideas: true, v2: true, v3: true, v4: true } };
  for (const [plan, want] of Object.entries(WANT)) {
    const set = await db.from("profiles").update({ plan_code: plan }).eq("id", userId).select("id");
    if (set.error || !set.data?.length) throw new Error(`set the plan to ${plan}: ${set.error?.message ?? "no profile row"}`);
    const ideas = await api(other.accessToken, "getIdeas", { seed: 1 });
    ok(`${plan}: ideas pass the plan check`, ideas.code === PASSED, `${ideas.code}`);
    for (const tier of ["v2", "v3", "v4"]) {
      const r = await api(other.accessToken, "startDraft", draft(tier));
      if (want[tier]) ok(`${plan}: three versions on ${tier.toUpperCase()} pass the plan check`, r.code === PASSED, `${r.code}`);
      else ok(`${plan}: three versions on ${tier.toUpperCase()} are refused before anything is written or charged`, r.code === "PLAN_UPGRADE_REQUIRED" && r.status === 403, `${r.code}: ${r.message}`);
    }
  }
  const cap = await api(other.accessToken, "opsSetWindowCap", { usd: 99999 });
  ok("the 3-hour limit can't be changed by an account that isn't the owner's", cap.code === "FORBIDDEN", `${cap.code}`);
  const made0 = await db.from("blocky_drafts").select("id", { count: "exact", head: true }).eq("user_id", userId);
  const calls0 = await db.from("blocky_ai_calls").select("id", { count: "exact", head: true }).eq("user_id", userId);
  ok("nothing was written, sent to a model or charged for the throwaway account", (made0.count ?? 0) === 0 && (calls0.count ?? 0) === 0, `${made0.count} drafts, ${calls0.count} calls`);
} finally {
  await db.auth.admin.deleteUser(userId);
  const gone = (await db.from("profiles").select("id").eq("id", userId)).data?.length === 0;
  ok("the throwaway account is deleted", gone);
}

// Signed out: the anon key only.
const anon = async (action, payload = {}) => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/blocky-story-api`, { method: "POST", headers: { apikey: anonKey(), Authorization: `Bearer ${anonKey()}`, "Content-Type": "application/json" }, body: JSON.stringify({ action, ...payload }) });
  return { status: res.status, ...(await res.json().catch(() => ({}))) };
};
for (const [action, payload] of [["getIdeas", { seed: 1 }], ["startDraft", draft("v2")], ["listRecent", { type: "single" }], ["opsStatus", {}]]) {
  const r = await anon(action, payload);
  ok(`signed out: ${action} is refused`, r.status === 401 && r.code === "UNAUTHORIZED", `HTTP ${r.status} ${r.code}`);
}
const globalOn = (await db.from("global_feature_flags").select("enabled").eq("key", "blocky_v1").maybeSingle()).data?.enabled === true;
const lib = await anon("listCharacters");
if (globalOn) ok("signed out, Blocky on for everyone: the avatar library opens (names and pictures only)", lib.ok === true && lib.data?.length > 0 && !JSON.stringify(lib.data).includes("user_id"), `${lib.data?.length} avatars`);
else ok("signed out, before launch: the avatar library is closed too", lib.status === 401, `HTTP ${lib.status}`);

console.log(`\n${results.filter(Boolean).length} of ${results.length} checks passed`);
process.exit(results.every(Boolean) ? 0 : 1);
