# Blocky Worlds: the RunPod serverless handler (docs/blocky-worlds-pipeline.md).
#  - a production job ({"job": {...}} from blocky-worlds-render, role prepare | chunk | finish): runpod/worker.mjs runs
#    it and reports to the callback itself; its RESULT is returned whether ok or not, so RunPod's webhook carries the
#    error code too (the server treats COMPLETED + ok:false as a failed try)
#  - a staging render ({"jobUrl": ...} or an inline ranges/whole job, runpod/dispatch.mjs): a failed render raises, so
#    RunPod marks it FAILED and the dispatcher retries it
# NO_GPU (a worker without graphics, gpu.mjs) returns with refresh_worker, so RunPod retires that worker and the retry
# runs elsewhere (Cutaway's fix; 2026-11-04 every retry of a Blocky test landed on the same slice).
import json
import subprocess

import runpod

ENGINE = "/app/scripts/blockyWorlds/engine"
WORKER = f"{ENGINE}/runpod/worker.mjs"


def run(payload, timeout):
    p = subprocess.run(["node", WORKER, json.dumps(payload)], capture_output=True, text=True, timeout=timeout, cwd=ENGINE)
    lines = [l for l in p.stdout.splitlines() if l.startswith("RESULT ")]
    return p, (json.loads(lines[-1][7:]) if lines else None)


def handler(job):
    data = job["input"]
    if "job" in data:
        try:
            p, result = run(data, 900)
        except subprocess.TimeoutExpired:
            return {"ok": False, "code": "JOB_TIMEOUT", "error": "the worker ran over 900 s"}
        if not result:
            return {"ok": False, "code": "WORKER_CRASHED", "error": (p.stderr or p.stdout)[-1500:]}
        if result.get("code") == "NO_GPU":
            result["refresh_worker"] = True
        return result
    p, result = run(data, 1500)
    if result and result.get("code") == "NO_GPU":
        result["refresh_worker"] = True
        return result
    if p.returncode != 0 or not result or not result.get("ok"):
        detail = result if result else {"error": (p.stderr or p.stdout)[-1500:]}
        raise Exception(json.dumps(detail)[:2000])
    return result


runpod.serverless.start({"handler": handler})
