# ===== ROUND 9 (owner 2026-11-23): THE REPLICA'S LESSONS AS DEFAULTS ===============================================
# Pasted after stage.py. What the chalk-line replica taught, now the default for every story:
#   THE NIGHT       nearly black and deep blue, lit only by lamps, windows and glowing eyes; no white pavement; a storm is
#                   a dark sky + rain, never a grey day (zs_deep_night, through zs_light)
#   THE MONSTER     a pure black thin silhouette, taller than the street lamps, two glowing eyes, arms to the road
#   MANY COPIES     things per owner / per place ("bell#max", "chalk_line#house3"); chalk lines around every house, a line
#                   that appears as someone draws it (zs_draw_line / zs_draw_around) and washes away in the rain (zs_wash)
#   EVERYONE        a crowd of 8-10 at the windows, on the porches and in the street, each with their own thing (zs_crowd)
#   DOOR TO DOOR    "I ran to every door": runs from door to door, knocking (zs_door_to_door)
#   IT MOVED        zs_moved prints how far a character really went in a line (the free check: a movement verb that
#                   does not move = fail)
#   THE CAMERA      zc_cut's default recipes (measured on the reference): on the subjects' side of the road a few steps
#                   away; the subject 35-60 % of the frame height above the captions; blocked = move sideways until
#                   clear; a kid + the monster = a low camera near the kid looking up; a thing on the ground = top-down,
#                   alone; a close two-shot keeps both faces in the frame

# ---------------------------------------------------------------- the props round 9 adds (the replica's dog, car, chalk, roof)
def zt_build_dog(r, c=None, col=None):
    M = zt_m("dog" + (col or "#8a5a3c")[1:], col or "#8a5a3c", 0.8)
    box("zt_dogb%d" % ZT_N["n"], (0.7, 1.5, 0.7), (0, 0, 0.95), M, 0.08, parent=r, coll=c)
    box("zt_dogh%d" % ZT_N["n"], (0.6, 0.6, 0.6), (0, -0.95, 1.45), M, 0.08, parent=r, coll=c)
    box("zt_dogn%d" % ZT_N["n"], (0.32, 0.3, 0.26), (0, -1.35, 1.32), zt_m("dognose", "#222222", 0.6), 0.04, parent=r, coll=c)
    for k, (lx, ly) in enumerate(((-0.22, -0.55), (0.22, -0.55), (-0.22, 0.55), (0.22, 0.55))):
        box("zt_dogl%d_%d" % (ZT_N["n"], k), (0.2, 0.2, 0.62), (lx, ly, 0.31), M, 0.02, parent=r, coll=c)
    box("zt_dogt%d" % ZT_N["n"], (0.14, 0.5, 0.14), (0, 0.95, 1.25), M, 0.02, rot=(35, 0, 0), parent=r, coll=c)
    return r


def zt_build_car(r, c=None, col=None):
    M = zt_m("tcar" + (col or "#2e5fd1")[1:], col or "#2e5fd1", 0.35, 0.3)
    Mg = zt_m("tcarglass", "#1b2433", 0.15, 0.4)
    Mt = zt_m("tcartyre", "#151515", 0.8)
    box("zt_carb%d" % ZT_N["n"], (2.2, 4.6, 1.0), (0, 0, 0.85), M, 0.25, parent=r, coll=c)
    box("zt_cart%d" % ZT_N["n"], (1.9, 2.4, 0.8), (0, 0.2, 1.7), Mg, 0.25, parent=r, coll=c)
    for sx in (-1, 1):
        for sy in (-1, 1):
            cyl("zt_carw%d_%d_%d" % (ZT_N["n"], sx, sy), 0.42, 0.3, (sx * 1.05, sy * 1.5, 0.42), Mt, 14, rot=(0, 90, 0), parent=r, coll=c)
    return r


def zt_build_chalk(r, c=None, col=None):
    cyl("zt_chalk%d" % ZT_N["n"], 0.12, 0.8, (0, 0, 0.4), zt_m("chalkstick", "#f6f6f2", 0.9), 10, parent=r, coll=c)
    return r


