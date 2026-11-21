# Blender kit engine (phase 1): the RunPod serverless handler. The kit's own tools do the work, unchanged:
#   role "probe"  : how Blender reaches the GPU here (EGL, VirtualGL on Xvfb, Vulkan), which sandbox the container
#                   allows, and optionally one real shot rendered with the kit (seconds per frame)
#   role "render" : kit tools/render.py <slug> final <shots>  -> frames -> one high-quality segment (x264 crf 12)
#   role "finish" : the segments in order -> frames/%04d.png -> kit tools/finish.py (voice + sfx + OUR music, captions)
# Files leave and arrive through signed storage URLs only (the job carries them); an output over 45 MB goes up in parts
# (the bucket allows 50 MB per file) and the laptop joins the parts by bytes.
# Sandbox (README.md): Blender and finish.py run as the user "render" with a whitelisted environment (no keys, no RunPod
# variables, no signed URLs), in a network namespace when the container allows one, and Blender's Python starts with
# boot.py (no sockets, no subprocesses). Results: the handler's return value (RunPod keeps it with the job status).
import glob
import json
import os
import re
import shutil
import subprocess
import tarfile
import threading
import time
import urllib.request

import runpod

import finishx  # OUR step after the kit's finish (-14 LUFS, captions per speaker)

KIT = "/app/kit"
APP = "/app"
BLENDER = "/opt/blender/blender"
VGLRUN = "/opt/VirtualGL/bin/vglrun"
MUSIC = "/app/music/zyvo_music.wav"
USER = "render"
GLCACHE = "/tmp/bk-glcache"
PART = 45 * 1024 * 1024
SOFTWARE = re.compile(r"llvmpipe|softpipe|lavapipe|swiftshader|swrast|software", re.I)
STATE = {"sandbox": None, "gpu": {}, "xvfb": None}


def log(*a):
    print("[blender-kit]", *a, flush=True)


def sh(cmd, timeout=60, **kw):
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, **kw)
        return p.returncode, (p.stdout + p.stderr).strip()
    except Exception as e:  # noqa: BLE001
        return -1, f"{type(e).__name__}: {e}"


def uid_gid():
    import pwd
    pw = pwd.getpwnam(USER)
    return pw.pw_uid, pw.pw_gid


def clean_env(home, extra=None):
    """the only variables a sandboxed program sees (never RUNPOD_*, never a key)"""
    keep = {k: os.environ[k] for k in ("NVIDIA_VISIBLE_DEVICES", "NVIDIA_DRIVER_CAPABILITIES", "CUDA_VISIBLE_DEVICES",
                                       "__EGL_VENDOR_LIBRARY_FILENAMES") if k in os.environ}
    # the NVIDIA driver's shader cache outlives the job folder: later jobs on a warm worker skip EEVEE's shader compiles
    return {"PATH": "/usr/local/bin:/usr/bin:/bin", "HOME": home, "TMPDIR": home, "LANG": "C.UTF-8", "LC_ALL": "C.UTF-8",
            "__GL_SHADER_DISK_CACHE": "1", "__GL_SHADER_DISK_CACHE_PATH": GLCACHE, "__GL_SHADER_DISK_CACHE_SKIP_CLEANUP": "1",
            "__GL_SHADER_DISK_CACHE_SIZE": "4000000000", **keep, **(extra or {})}


NETTEST = ("import socket,sys\n"
           "try:\n socket.create_connection(('1.1.1.1',443),3); print('NET_OPEN')\n"
           "except Exception as e:\n print('NET_BLOCKED', type(e).__name__)\n")


def gl_cache():
    os.makedirs(GLCACHE, exist_ok=True)
    uid, gid = uid_gid()
    os.chown(GLCACHE, uid, gid)


