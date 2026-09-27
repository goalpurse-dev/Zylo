// Phase 3 — compile standalone image prompts for the Myth vs Reality plan
// (offline, $0). Usage: npx -y deno@2.9.6 run -A scripts/phase3CompilePrompts.ts
// Inputs: the frozen bible (recorded plan), the retimed beat plan, and the
// handwritten canonical blocks. Outputs: docs/phase3/myth-vs-reality.prompts.{md,json}.
import { compilePlan, STYLE_CONTRACT_VERSION } from "../supabase/functions/_shared/stickman/promptCompiler.ts";
import { buildWordStream } from "../supabase/functions/_shared/stickman/beatDirector.ts";

const root = new URL("../", import.meta.url);
const read = async (p: string) => JSON.parse(await Deno.readTextFile(new URL(p, root)));
const recorded = await read("tests/fixtures/stickman/beats/myth-vs-reality.recorded.json");
const retimed = await read("tests/fixtures/stickman/beats/myth-vs-reality.recorded.retimed.json");
const fixture = await read("tests/fixtures/stickman/bibles/myth-vs-reality.canonical.json");
const { _note: _n, ...annotations } = await read("tests/fixtures/stickman/beats/myth-vs-reality.annotations.json");

const stream = buildWordStream(recorded.segments);
const plantIdx = stream.words.filter((w) => w.segmentId === recorded.callback.plantSegmentId).map((w) => w.index);
const out = compilePlan(retimed.beats, recorded.bible, { fixture, annotations, plantWordRange: plantIdx.length ? [plantIdx[0], plantIdx[plantIdx.length - 1]] : null });

const fmt = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;
const chars = out.prompts.map((p) => p.chars).sort((a, b) => a - b);
const failed = out.prompts.filter((p) => p.lintErrors.length);
const stats = {
  compiled: out.prompts.length,
  skippedNeedsConcept: out.skipped,
  lintFailed: failed.map((p) => ({ beat: p.sequence, errors: p.lintErrors })),
  integrity: out.integrity,
  chars: { median: chars[Math.floor(chars.length / 2)], max: chars[chars.length - 1], over2000: chars.filter((c) => c > 2000).length, over4000: chars.filter((c) => c > 4000).length },
  estTokensMax: Math.max(...out.prompts.map((p) => p.estTokens)),
  conceptsSanitized: out.prompts.filter((p) => p.conceptSanitized).map((p) => p.sequence),
  compositeSplit: out.prompts.filter((p) => p.renderPolicy === "COMPOSITE_SPLIT").map((p) => p.sequence),
  textResolutions: out.prompts.filter((p) => p.textResolution).map((p) => ({ beat: p.sequence, ...p.textResolution })),
  textContradictions: out.prompts.filter((p) => p.lintErrors.includes("text_contradiction")).length,
  wornItems: out.prompts.filter((p) => p.prompt.includes(" Wearing: ")).map((p) => p.sequence),
  layouts: out.prompts.filter((p) => /On the left: /.test(p.prompt)).map((p) => p.sequence),
  blockSources: { cast: Object.fromEntries(Object.entries(out.set.cast).map(([k, v]) => [k, v.source])), settings: Object.values(out.set.settings).map((s) => s.source), props: Object.values(out.set.props).map((p) => p.source) },
};

await Deno.mkdir(new URL("docs/phase3/", root), { recursive: true });
await Deno.writeTextFile(new URL("docs/phase3/myth-vs-reality.prompts.json", root), JSON.stringify({ styleContractVersion: STYLE_CONTRACT_VERSION, source: "tests/fixtures/stickman/beats/myth-vs-reality.recorded.retimed.json", stats, prompts: out.prompts.map((p) => ({ sequence: p.sequence, time: `${fmt(p.startMs)}–${fmt(p.endMs)}`, narration: p.narration, userSummary: p.userSummary, treatment: p.treatment, renderPolicy: p.renderPolicy, textIntent: p.textIntent, prompt: p.prompt, positivePrompt: p.positivePrompt, negativePrompt: p.negativePrompt, ...(p.halves ? { halves: p.halves } : {}), chars: p.chars, estTokens: p.estTokens, trimmed: p.trimmed, textResolution: p.textResolution, lintErrors: p.lintErrors, lintWarnings: p.lintWarnings })) }, null, 2));

const md = [
  `# Myth vs Reality — compiled image prompts (${STYLE_CONTRACT_VERSION})`,
  "",
  `Compiled offline by \`supabase/functions/_shared/stickman/promptCompiler.ts\` from the retimed plan. ${stats.compiled} prompts; skipped (needsConcept): ${stats.skippedNeedsConcept.join(", ")}. Lint failures: ${stats.lintFailed.length}. Chars median ${stats.chars.median}, max ${stats.chars.max}, over 2,000: ${stats.chars.over2000}.`,
  "",
  ...out.prompts.flatMap((p) => [
    `## Beat ${p.sequence} · ${fmt(p.startMs)} · '${p.narration}'`,
    "",
    `${p.treatment} · ${p.renderPolicy} · text ${p.textIntent.mode} · ${p.chars} chars${p.lintErrors.length ? ` · **LINT: ${p.lintErrors.join("; ")}**` : ""}`,
    "",
    "```text",
    p.prompt,
    "```",
    "",
  ]),
].join("\n");
await Deno.writeTextFile(new URL("docs/phase3/myth-vs-reality.prompts.md", root), md);
console.log(JSON.stringify(stats, null, 1));
