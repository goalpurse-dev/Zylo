# ===== THE BUILDER, ENGINE SIDE (owner 2026-11-23, Part B) ============================================================
# Pasted after the stage files. Turns checked DATA (from builder.js) into objects; never runs AI-written code.
#   zb_prop(spec)            a prop from <= 40 simple shapes, scaled to its real size against a 120 cm kid
#   zb_hold(ch, thing, spec) attached the way the spec says (one hand, two hands, worn, on the ground / a table, ridden)
#   zb_character(spec)       a character from choices + clothes + accessories (accessories are built props)
#   zb_move(ch, spec, t0)    key poses over time, joint limits, feet on the ground, real travel, blended in and out
#   zb_place(spec, time)     a shell (floor, walls, door, windows, light) + furniture + named zones
#   zb_scene(S, t0, t1)      one Part C still: the place, the cast, the props, the moves, the faces, the camera

ZB = {"n": 0, "kid_h": None, "built": {}, "zones": {}, "unit": 1.0}
ZB_KID_CM = 120.0
ZS_LIBRARY["builder_prop"] = ("builder", "a prop from simple shapes at its real size (zb_prop)")
ZS_LIBRARY["builder_character"] = ("builder", "a character from choices + accessories (zb_character)")
ZS_LIBRARY["builder_move"] = ("builder", "a move from key poses with joint limits and real travel (zb_move)")
ZS_LIBRARY["builder_place"] = ("builder", "a room / spot: shell + furniture + zones (zb_place)")


def zb_kid_h():
    """a 120 cm kid's height in world units here (measured on a kit kid once per shot)"""
    if ZB.get("kid_h"):
        return ZB["kid_h"]
    ZB["kid_h"] = 5.25 * zw_ps()
    return ZB["kid_h"]


def zb_m(col, glow=False):
    c = col if isinstance(col, str) and len(col) == 7 else "#888888"
    return zw_m("zb_" + c[1:] + ("_g" if glow else ""), c, 0.6, emit=c if glow else None, estr=3.0 if glow else 0.0)


def zb_wedge(name, size, pos, rot, M, parent):
    w, d, h = size[0] / 2.0, size[1] / 2.0, size[2]
    verts = [(-w, -d, 0), (w, -d, 0), (w, d, 0), (-w, d, 0), (-w, d, h), (w, d, h)]
    faces = [(0, 1, 2, 3), (3, 2, 5, 4), (0, 4, 5, 1), (0, 3, 4), (1, 5, 2)]
    me = D.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    ob = D.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    ob.data.materials.append(M)
    ob.parent = parent
    ob.location = (pos[0], pos[1], pos[2] - h / 2.0)
    ob.rotation_euler = tuple(math.radians(a) for a in rot)
    return ob


def zb_shape(n, k, sh, parent):
    t, s, p, r = sh["type"], sh["size"], sh["pos"], sh["rot"]
    M = zb_m(sh.get("color"), sh.get("glow"))
    nm = "zb%d_%d" % (n, k)
    if t == "box":
        return box(nm, tuple(s), tuple(p), M, min(0.04, 0.1 * min(s)), rot=tuple(r), parent=parent)
    if t == "ball":
        return sphere(nm, 0.5, tuple(p), M, tuple(s), parent=parent, seg=16, rot=tuple(r))
    if t == "wedge":
        return zb_wedge(nm, s, p, r, M, parent)
    if t in ("cylinder", "disc", "cone"):
        o = cyl(nm, 0.5, 1.0, (0, 0, 0), M, 20, rot=(0, 0, 0), parent=parent, r2=0.0 if t == "cone" else None)
        o.scale = (s[0], s[1], s[2])
        o.location = (p[0], p[1], p[2])
        o.rotation_euler = tuple(math.radians(a) for a in r)
        return o
    return box(nm, tuple(s), tuple(p), M, 0.02, rot=tuple(r), parent=parent)


