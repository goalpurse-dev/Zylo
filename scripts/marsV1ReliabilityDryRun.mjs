// Read-only replay of saved DB data. No credentials or network are used.
import fs from "node:fs";
import { refineVisualSequences, retimeVisualBeats, buildCompositionFingerprint } from "../supabase/functions/_shared/visualShotPlanning.js";
import { sequenceEpisode, resolveCanonicalCast } from "../supabase/functions/_shared/visualDirectorReliability.js";
import { preflightEpisode } from "../supabase/functions/_shared/episodePreflight.ts";
globalThis.fetch = () => { throw new Error("NETWORK_FORBIDDEN_IN_DRY_RUN"); };
const root = "artifacts/mars-forensic/";
const input = JSON.parse(fs.readFileSync(root + "v1-reliability-input.json", "utf8"));
const plan = retimeVisualBeats(refineVisualSequences(input.plan.visual_plan, input.script.script_document, "balanced", input.contract.claims), input.script.script_document);
plan.narrationContractVersionId = input.contract.id;
sequenceEpisode(plan.visualBeats);
const context = { project: input.project, plan, contract: input.contract, world: input.world, assets: input.references };
const preflight = preflightEpisode(context);
const beats = plan.visualBeats;
const longest = key => { let last, run = 0, max = 0; for (const b of beats) { const k = key(b); run = k && k === last ? run + 1 : k ? 1 : 0; max = Math.max(max, run); last = k; } return max; };
const cast = {};
for (const entity of plan.entityRegistry.filter(e => e.category === "CHARACTER")) {
  const present = beats.filter(b => b.castBindings?.some(c => c.characterId === entity.id));
  cast[entity.id] = { shots: present.map(b => b.sequenceIndex), chapters: [...new Set(present.map(b => b.chapterId))] };
}
const summary = {
  sourcePlanId: input.plan.id, sourcePlanVersion: input.plan.version,
  contractReused: true, contractCompiledDuringRun: false, contractVersionId: input.contract.id,
  storedClaims: input.contract.claims.length, totalBeats: beats.length,
  boundBeats: beats.filter(b => b.narrationClaimId).length,
  missingClaimShots: beats.filter(b => !b.narrationClaimId).map(b => b.sequenceIndex),
  strategies: beats.reduce((a, b) => (a[b.renderMethod] = (a[b.renderMethod] ?? 0) + 1, a), {}),
  longestEditChain: longest(b => b.renderMethod === "EDIT" ? "edit" : null),
  longestCompositionChain: longest(b => b.renderMethod === "PROGRAMMATIC_GRAPHIC" ? null : JSON.stringify({ ...buildCompositionFingerprint(b), baseSetupKey: null })),
  longestGraphicChain: longest(b => b.renderMethod === "PROGRAMMATIC_GRAPHIC" ? "graphic" : null),
  graphicShots: beats.filter(b => b.renderMethod === "PROGRAMMATIC_GRAPHIC").map(b => b.sequenceIndex),
  cast,
  aliases: Object.fromEntries(["farmer greenhouse", "battery solar power", "suit mechanical repairs"].map(text => [text, resolveCanonicalCast(text, plan.entityRegistry)])),
  exactTextShots: beats.filter(b => b.exactText).map(b => ({ shot: b.sequenceIndex, text: b.exactText, reserved: b.reserveTextSafeArea })),
  compiledBeats: preflight.compiled.length, preflightPassed: preflight.ok,
  compiledGenerateStyleCoverage: preflight.compiled.filter(b => b.renderStrategy === "GENERATE").every(b => ["Linework:", "Shading:", "Texture:", "Palette:", "Proportions:", "Lighting:", "Perspective:"].every(t => b.imagePrompt.includes(t))),
  errors: preflight.errors, providerCalls: 0, creditsCharged: 0, pointersChanged: false,
};
fs.writeFileSync(root + "v1-reliability-dry-run.json", JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ ...summary, errors: Object.entries(summary.errors.reduce((a, e) => (a[e.reason.split(":")[0]] = (a[e.reason.split(":")[0]] ?? 0) + 1, a), {})) }, null, 2));
