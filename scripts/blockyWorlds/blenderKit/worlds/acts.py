# ===== ZYVO ACTIONS + THINGS (scripts/blockyWorlds/blenderKit/worlds/acts.py, owner 2026-11-21 round 2) ============
# Pasted right AFTER worlds.py (and actions/actions.py) into every shots.py; no imports (the kit names + zw_* helpers).
# The director v2's shot cards (director2.mjs) compile (cards.mjs) into these calls. A target (`to`, `at`, `frm`) may be a
# Char, a Blender object or an (x, y[, z]) tuple; a bad target never raises (a sensible fallback instead).
#   zw_walk_to(ch, t0, t1, to, face_to=None)   walk to a spot / a person (stops in front) / a thing
#   zw_run_away(ch, t0, t1, frm, dist=10.0)     run away from frm (terrified face)
#   zw_fall(ch, t, back=True)                    fall down at t and stay down
#   zw_sit(ch, t, seat=None)                     sit down at t (on the seat's top, else the ground)
#   zw_point(ch, t, at)                          turn to `at` and point at it
#   zw_stomp(ch, t, n=2)                         stomp a foot n times
#   zw_grab(ch, t, obj)                          grab obj at t (it follows the right hand after)
#   zw_throw(ch, t0, t1, obj, to)                throw obj along an arc, landing at `to` at t1
#   zw_hug(a, b, t0, t1)                         a walks to b, they hug
#   zw_reach(ch, t, at)                          reach toward `at`
#   zw_pop(obj, t, scale=1.0)                    obj pops in at t (invisible before)
#   zw_grow_obj(obj, t0, t1, s0, s1)            obj grows / shrinks (its base stays on the ground)
#   zw_rain(kind, t0, t1, area, n=40, seed=3)    things of `kind` fall from the sky over area and stay
#   zw_climb_out(m, t0, t1, hole=(0, 0))         a monster climbs out of a drain at `hole`
#   zw_follow(a, b, t0, t1, gap=3.0)            a follows b
#   zw_thing(kind, loc, size=1.0, color=None, name=None, coll=None) -> root   a prop (ZW_THINGS), base on the ground

ZT_N = {"n": 0}
ZW_THINGS = ["flower", "daisy", "tulip", "sunflower", "vine", "thorn_vine", "tree_small", "lamp_bulb", "light_bulb",
             "flashlight", "umbrella", "kazoo", "cake", "pencil", "book", "ball", "box", "crate", "sign", "bucket", "bell",
             "phone", "key", "shoe", "hat", "wall_boards", "door", "fridge", "nightlight", "drain_grate", "rock", "star",
             "heart", "coin", "balloon", "candy", "pizza", "bone", "fish", "leaf", "snowflake", "raindrop", "apple", "ice_cream"]


def za_pos(x, default=(0.0, 0.0, 0.0)):
    """a target's world position (Char root / object / tuple)"""
    try:
        if hasattr(x, "root"):
            return Vector(x.root.matrix_world.translation)
        if hasattr(x, "matrix_world"):
            return Vector(x.matrix_world.translation)
        if isinstance(x, (tuple, list)) and len(x) >= 2:
            return Vector((float(x[0]), float(x[1]), float(x[2]) if len(x) > 2 else 0.0))
    except Exception:
        pass
    return Vector(default)


def za_here(ch, t):
    bpy.context.scene.frame_set(F(t))
    return Vector(ch.root.matrix_world.translation)


def za_yaw(frm, to):
    """the kit's yaw (degrees) for a character at frm facing to"""
    d = Vector(to) - Vector(frm)
    if d.length < 1e-4:
        return 0.0
    return math.degrees(math.atan2(d.x, -d.y))


def zw_walk_to(ch, t0, t1, to, face_to=None):
    p0 = za_here(ch, t0)
    p1 = za_pos(to, tuple(p0))
    if hasattr(to, "root") or hasattr(to, "matrix_world"):
        d = p1 - p0
        d.z = 0
        if d.length > 1.6:
            p1 = p0 + d * ((d.length - 1.5) / d.length)   # stop in front of a person / a thing
        else:
            p1 = p0.copy()
    p0.z, p1.z = 0.0, 0.0
    if (p1 - p0).length > 0.2:
        ch.walk(t0, t1, tuple(p0), tuple(p1), rate=2.6)
    if face_to is not None:
        ch.pose(t1 + 0.02, rot=za_yaw(p1, za_pos(face_to)))
    return ch