def zb_prop(spec, loc=(0.0, 0.0, 0.0), name=None):
    """a prop from its shapes at its REAL size (its largest side = real_size_cm against a 120 cm kid)"""
    ZB["n"] += 1
    n = ZB["n"]
    nm = name or spec.get("name", "thing")
    r = empty("zt_%s_%d" % (nm[:20], 9000 + n), (float(loc[0]), float(loc[1]), float(loc[2]) if len(loc) > 2 else 0.0), None)
    lo, hi = [1e9, 1e9, 1e9], [-1e9, -1e9, -1e9]
    for k, sh in enumerate(spec.get("shapes", [])[:40]):
        try:
            zb_shape(n, k, sh, r)
        except Exception as e:
            print("ZW_LOOK|builder|shape %d of %s skipped: %s" % (k, nm, str(e)[:80]))
            continue
        for a in range(3):
            lo[a] = min(lo[a], sh["pos"][a] - sh["size"][a] / 2.0)
            hi[a] = max(hi[a], sh["pos"][a] + sh["size"][a] / 2.0)
    big = max(1e-3, max(hi[a] - lo[a] for a in range(3)))
    s = (float(spec.get("real_size_cm", 30.0)) / ZB_KID_CM) * zb_kid_h() / big
    r.scale = (s, s, s)
    # the base on the ground (or the table): the lowest shape at the root's z
    for ch in r.children:
        ch.location.z -= lo[2] if spec.get("hold") not in ("in_sky", "hanging", "on_wall") else 0.0
    r["zb_spec"] = nm
    r["zb_h"] = (hi[2] - lo[2]) * s
    ZB["built"][nm] = r
    return r


def zb_hold(ch, thing, spec, t=0.0):
    """the prop attached the way it is used"""
    hold = spec.get("hold", "on_ground")
    if thing is None or ch is None:
        return thing
    if hold == "one_hand":
        zw_grab(ch, t, thing)
    elif hold == "two_hands":
        zs_upd(t)
        p = za_here(ch, t)
        f = zs_fwd(ch, t)
        ch.pose(t, armL=(70, 0, -22), armR=(70, 0, -22))
        thing.location = (p.x + f.x * 0.9 * zm_s(ch), p.y + f.y * 0.9 * zm_s(ch), 1.9 * zm_s(ch))
        zs_stick(thing, ch.hip if hasattr(ch, "hip") else ch.root, t)
    elif hold in ("worn_head", "worn_face"):
        zs_upd(t)
        hc, hlo, hhi = zs_bbox(ch.head)
        f = zs_fwd(ch, t)
        if hold == "worn_head":
            thing.location = (hc.x, hc.y, hhi.z - 0.15 * zm_s(ch))
        else:
            thing.location = (hc.x + f.x * 0.74 * zm_s(ch), hc.y + f.y * 0.74 * zm_s(ch), hc.z)   # (on the face, not inside the head: its radius is 0.62)
        thing.rotation_euler = (0.0, 0.0, math.radians(zm_yaw_at(ch, t)))
        zs_stick(thing, ch.head, t)
    elif hold in ("worn_body", "worn_back"):
        zs_upd(t)
        tc = zs_bbox(ch.torso)[0]
        f = zs_fwd(ch, t)
        k = 0.55 if hold == "worn_body" else -0.6
        thing.location = (tc.x + f.x * k * zm_s(ch), tc.y + f.y * k * zm_s(ch), tc.z - 0.4 * zm_s(ch))
        thing.rotation_euler = (0.0, 0.0, math.radians(zm_yaw_at(ch, t)))
        zs_stick(thing, ch.torso, t)
    elif hold == "ridden":
        zs_upd(t)
        top = thing.matrix_world.translation.z + float(thing.get("zb_h", 2.0)) * 0.78
        ch.pose(t, loc=(thing.matrix_world.translation.x, thing.matrix_world.translation.y, top), hipz=-0.6, legL=(80, 22), legR=(80, 22))
    return thing


