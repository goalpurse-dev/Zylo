# ===== IN THIS TOWN v2, NIGHT BUILD: THE ONE PLACE BUILDER (scripts/blockyWorlds/v2/set_v2.py) ======================
# Pasted AFTER stage_v2.py and char_v2.py. Builds ANY place from data (placeKit.mjs placePayload): the ground, the
# primitives (boxes, cylinders, spheres, texts, lights; prefabs are expanded in JS), the time of day, the weather and
# raining objects. Nothing here knows a particular town: a new place is a data file.
ZV_PLACES = {}          # filled by the runner: id -> payload
ZV_TEXTS = {}           # this shot's replaceable texts: key -> text (a story's sign, screen, button labels)
ZV_SETLOOK = {}
ZV_SETINFO = {}
ZV_STATES = {}           # this shot's prop states (e.g. {"key": "turned", "red": "pressed"}); a shape with only="key=in|turned" shows only then

# ---------------------------------------------------------------- THE LIGHT TABLE (time of day), outdoor and indoor
ZV_TIMES = {
    "day":     {"sun": (1.0, 0.96, 0.9), "sun_e": 2.5, "el": 52, "az": -32, "sky": (0.42, 0.62, 0.95), "sky_s": 0.75, "night": False, "char": "day"},
    "morning": {"sun": (1.0, 0.84, 0.66), "sun_e": 2.8, "el": 20, "az": -62, "sky": (0.72, 0.80, 0.95), "sky_s": 0.8, "night": False, "char": "morning"},
    "golden":  {"sun": (1.0, 0.70, 0.40), "sun_e": 2.9, "el": 12, "az": 55, "sky": (0.95, 0.74, 0.52), "sky_s": 0.75, "night": False, "char": "sunset"},
    "dusk":    {"sun": (0.95, 0.50, 0.42), "sun_e": 1.1, "el": 5, "az": 68, "sky": (0.10, 0.055, 0.13), "sky_s": 1.0, "night": True, "char": "sunset"},
    "night":   {"sun": (0.55, 0.65, 1.0), "sun_e": 0.3, "el": 40, "az": 20, "sky": (0.008, 0.012, 0.034), "sky_s": 1.0, "night": True, "char": "night"},
    "storm":   {"sun": (0.6, 0.66, 0.8), "sun_e": 0.5, "el": 45, "az": 0, "sky": (0.03, 0.035, 0.045), "sky_s": 1.0, "night": True, "char": "storm"},
}
ZV_INDOOR = {   # indoor: a ceiling light, a soft fill from the open side, the window's colour
    "day":     {"lamp": (1.0, 0.93, 0.82), "lamp_w": 900, "fill_w": 700, "world": (0.30, 0.30, 0.32), "win": "#BFE3FF", "night": False, "char": "day"},
    "morning": {"lamp": (1.0, 0.88, 0.74), "lamp_w": 700, "fill_w": 700, "world": (0.30, 0.28, 0.27), "win": "#FFD9B0", "night": False, "char": "morning"},
    "golden":  {"lamp": (1.0, 0.80, 0.6), "lamp_w": 750, "fill_w": 600, "world": (0.30, 0.24, 0.2), "win": "#FFB070", "night": False, "char": "sunset"},
    "dusk":    {"lamp": (1.0, 0.78, 0.55), "lamp_w": 850, "fill_w": 450, "world": (0.05, 0.04, 0.07), "win": "#5A4A7A", "night": True, "char": "sunset"},
    "night":   {"lamp": (1.0, 0.80, 0.55), "lamp_w": 850, "fill_w": 380, "world": (0.015, 0.018, 0.03), "win": "#14203F", "night": True, "char": "night"},
    "storm":   {"lamp": (0.85, 0.88, 1.0), "lamp_w": 650, "fill_w": 320, "world": (0.015, 0.018, 0.026), "win": "#2A3344", "night": True, "char": "storm"},
}
ZV_WEATHERS = ["clear", "rain", "storm", "snow", "fog", "wind", "danger", "eclipse"]


def zv_hex(h):
    return zc_rgb(h) if isinstance(h, str) else tuple(h)


def zv_mat(p, night):
    """one material per look (cached by name): colour, roughness, metal, alpha, emission (glow:"night" only after dark)"""
    if p.get("win") and ZV_TEXTS.get("_window"):     # an indoor window shows the time of day outside
        p = dict(p, c=ZV_TEXTS["_window"], e=ZV_TEXTS["_window"])
    e = p.get("e")
    if p.get("glow") == "night" and not night:
        e = None
    es = p.get("es", 1.0) if e else 0.0
    if e and es <= 0:
        e = None
    nm = "zs_%s_%s_%s_%s_%s_%s" % (str(p.get("c"))[1:], p.get("rough", 0.6), p.get("metal", 0), str(e)[1:] if e else "-", es, p.get("alpha", 1))
    return mat(nm, zv_hex(p.get("c", "#CCCCCC")), p.get("rough", 0.6), metal=p.get("metal", 0.0), emit=zv_hex(e) if e else None, estr=es, alpha=p.get("alpha", 1.0))


