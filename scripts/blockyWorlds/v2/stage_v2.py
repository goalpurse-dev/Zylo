# ===== IN THIS TOWN v2: THE STAGE (scripts/blockyWorlds/v2/stage_v2.py) ==============================================
# Pasted AFTER the base engine (worlds, actions, acts, pieces, motion, crowds, town) and NOTHING of stage*.py.
# One shot = one fresh build: the tested stage, people ON spots, the creature on a creature spot, a named camera.
# The checks here FAIL a shot (they print ZW_GATE|<shot>|zv|...); they never move anything to hide a problem.
ZV_STAGES = {}          # filled by the runner from stageA.mjs (one source of truth)
ZV_SHOT = {}            # this shot: {"cam": name, "subjects": [(who, Char)], "creature": Char|None}


def zv_build(stage_id, time, t0, t1):
    """the stage at its time of day, quiet (nobody else, no cars), the stage's own removals done"""
    S = ZV_STAGES[stage_id]
    if S.get("build") == "dining":
        return zv_build_dining(S, time, t0, t1)
    dress = {"time": "night" if time == "storm" else ("day" if time == "morning" else time), "busy": "empty", "walkers": "none",
             "cars": "none", "extras": [], "props": ["nocars"], "windows": "lit", "curtains": "open", "threat": "none"}
    if time == "storm":
        dress["weather"] = "rain"
    info = zw_build(S["place"], t0 - 0.3, t1 + 0.3, dress)
    ZV_TIME["t"] = time
    for n in S.get("remove", []):
        ob = D.objects.get(n)
        if ob is not None:
            D.objects.remove(ob, do_unlink=True)
    return info


ZV_LAMP_AT = (1.9, 17.62, 5.2)


def zv_porch_light(on, i=8):
    """THE HERO HOUSE'S OWN PORCH LIGHT as a rule object: its own material (never the shared one: switching ours never
    switches the neighbours'), a warm glow on the porch when on, dark glass when off. Returns its world position."""
    ob = D.objects.get("zw_hplamp%d" % i)
    if ob is not None:     # the house's own lamp ball is hidden: ours is built where we want it, fully under our control
        ob.hide_render = True
        ob.hide_viewport = True
    m = mat("zv_hero_plamp_%s" % ("on" if on else "off"), (1.0, 0.93, 0.7) if on else (0.16, 0.16, 0.17), 0.25,
            emit=(1.0, 0.8, 0.42) if on else None, estr=14.0 if on else 0.0, spec=0.8)
    p = Vector(ZV_LAMP_AT)         # beside the door at a person's reach
    sphere("zv_lampglass", 0.3, tuple(p), m, (1.0, 1.0, 1.35), seg=16)
    # a real fitting: a dark metal cap, a bracket to the wall, a small frame (it reads as a lamp, on or off)
    fm = mat("zv_lampmetal", (0.06, 0.06, 0.07), 0.35, metal=0.7)
    cyl("zv_lampcap", 0.42, 0.22, (p.x, p.y, p.z + 0.46), fm, 20, r2=0.18)
    cyl("zv_lampbase", 0.3, 0.12, (p.x, p.y, p.z - 0.42), fm, 20)
    box("zv_lampbracket", (0.12, 0.62, 0.12), (p.x, p.y + 0.3, p.z + 0.5), fm, 0.02)
    for k in range(4):
        a = k * math.pi / 2 + math.pi / 4
        box("zv_lampbar%d" % k, (0.05, 0.05, 0.84), (p.x + 0.33 * math.cos(a), p.y + 0.33 * math.sin(a), p.z), fm, 0.0)
    print("ZW_GATE|lamp|%.2f|%.2f|%.2f|dims %.2f %.2f %.2f|hide %s|mats %d|parent %s" % (p.x, p.y, p.z, 0.6, 0.6, 0.81, False, 1, "-"))
    if on:
        light("zv_plamp_glow", "POINT", (p.x, p.y - 1.4, p.z - 0.6), 120, (1.0, 0.78, 0.45), 0.8)
    return p