def zt_build_roof(r, c=None, col=None):
    """a roof on four wooden posts (the town builds it over the monster)"""
    Mw = zt_m("roofwood", "#8a5a2b", 0.7)
    for sx in (-1, 1):
        for sy in (-1, 1):
            box("zt_rfp%d_%d_%d" % (ZT_N["n"], sx, sy), (0.35, 0.35, 6.0), (sx * 2.6, sy * 2.6, 3.0), Mw, 0.02, parent=r, coll=c)
    box("zt_rft%d" % ZT_N["n"], (6.6, 6.6, 0.4), (0, 0, 6.2), zt_m("rooftop", "#6b4a2a", 0.7), 0.05, parent=r, coll=c)
    return r


ZT_BUILD8 = zt_build


def zt_build(kind, r, c, col):
    if kind == "dog":
        return zt_build_dog(r, c, col)
    if kind == "car":
        return zt_build_car(r, c, col)
    if kind == "chalk":
        return zt_build_chalk(r, c, col)
    if kind == "roof":
        return zt_build_roof(r, c, col)
    return ZT_BUILD8(kind, r, c, col)


ZW_THING_SIZE.update({"dog": 1.0, "car": 1.0, "chalk": 1.0, "roof": 1.0})


# ---------------------------------------------------------------- THE NIGHT (item 4)
def zs_deep_night(time):
    """after the place is built: the reference's night: the sky / the ambient nearly black-blue, the pale surfaces
    (pavement, porch, trim, house bases) darkened, the lamp pools softer; emissive things (lamps, windows, eyes, chalk)
    untouched"""
    w = bpy.context.scene.world
    if w is not None and w.use_nodes:
        for nd in w.node_tree.nodes:
            if nd.type == "BACKGROUND":
                nd.inputs["Color"].default_value = (0.006, 0.009, 0.03, 1.0)
                nd.inputs["Strength"].default_value = 0.6
    for o in D.objects:
        if o.type != "LIGHT" or o.data.get("zs_dark"):
            continue
        o.data["zs_dark"] = 1   # (once: the look step calls this again)
        n = o.name
        if o.data.type == "SUN":
            o.data.energy = min(o.data.energy, 0.35 if time == "night" else 0.25)
            o.data.color = (0.45, 0.55, 1.0)
        elif n.startswith("zw_lamppool"):
            o.data.energy = o.data.energy * 0.5
        elif n.startswith("zw_snl"):
            o.data.energy = 120.0
        elif "rim" in n:
            o.data.energy = o.data.energy * 2.2   # the monster's outline against the dark (the reference's white edge)
    zs_tone_materials(True)
    ZW_FRAMED["night"] = "deep night (%s)" % time
    return True


ZS_DARK = {"zw_sidewalk": 0.22, "zw_hbase": 0.3, "zw_porch": 0.35, "zw_trimw": 0.35, "zw_dash_w": 0.4, "zw_asphalt": 0.45, "zw_bc_walk": 0.25, "zw_grass": 0.45, "zw_house": 0.55}


def zs_tone_materials(deep):
    """the night's darker surfaces / dimmer windows, from each material's ORIGINAL colour (kept on the material), so a
    day shot after a night shot (materials can outlive a shot) gets its own colours back"""
    for m in bpy.data.materials:
        if not m.use_nodes:
            continue
        f = None
        for k, v in ZS_DARK.items():
            if m.name.startswith(k):
                f = v
        lit = "win" in m.name or "glass" in m.name or "lit" in m.name
        if f is None and not lit:
            continue
        for nd in m.node_tree.nodes:
            if nd.type != "BSDF_PRINCIPLED":
                continue
            if f is not None:
                if "zs_c0" not in m:
                    m["zs_c0"] = list(nd.inputs["Base Color"].default_value)
                c = m["zs_c0"]
                nd.inputs["Base Color"].default_value = (c[0] * f, c[1] * f, c[2] * f * 1.15, 1.0) if deep else (c[0], c[1], c[2], 1.0)
            if lit and "Emission Strength" in nd.inputs:
                if "zs_e0" not in m:
                    m["zs_e0"] = float(nd.inputs["Emission Strength"].default_value)
                nd.inputs["Emission Strength"].default_value = m["zs_e0"] * (0.45 if deep else 1.0)


