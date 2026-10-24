# M3: the RunPod serverless handler for the Cutaway worker.
#  - a production job ({"job": {...}}, from cutaway-api): m3/videoJob.mjs makes the whole video and reports to the
#    callback itself; its RESULT is returned (ok or not), so the server can also read it from RunPod's status
#  - a staging render ({"jobUrl": ...} or a render job): m3/worker.mjs, as before; a failed render raises, so RunPod marks
#    it FAILED and the staging dispatcher retries once, then falls back to the Fly CPU render
import json
import subprocess

import runpod

WT = "/app/wt/scripts/cutaway/proto3d/m3"


def run(script, payload, timeout):
    p = subprocess.run(["node", f"{WT}/{script}", json.dumps(payload)], capture_output=True, text=True, timeout=timeout)
    lines = [l for l in p.stdout.splitlines() if l.startswith("RESULT ")]
    return p, (json.loads(lines[-1][7:]) if lines else None)


def handler(job):
    data = job["input"]
    if "job" in data:
        p, result = run("videoJob.mjs", data, 2700)
        return result if result else {"ok": False, "code": "WORKER_CRASHED", "error": (p.stderr or p.stdout)[-1500:]}
    p, result = run("worker.mjs", data, 1500)
    if p.returncode != 0 or not result or not result.get("ok"):
        detail = result if result else {"error": (p.stderr or p.stdout)[-1500:]}
        raise Exception(json.dumps(detail)[:2000])
    return result


runpod.serverless.start({"handler": handler})
