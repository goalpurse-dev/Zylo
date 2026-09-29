// deno-lint-ignore-file no-explicit-any
// Phase 5d — full-res master sources for every beat: Real-ESRGAN 2x of the
// ORIGINAL render of each beat's newest image version (the step the image
// pipeline now keeps; earlier rounds kept only the 1920x1080 downscale).
// Beats already upscaled in the 5c test (same version) are reused. Cap $0.09.
import { proxy, fetchBytes, admin, PROJECT_ID, root } from "./lib/v2Runner.ts";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";
import { newestApproved, type ImageVersion } from "../supabase/functions/_shared/stickman/edl.ts";

const CAP = 0.09, MODEL = "runware:504@1";
const versions: ImageVersion[] = JSON.parse(await Deno.readTextFile(new URL("docs/phase5/image-versions.json", root)));
const DIR = "docs/phase5/master-src";
await Deno.mkdir(new URL(`${DIR}/`, root), { recursive: true });
const statePath = new URL(`${DIR}/state.json`, root);
let st: any = {};
try { st = JSON.parse(await Deno.readTextFile(statePath)); } catch { st = {}; }
st.beats ??= {};
const spent = () => Object.values(st.beats).reduce((s: number, r: any) => s + (r.cost ?? 0), 0);
const test = JSON.parse(await Deno.readTextFile(new URL("docs/phase5/upscale/state.json", root)));

const seqs = [...new Set(versions.map((v) => v.beatSequence))].sort((a, b) => a - b);
const queue = seqs.filter((n) => !st.beats[n]);
await Promise.all(Array.from({ length: 6 }, async () => {
  while (queue.length) {
    const n = queue.shift()!;
    const v = newestApproved(versions, n)!;
    const reuse = test.runs?.[`${n}:${MODEL}`];
    if (reuse?.file && v.versionId === `v2-4c-${n}`) { st.beats[n] = { versionId: v.versionId, file: reuse.file, width: reuse.width, height: reuse.height, cost: 0, reused: true }; continue; }
    if (spent() + 0.0007 > CAP) { console.log(`CAP: stop before beat ${n}`); continue; }
    const original = v.path.replace(/-base\.jpg$/, "-original.jpg");
    const r = await proxy({ taskType: "upscale", model: MODEL, upscaleFactor: 2, inputs: { image: `data:image/jpeg;base64,${encodeBase64(await Deno.readFile(new URL(original, root)))}` }, outputType: "URL", outputFormat: "JPG", outputQuality: 95, includeCost: true });
    if (!r.ok) { console.log(`✗ beat ${n}: ${JSON.stringify(r.error).slice(0, 200)}`); continue; }
    const file = `${DIR}/beat-${String(n).padStart(3, "0")}-full.jpg`;
    await Deno.writeFile(new URL(file, root), await fetchBytes(r.result.imageURL));
    const cost = Number(r.result.cost ?? 0.0006);
    await admin.from("long_form_cost_ledger").insert({ project_id: PROJECT_ID, stage: "images", provider: "runware", model: MODEL, units: { calls: 1, images: 1, beat: n, factor: 2 }, usd: cost, estimated: r.result.cost == null, source_table: "phase5d_master_sources" });
    st.beats[n] = { versionId: v.versionId, original, file, cost };
    await Deno.writeTextFile(statePath, JSON.stringify(st, null, 1));
  }
}));
await Deno.writeTextFile(statePath, JSON.stringify(st, null, 1));
const have = Object.keys(st.beats).length;
console.log(`master sources ${have}/${seqs.length} (reused ${Object.values(st.beats).filter((b: any) => b.reused).length}) · spent $${spent().toFixed(4)}`);