def sandbox():
    """the command prefix that drops to the render user (+ a network namespace when possible); decided once per worker"""
    if STATE["sandbox"]:
        return STATE["sandbox"]
    uid, gid = uid_gid()
    drop = ["setpriv", f"--reuid={uid}", f"--regid={gid}", "--clear-groups", "--no-new-privs", "--"]
    tried = []
    seccomp = ["python3", f"{APP}/netblock.py", "--"]
    for name, prefix in (("netns+user", ["unshare", "--net", "--"] + drop),
                         ("user+userns-net", drop + ["unshare", "--net", "--map-root-user", "--"]),
                         ("user+seccomp", drop + seccomp),
                         ("user-only", drop)):
        rc, out = sh(prefix + ["python3", "-c", NETTEST], timeout=20, env=clean_env("/tmp"))
        tried.append(f"{name}: rc {rc} {out[-120:]}")
        if rc == 0 and "NET_BLOCKED" in out:
            STATE["sandbox"] = {"name": name, "prefix": prefix, "network": "blocked by the kernel (" + ("seccomp: AF_UNIX sockets only" if "seccomp" in name else "network namespace") + ")", "tried": tried}
            return STATE["sandbox"]
        if rc == 0 and name == "user-only":
            STATE["sandbox"] = {"name": name, "prefix": prefix, "network": "open at OS level; blocked in Blender's Python (boot.py) only", "tried": tried}
            return STATE["sandbox"]
    raise RuntimeError("no sandbox works: " + " | ".join(tried))


def start_xvfb():
    if STATE["xvfb"] and STATE["xvfb"].poll() is None:
        return
    STATE["xvfb"] = subprocess.Popen(["Xvfb", ":99", "-screen", "0", "1280x720x24", "-nolisten", "tcp", "-ac"],
                                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.5)


def blender_cmd(mode, args):
    base = [BLENDER, "-b", "--factory-startup", "--offline-mode"]
    if mode == "vulkan":
        base += ["--gpu-backend", "vulkan"]
    pre, extra = [], {}
    if mode == "vgl":
        start_xvfb()
        pre, extra = [VGLRUN, "-d", "egl"], {"DISPLAY": ":99"}
    return pre + base + ["-P", f"{APP}/boot.py"] + args, extra


class GpuWatch:
    """samples nvidia-smi while a render runs: proof the GPU does the work, and its peak memory"""
    def __init__(self):
        self.samples, self.stop = [], threading.Event()
        self.t = threading.Thread(target=self.run, daemon=True)

    def run(self):
        while not self.stop.is_set():
            rc, out = sh(["nvidia-smi", "--query-gpu=utilization.gpu,memory.used", "--format=csv,noheader,nounits"], timeout=10)
            if rc == 0 and out:
                try:
                    u, m = [float(x) for x in out.splitlines()[0].split(",")]
                    self.samples.append((u, m))
                except ValueError:
                    pass
            self.stop.wait(2)

    def __enter__(self):
        self.t.start()
        return self

    def __exit__(self, *a):
        self.stop.set()
        self.t.join(timeout=15)

    def summary(self):
        if not self.samples:
            return {"samples": 0}
        us = [u for u, _ in self.samples]
        return {"samples": len(us), "utilMeanPct": round(sum(us) / len(us)), "utilMaxPct": max(us), "memMaxMiB": max(m for _, m in self.samples)}


def run_sandboxed(cmd, cwd, timeout, extra_env=None, sandboxed=True):
    sb = sandbox() if sandboxed else {"prefix": []}
    home = os.path.join(cwd, ".home")
    os.makedirs(home, exist_ok=True)
    uid, gid = uid_gid()
    os.chown(home, uid, gid)
    gl_cache()
    with GpuWatch() as gw:
        t = time.time()
        try:
            p = subprocess.run(sb["prefix"] + cmd, cwd=cwd, env=clean_env(home, extra_env), capture_output=True, text=True, timeout=timeout)
            rc, out = p.returncode, p.stdout + p.stderr
        except subprocess.TimeoutExpired as e:
            rc, out = -9, f"TIMEOUT after {timeout}s\n{(e.stdout or b'')[-3000:]!r}"
    return rc, out, round(time.time() - t, 1), gw.summary()


