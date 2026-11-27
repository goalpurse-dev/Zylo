// A reference scan as a job (owner 2026-11-26): the reference-api function starts ONE machine on the render app
// (render-worker image, tag "scan") with this job in its environment; the machine downloads the video, scans it
// (render-worker/src/scan) and reports back to reference-api with an HMAC token, the same way the final-video jobs do.
// Plain JS (Web Crypto only), shared by the function (Deno), the worker (Node) and the tests.

export const SCAN_MACHINE = Object.freeze({ cpu_kind: "shared", cpus: 2, memory_mb: 2048 });
// USD a second for the machine above (Fly list price estimate), logged with the scan's own costs
export const SCAN_MACHINE_USD_PER_SECOND = 0.0000077;

export function scanMachineConfig({ image, job }) {
  return {
    name: `ref-scan-${String(job.scanId).slice(0, 8)}-${Date.now().toString(36)}`,
    config: {
      image, guest: SCAN_MACHINE, auto_destroy: true, restart: { policy: "no" },
      init: { cmd: ["node", "src/scan/scanJob.mjs"] },
      env: { REFERENCE_SCAN_JOB: JSON.stringify(job), WORK_DIR: "/tmp/scan", MACHINE_USD_PER_SECOND: String(SCAN_MACHINE_USD_PER_SECOND) },
    },
  };
}

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
async function hmac(secret, text) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(text)));
}
/** the token a scan machine reports with (only the machine that got the job knows it) */
export const scanToken = (secret, scanId) => hmac(secret, `reference-scan:${scanId}`);
export async function scanTokenOk(secret, scanId, token) {
  if (!secret || !token) return false;
  const want = await scanToken(secret, scanId);
  if (want.length !== String(token).length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ String(token).charCodeAt(i);
  return diff === 0;
}

/** the steps the page shows while scanning ("Scanning your video… about 20 s") */
export const SCAN_STEPS = Object.freeze([
  { id: "queued", label: "Getting ready", pct: 5 },
  { id: "downloading", label: "Getting your video", pct: 15 },
  { id: "cutting", label: "Finding every cut", pct: 35 },
  { id: "listening", label: "Listening to the voice and music", pct: 60 },
  { id: "watching", label: "Watching it like a director", pct: 85 },
  { id: "done", label: "Done", pct: 100 },
]);
export const stepPct = (id) => SCAN_STEPS.find((s) => s.id === id)?.pct ?? 0;
