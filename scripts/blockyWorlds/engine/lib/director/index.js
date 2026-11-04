// Blocky Worlds director: the one entry point.
//   directStory({ script, idea, provider, apiKey, model, gapLog, runId, storyId, exists, mood }) ->
//     { production, match, problems, costUsd, ms, provider, model, fellBack }
//   script: { lines: [{ part, text }] } (or null: the idea card's fields are read as lines, for topic-only runs)
//   provider: "mock" (free, lib/director/mock.js) | "anthropic" (paid: anthropicDirector) | an object with direct()
//   gapLog: lib/gaps.js makeGapLog(...) (optional): every gap the matcher finds is recorded with the run / story id
// Never throws and never fails a run: an AI error, refusal or bad answer gets one retry with the problems listed, then
// the mock director's list is used (fellBack: true). The planner can always plan without it, as today.
import { validateProduction } from "./spec.js";
import { matchProduction, nodeKit } from "./match.js";
import { mockProduction, linesOf } from "./mock.js";
import { anthropicDirector, DIRECTOR_MODELS } from "./design.js";

export { validateProduction, matchProduction, mockProduction, linesOf, nodeKit };

export async function directStory({ script = null, idea = null, provider = "mock", apiKey = null, model = DIRECTOR_MODELS.fast, gapLog = null, runId = null, storyId = null, exists = () => false, mood = null, kit = null, log = () => {}, source = null } = {}) {
  const t0 = Date.now();
  const lines = linesOf({ script, idea });
  const scriptLike = { lines };
  let raw = null, costUsd = 0, problems = [], fellBack = false, used = "mock", usedModel = null, error = null;
  const ai = typeof provider === "object" && provider?.direct ? provider : provider === "anthropic" && apiKey ? anthropicDirector({ apiKey, model }) : null;
  if (ai) {
    let feedback = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const r = await ai.direct({ lines, idea, feedback });
        costUsd += r.costUsd ?? 0; usedModel = r.model ?? ai.model ?? model;
        const v = validateProduction(r.data, { lineCount: lines.length });
        // only structural problems are worth a retry (a missing line, an unknown id); "on no line" is a note
        const hard = v.problems.filter((p) => !/is on no line/.test(p));
        raw = r.data; problems = v.problems; used = "anthropic";
        if (hard.length <= Math.max(2, Math.floor(lines.length * 0.05))) break;
        feedback = hard;
      } catch (e) {
        costUsd += e.costUsd ?? 0; error = e.message; log(`director: ${e.message}`);
        if (e.balance || e.refused) break;
      }
    }
    if (!raw) fellBack = true;
  }
  if (!raw) { raw = mockProduction({ script: scriptLike, idea }); used = "mock"; }
  const { production, problems: p2 } = validateProduction(raw, { lineCount: lines.length });
  if (used === "mock") problems = p2;
  const match = matchProduction(production, { kit: kit ?? nodeKit(), exists, script: scriptLike, mood: mood ?? idea?.mood ?? "horror", idea });
  if (gapLog) {
    try { await gapLog.record(match.gaps, { runId, storyId: storyId ?? runId ?? idea?.title ?? null, source: source ?? used, title: idea?.title ?? script?.title ?? null }); }
    catch (e) { log(`gap log: ${e.message}`); } // bookkeeping never fails a run
  }
  return { production, match, problems, costUsd: Number(costUsd.toFixed(5)), ms: Date.now() - t0, provider: used, model: usedModel, fellBack, error };
}