# ---------------------------------------------------------------- CHARACTERS
ZB_CLOTHES_OVER = {"coat": ((2.15, 1.15, 2.6), (0, 0, 0.75)), "overalls": ((1.6, 0.12, 1.4), (0, -0.56, 0.5)), "dress": None, "spacesuit": ((2.2, 1.2, 2.1), (0, 0, 1.0))}


def zb_character(spec, loc, rot, t0, extra_props=None):
    kid = spec.get("age") in ("kid", "teen")
    look = {"name": spec.get("name", "X"), "kid": kid, "skin": spec.get("skin"), "shirt": spec.get("shirt"), "pants": spec.get("pants"),
            "hair": spec.get("hair", "short"), "hair_color": spec.get("hair_color"), "face": spec.get("face", "kid")}
    ch = zw_person(look["name"], look, loc, rot, t0)
    k = float(spec.get("height_cm", 120.0)) / ZB_KID_CM / (1.0 if kid else 1.15)
    s = ch.root.scale
    ch.root.scale = (s[0] * k, s[1] * k, s[2] * k)
    cl = spec.get("clothes", "tshirt")
    M = zb_m(spec.get("shirt", "#888888"))
    if cl in ZB_CLOTHES_OVER and ZB_CLOTHES_OVER[cl] is not None and hasattr(ch, "torso"):
        size, off = ZB_CLOTHES_OVER[cl]
        box(ch.name + "_clothes", size, off, M, 0.06, parent=ch.torso)
    if cl == "dress" and hasattr(ch, "hip"):
        cyl(ch.name + "_skirt", 1.25, 1.6, (0, 0, -0.75), zb_m(spec.get("pants", "#aa3366")), 16, parent=ch.hip, r2=0.95)
    if cl == "robot_body":
        Mm = zw_m("zb_robot", "#b8c2cc", 0.25, 0.8)
        for o in list(ch.root.children_recursive):
            if o.type == "MESH" and not o.name.endswith("_head"):
                for sl in o.material_slots:
                    sl.material = Mm
    for (aspec, worn) in (extra_props or []):
        try:
            th = zb_prop(aspec, loc)
            zb_hold(ch, th, dict(aspec, hold=worn), t0)
        except Exception as e:
            print("ZW_LOOK|builder|accessory skipped: %s" % str(e)[:100])
    return ch


# ---------------------------------------------------------------- MOVES
def zb_move(ch, spec, t0, t1=None, carry=None):
    """key poses over time (clamped joints already), the body travelling forward for real, blended in and out"""
    if ch is None:
        return ch
    dur = float(spec.get("duration_s", 2.0))
    t1 = t1 if t1 is not None else t0 + dur
    keys = spec.get("keys", [])
    zm_hold(ch, t0, root=False)
    reps = max(1, int((t1 - t0) / dur)) if spec.get("loop") else 1
    span = (t1 - t0) / reps
    for r in range(reps):
        for k in keys:
            t = t0 + r * span + float(k["t"]) * span
            kw = {}
            for j in ("armL", "armR", "legL", "legR"):
                if j in k["pose"]:
                    kw[j] = tuple(k["pose"][j])
            for j in ("head", "torso"):
                if j in k["pose"]:
                    kw[j] = tuple(k["pose"][j])
            if "hipz" in k["pose"]:
                kw["hipz"] = max(-1.0, min(0.15, float(k["pose"]["hipz"])))
            if kw:
                ch.pose(t, **kw)
    tr = float(spec.get("travel_m", 0.0))
    if tr > 0.05:
        p = za_here(ch, t0)
        f = zs_fwd(ch, t0)
        d = tr * zb_kid_h() / 1.2
        ch.pose(t0, loc=tuple(p), interp="LINEAR")
        ch.pose(t1, loc=tuple(p + f * d), interp="LINEAR")
        tt, k = t0 + 0.15, 0
        while tt < t1 - 0.1:
            sg = 1 if k % 2 == 0 else -1
            ch.pose(tt, legL=(22 * sg, 0), legR=(-22 * sg, 0))
            tt += 0.3
            k += 1
    if not spec.get("loop"):
        ch.pose(t1 + 0.35, armL=(0, 4), armR=(0, 4), torso=(0, 0, 0), hipz=0.0)
    return ch


