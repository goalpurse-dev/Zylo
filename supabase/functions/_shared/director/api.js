// THE DIRECTOR's API (docs/studio-v2-plan.md B): plan, revise, save, get, list, delete, sent. Pure logic over injected
// deps so the Node tests run it end to end with a fake model and a fake database:
//   store  the director tables (director_drafts, director_usage, director_claude_videos)
//   llm    (request) -> the parsed JSON answer (OpenAI shape in, Claude covers when OpenAI fails: openaiFetch)
//   user   (userId) -> { plan, paid }
// Planning costs no credits, so it is capped per user per day (LIMITS.plansPerDay / revisionsPerDay).
import { creditsFor, studioById, styleById, variantOf } from "./styles.js";
import { applyRevision, cleanStoryboard, fitToLength, formatOk, LIMITS, monthStart, planRequest, reviseRequest, totalSeconds } from "./storyboard.js";
import { COPY_PARTS, REFERENCE, cardSummary, defaultCopy, engineSettings, townNote } from "../reference/breakdown.js";

export class DirectorError extends Error {
  constructor(code, message, status = 400, extra = {}) { super(message); this.code = code; this.status = status; this.extra = extra; }
}
const UUID = /^[0-9a-f-]{36}$/i;
// eslint-disable-next-line no-control-regex -- strips control characters on purpose
const text = (v, max) => String(v ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max);
const PATH_RE = /^[0-9a-f-]{36}\/director\/[\w.-]{1,200}$/i;

function cleanExtras(e, userId) {
  const out = {};
  const ref = text(e?.reference_image, 300);
  // only a file in the user's own folder of the private user bucket (uploadUserFile's path)
  if (ref && PATH_RE.test(ref) && ref.startsWith(`${userId}/`)) out.reference_image = ref;
  const copy = text(e?.copy_script, LIMITS.copyScriptMax); if (copy) out.copy_script = copy;
  const avoid = text(e?.avoid, LIMITS.avoidMax); if (avoid) out.avoid = avoid;
  // where the user said they want it made (the choice screen opens on it)
  if (e?.where === "claude" || e?.where === "zyvo") out.where = e.where;
  // a scanned reference video (its id) and what to copy from it (owner 2026-11-26)
  if (UUID.test(String(e?.reference?.id ?? ""))) {
    const copy = defaultCopy();
    for (const p of COPY_PARTS) if (typeof e.reference.copy?.[p.id] === "boolean") copy[p.id] = e.reference.copy[p.id];
    out.reference = { id: e.reference.id, copy };
  }
  // reference images: the user's own files, each with a role
  if (Array.isArray(e?.reference_images)) {
    const imgs = e.reference_images.slice(0, REFERENCE.maxImages)
      .map((x) => ({ path: text(x?.path, 300), role: REFERENCE.imageRoles.includes(x?.role) ? x.role : "style" }))
      .filter((x) => PATH_RE.test(x.path) && x.path.startsWith(`${userId}/`));
    if (imgs.length) out.reference_images = imgs;
  }
  return out;
}

/** what the page gets for a draft (+ the live estimate on Zyvo) */
export function draftView(d) {
  const style = styleById(d.style_id);
  const seconds = totalSeconds(d) || d.length_sec;
  return {
    id: d.id, style_id: d.style_id, studio_id: d.studio_id ?? null, idea: d.idea, title: d.title, hook: d.hook, scenes: d.scenes ?? [],
    length_sec: d.length_sec, format: d.format, extras: d.extras ?? {}, chat: d.chat ?? [], status: d.status, made_where: d.made_where ?? null,
    result_url: d.result_url ?? null, created_at: d.created_at, updated_at: d.updated_at,
    seconds, credits: style ? creditsFor(style, seconds) : null,
  };
}

