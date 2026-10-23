# M3: the RunPod serverless handler for the Cutaway render worker. It hands the job input to the Node worker
# (m3/worker.mjs: GPU check, render, mix, upload) and returns its RESULT; a failed job raises, so RunPod marks it
# FAILED and the dispatcher retries once, then falls back to the Fly CPU render.
import json
import subprocess

import runpod

WORKER = "/app/wt/scripts/cutaway/proto3d/m3/worker.mjs"


def handler(job):
    p = subprocess.run(["node", WORKER, json.dumps(job["input"])], capture_output=True, text=True, timeout=1500)
    lines = [l for l in p.stdout.splitlines() if l.startswith("RESULT ")]
    result = json.loads(lines[-1][7:]) if lines else None
    if p.returncode != 0 or not result or not result.get("ok"):
        detail = result if result else {"error": (p.stderr or p.stdout)[-1500:]}
        raise Exception(json.dumps(detail)[:2000])
    return result


runpod.serverless.start({"handler": handler})
