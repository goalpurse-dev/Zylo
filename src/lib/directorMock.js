// LOCAL DEV ONLY (?mock=1 on localhost): a fake Director in the browser (sessionStorage), so the Create pages can be
// clicked through with no model call, no account and no credits. Never bundled into a real visit's path: director.js
// only imports it when import.meta.env.DEV is true.
import { styleById } from "../../supabase/functions/_shared/director/styles.js";
import { applyRevision, cleanStoryboard, fitToLength } from "../../supabase/functions/_shared/director/storyboard.js";

const KEY = "zyvo:director-mock";
const load = () => { try { return JSON.parse(sessionStorage.getItem(KEY) ?? "[]"); } catch { return []; } };
const store = (rows) => sessionStorage.setItem(KEY, JSON.stringify(rows));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function fakePlan(style, idea, lengthSec) {
  const n = lengthSec <= 15 ? 3 : lengthSec <= 30 ? 5 : lengthSec <= 60 ? 8 : 12;
  const hook = style.hook.replace(/___/g, idea.split(" ").slice(0, 4).join(" ") || "something");
  const scenes = Array.from({ length: n }, (_, i) => ({
    id: `s${i + 1}`,
    narration: i === 0 ? hook : i === n - 1 ? `And that's how ${idea || "it"} ended. Or did it?` : `Scene ${i + 1}: things get stranger with ${idea || "the idea"}.`,
    visual: i === 0 ? `Wide shot introducing ${idea || "the world"}.` : `A clear moment ${i + 1} of the story, one action.`,
    camera: ["slow push in", "quick whip pan", "top-down", "low angle"][i % 4],
    seconds: Math.round(lengthSec / n),
  }));
  return fitToLength(cleanStoryboard({ title: idea ? idea.slice(0, 60) : style.name, hook, scenes }), lengthSec);
}

export async function mockDirector(action, b) {
  await wait(action === "plan" || action === "revise" ? 900 : 150);
  const rows = load();
  const find = (id) => rows.find((r) => r.id === id && !r.deleted_at);
  const now = new Date().toISOString();
  switch (action) {
    case "plan": {
      const style = styleById(b.styleId);
      if (!style) throw Object.assign(new Error("Pick a template first."), { code: "BAD_INPUT" });
      const sb = fakePlan(style, String(b.idea ?? ""), Number(b.lengthSec) || 30);
      const d = { id: crypto.randomUUID(), style_id: style.id, studio_id: b.studioId ?? null, idea: b.idea ?? "", ...sb, length_sec: Number(b.lengthSec) || 30, format: b.format ?? "9:16", extras: { ...(b.extras ?? {}), ...(b.variantId ? { variant: b.variantId } : {}) }, chat: [], status: "draft", made_where: null, created_at: now, updated_at: now };
      rows.unshift(d); store(rows);
      return { draft: d, plansLeft: 19 };
    }
    case "revise": {
      const d = find(b.draftId);
      if (!d) throw Object.assign(new Error("We couldn't find that plan."), { code: "NOT_FOUND" });
      const ask = String(b.ask ?? "").toLowerCase();
      const scenes = d.scenes.map((s) => ({ ...s }));
      const changed = [];
      const m = ask.match(/scene (\d+)/);
      if (m && scenes[Number(m[1]) - 1]) { const s = scenes[Number(m[1]) - 1]; s.narration = `${s.narration} (changed: ${b.ask})`.slice(0, 380); changed.push(s.id); }
      else if (/shorter/.test(ask) && scenes.length > 2) { changed.push(scenes.at(-2).id, "order"); scenes.splice(-2, 1); }
      else if (/hook/.test(ask)) { changed.push("hook", scenes[0].id); scenes[0].narration = `Wait. ${scenes[0].narration}`; }
      else { changed.push(scenes.at(-1).id); scenes.at(-1).narration = `${scenes.at(-1).narration} (${b.ask})`.slice(0, 380); }
      const next = applyRevision(d, { title: d.title, hook: /hook/.test(ask) ? `Wait. ${d.hook}` : d.hook, scenes, changed });
      Object.assign(d, next, { chat: [...d.chat, { ask: b.ask, at: now }].slice(-12), updated_at: now });
      store(rows);
      return { draft: d, reply: "Done. I changed only what you asked." };
    }
    case "save": {
      const d = find(b.draftId);
      if (!d) throw Object.assign(new Error("We couldn't find that plan."), { code: "NOT_FOUND" });
      const sb = cleanStoryboard({ title: b.title ?? d.title, hook: b.hook ?? d.hook, scenes: b.scenes ?? d.scenes });
      Object.assign(d, sb, b.lengthSec ? { length_sec: b.lengthSec } : {}, b.format ? { format: b.format } : {}, { updated_at: now });
      store(rows);
      return { draft: d };
    }
    case "get": { const d = find(b.draftId); if (!d) throw Object.assign(new Error("We couldn't find that plan."), { code: "NOT_FOUND" }); return { draft: d, plan: { paid: false, claudeVideosLeft: 2 } }; }
    case "list": return { drafts: rows.filter((r) => !r.deleted_at).slice(0, 30) };
    case "delete": { const d = find(b.draftId); if (d) d.deleted_at = now; store(rows); return { ok: true }; }
    case "sent": { const d = find(b.draftId); if (d) Object.assign(d, { status: b.where === "claude" ? "sent_claude" : "sent_zyvo", made_where: b.where }); store(rows); return { ok: true }; }
    default: throw new Error("unknown action");
  }
}
