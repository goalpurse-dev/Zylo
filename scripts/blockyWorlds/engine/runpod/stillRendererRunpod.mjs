// Blocky Worlds builder: the still renderer on RunPod (role "objectStills"), the same shape as lib/builder/still.mjs:
//   const r = await makeStillRenderer({ outDir });  await r.render("object", blueprint, { light, name, size, view })
//     -> { file, jpeg, w, h, ms, mean, flat, detail, bad, problems, remote: { jobId, seconds, usd } }
//   await r.close()      r.spent -> { jobs, seconds, usd }
// Calls that arrive within batchMs of each other go to ONE job (one cold start, one page load); the JPEGs come back
// inline in the job's output (no storage, only RUNPOD_API_KEY). A worker without graphics (NO_GPU) or of an older image
// (STALE_WORKER) has retired itself: the batch is sent once more. Used by:
//   lib/builder makeBuilder({ renderer: "runpod" })   and   STILL_RENDER=<this file> (the BUILDS runner)
// Latency: each job pays RunPod's start (FlashBoot ~2-15 s) + the GPU check + the still page load; the endpoint's
// idle timeout (5 s) means a worker is usually gone between two designs (a design call takes 20-60 s).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { rpClient, billed, endpointInfo, logSpend } from "./client.mjs";

export async function makeStillRenderer({ outDir = null, size = 768, batchMs = 250, maxBatch = 8, client = null, maxSec = 300, retries = 1, log = (m) => console.log(`runpod stills: ${m}`), minBuild = undefined } = {}) {
  const dir = outDir ?? fs.mkdtempSync(path.join(os.tmpdir(), "bw-rpstill-"));
  fs.mkdirSync(dir, { recursive: true });
  const rp = client ?? rpClient();
  let build = minBuild;
  if (build === undefined) { try { build = endpointInfo().build ?? null; } catch { build = null; } }
  const spent = { jobs: 0, seconds: 0, usd: 0 };
  let pending = [], timer = null, n = 0, closed = false;

  async function runBatch(batch) {
    const items = batch.map((b) => ({ kind: b.kind, spec: b.spec, light: b.opts.light ?? "day", label: b.name, ...(b.opts.size ? { size: b.opts.size } : {}), ...(b.opts.view ? { view: b.opts.view } : {}) }));
    const input = { job: { role: "objectStills", mode: "gpu", ...(build ? { minBuild: build } : {}), objectStills: { items, size } } };
    let st = null, last = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const t0 = Date.now();
      const id = await rp.submit(input);
      st = await rp.wait(id, { maxSec, pollMs: 1000 });
      const b = billed(st);
      spent.jobs++; spent.seconds = +(spent.seconds + b.seconds).toFixed(1); spent.usd = +(spent.usd + b.usd).toFixed(5);
      logSpend(dir, `Blocky Worlds objectStills ${id} (${st.status}, ${items.length} still(s))`, b);
      log(`job ${id}: ${st.status} ${items.length} still(s) in ${((Date.now() - t0) / 1000).toFixed(1)} s wall, ${b.seconds} s billed ($${b.usd})`);
      const out = st.output;
      if (st.status === "COMPLETED" && out?.ok) return { out, id, b };
      last = `${st.status}${out?.code ? ` ${out.code}` : ""}: ${String(out?.error ?? st.error ?? "").slice(0, 300)}`;
      if (!(out?.code === "NO_GPU" || out?.code === "STALE_WORKER" || st.status === "FAILED")) break;
    }
    throw new Error(`RunPod objectStills failed (${last})`);
  }

  function flush() {
    clearTimeout(timer); timer = null;
    const batch = pending.splice(0, pending.length);
    if (!batch.length) return;
    for (let i = 0; i < batch.length; i += maxBatch) {
      const part = batch.slice(i, i + maxBatch);
      runBatch(part).then(({ out, id, b }) => {
        part.forEach((p, k) => {
          const s = out.stills?.[k];
          if (!s || s.error || !s.b64) return p.reject(new Error(`still ${p.name}: ${s?.error ?? "no image came back"}`));
          const jpeg = Buffer.from(s.b64, "base64"), file = path.join(dir, `${p.name}.jpg`);
          fs.writeFileSync(file, jpeg);
          p.resolve({ file, jpeg, w: s.w, h: s.h, ms: Date.now() - p.t0, pageMs: s.ms, mean: s.mean, flat: s.flat, detail: s.detail, bad: !!s.bad, problems: s.problems ?? [], remote: { jobId: id, seconds: b.seconds, usd: b.usd, batch: part.length } });
        });
      }, (e) => part.forEach((p) => p.reject(e)));
    }
  }

  return {
    dir,
    get spent() { return { ...spent }; },
    render(kind, spec, opts = {}) {
      if (closed) return Promise.reject(new Error("the RunPod still renderer is closed"));
      return new Promise((resolve, reject) => {
        pending.push({ kind, spec, opts, name: String(opts.name ?? `${kind}-${++n}`).replace(/[^a-zA-Z0-9._-]+/g, "_"), resolve, reject, t0: Date.now() });
        if (pending.length >= maxBatch) flush(); else if (!timer) timer = setTimeout(flush, batchMs);
      });
    },
    /** the builder's preflight: the key and the endpoint are there (no job is sent: that would bill a cold start) */
    async ready() { if (!client) { endpointInfo(); } return null; },
    async close() { if (pending.length) flush(); closed = true; },
  };
}
