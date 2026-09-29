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
export const SCENE_TIMING = {
  bibleS: [0, 90] as [number, number],       // normally frozen during the voice step already
  beatsS: [150, 240] as [number, number],   // 121-189 s measured (115-148 beats)
  // V3 measured on f90160bc (148 scenes): 9.6 s median, 17.2 s p90; V4 = V3 + best-of-2 on some beats.
  perSceneS: { V2: [9.7, 12.1], V3: [9.6, 17.2], V4: [14, 30] } as Record<string, [number, number]>,
  concurrency: 6,
};
export const SCENE_CONCURRENCY = SCENE_TIMING.concurrency;
export const SCENE_LEASE_S = 150;           // one scene: render (+ retry) + upscale, well inside the edge wall clock
export const SCENE_MAX_ATTEMPTS = 2;        // a scene whose worker died is re-queued once, then marked failed
export const WATCHDOG_GRACE_S = 90;
export const SCENES_MAX_RESUMES = 2;

// Credits per image by tier (the same prices as the project quote: GENERATE v2=2 / v3=3 / v4=4).
export const SCENE_CREDITS: Record<string, number> = { V2: 2, V3: 3, V4: 4 };
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
};

export type ScenesInput = {
  now: string;
  scenes: ScenesRecord;
  bible: { id: string; status: string; created_at: string } | null;
  // Phase 6d-1: the bible build logged as started (the lock's, usually) and whether it ended.
  bibleBuild?: { startedAt: string; ended: "done" | "failed" | null; endedAt: string | null } | null;
  plan: { id: string; status: string; created_at: string; beatCount: number; errorCode?: string | null } | null;
  images: { queued: number; rendering: number; renderingExpired: { id: string; attempts: number }[]; ready: number; failed: number; total: number };
  tier: string;
};

export type ScenesAction =
  | { kind: "build_bible"; resume: boolean }
  | { kind: "build_beats"; resume: boolean }
  | { kind: "create_scenes"; planId: string }
  | { kind: "draw"; planId: string; slots: number; requeue: string[]; fail: string[] }
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
  if (queued === 0 && active === 0) return base({ kind: "done" }, "done", [0, 0]);
  const slots = Math.max(0, Math.min(queued, SCENE_CONCURRENCY - active));
  if (slots === 0 && !requeue.length && !fail.length) return base({ kind: "wait" }, "drawing", eta);
  return base({ kind: "draw", planId: plan.id, slots, requeue, fail }, "drawing", eta);
}

// ---------- the review page's plain words (never codes, ids or prompts) ----------

// The Beat Director's own codes (measured on real plans), then broad fallbacks.
const EXACT_WORDS: Record<string, string> = {
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
export const USER_FLAG_CODES = new Set(["image_failed", "image_check_soft", "text_mismatch", "ip_hit", "duplicate"]);
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
