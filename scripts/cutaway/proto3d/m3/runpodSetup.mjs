// M3: the RunPod side of the Cutaway worker, created once (idempotent: an item with the same name is reused).
// 1. a container registry auth for Fly's registry (user "x", password = the deploy token scoped to the Fly app);
// 2. a serverless template on the image, pinned by digest, with the model keys;
// 3. the endpoint (scale to zero, the 16 GB GPUs in order). Writes the ids to m3/<staging|production>.json (no secrets).
//   node m3/runpodSetup.mjs --image registry.fly.io/zyvo-cutaway-render-staging@sha256:...            (staging)
//   node m3/runpodSetup.mjs --prod --image registry.fly.io/zyvo-cutaway-render@sha256:...               (production)
// Keys this script reads from .env.local (never printed, never written to a file):
//   staging:    RUNPOD_API_KEY, FLY_CUTAWAY_STAGING_TOKEN, and the test model keys ANTHROPIC_API_KEY, ELEVENLABS_KEY
//               (they go into the staging template's env: a staging job plans with the test keys)
//   production: CUTAWAY_RUNPOD_PROD_API_KEY (the production RunPod key), CUTAWAY_FLY_PROD_TOKEN (deploy token scoped to
//               zyvo-cutaway-render). The production model keys are NOT read here: the template refers to the RunPod
//               secrets "cutaway_anthropic" and "cutaway_elevenlabs", which the owner creates in RunPod's console.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2), image = argv[argv.indexOf("--image") + 1], PROD = argv.includes("--prod");
const env = Object.fromEntries(fs.readFileSync("C:/Users/Public/Zylo/.env.local", "utf8").split(/\r?\n/).map((l) => l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]));
const NAME = PROD ? "zyvo-cutaway-render" : "zyvo-cutaway-render-staging";
const KEY = PROD ? env.CUTAWAY_RUNPOD_PROD_API_KEY : env.RUNPOD_API_KEY, FLY_TOKEN = PROD ? env.CUTAWAY_FLY_PROD_TOKEN : env.FLY_CUTAWAY_STAGING_TOKEN;
if (!KEY || !FLY_TOKEN) throw new Error(`missing ${PROD ? "CUTAWAY_RUNPOD_PROD_API_KEY or CUTAWAY_FLY_PROD_TOKEN" : "RUNPOD_API_KEY or FLY_CUTAWAY_STAGING_TOKEN"} in .env.local`);
// the 16 GB workstation tier: RunPod schedules by price tier, and the 24 GB tier (L4, A5000, 3090) also hands out MIG slices
// (a slice of an RTX PRO 6000 Blackwell came up), which have no graphics: WebGL falls back to software there
export const GPUS = ["NVIDIA RTX A4000", "NVIDIA RTX 4000 Ada Generation", "NVIDIA RTX A4500", "NVIDIA RTX 2000 Ada Generation"];
const rp = async (p, init = {}) => { const r = await fetch(`https://rest.runpod.io/v1${p}`, { ...init, headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" } }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } if (!r.ok) throw new Error(`${init.method ?? "GET"} ${p}: ${r.status} ${t.slice(0, 300)}`); return j; };

const auths = await rp("/containerregistryauth").catch(() => []);
let auth = (Array.isArray(auths) ? auths : []).find((a) => a.name === NAME);
if (!auth) auth = await rp("/containerregistryauth", { method: "POST", body: JSON.stringify({ name: NAME, username: "x", password: FLY_TOKEN }) });
console.log("registry auth", auth.id);

const templates = await rp("/templates").catch(() => []);
// the driver capabilities go in the template env too: the GPU test pod got them as container env, and a serverless
// worker with them only in the image fell back to Mesa (llvmpipe). The model keys: RunPod secrets in production.
const modelKeys = PROD
  ? { ANTHROPIC_API_KEY: "{{ RUNPOD_SECRET_cutaway_anthropic }}", ELEVENLABS_KEY: "{{ RUNPOD_SECRET_cutaway_elevenlabs }}" }
  : { ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY ?? "", ELEVENLABS_KEY: env.ELEVENLABS_KEY ?? "" };
const tname = `${NAME}-${image.split("@sha256:")[1]?.slice(0, 12) ?? "latest"}`;
let tpl = (Array.isArray(templates) ? templates : []).find((t) => t.name === tname);
if (!tpl) tpl = await rp("/templates", { method: "POST", body: JSON.stringify({ name: tname, imageName: image, isServerless: true, containerDiskInGb: 30, containerRegistryAuthId: auth.id, env: { NVIDIA_DRIVER_CAPABILITIES: "all", NVIDIA_VISIBLE_DEVICES: "all", ...modelKeys }, dockerStartCmd: [], dockerEntrypoint: [], ports: [] }) });
console.log("template", tpl.id, tname);

const endpoints = await rp("/endpoints").catch(() => []);
let ep = (Array.isArray(endpoints) ? endpoints : []).find((e) => e.name === NAME);
// production: up to 4 videos at once (the Cutaway cap: cutaway_settings.max_running), 45 minutes a job (the plan waits on
// Claude for minutes; the GPU renders a 60 s video in about 5)
const epBody = { templateId: tpl.id, name: NAME, computeType: "GPU", gpuTypeIds: GPUS, gpuCount: 1, workersMin: 0, workersMax: PROD ? 4 : 2, idleTimeout: 5, executionTimeoutMs: PROD ? 2700000 : 900000, flashboot: true, scalerType: "QUEUE_DELAY", scalerValue: 4 };
if (!ep) ep = await rp("/endpoints", { method: "POST", body: JSON.stringify(epBody) });
else if (ep.templateId !== tpl.id) ep = await rp(`/endpoints/${ep.id}`, { method: "PATCH", body: JSON.stringify({ templateId: tpl.id }) });
console.log("endpoint", ep.id);
fs.writeFileSync(path.join(here, PROD ? "production.json" : "staging.json"), JSON.stringify({ app: NAME, image, registryAuthId: auth.id, templateId: tpl.id, endpointId: ep.id, gpus: GPUS, workersMax: epBody.workersMax, idleTimeout: 5, executionTimeoutMs: epBody.executionTimeoutMs, createdAt: new Date().toISOString() }, null, 1));
