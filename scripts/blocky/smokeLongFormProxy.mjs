// One real Long Form picture through the LIVE picture proxy (runware-bakeoff-proxy),
// exactly as render-long-form-scene sends it for a V2 scene: the render on
// FLUX.2 klein 9B KV (_shared/stickman/renderTiers.ts#renderTask), then the 2x
// upscale. About $0.003. No Long Form project, row or credit is touched.
//   node scripts/blocky/smokeLongFormProxy.mjs <outFile.jpg>
import fs from "fs";
import { SUPABASE_URL } from "../fruit-story/lib.mjs";

const [outFile] = process.argv.slice(2);
const proxy = async (task) => {
  const t0 = Date.now();
  const r = await fetch(`${SUPABASE_URL}/functions/v1/runware-bakeoff-proxy`, { method: "POST", headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ task }) });
  const j = await r.json().catch(() => null);
  return { http: r.status, ok: j?.ok === true, result: j?.result ?? null, error: j?.ok ? null : JSON.stringify(j?.error ?? j).slice(0, 200), ms: Date.now() - t0 };
};

const render = await proxy({
  taskType: "imageInference", model: "runware:400@6", width: 1376, height: 768, numberResults: 1,
  outputType: "URL", outputFormat: "JPG", outputQuality: 95, deliveryMethod: "sync", includeCost: true,
  positivePrompt: "Flat 2D stickman explainer frame: one stickman with a circle head and thin black stick arms and legs stands beside a large round moon, pointing up at it. Plain off-white background, thick black outlines, flat colours, no shading.",
  negativePrompt: "text, letters, words, watermark, 3D, shading, gradients, realistic people. Also avoid: flames, fire.",
  steps: 8, CFGScale: 3.5, acceleration: "high",
});
console.log(`render:  HTTP ${render.http} ok=${render.ok} $${Number(render.result?.cost ?? 0).toFixed(5)} ${render.ms} ms ${render.error ?? ""}`);
let upscale = null;
if (render.ok && render.result?.imageURL) {
  upscale = await proxy({ taskType: "upscale", model: "runware:504@1", upscaleFactor: 2, inputs: { image: render.result.imageURL }, outputType: "URL", outputFormat: "JPG", outputQuality: 95, includeCost: true });
  console.log(`upscale: HTTP ${upscale.http} ok=${upscale.ok} $${Number(upscale.result?.cost ?? 0).toFixed(5)} ${upscale.ms} ms ${upscale.error ?? ""}`);
  if (outFile && upscale.result?.imageURL) fs.writeFileSync(outFile, Buffer.from(await (await fetch(upscale.result.imageURL)).arrayBuffer()));
}
const total = Number(render.result?.cost ?? 0) + Number(upscale?.result?.cost ?? 0);
console.log(`total $${total.toFixed(5)} · ${render.ok && upscale?.ok ? "PASS" : "FAIL"}`);
process.exitCode = render.ok && upscale?.ok ? 0 : 1;
