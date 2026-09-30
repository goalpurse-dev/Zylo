// Stage 3b smoke test ($0: no paid calls). node scripts/fruit-story/smoke3b.mjs
import { api, userSession, SUPABASE_URL } from "./lib.mjs";

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); };

const { accessToken } = await userSession();

const chars = await api(accessToken, "listCharacters");
check("listCharacters returns 170", chars.ok && chars.data.length === 170, `${chars.data?.length} characters`);
check("characters carry the Storage ref image", chars.data?.every((c) => /\/public-assets\/fruit-characters\//.test(c.refImageUrl)), chars.data?.[0]?.refImageUrl?.replace(SUPABASE_URL, ""));

const missing = await api(accessToken, "getStory", { storyId: "00000000-0000-4000-8000-000000000000" });
check("getStory unknown → NOT_FOUND 404", missing.code === "NOT_FOUND" && missing.status === 404, `${missing.status} ${missing.code}: ${missing.message}`);

const bad = await api(accessToken, "getStory", { storyId: "nope" });
check("getStory bad id → NOT_FOUND", bad.code === "NOT_FOUND", `${bad.status} ${bad.code}`);

const pics = await api(accessToken, "generateScenePictures", { storyId: "00000000-0000-4000-8000-000000000000" });
check("paid step with kill switch on → PAID_CALLS_DISABLED", pics.code === "PAID_CALLS_DISABLED", `${pics.status} ${pics.code}: ${pics.message}`);

const create = await api(accessToken, "createStory", { input: { source: "prompt", prompt: "short", castIds: ["mia"], quality: "v2", aspect: "9:16", lengthSec: 15 } });
check("createStory validates first (plain message)", create.code === "VALIDATION", `${create.status} ${create.code}: ${create.message}`);

const recent = await api(accessToken, "listRecent", { type: "single" });
check("listRecent works (empty)", recent.ok && Array.isArray(recent.data), JSON.stringify(recent.data));

const unauth = await fetch(`${SUPABASE_URL}/functions/v1/fruit-story-api`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "listCharacters" }) });
check("no token → 401", unauth.status === 401, String(unauth.status));

const worker = await fetch(`${SUPABASE_URL}/functions/v1/fruit-worker`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reconcile" }) });
check("worker without secret → 401", worker.status === 401, String(worker.status));

const hook = await fetch(`${SUPABASE_URL}/functions/v1/fruit-worker?action=webhook&t=forged`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: [{ taskUUID: "11111111-1111-4111-8111-111111111111", imageURL: "https://evil" }] }) });
check("forged webhook → 401", hook.status === 401, String(hook.status));

for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}  (${r.detail})`);
process.exitCode = results.every((r) => r.ok) ? 0 : 1;
