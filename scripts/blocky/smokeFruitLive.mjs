// Free, read-only check that AI Fruit Story still answers on the LIVE API as
// the owner's account: the library, a batch of ideas, recent stories, series.
// Run after a migration or a deploy that touches the story engine.
//   node scripts/blocky/smokeFruitLive.mjs
import { api, userSession } from "../fruit-story/lib.mjs";

const { accessToken } = await userSession();
const out = {};
const chars = await api(accessToken, "listCharacters");
out.characters = chars.ok ? chars.data.length : `${chars.code}: ${chars.message}`;
const ideas = await api(accessToken, "getIdeas", { seed: 0 });
out.ideas = ideas.ok ? ideas.data.length : `${ideas.code}: ${ideas.message}`;
const recent = await api(accessToken, "listRecent", { type: "single" });
out.recentSingles = recent.ok ? recent.data.length : `${recent.code}: ${recent.message}`;
const series = await api(accessToken, "listSeries");
out.series = series.ok ? series.data.length : `${series.code}: ${series.message}`;
if (recent.ok && recent.data[0]) {
  const story = await api(accessToken, "getStory", { storyId: recent.data[0].id });
  out.openNewestStory = story.ok ? `${story.data.status}, ${story.data.scenes.length} scenes` : `${story.code}: ${story.message}`;
}
console.log(JSON.stringify(out, null, 1));
const ok = out.characters === 170 && out.ideas === 5 && Number.isInteger(out.recentSingles) && Number.isInteger(out.series);
console.log(ok ? "PASS" : "FAIL");
process.exitCode = ok ? 0 : 1;
