// deno-lint-ignore-file no-explicit-any
import { BIBLE_BUILD_MAX_S } from "./bibleBuild.ts";
// stickman/scenes.ts — the Stickman Scenes step (Phase 6c). Pure: tested offline.
//
// After "Continue to Scenes" the autopilot runs, server-side and chained:
//   bible (usually already frozen during the voice step) -> Beat Director
//   (real word timings) -> draw every scene on the project's tier (free code
//   checks / QA per tier, upscale, text as an editable layer).
// decideScenes() reads the rows and returns the next action; the per-minute
// cron + every finished scene call advance-long-form-autopilot, which acts on
// it. Never stuck: each step has a server heartbeat and a watchdog budget
// (expected + 90 s grace); a stalled step is resumed once, then the run stops
// in a clear "Retry (free)" state.

export type ScenesStage = "bible" | "beats" | "drawing" | "done";
export const SCENES_STAGES: { key: ScenesStage | "finishing"; label: string }[] = [
  { key: "beats", label: "Planning scenes" },
  { key: "drawing", label: "Drawing" },
  { key: "finishing", label: "Finishing" },
];

// Measured (2026-09): beat plans 121-168 s ($0.18-0.25, 115-136 beats); V2
// scenes 9.7 s median / 12.1 s p90 each, 136 scenes in 229 s at 6 at a time.
// 2026-10-07, the provider concurrency caps (config, no redeploy of the rules needed):
//   LONG_FORM_SCENES_PER_VIDEO  scenes of ONE video drawn at the same time (default 6, the measured value)
//   LONG_FORM_SCENES_TOTAL      scenes of ALL videos drawn at the same time (default 30)
// Work over a cap waits in the queue; it is never refused.
const envInt = (name: string, def: number) => { try { const v = Number((globalThis as any).Deno?.env?.get(name)); return Number.isFinite(v) && v > 0 ? Math.floor(v) : def; } catch { return def; } };
export const SCENES_TOTAL_MAX = envInt("LONG_FORM_SCENES_TOTAL", 30);
export const SCENE_TIMING = {
  bibleS: [0, 90] as [number, number],       // normally frozen during the voice step already
  beatsS: [150, 240] as [number, number],   // 121-189 s measured (115-148 beats)
  // V3 measured on f90160bc (148 scenes): 9.6 s median, 17.2 s p90; V4 = V3 + best-of-2 on some beats.
  perSceneS: { V2: [9.7, 12.1], V3: [9.6, 17.2], V4: [14, 30] } as Record<string, [number, number]>,
  concurrency: envInt("LONG_FORM_SCENES_PER_VIDEO", 6),
};
export const SCENE_CONCURRENCY = SCENE_TIMING.concurrency;
export const SCENE_LEASE_S = 150;           // one step of a scene: render (+ retry) + upscale; renewed per step (sceneLadder.ts)
export const SCENE_MAX_ATTEMPTS = 3;        // a scene whose worker DIED is re-queued twice, then marked failed (a deferred retry is not a death)
export const WATCHDOG_GRACE_S = 90;
export const SCENES_MAX_RESUMES = 2;
// 2026-10-07: drawing that made no progress for this long (a provider down, our balance empty)
// stops waiting: the scenes still in the queue are closed, and the run ends as usual (with not
// one scene drawn, every credit goes back by itself).
export const SCENES_NO_PROGRESS_MAX_S = 6 * 3600;

// Credits per image by tier (the same prices as the project quote: GENERATE v2=2 / v3=3 / v4=4).
// Phase 7: scene REGENERATE add-on prices (~2x real cost at the cheapest $/credit).
export const SCENE_CREDITS: Record<string, number> = { V2: 1, V3: 4, V4: 5 };
export const sceneCredits = (tier: string) => SCENE_CREDITS[String(tier).toUpperCase()] ?? 2;
export const tierOf = (renderTier: string | null | undefined) => (String(renderTier ?? "v2").toUpperCase() as "V2" | "V3" | "V4");