ZV_CURTAIN_COLS = ["#C94A4A", "#E0B04A", "#5C8FD6", "#7FB86A", "#B06AC8", "#E08A5A"]


def zv_curtains(state="closed", t=None, x_range=(-60, 60), gap=None, lit=True):
    """THE CURTAINS (a rule object: "after dark every curtain is closed"): two fabric panels in front of every street
    window in x_range, a little glow through them at night. state: "open" (gathered at the sides), "closed", or
    "closing" (keyed from open at t to closed at t + 0.9 s, house by house). gap = {"pane name": width} leaves a slit
    between the panels (someone peeking). Returns the number of windows dressed."""
    bpy.context.view_layer.update()
    n = 0
    for ob in list(D.objects):
        nm = ob.name
        if not (nm.startswith("zw_hwin") and not nm.startswith("zw_hwinf") and not nm.startswith("zw_hwins") and not nm.startswith("zw_hwin2f")) or ob.type != "MESH":
            continue
        c = ob.matrix_world.translation
        if not (x_range[0] <= c.x <= x_range[1]):
            continue
        dm = ob.dimensions
        side = 1.0 if c.y > 0 else -1.0                  # north houses face -Y, south houses face +Y
        col = ZV_CURTAIN_COLS[(int(abs(c.x)) // 7 + (1 if c.y > 0 else 3)) % len(ZV_CURTAIN_COLS)]
        if nm.startswith("zw_hwin8_") or nm.startswith("zw_hwin28_"):
            col = "#B84A4A"     # our house: the same red curtains as the dining room inside
        m = mat("zv_curtain_%s%s" % (col[1:], "_lit" if lit and zw_night() else ""), zc_rgb(col), 0.85,
                emit=zc_rgb(col) if (lit and zw_night()) else None, estr=0.35 if (lit and zw_night()) else 0.0)
        hw, hh = dm.x / 2.0, dm.z
        g = (gap or {}).get(nm, 0.0)
        y = c.y - side * 0.16
        for s in (-1, 1):
            closed_w = hw - g / 2.0
            open_w = hw * 0.22
            p = box("zv_cur_%s_%d" % (nm[3:], s), (1.0, 0.06, hh * 1.02), (c.x + s * (hw - closed_w / 2.0), y, c.z), m, 0.01)
            if state == "closed":
                p.scale.x = closed_w
            elif state == "open":
                p.scale.x = open_w
                p.location.x = c.x + s * (hw - open_w / 2.0)
            else:
                # owner 2026-11-24: OPEN in the first frame, then closing window by window (each one a little later)
                ta = (t if t is not None else 0.0) + 0.35 + (((int(abs(c.x)) * 7) + int(c.z * 3)) % 11) * 0.09
                p.scale.x = open_w
                p.location.x = c.x + s * (hw - open_w / 2.0)
                key(p, "scale", F(t if t is not None else 0.0))
                key(p, "location", F(t if t is not None else 0.0))
                key(p, "scale", F(ta))
                key(p, "location", F(ta))
                p.scale.x = closed_w
                p.location.x = c.x + s * (hw - closed_w / 2.0)
                key(p, "scale", F(ta + 1.1))
                key(p, "location", F(ta + 1.1))
        n += 1
    return n


def zv_street_lamps(on=True, xs=(-30, -10, 10, 30)):
    """the street lamps near the stage glowing (each bulb lights the pavement under it)"""
    if not on:
        return
    for x in xs:
        light("zv_slamp%d" % int(x), "POINT", (x, 9.6, 6.4), 260, (1.0, 0.82, 0.5), 0.6)


ZV_POINTS = {}


def zv_point(name):
    """named points a shot can face / frame: the porch light, the house, the street, the drain..."""
    if name == "porch_light":
        return ZV_LAMP_AT
    return ZV_POINTS.get(name, {"house": (0.0, 22.0, 3.0), "street": (0.0, -4.0, 2.0), "sky": (0.0, 0.0, 30.0)}.get(name, (0.0, -4.0, 2.0)))


def zv_yaw_to(p, q):
    """the rot (degrees) for a kit character at p to face point q (a kit character at rot a faces (sin a, -cos a))"""
    return math.degrees(math.atan2(q[0] - p[0], -(q[1] - p[1])))


def zv_person(stage_id, who, look, spot, t0, face_to=None):
    S = ZV_STAGES[stage_id]
    at = S["spots"][spot]["at"]
    rot = zv_yaw_to(at, face_to) if face_to is not None else 0.0
    ch = zw_person(who, look, (at[0], at[1], at[2]), rot, t0 - 0.5)
    return ch


ZV_KIT_H = 6.38   # measured on the step-1 renders: build at size 3 then scale to `height` (try 3: 10.21 for 8.5 at 5.31)


def zv_creature(stage_id, spot, t0, face_to=None, height=8.5, style="horns"):
    """the creature at its spot, `height` units tall (a kid is 3.0: about 3x a kid)"""
    S = ZV_STAGES[stage_id]
    at = S["creature_spots"][spot]["at"]
    rot = zv_yaw_to(at, face_to) if face_to is not None else 0.0
    # (town.py's zw_monster moves the monster to a "clear spot"; v2 never moves anything: the base one, at the spot)
    # (the base zw_monster clamps size to 3-4x the kit person: build at 3, then scale the whole body to `height`)
    m = ZW_MONSTER1("Creature", (at[0], at[1], at[2]), rot=rot, size=3.0, style=style)
    k = height / (3.0 * ZV_KIT_H)
    m.root.scale = (m.root.scale[0] * k, m.root.scale[1] * k, m.root.scale[2] * k)
    return m


# ---------------------------------------------------------------- THE LIGHT TABLE (one entry per time of day)
# applied after the base look (zw_look_apply), so nothing later undoes it: the sun's colour and strength, the sky's
# colour and strength, the exposure. Lamps and lit windows keep their own glow, so they read at night.
ZV_LIGHT = {
    "day":     {"sun": (1.0, 0.97, 0.92), "sun_k": 1.0, "sky_k": 1.0, "sky_tint": (1.0, 1.0, 1.0), "exposure": 0.0},
    "morning": {"sun": (1.0, 0.82, 0.62), "sun_k": 0.85, "sky_k": 0.9, "sky_tint": (1.05, 0.92, 0.8), "exposure": -0.1},
    "sunset":  {"sun": (1.0, 0.62, 0.42), "sun_k": 0.7, "sky_k": 0.7, "sky_tint": (1.1, 0.75, 0.65), "exposure": -0.3},
    "night":   {"sun": (0.55, 0.65, 1.0), "sun_k": 0.30, "sky_k": 0.75, "sky_tint": (0.55, 0.65, 1.0), "exposure": 0.15},     # moonlight on the ground (owner 2026-11-25)
    "storm":   {"sun": (0.5, 0.6, 0.9), "sun_k": 0.08, "sky_k": 0.18, "sky_tint": (0.5, 0.6, 0.85), "exposure": -0.7},
}
ZV_TIME = {"t": None}


def zv_light_apply():
    L = ZV_LIGHT.get(ZV_TIME["t"])
    if not L:
        return
    for o in D.objects:
        if o.type == "LIGHT" and o.data.type == "SUN":
            o.data.color = L["sun"]
            o.data.energy = o.data.energy * L["sun_k"]
    w = bpy.context.scene.world
    if w is not None and w.use_nodes:
        for nd in w.node_tree.nodes:
            if nd.type == "BACKGROUND":
                c = nd.inputs["Color"].default_value
                nd.inputs["Color"].default_value = (c[0] * L["sky_tint"][0], c[1] * L["sky_tint"][1], c[2] * L["sky_tint"][2], 1.0)
                nd.inputs["Strength"].default_value = nd.inputs["Strength"].default_value * L["sky_k"]
    bpy.context.scene.view_settings.exposure = L["exposure"]
    ZV_TIME["t"] = None   # once per shot


ZV_LOOK0 = zw_look_apply


def zw_look_apply():
    ZV_LOOK0()
    zv_light_apply()


def zv_cam(stage_id, cam_name, t0, t1, push=0.06):
    c = ZV_STAGES[stage_id]["cameras"][cam_name]
    loc, tgt = Vector(c["loc"]), Vector(c["tgt"])
    cam = Cam()
    cam.key(t0, tuple(loc), tuple(tgt), lens=c["lens"])
    cam.key(t1, tuple(loc + (tgt - loc) * push), tuple(tgt), lens=c["lens"])
    return cam


def zv_test_shot(stage_id, cam_name, time, t0, t1, looks):
    """step 1's test still: the camera's own spots filled with dummy people (+ its creature), all facing the lens"""
    S = ZV_STAGES[stage_id]
    c = S["cameras"][cam_name]
    zv_build(stage_id, time, t0, t1)
    subs = []
    for k, spot in enumerate(c["people"]):
        who = ["Kid", "Dad"][k % 2]
        ch = zv_person(stage_id, who, looks[who], spot, t0, face_to=c["loc"])
        zw_emote(ch, t0, t1, "neutral")
        subs.append((who, ch))
    cr = zv_creature(stage_id, c["creature"], t0, face_to=c["loc"]) if c.get("creature") else None
    zv_cam(stage_id, cam_name, t0, t1)
    ZV_SHOT.clear()
    ZV_SHOT.update({"cam": cam_name, "subjects": subs, "creature": cr})


def zv_gate(S):
    """THE v2 CHECKS (they fail the shot): every subject in frame, its head not cut, not too small, nothing between the lens
    and its head (walls, props, OTHER PEOPLE and the creature count), the creature never a wall in front of the lens.
    Also measures each body (w, d, h) to calibrate the free code check."""
    if not ZV_SHOT:
        return []
    sc = bpy.context.scene
    cam = sc.camera
    if cam is None:
        return []
    f = (F(S["t0"]) + max(F(S["t0"]), F(S["t1"]) - 1)) // 2
    sc.frame_set(f)
    o = cam.matrix_world.translation.copy()
    sid = S.get("id", "?")
    lines = []
    e = cam.matrix_world.to_euler()
    lines.append("ZW_GATE|%s|zv_cam|%.2f|%.2f|%.2f|%.1f|%.1f|%.1f|%.1f" % (sid, o.x, o.y, o.z, math.degrees(e.x), math.degrees(e.y), math.degrees(e.z), cam.data.lens))
    subs = list(ZV_SHOT.get("subjects", []))
    cr = ZV_SHOT.get("creature")
    mine = lambda ob, ch: ob is not None and (ob.name.startswith(ch.name + "_") or ob.name == ch.root.name or ob.name.startswith("zp_f"))
    for who, ch in subs + ([("creature", cr)] if cr is not None else []):
        pts = zw_pts([ch.root])
        if pts:
            xs, ys, zs = [p.x for p in pts], [p.y for p in pts], [p.z for p in pts]
            lines.append("ZW_GATE|%s|zv_dim|%s|%.2f|%.2f|%.2f" % (sid, who, max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs)))
        sp = zw_span(cam, pts) if pts else None
        if sp is None:
            lines.append("ZW_GATE|%s|zv|%s|out_of_frame|behind the lens" % (sid, who))
            continue
        u0, u1, v0, v1 = sp
        if u1 < 0.05 or u0 > 0.95 or v1 < 0.05 or v0 > 0.95:
            lines.append("ZW_GATE|%s|zv|%s|out_of_frame|u %.2f-%.2f v %.2f-%.2f" % (sid, who, u0, u1, v0, v1))
            continue
        if who == "creature":
            if pts and (zw_span(cam, [p for p in pts if p.z > min(q.z for q in pts) + 0.78 * (max(q.z for q in pts) - min(q.z for q in pts))]) or (0, 1, -1, 2))[2] < 0.0:
                lines.append("ZW_GATE|%s|zv|creature|head_cut|its eyes are above the frame" % sid)
            cov = max(0.0, min(1.0, u1) - max(0.0, u0)) * max(0.0, min(1.0, v1) - max(0.0, v0))
            if cov > 0.7 and ZV_SHOT.get("cam") not in ("eyes", "reveal_face"):    # an eyes-only shot fills the frame on purpose
                lines.append("ZW_GATE|%s|zv|creature|lens_wall|covers %d pct of the frame" % (sid, int(100 * cov)))
        elif (v1 - v0) < 0.12 and not str(ZV_SHOT.get("cam", "")).startswith("reveal"):     # (a reveal: the hero small on purpose)
            lines.append("ZW_GATE|%s|zv|%s|small|body %.2f of the frame height" % (sid, who, v1 - v0))
        hp = zw_head_pts(ch) if who != "creature" else pts
        hs = zw_span(cam, hp) if hp else None
        if who != "creature" and hs is not None and (hs[0] < 0.0 or hs[1] > 1.0 or hs[2] < 0.0 or hs[3] > 0.62):
            lines.append("ZW_GATE|%s|zv|%s|head_cut|head u %.2f-%.2f v %.2f-%.2f (captions below 0.62)" % (sid, who, hs[0], hs[1], hs[2], hs[3]))
        if hp:
            hc = Vector((sum(p.x for p in hp) / len(hp), sum(p.y for p in hp) / len(hp), sum(p.z for p in hp) / len(hp)))
            if who == "creature":
                hc = Vector((hc.x, hc.y, min(p.z for p in hp) + 0.75 * (max(p.z for p in hp) - min(p.z for p in hp))))
            dv = hc - o
            try:
                dg = bpy.context.evaluated_depsgraph_get()
                hit, loc, nrm, idx, hob, mw = sc.ray_cast(dg, o, dv.normalized(), distance=max(0.1, dv.length - 0.5))
            except Exception:
                hit, hob = False, None
            if hit and hob is not None and not mine(hob, ch) and not hob.hide_render:
                lines.append("ZW_GATE|%s|zv|%s|blocked|%s between the lens and the head" % (sid, who, hob.name[:30]))
    if not any("|zv|" in l for l in lines):
        lines.append("ZW_GATE|%s|zv_ok|%s|all subjects clear" % (sid, ZV_SHOT.get("cam")))
    for l in lines:
        print(l)
    ZV_SHOT.clear()
    return lines


ZV_GATE0 = zw_gate


def zw_gate(S):
    out = list(ZV_GATE0(S) or [])
    try:
        out += zv_gate(S)
    except Exception as e:
        print("ZW_GATE|%s|zv|check|crash|%s" % (S.get("id", "?"), str(e)[:120]))
    return out
# ===== END OF v2 STAGE ================================================================================================


# ===== STAGE B, PIECE 1: THE DINING CORNER (built by us, no town around it) ==========================================
ZV_DINING_LIGHT = {
    "dinner":      {"lamp": (1.0, 0.8, 0.55), "lamp_w": 900, "fill": (1.0, 0.88, 0.74), "fill_w": 650, "world": (0.22, 0.18, 0.15), "exposure": 0.25},
    "dinner_cold": {"lamp": (0.74, 0.84, 1.0), "lamp_w": 620, "fill": (0.62, 0.72, 0.96), "fill_w": 420, "world": (0.1, 0.12, 0.17), "exposure": 0.0},
}


def zv_build_dining(S, time, t0, t1):
    """the dining corner: a wooden floor, two walls and a back wall with a curtained window, a table with a cloth, plates
    and food, a warm pendant lamp; the open side toward -Y. Chairs are added per sitter (zv_chairs)."""
    L = ZV_DINING_LIGHT.get(time, ZV_DINING_LIGHT["dinner"])
    W = bpy.context.scene.world or D.worlds.new("W")
    bpy.context.scene.world = W
    W.use_nodes = True
    bg = next(x for x in W.node_tree.nodes if x.type == "BACKGROUND")
    bg.inputs["Color"].default_value = (*L["world"], 1)
    bg.inputs["Strength"].default_value = 1.0
    wood = mat("zv_floor", zc_rgb("#8A5A3A"), 0.6)
    wall = mat("zv_wallpaper", zc_rgb("#E9D3A8" if time == "dinner" else "#B9C3CC"), 0.9)
    trim = mat("zv_trim", zc_rgb("#F4EEE2"), 0.6)
    box("zv_floor", (14, 12, 0.2), (0, -1.5, -0.1), wood, 0.0)
    box("zv_backwall", (10.4, 0.3, 7.5), (0, 3.45, 3.75), wall, 0.0)
    for sx in (-1, 1):
        box("zv_sidewall%d" % sx, (0.4, 9.1, 7.5), (sx * 5.4, -0.95, 3.75), wall, 0.0)
    box("zv_skirting", (10.4, 0.36, 0.4), (0, 3.4, 0.2), trim, 0.0)
    # the window behind the table, the night outside, the curtains CLOSED (the rule)
    for nm, size, loc in (("top", (3.8, 0.4, 0.26), (0, 3.36, 5.3)), ("bot", (3.8, 0.5, 0.22), (0, 3.3, 2.1)), ("l", (0.24, 0.4, 3.3), (-1.78, 3.36, 3.7)), ("r", (0.24, 0.4, 3.3), (1.78, 3.36, 3.7))):
        box("zv_winframe_" + nm, size, loc, trim, 0.03)
    box("zv_winglass", (3.4, 0.2, 3.0), (0, 3.42, 3.7), mat("zv_night_glass", zc_rgb("#0E1A33"), 0.1, emit=zc_rgb("#16264A"), estr=0.6), 0.0)
    cm = zc_fabric(mat("zv_dcurtain", zc_rgb("#B84A4A"), 0.85), scale=60.0, strength=0.25)
    cm2 = mat("zv_dcurtain2", zc_rgb("#8E3434"), 0.9)
    for sx in (-1, 1):
        for k in range(6):   # the folds: rounded pleats, alternating in and out, meeting in the middle (closed)
            x = sx * (0.16 + k * 0.33)
            cyl("zv_fold%d_%d" % (sx, k), 0.2, 3.55, (x, 3.04 + (0.06 if k % 2 else 0.0), 3.55), cm if k % 2 == 0 else cm2, 12)
    box("zv_pelmet", (4.3, 0.3, 0.45), (0, 2.95, 5.55), cm2, 0.06)
    cyl("zv_rod", 0.05, 4.4, (0, 3.0, 5.35), trim, 8, rot=(0, 90, 0))
    for sx in (-1, 1):
        sphere("zv_finial%d" % sx, 0.1, (sx * 2.25, 3.0, 5.35), trim, seg=10)
    # the table: legs, top, a cloth; plates + food at the four seats; a jug in the middle
    tw = mat("zv_tablewood", zc_rgb("#6E4428"), 0.55)
    for x in (-1.45, 1.45):
        for y in (-0.8, 0.8):
            box("zv_tleg%d_%d" % (int(x * 10), int(y * 10)), (0.16, 0.16, 1.0), (x, y, 0.5), tw, 0.02)
    box("zv_ttop", (3.3, 2.0, 0.12), (0, 0, 1.04), tw, 0.03)
    box("zv_tcloth", (2.6, 1.5, 0.02), (0, 0, 1.11), mat("zv_cloth", zc_rgb("#F2EBDD"), 0.8), 0.0)
    plate = mat("zv_plate", zc_rgb("#FFFFFF"), 0.3)
    for nm, (x, y) in (("front", (0, -0.62)), ("back", (0, 0.62)), ("left", (-1.15, 0)), ("right", (1.15, 0))):
        cyl("zv_plate_" + nm, 0.32, 0.04, (x, y, 1.14), plate, 24)
        sphere("zv_food_" + nm, 0.14, (x, y, 1.2), mat("zv_food", zc_rgb("#E0A040"), 0.6), (1.2, 1.0, 0.5), seg=12)
        sphere("zv_peas_" + nm, 0.08, (x + 0.12, y + 0.06, 1.18), mat("zv_peas", zc_rgb("#6FB04A"), 0.6), (1.1, 1.1, 0.6), seg=10)
    cyl("zv_jug", 0.14, 0.42, (0.35, 0.05, 1.32), mat("zv_jugm", zc_rgb("#7FB3D9"), 0.2), 16)
    # the warm lamp over the table (a shade + a bulb) and a soft fill from the open side
    cyl("zv_shade", 0.55, 0.4, (0, 0, 5.3), mat("zv_shadem", zc_rgb("#2A2A2E"), 0.4), 24, r2=0.25)
    sphere("zv_bulb", 0.16, (0, 0, 5.05), mat("zv_bulbm", zc_rgb("#FFF2D0"), 0.2, emit=zc_rgb("#FFE4A8"), estr=12.0), seg=12)
    cyl("zv_cord", 0.02, 2.2, (0, 0, 6.6), trim, 6)
    light("zv_lamp", "AREA", (0, 0, 4.9), L["lamp_w"], L["lamp"], 1.4, rot=(0, 0, 0))
    light("zv_fill", "AREA", (1.5, -7.0, 4.0), L["fill_w"], L["fill"], 6.0, target=(0, 0, 1.6))
    light("zv_bounce", "AREA", (0, -2.0, 6.8), L["fill_w"] * 0.6, L["lamp"], 8.0, rot=(0, 0, 0))   # the ceiling bounce: walls + floor read
    bpy.context.scene.view_settings.exposure = L["exposure"]
    ZV_TIME["t"] = None
    return {}


def zv_chair(nm, at, face_to, seat_top, back=True):
    """a chair at a seat spot, turned to the table, its seat at the sitter's own height"""
    w = mat("zv_chairwood", zc_rgb("#7A4E30"), 0.6)
    e = empty(nm, (at[0], at[1], 0.0))
    e.rotation_euler[2] = math.atan2(face_to[0] - at[0], -(face_to[1] - at[1]))
    box(nm + "_seat", (1.2, 1.1, 0.14), (0, 0.12, seat_top - 0.07), w, 0.03, parent=e)
    for x in (-0.5, 0.5):
        for y in (-0.38, 0.6):
            box("%s_leg%d%d" % (nm, int(x * 10), int(y * 10)), (0.12, 0.12, seat_top - 0.14), (x, y, (seat_top - 0.14) / 2.0), w, 0.01, parent=e)
    if back:
        box(nm + "_back", (1.2, 0.12, 1.4), (0, 0.68, seat_top + 0.7), w, 0.03, parent=e)
    return e


def zv_seat_top(ch):
    """the height a sitter's thighs rest at (their own chair height): from the sit pose and their proportions"""
    P = ch.spec["body"]
    hip = P["thigh"] + P["shin"] + 0.52 - 0.43 * (P["thigh"] + P["shin"])
    return max(0.35, (hip - 0.45) * ch.k)


def zv_sit(ch, t, at, table=(0.0, 0.0)):
    """a person sitting at the table: the sit pose, their own chair under them, the body turned to the table"""
    ch.pose(t, "sit")
    ch.face_to((table[0], table[1], 1.0))
    a = ch.root.rotation_euler[2]
    fwd = Vector((math.sin(a), -math.cos(a), 0.0))
    ch.root.location = (at[0] + fwd.x * 0.1, at[1] + fwd.y * 0.1, 0.0)
    st = zv_seat_top(ch)
    boost = 0.45 if ch.spec["height"] < 2.9 else 0.0
    if boost > 0.0:   # a booster cushion: a small sitter's chin clears the table
        ch.root.location.z = boost
        box(ch.name + "_booster", (1.0, 0.9, boost), (at[0] - fwd.x * 0.05, at[1] - fwd.y * 0.05 + 0.0, st + boost / 2.0), mat("zv_cushion", zc_rgb("#4C8FD6"), 0.85), 0.12)
    zv_chair(ch.name + "_chair", (at[0] - fwd.x * 0.05, at[1] - fwd.y * 0.05), table, st)


def zv_empty_chairs(S, occupied, table=(0.0, 0.0)):
    for k, v in S["spots"].items():
        if v.get("seat") and k not in occupied:
            zv_chair("zv_chair_" + k, v["at"], table, 0.62)