VIDEO_FILES = {"shots.py": 2_000_000, "script.txt": 100_000, "audio/words.json": 2_000_000, "audio/voice.wav": 60_000_000,
               "audio/cues.json": 2_000_000, "audio/sentences.json": 2_000_000, "audio/music_bed.wav": 60_000_000, "audio/caption_colors.json": 1_000_000}


def fetch_video(url, dest_dir):
    """a generated video folder (tar.gz from the dispatcher's signed URL): only the known files, size-capped, no links;
    then the static pre-check of its shots.py (shotcheck.py) before any Blender sees it"""
    tgz = dest_dir + ".tgz"
    get_parts([url] if isinstance(url, str) else url, tgz)
    os.makedirs(dest_dir, exist_ok=True)
    with tarfile.open(tgz, "r:gz") as tf:
        for m in tf.getmembers():
            name = m.name.lstrip("./")
            if m.isdir():
                continue
            if name not in VIDEO_FILES or not m.isfile() or m.size > VIDEO_FILES[name]:
                raise RuntimeError(f"video tar: refused member {m.name!r} ({m.size} bytes)")
            os.makedirs(os.path.join(dest_dir, os.path.dirname(name)), exist_ok=True)
            with tf.extractfile(m) as src, open(os.path.join(dest_dir, name), "wb") as dst:
                shutil.copyfileobj(src, dst)
    os.remove(tgz)
    for need in ("shots.py", "audio/words.json", "audio/voice.wav"):
        if not os.path.exists(os.path.join(dest_dir, need)):
            raise RuntimeError(f"video tar: {need} missing")
    rc, out = sh(["python3", "-I", f"{APP}/shotcheck.py", os.path.join(dest_dir, "shots.py")], timeout=60)
    if rc != 0:
        raise ShotCheck(out[-2000:])


class ShotCheck(Exception):
    pass


def workspace(job_id, slug, video_url=None):
    """/tmp/bk/<job>: the kit's code + assets linked read-only (root-owned), the video folder copied and owned by render
    (a generated video: downloaded from video_url, validated and statically checked)"""
    ws = f"/tmp/bk/{re.sub(r'[^A-Za-z0-9_-]', '', job_id)[:60]}"
    shutil.rmtree(ws, ignore_errors=True)
    os.makedirs(os.path.join(ws, "videos"), exist_ok=True)
    # code copied (small; the kit takes its studio root from its own file paths), assets + sounds linked read-only
    for name in ("rbx", "tools"):
        shutil.copytree(os.path.join(KIT, name), os.path.join(ws, name))
    for name in ("assets", "sfx"):
        os.symlink(os.path.join(KIT, name), os.path.join(ws, name))
    shutil.copy2(os.path.join(KIT, "config.json"), os.path.join(ws, "config.json"))
    if video_url:
        fetch_video(video_url, os.path.join(ws, "videos", slug))
    else:
        shutil.copytree(os.path.join(KIT, "videos", slug), os.path.join(ws, "videos", slug))
    uid, gid = uid_gid()
    for root, dirs, files in os.walk(ws):
        for n in dirs + files:
            pth = os.path.join(root, n)
            if not os.path.islink(pth):
                os.chown(pth, uid, gid)
    os.chown(ws, uid, gid)
    return ws


def gpu_check(mode, ws, sandboxed=True):
    out_png = os.path.join(ws, ".home", f"gpucheck_{mode}{'' if sandboxed else '_root'}.png")
    cmd, extra = blender_cmd(mode, ["-P", f"{APP}/gpucheck.py", "--", out_png])
    rc, out, secs, gw = run_sandboxed(cmd, ws, 180, extra, sandboxed)
    m = [l for l in out.splitlines() if l.startswith("GPUCHECK ")]
    info = json.loads(m[-1][9:]) if m else {}
    renderer = " ".join(str(info.get(k, "")) for k in ("vendor", "renderer", "backend_type"))
    ok = rc == 0 and bool(m) and os.path.exists(out_png) and not SOFTWARE.search(renderer) and ("nvidia" in renderer.lower() or gw.get("memMaxMiB", 0) > 300)
    tail = [l for l in out.splitlines() if re.search(r"error|fail|unable|display|egl|vulkan|gpu|nvidia|traceback", l, re.I)][-12:]
    return {"mode": mode, "ok": ok, "rc": rc, "seconds": secs, "info": info, "gpuWatch": gw, "log": tail}