export type ScenesRecord = {
  status: "running" | "done" | "failed";
  startedAt: string;
  stage?: ScenesStage;
  resumes?: number;
  dispatched?: { bible?: string; beats?: string };
  planId?: string | null;
  failedReason?: string | null;
  doneAt?: string | null;
  // 2026-10-07: the failed scenes of the first run were queued once more (free) before the run ended.
  secondPassAt?: string | null;
  // Drawing was given up after SCENES_NO_PROGRESS_MAX_S without one scene finishing.
  gaveUpAt?: string | null;
  // A redraw of single scenes on a finished run (update-long-form-scene).
  regenerating?: boolean;
};

export type ScenesInput = {
  now: string;
  scenes: ScenesRecord;
  bible: { id: string; status: string; created_at: string } | null;
  // Phase 6d-1: the bible build logged as started (the lock's, usually) and whether it ended.
  bibleBuild?: { startedAt: string; ended: "done" | "failed" | null; endedAt: string | null } | null;
  plan: { id: string; status: string; created_at: string; beatCount: number; errorCode?: string | null } | null;
  // lastProgressAt: when a scene last finished (else when the scenes were created).
  images: { queued: number; rendering: number; renderingExpired: { id: string; attempts: number }[]; ready: number; failed: number; total: number; lastProgressAt?: string | null };
  tier: string;
};

export type ScenesAction =
  | { kind: "build_bible"; resume: boolean }
  | { kind: "build_beats"; resume: boolean }
  | { kind: "create_scenes"; planId: string }
  | { kind: "draw"; planId: string; slots: number; requeue: string[]; fail: string[] }
  | { kind: "retry_failed"; planId: string }
  | { kind: "give_up_drawing"; planId: string }
  | { kind: "wait" }
  | { kind: "done" }
  | { kind: "fail"; reason: string };

export type ScenesDecision = { action: ScenesAction; stage: ScenesStage; etaSeconds: [number, number]; drawn: number; total: number };

const ms = (s?: string | null) => (s ? Date.parse(s) : NaN);
const PLAN_OK = new Set(["ready", "ready_with_warnings"]);

export function drawingEta(remaining: number, tier: string): [number, number] {
  const [lo, hi] = SCENE_TIMING.perSceneS[tier] ?? SCENE_TIMING.perSceneS.V2;
  const c = SCENE_TIMING.concurrency;
  return [Math.round((remaining * lo) / c), Math.round((remaining * hi) / c) + 20];
}

