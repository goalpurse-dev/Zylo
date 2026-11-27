// LOCAL DEV ONLY (?mock=1 on localhost): a fake Maestro in the browser (sessionStorage) that walks the real flow: it asks
// the template's questions, makes a plan (through the fake Director, so the plan card opens a real mock draft), changes
// it, and offers Generate now. No Claude call, no account, no credits.
import { styleById, variantOf } from "../../supabase/functions/_shared/director/styles.js";
import { generatePrice, howMade } from "../../supabase/functions/_shared/maestro/brain.js";
import { mockDirector } from "./directorMock.js";

const KEY = "zyvo:maestro-mock";
const load = () => { try { return JSON.parse(sessionStorage.getItem(KEY) ?? '{"chats":[],"messages":[]}'); } catch { return { chats: [], messages: [] }; } };
const save = (s) => sessionStorage.setItem(KEY, JSON.stringify(s));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const planCard = (d) => ({ type: "plan", draftId: d.id, styleId: d.style_id, title: d.title, hook: d.hook, seconds: d.scenes.reduce((a, s) => a + s.seconds, 0), format: d.format, variant: d.extras?.variant ?? null, scenes: d.scenes.map((s) => ({ narration: s.narration, seconds: s.seconds })) });

async function answer(s, chat, text, templateId) {
  const lower = text.toLowerCase();
  const style = styleById(templateId ?? chat.style_id ?? "");
  const lastPlan = [...s.messages].reverse().find((m) => m.chat_id === chat.id && m.cards?.some((c) => c.type === "plan"))?.cards.find((c) => c.type === "plan");
  if (!style && /idea/.test(lower)) return { text: "Here are 3 ideas that tend to do well:\n\n1. **In this town, every time you laugh you grow.** A kid who can't stop laughing at the worst moment.\n2. **How a landfill really works**, from truck to top layer.\n3. **POV: it's 2AM in a mall made of candy.**\n\nWant me to plan one of them?" };
  if (!style) return { text: "Which kind of video? **In This Town** is great for a funny or spooky blocky story; **Cutaway Explainer** shows how something works inside. Pick one above the box, or tell me more." };
  if (lastPlan && /(generate|make it|go ahead|looks good|do it)/.test(lower)) {
    const p = generatePrice(style, lastPlan.seconds);
    return { text: "Great. Here it is with the price. Press **Generate now** when you're ready.", cards: [{ type: "generate", draftId: lastPlan.draftId, styleId: style.id, title: lastPlan.title, credits: p.credits, exact: p.exact, how: howMade(style), seconds: lastPlan.seconds }] };
  }
  if (lastPlan && /(hook|change|shorter|funnier|ending|scene)/.test(lower)) {
    const r = await mockDirector("revise", { draftId: lastPlan.draftId, ask: text });
    return { text: "Done, I changed only that. Anything else, or shall we make it?", cards: [planCard(r.draft)] };
  }
  const asked = s.messages.some((m) => m.chat_id === chat.id && m.role === "assistant" && /Quick questions/.test(m.text));
  if (!asked) {
    const v = style.variants?.length ? `\n- **Version:** ${style.variants.map((x) => x.name).join(", ")} (default ${style.variants[0].name})` : "";
    return { text: `Love it. Quick questions for **${style.name}**:\n\n- **Length:** ${style.lengths.join(", ")} seconds (default ${style.lengths[0]})${v}\n\nOr just say **go** and I'll use the defaults.` };
  }
  const variant = variantOf(style, (style.variants ?? []).find((x) => lower.includes(x.name.toLowerCase()))?.id) ?? style.variants?.[0] ?? null;
  const len = style.lengths.find((l) => lower.includes(String(l))) ?? style.lengths[0];
  const firstIdea = s.messages.find((m) => m.chat_id === chat.id && m.role === "user")?.text ?? text;
  const r = await mockDirector("plan", { styleId: style.id, variantId: variant?.id, idea: firstIdea, lengthSec: len, format: style.formats[0] });
  return { text: `Here's your plan: **${r.draft.scenes.length} scenes, ${len} seconds**. Want any changes, like a stronger hook? Or say **make it**.`, cards: [planCard(r.draft)] };
}

