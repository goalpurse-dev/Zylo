// Free check of Blocky Stories on the real project. It spends nothing: with
// the paid-calls switch OFF (it refuses to run otherwise) every paid step must
// be refused before any provider is called.
//   - the owner's account (blocky_v1 on) reads the library and its lists;
//   - an account without the switch is told the page doesn't exist
//     (a throwaway account, created and deleted here);
//   - writing a story is refused while paid calls are off, and nothing is logged or charged;
//   - the worker refuses callers without its secret, and refuses a test run while paid calls are off.
//   node scripts/blocky/smokeBlockyLive.mjs
import { SUPABASE_URL, admin, anonKey, api, userSession, worker } from "./lib.mjs";

const db = admin();
const results = [];
const ok = (name, cond, detail = "") => { results.push(Boolean(cond)); console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); };
const count = async (table) => (await db.from(table).select("*", { count: "exact", head: true })).count;

const paid = (await db.rpc("blocky_paid_state", { p_add_usd: 0 })).data;
if (paid?.paid_calls) { console.error("Paid calls are ON: this check only runs with them off (node scripts/blocky/paid.mjs off)."); process.exit(2); }
const before = { calls: await count("blocky_ai_calls"), stories: await count("blocky_stories"), charges: await count("blocky_charges") };

const owner = await userSession();
const balance = async () => (await db.from("profiles").select("credit_balance").eq("id", owner.userId).single()).data.credit_balance;
const credits = await balance();
const library = await api(owner.accessToken, "listCharacters");
ok("the owner's account reads the avatar library", library.ok && library.data.length >= 3, library.ok ? library.data.map((c) => c.name).join(", ") : `${library.code}: ${library.message}`);
ok("an avatar has no age and no gender", library.ok && library.data.every((c) => !("age" in c) && !("gender" in c) && c.look && c.voiceStyle && /^https:\/\//.test(c.refImageUrl)));
const recent = await api(owner.accessToken, "listRecent", { type: "single" });
ok("recent creations load (an empty list is fine)", recent.ok && Array.isArray(recent.data), `${recent.data?.length} stories`);
// Series is behind its own switch, off for everyone: every series action is refused, for the owner too.
const seriesCalls = await Promise.all([
  api(owner.accessToken, "listSeries"),
  api(owner.accessToken, "listRecent", { type: "series" }),
  api(owner.accessToken, "getSeries", { seriesId: crypto.randomUUID() }),
  api(owner.accessToken, "createSeriesPlan", { input: { concept: "A fake admin takes over the server", castIds: ["noob", "vex"], opener: "Banned in front of the whole server", tone: "Loud and dramatic", episodeCount: 3 } }),
  api(owner.accessToken, "createStory", { input: { source: "episode", seriesId: crypto.randomUUID(), episodeNumber: 1, quality: "v2", lengthSec: 20, aspect: "9:16" } }),
]);
ok("series is switched off: listing, opening, planning a series and starting an episode are all refused", seriesCalls.every((r) => r.code === "STAGE_NOT_READY"), seriesCalls.map((r) => r.code).join(", "));
const ideas = await api(owner.accessToken, "getIdeas", { seed: 0 });
ok("ideas answer that they aren't switched on yet", ideas.code === "STAGE_NOT_READY", `${ideas.code}`);

const story = await api(owner.accessToken, "createStory", { input: { source: "prompt", castIds: library.data?.slice(0, 2).map((c) => c.id), prompt: "Noob gets banned on an obby server for no reason, and the admin is not who they seem.", quality: "v2", lengthSec: 15, aspect: "9:16" } });
ok("paid calls off: writing a story is refused", story.code === "PAID_CALLS_DISABLED" && story.status === 503, `${story.code}: ${story.message}`);
const named = await api(owner.accessToken, "createStory", { input: { source: "prompt", castIds: library.data?.slice(0, 2).map((c) => c.id), prompt: "Noob gets banned in Brookhaven for no reason.", quality: "v2", lengthSec: 15, aspect: "9:16" } });
ok("a real game's name in the story is refused with a plain message", named.code === "VALIDATION" && /Leave out "Brookhaven"/.test(named.message ?? ""), `${named.code}: ${named.message}`);
const none = await fetch(`${SUPABASE_URL}/functions/v1/blocky-story-api`, { method: "POST", headers: { apikey: anonKey(), Authorization: `Bearer ${anonKey()}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "listCharacters" }) });
ok("no sign-in: refused", none.status === 401, `HTTP ${none.status}`);

// An account without the switch.
const email = "upwardlift6+blockyflagtest@gmail.com";
const made = await db.auth.admin.createUser({ email, password: `${crypto.randomUUID()}Aa1!`, email_confirm: true });
if (made.error) ok("a throwaway account for the switch check", false, made.error.message);
else {
  try {
    const other = await userSession(email);
    const hidden = await api(other.accessToken, "listCharacters");
    ok("an account without the switch: the page doesn't exist", hidden.code === "NOT_FOUND" && hidden.status === 404, `${hidden.code}: ${hidden.message}`);
    const direct = await other.client.from("blocky_characters").select("id");
    ok("and it can't read the library straight from the database either", Boolean(direct.error) || (direct.data ?? []).length === 0, direct.error?.message ?? `${direct.data?.length} rows`);
  } finally {
    await db.auth.admin.deleteUser(made.data.user.id);
    const gone = (await db.from("profiles").select("id").eq("id", made.data.user.id)).data?.length === 0;
    ok("the throwaway account is deleted", gone);
  }
}

// The worker.
const noSecret = await fetch(`${SUPABASE_URL}/functions/v1/blocky-worker`, { method: "POST", headers: { "Content-Type": "application/json", "x-blocky-worker-secret": "wrong" }, body: JSON.stringify({ action: "reconcile" }) });
ok("the worker refuses a caller without its secret", noSecret.status === 401, `HTTP ${noSecret.status}`);
const hook = await fetch(`${SUPABASE_URL}/functions/v1/blocky-worker?action=webhook&t=forged`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: [{ taskUUID: crypto.randomUUID() }] }) });
ok("the worker refuses a forged result", hook.status === 401, `HTTP ${hook.status}`);
const test = await worker({ action: "raw_test", label: "smoke", task: { taskType: "imageInference", model: "google:nano-banana@2-lite", positivePrompt: "smoke", width: 768, height: 1376 } });
ok("paid calls off: the worker refuses a test picture", test.code === "PAID_CALLS_DISABLED", `${test.code}`);

const after = { calls: await count("blocky_ai_calls"), stories: await count("blocky_stories"), charges: await count("blocky_charges") };
ok("nothing was sent to a provider, written or charged", JSON.stringify(after) === JSON.stringify(before) && (await balance()) === credits, `${JSON.stringify(after)}, balance unchanged`);
console.log(`\n${results.filter(Boolean).length} of ${results.length} checks passed`);
process.exitCode = results.every(Boolean) ? 0 : 1;