export function decideScenes(input: ScenesInput): ScenesDecision {
  const now = ms(input.now);
  const sc = input.scenes;
  const img = input.images;
  const total = input.plan && PLAN_OK.has(input.plan.status) ? input.plan.beatCount : img.total;
  const drawn = img.ready;
  const beatsEta = (elapsedS = 0): [number, number] => {
    const [lo, hi] = SCENE_TIMING.beatsS;
    const d = drawingEta(total || 130, input.tier);
    return [Math.max(10, lo - elapsedS) + d[0], Math.max(20, hi - elapsedS) + d[1]];
  };
  const base = (action: ScenesAction, stage: ScenesStage, eta: [number, number]): ScenesDecision => ({ action, stage, etaSeconds: eta, drawn, total });
  if (sc.status === "done") return base({ kind: "done" }, "done", [0, 0]);
  if (sc.status === "failed") return base({ kind: "fail", reason: sc.failedReason ?? "stopped" }, sc.stage ?? "bible", [0, 0]);
  const resumeOr = (action: ScenesAction, stage: ScenesStage, reason: string, eta: [number, number]) =>
    (sc.resumes ?? 0) >= SCENES_MAX_RESUMES ? base({ kind: "fail", reason: `${reason} after ${SCENES_MAX_RESUMES} resumes` }, stage, eta) : base(action, stage, eta);
  const stale = (since: string | null | undefined, budgetS: number) => !since || now - ms(since) > (budgetS + WATCHDOG_GRACE_S) * 1000;

  // 1. Production Bible (normally frozen already — built in parallel with the voice).
  if (!input.bible || input.bible.status !== "frozen") {
    // Phase 6d-1: a build logged as started and not ended (the lock's) IS this
    // step's build — waited for up to its real limit, never started twice.
    const build = input.bibleBuild ?? null;
    const running = build && !build.ended ? build.startedAt : null;
    const dispatched = sc.dispatched?.bible ?? null;
    const beat = [dispatched, running].filter(Boolean).sort().at(-1) ?? null;
    if (!beat) return base({ kind: "build_bible", resume: false }, "bible", beatsEta());
    const endedFailed = build?.ended === "failed" && (!dispatched || String(build.endedAt) >= dispatched);
    const budget = running ? BIBLE_BUILD_MAX_S - WATCHDOG_GRACE_S : SCENE_TIMING.bibleS[1] + 60;
    if (input.bible?.status === "failed" || endedFailed || stale(beat, budget)) return resumeOr({ kind: "build_bible", resume: true }, "bible", "the scene plan's style guide stalled", beatsEta());
    return base({ kind: "wait" }, "bible", beatsEta());
  }

  // 2. Beat Director (real word timings from the ready narration).
  const plan = input.plan;
  if (!plan || plan.status === "failed") {
    const beat = sc.dispatched?.beats ?? null;
    if (!beat) return base({ kind: "build_beats", resume: false }, "beats", beatsEta());
    // A plan that FAILED VALIDATION is not a stall: re-running the same inputs
    // mostly repeats it (the 6c e2e paid for 3 identical failures) — stop with
    // a clear free Retry instead. Stalls/provider errors are still resumed.
    // Same for a cost-cap stop: a re-run from scratch pays for the whole plan again
    // (f90160bc: two $0.25 plans thrown away at window 5 of 6).
    if (plan?.status === "failed" && /VALIDATION|COST_CAP/.test(String(plan.errorCode ?? ""))) return base({ kind: "fail", reason: /COST_CAP/.test(String(plan.errorCode)) ? "the scene plan hit its cost limit" : "the scene plan didn't pass its checks" }, "beats", beatsEta());
    if (plan?.status === "failed" || stale(beat, SCENE_TIMING.beatsS[1])) return resumeOr({ kind: "build_beats", resume: true }, "beats", "planning the scenes stalled", beatsEta());
    return base({ kind: "wait" }, "beats", beatsEta((now - ms(beat)) / 1000));
  }
  if (!PLAN_OK.has(plan.status)) {
    if (stale(plan.created_at, SCENE_TIMING.beatsS[1] + 120)) return resumeOr({ kind: "build_beats", resume: true }, "beats", "planning the scenes stalled", beatsEta());
    return base({ kind: "wait" }, "beats", beatsEta((now - ms(plan.created_at)) / 1000));
  }

  // 3. Drawing: one worker per scene, up to SCENE_CONCURRENCY at a time.
  if (img.total === 0) return base({ kind: "create_scenes", planId: plan.id }, "drawing", drawingEta(plan.beatCount, input.tier));
  const requeue = img.renderingExpired.filter((r) => r.attempts < SCENE_MAX_ATTEMPTS).map((r) => r.id);
  const fail = img.renderingExpired.filter((r) => r.attempts >= SCENE_MAX_ATTEMPTS).map((r) => r.id);
  const active = img.rendering - img.renderingExpired.length;
  const queued = img.queued + requeue.length;
  const eta = drawingEta(queued + active, input.tier);
  if (queued === 0 && active === 0) {
    // 2026-10-07, the first run only (a redraw of single scenes ends as before):
    //   - scenes that could not be drawn get ONE more free pass before the run ends (most
    //     failures are a provider's bad few minutes; the scene card would only say "Try again");
    //   - if then NOT ONE scene exists there is no video to make: the run fails and the whole
    //     hold goes back by itself. Otherwise the run is done and the failed scenes are covered.
    if (!sc.regenerating && img.failed > 0 && !sc.secondPassAt && !sc.gaveUpAt) return base({ kind: "retry_failed", planId: plan.id }, "drawing", drawingEta(img.failed, input.tier));
    if (!sc.regenerating && img.total > 0 && img.ready === 0) return base({ kind: "fail", reason: "no scene could be drawn" }, "drawing", [0, 0]);
    return base({ kind: "done" }, "done", [0, 0]);
  }
  if (!sc.regenerating && !sc.gaveUpAt && img.lastProgressAt && now - ms(img.lastProgressAt) > SCENES_NO_PROGRESS_MAX_S * 1000) return base({ kind: "give_up_drawing", planId: plan.id }, "drawing", [0, 0]);
  const slots = Math.max(0, Math.min(queued, SCENE_CONCURRENCY - active));
  if (slots === 0 && !requeue.length && !fail.length) return base({ kind: "wait" }, "drawing", eta);
  return base({ kind: "draw", planId: plan.id, slots, requeue, fail }, "drawing", eta);
}