export function makeDirector({ store, llm, user, references = null, now = () => Date.now() }) {
  const dayAgo = () => new Date(now() - 86_400_000).toISOString();

  async function mine(userId, id) {
    if (!UUID.test(String(id ?? ""))) throw new DirectorError("BAD_INPUT", "That plan link isn't right.");
    const d = await store.getDraft(userId, id);
    if (!d) throw new DirectorError("NOT_FOUND", "We couldn't find that plan.", 404);
    return d;
  }
  async function cap(userId, kind) {
    const max = kind === "plan" ? LIMITS.plansPerDay : LIMITS.revisionsPerDay;
    if ((await store.countUsage(userId, kind, dayAgo())) >= max) {
      throw new DirectorError("DAILY_LIMIT", kind === "plan" ? `That's today's ${max} free plans. Come back tomorrow, or open one of your drafts.` : `That's today's ${max} changes. You can still edit the scenes by hand.`, 429);
    }
  }
  async function planStatus(userId) {
    const u = await user(userId);
    const used = await store.countClaudeVideos(userId, monthStart(now()));
    return { paid: Boolean(u.paid), plan: u.plan, claudeVideosLeft: u.paid ? null : Math.max(0, LIMITS.claudeFreePerMonth - used), claudeFreePerMonth: LIMITS.claudeFreePerMonth };
  }

  const actions = {
    async plan(userId, b) {
      const style = styleById(String(b.styleId ?? ""));
      if (!style) throw new DirectorError("BAD_INPUT", "Pick a template first.");
      const idea = text(b.idea, LIMITS.ideaMax);
      if (idea.length < 3) throw new DirectorError("BAD_INPUT", "Write your idea in a few words.");
      const studio = studioById(String(b.studioId ?? "")) ?? null;
      const lengthSec = Number(b.lengthSec);
      if (!style.lengths.includes(lengthSec)) throw new DirectorError("BAD_INPUT", `${style.name} can be ${style.lengths.join(", ")} seconds long.`);
      const format = formatOk(b.format) && style.formats.includes(b.format) ? b.format : style.formats[0];
      if ((await store.countDrafts(userId)) >= LIMITS.draftsPerUser) throw new DirectorError("LIMIT", "You have a lot of drafts. Delete a few old ones first.");
      await cap(userId, "plan");
      const extras = cleanExtras(b.extras, userId);
      const variant = variantOf(style, String(b.variantId ?? ""));
      if (variant) extras.variant = variant.id;
      if (extras.where === "claude" && !style.worksInClaude) delete extras.where;
      // the reference video's breakdown (the user's own, finished scan): director notes + what the card shows
      let breakdown = null;
      if (extras.reference && references) {
        breakdown = await references.get(userId, extras.reference.id).catch(() => null);
        if (breakdown) {
          extras.reference.card = cardSummary(breakdown);
          const engine = style.engine?.direct === "town" ? "town" : style.engine?.direct === "cutaway" ? "cutaway" : null;
          if (engine) extras.reference.engine = { [engine]: engineSettings(engine, breakdown, extras.reference.copy) };
          if (engine === "town") extras.reference.townNote = townNote(breakdown, extras.reference.copy);
        } else delete extras.reference;
      }
      const usageId = await store.logUsage({ user_id: userId, kind: "plan", ok: false });
      let sb;
      try {
        const raw = await llm(planRequest({ style, idea, lengthSec, format, extras, variant, reference: breakdown }), "plan");
        sb = fitToLength(cleanStoryboard(raw), lengthSec);
        if (!sb.scenes.length) throw new Error("no scenes");
      } catch (e) {
        console.error("[director] plan failed:", e?.message ?? e);
        throw new DirectorError("PLANNER", "Planning didn't work this time. Try again in a moment.", 502);
      }
      await store.markUsage(usageId, true);
      const d = await store.insertDraft({ user_id: userId, style_id: style.id, studio_id: studio?.id ?? null, idea, title: sb.title || idea.slice(0, 80), hook: sb.hook, scenes: sb.scenes, length_sec: lengthSec, format, extras });
      return { draft: draftView(d), plansLeft: Math.max(0, LIMITS.plansPerDay - (await store.countUsage(userId, "plan", dayAgo()))) };
    },

    async revise(userId, b) {
      const d = await mine(userId, b.draftId);
      const ask = text(b.ask, LIMITS.askMax);
      if (ask.length < 2) throw new DirectorError("BAD_INPUT", "Say what you want changed.");
      const style = styleById(d.style_id);
      if (!style) throw new DirectorError("BAD_INPUT", "That template isn't available any more.");
      await cap(userId, "revise");
      const usageId = await store.logUsage({ user_id: userId, kind: "revise", draft_id: d.id, ok: false });
      const current = { title: d.title, hook: d.hook, scenes: d.scenes };
      let next, reply;
      try {
        const raw = await llm(reviseRequest({ style, storyboard: current, ask, lengthSec: d.length_sec }), "revise");
        next = applyRevision(current, raw);
        reply = text(raw?.reply, 200) || "Done.";
      } catch (e) {
        console.error("[director] revise failed:", e?.message ?? e);
        throw new DirectorError("PLANNER", "That change didn't work. Try saying it another way.", 502);
      }
      await store.markUsage(usageId, true);
      const chat = [...(d.chat ?? []), { ask, reply, at: new Date(now()).toISOString() }].slice(-LIMITS.chatKeep);
      const saved = await store.updateDraft(userId, d.id, { ...next, chat, status: d.status === "done" ? "draft" : d.status });
      return { draft: draftView(saved), reply };
    },

    async save(userId, b) {
      const d = await mine(userId, b.draftId);
      const sb = cleanStoryboard({ title: b.title ?? d.title, hook: b.hook ?? d.hook, scenes: b.scenes ?? d.scenes });
      if (!sb.scenes.length) throw new DirectorError("BAD_INPUT", "A plan needs at least one scene.");
      const patch = { ...sb };
      const style = styleById(d.style_id);
      if (b.lengthSec != null && style?.lengths.includes(Number(b.lengthSec))) patch.length_sec = Number(b.lengthSec);
      if (b.format != null && formatOk(b.format) && style?.formats.includes(b.format)) patch.format = b.format;
      return { draft: draftView(await store.updateDraft(userId, d.id, patch)) };
    },

    async get(userId, b) {
      const d = await mine(userId, b.draftId);
      return { draft: draftView(d), plan: await planStatus(userId) };
    },

    async list(userId) {
      return { drafts: (await store.listDrafts(userId, 30)).map(draftView) };
    },

    async delete(userId, b) {
      const d = await mine(userId, b.draftId);
      await store.updateDraft(userId, d.id, { deleted_at: new Date(now()).toISOString() });
      return { ok: true };
    },

    /** the user picked where it gets made (Zyvo's page opened, or the Claude prompt copied) */
    async sent(userId, b) {
      const d = await mine(userId, b.draftId);
      const where = b.where === "claude" ? "claude" : "zyvo";
      const patch = { status: where === "claude" ? "sent_claude" : "sent_zyvo", made_where: where };
      if (where === "zyvo") patch.result_url = text(b.resultUrl, 300) || null;
      await store.updateDraft(userId, d.id, patch);
      return { ok: true };
    },
  };

  return {
    async handle(userId, body) {
      const action = String(body?.action ?? "");
      if (!Object.hasOwn(actions, action)) throw new DirectorError("BAD_INPUT", "Unknown action.");
      return actions[action](userId, body ?? {});
    },
    planStatus,
  };
}