# ---------------------------------------------------------------- PLACES
ZB_LIGHT = {"warm": ((1.0, 0.82, 0.6), 1.2), "cool": ((0.75, 0.85, 1.0), 1.1), "dim": ((1.0, 0.74, 0.5), 0.9), "bright": ((1.0, 0.97, 0.92), 1.6),
            "daylight": ((1.0, 0.96, 0.9), 1.5), "night": ((0.5, 0.6, 1.0), 0.3)}


def zb_place(spec, props=None):
    """a shell (floor, back / left / right walls, the front open to the camera), a door, windows, the light, the furniture
    (built props or library things), named zones. Metres -> units: a 120 cm kid's height"""
    u = zb_kid_h() / 1.2
    ZB["unit"] = u
    w, dpt, h = [float(v) * u for v in spec.get("size_m", [6, 5, 3])]
    kind = spec.get("kind", "room")
    Mf = zb_m(spec.get("floor", "#7a6a5a"))
    if kind == "water":
        Mf = zw_m("zb_water", "#2f6f9a", 0.08, 0.0)
        box("zb_water", (w * 4, dpt * 4, 0.2), (0, dpt * 1.5, -0.1), Mf, 0.0)
        box("zb_shore", (w * 4, dpt * 0.6, 0.6), (0, dpt * 3.2, 0.1), zb_m("#5d8a4a"), 0.0)
    else:
        box("zb_floor", (w + 0.4, dpt + 0.4, 0.2), (0, dpt / 2.0, -0.1), Mf, 0.0)
    if kind in ("room", "underground"):
        Mw = zb_m(spec.get("walls", "#c9b8a0"))
        box("zb_wall_back", (w, 0.3, h), (0, dpt + 0.15, h / 2.0), Mw, 0.0)
        box("zb_wall_l", (0.3, dpt, h), (-w / 2.0 - 0.15, dpt / 2.0, h / 2.0), Mw, 0.0)
        box("zb_wall_r", (0.3, dpt, h), (w / 2.0 + 0.15, dpt / 2.0, h / 2.0), Mw, 0.0)
        if spec.get("ceiling") or kind == "underground":
            box("zb_ceiling", (w + 0.6, dpt + 0.6, 0.3), (0, dpt / 2.0, h + 0.15), Mw, 0.0)
        dr = spec.get("door")
        if dr:
            x = float(dr.get("x", 0.0)) * u
            if dr.get("wall") == "back":
                box("zb_door", (1.0 * u, 0.12, 2.1 * u), (x, dpt, 1.05 * u), zb_m("#6b4a2e"), 0.02)
            else:
                sx = -1.0 if dr.get("wall") == "left" else 1.0
                box("zb_door", (0.12, 1.0 * u, 2.1 * u), (sx * w / 2.0, min(dpt - 0.6 * u, max(0.6 * u, x + dpt / 2.0)), 1.05 * u), zb_m("#6b4a2e"), 0.02)
        for k, wn in enumerate(spec.get("windows", []) or []):
            x = float(wn.get("x", 0.0)) * u
            Mg = zw_m("zb_glass", "#bfe3ff", 0.1, emit="#d8efff", estr=1.2 if kind != "underground" else 0.0)
            if wn.get("wall") == "back":
                box("zb_win%d" % k, (1.2 * u, 0.1, 1.0 * u), (x, dpt - 0.05, 1.6 * u), Mg, 0.0)
            else:
                sx = -1.0 if wn.get("wall") == "left" else 1.0
                box("zb_win%d" % k, (0.1, 1.2 * u, 1.0 * u), (sx * (w / 2.0 - 0.05), dpt / 2.0 + x, 1.6 * u), Mg, 0.0)
    col, e = ZB_LIGHT.get(spec.get("light", "warm"), ZB_LIGHT["warm"])
    light("zb_key", "AREA", (w * 0.25, -dpt * 0.4, h * 1.1), 700.0 * e * u * u / 4.0, col, max(w, dpt) * 0.5, target=(0, dpt * 0.45, 0))
    light("zb_fill", "AREA", (-w * 0.4, dpt * 0.2, h * 0.9), 220.0 * e * u * u / 4.0, col, max(w, dpt) * 0.4, target=(0, dpt * 0.5, 0))
    zw_world([(0.0, (col[0] * 0.25 * e, col[1] * 0.25 * e, col[2] * 0.3 * e)), (1.0, (col[0] * 0.12 * e, col[1] * 0.12 * e, col[2] * 0.15 * e))], col, 0.35 * e)
    for f in spec.get("furniture", []) or []:
        p = f.get("pos", [0, 0])
        loc = (float(p[0]) * u, float(p[1]) * u, 0.0)
        built = (props or {}).get(f.get("name"))
        try:
            if built is not None:
                th = zb_prop(built, loc, f.get("name"))
            elif f.get("library"):
                th = zw_thing(f["library"], loc, size=zw_tsize(f["library"], 1.2))
            else:
                continue
            th.rotation_euler[2] = math.radians(float(f.get("rot", 0.0)))
        except Exception as e:
            print("ZW_LOOK|builder|furniture %s skipped: %s" % (f.get("name"), str(e)[:100]))
    ZB["zones"] = {z["name"]: [float(v) * u for v in z["rect"]] for z in spec.get("zones", []) or []}
    return {"w": w, "d": dpt, "h": h, "u": u}



