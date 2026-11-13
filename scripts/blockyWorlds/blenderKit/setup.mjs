// Blender kit engine (phase 1): the RunPod side. Idempotent (a template / endpoint with the same name is reused).
//   node scripts/blockyWorlds/blenderKit/setup.mjs --image registry.fly.io/zyvo-cutaway-render-staging@sha256:<digest> [--yes]
//   node scripts/blockyWorlds/blenderKit/setup.mjs --rollback [--yes]     (Blocky back to its old workersMax, new endpoint to 0)
// The account allows 10 workers in total. Cutaway (f66astc0vrus92, max 4) is never read for writing or touched.
// 1. the Blocky three.js endpoint gm9eqdkuyc2ofs: ONLY workersMax is lowered (6 -> 3); its image / template stay;
// 2. a template on the pinned image (no secrets in its env: the worker needs none) with the registry login Cutaway's
//    staging already uses (no new credential);
// 3. the endpoint "zyvo-blender-kit": scale to zero, 3 workers at most, the 16 GB tier (RTX 4000 Ada / A4500 / A4000 /
//    2000 Ada: graphics-capable; the 24 GB tier hands out MIG slices without graphics, runpod/setup.mjs), 1 h timeout.
// Without --yes it only prints what it would change. Writes blenderKit/endpoint.json (ids + the old values, no secrets).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2), GO = argv.includes("--yes"), ROLLBACK = argv.includes("--rollback");
const image = argv.includes("--image") ? argv[argv.indexOf("--image") + 1] : null;
const CUTAWAY = "f66astc0vrus92", BLOCKY = "gm9eqdkuyc2ofs", NAME = "zyvo-blender-kit";
const BLOCKY_MAX = 3, OURS_MAX = 3;
const GPUS = ["NVIDIA RTX 4000 Ada Generation", "NVIDIA RTX A4500", "NVIDIA RTX A4000", "NVIDIA RTX 2000 Ada Generation"];
const epFile = path.join(here, "endpoint.json");
if (!ROLLBACK && !image?.startsWith("registry.fly.io/zyvo-cutaway-render-staging@sha256:")) throw new Error("--image registry.fly.io/zyvo-cutaway-render-staging@sha256:... (pinned by digest)");