def zv_prims(prims, night, t0, t1, coll=None):
    """the place's shapes in the world (centre-located; rotations in degrees); lights only when their time says so"""
    made = 0
    for k, p in enumerate(prims):
        when = p.get("when")
        if when == "night" and not night or when == "day" and night:
            continue
        if p.get("only"):
            nm_, vals_ = p["only"].split("=")
            if ZV_STATES.get(nm_, "") not in vals_.split("|"):
                continue
        t, at = p["t"], tuple(p["at"])
        rot = (p.get("rx", 0.0), p.get("ry", 0.0), p.get("rz", 0.0))
        nm = "zs%d_%s" % (k, p.get("tag", t))
        if t == "light":
            light(nm, p.get("kind", "POINT"), at, p["w"], zv_hex(p["c"]), p.get("size", 0.8))
            continue
        m = zv_mat(p, night)
        if t == "box":
            ob = box(nm, tuple(p["s"]), at, m, p.get("bev", 0.04), rot=rot)
        elif t == "cyl":
            ob = cyl(nm, p["r"], p["h"], at, m, p.get("v", 24), rot=rot, r2=p.get("r2"))
        elif t == "sph":
            ob = sphere(nm, p["r"], at, m, tuple(p.get("sc", (1, 1, 1))), seg=p.get("v", 16), rot=rot)
        elif t == "text":
            body = ZV_TEXTS.get(p.get("key"), p["body"]) if p.get("key") else p["body"]
            ob = text(nm, str(body), at, p.get("size", 1.0), m, rot=(90 + rot[0], rot[1], rot[2]))
        else:
            continue
        if p.get("sc") and t != "sph":
            ob.scale = tuple(p["sc"])
        if p.get("move"):
            mv = p["move"]
            key(ob, "location", F(t0))
            ob.location = (ob.location.x + mv[0], ob.location.y + mv[1], ob.location.z + mv[2])
            key(ob, "location", F(t1))
            try:
                for fc in ob.animation_data.action.fcurves:
                    for kp in fc.keyframe_points:
                        kp.interpolation = "LINEAR"
            except Exception:
                pass
        made += 1
    return made


def zv_world(col, strength):
    W = bpy.context.scene.world or D.worlds.new("W")
    bpy.context.scene.world = W
    W.use_nodes = True
    bg = next(x for x in W.node_tree.nodes if x.type == "BACKGROUND")
    bg.inputs["Color"].default_value = (col[0], col[1], col[2], 1)
    bg.inputs["Strength"].default_value = strength
    return W


def zv_sun(col, energy, el, az):
    s = light("zs_sun", "SUN", (0, 0, 60), energy, col, 2.0, rot=(90 - el, 0, az))
    return s


def zv_build_set(pid, time="day", weather="clear", t0=0.0, t1=1.0, cam=None):
    """THE PLACE at its time and weather. cam = (loc, tgt) so the weather fills the view. Returns the info dict."""
    P = ZV_PLACES[pid]
    night = False
    if P.get("base") == "suburb":                  # the suburb is Stage A's street + our own additions
        zv_build("A", {"golden": "sunset", "dusk": "sunset"}.get(time, time), t0, t1)
        L = ZV_TIMES.get(time, ZV_TIMES["day"])
        night = L["night"] or weather in ("storm", "danger", "eclipse")
        ZV_SETLOOK.clear()
        if weather in ("danger", "eclipse"):    # the sky and the sun recoloured over Stage A's own light
            zv_world((0.55, 0.08, 0.04) if weather == "danger" else (0.05, 0.06, 0.10), 0.9)
            for o in D.objects:
                if o.type == "LIGHT" and o.data.type == "SUN":
                    o.data.color = (1.0, 0.35, 0.2) if weather == "danger" else (1.0, 0.6, 0.35)
                    o.data.energy = 1.4 if weather == "danger" else 0.35
    elif P.get("indoor"):
        L = ZV_INDOOR.get(time, ZV_INDOOR["day"])
        night = L["night"]
        zv_world(L["world"], 1.0)
        lt = (P.get("light") or {})
        ceil = lt.get("lamp_at", (0.0, 0.0, 6.8))
        light("zs_lamp", "AREA", tuple(ceil), L["lamp_w"], L["lamp"], 3.0)
        light("zs_fill", "AREA", tuple(lt.get("fill_at", (1.5, -9.0, 4.5))), L["fill_w"], (1.0, 0.95, 0.9), 7.0, target=tuple(lt.get("fill_tgt", (0.0, 0.0, 1.8))))
        light("zs_bounce", "AREA", (0.0, -2.0, 7.5), L["fill_w"] * 0.5, L["lamp"], 9.0, rot=(0, 0, 0))
        ZV_TEXTS.setdefault("_window", L["win"])
        ZV_SETLOOK.update({"exposure": 0.0})
    else:
        L = ZV_TIMES.get(time, ZV_TIMES["day"])
        night = L["night"]
        sky, sky_s, sun_c, sun_e = L["sky"], L["sky_s"], L["sun"], L["sun_e"]
        if weather == "danger":
            sky, sky_s, sun_c, sun_e, night = (0.32, 0.025, 0.012), 1.0, (1.0, 0.35, 0.2), 1.4, True
        elif weather == "eclipse":
            sky, sky_s, sun_c, sun_e, night = (0.012, 0.014, 0.025), 1.0, (1.0, 0.6, 0.35), 0.3, True
        elif weather in ("storm", "rain") and not night:
            sky, sky_s, sun_e = (0.16, 0.18, 0.21), 1.0, sun_e * 0.35
        elif weather in ("fog", "snow") and not night:
            sky, sky_s, sun_e = (0.55, 0.58, 0.62), 1.0, sun_e * 0.55
        zv_world(sky, sky_s)
        zv_sun(sun_c, sun_e, L["el"], L["az"])
        g = P.get("ground") or {"c": "#8DBF63"}
        box("zs_ground", (600, 600, 0.2), (0, 0, -0.2), zv_mat({"c": g["c"], "rough": 0.9}, False), 0.0)
        if not night and weather in ("clear", "wind"):
            for k, (x, y, z, r) in enumerate(((-60, 150, 70, 14), (10, 170, 85, 18), (70, 140, 75, 12), (-20, 190, 95, 16))):
                sphere("zs_cloud%d" % k, r, (x, y, z), mat("zs_cloud", (1, 1, 1), 0.9, emit=(1, 1, 1), estr=0.35), (2.2, 1.0, 0.55), seg=16)
        ZV_SETLOOK.update({"exposure": 0.0})
    ZV_SETINFO.clear()
    ZV_SETINFO.update({"pid": pid, "time": time, "weather": weather, "night": night, "char": L.get("char", "day") if weather not in ("danger", "eclipse") else "night"})
    if P.get("base") != "suburb":     # the suburb keeps Stage A's own light table (stage_v2 ZV_LIGHT)
        ZW_T["time"] = "night" if night else "day"
        ZW_T["_std"] = True
        ZV_TIME["t"] = None
    n = zv_prims(P["prims"], night, t0, t1)
    if not P.get("indoor"):
        zv_weather(weather if not (P.get("base") == "suburb" and weather == "storm" and time == "storm") else "clear", t0, t1, cam)
    elif weather in ("danger", "eclipse", "storm") and P.get("indoor"):
        zv_weather_indoor(weather, t0, t1)
    zv_set_look()
    return {"shapes": n, "night": night}