def zw_run_away(ch, t0, t1, frm, dist=10.0):
    p0 = za_here(ch, t0)
    f = za_pos(frm, tuple(p0 + Vector((0, 1, 0))))
    d = p0 - f
    d.z = 0
    d = d.normalized() if d.length > 1e-3 else Vector((0, -1, 0))
    p1 = p0 + d * dist
    p0.z, p1.z = 0.0, 0.0
    ch.run(t0, t1, tuple(p0), tuple(p1))
    ch.pose(t0 + 0.05, head=(0, -8, 0))
    try:
        zw_emote(ch, t0, t1, "terrified")
    except Exception:
        pass
    return ch


def zw_fall(ch, t, back=True):
    r = ch.root
    r.rotation_euler[0] = 0.0
    r.keyframe_insert("rotation_euler", index=0, frame=F(t))
    r.rotation_euler[0] = math.radians(-84 if back else 84)
    r.keyframe_insert("rotation_euler", index=0, frame=F(t + 0.32))
    z0 = r.location[2]
    r.location[2] = z0
    r.keyframe_insert("location", index=2, frame=F(t))
    r.location[2] = z0 + 0.55 * r.scale[2]
    r.keyframe_insert("location", index=2, frame=F(t + 0.32))
    ch.pose(t + 0.32, armL=(150, 40), armR=(150, 40), legL=(15, 0), legR=(-10, 0))
    return ch


def zw_sit(ch, t, seat=None):
    s = ch.root.scale[2]
    top = 0.0
    if seat is not None:
        try:
            top = zw_top(seat)
            p = za_pos(seat)
            ch.pose(t - 0.2, loc=(p.x, p.y, 0.0))
        except Exception:
            top = 0.0
    hipz = (top / max(0.1, s)) - 2.0 + 0.35
    ch.pose(t - 0.15, hipz=0.0, legL=(0, 0), legR=(0, 0))
    ch.pose(t + 0.2, hipz=hipz, legL=(88, 4), legR=(88, 4), armL=(25, 12), armR=(25, 12), torso=(0, -4, 0))
    return ch


def zw_point(ch, t, at):
    here = za_here(ch, t)
    ch.pose(t, rot=za_yaw(here, za_pos(at, tuple(here + Vector((0, -1, 0))))))
    ch.act(t, "point")
    return ch


def zw_stomp(ch, t, n=2):
    for k in range(int(n)):
        a = t + k * 0.34
        ch.pose(a, legR=(50, 0), hipz=0.12, armL=(20, 18), armR=(20, 18))
        ch.pose(a + 0.16, legR=(0, 0), hipz=-0.18)
        ch.pose(a + 0.28, hipz=0.0)
    return ch


def za_hand(ch, side="R"):
    arm = D.objects.get(ch.name + "_arm" + side)
    if arm is None:
        return Vector(ch.root.matrix_world.translation) + Vector((0, 0, 3.0 * ch.root.scale[2])), None
    return arm.matrix_world @ Vector((0, 0, -1.0)), arm


def zw_grab(ch, t, obj):
    if obj is None:
        return ch
    ch.pose(t - 0.25, armR=(30, -6))
    ch.pose(t, armR=(72, -8))
    ch.pose(t + 0.35, armR=(55, -6))
    sc = bpy.context.scene
    sc.frame_set(F(t))
    hand, arm = za_hand(ch)
    obj.keyframe_insert("location", frame=max(1, F(t) - 1))
    obj.location = hand
    obj.keyframe_insert("location", frame=F(t))
    if arm is not None:
        c = obj.constraints.new("CHILD_OF")
        c.name = "zw_grab"
        c.target = arm
        c.inverse_matrix = arm.matrix_world.inverted()
        c.influence = 0.0
        c.keyframe_insert("influence", frame=max(1, F(t) - 1))
        c.influence = 1.0
        c.keyframe_insert("influence", frame=F(t))
    sc.frame_set(F(t))
    return ch


