import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// 2026-09-20 real incident, round 3 — "If the Sun Vanished Right Now" v3
// (visual plan 45a54a50-...): chapter-bounded planning still ran 7 chapters
// SERIALLY (~8.5 min), failed on a fabricated locationId ("space diagram")
// for an abstract diagram beat, and still produced a wrong 328s duration
// despite the prior sequencing fix. Also: v2 (70cc0cdf-...) finished
// validation cleanly but never got adopted because its parent (v1) had
// failed, not succeeded — the old auto-promotion rule couldn't tell "retry
// of a failed attempt" from "explicit replan of usable work." Source-
// structural tests (this Node runtime can't resolve this file's own "jsr:"
// Deno import — a pre-existing, unrelated environment gap).

const src = fs.readFileSync(new URL("../supabase/functions/advance-long-form-visual-plan/index.ts", import.meta.url), "utf8");
const migrationSql = fs.readFileSync(new URL("../supabase/migrations/20260930410000_long_form_visual_plan_admin_promote.sql", import.meta.url), "utf8");

/* ---- Task 3: bounded chapter concurrency ---- */

test("chapters are planned in bounded concurrent waves (MAX_CHAPTER_CONCURRENCY=4), not one per invocation", () => {
  assert.match(src, /const MAX_CHAPTER_CONCURRENCY = 4;/);
  const fn = src.slice(src.indexOf("async function planNextChapter"), src.indexOf("function normalizeEpisodeSequencing"));
  assert.match(fn, /const wave = pending\.slice\(0, MAX_CHAPTER_CONCURRENCY\);/);
  assert.match(fn, /await Promise\.all\(\s*wave\.map\(async \(chapter: any\) => \{/);
});

test("a chapter's own failure is caught per-chapter and never blocks its wave-mates from persisting", () => {
  const fn = src.slice(src.indexOf("async function planNextChapter"), src.indexOf("function normalizeEpisodeSequencing"));
  assert.match(fn, /try \{\s*\n\s*const chapterPlan = await runVisualDirectorForChapter/);
  assert.match(fn, /return \{ chapterId: chapter\.chapterId as string, ok: false as const, usage \};/);
});

test("a failed chapter is never added to plannedChapterIds — it's retried alone next invocation, never duplicated", () => {
  const fn = src.slice(src.indexOf("async function planNextChapter"), src.indexOf("function normalizeEpisodeSequencing"));
  assert.match(fn, /if \(!o\.ok\) continue; \/\/ left out of plannedChapterIds/);
});

test("if an ENTIRE wave fails (zero progress), it throws through the normal handleStageFailure path rather than silently resetting stage_attempt with nothing persisted", () => {
  const fn = src.slice(src.indexOf("async function planNextChapter"), src.indexOf("function normalizeEpisodeSequencing"));
  assert.match(fn, /if \(nextPlanned\.length === plannedChapterIds\.length\) \{\s*\n\s*throw new Error\(`chapter_planning_wave_failed/);
});

test("reserve() is still spent exactly once for the whole phase, regardless of wave size", () => {
  const fn = src.slice(src.indexOf("async function planNextChapter"), src.indexOf("function normalizeEpisodeSequencing"));
  const reserveCalls = [...fn.matchAll(/await reserve\(\);/g)];
  assert.equal(reserveCalls.length, 1);
  assert.match(fn, /if \(!plannedChapterIds\.length\) await reserve\(\);/);
});

/* ---- Task 2 (round 4, v4): real locationId canonicalization ---- */

test("normalizeLocationIds is a real canonicalization pass, not just an abstract-type strip — resolveLocationId exists with entity/keyword resolution", () => {
  const fn = src.slice(src.indexOf("function resolveLocationId"), src.indexOf("function normalizeLocationIds") + 700);
  assert.match(fn, /if \(locationIds\.has\(rawLocationId\)\) return rawLocationId;/);
  assert.match(fn, /if \(ABSTRACT_LOCATION_PATTERNS\.some\(\(re\) => re\.test\(normalized\)\)\) return null;/);
  assert.match(fn, /const directEntityMatch = \(contextEntityIds \?\? \[\]\)\.find\(\(id\) => locationIds\.has\(id\)\);/);
  assert.match(fn, /return bestScore > 0 \? best : null;/);
});

test("normalizeLocationIds runs before validateVisualPlan for BOTH the chapter-bounded and legacy paths, and covers BOTH visualBeats and continuityGroups", () => {
  const stageFn = src.slice(src.indexOf("async function stagePlanning"), src.indexOf("async function stageFinalizing"));
  const normIdx = stageFn.indexOf("plan = normalizeLocationIds(plan);");
  const validateIdx = stageFn.indexOf("let result = validateVisualPlan(plan, scriptDocument, validFactIds);");
  assert.ok(normIdx > -1 && validateIdx > -1 && normIdx < validateIdx);
  const fn = src.slice(src.indexOf("function normalizeLocationIds"), src.indexOf("function normalizeLocationIds") + 700);
  assert.match(fn, /const continuityGroups = \(plan\.continuityGroups \?\? \[\]\)\.map/);
});

// Behavioral proof against the real v4 reported case — mirrors
// resolveLocationId/normalizeLocationIds exactly (verified structurally
// above against the real source).
const ABSTRACT_LOCATION_PATTERNS_SIM = [/\bsystem wide\b/, /\bcross section\b/, /\bdiagram\b/, /\btimeline\b/, /\bschematic\b/, /\bwide shot\b/];
const STOPWORDS_SIM = new Set(["the", "and", "for", "with", "view", "shot", "scene", "close", "closeup", "outdoor", "indoor"]);
function tokenizeSim(text) {
  return new Set((text || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter((w) => w.length >= 3 && !STOPWORDS_SIM.has(w)));
}
function resolveLocationIdSim(rawLocationId, contextEntityIds, locationEntities, extraText) {
  if (!rawLocationId) return null;
  const locationIds = new Set(locationEntities.map((e) => e.id));
  if (locationIds.has(rawLocationId)) return rawLocationId;
  const normalized = rawLocationId.toLowerCase().replace(/[^a-z0-9]+/g, " ");
  if (ABSTRACT_LOCATION_PATTERNS_SIM.some((re) => re.test(normalized))) return null;
  const directEntityMatch = (contextEntityIds ?? []).find((id) => locationIds.has(id));
  if (directEntityMatch) return directEntityMatch;
  const words = tokenizeSim(`${rawLocationId} ${extraText ?? ""}`);
  let best = null, bestScore = 0;
  for (const loc of locationEntities) {
    const locWords = tokenizeSim(`${loc.id} ${loc.name ?? ""}`);
    let score = 0;
    for (const w of locWords) if (words.has(w)) score++;
    if (score > bestScore) { bestScore = score; best = loc.id; }
  }
  return bestScore > 0 ? best : null;
}

test("BEHAVIORAL: reproduces every real v4 locationId defect and its correct resolution", () => {
  const locationEntities = [
    { id: "Earth", name: "Earth (daylit hemisphere)", category: "LOCATION" },
    { id: "field_crops", name: "farmland / exposed crops", category: "LOCATION" },
    { id: "city_emergency_center", name: "city / emergency operations center", category: "LOCATION" },
  ];
  // earth_surface_closeup_lab: no location entity in context, resolved by keyword overlap with "Earth".
  assert.equal(resolveLocationIdSim("earth_surface_closeup_lab", ["ENT_PV_PANEL", "ENT_CAMERA_SENSOR"], locationEntities), "Earth");
  // earth_horizon_outdoor: same keyword-overlap path.
  assert.equal(resolveLocationIdSim("earth_horizon_outdoor", ["ENT_ATMOSPHERE", "ENT_SKY"], locationEntities), "Earth");
  // global_cross_section_land: "cross section" is an explicit abstract phrase -> null, even though "Earth" is a context entity.
  assert.equal(resolveLocationIdSim("global_cross_section_land", ["land", "Earth"], locationEntities), null);
  // solar system-wide: "system wide" is an explicit abstract phrase -> null, even though "Earth" is a context entity.
  assert.equal(resolveLocationIdSim("solar system-wide", ["Sun", "Earth", "Moon"], locationEntities), null);
  // space-to-Earth view: not abstract, and "Earth" IS a context entity (direct match) -> Earth.
  assert.equal(resolveLocationIdSim("space-to-Earth view", ["Earth", "ENT_TIMELINE_GRAPHIC"], locationEntities), "Earth");
  // continuity group "infrastructure_and_biology" with label "Field / grid / plant lab montage": keyword overlap on "field" via the label -> field_crops.
  assert.equal(resolveLocationIdSim("infrastructure_and_biology", ["ENT_POWER_GRID", "ENT_PLANT_LEAF"], locationEntities, "Field / grid / plant lab montage"), "field_crops");
  // A genuine physical claim with a truly unresolvable id and no matching keywords stays null (never a wrong guess).
  assert.equal(resolveLocationIdSim("xyz_totally_unrelated_string", ["ENT_UNKNOWN"], locationEntities), null);
});

/* ---- Task 4 (round 4, v4): duration/timeline derived ONLY from real narration segment spans ---- */

test("a beat's start/end are derived from its EARLIEST and LATEST referenced narration segment's real cumulative span — never the model's own chapter-local duration guess", () => {
  const fn = src.slice(src.indexOf("function normalizeEpisodeSequencing"), src.indexOf("function resolveLocationId"));
  assert.match(fn, /rawStart = Math\.min\(\.\.\.resolvedIds\.map\(\(id: string\) => segmentStart\.get\(id\) as number\)\);/);
  assert.match(fn, /rawEnd = Math\.max\(\.\.\.resolvedIds\.map\(\(id: string\) => segmentEnd\.get\(id\) as number\)\);/);
});

test("an unresolvable beat (no matching narration segment at all) falls back to its OWN chapter's real anchor, never a bare chapter-local value assuming the chapter starts at 0", () => {
  const fn = src.slice(src.indexOf("function normalizeEpisodeSequencing"), src.indexOf("function resolveLocationId"));
  assert.match(fn, /const chapterStart = new Map<string, number>\(\);/);
  assert.match(fn, /rawStart = \(chapterStart\.get\(b\.chapterId\) \?\? floor\) \+ \(b\.estimatedStartSeconds \?\? 0\);/);
});

test("a hard monotonic floor guarantees the timeline can never regress, and a beat's own real duration is preserved (shifted, not truncated) when the floor pushes it forward", () => {
  const fn = src.slice(src.indexOf("function normalizeEpisodeSequencing"), src.indexOf("function resolveLocationId"));
  assert.match(fn, /const start = Math\.max\(rawStart, floor\);/);
  assert.match(fn, /const delta = start - rawStart;/);
  assert.match(fn, /const end = Math\.max\(start \+ 1, rawEnd \+ delta\);/);
  assert.match(fn, /floor = end;/);
});

test("BEHAVIORAL: final plan duration tracks the real script length even when beats' own chapter-local timing is wildly compressed", () => {
  // Mirrors the real repro shape: 7 chapters worth of segments summing to
  // ~628s, but every beat's own chapter-local estimatedStartSeconds/
  // estimatedEndSeconds is compressed into a tiny 0-50s range regardless of
  // how long the chapter really is (exactly what produced 362s in production).
  const scriptDocument = {
    chapters: Array.from({ length: 7 }, (_, i) => ({ chapterId: `ch${i + 1}` })),
    narrationSegments: Array.from({ length: 14 }, (_, i) => ({
      id: `s${i + 1}`,
      chapterId: `ch${Math.floor(i / 2) + 1}`,
      sequenceIndex: i,
      estimatedSeconds: 45, // 14 segments x 45s = 630s total, close to the real 628s
    })),
  };
  const visualBeats = [];
  for (let c = 1; c <= 7; c++) {
    const segA = `s${(c - 1) * 2 + 1}`, segB = `s${(c - 1) * 2 + 2}`;
    visualBeats.push({ id: `vb_ch${c}_1`, chapterId: `ch${c}`, sequenceIndex: 0, narrationSegmentIds: [segA], estimatedStartSeconds: 0, estimatedEndSeconds: 20 });
    visualBeats.push({ id: `vb_ch${c}_2`, chapterId: `ch${c}`, sequenceIndex: 1, narrationSegmentIds: [segB], estimatedStartSeconds: 20, estimatedEndSeconds: 40 });
  }
  const plan = { visualBeats };

  function normalizeEpisodeSequencingSim(plan, scriptDocument) {
    const chapters = scriptDocument.chapters ?? [];
    const segments = scriptDocument.narrationSegments ?? [];
    const chapterOrder = new Map(chapters.map((c, i) => [c.chapterId, i]));
    const orderedSegments = [...segments].sort((a, b) => a.sequenceIndex - b.sequenceIndex);
    const segmentStart = new Map(), segmentEnd = new Map();
    let cursor = 0;
    for (const s of orderedSegments) { segmentStart.set(s.id, cursor); cursor += s.estimatedSeconds ?? 0; segmentEnd.set(s.id, cursor); }
    const chapterStart = new Map();
    for (const c of chapters) { const firstSeg = orderedSegments.find((s) => s.chapterId === c.chapterId); chapterStart.set(c.chapterId, firstSeg ? segmentStart.get(firstSeg.id) : 0); }
    const beats = [...(plan.visualBeats ?? [])].sort((a, b) => { const ca = chapterOrder.get(a.chapterId) ?? 0, cb = chapterOrder.get(b.chapterId) ?? 0; return ca !== cb ? ca - cb : (a.sequenceIndex ?? 0) - (b.sequenceIndex ?? 0); });
    let floor = 0;
    const normalizedBeats = beats.map((b, i) => {
      const resolvedIds = (b.narrationSegmentIds ?? []).filter((id) => segmentStart.has(id));
      let rawStart, rawEnd;
      if (resolvedIds.length) { rawStart = Math.min(...resolvedIds.map((id) => segmentStart.get(id))); rawEnd = Math.max(...resolvedIds.map((id) => segmentEnd.get(id))); }
      else { const localDuration = Math.max(1, (b.estimatedEndSeconds ?? 0) - (b.estimatedStartSeconds ?? 0)); rawStart = (chapterStart.get(b.chapterId) ?? floor) + (b.estimatedStartSeconds ?? 0); rawEnd = rawStart + localDuration; }
      const start = Math.max(rawStart, floor);
      const delta = start - rawStart;
      const end = Math.max(start + 1, rawEnd + delta);
      floor = end;
      return { ...b, chapterLocalSequenceIndex: b.sequenceIndex, sequenceIndex: i, estimatedStartSeconds: start, estimatedEndSeconds: end };
    });
    return { ...plan, visualBeats: normalizedBeats };
  }

  const fixed = normalizeEpisodeSequencingSim(plan, scriptDocument);
  const totalScriptSeconds = 630;
  const finalDuration = Math.max(...fixed.visualBeats.map((b) => b.estimatedEndSeconds));
  const divergence = Math.abs(finalDuration - totalScriptSeconds) / totalScriptSeconds;
  assert.ok(divergence < 0.1, `final duration (${finalDuration}s) must track the real script duration (${totalScriptSeconds}s) — the exact real bug produced 362s vs 628s here`);
  for (let i = 1; i < fixed.visualBeats.length; i++) {
    assert.ok(fixed.visualBeats[i].estimatedStartSeconds >= fixed.visualBeats[i - 1].estimatedStartSeconds, `beat ${i} must not start before the previous beat`);
  }
});

/* ---- Task 5: auto-promotion rule ---- */

test("auto-promotion now checks whether the project's CURRENT plan is actually ready, not whether this new plan has a parent — a failed parent must not force manual review", () => {
  const fn = src.slice(src.indexOf("const { data: currentProjectPointer }"), src.indexOf("const { data: currentProjectPointer }") + 900);
  assert.match(fn, /currentIsUsable = currentPlan\?\.status === "ready";/);
  assert.match(fn, /if \(!currentIsUsable\) \{/);
  assert.doesNotMatch(fn, /parent_visual_plan_version_id == null/);
});

test("admin_promote_visual_plan_version mirrors adopt_visual_plan_version's real checks (status ready, script version matches) and refuses to clobber an existing adopted READY plan", () => {
  assert.match(migrationSql, /if v\.status is distinct from 'ready' then raise exception 'VISUAL_PLAN_NOT_READY'; end if;/);
  assert.match(migrationSql, /if proj\.current_script_version_id is distinct from v\.script_version_id then raise exception 'SCRIPT_HAS_CHANGED_SINCE_THIS_PLAN'; end if;/);
  assert.match(migrationSql, /raise exception 'PROJECT_ALREADY_HAS_AN_ADOPTED_PLAN';/);
});

test("admin_promote_visual_plan_version is granted ONLY to service_role, never to client-facing roles", () => {
  assert.match(migrationSql, /revoke all on function public\.admin_promote_visual_plan_version\(uuid\) from public, anon, authenticated;/);
  assert.match(migrationSql, /grant execute on function public\.admin_promote_visual_plan_version\(uuid\) to service_role;/);
});
