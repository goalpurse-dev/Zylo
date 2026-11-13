// Blender kit engine as an OPTION of the Studio worker (scripts/blockyWorlds/studioWorker/): the same queue, claim,
// heartbeat, stages, cost ledger, refund-on-failure and owner's Details as the three.js Studio engine (runner.mjs), with
// the director and the render swapped for the Blender kit pipeline (pipeline.mjs).
// OFF BY DEFAULT and OWNER-ONLY: the worker uses these steps only when BOTH are set
//   BLOCKY_WORLDS_RENDER_ENGINE=blender
//   BLOCKY_WORLDS_BLENDER_OWNER_IDS=<user id>[,<user id>]   (runs of anyone else keep the three.js Studio steps)
//   pickSteps(run, { studio, blender, env }) -> the steps for this run
//   makeBlenderSteps({ base, anthropicKey, cfg }) -> { voice, plan, mix, direct, final, outputs }
// voice / plan / mix / outputs are the Studio steps (Scruffy Duck on eleven_v3, 1.25x + the pause cuts; the free base
// plan; the mix the runner hands on); `direct` runs the whole Blender pipeline in a child process (director, previews,
// at most 2 fix rounds, the parallel final on the Blender endpoint, the kit's finish with OUR music and captions) under
// the run's ledger (the child books into the same costs.json; the runner's ledger is refreshed from it after), and
// `final` hands the finished mp4 on. The child gets only the keys it needs, in its environment.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** the Blender steps for an owner's run when the option is on; the given Studio steps otherwise (fail-safe) */
export function pickSteps(run, { studio, blender, env = process.env }) {
  const on = String(env.BLOCKY_WORLDS_RENDER_ENGINE ?? "").trim().toLowerCase() === "blender";
  const owners = String(env.BLOCKY_WORLDS_BLENDER_OWNER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return on && blender && run?.user_id && owners.includes(run.user_id) ? blender : studio;
}

export function makeBlenderSteps({ base, anthropicKey, cfg, env = process.env, node = process.execPath }) {
  return {
    voice: base.voice,
    plan: base.plan,
    mix: base.mix,
    outputs: base.outputs,
    /** the whole Blender pipeline; returns the shape the runner checks (plan.shots, plan.bible.homes) + the report */
    async direct({ script, dir, L, log = console.log, builds = [] }) {
      fs.writeFileSync(path.join(dir, "results.json"), JSON.stringify({ results: [{ script }] }));
      fs.writeFileSync(path.join(dir, "studio-builds.json"), JSON.stringify(builds ?? []));
      const args = [path.join(HERE, "pipeline.mjs"), "--run", dir, "--voice-dir", path.join(dir, "voice"), "--model", cfg.blenderModel ?? "sonnet",
        "--rounds", String(Math.min(2, cfg.blenderRounds ?? 2)), "--cap", String(cfg.runCapUsd), "--agent-cap", String(cfg.agentCapUsd), "--chunks", String(cfg.blenderChunks ?? 6), "--yes"];
      const childEnv = { PATH: env.PATH, SystemRoot: env.SystemRoot, HOME: env.HOME, BLOCKY_WORLDS_KEYS_FROM_ENV: "1", ANTHROPIC_API_KEY: anthropicKey,
        RUNPOD_API_KEY: env.RUNPOD_API_KEY, SUPABASE_URL: env.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
        ...(env.BLOCKY_WORLDS_KIT_DIR ? { BLOCKY_WORLDS_KIT_DIR: env.BLOCKY_WORLDS_KIT_DIR } : {}) };
      const code = await new Promise((resolve) => {
        const p = spawn(node, args, { env: childEnv, stdio: ["ignore", "pipe", "pipe"] });
        p.stdout.on("data", (b) => String(b).split("\n").filter(Boolean).forEach((l) => log(`blender: ${l}`)));
        p.stderr.on("data", (b) => log(`blender stderr: ${String(b).slice(0, 400)}`));
        p.on("close", resolve);
      });
      // the child booked into the same costs.json: the runner's ledger picks it up (its book() turns it into ledger rows)
      try { Object.assign(L.costs, JSON.parse(fs.readFileSync(path.join(dir, "costs.json"), "utf8"))); } catch { /* nothing booked */ }
      const repFile = path.join(dir, "blender", "report.json");
      if (code !== 0 || !fs.existsSync(repFile)) {
        const tail = fs.existsSync(path.join(dir, "blender", "pipeline.log")) ? fs.readFileSync(path.join(dir, "blender", "pipeline.log"), "utf8").trim().split("\n").slice(-3).join(" | ") : `exit ${code}`;
        log(`stopping: the Blender pipeline failed: ${tail}`);
        return { plan: null, report: { finished: { reason: tail } } };
      }
      const report = JSON.parse(fs.readFileSync(repFile, "utf8"));
      return { plan: { shots: Array.from({ length: report.shots }, (_, i) => ({ id: i + 1 })), bible: { homes: { blender: true } } }, report, blender: report };
    },
    /** the final was rendered by `direct` (the kit's finish: mix + captions inside the mp4) */
    async final({ dir }) {
      const f = path.join(dir, "blender", "final.mp4");
      if (!fs.existsSync(f)) throw Object.assign(new Error("the Blender final is missing"), { code: "RENDER_FAILED" });
      return { final: f, frames: null, jobs: null, wallSec: null, gate: null, cuts: null, mix: null };
    },
  };
}
