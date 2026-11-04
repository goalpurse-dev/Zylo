// Blocky Worlds render worker: the RunPod side, created once (idempotent: items with the same name are reused).
// The image lives in Cutaway's staging Fly registry under its own label (registry.fly.io/zyvo-cutaway-render-staging,
// tag blocky-*), so RunPod pulls it with the registry login that already exists for Cutaway (no new credential).
// 1. the serverless template on the image, pinned by digest; the prepare role's ElevenLabs key is the RunPod secret
//    "blocky_elevenlabs" (the owner creates it in RunPod's console; never in the image or in Supabase);
// 2. the endpoint: scale to zero, the 16 GB GPUs in order (Cutaway's list), 12 workers at most (a video takes K + 1:
//    8 chunks + its prepare job for 90 s; docs/blocky-worlds-pipeline.md), FlashBoot on.
// Writes runpod/endpoint.json (ids only, no secrets).
//   node runpod/setup.mjs --image registry.fly.io/zyvo-cutaway-render-staging@sha256:...
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2), image = argv[argv.indexOf("--image") + 1];
if (!image?.startsWith("registry.fly.io/zyvo-cutaway-render-staging@sha256:")) throw new Error("--image registry.fly.io/zyvo-cutaway-render-staging@sha256:... (pinned by digest)");
const env = Object.fromEntries(fs.readFileSync("C:/Users/Public/Zylo/.env.local", "utf8").split(/\r?\n/).map((l) => l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]));
const KEY = env.RUNPOD_API_KEY;
if (!KEY) throw new Error("RUNPOD_API_KEY missing in .env.local");
const NAME = "zyvo-blocky-render";
// the 16 GB workstation tier only: the 24 GB tier (A5000, 3090, L4) also hands out MIG slices of an RTX PRO 6000 Blackwell,
// which have no graphics (2026-11-04: 4 of 6 first chunks landed on one and were refused with NO_GPU)
const GPUS = ["NVIDIA RTX A4000", "NVIDIA RTX 4000 Ada Generation", "NVIDIA RTX A4500", "NVIDIA RTX 2000 Ada Generation"];
const rp = async (p, init = {}) => { const r = await fetch(`https://rest.runpod.io/v1${p}`, { ...init, headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" } }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } if (!r.ok) throw new Error(`${init.method ?? "GET"} ${p}: ${r.status} ${t.slice(0, 300)}`); return j; };

// the registry login Cutaway's staging endpoint already uses (scripts/cutaway/proto3d/m3/staging.json)
const cut = JSON.parse(fs.readFileSync(path.resolve(here, "../../../cutaway/proto3d/m3/staging.json"), "utf8"));
const auths = await rp("/containerregistryauth");
const auth = (Array.isArray(auths) ? auths : []).find((a) => a.id === cut.registryAuthId);
if (!auth) throw new Error(`the registry login ${cut.registryAuthId} is not in this RunPod account`);
console.log("registry auth (reused)", auth.id, auth.name);

const tname = `${NAME}-${image.split("@sha256:")[1].slice(0, 12)}`;
const templates = await rp("/templates");
let tpl = (Array.isArray(templates) ? templates : []).find((t) => t.name === tname);
if (!tpl) tpl = await rp("/templates", { method: "POST", body: JSON.stringify({ name: tname, imageName: image, isServerless: true, containerDiskInGb: 20, containerRegistryAuthId: auth.id, env: { NVIDIA_DRIVER_CAPABILITIES: "all", NVIDIA_VISIBLE_DEVICES: "all", ELEVENLABS_KEY: "{{ RUNPOD_SECRET_blocky_elevenlabs }}" }, dockerStartCmd: [], dockerEntrypoint: [], ports: [] }) });
console.log("template", tpl.id, tname);

const endpoints = await rp("/endpoints");
let ep = (Array.isArray(endpoints) ? endpoints : []).find((e) => e.name === NAME);
const body = { templateId: tpl.id, name: NAME, computeType: "GPU", gpuTypeIds: GPUS, gpuCount: 1, workersMin: 0, workersMax: 12, idleTimeout: 5, executionTimeoutMs: 900000, flashboot: true, scalerType: "REQUEST_COUNT", scalerValue: 1 };
// (REQUEST_COUNT 1: one worker per waiting job at once, so all K chunks start together; QUEUE_DELAY waits 4 s first)
if (!ep) ep = await rp("/endpoints", { method: "POST", body: JSON.stringify(body) });
else ep = await rp(`/endpoints/${ep.id}`, { method: "PATCH", body: JSON.stringify({ templateId: tpl.id, gpuTypeIds: GPUS, workersMax: 12, flashboot: true, scalerType: "REQUEST_COUNT", scalerValue: 1 }) });
console.log("endpoint", ep.id, "workersMin 0 (scales to zero)");
fs.writeFileSync(path.join(here, "endpoint.json"), JSON.stringify({ name: NAME, image, registryAuthId: auth.id, templateId: tpl.id, endpointId: ep.id, gpus: GPUS, workersMax: 12, idleTimeout: 5, createdAt: new Date().toISOString() }, null, 1));