def zv_set_look():
    if not ZV_SETLOOK:
        return
    vs = bpy.context.scene.view_settings
    try:
        vs.view_transform = "Standard"
        vs.look = "None"
    except Exception:
        pass
    vs.exposure = ZV_SETLOOK.get("exposure", 0.0)


def zv_frame_gate(S):
    """THE FRAMING GATE (fails a shot): over a third of the picture empty wall / void (indoors), a text the shot must
    read under the captions, a subject's chest hidden (only a hat over a desk)"""
    sc = bpy.context.scene
    cam = sc.camera
    if cam is None:
        return []
    sid, out = S.get("id", "?"), []
    dg = bpy.context.evaluated_depsgraph_get()
    mw = cam.matrix_world
    fr = [mw @ v for v in cam.data.view_frame(scene=sc)]     # top-right, bottom-right, bottom-left, top-left
    o = mw.translation.copy()
    indoor = bool((ZV_PLACES.get(ZV_SETINFO.get("pid")) or {}).get("indoor"))
    tl, tr, bl = fr[3], fr[0], fr[2]
    empty_n, n = 0, 0
    for i in range(9):
        for j in range(16):
            if j > 11:                       # the caption band is not judged
                continue
            q = tl + (tr - tl) * ((i + 0.5) / 9.0) + (bl - tl) * ((j + 0.5) / 16.0)
            d = (q - o).normalized()
            hit, loc, nrm, idx, hob, hm = sc.ray_cast(dg, o, d, distance=400.0)
            n += 1
            if (not hit and indoor) or (hit and hob is not None and "_wall" in hob.name and abs(nrm.dot(d)) > 0.8):
                empty_n += 1
    if n and empty_n / float(n) > 0.36 and ZV_SHOT.get("cam") not in ("screens",):
        out.append("ZW_GATE|%s|zv|frame|empty|%d pct of the picture is empty wall or void" % (sid, int(100 * empty_n / n)))
    if ZV_SHOT.get("read_texts"):
        for ob in D.objects:
            if ob.type == "FONT" and ob.name.endswith("_text"):
                sp = zw_span(cam, [ob.matrix_world.translation])
                if sp and 0.0 < sp[0] < 1.0 and 0.0 < sp[2] < 1.0 and sp[2] > 0.62:
                    out.append("ZW_GATE|%s|zv|text|under_captions|%s at v %.2f" % (sid, ob.name[:20], sp[2]))
    for who, ch in ZV_SHOT.get("subjects", []):
        try:
            c = ch.torso.matrix_world.translation + Vector((0, 0, 0.6 * ch.spec["body"]["torso_h"] * ch.k))
        except Exception:
            continue
        sp = zw_span(cam, [c])
        if not sp or not (0.0 < sp[0] < 1.0 and 0.0 < sp[2] < 1.0):
            continue                          # a close on the face: the chest is out of frame on purpose
        dv = c - o
        hit, loc, nrm, idx, hob, hm = sc.ray_cast(dg, o, dv.normalized(), distance=max(0.1, dv.length - 0.4))
        if hit and hob is not None and not hob.name.startswith(ch.name + "_") and not hob.name.startswith("zp_f") and not hob.hide_render:
            out.append("ZW_GATE|%s|zv|%s|chest_hidden|%s in front of the chest" % (sid, who, hob.name[:30]))
    for l in out:
        print(l)
    return out


ZV_GATE2 = zw_gate


def zw_gate(S):
    keep = dict(ZV_SHOT)
    out = list(ZV_GATE2(S) or [])
    ZV_SHOT.update(keep)
    try:
        out += zv_frame_gate(S)
    except Exception as e:
        print("ZW_GATE|%s|zv_note|frame gate crash %s" % (S.get("id", "?"), str(e)[:100]))
    ZV_SHOT.clear()
    return out


ZV_LOOK2 = zw_look_apply


def zw_look_apply():
    ZV_LOOK2()
    zv_set_look()


# ---------------------------------------------------------------- WEATHER (fills the camera's view)
def zv_view_pts(cam, n, d0=6.0, d1=45.0, z0=0.0, z1=16.0, seed=7, spread=0.62):
    """n random points in the camera's view volume (for rain, snow, leaves): a frustum from d0 to d1"""
    rnd = random.Random(seed)
    if cam is None:
        cam = ((0, -30, 6), (0, 10, 3))
    lo, tg = Vector(cam[0]), Vector(cam[1])
    f = (tg - lo)
    f.z = 0
    f = f.normalized() if f.length > 1e-6 else Vector((0, 1, 0))
    r = Vector((f.y, -f.x, 0))
    out = []
    for _ in range(n):
        d = d0 + (d1 - d0) * rnd.random() ** 1.3
        q = lo + f * d + r * ((rnd.random() - 0.5) * 2 * spread * d)
        out.append(Vector((q.x, q.y, z0 + (z1 - z0) * rnd.random() + max(0.0, lo.z - 6) * rnd.random())))
    return out