ZS_LIGHT8 = zs_light


def zs_light(time, t0, t1):
    r = ZS_LIGHT8(time, t0, t1)
    ZS["deep"] = time if time in ("night", "storm") else None
    if ZS["deep"]:
        zs_deep_night(time)
    else:
        zs_tone_materials(False)
    return r


# (the replica's first stills: the hook's look step (zw_look_apply, after the shot) brought the bright night back: the
# deep night is applied again after it; the materials are darkened once only)
ZW_LOOK_APPLY8 = zw_look_apply


def zw_look_apply(*a, **k):
    r = ZW_LOOK_APPLY8(*a, **k)
    if ZS.get("deep"):
        zs_deep_night(ZS["deep"])
    return r


# a walk with no time left (a give at the end of a short line: the replica's first stills crashed in zm_walk's maths)
ZM_WALK9 = zm_walk


def zm_walk(ch, t0, t1, to, run=False, face=True, arms=True, turn=True):
    if t1 - t0 < 0.3:
        t1 = t0 + 0.3
    return ZM_WALK9(ch, t0, t1, to, run=run, face=face, arms=arms, turn=turn)


# ---------------------------------------------------------------- THE MONSTER (item 4): taller than the street lamps
def zs_outline_mat(mt):
    nt = mt.node_tree
    bsdf = None
    for nd in nt.nodes:
        if nd.type == "BSDF_PRINCIPLED":
            bsdf = nd
    if bsdf is None:
        return
    lw = nt.nodes.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.25
    pw = nt.nodes.new("ShaderNodeMath")
    pw.operation = "POWER"
    pw.inputs[1].default_value = 4.0
    mu = nt.nodes.new("ShaderNodeMath")
    mu.operation = "MULTIPLY"
    mu.inputs[1].default_value = 3.0
    nt.links.new(lw.outputs["Facing"], pw.inputs[0])
    nt.links.new(pw.outputs[0], mu.inputs[0])
    nt.links.new(mu.outputs[0], bsdf.inputs["Emission Strength"])
    for key in ("Emission Color", "Emission"):
        if key in bsdf.inputs:
            bsdf.inputs[key].default_value = (0.62, 0.72, 1.0, 1.0)
            break
    mt["zs_outline"] = 1


ZW_MON9 = zw_monster


def zw_monster(name, loc, rot=0.0, size=3.5, style="horns", **kw):
    m = ZW_MON9(name, loc, rot=rot, size=size, style=style, **kw)
    if style != "shadow":
        return m
    # thinner + taller (the reference: a long thin silhouette), arms down to the road
    s = m.root.scale[2]
    lamp_top = 6.9
    for o in D.objects:
        if o.name.startswith("zw_lamppool"):
            lamp_top = max(lamp_top, o.location.z + 0.3)
    # the reference's faint white OUTLINE: the black body glows at its edges (a facing / fresnel emission), so the
    # silhouette reads against the night sky (the replica's first stills: black on black)
    for nm in (name + "_skin", name + "_shirt", name + "_pants"):
        mt = bpy.data.materials.get(nm)
        if mt is not None and mt.use_nodes and not mt.get("zs_outline"):
            try:
                zs_outline_mat(mt)
            except Exception as e:
                print("zs_outline skipped: %s" % e)
    want = max(lamp_top * 1.35, 5.6 * s)
    k = want / (5.6 * s)
    m.root.scale = (s * 0.62, s * 0.62, s * k)
    for o in list(m.root.children_recursive):
        if o.name.endswith("_armL") or o.name.endswith("_armR"):
            o.scale = (0.34, 0.34, 2.1)
        elif o.name.endswith("_legL") or o.name.endswith("_legR"):
            o.scale = (0.36, 0.36, 1.0)
        elif o.name.endswith("_torso"):
            o.scale = (0.5, 0.55, 1.0)
    return m


