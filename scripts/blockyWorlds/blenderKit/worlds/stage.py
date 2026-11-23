# ===== ROUND 8 (owner 2026-11-23): ONE CONTINUOUS TAKE PER SCENE, ONE STAGE, THE CAMERA ON THE RUNNING SCENE ===========
# Pasted after effects.py. A scene is built ONCE by its take function (the place, the cast with their locked looks, the
# props, the light) and every line of the scene adds its actions to ONE timeline at the word times. Every shot (and
# every storyboard still) calls the same take and then only puts a camera on it (zc_cut): nobody is re-placed between
# cards, a thing that came in stays until a line takes it away.
#   the cameras      zc_cut(t0, t1, kind, people, things, move, side): wide / medium / two / close / insert / low / top,
#                    moves push_in (the default) / tilt_up / track / top_down / static; always on the stage's camera side
#   object blocks    zo_appear / zo_disappear / zo_move / zo_state (on / off, open / closed) / zo_drop (+ zw_grab, zm_give)
#   many switches    zs_switch_all("lamps" | "windows", t, on) and zs_windows_open(t): a whole street at once
#   face + impact    zf_star_eyes / zf_x_eyes / zf_sweat / zf_splat / zf_sign (a held sign with big text)
#   the monster      style "shadow": a tall black silhouette, two glowing eyes, long thin limbs (zw_monster)
#   the light        zs_light(time, t0, t1): "storm" = night + rain + lightning, "morning" = a warm low sun
ZS = {"side": 0.0, "place": None}   # the stage's camera side (degrees from the stage front) and place, set by the take


# ---------------------------------------------------------------- the props round 8 adds
def zt_build_chalk_line(r, c=None, col=None):
    """a painted / chalk line on the ground (the reference's rule marker): a long thin strip, slightly wobbly"""
    M = zt_m("chalk" + (col or "#f4f4f0")[1:], col or "#f4f4f0", 0.9)
    for k in range(6):
        box("zt_chalk%d_%d" % (ZT_N["n"], k), (1.45, 0.26 + 0.03 * (k % 2), 0.03), (-3.6 + k * 1.44, 0.02 * ((k * 7) % 3 - 1), 0.02), M, 0.0, parent=r, coll=c)
    return r


def zt_build_splat(r, c=None, col=None):
    M = zt_m("splat" + (col or "#ff3b8d")[1:], col or "#ff3b8d", 0.35)
    cyl("zt_splat%d" % ZT_N["n"], 0.55, 0.04, (0, 0, 0.02), M, 14, parent=r, coll=c)
    for k in range(6):
        a = k * 1.047 + 0.3
        cyl("zt_splatd%d_%d" % (ZT_N["n"], k), 0.12 + 0.05 * (k % 3), 0.04, (math.cos(a) * 0.8, math.sin(a) * 0.8, 0.02), M, 10, parent=r, coll=c)
    return r


ZT_BUILD7 = zt_build


def zt_build(kind, r, c, col):
    if kind == "chalk_line":
        return zt_build_chalk_line(r, c, col)
    if kind == "splat":
        return zt_build_splat(r, c, col)
    return ZT_BUILD7(kind, r, c, col)


ZW_THING_SIZE.update({"chalk_line": 1.0, "splat": 1.0})


# ---------------------------------------------------------------- THE SHADOW MONSTER (owner 2026-11-23, item 18)
ZW_MON_STYLES["shadow"] = ("#0b0b10", "#0b0b10", "#0b0b10", "#fff1a8", "#000000", (0.62, 0.72, 1.0))
ZW_MON8 = zw_monster


