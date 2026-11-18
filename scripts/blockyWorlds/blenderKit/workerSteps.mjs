// Blender kit engine as an OPTION of the Studio worker (scripts/blockyWorlds/studioWorker/): the same queue, claim,
// heartbeat, stages, cost ledger, refund-on-failure and owner's Details as the three.js Studio engine (runner.mjs), with
// the director and the render swapped for the Blender kit pipeline (pipeline.mjs).
// OFF BY DEFAULT: the worker uses these steps only when BOTH are set
//   BLOCKY_WORLDS_RENDER_ENGINE=blender
//   BLOCKY_WORLDS_BLENDER_OWNER_IDS=<user id>[,<user id>]   (or BLOCKY_WORLDS_BLENDER_ACCESS=everyone)
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
import { makeProgress } from "./progress.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** the Blender steps for an owner's run when the option is on; the given Studio steps otherwise (fail-safe) */
export function pickSteps(run, { studio, blender, env = process.env }) {
  const on = String(env.BLOCKY_WORLDS_RENDER_ENGINE ?? "").trim().toLowerCase() === "blender";
  const owners = String(env.BLOCKY_WORLDS_BLENDER_OWNER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return on && blender && run?.user_id && (env.BLOCKY_WORLDS_BLENDER_ACCESS === "everyone" || owners.includes(run.user_id)) ? blender : studio;
}

/** a run's own LOWER cap (card.cap_usd: our golden test), never above the live one */
export const capOf = (cfg, card) => Math.min(cfg.runCapUsd, Number(card?.cap_usd) > 0 ? Number(card.cap_usd) : Infinity);

/** the fix rounds: 2, like the local Milo run (STUDIO.rounds = 1 is the three.js engine's; cfg.blenderRounds overrides) */
export const blenderRounds = (cfg = {}) => Math.max(1, Math.min(2, Number(cfg.blenderRounds ?? 2) || 2));

export function makeBlenderSteps({ base, anthropicKey, cfg, env = process.env, node = process.execPath }) {
  const childEnvOf = () => ({ PATH: env.PATH, SystemRoot: env.SystemRoot, HOME: env.HOME, BLOCKY_WORLDS_KEYS_FROM_ENV: "1", ANTHROPIC_API_KEY: anthropicKey,
    RUNPOD_API_KEY: env.RUNPOD_API_KEY, SUPABASE_URL: env.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
    ...(env.BLOCKY_WORLDS_KIT_DIR ? { BLOCKY_WORLDS_KIT_DIR: env.BLOCKY_WORLDS_KIT_DIR } : {}) });
  return {
    /** the run's stored parts, removed only after the video is delivered (the runner calls it; never fatal) */
    async cleanup({ dir, log = console.log }) {
      if (!fs.existsSync(path.join(dir, "blender", "state.json"))) return;
      const code = await new Promise((resolve) => {
        const p = spawn(node, [path.join(HERE, "cleanup.mjs"), "--run", dir], { env: childEnvOf(), stdio: ["ignore", "pipe", "pipe"] });
        p.stdout.on("data", (b) => log(`blender: ${String(b).trim()}`));
        p.stderr.on("data", (b) => log(`blender cleanup stderr: ${String(b).slice(0, 300)}`));
        p.on("close", resolve);
      });
      if (code !== 0) log(`blender cleanup exit ${code} (the parts stay; harmless)`);
    },
    voice: base.voice,
    plan: base.plan,
    mix: base.mix,
    outputs: base.outputs,
    /** the whole Blender pipeline; returns the shape the runner checks (plan.shots, plan.bible.homes) + the report */
    async direct({ script, dir, L, card = null, log = console.log, builds = [], onProgress = null, progressEveryMs = 4000, resume = false }) {
      fs.writeFileSync(path.join(dir, "results.json"), JSON.stringify({ results: [{ script }] }));
      fs.writeFileSync(path.join(dir, "studio-builds.json"), JSON.stringify(builds ?? []));
      // LIBRARY MODE (the world library + tested camera spots, one fix round) and the owner's scene plan when the run has one
      const plan = card?.scene_plan?.scenes?.length ? path.join(dir, "scene-plan.json") : null;
      if (plan) fs.writeFileSync(plan, JSON.stringify(card.scene_plan));
      // the user's character references (characterRef.js specs on the run card): the director's style sheet
      const chars = Array.isArray(card?.characters) && card.characters.length ? path.join(dir, "characters.json") : null;
      if (chars) fs.writeFileSync(chars, JSON.stringify(card.characters.slice(0, 4)));
      // THE RUN CARD (owner 2026-11-16, live = the local Milo setup): the pipeline writes Milo-shaped production notes from it
      // before the plan and re-picks a scene plan that is only the free keyword pick (notes.mjs)
      const cardFile = card ? path.join(dir, "card.json") : null;
      if (cardFile) fs.writeFileSync(cardFile, JSON.stringify(card));
      const args = [path.join(HERE, "pipeline.mjs"), "--run", dir, "--voice-dir", path.join(dir, "voice"), "--model", cfg.blenderModel ?? "sonnet", "--worlds",
        "--rounds", String(blenderRounds(cfg)), "--cap", String(capOf(cfg, card)), "--agent-cap", String(Math.min(cfg.agentCapUsd, capOf(cfg, card))), "--chunks", String(cfg.blenderChunks ?? 6),
        ...(plan ? ["--scene-plan", plan] : []), ...(chars ? ["--characters", chars] : []), ...(cardFile ? ["--card", cardFile] : []), ...(card?.topic ? ["--topic", String(card.topic).slice(0, 200)] : []), "--defer-cleanup", "--yes", ...(resume ? ["--more-rounds"] : []), ...(card?.owner_force_render === true ? ["--force-render"] : [])];
      const childEnv = childEnvOf();
      // LIVE PROGRESS (progress.mjs): every line the pipeline prints feeds the tracker; its snapshot goes to the run row
      // every few seconds (onProgress), so the page always moves
      const tracker = makeProgress();
      let lastSent = "";
      const tick = () => {
        if (!onProgress) return;
        const p = tracker.snapshot(), k = `${p.stage}|${p.pct}|${p.detail}`;
        if (k !== lastSent) { lastSent = k; Promise.resolve().then(() => onProgress(p)).catch(() => {}); }
      };
      const timer = onProgress ? setInterval(tick, progressEveryMs) : null;
      tick();
      const code = await new Promise((resolve) => {
        const p = spawn(node, args, { env: childEnv, stdio: ["ignore", "pipe", "pipe"] });
        p.stdout.on("data", (b) => String(b).split("\n").filter(Boolean).forEach((l) => { tracker.feed(l); log(`blender: ${l}`); }));
        p.stderr.on("data", (b) => log(`blender stderr: ${String(b).slice(0, 400)}`));
        p.on("close", resolve);
      });
      if (timer) clearInterval(timer);
      tick();
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
