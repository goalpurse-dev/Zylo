// Generate fruit character reference images through the deployed
// runware-bakeoff-proxy (RUNWARE_API_KEY stays a server secret; we
// authenticate with the service-role key from .env.local and never print it).
//
//   node scripts/fruit-characters/generate.mjs --out <dir> --cap <usd> [--ids a,b] [--concurrency 1] [--again]
//
// Writes <dir>/<id>.jpg and appends every attempt to <dir>/ledger.json
// (prompt, seed, cost, latency). --cap covers everything in <dir>/ledger.json
// (first pass + retries). Never retries on its own; stops on the first failure
// or when the next image could cross the cap. An id already in the ledger
// with its image on disk is skipped unless --again is passed; --again keeps
// the previous image in <dir>/attempts/ and stops at MAX_ATTEMPTS per id.
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { buildPrompt } from "./prompt.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
createRequire(path.join(ROOT, "package.json"))("dotenv").config({ path: path.join(ROOT, ".env.local"), quiet: true });

export const MODEL = { key: "nano-banana-2-lite", model: "google:nano-banana@2-lite", width: 768, height: 1376, expectedUsd: 0.0337 };

const args = Object.fromEntries(process.argv.slice(2).join(" ").split("--").filter(Boolean).map((a) => {
  const [k, ...v] = a.trim().split(/\s+/);
  return [k, v.length ? v.join(" ") : true];
}));
const OUT = path.resolve(ROOT, args.out ?? "data/fruit-characters/refs");
const CAP = Number(args.cap);
if (!(CAP > 0)) throw new Error("--cap <usd> is required");
const CONCURRENCY = Number(args.concurrency ?? 1);
export const MAX_ATTEMPTS = 4; // first try + up to 3 retries

const lib = JSON.parse(fs.readFileSync(path.join(ROOT, "data/fruit-characters/characters.json"), "utf8"));
const wanted = args.ids ? String(args.ids).split(",") : lib.characters.map((c) => c.id);
const chars = wanted.map((id) => lib.characters.find((c) => c.id === id) ?? (() => { throw new Error(`unknown id ${id}`); })());

fs.mkdirSync(OUT, { recursive: true });
const ledgerPath = path.join(OUT, "ledger.json");
const ledger = fs.existsSync(ledgerPath) ? JSON.parse(fs.readFileSync(ledgerPath, "utf8")) : [];
const save = () => fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 1));
const spent = () => ledger.reduce((s, r) => s + (r.cost ?? 0), 0);
const runSpent = () => ledger.filter((r) => r.run === RUN).reduce((s, r) => s + (r.cost ?? 0), 0);
const RUN = new Date().toISOString();
let inFlight = 0;
let stop = null;

async function one(c) {
  const file = path.join(OUT, `${c.id}.jpg`);
  if (!args.again && ledger.some((r) => r.ok && r.id === c.id) && fs.existsSync(file)) return;
  if (ledger.filter((r) => r.ok && r.id === c.id).length >= MAX_ATTEMPTS) { console.log(`${c.id} already has ${MAX_ATTEMPTS} attempts, flag for review`); return; }
  // Reserve the expected cost of everything in flight so parallel calls can't overshoot.
  if (spent() + (inFlight + 1) * MODEL.expectedUsd > CAP) { stop ??= `cap: folder spent ${spent().toFixed(4)}, next would pass ${CAP}`; return; }
  inFlight++;
  const prompt = buildPrompt(c);
  const task = { taskType: "imageInference", model: MODEL.model, positivePrompt: prompt, width: MODEL.width, height: MODEL.height, numberResults: 1, outputType: "URL", outputFormat: "JPG", outputQuality: 95, deliveryMethod: "sync" };
  const res = await fetch(`${process.env.SUPABASE_URL}/functions/v1/runware-bakeoff-proxy`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ task }),
  }).catch((e) => ({ json: async () => ({ ok: false, error: String(e) }) }));
  const body = await res.json().catch(() => ({ ok: false, error: "bad proxy response" }));
  inFlight--;
  const r = body.result ?? {};
  const row = {
    run: RUN, id: c.id, name: c.name, model: MODEL.model, width: MODEL.width, height: MODEL.height,
    attempt: ledger.filter((x) => x.id === c.id).length + 1,
    seed: r.seed ?? null, taskUUID: r.taskUUID ?? null, cost: Number(r.cost ?? 0), latencyMs: body.latencyMs ?? null,
    prompt, at: new Date().toISOString(),
  };
  if (!body.ok || !r.imageURL) {
    ledger.push({ ...row, ok: false, error: JSON.stringify(body.error ?? body).slice(0, 500) });
    save();
    stop ??= `${c.id} failed: ${JSON.stringify(body.error ?? body).slice(0, 300)}`;
    return;
  }
  const img = await fetch(r.imageURL);
  const prev = ledger.findLast((x) => x.ok && x.id === c.id);
  if (prev && fs.existsSync(file)) {
    fs.mkdirSync(path.join(OUT, "attempts"), { recursive: true });
    fs.renameSync(file, path.join(OUT, "attempts", `${c.id}-${prev.attempt}.jpg`));
  }
  fs.writeFileSync(file, Buffer.from(await img.arrayBuffer()));
  ledger.push({ ...row, ok: true, file: path.basename(file) });
  save();
  console.log(`${c.id.padEnd(10)} $${row.cost.toFixed(4)} seed ${row.seed ?? "-"}  run $${runSpent().toFixed(4)}`);
}

const queue = [...chars];
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length && !stop) await one(queue.shift());
}));
if (stop) { console.log(`STOPPED: ${stop}`); process.exitCode = 2; }
console.log(`RUN $${runSpent().toFixed(4)} · ledger total $${spent().toFixed(4)} · ${ledger.filter((r) => r.ok).length} images in ${path.relative(ROOT, OUT)}`);