def zb_mesh_pts(objs):
    bpy.context.view_layer.update()
    out = []
    for ob in objs:
        if ob is None:
            continue
        root = ob.root if hasattr(ob, "root") else ob
        for m in [root] + list(root.children_recursive):
            if m.type == "MESH" and not m.hide_render and max(m.scale) > 0.001:
                out += [m.matrix_world @ Vector(c) for c in m.bound_box]
    return out


def zb_frame(objs, t0, t1, lens=30.0, margin=1.3, front=None, high=0.45):
    """a camera in front of these objects' real outline: the whole box in the 9:16 frame with a margin"""
    zs_upd((t0 + t1) / 2.0)
    P = zb_mesh_pts(objs)
    if not P:
        return None
    lo = Vector((min(q.x for q in P), min(q.y for q in P), min(q.z for q in P)))
    hi = Vector((max(q.x for q in P), max(q.y for q in P), max(q.z for q in P)))
    c = (lo + hi) / 2.0
    f = front if front is not None else Vector((0.0, -1.0, 0.0))
    side = Vector((-f.y, f.x, 0.0))
    W = max(abs((q - c).dot(side)) for q in P) * 2.0
    H = hi.z - lo.z
    tv = 12.0 / lens
    th = tv * 9.0 / 16.0
    D = max(H * margin / 2.0 / tv, W * margin / 2.0 / th, 3.0) + max(abs((q - c).dot(f)) for q in P)
    loc = c + f * D + Vector((0.0, 0.0, H * (high - 0.5) + 0.0))
    cam = Cam()
    cam.key(t0, tuple(loc + f * D * 0.04), tuple(c), lens=lens)
    cam.key(t1, tuple(loc), tuple(c), lens=lens)
    return cam

# ---------------------------------------------------------------- A PART C STILL
def zb_where(S, p):
    """a place position [x, y] in metres -> world: a built place's own frame, or a library place's stage frame"""
    if S.get("place_built"):
        u = ZB.get("unit", 1.0)
        return Vector((float(p[0]) * u, float(p[1]) * u, 0.0))
    st_c, st_d, st_r, st_rot = zw_stage(S["place_library"])
    u = zb_kid_h() / 1.2
    return Vector((st_c.x, st_c.y, 0.0)) + st_r * float(p[0]) * u + st_d * float(p[1]) * u


