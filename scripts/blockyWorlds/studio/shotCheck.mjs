// STUDIO MODE: the free Node pre-check of every shot (no render, no money), run in a SANDBOXED CHILD PROCESS (owner
// 2026-11-13). The director's shot / asset code is validated by the whitelist (studio/validate.mjs) and then RUN against
// a stub api (studio/shotCheckCore.mjs); that run happens only in a separate Node process that gets:
//   - an EMPTY environment (no API keys, no database keys: nothing to read even if the code escaped the vm)
//   - Node's permission model: read access to the Studio code + the validator's parser only (never .env.local), no file
//     writes, no child processes, no worker threads, no native addons
//   - no network: fetch / WebSocket / net / tls / http / https / dns / dgram are disabled before the core loads
//     (sandbox/noNet.mjs; Node 25+ also denies the network by the permission model itself)
//   - a time limit (the whole check is killed after 120 s)
// Any sandbox failure throws (fail closed: an unchecked cut never counts as checked).
//   checkShots({ shots, assets, homes, cast, timing }) -> { [shotId]: { ok, errors, motion, ... } }  (see the core)
//   assetInfo(code, { homes, cast })                   -> { ok, errors, glow, prims }
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
export { kitProps, MIN_MOVE, MIN_STEP } from "./shotCheckCore.mjs"; // a file read only: no director code runs

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENGINE = path.resolve(HERE, "../engine");
const CHILD = path.join(HERE, "sandbox", "checkChild.mjs");
const real = (p) => { try { return fs.realpathSync(p); } catch { return p; } };

/** the child's Node flags: the permission model (stable flag from Node 22.13 / 23.5), reads limited to what it loads */
export function sandboxFlags() {
  const [maj, min] = process.versions.node.split(".").map(Number);
  const flag = maj > 23 || (maj === 23 && min >= 5) || (maj === 22 && min >= 13) ? "--permission" : "--experimental-permission";
  const reads = [HERE, path.join(ENGINE, "package.json"), path.join(ENGINE, "node_modules", "esprima"), path.join(ENGINE, "page", "simple", "boardProps.js")];
  return [flag, ...[...new Set([...reads, ...reads.map(real)])].map((p) => `--allow-fs-read=${p}`)];
}

/** one call into the sandboxed core; throws on any failure */
export function sandboxed(fn, args, { timeoutMs = 120_000 } = {}) {
  const r = spawnSync(process.execPath, [...sandboxFlags(), CHILD], { input: JSON.stringify({ fn, args }), env: {}, encoding: "utf8", maxBuffer: 64 << 20, timeout: timeoutMs, windowsHide: true });
  if (r.error || r.status !== 0) throw Object.assign(new Error(`the sandboxed shot check failed (${r.error?.code ?? `exit ${r.status}${r.signal ? ` ${r.signal}` : ""}`}): ${String(r.stderr ?? "").trim().split("\n").slice(-3).join(" | ").slice(0, 400)}`), { code: "SANDBOX" });
  const out = JSON.parse(r.stdout);
  if (!out.ok) throw Object.assign(new Error(`the sandboxed shot check failed: ${out.error}`), { code: "SANDBOX" });
  return out.result;
}

export const checkShots = (args) => sandboxed("checkShots", args);

// assetInfo is asked again for the same code (define_assets, the shot mix every write): cached by the code + context
const INFO = new Map();
export function assetInfo(code, ctx = {}) {
  const key = createHash("sha256").update(JSON.stringify([code, ctx])).digest("hex");
  if (!INFO.has(key)) { if (INFO.size > 500) INFO.clear(); INFO.set(key, sandboxed("assetInfo", [code, ctx])); }
  return INFO.get(key);
}
