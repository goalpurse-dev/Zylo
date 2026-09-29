// deno-lint-ignore-file no-explicit-any
// Phase 4c — the full V2 image set for the Myth vs Reality plan (paid, ~$0.45).
// Usage: npx -y deno@2.9.6 run -A --no-check scripts/phase4cFullSet.ts
// Every beat: V2 render -> free code checks (1 retry) -> Real-ESRGAN 2x ->
// 1920x1080 -> text overlay as an editable layer. Resumable: a beat that
// already has a result (image or recorded failure) is never re-run.
import { runV2Beat, root } from "./lib/v2Runner.ts";
import { canonicalSetFromBible, plantFrameFor } from "../supabase/functions/_shared/stickman/promptCompiler.ts";

const CAP = 0.6; // this step's budget with headroom (plan ~$0.45)
const read = async (p: string) => JSON.parse(await Deno.readTextFile(new URL(p, root)));
const plan = await read("tests/fixtures/stickman/beats/myth-vs-reality.phase4c3.json");
const set = canonicalSetFromBible(plan.bible);
const plantFrame = plantFrameFor(plan.beats, set);
const DIR = "docs/phase4/fullset";
await Deno.mkdir(new URL(`${DIR}/`, root), { recursive: true });
const statePath = new URL(`${DIR}/state.json`, root);
let st: any = {};
try { st = JSON.parse(await Deno.readTextFile(statePath)); } catch { st = {}; }
st.beats ??= {};
st.startedAt ??= Date.now();
const spent = () => Object.values(st.beats).reduce((s: number, r: any) => s + (r.cost ?? 0), 0);
let saving = Promise.resolve();
const save = () => (saving = saving.then(() => Deno.writeTextFile(statePath, JSON.stringify(st, null, 1))));

const queue = plan.beats.filter((b: any) => !st.beats[b.sequence]);
console.log(`beats ${plan.beats.length}, to render ${queue.length}, spent so far $${spent().toFixed(4)}`);
await Promise.all(Array.from({ length: 6 }, async () => {
  while (queue.length) {
    const beat = queue.shift()!;
    if (spent() + 0.01 > CAP) { console.log(`CAP: stopping before beat ${beat.sequence}`); return; }
    const out = await runV2Beat(beat, set, { dir: DIR, source: "phase4c_fullset", plantFrame });
    st.beats[beat.sequence] = { ...out, startMs: beat.startMs, endMs: beat.endMs, narration: beat.narrationText, treatment: beat.contract.treatment, textIntent: beat.contract.textIntent, warnings: beat.warnings ?? [] };
    console.log(`${out.failed ? "✗" : "✓"} beat ${beat.sequence} $${out.cost.toFixed(5)} ${out.renderLatencyMs}ms${out.retries ? ` retries ${out.retries}` : ""}${out.error ? ` ${out.error.slice(0, 120)}` : ""}`);
    await save();
  }
}));
st.finishedAt = Date.now();
await save();
const rs = Object.values(st.beats) as any[];
const lat = rs.map((r) => r.renderLatencyMs).filter(Boolean).sort((a, b) => a - b);
console.log(`DONE ${rs.length} beats · failed ${rs.filter((r) => r.failed).length} · retries ${rs.reduce((s, r) => s + (r.retries ?? 0), 0)} · $${spent().toFixed(4)} · median render latency ${lat[Math.floor(lat.length / 2)]}ms · wall ${((st.finishedAt - st.startedAt) / 1000).toFixed(0)}s`);
