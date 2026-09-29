// deno-lint-ignore-file no-explicit-any
// Phase 5c — upscaler test: Real-ESRGAN (general, runware:504@1) vs RealESRGAN
// x4plus anime (runware:113@2), both 2x, on original FLUX frames. Saves the
// full-res outputs, 1:1 crops for by-eye comparison and an edge-sharpness
// number. Usage: ... scripts/phase5cUpscaleTest.ts [beats=1,3,5,7] [models=...]
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";
import { proxy, fetchBytes, admin, PROJECT_ID, root } from "./lib/v2Runner.ts";

const CAP = Number(Deno.env.get("CAP") ?? 0.02); // total for everything in state.json
const beats = (Deno.args[0] ?? "1,3,5,7").split(",").map(Number);
const models = (Deno.args[1] ?? "runware:504@1,runware:113@2").split(",");
const DIR = "docs/phase5/upscale";
await Deno.mkdir(new URL(`${DIR}/`, root), { recursive: true });
const statePath = new URL(`${DIR}/state.json`, root);
let st: any = {};
try { st = JSON.parse(await Deno.readTextFile(statePath)); } catch { st = {}; }
st.runs ??= {};
const spent = () => Object.values(st.runs).reduce((s: number, r: any) => s + (r.cost ?? 0), 0);
const tag = (m: string) => m.replace(/[:@]/g, "-");

// Mean gradient magnitude on strong edges: higher = crisper outlines.
function edgeSharpness(img: Image) {
  const w = img.width, h = img.height;
  const L = (x: number, y: number) => { const [r, g, b] = Image.colorToRGBA(img.getPixelAt(x, y)); return 0.299 * r + 0.587 * g + 0.114 * b; };
  const grads: number[] = [];
  for (let y = 2; y < h - 2; y += 3) for (let x = 2; x < w - 2; x += 3) {
    const gx = L(x + 1, y) - L(x - 1, y), gy = L(x, y + 1) - L(x, y - 1);
    grads.push(Math.hypot(gx, gy));
  }
  grads.sort((a, b) => b - a);
  const top = grads.slice(0, Math.floor(grads.length * 0.02)); // the strongest 2% = outlines
  return Number((top.reduce((a, b) => a + b, 0) / top.length).toFixed(1));
}

for (const n of beats) for (const model of models) {
  const key = `${n}:${model}`;
  if (st.runs[key]?.file) continue;
  if (spent() + 0.003 > CAP) { console.log(`CAP: stop before ${key}`); break; }
  const orig = await Deno.readFile(new URL(`docs/phase4/fullset/beat-${String(n).padStart(3, "0")}-original.jpg`, root));
  const r = await proxy({ taskType: "upscale", model, upscaleFactor: 2, inputs: { image: `data:image/jpeg;base64,${encodeBase64(orig)}` }, outputType: "URL", outputFormat: "PNG", includeCost: true });
  if (!r.ok) { st.runs[key] = { error: JSON.stringify(r.error).slice(0, 300), cost: 0 }; console.log(`✗ ${key} ${st.runs[key].error}`); continue; }
  const bytes = await fetchBytes(r.result.imageURL);
  const file = `${DIR}/beat-${String(n).padStart(3, "0")}-${tag(model)}.png`;
  await Deno.writeFile(new URL(file, root), bytes);
  const img = await Image.decode(bytes) as Image;
  const cost = Number(r.result.cost ?? 0);
  await admin.from("long_form_cost_ledger").insert({ project_id: PROJECT_ID, stage: "images", provider: "runware", model, units: { calls: 1, images: 1, beat: n, factor: 2 }, usd: cost, estimated: r.result.cost == null, source_table: "phase5c_upscale_test" });
  st.runs[key] = { file, cost, width: img.width, height: img.height, sharpness: edgeSharpness(img), latencyMs: r.latencyMs };
  console.log(`✓ ${key} ${img.width}x${img.height} $${cost} sharpness ${st.runs[key].sharpness}`);
  await Deno.writeTextFile(statePath, JSON.stringify(st, null, 1));
}
await Deno.writeTextFile(statePath, JSON.stringify(st, null, 1));

// 1:1 crops (no scaling) of the upper-middle of each frame — heads and outlines — side by side.
const CW = 640, CH = 400;
const rows = beats.filter((n) => models.every((m) => st.runs[`${n}:${m}`]?.file));
const sheet = new Image(CW * models.length + 4 * (models.length - 1), CH * rows.length + 4 * (rows.length - 1)).fill(0xffffffff);
for (const [i, n] of rows.entries()) for (const [k, m] of models.entries()) {
  const img = await Image.decode(await Deno.readFile(new URL(st.runs[`${n}:${m}`].file, root))) as Image;
  const x = Math.round(img.width * 0.5 - CW / 2), y = Math.round(img.height * 0.22);
  sheet.composite(img.crop(x, y, CW, CH), k * (CW + 4), i * (CH + 4));
}
await Deno.writeFile(new URL(`${DIR}/crops-${models.map(tag).join("_vs_")}.png`, root), await sheet.encode());
const avg = (m: string) => { const v = rows.map((n) => st.runs[`${n}:${m}`].sharpness); return (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1); };
console.log(`spent $${spent().toFixed(4)} · edge sharpness ${models.map((m) => `${m} ${avg(m)}`).join(" vs ")} · crops ${DIR}/crops-${models.map(tag).join("_vs_")}.png`);
