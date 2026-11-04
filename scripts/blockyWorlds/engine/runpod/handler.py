# Blocky Worlds: the RunPod serverless handler (prepared only; nothing is built or deployed).
# Input: {"jobUrl": "https://..."} (a job JSON at a signed URL) or the job itself inline (see worker.mjs).
# A chunk job renders its frame range(s) and uploads each mp4; a whole job renders, muxes and uploads final.mp4.
# A failed render raises, so RunPod marks the job FAILED and the dispatcher retries it. NO_GPU returns with
# refresh_worker, so RunPod retires that worker and the retry runs elsewhere.
import json
import subprocess

import runpod

WORKER = "/app/engine/runpod/worker.mjs"


def handler(job):
    data = job["input"]
    p = subprocess.run(["node", WORKER, json.dumps(data)], capture_output=True, text=True, timeout=1500, cwd="/app/engine")
    lines = [l for l in p.stdout.splitlines() if l.startswith("RESULT ")]
    result = json.loads(lines[-1][7:]) if lines else None
    # a worker without graphics (a MIG slice: gpu.mjs says NO_GPU) retires after this job, so the retry lands on another
    # machine (Cutaway's fix; 2026-11-04 every retry of a Blocky test landed on the same slice)
    if result and result.get("code") == "NO_GPU":
        result["refresh_worker"] = True
        return result
    if p.returncode != 0 or not result or not result.get("ok"):
        detail = result if result else {"error": (p.stderr or p.stdout)[-1500:]}
        raise Exception(json.dumps(detail)[:2000])
    return result


runpod.serverless.start({"handler": handler})
