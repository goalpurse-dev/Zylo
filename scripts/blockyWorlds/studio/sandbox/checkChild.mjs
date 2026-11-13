// STUDIO MODE sandbox child (started only by studio/shotCheck.mjs, with an empty env and Node's permission model): the
// network is switched off first (noNet.mjs), then the shot-check core runs the director's code against the stub api.
// stdin: { fn: "checkShots" | "assetInfo", args } -> stdout: { ok, result } | { ok: false, error }
import "./noNet.mjs";

const FNS = new Set(["checkShots", "assetInfo"]);
let input = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) input += chunk;
let out;
try {
  const { fn, args } = JSON.parse(input);
  if (!FNS.has(fn)) throw new Error(`unknown sandbox call ${fn}`);
  const core = await import("../shotCheckCore.mjs");
  out = { ok: true, result: fn === "checkShots" ? core.checkShots(args) : core.assetInfo(...args) };
} catch (e) { out = { ok: false, error: String(e?.message ?? e).slice(0, 500) }; }
process.stdout.write(JSON.stringify(out));
