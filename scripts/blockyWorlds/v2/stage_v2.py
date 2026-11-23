# ===== IN THIS TOWN v2: THE STAGE (scripts/blockyWorlds/v2/stage_v2.py) ==============================================
# Pasted AFTER the base engine (worlds, actions, acts, pieces, motion, crowds, town) and NOTHING of stage*.py.
# One shot = one fresh build: the tested stage, people ON spots, the creature on a creature spot, a named camera.
# The checks here FAIL a shot (they print ZW_GATE|<shot>|zv|...); they never move anything to hide a problem.
ZV_STAGES = {}          # filled by the runner from stageA.mjs (one source of truth)
ZV_SHOT = {}            # this shot: {"cam": name, "subjects": [(who, Char)], "creature": Char|None}


def zv_build(stage_id, time, t0, t1):
    """the stage at its time of day, quiet (nobody else, no cars), the stage's own removals done"""
    S = ZV_STAGES[stage_id]
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
    "night":   {"sun": (0.55, 0.65, 1.0), "sun_k": 0.10, "sky_k": 0.22, "sky_tint": (0.55, 0.65, 1.0), "exposure": -0.6},
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
            if hp and (zw_span(cam, [p for p in hp if p.z > min(q.z for q in hp) + 0.78 * (max(q.z for q in hp) - min(q.z for q in hp))]) or (0, 1, -1, 2))[2] < 0.0:
                lines.append("ZW_GATE|%s|zv|creature|head_cut|its eyes are above the frame" % sid)
            cov = max(0.0, min(1.0, u1) - max(0.0, u0)) * max(0.0, min(1.0, v1) - max(0.0, v0))
            if cov > 0.5:
                lines.append("ZW_GATE|%s|zv|creature|lens_wall|covers %d pct of the frame" % (sid, int(100 * cov)))
        elif (v1 - v0) < 0.12:
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
