// LOCAL blocky-worlds-api (owner click-through before a deploy, 2026-11-15): runs supabase/functions/blocky-worlds-api
// on this laptop with Deno (npx deno, no Docker needed) against the REAL project database, with the keys from
// .env.local passed as environment variables (never printed, never written to a file).
//   node scripts/blockyWorlds/localApi.mjs            -> http://localhost:8000
//   then open http://localhost:5173/workspace/blocky-worlds?api=local  (signed in as an owner account)
// Paid calls happen only on the owner's clicks (a script ~$0.25, a character picture ~$0.001). "Make my video" asks
// first on localhost (the price confirm) and starts only when a Blender/Studio worker is alive (else: refused, nothing
// charged). Stop it with Ctrl+C (or end the node process).
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/).map((l) => l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]));
const need = { SUPABASE_URL: env.SUPABASE_URL || env.VITE_SUPABASE_URL, SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY };
const missing = Object.entries(need).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) { console.error(`missing in .env.local: ${missing.join(", ")}`); process.exit(1); }
// the switches: the live function's defaults, the Studio engine (the Blender worker serves its runs); any
// BLOCKY_WORLDS_* line in .env.local wins
const switches = { BLOCKY_WORLDS_ENGINE: "studio", ...Object.fromEntries(Object.entries(env).filter(([k]) => k.startsWith("BLOCKY_WORLDS_") && !/KEY|SECRET|TOKEN/.test(k))) };
const childEnv = { ...process.env, ...need, ...switches, DENO_NO_UPDATE_CHECK: "1" };
console.log(`local blocky-worlds-api on http://localhost:8000 (switches: ${Object.entries(switches).map(([k, v]) => `${k}=${v}`).join(", ")})`);
const p = spawn(process.platform === "win32" ? "npx.cmd" : "npx", ["-y", "deno@2.9.6", "run", "--allow-net", "--allow-env", "--allow-read", "--no-check", path.join(ROOT, "supabase/functions/blocky-worlds-api/index.ts")], { env: childEnv, stdio: "inherit", shell: process.platform === "win32" });
p.on("exit", (c) => process.exit(c ?? 0));
for (const s of ["SIGINT", "SIGTERM"]) process.on(s, () => p.kill(s));