# ---------------------------------------------------------------- CHALK (item 5): lines on the ground, drawn, washed
def zs_chalk_mat():
    return zw_m("chalk_glow", "#f4f6ff", 0.85, emit="#eef2ff", estr=0.9 if zw_time() in ("night", "storm") else 0.0)


def zs_chalk_path(name, pts, closed=True, width=0.32):
    """a chalk line along ground points [(x, y)]: one thin strip per segment (children of an empty `name`)"""
    r = empty(name, (0, 0, 0), None)
    M = zs_chalk_mat()
    P = list(pts) + ([pts[0]] if closed else [])
    segs = []
    for k in range(len(P) - 1):
        a, b = Vector((P[k][0], P[k][1], 0.0)), Vector((P[k + 1][0], P[k + 1][1], 0.0))
        d = b - a
        L = d.length
        if L < 1e-3:
            continue
        c = (a + b) / 2
        yaw = math.degrees(math.atan2(d.y, d.x))
        sg = box("%s_s%d" % (name, k), (L + width * 0.6, width, 0.03), (c.x, c.y, 0.09), M, 0.0, rot=(0, 0, yaw), parent=r)
        segs.append(sg)
    r["segs"] = len(segs)
    return r


def zs_circle_pts(c, rad, n=20):
    return [(c[0] + rad * math.cos(2 * math.pi * k / n), c[1] + rad * math.sin(2 * math.pi * k / n)) for k in range(n)]


def zs_rect_pts(x0, y0, x1, y1, step=2.5):
    pts = []
    for (a, b) in (((x0, y0), (x1, y0)), ((x1, y0), (x1, y1)), ((x1, y1), (x0, y1)), ((x0, y1), (x0, y0))):
        n = max(1, int(math.hypot(b[0] - a[0], b[1] - a[1]) / step))
        for k in range(n):
            pts.append((a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n))
    return pts


def zs_segs(r):
    return sorted([o for o in r.children if o.type == "MESH"], key=lambda o: o.name)


def zs_reveal(r, t0, t1):
    """the line APPEARS segment by segment between t0 and t1 (hidden before)"""
    S = zs_segs(r)
    for k, o in enumerate(S):
        s = tuple(o.scale)
        ts = t0 + (t1 - t0) * (k + 1) / max(1, len(S))
        o.scale = (0.001, 0.001, 0.001)
        o.keyframe_insert("scale", frame=max(1, F(ts) - 1))
        o.scale = s
        o.keyframe_insert("scale", frame=F(ts))
    return r


def zs_wash(r, t0, t1):
    """the line WASHES AWAY in the rain: the segments thin out and vanish one after another between t0 and t1"""
    S = zs_segs(r)
    for k, o in enumerate(S):
        s = tuple(o.scale)
        ts = t0 + (t1 - t0) * k / max(1, len(S))
        o.keyframe_insert("scale", frame=F(ts))
        o.scale = (s[0], s[1] * 0.4, s[2])
        o.keyframe_insert("scale", frame=F(ts + 0.25))
        o.scale = (0.001, 0.001, 0.001)
        o.keyframe_insert("scale", frame=F(ts + 0.5))
    return r


def zs_walk_path(ch, t0, t1, pts, run=True):
    """the character goes along the points from t0 to t1 (each leg timed by its length)"""
    P = [Vector((p[0], p[1], 0.0)) for p in pts]
    L = [(P[k + 1] - P[k]).length for k in range(len(P) - 1)]
    tot = max(1e-3, sum(L))
    t = t0
    for k in range(len(P) - 1):
        dt = (t1 - t0) * L[k] / tot
        if dt > 0.02:
            zm_walk(ch, t, t + dt, (P[k + 1].x, P[k + 1].y, 0.0), run=run)
        t += dt
    return ch


def zs_draw_line(ch, r, t0, t1, pts=None):
    """the character DRAWS the line: walks along it, bent down, the chalk appears behind them"""
    zs_reveal(r, t0, t1)
    if pts:
        zs_walk_path(ch, t0, t1, pts, run=False)
    ch.pose(t0 - 0.1, armR=(70, -10))
    ch.pose(t1, armR=(70, -10))
    return r


