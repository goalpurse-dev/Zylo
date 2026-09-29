// Phase 4c — re-render beat 10 on V2 to prove the overlay placement fix (~$0.003).
import { runV2Beat, root } from "./lib/v2Runner.ts";
import { canonicalSetFromBible, plantFrameFor } from "../supabase/functions/_shared/stickman/promptCompiler.ts";
import { contractForTier } from "../supabase/functions/_shared/stickman/renderTiers.ts";
const read = async (p: string) => JSON.parse(await Deno.readTextFile(new URL(p, root)));
const recorded = await read("tests/fixtures/stickman/beats/myth-vs-reality.recorded.json");
const retimed = await read("tests/fixtures/stickman/beats/myth-vs-reality.recorded.retimed.json");
const fixture = await read("tests/fixtures/stickman/bibles/myth-vs-reality.canonical.json");
const set = canonicalSetFromBible(recorded.bible, fixture);
const beat = retimed.beats.find((b: any) => b.sequence === 10);
const out = await runV2Beat(beat, set, { dir: "docs/phase4/beat10", source: "phase4c_beat10", plantFrame: plantFrameFor(retimed.beats, set) });
console.log(JSON.stringify({ ...out, prompt: out.prompt.split("\n").slice(1, 2) }, null, 1));
void contractForTier;