def zw_monster(name, loc, rot=0.0, size=3.5, style="horns", **kw):
    """style "shadow": a tall black silhouette with two round glowing eyes and long thin limbs (no teeth, brows, spikes,
    hair); filmed from low with a person tiny beside it (zc_cut kind "low")"""
    if style != "shadow":
        return ZW_MON8(name, loc, rot=rot, size=size, style=style, **kw)
    m = ZW_MON8(name, loc, rot=rot, size=max(3.6, float(size)), style="shadow", **kw)
    for o in list(m.root.children_recursive):
        n = o.name
        hairy = o.type == "MESH" and any(sl.material is not None and sl.material.name.startswith(name + "_hair") for sl in o.material_slots)
        if any(n.startswith(name + s) for s in ("_brow", "_mouth", "_tooth", "_fang", "_spike", "_pupil", "_horn", "_eye", "_cap")) or "hair" in n or hairy:
            # (scaled away, not hidden: set_visible, used when it climbs out, shows every object of its collection again)
            o.scale = (0.0001, 0.0001, 0.0001)
        elif n.endswith("_armL") or n.endswith("_armR"):
            o.scale = (0.5, 0.5, 1.55)
        elif n.endswith("_legL") or n.endswith("_legR"):
            o.scale = (0.55, 0.55, 1.0)
        elif n.endswith("_torso"):
            o.scale = (0.72, 0.7, 1.0)
    Me = zw_m("shadow_eye", "#ffffff", 0.3, emit="#fff1a8", estr=14.0)
    for sx in (-1, 1):
        sphere(name + "_seye%d" % sx, 0.14, (sx * 0.24, -0.63, 0.12), Me, (1.0, 0.5, 1.25), parent=m.head, coll=m.coll, seg=12)
    return m


# ---------------------------------------------------------------- OBJECT BLOCKS (item 17): usable on any prop
ZS_SIZE = {}


def zs_hide(obj):
    """a thing that is built with its scene but comes in later: its real size kept, hidden (tiny) until zo_appear"""
    if obj is None:
        return obj
    ZS_SIZE[obj.name] = tuple(obj.scale)
    obj.scale = (0.001, 0.001, 0.001)
    return obj


def zo_appear(obj, t, at=None):
    """a thing POPS in at t (its real size back, at `at` when given)"""
    if obj is None:
        return obj
    s = ZS_SIZE.get(obj.name)
    if s:
        obj.scale = s
    if at is not None:
        obj.location = (float(at[0]), float(at[1]), 0.0)
    return zw_pop(obj, t)


def zo_disappear(obj, t):
    if obj is None:
        return obj
    s = obj.scale[2]
    obj.keyframe_insert("scale", frame=max(1, F(t) - 1))
    obj.scale = (s * 1.15, s * 1.15, s * 1.15)
    obj.keyframe_insert("scale", frame=F(t + 0.08))
    obj.scale = (0.001, 0.001, 0.001)
    obj.keyframe_insert("scale", frame=F(t + 0.25))
    return obj


def zo_move(obj, t0, t1, to, h=0.0):
    """a thing goes from where it is to `to` (a point or a character) between t0 and t1 (an arc of height h)"""
    if obj is None:
        return obj
    bpy.context.scene.frame_set(F(t0))
    a = Vector(obj.matrix_world.translation)
    b = Vector(za_pos(to, (a.x, a.y, 0.0)))
    b.z = a.z if not hasattr(to, "root") else 0.0
    if h > 0:
        return zm_fly(obj, t0, t1, a, b, h=h)
    obj.location = a
    obj.keyframe_insert("location", frame=F(t0))
    obj.location = b
    obj.keyframe_insert("location", frame=F(t1))
    return obj


def zo_state(obj, t, state):
    """on / off (a glow + a light that switch at t), open / closed (a door or a lid turns 80 degrees)"""
    if obj is None:
        return obj
    f = F(t)
    if state in ("on", "off"):
        on = state == "on"
        bpy.context.scene.frame_set(f)
        p = Vector(obj.matrix_world.translation)
        L0 = zw_novol(light("zo_glow%d" % f, "POINT", (p.x, p.y, p.z + 0.8), 0.0, (1.0, 0.86, 0.55), 0.4), 0.3)
        L0.data.energy = 0.0 if on else 120.0
        L0.data.keyframe_insert("energy", frame=f - 1)
        L0.data.energy = 120.0 if on else 0.0
        L0.data.keyframe_insert("energy", frame=f)
        for m in [obj] + list(obj.children_recursive):
            if m.type != "MESH":
                continue
            for sl in m.material_slots:
                mt = sl.material
                if mt is None or not mt.use_nodes:
                    continue
                for nd in mt.node_tree.nodes:
                    if nd.type == "BSDF_PRINCIPLED" and "Emission Strength" in nd.inputs:
                        inp = nd.inputs["Emission Strength"]
                        v = inp.default_value
                        inp.default_value = v if not on else 0.0
                        inp.keyframe_insert("default_value", frame=f - 1)
                        inp.default_value = 0.0 if not on else max(v, 3.0)
                        inp.keyframe_insert("default_value", frame=f)
        return obj
    if state in ("open", "closed"):
        z = obj.rotation_euler[2]
        obj.keyframe_insert("rotation_euler", frame=f - 1)
        obj.rotation_euler[2] = z + math.radians(80.0 if state == "open" else -80.0)
        obj.keyframe_insert("rotation_euler", frame=f + 8)
    return obj