// ---------- the review page's plain words (never codes, ids or prompts) ----------

// The Beat Director's own codes (measured on real plans), then broad fallbacks.
const EXACT_WORDS: Record<string, string> = {
  split_frame: "Split into two panels instead of one picture",
  ungrounded_name: "Mentions a name the picture may not show",
  concept_without_device: "The idea may be hard to read at a glance",
  abstract_concept: "The idea may be hard to read at a glance",
  crowd_without_group: "A crowd may look loose or unclear",
  short_text_rate: "Lots of on-screen words close together",
  subject_repeat: "Looks similar to nearby scenes",
  subject_run: "Looks similar to nearby scenes",
  viewer_missing: "The main character may be missing",
  establishing_without_place: "The place may be unclear",
  image_check_soft: "The picture looks mostly empty",
  image_failed: "This scene couldn't be drawn",
  text_mismatch: "The words in the picture may be wrong",
  ip_hit: "May show a brand or logo",
  duplicate: "Looks almost identical to another scene",
};
const WARNING_WORDS: [RegExp, string][] = [
  [/text|ocr|label|lettering/i, "The on-screen words may not match"],
  [/blank|uniform|empty/i, "The picture looks mostly empty"],
  [/viewer|cast|character/i, "The main character may be missing"],
  [/era|anachron/i, "Something may look out of its time period"],
  [/ip|lookalike|brand|logo/i, "May look too close to a known brand"],
  [/repeat|subject_run|same/i, "Looks similar to nearby scenes"],
  [/concept|abstract|still/i, "The idea may be hard to read at a glance"],
  [/fail|error/i, "This scene couldn't be drawn"],
];
export function plainWarning(code: string): string {
  if (EXACT_WORDS[code]) return EXACT_WORDS[code];
  for (const [re, words] of WARNING_WORDS) if (re.test(code)) return words;
  return "Worth a quick look";
}
// Phase 6c-polish: a user-facing FLAG is only a real, fixable image problem.
// The Beat Director's advisory notes ("hard to read at a glance", "looks
// similar to nearby scenes", ...) stay on the beat for the record but never
// flag a scene (f90160bc: 64 of 148 flagged, none of them a bad image).
export const USER_FLAG_CODES = new Set(["image_failed", "image_check_soft", "text_mismatch", "ip_hit", "duplicate", "split_frame"]);
export function plainWarnings(list: any[]): string[] {
  const out = new Set<string>();
  for (const w of list ?? []) {
    const code = typeof w === "string" ? w : String(w?.code ?? w?.message ?? "");
    if (USER_FLAG_CODES.has(code)) out.add(plainWarning(code));
  }
  return [...out];
}

// Which script segment (and chapter) a beat starts in, by word index.
export function segmentForWord(segments: { id: string; text: string; chapterId?: string }[], wordIndex: number) {
  let n = 0;
  for (const s of segments) {
    const w = String(s.text ?? "").trim().split(/\s+/).filter(Boolean).length;
    if (wordIndex < n + w) return s;
    n += w;
  }
  return segments[segments.length - 1] ?? null;
}

