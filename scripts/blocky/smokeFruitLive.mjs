// Free, read-only check that AI Fruit Story still answers on the LIVE API as
// the owner's account: the library, a batch of ideas, recent stories, series.
// Run before and after anything that touches Fruit's database (the undo of the
// template columns). It only reads.
//   node scripts/blocky/smokeFruitLive.mjs
import { SUPABASE_URL, userSession } from "./lib.mjs";

const { accessToken } = await userSession();
const api = async (action, payload = {}) => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/fruit-story-api`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, apikey: process.env.VITE_SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  return { status: res.status, ...(await res.json().catch(() => ({ ok: false, code: "BAD_JSON" }))) };
};
const out = {};
const chars = await api("listCharacters");
out.characters = chars.ok ? chars.data.length : `${chars.code}: ${chars.message}`;
const ideas = await api("getIdeas", { seed: 0 });
out.ideas = ideas.ok ? ideas.data.length : `${ideas.code}: ${ideas.message}`;
const recent = await api("listRecent", { type: "single" });
out.recentSingles = recent.ok ? recent.data.length : `${recent.code}: ${recent.message}`;
const series = await api("listSeries");
out.series = series.ok ? series.data.length : `${series.code}: ${series.message}`;
if (recent.ok && recent.data[0]) {
  const story = await api("getStory", { storyId: recent.data[0].id });
  out.openNewestStory = story.ok ? `${story.data.status}, ${story.data.scenes.length} scenes` : `${story.code}: ${story.message}`;
}
console.log(JSON.stringify(out, null, 1));
const ok = out.characters === 170 && out.ideas === 5 && Number.isInteger(out.recentSingles) && Number.isInteger(out.series);
console.log(ok ? "PASS" : "FAIL");
process.exitCode = ok ? 0 : 1;
