import fs from "node:fs";
import path from "node:path";
import { preflightEpisode } from "../supabase/functions/_shared/episodePreflight.ts";
import { normalizeSemanticPrompt, semanticPromptSimilarity } from "../supabase/functions/_shared/scenePromptQuality.ts";

const root = path.resolve(import.meta.dirname, "..");
const input = JSON.parse(fs.readFileSync(path.join(root, "artifacts/sun-prompt-audit/live-input.json"), "utf8"));
const before = JSON.parse(fs.readFileSync(path.join(root, "artifacts/sun-prompt-audit/all-scene-prompts.json"), "utf8"));
const context = { project: input.project, plan: input.plan.visual_plan, world: input.world, assets: input.assets, contract: input.contract };
const result = preflightEpisode(context);
if (!result.ok) throw new Error(`Sun dry-run preflight failed: ${JSON.stringify(result.errors.slice(0, 20))}`);

const countBy = (items, key) => items.reduce((out, item) => {
  const value = typeof key === "function" ? key(item) : item[key];
  out[value] = (out[value] ?? 0) + 1;
  return out;
}, {});

const familyStats = (items, promptOf, threshold = 0.9) => {
  const prompts = items.map((item) => ({ item, prompt: promptOf(item) })).filter((entry) => entry.prompt);
  const exact = new Map();
  for (const entry of prompts) {
    const key = entry.prompt.trim();
    if (!exact.has(key)) exact.set(key, []);
    exact.get(key).push(entry.item);
  }
  const exactFamilies = [...exact.values()].filter((family) => family.length > 1);
  const parent = prompts.map((_, index) => index);
  const find = (i) => parent[i] === i ? i : (parent[i] = find(parent[i]));
  const join = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[b] = a; };
  for (let i = 0; i < prompts.length; i++) for (let j = i + 1; j < prompts.length; j++) {
    if (semanticPromptSimilarity(prompts[i].prompt, prompts[j].prompt) >= threshold) join(i, j);
  }
  const near = new Map();
  prompts.forEach((entry, index) => {
    const rootIndex = find(index);
    if (!near.has(rootIndex)) near.set(rootIndex, []);
    near.get(rootIndex).push(entry.item);
  });
  const nearFamilies = [...near.values()].filter((family) => family.length > 1).sort((a, b) => b.length - a.length);
  return {
    promptCount: prompts.length,
    uniqueExactPrompts: exact.size,
    exactDuplicateFamilyCount: exactFamilies.length,
    largestExactDuplicateFamily: Math.max(1, ...exactFamilies.map((family) => family.length)),
    nearDuplicateThreshold: threshold,
    nearDuplicateFamilyCount: nearFamilies.length,
    largestNearDuplicateFamily: Math.max(1, ...nearFamilies.map((family) => family.length)),
    largestNearFamilyShots: nearFamilies[0]?.map((item) => item.shotNumber ?? item.sequenceIndex ?? item.beatId) ?? [],
  };
};

const compiledById = new Map(result.compiled.map((entry) => [entry.beatId, entry]));
const scenes = result.preparedPlan.visualBeats.map((beat, index) => {
  const compiled = compiledById.get(beat.id);
  return {
    shotNumber: index + 1,
    shotId: beat.id,
    chapterId: beat.chapterId,
    sequenceId: beat.sequenceId,
    narrationRange: beat.narrationRanges ?? [],
    narrationText: beat.shotNarrationText,
    renderMethod: compiled.renderStrategy,
    uniqueVisualPurpose: beat.shotPurpose,
    subject: beat.subject,
    actionOrState: beat.actionOrState,
    visualDelta: beat.visualDelta,
    referenceIds: compiled.referenceAssetIds,
    referenceRoles: compiled.referenceRoles,
    styleReferenceStatus: compiled.renderStrategy === "GENERATE"
      ? (compiled.referenceRoles.some((role) => role.role === "STYLE_REFERENCE") ? "attached" : "historical_world_has_no_style_only_asset")
      : "not_applicable",
    overlayText: compiled.exactText,
    overlayRequirement: beat.overlayRequirement ?? null,
    graphicSpec: compiled.overlaySpec,
    finalPositivePrompt: compiled.imagePrompt,
    finalNegativePrompt: compiled.negativePrompt,
    duplicateGate: beat.duplicateGate ?? null,
    sourceBeatId: compiled.sourceBeatId,
  };
});

const beforeMethods = countBy(before.scenes, (scene) => scene.layers.visualPlan.strategy);
const afterMethods = countBy(scenes, "renderMethod");
const beforeRaster = before.scenes.filter((scene) => scene.layers.compiledScenePrompt?.positivePrompt);
const afterRaster = scenes.filter((scene) => ["GENERATE", "EDIT"].includes(scene.renderMethod) && scene.finalPositivePrompt);
const beforeFamilies = familyStats(beforeRaster, (scene) => scene.layers.compiledScenePrompt.positivePrompt);
const afterFamilies = familyStats(afterRaster.filter((scene) => scene.renderMethod === "GENERATE"), (scene) => scene.finalPositivePrompt);
const chapter5After = scenes.filter((scene) => scene.chapterId === "ch5");
const report = {
  projectId: input.project.id,
  generatedAt: new Date().toISOString(),
  dryRun: true,
  providerSubmissions: 0,
  creditsCharged: 0,
  historicalStyleReferenceNote: "This preserved Sun world predates the style-only asset role. Its dry-run prompts still carry the full textual Style Bible. Newly planned worlds require a canonical STYLE_REFERENCE asset before GENERATE preflight can pass.",
  summary: {
    totalBeats: scenes.length,
    beforeRenderMethods: beforeMethods,
    afterRenderMethods: afterMethods,
    beforePromptAnalysis: beforeFamilies,
    afterGeneratePromptAnalysis: afterFamilies,
    estimatedProviderImageOperationsBefore: beforeRaster.length,
    estimatedProviderImageOperationsAfter: afterRaster.length,
    chapter5: {
      totalBeats: chapter5After.length,
      renderMethods: countBy(chapter5After, "renderMethod"),
      generatePromptAnalysis: familyStats(chapter5After.filter((scene) => scene.renderMethod === "GENERATE"), (scene) => scene.finalPositivePrompt),
    },
  },
  scenes,
};