def zo_drop(ch, obj, t):
    """the held thing leaves the hand at t and falls to the ground in front of the feet"""
    if obj is None:
        return obj
    sc = bpy.context.scene
    sc.frame_set(F(t))
    bpy.context.view_layer.update()
    p = Vector(obj.matrix_world.translation)
    for k in list(obj.constraints):
        if k.name in ("zw_grab", "zw_give"):
            k.keyframe_insert("influence", frame=F(t) - 1)
            k.influence = 0.0
            k.keyframe_insert("influence", frame=F(t))
    obj.location = p
    obj.keyframe_insert("location", frame=F(t))
    obj.location = (p.x, p.y, 0.05)
    obj.keyframe_insert("location", frame=F(t + 0.32))
    if ch is not None:
        ch.pose(t + 0.05, armR=(10, 4))
    return obj


# ---------------------------------------------------------------- MANY SWITCHES AT ONCE (item 16)
def zs_switch_all(kind, t, on, stagger=0.02, near=None, radius=60.0):
    """every street lamp ("lamps") or every house window ("windows") goes on / off from t, one after another (stagger)"""
    p = za_pos(near, (0.0, 0.0, 0.0)) if near is not None else None
    n = 0
    if kind == "lamps":
        lamps = [o for o in D.objects if o.type == "LIGHT" and (o.name.startswith("zw_lamppool") or o.name.startswith("zw_lamplight"))]
        if p is not None:
            lamps = [o for o in lamps if (Vector((o.location.x, o.location.y, 0)) - Vector((p[0], p[1], 0))).length < radius]
        lamps.sort(key=lambda o: o.location.y)
        for k, o in enumerate(lamps):
            f = F(t + stagger * (k // 2))
            e = o.data.energy if o.data.energy > 0 else 60.0
            o.data.energy = e if not on else 0.0
            o.data.keyframe_insert("energy", frame=f - 1)
            o.data.energy = 0.0 if not on else e
            o.data.keyframe_insert("energy", frame=f)
            n += 1
    else:
        Mon = zw_m("winsw_on", "#ffd9a0", 0.3, emit="#ffc070", estr=2.2)
        Moff = zw_m("winsw_off", "#1c2742", 0.2, 0.2)
        wins = [o for o in D.objects if o.name.startswith("zw_hwin") and not o.name.startswith("zw_hwinf") and not o.name.startswith("zw_hwins")]
        wins.sort(key=lambda o: o.location.y)
        for k, o in enumerate(wins):
            d = o.dimensions
            pane = box("zs_win%d_%d" % (F(t), k), (d.x + 0.02, d.y + 0.04, d.z + 0.02), tuple(o.location), Moff if on else Mon, 0.0)
            pane2 = box("zs_win2%d_%d" % (F(t), k), (d.x + 0.03, d.y + 0.05, d.z + 0.03), tuple(o.location), Mon if on else Moff, 0.0)
            ts = t + stagger * (k // 2)
            zt_vis(pane, -10.0, True)
            zt_vis(pane, ts, False)
            zt_vis(pane2, -10.0, False)
            zt_vis(pane2, ts, True)
            n += 1
    print("ZW_SWITCH|all %s|%s|%d|%.2f" % (kind, "on" if on else "off", n, t))
    return n


def zs_windows_open(t, near=None, radius=40.0, stagger=0.07):
    """the houses' windows OPEN: two shutters on each window swing out, one window after another"""
    p = za_pos(near, (0.0, 0.0, 0.0)) if near is not None else None
    M = zw_m("shutter", "#5a7fb0", 0.6)
    wins = [o for o in D.objects if o.name.startswith("zw_hwin") and not o.name.startswith("zw_hwinf") and not o.name.startswith("zw_hwins")]
    if p is not None:
        wins = [o for o in wins if (Vector((o.location.x, o.location.y, 0)) - Vector((p[0], p[1], 0))).length < radius]
    wins.sort(key=lambda o: o.location.y)
    n = 0
    for k, o in enumerate(wins[:40]):
        d = o.dimensions
        wide_x = d.x >= d.y
        half = (d.x if wide_x else d.y) / 2.0
        for sx in (-1, 1):
            hx = o.location.x + (sx * half if wide_x else 0.0)
            hy = o.location.y + (0.0 if wide_x else sx * half)
            piv = empty("zs_hinge%d_%d_%d" % (F(t), k, sx), (hx, hy, o.location.z), None)
            box("zs_shut%d_%d_%d" % (F(t), k, sx), ((half if wide_x else 0.12), (0.12 if wide_x else half), d.z + 0.05), ((-sx * half / 2.0) if wide_x else 0.0, 0.0 if wide_x else (-sx * half / 2.0), 0.0), M, 0.02, parent=piv)
            f = F(t + stagger * k)
            piv.keyframe_insert("rotation_euler", frame=f)
            piv.rotation_euler[2] = math.radians(105.0 * sx)
            piv.keyframe_insert("rotation_euler", frame=f + 9)
        n += 1
    print("ZW_SWITCH|windows open|%d|%.2f" % (n, t))
    return n


# ---------------------------------------------------------------- FACE + IMPACT EFFECTS (item 19)
def zf_on_head(ch, name, make, t0, t1):
    """make(parent) builds the effect in head-local coordinates; visible from t0 to t1 only"""
    H = ch.head if hasattr(ch, "head") else None
    if H is None:
        return None
    r = empty(name, (0, 0, 0), H)
    make(r)
    for o in [r] + list(r.children_recursive):
        if o.type == "MESH":
            zt_vis(o, -10.0, False)
            zt_vis(o, t0, True)
            zt_vis(o, t1, False)
    return r


def zf_x_eyes(ch, t0, t1):
    M = zw_m("fx_xeye", "#1a1a1a", 0.5)
    def mk(r):
        for sx in (-1, 1):
            for a in (45, -45):
                box(ch.name + "_xe%d%d" % (sx, a), (0.26, 0.04, 0.05), (sx * 0.22, -0.66, 0.1), M, 0.0, rot=(0, a, 0), parent=r)
    return zf_on_head(ch, ch.name + "_xeyes%d" % F(t0), mk, t0, t1)


def zf_star_eyes(ch, t0, t1):
    M = zw_m("fx_star", "#ffd21f", 0.3, emit="#ffd21f", estr=3.0)
    def mk(r):
        for sx in (-1, 1):
            for a in (0, 36):
                box(ch.name + "_st%d%d" % (sx, a), (0.26, 0.04, 0.08), (sx * 0.22, -0.67, 0.12), M, 0.0, rot=(0, a, 0), parent=r)
                box(ch.name + "_st2%d%d" % (sx, a), (0.08, 0.04, 0.26), (sx * 0.22, -0.67, 0.12), M, 0.0, rot=(0, a, 0), parent=r)
    return zf_on_head(ch, ch.name + "_stars%d" % F(t0), mk, t0, t1)


def zf_sweat(ch, t, dur=0.9):
    M = zw_m("fx_sweat", "#8fd3ff", 0.15, emit="#bfe9ff", estr=0.6)
    def mk(r):
        sphere(ch.name + "_sw%d" % F(t), 0.11, (0.58, -0.35, 0.45), M, (1.0, 1.0, 1.5), parent=r, seg=10)
    r = zf_on_head(ch, ch.name + "_sweat%d" % F(t), mk, t, t + dur)
    if r is not None:
        r.keyframe_insert("location", frame=F(t))
        r.location = (0.0, 0.0, -0.3)
        r.keyframe_insert("location", frame=F(t + dur))
    return r


def zf_splat(target, t, col="#ff3b8d"):
    """a paint splat on a character's face (a character) or on the ground (a point)"""
    if hasattr(target, "head"):
        M = zw_m("fx_splat" + col[1:], col, 0.35)
        def mk(r):
            cyl(target.name + "_spl%d" % F(t), 0.34, 0.04, (0.05, -0.66, 0.05), M, 12, rot=(90, 0, 0), parent=r)
            for k in range(5):
                a = k * 1.256
                cyl(target.name + "_spd%d_%d" % (F(t), k), 0.08, 0.04, (0.05 + math.cos(a) * 0.42, -0.66, 0.05 + math.sin(a) * 0.42), M, 8, rot=(90, 0, 0), parent=r)
        return zf_on_head(target, target.name + "_splat%d" % F(t), mk, t, t + 60.0)
    s = zw_thing("splat", za_pos(target), size=1.4 * zw_ps(), color=col)
    return zw_pop(s, t)


def zs_text(name, body, loc, size, M, parent):
    return text(name, body, loc, size, M, rot=(90, 0, 0), extrude=0.02, parent=parent)


def zf_sign(ch, t0, t1, text):
    """the character holds up a sign with BIG text from t0 to t1 (a board on a stick in the right hand)"""
    sc = bpy.context.scene
    sc.frame_set(F(t0))
    arm = D.objects.get(ch.name + "_armR")
    if arm is None:
        return None
    Mb = zw_m("fx_signboard", "#fff6dc", 0.7)
    Ms = zw_m("fx_signstick", "#8a5a2b", 0.7)
    Mt = zw_m("fx_signtext", "#e8262c", 0.5)
    r = empty(ch.name + "_sign%d" % F(t0), (0, 0, -2.2), arm)
    cyl(ch.name + "_sgstick%d" % F(t0), 0.07, 2.2, (0, 0, 0.6), Ms, 8, parent=r)
    box(ch.name + "_sgboard%d" % F(t0), (2.6, 0.12, 1.5), (0, 0, 2.2), Mb, 0.04, parent=r)
    body = str(text)[:18].upper()
    size = 0.62 if len(body) <= 6 else (0.46 if len(body) <= 10 else 0.32)
    zs_text(ch.name + "_sgtext%d" % F(t0), body, (0, -0.08, 2.2), size, Mt, r)
    for o in [r] + list(r.children_recursive):
        if o.type in ("MESH", "FONT"):
            zt_vis(o, -10.0, False)
            zt_vis(o, t0, True)
            zt_vis(o, t1, False)
    ch.pose(t0 - 0.2, armR=(10, 4))
    ch.pose(t0, armR=(165, -6))
    ch.pose(max(t0 + 0.1, t1 - 0.2), armR=(165, -6))
    ch.pose(t1, armR=(10, 4))
    return r


# ---------------------------------------------------------------- THE LIGHT FOLLOWS THE STORY (item 20)
def zs_light(time, t0, t1):
    """after the place is built: "storm" = lightning flashes over the night rain; "morning" = a warm low sun"""
    if time == "storm":
        sun = zw_novol(light("zs_lightning", "SUN", (0, 0, 40), 0.0, (0.85, 0.9, 1.0), 0.2), 0.0)
        sun.rotation_euler = (math.radians(35), 0, math.radians(20))
        k, t = 0, t0 + 0.8
        while t < t1:
            f = F(t)
            for df, e in ((-1, 0.0), (0, 9.0), (2, 2.0), (3, 7.0), (6, 0.0)):
                sun.data.energy = e
                sun.data.keyframe_insert("energy", frame=f + df)
            k += 1
            t += 2.6 + (k % 3) * 0.9
        return sun
    if time == "morning":
        for o in D.objects:
            if o.type == "LIGHT" and o.data.type == "SUN":
                o.data.color = (1.0, 0.8, 0.6)
                o.data.energy = o.data.energy * 0.85
                o.rotation_euler[0] = math.radians(72.0)
        w = bpy.context.scene.world
        if w is not None and w.use_nodes:
            for nd in w.node_tree.nodes:
                if nd.type == "BACKGROUND":
                    c = nd.inputs["Color"].default_value
                    nd.inputs["Color"].default_value = (min(1.0, c[0] * 1.1), c[1] * 0.92, c[2] * 0.82, 1.0)
    return None


# ---------------------------------------------------------------- THE CAMERA ON THE RUNNING SCENE (items 11-13)
ZC_LENS = {"wide": 22, "medium": 30, "two": 28, "close": 34, "insert": 32, "low": 18, "top": 28}
# (round 8 first test: an insert of a held bell at 0.42 of the frame was a cropped blur: 0.3 keeps the hand around it)
ZC_FRAC = {"wide": None, "medium": 0.62, "two": None, "close": 0.5, "insert": 0.3, "low": None, "top": None}


def zc_pts(kind, people, things, t):
    bpy.context.scene.frame_set(F(t))
    bpy.context.view_layer.update()
    pts = []
    for ch in people:
        if ch is None:
            continue
        if kind == "close":
            pts += zw_head_pts(ch)
            sh = zw_pts([ch.torso]) if hasattr(ch, "torso") else []
            if sh:
                top = max(p.z for p in sh)
                pts += [Vector((p.x, p.y, max(p.z, top - 0.7 * ch.root.scale[2]))) for p in sh]
        elif kind in ("medium",) and ch.name not in ZW_MON:
            pts += zw_body_pts(ch)
        else:
            pts += zw_vpts([ch.root])
    for o in things:
        if o is not None:
            pts += zw_vpts([o]) or zw_pts([o])
    return pts


def zc_cut(t0, t1, kind, people=(), things=(), move="push_in", side=None, hero=None):
    """ONE camera cut on the running scene: measured on what it must show (the people's bodies / a face / the things),
    always from the stage's camera side (no crossing the line), then the move:
      push_in  starts 18 % wider and ends on the framing (the default: about half the shots)
      tilt_up  from low on the subject to its top (big things)
      track    moves with the subject (walking): the subject keeps its place in the frame
      top_down from above (things on the ground)
      static   holds
    kind low = a camera near the ground with a wide lens: the monster towers over a tiny person"""
    cam = Cam()
    people = [p for p in people if p is not None]
    things = [o for o in things if o is not None]
    tm = (t0 + t1) / 2.0
    pts = zc_pts(kind, people, things, tm)
    if not pts:
        for nm, ch in zw_cast():
            pts += zw_vpts([ch.root])
        if not pts:
            loc, tgt, ln = ZW_SPOTS.get(ZS["place"] or "suburb_street", ZW_SPOTS["suburb_street"])["wide"]
            cam.key(t0, tuple(loc), tuple(tgt), lens=ln)
            cam.key(t1, tuple(loc), tuple(tgt), lens=ln)
            return cam
    st_c, st_d, st_r, st_rot = zw_stage(ZS["place"] or "suburb_street")
    a0 = math.radians(ZS["side"] if side is None else side)
    front = Vector((-st_d.x * math.cos(a0) + st_d.y * math.sin(a0), -st_d.x * math.sin(a0) - st_d.y * math.cos(a0), 0.0))
    lens = ZC_LENS.get(kind, 28)
    hmax = max(p.z for p in pts) - min(p.z for p in pts)
    # a LOW camera for the wides and the people shots (round 8 first test: the road filled half of every wide)
    dz = {"low": -0.42 * hmax, "close": 0.0, "insert": 0.2 * hmax, "top": 0.0, "wide": 0.35 * hmax, "medium": -0.08 * hmax, "two": -0.1 * hmax}.get(kind, 0.0)
    # a FLAT thing on the ground (the drain) is seen from above, not from its own height (round 8: "no drain visible")
    if kind == "insert" and not people and hmax < 0.8 * zw_ps() / 0.55:
        dz = 3.2 * zw_ps() / 0.55
    # more angles (still on the stage's side) so a clear one is found round the monster's legs
    yaws = (18.0, -18.0, 0.0, 32.0, -32.0, 46.0, -46.0) if kind != "low" else (12.0, -12.0, 0.0, 26.0, -26.0, 40.0, -40.0)
    skip = tuple(p.name + "_" for p in people)
    r = zw_fit(cam, pts, front, t0, t1, lens, ZW_SAFE, frac=ZC_FRAC.get(kind), cam_dz=dz, yaws=yaws, push=0.0, skip=skip, tag="cut_" + kind)
    if r is None:
        return cam
    loc, aim = Vector(r[0]), Vector(r[1])
    up = Vector((0, 0, 1))
    if kind == "top" or move == "top_down":
        lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
        hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
        c = (lo + hi) / 2
        span = max(1.2, hi.x - lo.x, hi.y - lo.y)
        dd = span / (2 * (12.0 / lens) * 9.0 / 16.0) * 1.1
        dd = max(dd, 4.0 * zw_ps())
        # above everyone standing near the thing (a top-down inside the monster on its drain: the smoke test)
        top = hi.z
        for nm, ch in zw_cast():
            q = za_here(ch, tm)
            if (Vector((q.x, q.y, 0)) - Vector((c.x, c.y, 0))).length < 3.0 * max(1.0, ch.root.scale[2]):
                vp = zw_vpts([ch.root])
                if vp:
                    top = max(top, max(p.z for p in vp))
        p1 = c + up * (dd + (hi.z - lo.z)) + front * dd * 0.18
        p0 = c + up * (dd * 1.15 + (hi.z - lo.z)) + front * dd * 0.2
        p1.z = max(p1.z, top + 2.0 * zw_ps())
        p0.z = max(p0.z, top + 2.4 * zw_ps())
        cam.key(t0, tuple(p0), tuple(c), lens=lens)
        cam.key(t1, tuple(p1), tuple(c), lens=lens)
        ZW_FRAMED["cut"] = "%s top_down" % kind
        return cam
    if move == "tilt_up":
        lo_z = min(p.z for p in pts)
        hi_z = max(p.z for p in pts)
        a0v = Vector((aim.x, aim.y, lo_z + 0.25 * (hi_z - lo_z)))
        a1v = Vector((aim.x, aim.y, lo_z + 0.7 * (hi_z - lo_z)))
        l2 = loc + (loc - aim) * 0.1
        l2.z = max(0.8, min(l2.z, lo_z + 0.35 * (hi_z - lo_z)))
        cam.key(t0, tuple(l2), tuple(a0v), lens=lens)
        cam.key(t1, tuple(l2), tuple(a1v), lens=lens)
    elif move == "track" and people:
        p0, p1, pm = za_here(people[0], t0), za_here(people[0], t1), za_here(people[0], tm)
        cam.key(t0, tuple(loc + (p0 - pm)), tuple(aim + (p0 - pm)), lens=lens)
        cam.key(t1, tuple(loc + (p1 - pm)), tuple(aim + (p1 - pm)), lens=lens)
    elif move == "static":
        cam.key(t0, tuple(loc), tuple(aim), lens=lens)
        cam.key(t1, tuple(loc), tuple(aim), lens=lens)
    else:
        far = aim + (loc - aim) * 1.18
        cam.key(t0, tuple(far), tuple(aim), lens=lens)
        cam.key(t1, tuple(loc), tuple(aim), lens=lens)
    ZW_FRAMED["cut"] = "%s %s" % (kind, move)
    return cam


ZW_MARK7 = zw_mark


def zw_mark(place, mark, k=0):
    """round 8: on a take's stage the marks are closer together (2.0 sideways, 0.8 deep): a cast of 3 fits a 9:16 frame
    (the 2.8 steps made everyone tiny in a group shot)"""
    if ZS.get("place") != place:
        return ZW_MARK7(place, mark, k)
    c, d, right, rot = zw_stage(place)
    ps = zw_ps()
    sx, dep = ZW_MARKS.get(mark, ZW_MARKS["center"])
    p = c + right * ((sx * 2.0 + k * 1.3) * ps) + d * (dep * 0.8 * ps)
    return (p.x, p.y, 0.0)


def zs_beside(target, t, k=1):
    """a ground point beside a character / thing at time t (k = 1 its right, -1 its left as the camera sees it)"""
    st_c, st_d, st_r, st_rot = zw_stage(ZS["place"] or "suburb_street")
    p = za_here(target, t) if hasattr(target, "root") else Vector(za_pos(target))
    ps = zw_ps()
    big = target.root.scale[2] / max(0.3, ps) if hasattr(target, "root") else 1.0
    g = (2.0 + (1.4 if big > 2 else 0.0)) * ps
    return (p.x + st_r.x * g * k, p.y + st_r.y * g * k, 0.0)


def zs_behind(target, t, d=3.4):
    """a ground point BEHIND a character (further into the stage, away from the camera side)"""
    st_c, st_d, st_r, st_rot = zw_stage(ZS["place"] or "suburb_street")
    p = za_here(target, t) if hasattr(target, "root") else Vector(za_pos(target))
    ps = zw_ps()
    return (p.x + st_d.x * d * ps / 0.55, p.y + st_d.y * d * ps / 0.55, 0.0)


def zs_enter(ch, t0, t1, to, from_side=1):
    """a person ENTERS: hidden before, walks in from off the stage's side to `to`"""
    st_c, st_d, st_r, st_rot = zw_stage(ZS["place"] or "suburb_street")
    ps = zw_ps()
    b = Vector(za_pos(to))
    a = b + st_r * (9.0 * ps * from_side)
    ch.set_visible(-10.0, False)
    ch.pose(t0 - 0.05, loc=(a.x, a.y, 0.0))
    ch.set_visible(t0, True)
    zm_walk(ch, t0, max(t0 + 0.6, t1), (b.x, b.y, 0.0))
    return ch


def zs_exit(ch, t0, t1, side=1):
    st_c, st_d, st_r, st_rot = zw_stage(ZS["place"] or "suburb_street")
    ps = zw_ps()
    p = za_here(ch, t0)
    b = p + st_r * (10.0 * ps * side)
    zm_walk(ch, t0, max(t0 + 0.6, t1), (b.x, b.y, 0.0))
    ch.set_visible(max(t0 + 0.6, t1), False)
    return ch


def zs_hole(at):
    """the BIG drain in the open (item 18): a dark hole + a grate, at a ground point"""
    s = 1.6 * zw_ps() / 0.55
    hx, hy = float(at[0]), float(at[1])
    cyl("zs_hole%d" % int(abs(hx * 7 + hy * 13)), 1.3 * s, 0.04, (hx, hy, 0.03), zw_m("drainhole", "#0c0d10", 0.9), 32)
    for k in range(-4, 5):
        box("zs_grate%d_%d" % (int(abs(hx * 7 + hy * 13)), k + 4), (0.12 * s, 2.3 * s, 0.07), (hx + k * 0.27 * s, hy, 0.07), zw_m("grate", "#3d434c", 0.4, 0.7), 0.0)
    return (hx, hy)


def zs_dive(m, t0, t1, at):
    """the monster goes to the drain and DIVES down it (gone after t1)"""
    hx, hy = float(at[0]), float(at[1])
    ta = t0 + (t1 - t0) * 0.45
    zm_walk(m, t0, ta, (hx, hy, 0.0), run=True)
    zm_jump(m, ta)
    H = 5.6 * m.root.scale[2]
    m.pose(ta + 0.25, loc=(hx, hy, 0.0), armL=(170, 12), armR=(170, 12))
    m.pose(t1, loc=(hx, hy, -H * 1.05), armL=(170, 12), armR=(170, 12))
    m.set_visible(t1 + 0.04, False)
    return m


def zs_clear_stage(place, radius=13.0):
    """ONE STAGE (round 8 first test: fences, mailboxes, hedges and parked cars between the lens and the cast in most day
    shots): the yard clutter and the parked cars within `radius` (x the people's scale) of the stage are taken out of the
    take ONCE, so every shot of the scene shows the same street (continuity)"""
    st_c, st_d, st_r, st_rot = zw_stage(place)
    R = radius * zw_ps() / 0.55
    n = 0
    for o in list(D.objects):
        nm = o.name
        if not (nm.startswith(("zw_hf", "zw_hrail", "zw_hhedge", "zw_hpost", "zw_hmb", "zw_hgar", "zw_bench")) or nm.startswith("car_")):
            continue
        p = o.matrix_world.translation
        if (Vector((p.x, p.y, 0)) - Vector((st_c.x, st_c.y, 0))).length < R:
            for m in [o] + list(o.children_recursive):
                m.hide_render = True
                m.hide_viewport = True
            n += 1
    print("ZW_FRAMED|-|stage|%d yard pieces / parked cars out of the stage" % n)
    return n


def zs_quiet(dress):
    """the living world defaults to QUIET (item 9): no crowds / traffic unless the line is about them"""
    d = dict(dress or {})
    for k, v in (("busy", "empty"), ("walkers", "none"), ("cars", "parked"), ("extras", [])):
        d.setdefault(k, v)
    return d
# ===== END OF STAGE ==================================================================================================