ZV_STORM_PARTS = {"bolt": True, "clouds": True, "rain": True, "puddles": False}   # the wet layer rendered as a white cube in storms: off


def zv_weather(w, t0, t1, cam):
    if w in ("rain", "storm") and ZV_STORM_PARTS.get("rain", True):
        m = mat("zs_rainm", (0.75, 0.85, 1.0), 0.2, emit=(0.75, 0.85, 1.0), estr=1.4 if w == "storm" else 1.1)
        for k, p in enumerate(zv_view_pts(cam, 900 if w == "storm" else 650, d0=5.0, d1=28.0, z1=14)):
            ob = box("zp_frain%d" % k, (0.045, 0.045, 0.9), tuple(p), m, 0.0, rot=(0, 6 if w == "storm" else 3, 0))
            ob.location.z += 2.5 * (t1 - t0)      # mid-shot (the still) the streaks are where the points are (motion blur draws the streak)
            key(ob, "location", F(t0))
            ob.location.z -= 5 * (t1 - t0)
            key(ob, "location", F(t1))
        if ZV_STORM_PARTS.get("puddles", True):
            box("zs_puddles", (400, 400, 0.02), (0, 0, 0.215), mat("zs_wet", (0.25, 0.28, 0.33), 0.05, alpha=0.25), 0.0)
    if w == "storm" and ZV_STORM_PARTS["bolt"]:
        zv_lightning(cam)
    if w == "storm" and ZV_STORM_PARTS["clouds"]:
        for k, (dx, dz) in enumerate(((-40, 55), (0, 62), (45, 58), (-15, 70))):
            lo = Vector(cam[0]) if cam else Vector((0, -30, 6))
            sphere("zs_scloud%d" % k, 22, (lo.x + dx, lo.y + 120, dz), mat("zs_dcloud", (0.18, 0.19, 0.22), 0.9), (2.0, 1.0, 0.45), seg=16)
    if w == "snow":
        m = mat("zs_snowm", (1, 1, 1), 0.8, emit=(1, 1, 1), estr=0.3)
        for k, p in enumerate(zv_view_pts(cam, 520, z1=16, seed=11)):
            ob = sphere("zp_fsnow%d" % k, 0.07 + 0.05 * ((k * 37) % 10) / 10.0, tuple(p), m, seg=6)
            key(ob, "location", F(t0))
            ob.location.z -= 2.5 * (t1 - t0)
            ob.location.x += 0.6 * (t1 - t0)
            key(ob, "location", F(t1))
        box("zs_snowcover", (500, 500, 0.06), (0, 0, 0.23), mat("zs_snowg", (0.93, 0.95, 1.0), 0.9), 0.0)
    if w == "fog":     # layered haze cards across the view (EEVEE's world volume rendered black here)
        lo = Vector(cam[0]) if cam else Vector((0, -30, 6))
        tg = Vector(cam[1]) if cam else Vector((0, 10, 3))
        f = (tg - lo)
        f.z = 0
        f = f.normalized()
        rz = math.degrees(math.atan2(f.x, -f.y))
        for k, d in enumerate((16, 24, 34, 48, 66)):
            c = lo + f * d
            box("zp_fog%d" % k, (d * 1.6, 0.05, 40), (c.x, c.y, 20), mat("zs_fogm", (0.86, 0.88, 0.9), 0.9, emit=(0.86, 0.88, 0.9), estr=0.3, alpha=0.11), 0.0, rot=(0, 0, rz))
    if w == "wind":
        cols = ["#E07A2E", "#D9A426", "#B5432A", "#8FA33A"]
        for k, p in enumerate(zv_view_pts(cam, 260, z1=9, seed=5)):
            ob = box("zp_fleaf%d" % k, (0.32, 0.22, 0.02), tuple(p), mat("zs_leaf%d" % (k % 4), zc_rgb(cols[k % 4]), 0.8), 0.0, rot=((k * 47) % 180, (k * 29) % 180, (k * 13) % 360))
            key(ob, "location", F(t0))
            key(ob, "rotation_euler", F(t0))
            ob.location.x += 9 * (t1 - t0)
            ob.rotation_euler.x += 6 * (t1 - t0)
            key(ob, "location", F(t1))
            key(ob, "rotation_euler", F(t1))
    if w == "danger":
        lo = Vector(cam[0]) if cam else Vector((0, -30, 6))
        pl = light("zs_alarm", "POINT", (lo.x, lo.y + 4, lo.z + 3), 900, (1.0, 0.15, 0.08), 3.0)
        for k in range(int((t1 - t0) * 1.5) + 2):     # pulsing at about 1.5 Hz
            pl.data.energy = 900 if k % 2 == 0 else 250
            pl.data.keyframe_insert("energy", frame=F(t0 + k / 3.0))
    if w == "eclipse":
        lo = Vector(cam[0]) if cam else Vector((0, -30, 6))
        tg = Vector(cam[1]) if cam else Vector((0, 10, 3))
        f = (tg - lo)
        f.z = 0
        f = f.normalized()
        c = lo + f * 220 + Vector((0, 0, 70))
        rz = math.degrees(math.atan2(f.x, -f.y))
        cyl("zs_corona", 13.0, 0.5, tuple(c), mat("zs_coronam", (1.0, 0.85, 0.5), 0.5, emit=(1.0, 0.82, 0.45), estr=6.0), 48, rot=(90, 0, rz))
        cyl("zs_moon", 11.5, 0.5, tuple(c - f * 1.5), mat("zs_moonm", (0.0, 0.0, 0.0), 0.9), 48, rot=(90, 0, rz))


