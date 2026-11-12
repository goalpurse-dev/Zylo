// Blocky Worlds: after the endpoint is switched to a new image (runpod/setup.mjs), no worker of an older template / image
// may take another job. 2026-11-05 (run 7b4c0d8b): a worker of the image before (template rvi77mhbzt, a5af0fd5...) was
// still alive after the PATCH to zgm9yzlviz / eed71f19... and took the prepare job: old code, the mock director, $0.26 of
// builder for 0 built, the mix crashed. RunPod keeps a FlashBoot worker of the old template around (even EXITED ones can
// be resumed), so every worker that is not on the new template + image is terminated, then this waits until only new
// ones (or none) are left. Pure: the RunPod calls come in as `api` (setup.mjs passes the real REST, the tests fakes).
//   staleWorkers(workers, { templateId, image }) -> the workers to retire
//   retireStale({ api, endpointId, templateId, image, timeoutMs, pollMs, sleep, log }) -> { retired, left }
//   api: { workers(endpointId) -> [{ id, templateId, imageName, desiredStatus }], terminate(workerId) }

const GONE = new Set(["TERMINATED", "DELETED"]);

/** the workers that are not on the new template + image (and not terminated already) */
export function staleWorkers(workers, { templateId, image }) {
  return (workers ?? []).filter((w) => w && !GONE.has(String(w.desiredStatus ?? "").toUpperCase()) && (w.templateId !== templateId || (w.imageName && image && w.imageName !== image)));
}

export async function retireStale({ api, endpointId, templateId, image, timeoutMs = 300000, pollMs = 10000, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), log = console.log, now = () => Date.now() }) {
  const t0 = now(), retired = new Set(), tried = new Map();
  for (;;) {
    const stale = staleWorkers(await api.workers(endpointId), { templateId, image });
    if (!stale.length) { log(`workers: none left on an older template / image (${retired.size} retired)`); return { retired: [...retired], left: [] }; }
    for (const w of stale) {
      const n = tried.get(w.id) ?? 0;
      if (n >= 3) continue; // asked 3 times already: wait for RunPod
      tried.set(w.id, n + 1);
      try { await api.terminate(w.id); retired.add(w.id); log(`worker ${w.id} (template ${w.templateId}, ${String(w.imageName ?? "").slice(-20)}, ${w.desiredStatus}): terminate sent`); }
      catch (e) { log(`worker ${w.id}: terminate failed (${String(e?.message ?? e).slice(0, 200)})`); }
    }
    if (now() - t0 >= timeoutMs) {
      const left = stale.map((w) => w.id);
      throw Object.assign(new Error(`old workers still alive after ${Math.round(timeoutMs / 1000)} s: ${left.join(", ")}; terminate them in the RunPod console before any run (they would run the old code)`), { left });
    }
    await sleep(pollMs);
  }
}

/** the real RunPod calls (REST v1; GraphQL podTerminate as the fallback) for a key */
export function runpodApi(key, fetchFn = fetch) {
  const H = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  return {
    async workers(endpointId) {
      const r = await fetchFn(`https://rest.runpod.io/v1/endpoints/${endpointId}?includeWorkers=true`, { headers: H });
      if (!r.ok) throw new Error(`GET endpoint ${endpointId}: ${r.status}`);
      return (await r.json()).workers ?? [];
    },
    async terminate(workerId) {
      // a serverless worker is a pod: REST DELETE /pods/{id} terminates it; older accounts answer that on GraphQL only
      const r = await fetchFn(`https://rest.runpod.io/v1/pods/${workerId}`, { method: "DELETE", headers: H });
      if (r.ok || r.status === 404) return;
      const g = await fetchFn("https://api.runpod.io/graphql", { method: "POST", headers: H, body: JSON.stringify({ query: `mutation { podTerminate(input: { podId: "${String(workerId).replace(/[^a-z0-9]/gi, "")}" }) }` }) });
      const j = await g.json().catch(() => ({}));
      if (!g.ok || j.errors?.length) throw new Error(`terminate ${workerId}: REST ${r.status}, GraphQL ${g.status} ${JSON.stringify(j.errors ?? "").slice(0, 200)}`);
    },
  };
}