def zs_draw_around(ch, target, t0, t1, name, rad=None):
    """the kid RUNS AROUND a character / thing dragging the chalk: a circle that closes at t1"""
    c = za_here(target, t0) if hasattr(target, "root") else Vector(za_pos(target))
    big = target.root.scale[0] if hasattr(target, "root") else 1.0
    rad = rad or max(2.6, 2.2 * big) * zw_ps() / 0.55 * 0.8
    pts = zs_circle_pts((c.x, c.y), rad, 18)
    p0 = za_here(ch, t0)
    a0 = math.atan2(p0.y - c.y, p0.x - c.x)
    pts = [(c.x + rad * math.cos(a0 + 2 * math.pi * k / 18), c.y + rad * math.sin(a0 + 2 * math.pi * k / 18)) for k in range(19)]
    r = zs_chalk_path(name, pts[:-1], closed=True)
    zs_reveal(r, t0 + 0.15, t1)
    zs_walk_path(ch, t0, t1, pts, run=True)
    ch.pose(t0, armR=(60, -10))
    ch.pose(t1, armR=(60, -10))
    return r


def zs_house_rings(place, near=None, n=6, owner_k=None):
    """A CHALK LINE AROUND EVERY HOUSE (the per-place copies): a rectangle round each house's lot near the stage.
    -> {k: ring} (k = the house index; the one nearest `near` is the stage's own house)"""
    st_c, st_d, st_r, st_rot = zw_stage(place)
    c = Vector(za_pos(near, (st_c.x, st_c.y, 0.0)))
    hs = [o for o in D.objects if o.type == "MESH" and o.name.startswith("zw_h") and o.name[4:].isdigit()]
    hs.sort(key=lambda o: (Vector((o.location.x, o.location.y, 0)) - Vector((c.x, c.y, 0))).length)
    out = {}
    for o in hs[:n]:
        x, y = o.location.x, o.location.y
        side = 1 if y > 0 else -1
        y_front = y - side * 7.6
        r = zs_chalk_path("zs_ring%s" % o.name[4:], zs_rect_pts(x - 8.2, y_front, x + 8.2, y + side * 7.0), closed=True)
        out[int(o.name[4:])] = r
    return out


# ---------------------------------------------------------------- EVERYONE (item 12): a crowd, each with their own thing
ZS_CROWD_COLS = [("#2ecc71", "#1b2a49"), ("#e67e22", "#2c3e50"), ("#9b59b6", "#222831"), ("#1abc9c", "#34495e"), ("#e84393", "#2d3436"),
                 ("#0984e3", "#3d3d3d"), ("#fdcb6e", "#2f3542"), ("#d63031", "#1e272e"), ("#00cec9", "#2d3436"), ("#6c5ce7", "#353b48")]