def zb_scene(S, t0, t1):
    """the place, the cast, the props, the moves, the faces, a camera framing the subjects (all from checked data)"""
    ZB["kid_h"] = None
    if S.get("place_built"):
        ZW_T.clear()
        ZW_T.update({"time": S.get("time", "day"), "_place": "built"})
        info = zb_place(S["place_built"], S.get("props_built"))
        front = Vector((0.0, -1.0, 0.0))
    else:
        zw_build(S["place_library"], t0 - 0.3, t1 + 0.3, {"time": S.get("time", "day"), "faces": "dot", "busy": "empty", "walkers": "none", "cars": "parked", "extras": []})
        st_c, st_d, st_r, st_rot = zw_stage(S["place_library"])
        front = -st_d
    cast = {}
    for c in S.get("characters", []):
        pos = zb_where(S, c.get("pos", [0, 1]))
        look_at = c.get("face_to")
        yaw = math.degrees(math.atan2(front.x, -front.y))
        if c.get("built"):
            ch = zb_character(c["built"], tuple(pos), yaw, t0, [(a, a.get("hold", "worn_head")) for a in c.get("accessories_built", [])])
        else:
            ch = zw_person(c["name"], c.get("look", {"name": c["name"], "kid": True}), tuple(pos), yaw, t0)
        if c.get("rot") is not None:
            ch.pose(t0 - 0.5, rot=yaw + float(c["rot"]))
        cast[c["name"]] = ch
        if c.get("feel"):
            zw_emote(ch, t0, t1, ZS_FEEL_FACE.get(c["feel"], c["feel"]))
    things = {}
    for pr in S.get("props", []):
        spec = pr.get("built")
        at = pr.get("at", {})
        pos = zb_where(S, at.get("pos", [0, 1])) if at.get("pos") else Vector((0.0, 0.0, 0.0))
        if at.get("z") is not None:
            pos.z = float(at["z"]) * ZB.get("unit", zb_kid_h() / 1.2)
        try:
            th = zb_prop(spec, tuple(pos), pr["name"]) if spec else zw_thing(pr.get("library", "box"), tuple(pos), size=zw_tsize(pr.get("library", "box"), 1.2))
        except Exception as e:
            print("ZW_LOOK|builder|prop %s skipped: %s" % (pr.get("name"), str(e)[:100]))
            continue
        things[pr["name"]] = th
        who = cast.get(at.get("holder"))
        if who is not None:
            zb_hold(who, th, spec or {"hold": "one_hand"}, t0)
    for c in S.get("characters", []):
        ch = cast.get(c["name"])
        mv = c.get("move_built")
        if ch is not None and mv:
            zb_move(ch, mv, t0 - 0.4, t1 + 0.6)
        elif ch is not None and c.get("pose") in ("sit", "cheer", "point", "wave", "reach", "hands_head"):
            try:
                if c["pose"] == "sit":
                    zw_sit(ch, t0 - 0.5)
                elif c["pose"] == "cheer":
                    zm_cheer(ch, t0 - 0.4)
                else:
                    ch.act(t0 - 0.3, c["pose"])
            except Exception as e:
                print("ZW_LOOK|builder|pose skipped: %s" % str(e)[:80])
    subj = [cast[n] for n in (S.get("camera", {}).get("subjects") or list(cast.keys())) if n in cast]
    sth = [things[n] for n in (S.get("camera", {}).get("things") or []) if n in things]

    def pts_at(t):
        out = []
        for ch in subj:
            out += zw_vpts([ch.root])
        for th in sth:
            out += zw_pts([th]) or []
        return out
    return zb_frame(subj + sth, t0, t1, lens=28.0, margin=1.25, front=front)