const env = Object.fromEntries(fs.readFileSync("C:/Users/Public/Zylo/.env.local", "utf8").split(/\r?\n/).map((l) => l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]));
const KEY = env.RUNPOD_API_KEY;
if (!KEY) throw new Error("RUNPOD_API_KEY missing in .env.local");
const rp = async (p, init = {}) => {
  if (p.includes(CUTAWAY) && (init.method ?? "GET") !== "GET") throw new Error("refusing to change the Cutaway endpoint");
  const r = await fetch(`https://rest.runpod.io/v1${p}`, { ...init, headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" } });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
  if (!r.ok) throw new Error(`${init.method ?? "GET"} ${p}: ${r.status} ${String(t).slice(0, 300)}`);
  return j;
};
const say = (...a) => console.log(GO ? "" : "[dry run]", ...a);

const endpoints = await rp("/endpoints");
const blocky = endpoints.find((e) => e.id === BLOCKY), ours = endpoints.find((e) => e.name === NAME);
if (!blocky) throw new Error(`the Blocky endpoint ${BLOCKY} is not in this account`);
const others = endpoints.filter((e) => e.id !== BLOCKY && e.name !== NAME).reduce((s, e) => s + (e.workersMax ?? 0), 0);

if (ROLLBACK) {
  const saved = fs.existsSync(epFile) ? JSON.parse(fs.readFileSync(epFile, "utf8")) : {};
  const back = saved.blockyWorkersMaxBefore ?? 6;
  if (ours) { say(`endpoint ${ours.id} (${NAME}): workersMax ${ours.workersMax} -> 0`); if (GO) await rp(`/endpoints/${ours.id}`, { method: "PATCH", body: JSON.stringify({ workersMax: 0 }) }); }
  say(`endpoint ${BLOCKY} (Blocky): workersMax ${blocky.workersMax} -> ${back}`);
  if (GO) await rp(`/endpoints/${BLOCKY}`, { method: "PATCH", body: JSON.stringify({ workersMax: back }) });
  process.exit(0);
}

console.log(`workers now: Blocky ${blocky.workersMax}, ${NAME} ${ours?.workersMax ?? "(none)"}, everything else ${others} (Cutaway untouched); after: ${BLOCKY_MAX} + ${OURS_MAX} + ${others} = ${BLOCKY_MAX + OURS_MAX + others}`);
if (BLOCKY_MAX + OURS_MAX + others > 10) throw new Error("that would go over the account's 10 workers");

// 1. Blocky: only workersMax
const blockyBefore = blocky.workersMax;
if (blocky.workersMax > BLOCKY_MAX) {
  say(`endpoint ${BLOCKY} (Blocky): workersMax ${blocky.workersMax} -> ${BLOCKY_MAX} (image / template unchanged)`);
  if (GO) await rp(`/endpoints/${BLOCKY}`, { method: "PATCH", body: JSON.stringify({ workersMax: BLOCKY_MAX }) });
}

// 2. template (the registry login Cutaway's staging uses)
const cut = JSON.parse(fs.readFileSync(path.resolve(here, "../../cutaway/proto3d/m3/staging.json"), "utf8"));
const auth = (await rp("/containerregistryauth")).find((a) => a.id === cut.registryAuthId);
if (!auth) throw new Error(`the registry login ${cut.registryAuthId} is not in this RunPod account`);
const tname = `${NAME}-${image.split("@sha256:")[1].slice(0, 12)}`;
let tpl = (await rp("/templates")).find((t) => t.name === tname);
if (!tpl) {
  say(`template ${tname} on ${image}`);
  if (GO) tpl = await rp("/templates", { method: "POST", body: JSON.stringify({ name: tname, imageName: image, isServerless: true, containerDiskInGb: 40, containerRegistryAuthId: auth.id, env: { NVIDIA_DRIVER_CAPABILITIES: "all", NVIDIA_VISIBLE_DEVICES: "all" }, dockerStartCmd: [], dockerEntrypoint: [], ports: [] }) });
}

// 3. endpoint
const body = { templateId: tpl?.id, name: NAME, computeType: "GPU", gpuTypeIds: GPUS, gpuCount: 1, workersMin: 0, workersMax: OURS_MAX, idleTimeout: 5, executionTimeoutMs: 3600000, flashboot: true, scalerType: "REQUEST_COUNT", scalerValue: 1 };
let ep = ours;
say(ours ? `endpoint ${ours.id} (${NAME}): template -> ${tpl?.id}, workersMax ${OURS_MAX}` : `new endpoint ${NAME}: ${GPUS.join(", ")}, workersMin 0, workersMax ${OURS_MAX}`);
if (GO) ep = ours ? await rp(`/endpoints/${ours.id}`, { method: "PATCH", body: JSON.stringify({ templateId: tpl.id, gpuTypeIds: GPUS, workersMax: OURS_MAX, executionTimeoutMs: 3600000 }) }) : await rp("/endpoints", { method: "POST", body: JSON.stringify(body) });
if (!GO) { console.log("dry run: nothing changed (add --yes)"); process.exit(0); }

const prev = fs.existsSync(epFile) ? JSON.parse(fs.readFileSync(epFile, "utf8")) : {};
fs.writeFileSync(epFile, JSON.stringify({ name: NAME, image, registryAuthId: auth.id, templateId: tpl.id, endpointId: ep.id, gpus: GPUS, workersMax: OURS_MAX, idleTimeout: 5, executionTimeoutMs: 3600000, blockyEndpoint: BLOCKY, blockyWorkersMaxBefore: prev.blockyWorkersMaxBefore ?? blockyBefore, blockyWorkersMaxNow: BLOCKY_MAX, updatedAt: new Date().toISOString() }, null, 1));
console.log(`endpoint ${ep.id} (${NAME}) ready; Blocky ${BLOCKY} workersMax ${BLOCKY_MAX} (was ${blockyBefore}); wrote ${epFile}`);