const outDir = path.join(root, "artifacts/sun-visual-fix");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "scene-plan-after.json"), JSON.stringify(report, null, 2));

const s = report.summary;
const markdown = `# Sun visual fix — duplicate analysis after\n\n` +
`Dry-run only. Provider submissions: **0**. Credits charged: **0**.\n\n` +
`Semantic near-duplicate families use the same tested normalization and **${s.afterGeneratePromptAnalysis.nearDuplicateThreshold}** threshold as the pre-render quality assertion. Style, camera, punctuation, whitespace, render rules, text-safe rules, and reference boilerplate are excluded before comparison.\n\n` +
`| Metric | Before | After |\n|---|---:|---:|\n` +
`| Total beats | ${before.summary.planBeatCount} | ${s.totalBeats} |\n` +
`| GENERATE | ${beforeMethods.GENERATE ?? 0} | ${afterMethods.GENERATE ?? 0} |\n` +
`| EDIT | ${beforeMethods.EDIT ?? 0} | ${afterMethods.EDIT ?? 0} |\n` +
`| REUSE | ${beforeMethods.REUSE ?? 0} | ${afterMethods.REUSE ?? 0} |\n` +
`| CROP | ${beforeMethods.CROP ?? 0} | ${afterMethods.CROP ?? 0} |\n` +
`| COMPOSITE | ${beforeMethods.COMPOSITE ?? 0} | ${afterMethods.COMPOSITE ?? 0} |\n` +
`| PROGRAMMATIC_GRAPHIC | ${beforeMethods.PROGRAMMATIC_GRAPHIC ?? 0} | ${afterMethods.PROGRAMMATIC_GRAPHIC ?? 0} |\n` +
`| Estimated provider image operations | ${s.estimatedProviderImageOperationsBefore} | ${s.estimatedProviderImageOperationsAfter} |\n` +
`| Unique exact raster prompts | ${s.beforePromptAnalysis.uniqueExactPrompts} | ${new Set(afterRaster.map((scene) => scene.finalPositivePrompt)).size} |\n` +
`| Exact duplicate prompt families | ${s.beforePromptAnalysis.exactDuplicateFamilyCount} | ${familyStats(afterRaster, (scene) => scene.finalPositivePrompt).exactDuplicateFamilyCount} |\n` +
`| Largest exact duplicate family | ${s.beforePromptAnalysis.largestExactDuplicateFamily} | ${familyStats(afterRaster, (scene) => scene.finalPositivePrompt).largestExactDuplicateFamily} |\n` +
`| Near-duplicate GENERATE families | ${s.beforePromptAnalysis.nearDuplicateFamilyCount} | ${s.afterGeneratePromptAnalysis.nearDuplicateFamilyCount} |\n` +
`| Largest near-duplicate GENERATE family | ${s.beforePromptAnalysis.largestNearDuplicateFamily} | ${s.afterGeneratePromptAnalysis.largestNearDuplicateFamily} |\n\n` +
`## Chapter 5\n\n` +
`- Beats: ${s.chapter5.totalBeats}\n- Render methods: ${JSON.stringify(s.chapter5.renderMethods)}\n` +
`- Unique GENERATE prompts: ${s.chapter5.generatePromptAnalysis.uniqueExactPrompts}/${s.chapter5.generatePromptAnalysis.promptCount}\n` +
`- Largest near-duplicate GENERATE family: ${s.chapter5.generatePromptAnalysis.largestNearDuplicateFamily}\n\n` +
`## Historical style-reference constraint\n\n${report.historicalStyleReferenceNote}\n`;
fs.writeFileSync(path.join(outDir, "duplicate-analysis-after.md"), markdown);

const requested = [1,2,3,4,5,6,16,21,36,38,44,45,48,50,51,60,90,120,150,190];
const representative = requested.map((number) => scenes[number - 1]);
const promptMarkdown = representative.map((scene) => `## Shot ${scene.shotNumber} — ${scene.renderMethod}\n\n` +
`**Narration:** ${scene.narrationText}\n\n**Purpose:** ${scene.uniqueVisualPurpose}\n\n` +
`**Subject/action:** ${scene.subject} — ${scene.actionOrState}\n\n**Visual delta:** ${scene.visualDelta}\n\n` +
`**References:** ${scene.referenceRoles.length ? scene.referenceRoles.map((role) => `${role.role}:${role.represents}`).join(", ") : "none"}\n\n` +
`**Overlay/graphic:** ${scene.overlayText ?? (scene.graphicSpec ? JSON.stringify(scene.graphicSpec) : "none")}\n\n` +
`**Positive prompt:**\n\n\`\`\`text\n${scene.finalPositivePrompt ?? "(No raster prompt; deterministic derived or programmatic render.)"}\n\`\`\`\n\n` +
`**Negative prompt:** ${scene.finalNegativePrompt ?? "(not applicable)"}\n`).join("\n");
fs.writeFileSync(path.join(outDir, "representative-shot-prompts.md"), `# Representative corrected Sun shot plans and prompts\n\n${promptMarkdown}`);

console.log(JSON.stringify(report.summary, null, 2));