def zw_throw(ch, t0, t1, obj, to):
    if obj is None:
        return ch
    sc = bpy.context.scene
    ch.pose(t0 - 0.2, armR=(-45, -10))
    ch.pose(t0 + 0.08, armR=(140, -10))
    ch.pose(t0 + 0.35, armR=(40, -6))
    sc.frame_set(F(t0))
    hand, arm = za_hand(ch)
    for c in list(obj.constraints):
        if c.name == "zw_grab":
            c.influence = 1.0
            c.keyframe_insert("influence", frame=max(1, F(t0) - 1))
            c.influence = 0.0
            c.keyframe_insert("influence", frame=F(t0))
    p0 = hand
    p1 = za_pos(to, tuple(hand + Vector((0, 6, 0))))
    p1.z = 0.0
    peak = max(p0.z, p1.z) + 2.5 + 0.15 * (p1 - p0).length
    for k in range(6):
        u = k / 5.0
        q = p0 + (p1 - p0) * u
        q.z = (1 - u) * p0.z + u * p1.z + 4 * u * (1 - u) * (peak - max(p0.z, p1.z))
        obj.location = q
        obj.keyframe_insert("location", frame=F(t0 + (t1 - t0) * u))
    obj.rotation_euler[0] = 0.0
    obj.keyframe_insert("rotation_euler", index=0, frame=F(t0))
    obj.rotation_euler[0] = math.radians(300)
    obj.keyframe_insert("rotation_euler", index=0, frame=F(t1))
    return ch


def zw_hug(a, b, t0, t1):
    pa, pb = za_here(a, t0), za_here(b, t0)
    zx_hug(a, t0, t1, (pb.x, pb.y), (pa.x, pa.y))
    b.pose(t0, rot=za_yaw(pb, pa))
    tm = t0 + min(0.9, 0.55 * (t1 - t0))
    b.pose(tm + 0.05, armL=(85, -28), armR=(85, -28), head=(0, 10, -12))
    b.pose(t1, armL=(80, -32), armR=(80, -32))
    return a


def zw_reach(ch, t, at):
    here = za_here(ch, t)
    ch.pose(t, rot=za_yaw(here, za_pos(at, tuple(here + Vector((0, -1, 0))))))
    ch.act(t, "reach")
    return ch


def zw_pop(obj, t, scale=1.0):
    if obj is None:
        return obj
    s = obj.scale[2] * scale if scale != 1.0 else obj.scale[2]
    obj.scale = (0.001, 0.001, 0.001)
    obj.keyframe_insert("scale", frame=max(1, F(t) - 1))
    obj.scale = (s * 1.18, s * 1.18, s * 1.18)
    obj.keyframe_insert("scale", frame=F(t + 0.16))
    obj.scale = (s, s, s)
    obj.keyframe_insert("scale", frame=F(t + 0.3))
    return obj


def zw_grow_obj(obj, t0, t1, s0, s1):
    if obj is None:
        return obj
    base = obj.scale[2]
    obj.scale = (base * s0,) * 3
    obj.keyframe_insert("scale", frame=F(t0))
    obj.scale = (base * s1,) * 3
    obj.keyframe_insert("scale", frame=F(t1))
    return obj


def zw_rain(kind, t0, t1, area=((-10, 10), (0, 40)), n=40, seed=3):
    rnd = random.Random(seed)
    name = "zt_rainsrc_" + str(kind)
    src = D.collections.get(name)
    if src is None:
        src = collection(name)
        zw_thing(kind, (0, 0, 0), 0.9, coll=src)
        hide_coll_from_layer(src)
    dur = max(0.4, t1 - t0)
    for i in range(int(n)):
        x, y = rnd.uniform(*area[0]), rnd.uniform(*area[1])
        ob = instance("zt_rain_%s_%d" % (kind, i), src, (x, y, 22.0), rot=(0, 0, rnd.uniform(0, 6.28)))
        ts = t0 + rnd.uniform(0.0, 0.55) * dur
        fall = rnd.uniform(0.5, 0.9)
        ob.location = (x, y, rnd.uniform(16.0, 26.0))
        ob.keyframe_insert("location", frame=F(ts))
        ob.location = (x, y, 0.0)
        ob.keyframe_insert("location", frame=F(ts + fall))
    return src


def zw_climb_out(m, t0, t1, hole=(0, 0)):
    s = m.root.scale[2]
    hx, hy = float(hole[0]), float(hole[1])
    Md = zw_m("drainhole", "#0c0d10", 0.9)
    cyl("zt_hole", 1.0 * s, 0.04, (hx, hy, 0.03), Md, 32)
    Mg = zw_m("grate", "#3d434c", 0.4, 0.7)
    for k in range(-3, 4):
        box("zt_grate%d" % (k + 3), (0.12 * s, 1.7 * s, 0.06), (hx + k * 0.26 * s, hy, 0.06), Mg, 0.0)
    H = 5.6 * s
    yaw = math.degrees(m.root.rotation_euler[2])
    m.pose(t0, loc=(hx, hy, -H), rot=yaw, armL=(170, 12), armR=(170, 12))
    m.pose(t0 + (t1 - t0) * 0.55, loc=(hx, hy, -H * 0.35), armL=(150, 30), armR=(150, 30))
    m.pose(t1, loc=(hx, hy, 0.0), armL=(60, 25), armR=(60, 25))
    return m