def ensure_gpu(ws, modes):
    """first mode that draws on the NVIDIA GPU; cached for the worker's life"""
    for mode in modes:
        if mode in STATE["gpu"] and STATE["gpu"][mode]["ok"]:
            return STATE["gpu"][mode]
    tried = []
    for mode in modes:
        r = STATE["gpu"].get(mode) or gpu_check(mode, ws)
        STATE["gpu"][mode] = r
        tried.append(r)
        if r["ok"]:
            return r
    raise NoGpu(json.dumps([{k: t[k] for k in ("mode", "rc", "info", "gpuWatch", "log")} for t in tried])[:3000])


class NoGpu(Exception):
    pass


def put_parts(path, urls, ctype):
    """uploads a file in <= 45 MB parts to the given signed upload URLs (in order); returns the part count"""
    size = os.path.getsize(path)
    n = max(1, -(-size // PART))
    if n > len(urls):
        raise RuntimeError(f"{os.path.basename(path)} is {size} bytes: needs {n} parts, the job gave {len(urls)} URLs")
    with open(path, "rb") as f:
        for i in range(n):
            body = f.read(PART)
            for attempt in range(4):
                try:
                    req = urllib.request.Request(urls[i], data=body, method="PUT", headers={"Content-Type": ctype if n == 1 else "application/octet-stream", "x-upsert": "true"})
                    with urllib.request.urlopen(req, timeout=300) as r:
                        r.read()
                    break
                except Exception as e:  # noqa: BLE001
                    if attempt == 3:
                        raise RuntimeError(f"upload {os.path.basename(path)} part {i}: {str(e)[:200]}")
                    time.sleep(3 * (attempt + 1))
    return {"parts": n, "bytes": size}


def get_parts(urls, dest):
    with open(dest, "wb") as f:
        for u in urls:
            for attempt in range(4):
                try:
                    with urllib.request.urlopen(u, timeout=300) as r:
                        f.write(r.read())
                    break
                except Exception as e:  # noqa: BLE001
                    if attempt == 3:
                        raise RuntimeError(f"download {os.path.basename(dest)}: {str(e)[:200]}")
                    time.sleep(3 * (attempt + 1))
    return os.path.getsize(dest)


def shot_failures(log_text):
    """render_log_<kind>.txt -> {shot id: the traceback's last lines} (the kit writes "shot XX FAILED" + the traceback)"""
    out, cur = {}, None
    for l in log_text.splitlines():
        m = re.match(r"shot (\d+) (ok|FAILED)", l)
        if m:
            cur = int(m.group(1)) if m.group(2) == "FAILED" else None
            if cur is not None:
                out[cur] = []
            continue
        if cur is not None and l.strip():
            out[cur].append(l)
    return {k: "\n".join(v[-6:])[:900] for k, v in out.items()}


def kit_render(ws, slug, mode, shots, samples=None, kind="final", timeout=3000):
    # through the workspace's linked tools/: the kit takes its studio root from the script's path (shotkit.STUDIO),
    # so the videos it reads and writes are the workspace's, never /app/kit's
    args = ["-P", os.path.join(ws, "tools", "render.py"), "--", slug, kind, shots] + ([str(samples)] if samples else [])
    cmd, extra = blender_cmd(mode, args)
    rc, out, secs, gw = run_sandboxed(cmd, ws, timeout, extra)
    vdir = os.path.join(ws, "videos", slug)
    lp = os.path.join(vdir, f"render_log_{kind}.txt")
    text = open(lp, encoding="utf-8").read() if os.path.exists(lp) else ""
    lines = text.splitlines()
    shot_s = {int(m.group(1)): float(m.group(2)) for m in (re.match(r"shot (\d+) ok ([\d.]+)s", l) for l in lines) if m}
    fails = shot_failures(text)
    failed = [f"shot {k} FAILED: {v}" for k, v in fails.items()] + [l for l in lines if l.startswith("TIMELINE:")]
    if rc != 0 and not lines:
        failed.append("blender rc %s: %s" % (rc, "\n".join(out.splitlines()[-8:])[-800:]))
    return rc, out, secs, gw, shot_s, failed


def encode_segment(ws, slug, f0, f1, dest):
    fdir = os.path.join(ws, "videos", slug, "frames")
    have = {int(os.path.basename(p)[:-4]) for p in glob.glob(os.path.join(fdir, "*.png"))}
    missing = [f for f in range(f0, f1 + 1) if f not in have]
    if missing:
        raise RuntimeError(f"frames missing: {len(missing)} of {f1 - f0 + 1} (first {missing[:5]})")
    rc, out = sh(["ffmpeg", "-v", "error", "-y", "-framerate", "30", "-start_number", str(f0), "-i", os.path.join(fdir, "%04d.png"),
                  "-frames:v", str(f1 - f0 + 1), "-c:v", "libx264", "-preset", "medium", "-crf", "12", "-pix_fmt", "yuv420p",
                  "-movflags", "+faststart", dest], timeout=900)
    if rc != 0:
        raise RuntimeError("segment encode failed: " + out[-500:])


def role_probe(inp, job_id):
    slug = inp.get("slug", "sneeze_teleport")
    ws = workspace(job_id, slug)
    res = {"role": "probe", "nvidiaSmi": sh(["nvidia-smi", "-L"])[1][:300], "blender": sh([BLENDER, "-b", "--factory-startup", "--version"], timeout=120)[1].splitlines()[:1],
           "eglVendors": os.listdir("/usr/share/glvnd/egl_vendor.d") if os.path.isdir("/usr/share/glvnd/egl_vendor.d") else [],
           "nvidiaLibs": sh(["sh", "-c", "ls /usr/lib/x86_64-linux-gnu | grep -E 'libEGL_nvidia|libGLX_nvidia|libnvidia-glcore' | head"])[1][:300]}
    sb = sandbox()
    res["sandbox"] = {k: sb[k] for k in ("name", "network", "tried")}
    leak = run_sandboxed(["sh", "-c", "env | cut -d= -f1 | sort | tr '\\n' ' '; echo; cat /proc/1/environ >/dev/null 2>&1 && echo PROC1_READABLE || echo PROC1_DENIED"], ws, 20)
    res["sandboxEnv"] = leak[1].strip()[:400]
    res["modes"] = {}
    for mode in inp.get("modes", ["egl", "vgl", "vulkan"]):
        r = gpu_check(mode, ws)
        STATE["gpu"][mode] = r
        res["modes"][mode] = r
    if inp.get("diagRoot"):
        # diagnosis only (the factory scene, our own script): the same check without the sandbox
        res["modesUnsandboxed"] = {m: gpu_check(m, ws, sandboxed=False) for m in inp.get("modes", ["egl", "vgl", "vulkan"])}
    good = [m for m in inp.get("prefer", ["egl", "vgl", "vulkan"]) if res["modes"].get(m, {}).get("ok")]
    res["picked"] = good[0] if good else None
    if good and inp.get("shot"):
        rc, out, secs, gw, shot_s, failed = kit_render(ws, slug, good[0], str(inp["shot"]), inp.get("samples"))
        frames = sorted(glob.glob(os.path.join(ws, "videos", slug, "frames", "*.png")))
        res["shot"] = {"id": inp["shot"], "rc": rc, "wallS": secs, "shotS": shot_s, "frames": len(frames), "failed": failed[:3], "gpuWatch": gw,
                       "sPerFrame": round(secs / len(frames), 3) if frames else None, "tail": out.splitlines()[-8:]}
        if frames and inp.get("frameUpload"):
            mid = frames[len(frames) // 2]
            res["shot"]["frameUploaded"] = os.path.basename(mid)
            put_parts(mid, [inp["frameUpload"]], "image/png")
    shutil.rmtree(ws, ignore_errors=True)
    return {"ok": True, **res}


def role_render(inp, job_id):
    slug, shots, f0, f1 = inp["slug"], inp["shots"], int(inp["f0"]), int(inp["f1"])
    ws = workspace(job_id, slug, inp.get("videoUrl"))
    try:
        gpu = ensure_gpu(ws, inp.get("modes", ["egl", "vgl", "vulkan"]))
        t0 = time.time()
        rc, out, secs, gw, shot_s, failed = kit_render(ws, slug, gpu["mode"], shots, inp.get("samples"))
        if [x for x in failed if not x.startswith("TIMELINE:")] or rc != 0:
            raise RuntimeError(f"kit render rc {rc}: " + " | ".join(failed[:2])[:1200] + " :: " + "\n".join(out.splitlines()[-15:])[-1500:])
        seg = os.path.join(ws, "segment.mp4")
        te = time.time()
        encode_segment(ws, slug, f0, f1, seg)
        enc_s = round(time.time() - te, 1)
        up = put_parts(seg, inp["upload"], "video/mp4")
        return {"ok": True, "role": "render", "shots": shots, "frames": f1 - f0 + 1, "renderS": secs, "encodeS": enc_s,
                "sPerFrame": round(secs / (f1 - f0 + 1), 3), "shotS": shot_s, "gpu": {"mode": gpu["mode"], **gpu["info"]}, "gpuWatch": gw,
                "sandbox": STATE["sandbox"]["name"], "upload": up, "totalS": round(time.time() - t0, 1)}
    finally:
        shutil.rmtree(ws, ignore_errors=True)


def role_preview(inp, job_id):
    """the kit's preview mode (middle frame of each shot, 25% res) + the kit's contact sheets (tools/contact.py, groups of
    `perSheet` shots); returns a tar of the previews, the sheets and the per-shot failures"""
    slug = inp["slug"]
    ws = workspace(job_id, slug, inp.get("videoUrl"))
    try:
        gpu = ensure_gpu(ws, inp.get("modes", ["egl", "vgl", "vulkan"]))
        rc, out, secs, gw, shot_s, failed = kit_render(ws, slug, gpu["mode"], inp.get("shots", "all"), inp.get("samples"), kind="preview", timeout=1500)
        vdir = os.path.join(ws, "videos", slug)
        pdir = os.path.join(vdir, "preview")
        have = sorted(int(f[5:-4]) for f in os.listdir(pdir) if re.match(r"shot_\d+\.png$", f)) if os.path.isdir(pdir) else []
        sheets, per, cols = [], int(inp.get("perSheet", 16)), int(inp.get("cols", 8))
        for k in range(0, len(have), per):
            grp = have[k:k + per]
            name = f"sheet_{grp[0]:02d}_{grp[-1]:02d}"
            run_sandboxed(["python3", os.path.join(ws, "tools", "contact.py"), slug, ",".join(map(str, grp)), str(cols), name], ws, 120)
            if os.path.exists(os.path.join(vdir, name + ".jpg")):
                sheets.append({"file": name + ".jpg", "shots": grp})
        tgz = os.path.join(ws, "preview.tgz")
        lp = os.path.join(vdir, "render_log_preview.txt")
        with tarfile.open(tgz, "w:gz") as tf:
            for f in (sorted(os.listdir(pdir)) if os.path.isdir(pdir) else []):
                tf.add(os.path.join(pdir, f), arcname=f"preview/{f}")
            for sh_ in sheets:
                tf.add(os.path.join(vdir, sh_["file"]), arcname=sh_["file"])
            if os.path.exists(lp):
                tf.add(lp, arcname="render_log_preview.txt")
        up = put_parts(tgz, inp["upload"], "application/gzip")
        fails = shot_failures(open(lp, encoding="utf-8").read()) if os.path.exists(lp) else {}
        return {"ok": True, "role": "preview", "rendered": have, "failed": {str(k): v for k, v in fails.items()},
                "timeline": [x for x in failed if x.startswith("TIMELINE:")][:10], "renderS": secs, "shotS": shot_s, "sheets": sheets,
                "upload": up, "gpu": {"mode": gpu["mode"], **gpu["info"]}, "gpuWatch": gw, "sandbox": STATE["sandbox"]["name"],
                "tail": [] if have else out.splitlines()[-12:],
                # THE FRAMING GATE (owner 2026-11-21): worlds.py's measured lines (Blender's stdout, not the kit's log)
                "gate": [l for l in out.splitlines() if l.startswith(("ZW_GATE|", "ZW_LOOK|", "ZW_FRAMED|"))][:600]}
    finally:
        shutil.rmtree(ws, ignore_errors=True)


def role_finish(inp, job_id):
    slug, frames = inp["slug"], int(inp["frames"])
    ws = workspace(job_id, slug, inp.get("videoUrl"))
    try:
        vdir = os.path.join(ws, "videos", slug)
        cues = None
        if inp.get("videoUrl") or not os.path.exists(os.path.join(vdir, "audio", "cues.json")):
            gpu = ensure_gpu(ws, inp.get("modes", ["egl", "vgl", "vulkan"]))
            rc, out, secs, _, _, failed = kit_render(ws, slug, gpu["mode"], "all", kind="cues", timeout=900)
            if not os.path.exists(os.path.join(vdir, "audio", "cues.json")):
                raise RuntimeError(f"kit cues rc {rc}: " + " | ".join(failed[:3])[:1000])
            cues = {"seconds": secs, "count": len(json.load(open(os.path.join(vdir, "audio", "cues.json")))), "failed": failed[:5]}
        segs = []
        t0 = time.time()
        for i, urls in enumerate(inp["segments"]):
            p = os.path.join(ws, f"seg_{i:02d}.mp4")
            get_parts(urls, p)
            segs.append(p)
        lst = os.path.join(ws, "segments.txt")
        open(lst, "w").write("".join(f"file '{p}'\n" for p in segs))
        fdir = os.path.join(vdir, "frames")
        os.makedirs(fdir, exist_ok=True)
        rc, out = sh(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-start_number", "1",
                      "-compression_level", "1", os.path.join(fdir, "%04d.png")], timeout=1200)
        if rc != 0:
            raise RuntimeError("frames from segments failed: " + out[-500:])
        n = len(glob.glob(os.path.join(fdir, "*.png")))
        if n != frames:
            raise RuntimeError(f"the segments hold {n} frames, the video needs {frames}")
        uid, gid = uid_gid()
        for root, dirs, files in os.walk(vdir):
            for x in dirs + files:
                os.chown(os.path.join(root, x), uid, gid)
        unpack_s = round(time.time() - t0, 1)
        # the kit's finish WITHOUT its captions: ours follow (finishx.py: -14 LUFS + the kit's caption style per speaker)
        args = ["python3", os.path.join(ws, "tools", "finish.py"), slug, "--no-captions"]
        bed = os.path.join(vdir, "audio", "music_bed.wav")
        if inp.get("music", True) and os.path.exists(bed) and inp.get("musicDb") is not None:
            # OUR track (music.mjs: the engine's bed A at the voice's pace, as our #2 video) at the level that puts it 14 LU
            # under the voice after the kit's duck; already at the voice's pace, so no further speed-up
            args += ["--music", bed, "--music-speed", "1", "--music-db", "%.2f" % float(inp["musicDb"])]
        elif inp.get("music", True):
            args += ["--music", MUSIC]
        else:
            args += ["--no-music"]
        rc, out, secs, _ = run_sandboxed(args, ws, 1800)
        if rc != 0:
            raise RuntimeError(f"finish.py rc {rc}: " + out[-1500:])
        tp = time.time()
        post = finishx.post_finish(vdir, json.load(open(os.path.join(KIT, "config.json"))).get("caption_font", "Archivo Black"))
        post["seconds"] = round(time.time() - tp, 1)
        odir = os.path.join(vdir, "out")
        # THE NO-MUSIC COPY (owner 2026-11-19: "Download without music", voice + SFX only, for a trending sound): only when
        # the job asks for it; never fatal (the normal video is already made)
        if "final_nomusic.mp4" in inp["uploads"]:
            try:
                post["noMusic"] = no_music_copy(ws, slug, vdir)
            except Exception as e:  # noqa: BLE001
                post["noMusicError"] = f"{type(e).__name__}: {str(e)[:300]}"
        ups = {}
        for name in ("final.mp4", "final_nocaptions.mp4", "final_phone.mp4", "final_nomusic.mp4"):
            if name in inp["uploads"] and os.path.exists(os.path.join(odir, name)):
                ups[name] = put_parts(os.path.join(odir, name), inp["uploads"][name], "video/mp4")
        dur = sh(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", os.path.join(odir, "final.mp4")])[1]
        return {"ok": True, "role": "finish", "frames": n, "unpackS": unpack_s, "finishS": secs, "duration": dur, "uploads": ups, "cues": cues,
                "finishLog": out.splitlines()[-8:], "post": post, "sandbox": STATE["sandbox"]["name"]}
    finally:
        shutil.rmtree(ws, ignore_errors=True)


def no_music_copy(ws, slug, vdir):
    """out/final_nomusic.mp4: the captioned final's picture + the kit's mix WITHOUT music (voice + its sound cues), at -14
    LUFS. The kit's finish runs once more with --no-music; every file of the first finish is set aside and put back."""
    a, o = os.path.join(vdir, "audio"), os.path.join(vdir, "out")
    keep = [os.path.join(a, "mix.m4a"), os.path.join(a, "mix_norm.m4a"), os.path.join(o, "final.mp4"), os.path.join(o, "final_nocaptions.mp4"), os.path.join(o, "final_phone.mp4")]
    for p in keep:
        if os.path.exists(p):
            os.replace(p, p + ".keep")
    try:
        t0 = time.time()
        rc, out, secs, _ = run_sandboxed(["python3", os.path.join(ws, "tools", "finish.py"), slug, "--no-captions", "--no-music"], ws, 1800)
        if rc != 0 or not os.path.exists(os.path.join(a, "mix.m4a")):
            raise RuntimeError(f"finish.py --no-music rc {rc}: " + out[-600:])
        norm = os.path.join(a, "mix_nomusic_norm.m4a")
        finishx.loudnorm(os.path.join(a, "mix.m4a"), norm)
        dst = os.path.join(vdir, "final_nomusic.tmp.mp4")
        finishx.ff(["-i", os.path.join(o, "final.mp4.keep"), "-i", norm, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "copy", "-shortest", "-movflags", "+faststart", dst])
        level = finishx.lufs(dst)
    finally:
        for p in keep:
            if os.path.exists(p + ".keep"):
                os.replace(p + ".keep", p)
    os.replace(dst, os.path.join(o, "final_nomusic.mp4"))
    return {"seconds": round(time.time() - t0, 1), "lufs": level}


def handler(job):
    inp, jid = job["input"], job.get("id", "job")
    role = inp.get("role")
    try:
        if role == "probe":
            return role_probe(inp, jid)
        if role == "render":
            return role_render(inp, jid)
        if role == "finish":
            return role_finish(inp, jid)
        if role == "preview":
            return role_preview(inp, jid)
        return {"ok": False, "code": "BAD_ROLE", "error": f"unknown role {role!r}"}
    except ShotCheck as e:
        return {"ok": False, "code": "SHOT_CHECK", "error": str(e)[:3000]}
    except NoGpu as e:
        return {"ok": False, "code": "NO_GPU", "error": str(e)[:3000], "refresh_worker": True}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "code": "FAILED", "error": f"{type(e).__name__}: {str(e)[:3000]}"}


runpod.serverless.start({"handler": handler})