// Plain names in anything a person reads (Phase 6c-polish): the viewer is
// "you"/"your", a role archetype is "a hunter", a named character keeps its
// name — never "viewer_ancient" or "Viewer ancient's hands".
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function plainNames(text: string, bible: any): string {
  let s = String(text ?? "");
  // The viewer, in any spelling of the bible's own viewer ids (viewer_viking, "Viewer ancient") or plain "viewer".
  const viewerIds = [...(bible?.roleArchetypes ?? []), ...(bible?.recurringCharacters ?? [])].map((a: any) => String(a?.id ?? "")).filter((id) => /viewer/i.test(id));
  const forms = [...new Set([...viewerIds.flatMap((id) => [id, id.replace(/[_-]+/g, " ")]), "viewer"])].sort((a, b) => b.length - a.length).map(esc).join("|");
  const conj = (v: string) => (/^is$/i.test(v) ? "are" : /^has$/i.test(v) ? "have" : /^does$/i.test(v) ? "do" : /ies$/i.test(v) ? v.slice(0, -3) + "y" : /(ch|sh|x|ss|zz)es$/i.test(v) ? v.slice(0, -2) : /[^s]s$/i.test(v) ? v.slice(0, -1) : v);
  s = s.replace(new RegExp(`\\b(?:the\\s+)?(?:${forms})'s\\b`, "gi"), "your")
    // "Viewer viking pauses" -> "You pause" (the viewer as the subject of a verb).
    .replace(new RegExp(`(^|[.!?]\\s+)(?:the\\s+)?(?:${forms})\\s+(is|has|does|[a-z]+[^s\\s]s)\\b`, "gi"), (_m, pre, v) => `${pre}you ${conj(v)}`)
    .replace(new RegExp(`\\b(?:the\\s+)?(?:${forms})\\b`, "gi"), "you");
  // Only machine ids (snake_case) are rewritten — a plain word like "hunter" already reads fine.
  // A named/real person keeps their name ("ian_hodder" -> "Ian Hodder"); a role becomes "a stone age hunter".
  const titleCase = (s: string) => s.replace(/\b\w/g, (ch) => ch.toUpperCase());
  const people: { id: string; name: string }[] = [];
  for (const a of [...(bible?.roleArchetypes ?? []), ...(bible?.recurringCharacters ?? [])]) {
    const id = String(a?.id ?? "");
    if (!id.includes("_") || /viewer/i.test(id)) continue;
    const words = id.replace(/[_-]+/g, " ");
    const named = /\b(named|real|historical|historian|scientist|archaeologist)\b/i.test(String(a.role ?? a.name ?? "")) && !/\b(generic|archetyp)/i.test(String(a.role ?? ""));
    people.push({ id, name: a.name ? String(a.name) : named ? titleCase(words) : `a ${words}` });
  }
  for (const p of people) {
    const human = p.id.replace(/[_-]+/g, " ");
    s = s.replace(new RegExp(`\\b(?:${esc(p.id)}|${esc(human)})'s\\b`, "gi"), `${p.name}'s`).replace(new RegExp(`\\b(?:${esc(p.id)}|${esc(human)})\\b`, "gi"), p.name);
  }
  // Tidy: "you's" never happens (handled above); capitalize the first letter.
  s = s.replace(/\s+/g, " ").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

// One line a person can read: the contract's visual concept, trimmed.
export function sceneSummary(contract: any, override?: string | null): string {
  const s = String(override ?? contract?.userSummary ?? contract?.visualConcept ?? "").replace(/\s+/g, " ").trim();
  const first = s.split(/(?<=[.!?])\s/)[0] ?? s;
  return first.length > 120 ? `${first.slice(0, 117).trimEnd()}…` : first;
}

export const FAILED_SCENES_COPY = "Something went wrong while drawing your scenes. Retry — it's free.";