def zw_follow(a, b, t0, t1, gap=3.0):
    pa = za_here(a, t0)
    pb0, pb1 = za_here(b, t0), za_here(b, t1)
    d = pb1 - pb0
    d.z = 0
    if d.length < 0.3:
        d = pb0 - pa
        d.z = 0
    d = d.normalized() if d.length > 1e-3 else Vector((0, 1, 0))
    to = pb1 - d * gap
    pa.z, to.z = 0.0, 0.0
    a.walk(t0, t1, tuple(pa), tuple(to), rate=2.6)
    return a


# ---------------------------------------------------------------- THINGS (unit height ~1, scaled by size; base at z 0)
def zt_m(nm, col, rough=0.5, metal=0.0, emit=None, estr=0.0):
    return zw_m("zt_" + nm, col, rough, metal, emit=emit, estr=estr)


def zt_flower(r, c, petal, centre="#ffd23f"):
    Ms, Mp, Mc = zt_m("stem", "#3fae49", 0.7), zt_m("petal" + petal[1:], petal, 0.5), zt_m("fc" + centre[1:], centre, 0.5)
    cyl("zt_stem", 0.04, 0.7, (0, 0, 0.35), Ms, 8, parent=r, coll=c)
    sphere("zt_leaf", 0.12, (0.1, 0, 0.3), Ms, (1.6, 0.5, 0.6), parent=r, coll=c, seg=8)
    for k in range(6):
        a = k * math.pi / 3
        sphere("zt_pet%d" % k, 0.13, (math.cos(a) * 0.14, -0.02, 0.8 + math.sin(a) * 0.14), Mp, (1, 0.5, 1), parent=r, coll=c, seg=10)
    sphere("zt_fc", 0.1, (0, -0.05, 0.8), Mc, (1, 0.6, 1), parent=r, coll=c, seg=10)