def zs_crowd(t0, t1, n=10, thing=None, do="cheer", near=None, where=None):
    """EVERYONE: n people at the house windows, on the porches and on the sidewalk near the stage, each with their own
    `thing` in the hand, all doing `do` (cheer / wave / ring / point) from t0"""
    st_c, st_d, st_r, st_rot = zw_stage(ZS["place"] or "suburb_street")
    c = Vector(za_pos(near, (st_c.x, st_c.y, 0.0)))
    ps = zw_ps()
    doors = sorted([o for o in D.objects if o.name.startswith("zw_hdoor")], key=lambda o: abs(o.location.x - c.x))[:6]
    spots = []
    for o in doors:
        side = 1 if o.location.y > 0 else -1
        spots.append((o.location.x + 2.2, o.location.y - side * 2.4, 180.0 if side > 0 else 0.0))   # on the porch
        spots.append((o.location.x - 3.0, o.location.y - side * 9.5, 180.0 if side > 0 else 0.0))  # on the sidewalk / lawn
    if where == "here" or do == "play":
        # (kids PLAYING: together on the street near the stage, not spread over the porches)
        spots = [(c.x + 3.2 * ps / 0.55 * math.cos(1.0 + k * 0.9), c.y - 2.0 + 2.2 * ps / 0.55 * math.sin(1.0 + k * 0.9), 180.0 - math.degrees(1.0 + k * 0.9)) for k in range(n)]
    out = []
    for k, (x, y, rot) in enumerate(spots[:n]):
        sh, pa = ZS_CROWD_COLS[k % len(ZS_CROWD_COLS)]
        look = {"name": "Crowd%d" % k, "kid": k % 3 != 0, "skin": ["#F2C9A0", "#8D5524", "#E0AC69", "#C68642"][k % 4], "shirt": sh, "pants": pa, "hair": ["short", "messy", "bun", "spiky", "long"][k % 5], "hair_color": ["#3B2314", "#1A1A1A", "#E8C26A"][k % 3], "face": "kid"}
        ch = zw_person("Crowd%d" % k, look, (x, y, 0.0), rot, t0 - 0.5)
        ZW_EXTRAS.add(ch.name)
        if thing:
            th = zw_thing(thing, (x, y, 0.0), size=zw_tsize(thing, 1.0) * 1.6)
            zw_grab(ch, t0 - 0.2, th)
        tk = t0 + 0.06 * k
        if do == "play":
            zm_jump(ch, tk + 0.2)
            zm_cheer(ch, tk + 0.6)
        elif do in ("ring", "wave"):
            zm_wave(ch, tk, t1)
        elif do == "point":
            zw_point(ch, tk, None)
        else:
            zm_cheer(ch, tk)
        zw_emote(ch, tk, t1, "happy")
        out.append(ch)
    print("ZW_FRAMED|-|crowd|%d people (%s)" % (len(out), thing or "-"))
    return out


# ---------------------------------------------------------------- DOOR TO DOOR (item 11)
def zs_door_to_door(ch, t0, t1, n=3):
    """\"I ran to every door\": the character runs to the nearest house doors on their side of the street, knocking"""
    p = za_here(ch, t0)
    side = 1 if p.y > 0 else -1
    doors = sorted([o for o in D.objects if o.name.startswith("zw_hdoor") and (o.location.y > 0) == (side > 0)], key=lambda o: abs(o.location.x - p.x))[:n]
    doors.sort(key=lambda o: o.location.x)
    if not doors:
        return zm_walk(ch, t0, t1, (p.x + 10.0, p.y, 0.0), run=True)
    dt = (t1 - t0) / len(doors)
    for k, o in enumerate(doors):
        at = (o.location.x, o.location.y - side * 1.6, 0.0)
        zm_walk(ch, t0 + k * dt, t0 + k * dt + dt * 0.7, at, run=True)
        zm_turn(ch, t0 + k * dt + dt * 0.7, 0.0 if side > 0 else 180.0, dur=0.15)
        ch.pose(t0 + k * dt + dt * 0.78, armR=(95, -10))
        ch.pose(t0 + k * dt + dt * 0.9, armR=(70, -10))
    return ch


# ---------------------------------------------------------------- IT MOVED (item 11): the free check's measurement
def zs_moved(H, names, ta, tb, tag):
    for nm in names:
        ch = H.get(nm)
        if ch is None or not hasattr(ch, "root"):
            continue
        a, b = za_here(ch, ta), za_here(ch, tb)
        print("ZW_GATE|%s|%s|moved|%.2f" % (tag, nm, (Vector((b.x, b.y, 0)) - Vector((a.x, a.y, 0))).length / max(0.3, zw_ps())))


# ---------------------------------------------------------------- THE CAMERA DEFAULTS (item 3)
ZC_FRAC.update({"medium": 0.5, "two": 0.45, "close": 0.55, "insert": 0.4})
# (round 9b: a wide from 32 units away ended behind a house: a wider lens keeps it close, the camera over the low roofs)
ZC_LENS["wide"] = 17
ZC_CUT8 = zc_cut


def zc_side_ok(loc, pts):
    """the camera stays on the subjects' side of the road (the street runs along x at y = 0 here; a subject on the road
    itself may be seen from either side)"""
    cy = sum(p.y for p in pts) / max(1, len(pts))
    if abs(cy) < 6.5 or ZS.get("place") not in ("suburb_street", "suburb_porch"):
        return True
    return (loc.y > 0) == (cy > 0) or abs(loc.y) < 4.0