def zv_lightning(cam):
    lo = Vector(cam[0]) if cam else Vector((0, -30, 6))
    tg = Vector(cam[1]) if cam else Vector((0, 10, 3))
    f = (tg - lo)
    f.z = 0
    f = f.normalized()
    base = lo + f * 90 + Vector((f.y, -f.x, 0)) * 18
    m = mat("zs_boltm", (0.9, 0.95, 1.0), 0.2, emit=(0.85, 0.9, 1.0), estr=40.0)
    rnd = random.Random(3)
    x, y, z = base.x, base.y, 70.0
    for k in range(9):
        nx, nz = x + (rnd.random() - 0.5) * 9, z - 7.8
        mid = ((x + nx) / 2, y, (z + nz) / 2)
        ang = math.degrees(math.atan2(nx - x, z - nz))
        box("zs_bolt%d" % k, (0.5, 0.5, math.hypot(nx - x, z - nz)), mid, m, 0.0, rot=(0, ang, 0))
        x, z = nx, nz
    for o in D.objects:     # the flash: the sun brightens for the bolt (a point light rendered as a ball)
        if o.type == "LIGHT" and o.data.type == "SUN":
            o.data.energy *= 2.5


def zv_weather_indoor(w, t0, t1):
    col = {"danger": (1.0, 0.12, 0.08), "eclipse": (1.0, 0.6, 0.3), "storm": (0.7, 0.8, 1.0)}[w]
    pl = light("zs_inalarm", "POINT", (0, -1, 5.5), 600, col, 2.0)
    if w == "danger":
        for k in range(int((t1 - t0) * 1.5) + 2):
            pl.data.energy = 600 if k % 2 == 0 else 150
            pl.data.keyframe_insert("energy", frame=F(t0 + k / 3.0))


# ---------------------------------------------------------------- RAINING OBJECTS (any prop, piles, reactions)
def zv_thing(kind, name):
    """one raining thing at real size (world units; a kid is 3 tall), built at the origin under an empty"""
    e = empty(name, (0, 0, 0))
    g = mat("zs_gold", (1.0, 0.72, 0.18), 0.3, metal=0.85)
    if kind == "key":
        cyl(name + "_bow", 0.3, 0.09, (-0.42, 0, 0), g, 20, rot=(90, 0, 0), parent=e)
        cyl(name + "_hole", 0.12, 0.11, (-0.42, 0, 0), mat("zs_keyhole", (0.05, 0.04, 0.03), 0.6), 12, rot=(90, 0, 0), parent=e)
        box(name + "_shaft", (0.75, 0.09, 0.11), (0.08, 0, 0), g, 0.01, parent=e)
        box(name + "_t1", (0.08, 0.09, 0.2), (0.34, 0, -0.12), g, 0.0, parent=e)
        box(name + "_t2", (0.08, 0.09, 0.14), (0.2, 0, -0.09), g, 0.0, parent=e)
    elif kind == "coin":
        cyl(name + "_c", 0.32, 0.08, (0, 0, 0), g, 24, rot=(90, 0, 0), parent=e)
    elif kind == "frog":
        gm = mat("zs_frog", zc_rgb("#4CAF50"), 0.5)
        sphere(name + "_b", 0.32, (0, 0, 0), gm, (1.2, 1.0, 0.75), parent=e, seg=12)
        for s in (-1, 1):
            sphere(name + "_e%d" % s, 0.11, (s * 0.15, -0.2, 0.2), mat("zs_frogeye", (1, 1, 1), 0.3), parent=e, seg=8)
            sphere(name + "_p%d" % s, 0.055, (s * 0.15, -0.29, 0.22), mat("zs_frogpup", (0.02, 0.02, 0.02), 0.3), parent=e, seg=6)
    elif kind == "pillow":
        box(name + "_p", (0.9, 0.6, 0.24), (0, 0, 0), mat("zs_pillow", zc_rgb("#F3E7FF"), 0.9), 0.1, parent=e)
    elif kind == "letter":
        box(name + "_l", (0.62, 0.42, 0.025), (0, 0, 0), mat("zs_letter", (0.97, 0.96, 0.92), 0.8), 0.0, parent=e)
        box(name + "_s", (0.12, 0.14, 0.03), (0.2, 0.1, 0.0), mat("zs_stamp", zc_rgb("#D63A2F"), 0.6), 0.0, parent=e)
        box(name + "_v", (0.5, 0.02, 0.03), (0, 0.05, 0.0), mat("zs_flap", (0.8, 0.78, 0.72), 0.8), 0.0, rot=(0, 0, 20), parent=e)
    else:
        p = zc_prop(kind, name + "_zp")
        if p is not None:
            p.parent = e
            p.scale = (0.45, 0.45, 0.45)
        else:   # an unknown thing: a bright parcel (the planner should only name library things)
            box(name + "_x", (0.5, 0.5, 0.5), (0, 0, 0), mat("zs_parcel", zc_rgb("#4C8FD6"), 0.6), 0.06, parent=e)
    return e


def zv_copy_thing(proto, name, loc, rot, scale=1.0):
    e = empty(name, loc)
    e.rotation_euler = rot
    e.scale = (scale, scale, scale)
    stack = [(c, e) for c in proto.children]
    while stack:
        c, par = stack.pop()
        o = c.copy()
        for col in c.users_collection:
            col.objects.link(o)
        o.parent = par
        o.matrix_parent_inverse = c.matrix_parent_inverse.copy()
        stack += [(cc, o) for cc in c.children]
    return e


def zv_ground_z(x, y, top=40.0):
    sc = bpy.context.scene
    try:
        dg = bpy.context.evaluated_depsgraph_get()
        hit, loc, nrm, idx, ob, mw = sc.ray_cast(dg, Vector((x, y, top)), Vector((0, 0, -1)), distance=top + 2)
        if hit:
            return loc.z
    except Exception:
        pass
    return 0.2