def zt_build(kind, r, c, col):
    """the primitives of one thing, children of root r, unit size"""
    k = kind
    if k in ("flower", "daisy", "tulip", "sunflower"):
        petal = {"daisy": "#ffffff", "tulip": col or "#ff4f7e", "sunflower": "#ffcc1f"}.get(k, col or "#ff7ab8")
        zt_flower(r, c, petal, "#7a4a20" if k == "sunflower" else "#ffd23f")
        if k == "sunflower":
            r.scale = (r.scale[0] * 1.6,) * 3
    elif k in ("vine", "thorn_vine"):
        Mv = zt_m("vine" + ("t" if k == "thorn_vine" else ""), "#2f8a3a" if k == "vine" else "#3c5a2a", 0.7)
        for j in range(6):
            cyl("zt_vs%d" % j, 0.07, 0.24, (math.sin(j * 1.1) * 0.12, 0, 0.1 + j * 0.16), Mv, 8, rot=(0, 18 * math.sin(j), 0), parent=r, coll=c)
            if k == "thorn_vine":
                cyl("zt_th%d" % j, 0.04, 0.12, (math.sin(j * 1.1) * 0.12 + 0.08, 0, 0.12 + j * 0.16), zt_m("thorn", "#c9b37a", 0.5), 6, rot=(0, 90, 0), parent=r, coll=c, r2=0.0)
            else:
                sphere("zt_vl%d" % j, 0.07, (math.sin(j * 1.1) * 0.12 + 0.09, 0, 0.12 + j * 0.16), zt_m("leafv", "#5fcf4c", 0.7), (1.4, 0.4, 0.8), parent=r, coll=c, seg=8)
    elif k == "tree_small":
        cyl("zt_tr", 0.07, 0.5, (0, 0, 0.25), zt_m("trunk", "#7a5234", 0.9), 8, parent=r, coll=c)
        sphere("zt_tc", 0.32, (0, 0, 0.72), zt_m("leaf", "#4cbf45", 0.85), parent=r, coll=c, seg=12)
    elif k in ("lamp_bulb", "light_bulb", "nightlight"):
        Mb = zt_m("bulb", "#fff6d0", 0.3, emit="#ffd27a", estr=1.6)
        sphere("zt_bulb", 0.3, (0, 0, 0.62), Mb, (1, 1, 1.2), parent=r, coll=c, seg=14)
        cyl("zt_bbase", 0.16, 0.3, (0, 0, 0.22), zt_m("metal", "#9aa3ad", 0.3, 0.8), 12, parent=r, coll=c)
        if k == "nightlight":
            r.scale = (r.scale[0] * 0.6,) * 3
    elif k == "flashlight":
        cyl("zt_fl", 0.12, 0.7, (0, 0, 0.12), zt_m("flash", col or "#2f6fd8", 0.4), 12, rot=(90, 0, 0), parent=r, coll=c)
        cyl("zt_fll", 0.15, 0.05, (0, -0.37, 0.12), zt_m("lens", "#fff6d0", 0.2, emit="#fff2c0", estr=8.0), 12, rot=(90, 0, 0), parent=r, coll=c)
    elif k == "umbrella":
        cyl("zt_ust", 0.025, 0.9, (0, 0, 0.45), zt_m("ustick", "#333333", 0.4), 6, parent=r, coll=c)
        cyl("zt_ucan", 0.55, 0.25, (0, 0, 0.92), zt_m("ucan" + (col or "#e8574a")[1:], col or "#e8574a", 0.5), 16, parent=r, coll=c, r2=0.03)
    elif k == "kazoo":
        cyl("zt_kz", 0.08, 0.45, (0, 0, 0.1), zt_m("kazoo", col or "#ffcf1f", 0.4, 0.3), 12, rot=(0, 90, 0), parent=r, coll=c, r2=0.05)
    elif k == "cake":
        cyl("zt_c1", 0.5, 0.35, (0, 0, 0.18), zt_m("cake1", "#ffb6d0", 0.6), 24, parent=r, coll=c)
        cyl("zt_c2", 0.36, 0.3, (0, 0, 0.5), zt_m("cake2", "#fff3f8", 0.6), 24, parent=r, coll=c)
        for j in range(4):
            cyl("zt_cn%d" % j, 0.025, 0.16, (math.cos(j * 1.57) * 0.2, math.sin(j * 1.57) * 0.2, 0.73), zt_m("candle", "#7fd3ff", 0.5), 6, parent=r, coll=c)
            sphere("zt_cf%d" % j, 0.03, (math.cos(j * 1.57) * 0.2, math.sin(j * 1.57) * 0.2, 0.83), zt_m("flame", "#ffd27a", 0.3, emit="#ffb040", estr=5.0), parent=r, coll=c, seg=6)
    elif k == "pencil":
        cyl("zt_pc", 0.06, 0.8, (0, 0, 0.4), zt_m("pencil", "#ffcf1f", 0.5), 6, parent=r, coll=c)
        cyl("zt_pt", 0.06, 0.15, (0, 0, 0.87), zt_m("wood", "#e8c08a", 0.6), 6, parent=r, coll=c, r2=0.0)
    elif k == "book":
        box("zt_bk", (0.6, 0.15, 0.8), (0, 0, 0.4), zt_m("book" + (col or "#2f86fd")[1:], col or "#2f86fd", 0.6), 0.02, parent=r, coll=c)
    elif k == "ball":
        sphere("zt_ball", 0.45, (0, 0, 0.45), zt_m("ball" + (col or "#ff4f4f")[1:], col or "#ff4f4f", 0.4), parent=r, coll=c, seg=16)
    elif k in ("box", "crate"):
        box("zt_bx", (1.0, 1.0, 0.9), (0, 0, 0.45), zt_m("box" if k == "box" else "crate", "#c8955a" if k == "box" else "#a0703e", 0.8), 0.04, parent=r, coll=c)
        box("zt_tape", (1.02, 0.18, 0.92), (0, 0, 0.45), zt_m("tape", "#e8d2a0", 0.6), 0.0, parent=r, coll=c)
    elif k == "sign":
        box("zt_sp", (0.08, 0.08, 0.9), (0, 0, 0.45), zt_m("post", "#6b4a3a", 0.8), 0.0, parent=r, coll=c)
        box("zt_sb", (0.9, 0.06, 0.45), (0, -0.05, 0.85), zt_m("signb", col or "#ffffff", 0.5), 0.02, parent=r, coll=c)
    elif k == "bucket":
        cyl("zt_bu", 0.4, 0.6, (0, 0, 0.3), zt_m("bucket", col or "#4aa5e8", 0.4, 0.3), 16, parent=r, coll=c, r2=0.32)
    elif k == "bell":
        cyl("zt_be", 0.4, 0.6, (0, 0, 0.32), zt_m("bell", "#ffcf1f", 0.3, 0.8), 16, parent=r, coll=c, r2=0.15)
    elif k == "phone":
        box("zt_ph", (0.32, 0.06, 0.6), (0, 0, 0.3), zt_m("phone", "#222222", 0.3), 0.03, parent=r, coll=c)
        box("zt_phs", (0.27, 0.01, 0.5), (0, -0.035, 0.31), zt_m("screen", "#7fd3ff", 0.2, emit="#7fd3ff", estr=1.5), 0.0, parent=r, coll=c)
    elif k == "key":
        cyl("zt_kr", 0.18, 0.05, (0, 0, 0.6), zt_m("gold", "#ffcf1f", 0.3, 0.9), 12, rot=(90, 0, 0), parent=r, coll=c)
        box("zt_ks", (0.07, 0.05, 0.5), (0, 0, 0.25), zt_m("gold", "#ffcf1f", 0.3, 0.9), 0.0, parent=r, coll=c)
    elif k == "shoe":
        box("zt_sh", (0.35, 0.8, 0.3), (0, 0, 0.15), zt_m("shoe" + (col or "#e8574a")[1:], col or "#e8574a", 0.6), 0.08, parent=r, coll=c)
        box("zt_sl", (0.37, 0.82, 0.06), (0, 0, 0.03), zt_m("sole", "#ffffff", 0.6), 0.02, parent=r, coll=c)
    elif k == "hat":
        cyl("zt_hb", 0.55, 0.06, (0, 0, 0.03), zt_m("hat" + (col or "#2b2b2b")[1:], col or "#2b2b2b", 0.6), 20, parent=r, coll=c)
        cyl("zt_ht", 0.34, 0.55, (0, 0, 0.32), zt_m("hat" + (col or "#2b2b2b")[1:], col or "#2b2b2b", 0.6), 20, parent=r, coll=c)
    elif k == "wall_boards":
        for j in range(5):
            box("zt_wb%d" % j, (0.2, 0.08, 1.0), (-0.44 + j * 0.22, 0, 0.5), zt_m("board%d" % (j % 2), ["#b07a4a", "#9a6a3e"][j % 2], 0.8), 0.01, parent=r, coll=c)
        box("zt_wbx", (1.1, 0.1, 0.12), (0, -0.05, 0.7), zt_m("board1", "#9a6a3e", 0.8), 0.01, parent=r, coll=c)
    elif k == "door":
        box("zt_dr", (0.55, 0.08, 1.0), (0, 0, 0.5), zt_m("door" + (col or "#3a6b5e")[1:], col or "#3a6b5e", 0.5), 0.02, parent=r, coll=c)
        sphere("zt_dk", 0.04, (0.2, -0.06, 0.5), zt_m("gold", "#ffcf1f", 0.3, 0.9), parent=r, coll=c, seg=8)
    elif k == "fridge":
        box("zt_fr", (0.55, 0.55, 1.0), (0, 0, 0.5), zt_m("fridge", "#f4f6f8", 0.3, 0.2), 0.04, parent=r, coll=c)
        box("zt_frh", (0.03, 0.04, 0.3), (0.2, -0.29, 0.7), zt_m("metal", "#9aa3ad", 0.3, 0.8), 0.0, parent=r, coll=c)
    elif k == "drain_grate":
        cyl("zt_dg", 0.6, 0.04, (0, 0, 0.02), zt_m("drainhole", "#0c0d10", 0.9), 24, parent=r, coll=c)
        for j in range(-2, 3):
            box("zt_dgb%d" % (j + 2), (0.08, 1.05, 0.05), (j * 0.2, 0, 0.05), zt_m("grate", "#3d434c", 0.4, 0.7), 0.0, parent=r, coll=c)
    elif k == "rock":
        sphere("zt_rk", 0.5, (0, 0, 0.35), zt_m("rock", "#8a8f96", 0.9), (1.2, 1.0, 0.75), parent=r, coll=c, seg=8)
    elif k in ("star", "snowflake"):
        Mst = zt_m("star" if k == "star" else "snow", "#ffd23f" if k == "star" else "#e8f6ff", 0.3, emit="#ffd23f" if k == "star" else None, estr=1.5 if k == "star" else 0.0)
        for j in range(5 if k == "star" else 6):
            a = j * (2 * math.pi / (5 if k == "star" else 6))
            box("zt_sa%d" % j, (0.12, 0.08, 0.5), (math.sin(a) * 0.2, 0, 0.5 + math.cos(a) * 0.2), Mst, 0.02, rot=(0, math.degrees(a), 0), parent=r, coll=c)
    elif k == "heart":
        Mh = zt_m("heart", "#ff3b6b", 0.4)
        sphere("zt_h1", 0.25, (-0.17, 0, 0.7), Mh, parent=r, coll=c, seg=12)
        sphere("zt_h2", 0.25, (0.17, 0, 0.7), Mh, parent=r, coll=c, seg=12)
        cyl("zt_h3", 0.38, 0.5, (0, 0, 0.42), Mh, 4, rot=(0, 0, 45), parent=r, coll=c, r2=0.0)
    elif k == "coin":
        cyl("zt_cn", 0.4, 0.08, (0, 0, 0.4), zt_m("gold", "#ffcf1f", 0.3, 0.9), 20, rot=(90, 0, 0), parent=r, coll=c)
    elif k == "balloon":
        sphere("zt_bl", 0.35, (0, 0, 0.75), zt_m("balloon" + (col or "#ff4f7e")[1:], col or "#ff4f7e", 0.3), (1, 1, 1.2), parent=r, coll=c, seg=14)
        cyl("zt_bls", 0.01, 0.4, (0, 0, 0.2), zt_m("string", "#ffffff", 0.6), 4, parent=r, coll=c)
    elif k == "candy":
        sphere("zt_cd", 0.3, (0, 0, 0.3), zt_m("candy", col or "#ff6ad5", 0.3), (1.4, 1, 1), parent=r, coll=c, seg=12)
    elif k == "pizza":
        cyl("zt_pz", 0.55, 0.06, (0, 0, 0.04), zt_m("crust", "#e0a050", 0.7), 20, parent=r, coll=c)
        cyl("zt_pzs", 0.48, 0.03, (0, 0, 0.08), zt_m("sauce", "#e8402a", 0.6), 20, parent=r, coll=c)
    elif k == "bone":
        box("zt_bn", (0.6, 0.12, 0.12), (0, 0, 0.12), zt_m("bone", "#f4efe0", 0.6), 0.04, parent=r, coll=c)
        for sx in (-1, 1):
            sphere("zt_bne%d" % sx, 0.1, (sx * 0.32, 0, 0.12), zt_m("bone", "#f4efe0", 0.6), (1, 1.5, 1), parent=r, coll=c, seg=8)
    elif k == "fish":
        sphere("zt_fs", 0.3, (0, 0, 0.3), zt_m("fish", col or "#ff9a3c", 0.4), (1.6, 0.5, 0.9), parent=r, coll=c, seg=12)
        cyl("zt_ft", 0.2, 0.25, (0.55, 0, 0.3), zt_m("fish", col or "#ff9a3c", 0.4), 3, rot=(0, 90, 0), parent=r, coll=c, r2=0.0)
    elif k == "leaf":
        sphere("zt_lf", 0.3, (0, 0, 0.3), zt_m("leaf", "#5fcf4c", 0.7), (1.2, 0.15, 0.7), parent=r, coll=c, seg=10)
    elif k == "raindrop":
        sphere("zt_rd", 0.2, (0, 0, 0.25), zt_m("drop", "#7fc4ff", 0.1, emit="#7fc4ff", estr=0.6), (1, 1, 1.4), parent=r, coll=c, seg=10)
    elif k == "apple":
        sphere("zt_ap", 0.35, (0, 0, 0.35), zt_m("apple", "#e8302a", 0.4), parent=r, coll=c, seg=14)
        cyl("zt_aps", 0.03, 0.15, (0, 0, 0.75), zt_m("trunk", "#7a5234", 0.9), 6, parent=r, coll=c)
    elif k == "ice_cream":
        cyl("zt_icc", 0.2, 0.55, (0, 0, 0.28), zt_m("cone", "#e0a050", 0.7), 12, parent=r, coll=c, r2=0.02)
        r.rotation_euler[1] = math.radians(180)
        sphere("zt_ics", 0.24, (0, 0, -0.04), zt_m("scoop", col or "#ffb6d0", 0.5), parent=r, coll=c, seg=12)
    else:
        box("zt_unk", (0.8, 0.8, 0.8), (0, 0, 0.4), zt_m("unk", col or "#ff8c2a", 0.5), 0.06, parent=r, coll=c)
        text("zt_unkt", str(kind).upper()[:10], (0, -0.42, 0.45), 0.22, zt_m("bbtffffff", "#ffffff", 0.4), rot=(90, 0, 0), extrude=0.01, coll=c, parent=r)


