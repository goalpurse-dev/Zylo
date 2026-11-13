// Blocky Worlds STUDIO WORKER: its settings, all from its own secrets (the process environment). Keys live ONLY here (Fly
// secrets of the worker app): never in an edge function, never in a RunPod job, never shown to the model. Nothing in
// this file prints a value: describeConfig() says which names are set.
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { STUDIO } from "../../../supabase/functions/_shared/blockyWorlds/studio.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** the secrets the worker cannot run without (by name; the owner sets them with `fly secrets set`) */
export const SECRET_NAMES = Object.freeze(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ANTHROPIC_API_KEY", "ELEVENLABS_API_KEY", "RUNPOD_API_KEY"]);
/** optional settings (not secret) */
export const OPTION_NAMES = Object.freeze(["BLOCKY_WORLDS_WORK_DIR", "BLOCKY_WORLDS_WORKER_VERSION", "BLOCKY_WORLDS_POLL_SEC", "BLOCKY_WORLDS_KEEP_WORK"]);

const has = (env, k) => String(env[k] ?? "").trim().length > 0;

/** which settings are set: { name: "set" | "missing" } (never a value) */
export function describeConfig(env = process.env) {
  return Object.fromEntries([...SECRET_NAMES, ...OPTION_NAMES].map((k) => [k, has(env, k) ? "set" : SECRET_NAMES.includes(k) ? "MISSING" : "default"]));
}

/** the endpoint the Studio render code will use (engine/runpod/endpoint.json): ONLY the Blocky endpoint, never Cutaway's */
export function checkEndpoint(file = path.resolve(HERE, "../engine/runpod/endpoint.json")) {
  const id = JSON.parse(fs.readFileSync(file, "utf8")).endpointId;
  if (STUDIO.forbiddenEndpoints.includes(id)) throw Object.assign(new Error(`endpoint.json points at ${id}, the Cutaway endpoint: refusing`), { code: "CONFIG" });
  if (id !== STUDIO.endpoint) throw Object.assign(new Error(`endpoint.json points at ${id}, not the Blocky endpoint ${STUDIO.endpoint}: refusing`), { code: "CONFIG" });
  return id;
}

/** -> the worker's config; throws (code CONFIG) naming every missing secret */
export function loadConfig(env = process.env, { endpointFile } = {}) {
  const missing = SECRET_NAMES.filter((k) => !has(env, k));
  if (missing.length) throw Object.assign(new Error(`the Studio worker is missing secrets: ${missing.join(", ")}`), { code: "CONFIG", missing });
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(String(env.SUPABASE_URL).trim()) && !/^http:\/\/(localhost|127\.0\.0\.1)/.test(String(env.SUPABASE_URL))) {
    throw Object.assign(new Error("SUPABASE_URL is not a Supabase project URL"), { code: "CONFIG" });
  }
  const endpoint = checkEndpoint(endpointFile);
  const machine = String(env.FLY_MACHINE_ID ?? "").trim();
  return Object.freeze({
    supabaseUrl: String(env.SUPABASE_URL).trim().replace(/\/$/, ""),
    serviceKey: String(env.SUPABASE_SERVICE_ROLE_KEY).trim(),
    anthropicKey: String(env.ANTHROPIC_API_KEY).trim(),
    elevenKey: String(env.ELEVENLABS_API_KEY).trim(),
    runpodKey: String(env.RUNPOD_API_KEY).trim(),
    endpoint,
    workerId: `${machine ? `fly-${machine}` : `local-${os.hostname()}`}-${process.pid}-${Date.now().toString(36)}`,
    version: String(env.BLOCKY_WORLDS_WORKER_VERSION ?? "").trim() || "dev",
    workDir: String(env.BLOCKY_WORLDS_WORK_DIR ?? "").trim() || path.join(os.tmpdir(), "blocky-studio"),
    pollSec: Math.max(3, Math.min(120, Number(env.BLOCKY_WORLDS_POLL_SEC) || 10)),
    keepWork: env.BLOCKY_WORLDS_KEEP_WORK === "1",
  });
}

/**
 * The engine's RunPod client and storage (engine/runpod/client.mjs) read RUNPOD_API_KEY / SUPABASE_URL /
 * SUPABASE_SERVICE_ROLE_KEY from the process environment when this flag is on (the laptop reads .env.local instead).
 */
export function keysFromEnv(env = process.env) { env.BLOCKY_WORLDS_KEYS_FROM_ENV = "1"; }