def zc_kid_monster(t0, t1, kid, mon, tag=""):
    """a kid + the monster together: a LOW camera a few steps from the kid, looking UP at the monster over the kid"""
    cam = Cam()
    tm = (t0 + t1) / 2.0
    bpy.context.scene.frame_set(F(tm))
    pk, pm = za_here(kid, tm), za_here(mon, tm)
    ps = zw_ps()
    d = pk - pm
    d.z = 0
    d = d.normalized() if d.length > 1e-3 else Vector((0, -1, 0))
    rgt = Vector((d.y, -d.x, 0))
    mh = max([p.z for p in zw_vpts([mon.root])] + [6.0])
    best = None
    # (round 9b: the monster must not become a black wall: a step further back until it covers under 60 % of the frame)
    mpts = zw_vpts([mon.root])
    for dist in (3.4, 5.5, 8.0, 11.0):
        for sx in (1.0, -1.0, 1.8, -1.8, 0.4):
            loc = pk + d * dist * ps / 0.55 + rgt * sx * ps / 0.55
            loc.z = 0.55 * ps / 0.55
            aim = Vector((pm.x * 0.6 + pk.x * 0.4, pm.y * 0.6 + pk.y * 0.4, mh * 0.55))
            clear = not zw_blocked(Vector((pk.x, pk.y, 1.6 * ps / 0.55)), loc, (kid.name + "_", mon.name + "_"))
            if best is None or (clear and not best[2]):
                best = (loc, aim, clear)
            if clear:
                break
        loc, aim, clear = best
        cam.key(t1, tuple(loc), tuple(aim), lens=16)
        bpy.context.scene.frame_set(F(t1) - 1)
        bpy.context.view_layer.update()
        sp = zw_span(cam.ob, mpts) if mpts else None
        cover = 0.0 if sp is None else max(0.0, min(1.0, sp[1]) - max(0.0, sp[0])) * max(0.0, min(1.0, sp[3]) - max(0.0, sp[2]))
        if cover < 0.6:
            break
        best = None
    if best is None:
        best = (loc, aim, clear)
    loc, aim, clear = best
    cam.key(t0, tuple(loc + d * 0.5), tuple(aim), lens=16)
    cam.key(t1, tuple(loc), tuple(aim + Vector((0, 0, 0.4))), lens=16)
    # the kid's head must be IN the frame (the replica's first stills: two of these faced the dark): else the measured
    # low shot of both
    bpy.context.scene.frame_set(F(tm))
    bpy.context.view_layer.update()
    sp = zw_span(cam.ob, zw_head_pts(kid) or zw_vpts([kid.root]))
    if sp is None or sp[1] < 0.05 or sp[0] > 0.95 or sp[3] < 0.05 or sp[2] > 0.95:
        ZW_FRAMED["cut"] = "kid+monster: the kid was out of the frame, the low fit instead"
        return ZC_CUT8(t0, t1, "low", [kid, mon], [], "push_in", None)
    ZW_FRAMED["cut"] = "kid+monster low (clear %s)" % clear
    return cam


def zc_cut(t0, t1, kind, people=(), things=(), move="push_in", side=None, hero=None, tag="", frac=None):
    """(frac: the subject's wanted share of the frame height for THIS cut: the replica passes the reference's)"""
    if frac is not None:
        old = ZC_FRAC.get(kind)
        ZC_FRAC[kind] = max(0.12, min(0.95, float(frac)))
        try:
            return zc_cut(t0, t1, kind, people, things, move, side, hero, tag)
        finally:
            ZC_FRAC[kind] = old
    people = [p for p in people if p is not None]
    things = [o for o in things if o is not None]
    if kind in ("place", "street"):
        # the place itself (the town wide / the empty street): the place's tested spot with a slow push
        cam = Cam()
        zw_spot(cam, ZS["place"] or "suburb_street", "wide" if kind == "place" else "street", t0, t1, push=0.1)
        print("ZW_FRAMED|%s|measure|place" % tag)
        return cam
    mons = [p for p in people if p.name in ZW_MON]
    kids = [p for p in people if p.name not in ZW_MON]
    if mons and kids and kind in ("low", "wide", "medium", "two"):
        cam = zc_kid_monster(t0, t1, kids[0], mons[0], tag)
    else:
        if kind == "two" and len(kids) >= 2:
            kind = "close2"
        cam = zc_cut9(t0, t1, kind, people, things, move, side)
    zc_measure(cam, t0, t1, people, things, tag)
    return cam


