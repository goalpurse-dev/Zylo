// Phase 2b — re-time frozen beat plans onto the REAL narration fixture (zero
// cost, no model calls). Usage: npx -y deno@2.9.6 run -A scripts/phase2bRetime.ts
// Writes <plan>.retimed.json next to each plan fixture.
import { retimePlan } from "../supabase/functions/_shared/stickman/beatDirector.ts";

const root = new URL("../tests/fixtures/stickman/", import.meta.url);
let narration: any[];
try {
  narration = JSON.parse(await Deno.readTextFile(new URL("audio/myth-vs-reality/narration.json", root)));
} catch {
  console.log("no narration fixture yet — run scripts/phase2bNarration.mjs (the one paid ElevenLabs call) first");
  Deno.exit(1);
}
const fmt = (ms: number) => `${Math.floor(ms / 60000)}:${String(((ms % 60000) / 1000).toFixed(1)).padStart(4, "0")}`;

for (const name of ["myth-vs-reality.recorded", "myth-vs-reality.polish-w1"]) {
  const plan = JSON.parse(await Deno.readTextFile(new URL(`beats/${name}.json`, root)));
  const r = retimePlan(plan.beats, plan.segments, narration);
  const s = r.stats;
  const old = retimePlan(plan.beats, plan.segments, narration, { boundaries: "plan" }).stats;
  console.log(`  real-timing chunks (whole script): ${s.realChunks}, median ${(s.realChunkMsMedian / 1000).toFixed(1)}s; single chunks > 6.5 s: ${s.realChunksOver6500.length}`);
  for (const c of s.realChunksOver6500) console.log(`    C${c.index} ${(c.ms / 1000).toFixed(1)}s '${c.text}'`);
  console.log(`  [before, plan's synthetic chunk boundaries: ${old.splits} split, ${old.merges} merged, ${old.needsConcept} needsConcept, still out [${old.stillOutOfBounds.join(", ")}]]`);
  console.log(`\n${name}: ${plan.beats.length} beats`);
  console.log(`  real ${s.realWpm} wpm | total real ${fmt(s.realTotalMs)} vs synthetic ${fmt(s.syntheticTotalMs)} | per-beat drift median ${(s.driftMs.median / 1000).toFixed(2)}s max ${(s.driftMs.max / 1000).toFixed(2)}s`);
  console.log(`  outside 1.8-6.5s after re-timing: ${r.outOfBounds.length}`);
  for (const b of r.outOfBounds) console.log(`    Beat ${b.sequence} · ${(b.synthMs / 1000).toFixed(1)}s -> ${(b.realMs / 1000).toFixed(1)}s · '${plan.beats[b.sequence - 1].narrationText}'`);
  console.log(`  fixed by code: ${s.splits} split, ${s.merges} merged -> ${s.beatsAfter} beats, ${s.needsConcept} marked needsConcept; still out of bounds: [${s.stillOutOfBounds.join(", ")}]`);
  await Deno.writeTextFile(new URL(`beats/${name}.retimed.json`, root), JSON.stringify({ source: `${name}.json`, timingSource: "real", stats: s, outOfBounds: r.outOfBounds.map(({ contract: _c, ...x }) => x), beats: r.beats }, null, 2));
}
