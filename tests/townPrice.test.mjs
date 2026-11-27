// The owner's chat fixes (2026-11-27): one In This Town price source, 60-120 s, the user's own script word for word,
// "+" attachments that reach a later plan, one press to start, the time estimate, the free way under a finished video.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PRICES } from "../supabase/functions/_shared/blockyWorlds/pricing.js";
import { STYLES, TOWN_LENGTHS, TOWN_PRICES, creditsFor, styleById, townLengthOf, townPrice } from "../supabase/functions/_shared/director/styles.js";
import { scriptSentences, withOwnScript, narrationOf } from "../supabase/functions/_shared/director/storyboard.js";
import { generatePrice, makeMaestro, systemPrompt } from "../supabase/functions/_shared/maestro/brain.js";
import { townMinutes } from "../src/lib/townLive.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const words = (t) => String(t).split(/\s+/).filter(Boolean);

test("one price: the chat's In This Town table IS the server's charge rows (blocky-worlds:video-<s>)", () => {
  for (const [s, c] of Object.entries(TOWN_PRICES)) assert.equal(c, PRICES[Number(s)], `${s} s`);
  assert.deepEqual([...TOWN_LENGTHS], [60, 90, 120]);
  const town = styleById("in-this-town");
  assert.deepEqual(town.lengths, [60, 90, 120], "Maestro offers 60 to 120 s, never 'tops out at 1 min'");
  for (const s of [60, 90, 120]) {
    assert.equal(creditsFor(town, s), townPrice(s), "plan card");
    assert.equal(generatePrice(town, s).credits, townPrice(s), "Generate card and Maestro's words");
  }
  assert.equal(generatePrice(town, 58).credits, townPrice(60), "a 58 s plan is the 60 s video and its price");
  assert.deepEqual([40, 64, 86, 140].map(townLengthOf), [60, 60, 90, 120]);
  assert.match(systemPrompt(STYLES), /exactly 60 s 219 credits, 90 s 313 credits, 120 s 407 credits/);
  assert.doesNotMatch(systemPrompt(STYLES), /313 credits flat/);
});

test("the user's own script: every word kept, in order, scenes keep their pictures", () => {
  const script = "In this town, nobody sneezes. Except me.\nMom says it's rude! Dad says it's dangerous? I say: it's coming. ACHOO.";
  const sb = { title: "t", hook: "x", scenes: [{ id: "s1", narration: "a", visual: "the town", seconds: 5 }, { id: "s2", narration: "b", visual: "the kitchen", seconds: 5 }] };
  const out = withOwnScript(sb, script);
  assert.deepEqual(words(narrationOf(out)), words(script), "word for word");
  assert.equal(out.hook, "In this town, nobody sneezes.", "the hook is its first sentence (said once)");
  assert.deepEqual(out.scenes.map((s) => s.visual), ["the town", "the kitchen"]);
  const long = Array.from({ length: 30 }, (_, i) => `Sentence number ${i + 1} is here and it is long enough to matter a lot.`).join(" ");
  const many = withOwnScript(sb, long);
  assert.ok(many.scenes.every((s) => s.narration.length <= 400), "no scene over the save limit");
  assert.deepEqual(words(narrationOf(many)), words(long), "more scenes, still every word");
  assert.equal(scriptSentences("One. Two!\nThree").length, 3);
  const api = read("supabase/functions/_shared/director/api.js");
  assert.match(api, /sb = extras\.own_script \? withOwnScript\(sb, extras\.own_script\) : fitToLength\(sb, lengthSec\);/);
});

test("Maestro: the '+' script rides on the message, a later plan uses it; it asks once before planning", async () => {
  const msgs = [];
  const store = {
    async getChat(_u, id) { return { id, user_id: "u1" }; }, async createChat(r) { return { id: "c0000000-0000-0000-0000-0000000000c1", ...r }; }, async updateChat() {},
    async listChats() { return []; }, async listMessages() { return msgs; }, async insertMessage(r) { const row = { id: msgs.length + 1, ...r }; msgs.push(row); return row; },
    async countUsage() { return 0; }, async logUsage() { return 1; }, async markUsage() {},
  };
  const plans = [];
  const director = { handle: async (_u, b) => { plans.push(b); return { draft: { id: "d0000000-0000-0000-0000-000000000001", style_id: "in-this-town", title: "T", hook: "h", scenes: [{ id: "s1", narration: "n", visual: "v", seconds: 60 }], length_sec: 60, format: "9:16", extras: {} } }; } };
  const replies = [
    { stop_reason: "end_turn", content: [{ type: "text", text: "Got it. Which length?" }], usage: {} },
    { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "make_plan", input: { style_id: "in-this-town", idea: "sneezing", length_sec: 60 } }], usage: {} },
    { stop_reason: "end_turn", content: [{ type: "text", text: "Here's the plan." }], usage: {} },
  ];
  const m = makeMaestro({ store, claude: async () => replies.shift(), director, user: async () => ({ plan: "pro", paid: true, owner: true, credits: 9999, hasSub: true }) });
  const r1 = await m.handle("u1", { action: "send", text: "use my script", script: "In this town, nobody sneezes. Except me." });
  assert.deepEqual(msgs[0].cards, [{ type: "attached", script: "In this town, nobody sneezes. Except me.", words: 7 }]);
  assert.match(msgs[0].raw[0].content, /\[My script attached: 7 words\. The plan uses it word for word\]/);
  await m.handle("u1", { action: "send", chatId: r1.chat.id, text: "60 seconds" });
  assert.equal(plans[0].extras.own_script, "In this town, nobody sneezes. Except me.", "the plan a turn later still gets the script");
  assert.match(systemPrompt(STYLES), /Do you have a script or reference images\?/);
  assert.match(systemPrompt(STYLES), /Never ask it again in that chat/);
});

test("the chat: Generate under the plan, one press, the time, the video fits, the free way", () => {
  const card = read("src/components/maestro/MaestroCards.jsx");
  assert.match(card, /data-testid="plan-generate"/);
  assert.match(card, /autoStart: true/);
  assert.match(card, /max-h-\[min\(calc\(100dvh-440px\),520px\)\]/, "the finished video leaves room for Download above the chat bar");
  assert.match(card, /const over = row\.getBoundingClientRect\(\)\.bottom - limit;/, "the Download row ends above the chat bar");
  assert.match(card, /onLoadedMetadata=\{fitDone\}/, "re-fit once the video knows its size");
  assert.match(card, /Can't afford a plan\? There's a free way to make these/);
  assert.match(card, /mcpTemplatePath\("in-this-town"\)/, "the free kit's step-by-step page");
  assert.deepEqual([60, 90, 120].map(townMinutes), [9, 11, 14], "60 s took 8.4 min in the owner's run");
  const page = read("src/pages/maestro/MaestroPage.jsx");
  assert.match(page, /data-testid="maestro-plus"/);
  assert.match(page, /\.\.\.\(script\.trim\(\) \? \{ script: script\.trim\(\) \} : \{\}\)/);
});