def zw_thing(kind, loc, size=1.0, color=None, name=None, coll=None):
    """a prop of ZW_THINGS (unknown -> a labelled box), about `size` units tall, its base on the ground at loc"""
    ZT_N["n"] += 1
    r = empty("zt_%s_%d" % (str(kind)[:12], ZT_N["n"]), (float(loc[0]), float(loc[1]), float(loc[2]) if len(loc) > 2 else 0.0), None, coll)
    try:
        zt_build(str(kind), r, coll, color)
    except Exception as e:
        print("zw_thing %s fallback: %s" % (kind, e))
        box("zt_fb%d" % ZT_N["n"], (0.8, 0.8, 0.8), (0, 0, 0.4), zt_m("unk", "#ff8c2a", 0.5), 0.06, parent=r, coll=coll)
    sz = max(0.2, float(size))
    r.scale = (r.scale[0] * sz, r.scale[1] * sz, r.scale[2] * sz)
    if name and kind == "sign":
        text("zt_signt%d" % ZT_N["n"], str(name).upper()[:12], (0, -0.09, 0.85), 0.13, zt_m("signtxt", "#e2405b", 0.4), rot=(90, 0, 0), extrude=0.01, coll=coll, parent=r)
    return r
# ---------------------------------------------------------------- ROUND 2 SCENE CARDS: marks + named poses
# A scene card's START / END frame says where each person stands (a MARK on the place's stage) and how (a POSE).
ZW_MARKS = {
    # (sideways in 2.8-unit steps as the camera sees it, depth into the place)
    "left": (-1, 0.0), "center": (0, 0.0), "right": (1, 0.0),
    "back_left": (-1, 5.0), "back": (0, 5.0), "back_right": (1, 5.0),
    "front_left": (-1, -2.5), "front": (0, -2.5), "front_right": (1, -2.5),
    "far": (0, 10.0), "offscreen_left": (-5, 0.0), "offscreen_right": (5, 0.0),
}
ZW_POSES = ("stand", "walk", "run", "sit", "lie", "point", "reach", "arms_up", "hands_head", "hands_face", "wave", "think",
            "shrug", "hold", "crouch", "hug", "stomp", "throw", "fists", "climb", "hidden")