def zc_cut9(t0, t1, kind, people, things, move, side):
    """zc_cut with the round 9 defaults: a close two-shot frames both HEADS; the stage-side yaws are tried in order and
    the first one that is clear AND on the subjects' side of the road wins (blocked = move sideways)"""
    if kind == "close2":
        cam = Cam()
        tm = (t0 + t1) / 2.0
        bpy.context.scene.frame_set(F(tm))
        pts = []
        for ch in people[:2]:
            pts += zw_head_pts(ch)
            sh = zw_pts([ch.torso]) if hasattr(ch, "torso") else []
            if sh:
                top = max(p.z for p in sh)
                pts += [Vector((p.x, p.y, max(p.z, top - 1.0 * ch.root.scale[2]))) for p in sh]
        if pts:
            st_c, st_d, st_r, st_rot = zw_stage(ZS["place"] or "suburb_street")
            r = zw_fit(cam, pts, zw_front(people[:2]), t0, t1, 30, ZW_SAFE, frac=0.42, cam_dz=0.0, yaws=(0.0, 15.0, -15.0, 30.0, -30.0), push=0.0, skip=tuple(p.name + "_" for p in people), tag="close2")
            if r is not None:
                loc, aim = Vector(r[0]), Vector(r[1])
                cam.key(t0, tuple(aim + (loc - aim) * 1.12), tuple(aim), lens=30)
                cam.key(t1, tuple(loc), tuple(aim), lens=30)
                return cam
        kind = "two"
    cam = ZC_CUT8(t0, t1, kind, people, things, move, side)
    # on the wrong side of the road: the other stage-side angles until one is on the subjects' side
    tm = (t0 + t1) / 2.0
    sc = bpy.context.scene
    sc.frame_set(F(tm))
    pts = zc_pts(kind, people, things, tm)
    if pts and not zc_side_ok(Vector(cam.ob.matrix_world.translation), pts):
        for sd in (40.0, -40.0, 60.0, -60.0, 80.0, -80.0):
            cam2 = ZC_CUT8(t0, t1, kind, people, things, move, (ZS["side"] or 0.0) + sd)
            sc.frame_set(F(tm))
            if zc_side_ok(Vector(cam2.ob.matrix_world.translation), pts):
                ZW_FRAMED["side"] = "moved to the subjects' side (%+d)" % sd
                return cam2
    return cam


def zc_measure(cam, t0, t1, people, things, tag):
    """what the cut shows, measured at its middle frame: the subjects' height share of the frame, their vertical centre,
    the camera height (the replica's numbers vs the reference's)"""
    try:
        sc = bpy.context.scene
        tm = (t0 + t1) / 2.0
        sc.frame_set(F(tm))
        bpy.context.view_layer.update()
        pts = []
        for ch in people:
            pts += zw_vpts([ch.root]) if ch is not None else []
        for o in things:
            pts += zw_vpts([o]) or zw_pts([o])
        if not pts:
            return
        sp = zw_span(cam.ob, pts)
        if sp is None:
            print("ZW_FRAMED|%s|measure|behind" % tag)
            return
        u0, u1, v0, v1 = sp
        h = max(0.0, min(1.0, v1) - max(0.0, v0))
        print("ZW_FRAMED|%s|measure|h=%.2f v=%.2f u=%.2f camz=%.2f" % (tag, h, (max(0.0, v0) + min(1.0, v1)) / 2, (max(0.0, u0) + min(1.0, u1)) / 2, cam.ob.matrix_world.translation.z / max(0.3, zw_ps())))
    except Exception as e:
        print("zc_measure skipped: %s" % e)
# ===== END OF STAGE 9 ================================================================================================