def zv_rain_things(spec, t0, t1, cam):
    """RAINING OBJECTS: spec = {"kind": "key|coin|frog|pillow|letter|<any zc_prop>", "amount": 0-1, "falling": bool,
    "pile": 0-1 (how much has gathered by this shot)}. Falling ones fill the view; the pile lies on the ground (a ray
    down finds roofs, cars, the street), thicker in a few heaps. Built BEFORE the people (they stand in it)."""
    kind, amt = spec.get("kind", "key"), float(spec.get("amount", 1.0))
    if kind.startswith("entity:"):     # it rains monsters: small copies of library entities falling, a few landed on the ground
        kinds = kind.split(":")[1].split(",")
        rnd = random.Random(23)
        for k, p in enumerate(zv_view_pts(cam, 5, d0=10.0, d1=30.0, z0=7.0, z1=16.0, seed=71)):
            e = ZEntity("RainE%d" % k, kinds[k % len(kinds)], tuple(p), rnd.random() * 360, "reach", "full", t0, t1)
            e.root.scale = tuple(v * 0.32 for v in e.root.scale)
            e.root.rotation_euler = (rnd.random() * 1.2, rnd.random() * 1.2, rnd.random() * 6.3)
            key(e.root, "location", F(t0))
            e.root.location.z -= 6 * (t1 - t0)
            key(e.root, "location", F(t1))
        if spec.get("pile", 0.5) > 0.1:
            for k, p in enumerate(zv_view_pts(cam, 4, d0=17.0, d1=30.0, seed=73, spread=0.5)):
                z = zv_ground_z(p.x, p.y)
                e = ZEntity("LandE%d" % k, kinds[(k + 1) % len(kinds)], (p.x, p.y, z), math.degrees(math.atan2(cam[0][0] - p.x, -(cam[0][1] - p.y))), "loom", "full", t0, t1)
                e.root.scale = tuple(v * 0.38 for v in e.root.scale)
        return 9
    proto = zv_thing(kind, "zs_proto")
    proto.location = (0, 0, -50)
    rnd = random.Random(21)
    bpy.context.view_layer.update()
    if spec.get("falling", True):
        for k, p in enumerate(zv_view_pts(cam, int(90 * amt) + 6, d0=7.0, d1=30.0, z0=1.5, z1=15.0, seed=31)):
            ob = zv_copy_thing(proto, "zp_ffall%d" % k, tuple(p), (rnd.random() * 6.3, rnd.random() * 6.3, rnd.random() * 6.3), 1.0)
            key(ob, "location", F(t0))
            ob.location.z -= 9 * (t1 - t0)
            key(ob, "location", F(t1))
    pile = float(spec.get("pile", 0.5))
    n = int(520 * amt * pile)
    heaps = [Vector((q.x, q.y, 0)) for q in zv_view_pts(cam, 3, d0=6.0, d1=20.0, seed=41, spread=0.4)]
    for k, p in enumerate(zv_view_pts(cam, n, d0=4.5, d1=34.0, seed=51, spread=0.75)):
        if k % 3 == 0 and heaps:
            h = heaps[k % len(heaps)]
            p = Vector((h.x + (rnd.random() - 0.5) * 3.2, h.y + (rnd.random() - 0.5) * 3.2, 0))
        z = zv_ground_z(p.x, p.y) + 0.06 + (rnd.random() * 0.35 * pile if k % 3 == 0 else 0.0)
        zv_copy_thing(proto, "zs_pile%d" % k, (p.x, p.y, z), (math.radians(90 if kind == "coin" else 0) + (rnd.random() - 0.5) * 0.5, (rnd.random() - 0.5) * 0.5, rnd.random() * 6.3), 1.0)
    return n


# extra tested poses for reactions (the base's ZC_POSES; ours are added, none changed)
ZC_POSES.update({
    "cover_head": {"shoulderL": (-150, -28, 0), "shoulderR": (-150, 28, 0), "elbowL": (-78, 0, 0), "elbowR": (-78, 0, 0), "neck": (14, 0, 0), "torso": (-6, 0, 0)},
    "umbrella":   {"shoulderR": (-118, 10, 0), "elbowR": (-40, 0, 0), "shoulderL": (0, -8, 0), "neck": (-6, 0, 0)},
    "hands_head": {"shoulderL": (-160, -40, 0), "shoulderR": (-160, 40, 0), "elbowL": (-95, 0, 0), "elbowR": (-95, 0, 0), "neck": (-4, 0, 0)},
    "press":      {"shoulderR": (-62, 6, 0), "elbowR": (-28, 0, 0), "torso": (-14, 0, 0), "neck": (-18, 0, 0), "shoulderL": (-10, -10, 0)},
    "catch":      {"shoulderL": (-150, -12, 0), "shoulderR": (-150, 12, 0), "elbowL": (-20, 0, 0), "elbowR": (-20, 0, 0), "neck": (-22, 0, 0), "torso": (6, 0, 0)},
    "reach_up":   {"shoulderR": (-165, 4, 0), "elbowR": (-6, 0, 0), "neck": (-24, 0, 0), "torso": (4, 0, 0)},
    "lean_in":    {"torso": (-20, 0, 0), "neck": (-10, 0, 0), "shoulderL": (-24, -6, 0), "shoulderR": (-24, 6, 0), "elbowL": (-30, 0, 0), "elbowR": (-30, 0, 0)},
    "flinch":     {"torso": (10, 0, -12), "neck": (14, 0, -20), "shoulderL": (-110, -40, 0), "shoulderR": (-90, 30, 0), "elbowL": (-100, 0, 0), "elbowR": (-90, 0, 0)},
    "pick_up":    {"thighL": (-70, -6, 0), "kneeL": (100, 0, 0), "thighR": (-70, 6, 0), "kneeR": (100, 0, 0), "torso": (-30, 0, 0), "neck": (-20, 0, 0),
                   "shoulderR": (-75, 8, 0), "elbowR": (-10, 0, 0), "shoulderL": (-30, -8, 0), "hip_dz": -0.5, "hip_dy": 0.3},
})


