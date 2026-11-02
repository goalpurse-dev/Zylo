// M3: one kept failure's plan, replayed free (no render, no voice): the planner on the real run's recorded replies.
// Prints RESULT {"problems": [...], "bugs": [...], "pending": key|null, "seconds": n}. Used by tests/cutawayFailures.test.mjs;
// the whole video is m3/replayFailures.mjs (the harness).
//   node m3/replayPlan.mjs <case folder>
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(process.argv[2]), c = JSON.parse(fs.readFileSync(path.join(dir, "case.json"), "utf8"));
const work = fs.mkdtempSync(path.join(os.tmpdir(), "cw-replay-"));
fs.cpSync(path.join(dir, "answers"), path.join(work, "answers"), { recursive: true });
// replay mode before the planner loads: every paid host is blocked, every Claude call answered from the case
process.env.CUTAWAY_PROVIDERS = "replay"; process.env.CUTAWAY_REPLAY_DIR = work;
const { planTopic } = await import(pathToFileURL(path.join(here, "../m2/planner.mjs")).href);
const { quoteTopic } = await import(pathToFileURL(path.join(here, "../../../../supabase/functions/_shared/cutaway/quote.js")).href);
// a premade topic plans on its approved layout, as the server sends it (the harness's list)
const reuse = quoteTopic(c.topic, c.lengthSec, new Set(["landfill", "french_drain", "car_wash"])).premade ?? null;
const t0 = Date.now();
let out;
try {
  const r = await planTopic({ topic: c.topic, lengthSec: c.lengthSec, reuse, library: [] });
  out = { problems: r.problems, bugs: r.bugs ?? [], pending: null };
} catch (e) {
  out = { problems: [], bugs: [], pending: e.code === "REPLAY_PENDING" ? String(e.message).replace(/^REPLAY_PENDING /, "") : null, error: e.code === "REPLAY_PENDING" ? null : String(e.stack ?? e).slice(0, 800) };
}
fs.rmSync(work, { recursive: true, force: true });
console.log(`RESULT ${JSON.stringify({ ...out, seconds: (Date.now() - t0) / 1000 })}`);