export async function mockMaestro(action, b) {
  const s = load();
  const now = new Date().toISOString();
  if (action === "status") return { plan: "free", limit: 10, used: 0, left: 10, smart: false };
  if (action === "chats") return { chats: s.chats.filter((c) => !c.deleted).sort((a, c) => c.updatedAt.localeCompare(a.updatedAt)) };
  if (action === "chat") {
    const chat = s.chats.find((c) => c.id === b.chatId && !c.deleted);
    if (!chat) throw Object.assign(new Error("We couldn't find that chat."), { code: "NOT_FOUND" });
    return { chat, messages: s.messages.filter((m) => m.chat_id === chat.id) };
  }
  if (action === "delete") { const c = s.chats.find((x) => x.id === b.chatId); if (c) c.deleted = true; save(s); return { ok: true }; }
  if (action === "send") {
    await wait(900);
    let chat = s.chats.find((c) => c.id === b.chatId);
    if (!chat) { chat = { id: crypto.randomUUID(), title: String(b.text).slice(0, 60), styleId: b.templateId ?? null, style_id: b.templateId ?? null, updatedAt: now }; s.chats.push(chat); }
    if (b.templateId) { chat.style_id = b.templateId; chat.styleId = b.templateId; }
    const mine = { id: s.messages.length + 1, chat_id: chat.id, role: "user", text: b.text, cards: [], templateId: b.templateId ?? null, at: now };
    s.messages.push(mine);
    // a scanned reference video (the page sends its card along in mock mode): the card, then 2 lines on what is copied
    const refCard = b.reference?.id && b.referenceCard ? { type: "reference", scanId: b.reference.id, card: b.referenceCard, copy: b.reference.copy } : null;
    const base = await answer(s, chat, String(b.text), b.templateId);
    const copied = refCard ? Object.entries(refCard.copy ?? {}).filter(([k, on]) => on && k !== "topic").map(([k]) => k).join(", ") : "";
    const a = refCard ? { text: `Got it. I'll copy its ${copied}: about ${refCard.card.shots} shots, ${refCard.card.pace}, the same kind of hook.
What's new: your story, your characters, no words or logos from that video.

${base.text}`, cards: [refCard, ...(base.cards ?? [])] } : base;
    const reply = { id: s.messages.length + 1, chat_id: chat.id, role: "assistant", text: a.text, cards: a.cards ?? [], templateId: null, at: now };
    s.messages.push(reply);
    chat.updatedAt = now;
    save(s);
    return { chat, messages: [mine, reply], left: 9 };
  }
  throw new Error("unknown action");
}

/**
 * DEV ONLY (?mock=1): an In This Town run's status with the owner's live feed (docs/in-this-town-live-feed.md), so the
 * chat's grid can be checked without a render: 12 shots fill in one at a time, shot 4 fails and is repaired (its still
 * replaced by version 2), then the final render and the finished video.
 */
export function mockTownStatus(startedAt, now = Date.now()) {
  const t = (now - startedAt) / 1000;
  const total = 12;
  const stills = ["/in-this-town/stories/milo.webp", "/in-this-town/stories/plane.webp", "/in-this-town/stories/tower.webp"];
  const done = Math.max(0, Math.min(total, Math.floor((t - 2) / 1.2)));
  const repaired = t > 26; // the review pause runs from all shots done (~16 s) until the repair
  const stage = t < 2 ? "directing" : done < total ? "previews" : !repaired ? "fixing" : t < 32 ? "rendering" : "done";
  const shots = Array.from({ length: total }, (_, i) => {
    const n = i + 1;
    if (n > done) return { n, line: Math.ceil(n / 2), text: `Line ${Math.ceil(n / 2)} of the story.`, state: "pending", v: 0, thumbUrl: null };
    if (n === 4) return repaired
      ? { n, line: 2, text: "Line 2 of the story.", state: "repaired", v: 2, thumbUrl: stills[2] }
      : { n, line: 2, text: "Line 2 of the story.", state: "fail", v: 1, thumbUrl: stills[0], why: "the face is cut off" };
    return { n, line: Math.ceil(n / 2), text: `Line ${Math.ceil(n / 2)} of the story.`, state: "pass", v: 1, thumbUrl: stills[n % 3] };
  });
  const detail = stage === "rendering" ? `${Math.min(8, Math.floor((t - 26) * 1.5) + 1)} of 8 parts` : stage === "directing" ? "every shot" : `${done} of ${total} shots`;
  const words = { directing: "Planning every shot", previews: "Test-shooting every shot", fixing: "Fixing weak shots", rendering: "Making the final video", done: "Done" }[stage];
  const isDone = stage === "done";
  return {
    status: isDone ? "done" : stage === "rendering" ? "render" : "plan", pct: isDone ? 100 : Math.min(99, Math.round(t * 3.8)), stage,
    progress: { stage, pct: Math.round(t * 3.8), detail },
    finalUrl: isDone ? "/in-this-town/stories/milo.mp4" : null,
    live: { v: 1, runId: "mock", engine: "threejs", step: { stage, words, detail }, count: { done, total, pass: done - (done >= 4 && !repaired ? 1 : 0), fail: done >= 4 && !repaired ? 1 : 0 }, shots, review: stage === "fixing" ? { open: true, until: new Date(startedAt + 26000).toISOString(), seconds: 60, notes: [] } : undefined, video: { ready: isDone }, updatedAt: new Date(now).toISOString() },
  };
}