def zv_umbrella(ch, col="#E53935"):
    """an open umbrella over a person (placed in the world over their head, the handle down to the raised hand)"""
    r = ch.root.location
    h = ch.spec.get("height", 3.0)
    m = mat("zs_umb_%s" % col[1:], zc_rgb(col), 0.5)
    cyl(ch.name + "_umb", 1.55, 0.7, (r.x, r.y, r.z + h + 0.75), m, 8, r2=0.08)
    cyl(ch.name + "_umbstick", 0.04, 1.6, (r.x, r.y, r.z + h + 0.1), mat("zs_umbs", (0.15, 0.15, 0.15), 0.4), 6)


# ---------------------------------------------------------------- THE TEST STILL OF A PLACE CAMERA
def zv_place_test(pid, cam_name, time, weather, t0, t1, opt=None):
    """a place camera's still: the place at its time + weather, the camera's people spots filled (the hero + Mom),
    its creature, the background people on their calm loops (by day), optional raining things / texts"""
    opt = opt or {}
    P = ZV_PLACES[pid]
    hand_close = cam_name == "hand_close"
    if hand_close:      # the hand close-up: the place camera made for the holder's spot, then the base's detail camera on the hand
        sp0 = (opt.get("people") or [{}])[0].get("spot")
        cam_name = next((k for k, v in P["cameras"].items() if sp0 in v.get("people", [])), list(P["cameras"].keys())[0])
    c = P["cameras"][cam_name]
    ZV_TEXTS.clear()
    ZV_TEXTS.update(opt.get("texts") or {})
    ZV_STATES.clear()
    ZV_STATES.update(P.get("states") or {})
    ZV_STATES.update(opt.get("states") or {})
    loc, tgt = Vector(c["loc"]), Vector(c["tgt"])
    ZV_STORM_PARTS.update({"bolt": True, "clouds": True, "rain": True, "puddles": False})
    ZV_STORM_PARTS.update(opt.get("storm_parts") or {})
    info = zv_build_set(pid, time, weather, t0, t1, cam=(tuple(loc), tuple(tgt)))
    if opt.get("rain_things"):
        zv_rain_things(opt["rain_things"], t0, t1, (tuple(loc), tuple(tgt)))
    subs = []
    for k, pp in enumerate(opt.get("people") or []):     # a story row's people (library specs on this camera's spots)
        at = P["spots"][pp["spot"]]["at"]
        ch = zv_person("Pp%d" % k, pp["spec"], tuple(at), face_to=None, pose=pp.get("pose", "stand"), face=pp.get("face"), t0=t0, t1=t1)
        look = pp.get("facing")
        if look in P["spots"]:
            q = P["spots"][look]["at"]
            ch.turn(t0, (q[0], q[1], at[2] + 2.0), tuple(loc))
        elif look == "big" and P.get("big"):
            q = P["big"]["at"]
            ch.turn(t0, (q[0], q[1], at[2] + 4.0), tuple(loc))
        elif look == "camera":
            ch.face_to((loc.x, loc.y, at[2] + 2.0))
        else:     # no facing given: three-quarter toward the other person, else the big thing, else past the lens
            others = [q for q in (opt.get("people") or []) if q is not pp]
            if others:
                q = P["spots"][others[0]["spot"]]["at"]
            elif P.get("big"):
                q = P["big"]["at"]
            else:
                q = (loc.x + 6.0, loc.y, at[2])
            ch.turn(t0, (q[0], q[1], at[2] + 2.0), tuple(loc))
        if pp.get("holds"):
            zv_hold(ch, zv_prop(pp["holds"], "Hold%d" % k, label=pp.get("label")), "R")
        subs.append((pp.get("id", pp["spec"]), ch))
    for k, spot in enumerate([] if opt.get("people") is not None else c.get("people", [])):
        at = P["spots"][spot]["at"]
        spec = ["me", "mom"][k % 2]
        ch = ZChar(["Kid", "Mom"][k % 2], ZC_SPECS[spec], tuple(at), rot=0, badge=spec == "me")
        ch.pose(t0, opt.get("pose", "stand"))
        ch.express(t0, opt.get("face", "neutral"))
        ch.face_to((loc.x, loc.y, at[2] + 2.0))
        zc_blinks(ch, t0, t1)
        zc_idle(ch, t0, t1)
        subs.append((spot, ch))
    cr = None
    if c.get("creature") and opt.get("entity"):     # one of the library's entities at the camera's creature spot
        at = P["creature_spots"][c["creature"]]["at"]
        en = opt["entity"]
        cr = ZEntity("Ent", en["kind"], tuple(at), math.degrees(math.atan2(loc.x - at[0], -(loc.y - at[1]))), en.get("state", "stand"), en.get("show", "full"), t0, t1)
    elif c.get("creature"):
        at = P["creature_spots"][c["creature"]]["at"]
        cr = ZChar("Creature", ZC_SPECS["shadow"], tuple(at), rot=0, badge=False)
        cr.pose(t0, "stand")
        cr.express(t0, "shadow_stare")
        cr.face_to((loc.x, loc.y, 2.0))
        zc_idle(cr, t0, t1, 0.6)
    nbs = ["nb1", "nb2", "nb3", "nb4"]
    if opt.get("crowd"):
        cw = opt["crowd"]
        taken = [P["spots"][q["spot"]]["at"] for q in (opt.get("people") or [])] + [P["spots"][s_]["at"] for s_ in c.get("people", [])]
        big = P.get("big")
        n_ok, poses = 0, [cw.get("action", "run"), "reach", "point", "run", "hands_head", "reach_up", "run", "point"]
        for k, q in enumerate(zv_view_pts((tuple(loc), tuple(tgt)), 60, d0=9.0, d1=24.0, z0=0, z1=0.01, seed=91, spread=0.42)):
            if n_ok >= cw.get("n", 6):
                break
            if any(math.hypot(q.x - a[0], q.y - a[1]) < 2.6 for a in taken) or (big and math.hypot(q.x - big["at"][0], q.y - big["at"][1]) < big["r"] + 1.2):
                continue
            z = zv_ground_z(q.x, q.y)
            if z > 1.0:
                continue
            ch = ZChar("Cw%d" % n_ok, ZC_SPECS[["nb1", "nb2", "nb3", "nb4", "nb5", "nb6", "cm1", "cm3"][n_ok % 8]], (q.x, q.y, z), rot=0, badge=False)
            ch.pose(t0, poses[n_ok % len(poses)])
            ch.express(t0, ["scared", "worried", "big_smile", "terrified"][n_ok % 4])
            look = big["at"] if big else (tgt.x, tgt.y + 20, 0)
            ch.face_to((look[0] + (k % 3 - 1) * 3, look[1], 2.0))
            zc_idle(ch, t0, t1, 0.8)
            taken.append((q.x, q.y))
            n_ok += 1
    subj_d = max([math.hypot(P["spots"][q]["at"][0] - loc.x, P["spots"][q]["at"][1] - loc.y) for q in [pp["spot"] for pp in (opt.get("people") or [])] + list(c.get("people", []))] or [0.0])
    if opt.get("bg", True):
        for k, (bk, b) in enumerate(sorted(P.get("background", {}).items())):
            at = b["at"]
            if subj_d and math.hypot(at[0] - loc.x, at[1] - loc.y) < subj_d + 2.5:
                continue      # background people only BEHIND the shot's subjects (never between the lens and them)
            ch = ZChar("Nb%d" % k, ZC_SPECS[nbs[k % 4]], tuple(at), rot=0, badge=False)
            react = opt.get("react")
            loop = b.get("loop", "stand")
            pose = {"talk": "talk", "phone": "hold_phone", "walk": "walk", "stand": "stand", "carry": "hold_box", "point": "point", "run": "run"}.get(loop, "stand")
            if opt.get("crowd") and k < opt["crowd"].get("n", 6):    # "everyone": the town in action
                pose = [opt["crowd"].get("action", "run"), "reach", "point", "run", "cover_head", "hands_head"][k % 6] if opt["crowd"].get("mixed", True) else opt["crowd"]["action"]
            if react:
                pose = ["cover_head", "umbrella", "pick_up", "point"][k % 4]
            ch.pose(t0, pose)
            ch.express(t0, "scared" if react and k % 4 == 0 else ("happy" if k % 3 == 0 else "neutral"))
            if pose == "hold_box":
                ch.hold(t0, zc_prop("box", "zs_bgbox%d" % k), "both")
            if pose == "hold_phone":
                ch.hold(t0, zc_prop("phone", "zs_bgphone%d" % k), "both")
            if pose == "umbrella":
                zv_umbrella(ch, ["#E53935", "#3D7BE0", "#F2B705"][k % 3])
            face = (at[0] + (6 if loop == "walk" else 0), at[1] - 6, 2.0) if loop != "talk" else (loc.x, loc.y, 2.0)
            ch.face_to(face)
            zc_idle(ch, t0, t1, 0.5)
    if opt.get("effect"):
        ef = dict(opt["effect"])
        zv_effect(ef.pop("kind"), t0, t1, at=tuple(ef.pop("at", (P.get("big") or {}).get("at", (0, 0, 0)))), size=ef.pop("size", 1.0), cam=(tuple(loc), tuple(tgt)), opt=ef)
    cam = Cam()
    if c.get("aerial"):     # the moving aerial: a slow glide forward and sideways
        f = (tgt - loc)
        cam.key(t0, tuple(loc), tuple(tgt), lens=c["lens"])
        cam.key(t1, tuple(loc + f * 0.05 + Vector((f.y, -f.x, 0)).normalized() * 2.5), tuple(tgt), lens=c["lens"])
    elif hand_close and subs:
        bpy.context.view_layer.update()
        hp = subs[0][1].hand["R"].matrix_world.translation.copy()
        rt = subs[0][1].root.location
        side = Vector((hp.x - rt.x, hp.y - rt.y, 0))
        tocam = Vector((loc.x - hp.x, loc.y - hp.y, 0)).normalized()
        d = (side.normalized() * 1.0 + tocam * 0.8).normalized() if side.length > 0.05 else tocam
        cl = hp + d * 2.4 + Vector((0, 0, 0.3))      # on the hand's open side, a little above (the head stays behind it)
        cam.key(t0, tuple(cl), tuple(hp), lens=35)
        cam.key(t1, tuple(cl + (hp - cl) * 0.08), tuple(hp), lens=35)
        subs = []          # a hand close: no head in frame on purpose
    else:
        cam.key(t0, tuple(loc), tuple(tgt), lens=c["lens"])
        cam.key(t1, tuple(loc + (tgt - loc) * 0.06), tuple(tgt), lens=c["lens"])
    for _, ch in subs:
        zc_char_light(ch, tuple(loc), ZV_SETINFO.get("char", "day"))
    ZV_SHOT.clear()
    ZV_SHOT.update({"cam": cam_name, "subjects": subs, "creature": cr, "read_texts": bool(opt.get("read") or c.get("shot") == "insert")})
    return info
# ===== END OF THE PLACE BUILDER =======================================================================================