def zb_test_piece(kind, spec, t0, t1, extra=None):
    """one cheap test still: the new piece alone next to a 120 cm kid on a plain floor in daylight"""
    ZB["kid_h"] = None
    ZW_T.clear()
    ZW_T.update({"time": "day", "_place": "built"})
    if kind == "place":
        info = zb_place(spec, extra or {})
        u = info["u"]
        kid = zw_person("Kid", {"name": "Kid", "kid": True, "skin": "#F2C9A0", "shirt": "#d62a1e", "pants": "#2f3f7a", "hair": "spiky", "hair_color": "#3a2a1e", "face": "kid"}, (0.0, info["d"] * 0.4, 0.0), 0.0, t0)
        cam = Cam()
        cam.key(t0, (info["w"] * 0.15, -info["d"] * 0.55, info["h"] * 0.75), (0.0, info["d"] * 0.55, info["h"] * 0.3), lens=18)
        cam.key(t1, (info["w"] * 0.15, -info["d"] * 0.5, info["h"] * 0.75), (0.0, info["d"] * 0.55, info["h"] * 0.3), lens=18)
        return cam
    zb_place({"name": "test", "kind": "outdoor", "size_m": [10, 8, 3], "floor": "#8d8a84", "walls": "#cccccc", "light": "daylight", "furniture": [], "zones": []})
    u = ZB["unit"]
    kid = zw_person("Kid", {"name": "Kid", "kid": True, "skin": "#F2C9A0", "shirt": "#d62a1e", "pants": "#2f3f7a", "hair": "spiky", "hair_color": "#3a2a1e", "face": "kid"}, (-0.9 * u, 3.0 * u, 0.0), 0.0, t0)
    subj, things = [kid], []
    small = False
    if kind == "prop":
        # tested THE WAY IT IS USED: in the hand, worn, on a stand at table height, up high, or beside on the ground
        hold = spec.get("hold", "on_ground")
        th = zb_prop(spec, (0.7 * u, 3.0 * u, 0.0))
        small = float(spec.get("real_size_cm", 50.0)) < 60.0
        if hold in ("one_hand", "two_hands", "worn_head", "worn_face", "worn_body", "worn_back"):
            zb_hold(kid, th, spec, t0 - 0.3)
            if hold == "one_hand":
                kid.pose(t0 - 0.1, armR=(70, -8))
        elif hold == "on_table":
            box("zb_stand", (0.9 * u, 0.7 * u, 0.7 * u), (0.7 * u, 3.0 * u, 0.35 * u), zb_m("#8a6a4a"), 0.02)
            th.location.z = 0.7 * u
        elif hold in ("in_sky", "hanging", "on_wall"):
            th.location.z = 1.5 * u
        things.append(th)
    elif kind == "character":
        ch = zb_character(spec, (0.8 * u, 3.0 * u, 0.0), 0.0, t0, extra or [])
        subj.append(ch)
    elif kind == "move":
        zb_move(kid, spec, t0 - 0.2, t1 + 0.2)
        zs_upd((t0 + t1) / 2.0)
        print("ZW_LOOK|builder|dbgmove keys %d t0 %.2f t1 %.2f armR %s hip %.2f" % (len(spec.get("keys", [])), t0, t1, str([round(math.degrees(v)) for v in kid.piv("armR").rotation_euler]), kid.hip.location.z))

    def pts_at(t):
        out = []
        for ch in subj:
            out += zw_vpts([ch.root])
        for th in things:
            out += zw_pts([th]) or []
        return out
    if kind == "move":
        # a three-quarter view: an arm reaching forward or a bent knee does not point at the lens
        return zb_frame(subj, t0, t1, lens=30.0, margin=1.35, front=zs_rot(Vector((0.0, -1.0, 0.0)), 55))
    if small and things:
        # a small thing: the kid's upper body and the thing fill the frame
        return zb_frame([kid.head, kid.torso] + things, t0, t1, lens=35.0, margin=1.6)
    return zb_frame(subj + things, t0, t1, lens=30.0, margin=1.35)


# ===== END OF THE BUILDER ============================================================================================