def zw_mark(place, mark, k=0):
    """a mark's ground point on the place's stage (k: a second person on the same mark stands 1.3 to the side)"""
    c, d, right, rot = zw_stage(place)
    sx, dep = ZW_MARKS.get(mark, ZW_MARKS["center"])
    p = c + right * (sx * 2.8 + k * 1.3) + d * dep
    return (p.x, p.y, 0.0)


def zw_posed(ch, t, pose, at=None):
    """a named pose held from t (the start / end frame of a scene card); at: what a point / reach / look aims at"""
    try:
        if pose in ("stand", "walk", "run", None, ""):
            ch.pose(t, armL=(0, 4), armR=(0, 4))
        elif pose == "sit":
            zw_sit(ch, t)
        elif pose == "lie":
            zw_fall(ch, t - 0.33)
        elif pose == "point":
            zw_point(ch, t, at if at is not None else (0, -20, 0))
        elif pose == "reach":
            zw_reach(ch, t, at if at is not None else (0, -20, 0))
        elif pose == "arms_up":
            ch.act(t, "cheer")
        elif pose in ("hands_head", "hands_face", "wave", "think", "shrug", "hold", "fists", "hug"):
            ch.act(t, pose if pose != "hug" else "hold")
        elif pose == "crouch":
            ch.act(t, "brace")
        elif pose == "stomp":
            zw_stomp(ch, t, 1)
        elif pose == "throw":
            ch.pose(t, armR=(140, -10))
        elif pose == "climb":
            ch.pose(t, armL=(170, 12), armR=(170, 12))
        elif pose == "hidden":
            ch.set_visible(t, False)
    except Exception as e:
        print("zw_posed %s skipped: %s" % (pose, e))
    return ch


# typical sizes (units tall) so a "big box" is never a shoebox (round 2: the plan's sizes were often 1)
ZW_THING_SIZE = {"box": 2.6, "crate": 2.6, "cake": 2.0, "fridge": 6.0, "door": 6.0, "wall_boards": 5.0, "sign": 4.0,
                 "tree_small": 5.0, "sunflower": 3.0, "umbrella": 2.6, "bucket": 1.6, "drain_grate": 1.0, "rock": 1.6,
                 "vine": 3.5, "thorn_vine": 3.5, "balloon": 2.0, "bell": 1.4}
# ===== END OF THE ZYVO ACTIONS + THINGS =============================================================================
