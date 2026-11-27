// node --test tests/maestro.test.mjs   (free: Maestro's brain end to end with a fake Claude and a fake Director)
import test from "node:test";
import assert from "node:assert/strict";
import { MAESTRO, generatePrice, howMade, limitFor, makeMaestro, modelFor, systemPrompt, toolDefs } from "../supabase/functions/_shared/maestro/brain.js";
import { STYLES, styleById } from "../supabase/functions/_shared/director/styles.js";
import { TOWN_PRICES } from "../supabase/functions/_shared/director/styles.js";

const U = "11111111-1111-4111-8111-111111111111", V = "22222222-2222-4222-8222-222222222222";
const DRAFT = "abcdef00-0000-4000-8000-000000000001";

function fakes({ plan = "free", paid = false, script = [] } = {}) {
  const t = { chats: [], messages: [], usage: [], calls: [], director: [] };
  let n = 0;
  const store = {
    t,
    async getChat(u, id) { return t.chats.find((c) => c.id === id && c.user_id === u && !c.deleted_at) ?? null; },
    async createChat(r) { const c = { id: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`, created_at: "x", updated_at: "x", ...r }; t.chats.push(c); return c; },
    async updateChat(id, p) { Object.assign(t.chats.find((c) => c.id === id), p); },
    async listChats(u) { return t.chats.filter((c) => c.user_id === u && !c.deleted_at); },
    async listMessages(chatId) { return t.messages.filter((m) => m.chat_id === chatId); },
    async insertMessage(r) { const m = { id: t.messages.length + 1, created_at: "x", cards: [], ...r }; t.messages.push(m); return m; },
    async countUsage(u) { return t.usage.filter((x) => x.user_id === u && x.ok).length; },
    async logUsage(r) { t.usage.push({ ...r, id: t.usage.length + 1 }); return t.usage.length; },
    async markUsage(id, p) { Object.assign(t.usage[id - 1], p); },
  };
  const draft = { id: DRAFT, style_id: "in-this-town", title: "Laugh and grow", hook: "In this town, every time you laugh you grow.", length_sec: 60, format: "9:16", extras: { variant: "funny" },
    scenes: [{ narration: "In this town, every time you laugh you grow.", visual: "A kid laughing", seconds: 15 }, { narration: "I laughed at a joke. Now I'm taller than the school.", visual: "Giant kid", seconds: 15 }] };
  const director = {
    async handle(userId, b) {
      t.director.push({ userId, ...b });
      if (b.action === "plan") return { draft: { ...draft, style_id: b.styleId, length_sec: b.lengthSec } };
      if (b.action === "revise") return { draft: { ...draft, hook: "BIGGER hook" }, reply: "Hook changed." };
      if (b.action === "get") return { draft };
      throw new Error("?");
    },
  };
  // the fake Claude plays back a script: each step is a response (or a function of the request)
  const claude = async (req) => { t.calls.push(req); const step = script.shift(); if (!step) return { stop_reason: "end_turn", content: [{ type: "text", text: "Hi!" }], usage: { input_tokens: 10, output_tokens: 5 } }; return typeof step === "function" ? step(req) : step; };
  const m = makeMaestro({ store, claude, director, user: async () => ({ plan, paid, owner: false }) });
  return { m, t };
}

test("plans: 10 / 100 / 300 / 600 messages a day; Haiku on Free, Sonnet on paid", () => {
  assert.deepEqual(["free", "starter", "pro", "generative"].map((p) => limitFor(p)), [10, 100, 300, 600]);
  assert.equal(limitFor("affiliate"), 100);
  assert.equal(limitFor("weird"), 10);
  assert.equal(limitFor("free", true), 600, "the owner");
  assert.equal(modelFor(false), "claude-haiku-5-5");
  assert.equal(modelFor(true), "claude-sonnet-5-5");
});

test("what Maestro knows: every template with its lengths, versions, price and how it's made; the money rule", () => {
  const p = systemPrompt();
  for (const s of STYLES) assert.ok(p.includes(`- ${s.id} · ${s.name}`), s.id);
  assert.match(p, /in-this-town · In This Town .*Versions: Funny \(funny\), Spooky \(spooky\), Wholesome \(wholesome\)/);
  assert.match(p, /exactly 60 s 219 credits, 90 s 313 credits, 120 s 407 credits/);
  assert.match(p, /THE USER presses it; you never start, charge or promise anything yourself/);
  assert.match(p, /Ask that template's questions in ONE short message/);
  assert.equal(howMade(styleById("in-this-town")), "town");
  assert.equal(howMade(styleById("cutaway-explainer")), "cutaway");
  assert.equal(howMade(styleById("ai-fruit-story")), "page");
  assert.deepEqual(generatePrice(styleById("in-this-town"), 60), { credits: TOWN_PRICES[60], exact: true });
  assert.deepEqual(generatePrice(styleById("in-this-town"), 120), { credits: TOWN_PRICES[120], exact: true });
  assert.deepEqual(toolDefs().map((t) => t.name), ["make_plan", "change_plan", "offer_generate", "offer_quick", "offer_plan", "offer_credits"]);
});

test("a chat: the template tag, a plan via the Director, a Generate card; the turn is replayed unchanged next time", async () => {
  const { m, t } = fakes({ plan: "pro", paid: true, script: [
    { stop_reason: "tool_use", content: [{ type: "text", text: "On it." }, { type: "tool_use", id: "tu1", name: "make_plan", input: { style_id: "in-this-town", variant_id: "funny", idea: "every time you laugh you grow", length_sec: 60 } }], usage: { input_tokens: 100, output_tokens: 20 } },
    { stop_reason: "end_turn", content: [{ type: "text", text: "Here's your plan: 2 scenes. Want changes?" }], usage: { input_tokens: 120, output_tokens: 15 } },
    { stop_reason: "tool_use", content: [{ type: "tool_use", id: "tu2", name: "offer_generate", input: { draft_id: DRAFT } }], usage: { input_tokens: 150, output_tokens: 10 } },
    { stop_reason: "end_turn", content: [{ type: "text", text: "Press Generate now when you're ready." }], usage: { input_tokens: 160, output_tokens: 10 } },
  ] });
  const r1 = await m.handle(U, { action: "send", text: "every time you laugh you grow in size, crazy twist", templateId: "in-this-town" });
  assert.equal(t.calls[0].model, "claude-sonnet-5-5");
  assert.equal(t.calls[0].messages.at(-1).content, "[Template: In This Town (in-this-town)]\nevery time you laugh you grow in size, crazy twist");
  assert.deepEqual(t.director[0], { userId: U, action: "plan", styleId: "in-this-town", variantId: "funny", idea: "every time you laugh you grow", lengthSec: 60, format: undefined, extras: { where: "zyvo" } });
  const reply = r1.messages[1];
  assert.equal(reply.text, "Here's your plan: 2 scenes. Want changes?");
  assert.equal(reply.cards[0].type, "plan");
  assert.equal(reply.cards[0].scenes.length, 2);
  assert.equal(r1.left, 299);

  const r2 = await m.handle(U, { action: "send", chatId: r1.chat.id, text: "looks good, make it" });
  // the first turn's exact messages (tool_use + tool_result) come back unchanged, in order
  const sent = t.calls[2].messages;
  assert.equal(sent[0].role, "user");
  assert.equal(sent[1].content[1].type, "tool_use");
  assert.equal(sent[2].content[0].type, "tool_result");
  assert.equal(sent[3].content[0].text, "Here's your plan: 2 scenes. Want changes?");
  const card = r2.messages[1].cards[0];
  assert.deepEqual([card.type, card.how, card.credits, card.exact], ["generate", "town", TOWN_PRICES[60], true]);
  assert.equal(t.usage.filter((x) => x.ok).length, 2);
  assert.ok(t.usage[0].cost_usd > 0);
});

test("the daily limit; a failed answer isn't counted; another user's chat is invisible", async () => {
  const { m, t } = fakes();
  for (let i = 0; i < 10; i++) t.usage.push({ user_id: U, ok: true });
  await assert.rejects(m.handle(U, { action: "send", text: "hi" }), (e) => e.code === "DAILY_LIMIT" && e.status === 429);
  const g = fakes({ script: [async () => { throw new Error("down"); }] });
  await assert.rejects(g.m.handle(U, { action: "send", text: "hi" }), (e) => e.code === "BUSY");
  assert.equal(g.t.usage.filter((x) => x.ok).length, 0);
  assert.equal(g.t.calls[0].model, "claude-haiku-5-5");
  const h = fakes();
  const r = await h.m.handle(U, { action: "send", text: "hello" });
  await assert.rejects(h.m.handle(V, { action: "chat", chatId: r.chat.id }), (e) => e.code === "NOT_FOUND");
  assert.equal((await h.m.handle(U, { action: "chats" })).chats.length, 1);
});

test("a tool error goes back to Claude as an error result (it can ask or fix); quick cards are cleaned", async () => {
  const { m, t } = fakes({ script: [
    { stop_reason: "tool_use", content: [{ type: "tool_use", id: "a", name: "change_plan", input: { draft_id: "nope", ask: "x" } }, { type: "tool_use", id: "b", name: "offer_quick", input: { mode: "video", prompt: "waves at sunset", size: "1:1", seconds: 99 } }], usage: {} },
    { stop_reason: "end_turn", content: [{ type: "text", text: "Here's a quick clip." }], usage: {} },
  ] });
  const r = await m.handle(U, { action: "send", text: "make waves" });
  const results = t.calls[1].messages.at(-1).content;
  assert.equal(results[0].is_error, true);
  assert.match(results[0].content, /draft_id/);
  assert.deepEqual(r.messages[1].cards, [{ type: "quick", mode: "video", prompt: "waves at sunset", size: "9:16", seconds: 5 }]);
});

test("refusals and long chats", async () => {
  const { m } = fakes({ script: [{ stop_reason: "refusal", content: [], usage: {} }] });
  const r = await m.handle(U, { action: "send", text: "something bad" });
  assert.match(r.messages[1].text, /can't help with that one/);
  const f = fakes();
  const c = await f.m.handle(U, { action: "send", text: "hi" });
  for (let i = 0; i < MAESTRO.turnsPerChat; i++) f.t.messages.push({ chat_id: c.chat.id, role: "user", text: "x", raw: [] });
  await assert.rejects(f.m.handle(U, { action: "send", chatId: c.chat.id, text: "more" }), (e) => e.code === "CHAT_FULL");
});

test("Maestro down: the page says so plainly and reports it (the ops-health alert ships later, with ops-health)", async () => {
  const fs = await import("node:fs");
  const client = fs.readFileSync(new URL("../src/lib/maestro.js", import.meta.url), "utf8");
  assert.match(client, /Maestro is taking a break, try again in a minute./);
  assert.doesNotMatch(client, /Check your connection/, "never blames the user's connection");
  assert.match(client, /event: "maestro_unreachable"/);
});
