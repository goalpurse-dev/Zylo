// THE DEFERRED CLEANUP (owner 2026-11-16): the worker runs pipeline.mjs with --defer-cleanup, so the run's stored parts
// (the RunPod storage folder in state.rpPrefix: the uploaded video tars, the final segments, the finish outputs) stay
// until the final is uploaded AND the run is Ready; then the runner calls this (workerSteps.mjs cleanup).
//   node cleanup.mjs --run <run dir>
import fs from "node:fs";
import path from "node:path";
import { ledger } from "../studio/ledger.mjs";
import { runpod } from "./rp.mjs";

const argv = process.argv.slice(2);
const RUN = path.resolve(argv[argv.indexOf("--run") + 1]);
const stateFile = path.join(RUN, "blender", "state.json");
const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, "utf8")) : {};
if (!state.rpPrefix) { console.log("cleanup: no storage folder"); process.exit(0); }
const R = runpod({ L: ledger(RUN, { capUsd: 0, agentCapUsd: 0 }), prefix: state.rpPrefix, log: console.log });
await R.cleanup();
console.log(`cleanup: removed ${state.rpPrefix}`);
