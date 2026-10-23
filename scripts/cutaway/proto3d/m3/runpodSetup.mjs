// M3 STAGING: the RunPod side of the Cutaway render worker, created once (idempotent: an item with the same name is
// reused). 1. a container registry auth for Fly's registry (user "x", password = the deploy token scoped to the
// staging Fly app); 2. a serverless template on the image, pinned by digest; 3. the staging endpoint (scale to zero,
// at most 2 workers, the 24 GB GPUs in order). Writes the ids to m3/staging.json (no secrets in it).
//   node m3/runpodSetup.mjs --image registry.fly.io/zyvo-cutaway-render-staging@sha256:...
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2), image = argv[argv.indexOf("--image") + 1];
const env = Object.fromEntries(fs.readFileSync("C:/Users/Public/Zylo/.env.local", "utf8").split(/\r?\n/).map((l) => l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]));
const NAME = "zyvo-cutaway-render-staging";
// the 16 GB workstation tier: RunPod schedules by price tier, and the 24 GB tier (L4, A5000, 3090) also hands out MIG slices
// (a slice of an RTX PRO 6000 Blackwell came up), which have no graphics: WebGL falls back to software there
export const GPUS = ["NVIDIA RTX A4000", "NVIDIA RTX 4000 Ada Generation", "NVIDIA RTX A4500", "NVIDIA RTX 2000 Ada Generation"];
const rp = async (p, init = {}) => { const r = await fetch(`https://rest.runpod.io/v1${p}`, { ...init, headers: { Authorization: `Bearer ${env.RUNPOD_API_KEY}`, "Content-Type": "application/json" } }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } if (!r.ok) throw new Error(`${init.method ?? "GET"} ${p}: ${r.status} ${t.slice(0, 300)}`); return j; };

const auths = await rp("/containerregistryauth").catch(() => []);
let auth = (Array.isArray(auths) ? auths : []).find((a) => a.name === NAME);
if (!auth) auth = await rp("/containerregistryauth", { method: "POST", body: JSON.stringify({ name: NAME, username: "x", password: env.FLY_CUTAWAY_STAGING_TOKEN }) });
console.log("registry auth", auth.id);

const templates = await rp("/templates").catch(() => []);
// the driver capabilities go in the template env too: the GPU test pod got them as container env, and a serverless
// worker with them only in the image fell back to Mesa (llvmpipe)
const tname = `${NAME}-${image.split("@sha256:")[1]?.slice(0, 12) ?? "latest"}`;
let tpl = (Array.isArray(templates) ? templates : []).find((t) => t.name === tname);
if (!tpl) tpl = await rp("/templates", { method: "POST", body: JSON.stringify({ name: tname, imageName: image, isServerless: true, containerDiskInGb: 20, containerRegistryAuthId: auth.id, env: { NVIDIA_DRIVER_CAPABILITIES: "all", NVIDIA_VISIBLE_DEVICES: "all" }, dockerStartCmd: [], dockerEntrypoint: [], ports: [] }) });
console.log("template", tpl.id, tname);

const endpoints = await rp("/endpoints").catch(() => []);
let ep = (Array.isArray(endpoints) ? endpoints : []).find((e) => e.name === NAME);
const epBody = { templateId: tpl.id, name: NAME, computeType: "GPU", gpuTypeIds: GPUS, gpuCount: 1, workersMin: 0, workersMax: 2, idleTimeout: 5, executionTimeoutMs: 900000, flashboot: true, scalerType: "QUEUE_DELAY", scalerValue: 4 };
if (!ep) ep = await rp("/endpoints", { method: "POST", body: JSON.stringify(epBody) });
else if (ep.templateId !== tpl.id) ep = await rp(`/endpoints/${ep.id}`, { method: "PATCH", body: JSON.stringify({ templateId: tpl.id }) });
console.log("endpoint", ep.id);
fs.writeFileSync(path.join(here, "staging.json"), JSON.stringify({ app: NAME, image, registryAuthId: auth.id, templateId: tpl.id, endpointId: ep.id, gpus: GPUS, workersMax: 2, idleTimeout: 5, createdAt: new Date().toISOString() }, null, 1));
