# ===== ZYVO: THE RULE EFFECT, SWITCHES, THE WINDOW + PORCH RECIPES, THE FREE CHECKS (worlds/effects.py, round 7) ====
# Pasted after town.py (owner 2026-11-23, round 7).
#   THE RULE EFFECT: every In This Town story is "when X happens, Y appears"; the plan designs Y once (what, how big in
#     character heads, where: over_head / at_feet / in_hand / from_sky, how: pop / grow / fall / switch_on, glow) and
#     zw_rule_effect plays it with impact on its word: a quick scale-up with a little overshoot, a burst ring, sparkles,
#     a glow + a light for a light; the "pop" sound is mixed in on the same word by the finish (free, local)
#   A LIGHT BULB is a real bulb: a glass bulb + a neck + a screw base + a glowing filament (never a white blob)
#   SWITCHES: one chosen street lamp / window / porch light goes off or on on a word (zw_switch)
#   RECIPES: zw_lookout (a kid at a window, the street outside: the replica's look-out) and zw_porch_cam (from the
#     front yard, three-quarter, slightly low, no fence / rail in the way, the people a third of the frame or more, the
#     porch lit by its own porch light)
#   THE FREE CHECKS (in the hook): a named person too small or covered by something in front -> ZW_GATE lines the
#     storyboard reads before any paid picture check; background walkers right at the lens leave the shot
ZW_RULE = {}   # this story's rule effect (the shots file sets it: thing, heads, where, how, glow)


# ---------------------------------------------------------------- a REAL light bulb (and a readable kazoo)
def zt_build_bulb(r, c=None, on=True):
    Mg = zt_m("bulbglass_on" if on else "bulbglass", "#fff7d6", 0.15, emit="#ffd46a" if on else None, estr=3.0 if on else 0.0)
    Mb = zt_m("bulbbase", "#9aa0aa", 0.35, 0.8)
    sphere("zt_bg%d" % ZT_N["n"], 0.42, (0, 0, 0.78), Mg, (1, 1, 1.12), parent=r, coll=c, seg=18)
    cyl("zt_bn%d" % ZT_N["n"], 0.2, 0.22, (0, 0, 0.36), Mg, 14, parent=r, coll=c, r2=0.16)
    for k in range(3):
        cyl("zt_bs%d_%d" % (ZT_N["n"], k), 0.165 - k * 0.006, 0.08, (0, 0, 0.2 - k * 0.075), Mb, 14, parent=r, coll=c)
    sphere("zt_btip%d" % ZT_N["n"], 0.06, (0, 0, -0.02), zt_m("bulbtip", "#3a3a3a", 0.5), parent=r, coll=c, seg=8)
    if on:
        box("zt_bf%d" % ZT_N["n"], (0.22, 0.03, 0.03), (0, 0, 0.8), zt_m("filament", "#ffffff", 0.2, emit="#fff2b0", estr=8.0), 0.0, parent=r, coll=c)
    return r


def zt_build_kazoo(r, c=None, col=None):
    M = zt_m("kazoo" + (col or "#ffcf1f")[1:], col or "#ffcf1f", 0.4, 0.2)
    cyl("zt_kzb%d" % ZT_N["n"], 0.16, 1.0, (0, 0, 0.18), M, 14, rot=(0, 90, 0), parent=r, coll=c, r2=0.1)
    cyl("zt_kzt%d" % ZT_N["n"], 0.1, 0.12, (0.08, 0, 0.36), zt_m("kazootop", "#ff4f7e", 0.4), 12, parent=r, coll=c)
    return r


ZT_BUILD6 = zt_build


def zt_build(kind, r, c, col):
    if kind in ("light_bulb", "lamp_bulb"):
        return zt_build_bulb(r, c)
    if kind == "kazoo":
        return zt_build_kazoo(r, c, col)
    return ZT_BUILD6(kind, r, c, col)


ZW_THING_SIZE.update({"light_bulb": 1.0, "lamp_bulb": 1.0, "kazoo": 1.0})


# ---------------------------------------------------------------- THE RULE EFFECT
def zw_head_top(ch, t):
    bpy.context.scene.frame_set(F(t))
    pts = zw_head_pts(ch)
    if not pts:
        p = za_here(ch, t)
        return Vector((p.x, p.y, 5.6 * zm_s(ch)))
    return Vector((sum(p.x for p in pts) / len(pts), sum(p.y for p in pts) / len(pts), max(p.z for p in pts)))


def zw_rule_effect(who, t, spec=None, at=None):
    """THE TOWN'S RULE HAPPENS on word t to `who` (a character) or at a point: the plan's thing appears with impact"""
    sp = dict(ZW_RULE)
    sp.update(spec or {})
    kind = sp.get("thing", "light_bulb")
    heads = max(1.0, float(sp.get("heads", 1.3)))
    where, how = sp.get("where", "over_head"), sp.get("how", "pop")
    glow = bool(sp.get("glow", kind in ("light_bulb", "lamp_bulb", "star", "nightlight")))
    s = zm_s(who) if who is not None and hasattr(who, "root") else zw_ps()
    size = 1.25 * heads * s / 0.8          # the kit's head is ~1.25 high at scale 1
    # where it appears
    if who is not None and hasattr(who, "root"):
        if where == "over_head":
            p = zw_head_top(who, t) + Vector((0, 0, 0.35 * size))
        elif where == "at_feet":
            p = Vector(zm_front(who, t, 1.2 * s, 0.0))
        elif where == "in_hand":
            p = Vector(zm_front(who, t, 1.0 * s, 2.2 * s))
        else:
            q = za_here(who, t)
            p = Vector((q.x, q.y, 0.0))
    else:
        p = Vector(at if at is not None else zw_stage_xy() + (0.0,))
    ob = zw_thing(kind, (p.x, p.y, p.z), size=size)
    f = F(t)
    # how: from nothing, a quick scale-up with an overshoot (pop / grow), or a fall from the sky, or switched on
    base = tuple(ob.scale)
    if how == "fall" or where == "from_sky":
        ob.location = (p.x, p.y, p.z + 14.0 * s)
        ob.keyframe_insert("location", frame=f - 1)
        ob.location = (p.x, p.y, p.z)
        ob.keyframe_insert("location", frame=f + 8)
        zt_vis(ob, t - 0.04, True)
    else:
        ob.scale = (0.001, 0.001, 0.001)
        ob.keyframe_insert("scale", frame=f - 1)
        k = 1.28 if how == "pop" else 1.1
        ob.scale = tuple(b * k for b in base)
        ob.keyframe_insert("scale", frame=f + (3 if how == "pop" else 8))
        ob.scale = base
        ob.keyframe_insert("scale", frame=f + (7 if how == "pop" else 14))
    # it follows the person (a bulb over a walking kid stays over the kid)
    if who is not None and hasattr(who, "root") and where in ("over_head", "in_hand"):
        bpy.context.view_layer.update()
        kc = ob.constraints.new("CHILD_OF")
        kc.target = who.root
        kc.inverse_matrix = who.root.matrix_world.inverted()
    c = p + Vector((0, 0, 0.5 * size))
    zw_burst(c, t, size)
    if glow:
        L0 = zw_novol(light("zw_rulelight%d" % f, "POINT", tuple(c), 0.0, (1.0, 0.86, 0.5), 0.5 * size), 0.4)
        L0.data.keyframe_insert("energy", frame=f)
        L0.data.energy = 180.0 * size * size
        L0.data.keyframe_insert("energy", frame=f + 4)
    print("ZW_RULE|%s|%s|%s|%s|%.2f" % (kind, where, how, who.name if who is not None and hasattr(who, "name") else "-", t))
    return ob


def zw_burst(c, t, size):
    """a burst ring + sparkles on the word"""
    f = F(t)
    M = zw_m("burst", "#fff4c2", 0.3, emit="#ffe88a", estr=4.0)
    ring = cyl("zw_ring%d" % f, 0.5 * size, 0.04, tuple(c), M, 24)
    ring.rotation_euler = (math.radians(90), 0, 0)
    for k, (sc_, fr) in enumerate(((0.2, f - 1), (1.0, f + 3), (2.2, f + 8))):
        ring.scale = (sc_, sc_, 1.0)
        ring.keyframe_insert("scale", frame=fr)
    ring.hide_render = False
    ring.keyframe_insert("hide_render", frame=f + 8)
    ring.hide_render = True
    ring.keyframe_insert("hide_render", frame=f + 9)
    ring.hide_render = True
    ring.keyframe_insert("hide_render", frame=f - 2)
    ring.hide_render = False
    ring.keyframe_insert("hide_render", frame=f - 1)
    rnd = random.Random(f)
    for k in range(10):
        a = 2 * math.pi * k / 10 + rnd.uniform(-0.2, 0.2)
        e = rnd.uniform(-0.4, 0.6)
        d = Vector((math.cos(a), 0.3 * math.sin(a * 2), math.sin(a) + e)).normalized()
        sp_ = box("zw_spark%d_%d" % (f, k), (0.14 * size, 0.14 * size, 0.14 * size), tuple(c), M, 0.0, rot=(45, 45, 0))
        sp_.keyframe_insert("location", frame=f - 1)
        sp_.location = tuple(c + d * 1.6 * size)
        sp_.keyframe_insert("location", frame=f + 10)
        sp_.scale = (1, 1, 1)
        sp_.keyframe_insert("scale", frame=f + 2)
        sp_.scale = (0.001, 0.001, 0.001)
        sp_.keyframe_insert("scale", frame=f + 12)
        sp_.keyframe_insert("scale", frame=f - 2)
        sp_.scale = (1, 1, 1)
        sp_.keyframe_insert("scale", frame=f - 1)
    return ring


# ---------------------------------------------------------------- SWITCHES: one chosen lamp / window / porch light
def zw_switch(kind, near, t, on):
    """kind lamp | window | porch_light | light; near = (x, y) or a character: the nearest one goes on / off at t"""
    p = za_here(near, t) if hasattr(near, "root") else Vector((float(near[0]), float(near[1]), 0.0))
    f = F(t)
    if kind in ("lamp", "light", "street_lamp"):
        lamps = [(((Vector((o.location.x, o.location.y, 0)) - Vector((p.x, p.y, 0))).length), o) for o in D.objects
                 if o.type == "LIGHT" and (o.name.startswith("zw_lamppool") or o.name.startswith("zw_lamplight"))]
        if not lamps:
            return 0
        dmin = min(d for d, _ in lamps)
        for d, o in lamps:
            if d > dmin + 0.5:
                continue
            e = o.data.energy
            o.data.energy = e if not on else 0.0
            o.data.keyframe_insert("energy", frame=f - 1)
            o.data.energy = 0.0 if not on else e
            o.data.keyframe_insert("energy", frame=f)
            # the bulb itself: a dark shell when off
            if o.name.startswith("zw_lamplight"):
                sh = sphere("zw_lampoff%d" % f, 0.5 * o.data.shadow_soft_size / 0.5 if o.data.shadow_soft_size else 0.5, tuple(o.location), zw_m("lampoff", "#2a2d36", 0.6), seg=12)
                zt_vis(sh, t, not on)
                if on:
                    zt_vis(sh, -10.0, True)
        print("ZW_SWITCH|lamp|%s|%.2f" % ("on" if on else "off", t))
        return 1
    # a window (or the porch light): the nearest house window gets a lit / dark pane over it from t
    best = None
    for o in D.objects:
        n = o.name
        if (kind == "window" and n.startswith("zw_hwin") and not n.startswith("zw_hwinf") and not n.startswith("zw_hwins")) or (kind == "porch_light" and n.startswith("zw_hplamp")):
            d = (Vector((o.location.x, o.location.y, 0)) - Vector((p.x, p.y, 0))).length
            if best is None or d < best[0]:
                best = (d, o)
    if best is None:
        return 0
    o = best[1]
    dims = o.dimensions
    if kind == "porch_light":
        L0 = zw_novol(light("zw_porchsw%d" % f, "POINT", tuple(o.location), 0.0, (1.0, 0.8, 0.5), 0.6), 0.3)
        L0.data.energy = 0.0 if on else 260.0
        L0.data.keyframe_insert("energy", frame=f - 1)
        L0.data.energy = 260.0 if on else 0.0
        L0.data.keyframe_insert("energy", frame=f)
        return 1
    Mon = zw_m("winsw_on", "#ffd9a0", 0.3, emit="#ffc070", estr=2.2)
    Moff = zw_m("winsw_off", "#1c2742", 0.2, 0.2)
    pane = box("zw_winsw%d" % f, (dims.x + 0.02, dims.y + 0.04, dims.z + 0.02), tuple(o.location), Mon if on else Moff, 0.0)
    zt_vis(pane, t, True)
    print("ZW_SWITCH|window|%s|%.2f" % ("on" if on else "off", t))
    return 1


# ---------------------------------------------------------------- THE WINDOW LOOK-OUT (the replica's recipe)
ZW_LOOK_ROOM = {"loc": (-3.0, -18.0, 0.0), "rot": 180.0}


def zw_lookout(cam, t0, t1, kid, target=None, cut=True):
    """"I see it from my window": the kid inside a room on the south side of the street, at the window, looking across;
    the first half from outside (the kid's face in the window), a cut, then over the kid's shoulder to the street"""
    ps = zw_ps()
    loc, rot = ZW_LOOK_ROOM["loc"], ZW_LOOK_ROOM["rot"]
    before = set(D.objects.keys())
    R = zp_room(loc, rot, 9.0, 9.0, 6.0, 4.0, 2.8, sill=1.5)
    # the street set's own pieces inside the room go (the replica lesson)
    bpy.context.view_layer.update()
    a = Vector(zp_l2w(loc, rot, (-4.4, 0.4, 0))); b = Vector(zp_l2w(loc, rot, (4.4, 8.6, 0)))
    lo = Vector((min(a.x, b.x), min(a.y, b.y), 0.3)); hi = Vector((max(a.x, b.x), max(a.y, b.y), 5.8))
    for o in list(D.objects):
        if o.name in before and not o.name.startswith("zw_src_") and not o.hide_render:
            bx = zw_box_of(o)
            if bx and (bx[1].x - bx[0].x) < 60 and (bx[1].y - bx[0].y) < 60 and bx[0].x < hi.x and bx[1].x > lo.x and bx[0].y < hi.y and bx[1].y > lo.y and bx[0].z < hi.z and bx[1].z > lo.z:
                o.hide_render = True
    kp = Vector(zp_l2w(loc, rot, (0.4, 1.3, 0)))
    kid.pose(t0 - 0.3, loc=(kp.x, kp.y, 0.0), rot=rot)
    tg = Vector(za_pos(target, (0.0, 12.0, 0.0))) if target is not None else Vector((zw_stage_xy()[0], zw_stage_xy()[1], 0.0))
    head = zw_head_top(kid, t0)
    out = Vector(zp_l2w(loc, rot, (0.4, -5.5, 0.0)))   # outside, in front of the window
    tm = (t0 + t1) / 2.0 if cut else t1
    cam.key(t0, (out.x, out.y, head.z - 0.6 * ps), (head.x, head.y, head.z - 0.8 * ps), lens=30)
    cam.key(tm - 1.0 / 30.0, (out.x, out.y + 0.25, head.z - 0.6 * ps), (head.x, head.y, head.z - 0.8 * ps), lens=30, interp="CONSTANT" if cut else "BEZIER")
    if cut:
        d = (tg - kp)
        d.z = 0
        d = d.normalized() if d.length > 1e-3 else Vector((0, 1, 0))
        rgt = Vector((d.y, -d.x, 0))
        p0 = Vector((kp.x, kp.y, head.z + 0.3 * ps)) - d * 2.2 * ps + rgt * 0.9 * ps
        cam.key(tm, tuple(p0), (tg.x, tg.y, 2.0 * ps), lens=24)
        cam.key(t1, tuple(p0 + d * 0.3 * ps), (tg.x, tg.y, 2.0 * ps), lens=24)
    ZW_FRAMED["lookout"] = "the window look-out"
    return R


# ---------------------------------------------------------------- THE PORCH RECIPE
def zw_porch_cam(cam, t0, t1, people, things=(), side=1.0):
    """from the FRONT YARD, three-quarter, slightly low, the people a third of the frame or more, no fence / rail /
    hedge between the lens and them (those of that house leave the shot), the porch lit by its own porch light"""
    people = [p for p in people if p is not None]
    if not people:
        return None
    sc = bpy.context.scene
    sc.frame_set(F(t0))
    c = Vector((0, 0, 0))
    for p in people:
        c += za_here(p, t0)
    c /= len(people)
    # the house whose porch this is (the nearest house front), its fence + rails + hedges out of the way
    hid = 0
    for o in D.objects:
        n = o.name
        if n.startswith(("zw_hf", "zw_hrail", "zw_hhedge", "zw_hpost", "zw_hmb")) and (Vector((o.location.x, o.location.y, 0)) - Vector((c.x, c.y, 0))).length < 12.0:
            o.hide_render = True
            hid += 1
    pts = []
    for p in people:
        pts += zw_vpts([p.root])
    for t in things:
        pts += zw_pts([t])
    front = zw_front(people)
    s = max([p.root.scale[2] for p in people] + [0.3])
    r = zw_fit(cam, pts, front, t0, t1, 20, ZW_SAFE, frac=0.4, cam_dz=-0.4 * s, yaws=(35.0 * side, -35.0 * side, 25.0, -25.0, 45.0, -45.0), push=0.04, skip=tuple(p.name + "_" for p in people), tag="porch")
    if zw_night():
        zw_novol(light("zw_porchlight", "POINT", (c.x, c.y - 0.5, 4.2 * s / 0.55), 90.0, (1.0, 0.82, 0.55), 0.8), 0.3)
    ZW_FRAMED["porch"] = "porch recipe (%d yard pieces out of the way)" % hid
    return r


# ---------------------------------------------------------------- THE FREE CHECKS (geometry, in the hook)
def zw_gate7(S):
    """ZW_GATE|<shot>|<name>|small|...   a story character in frame smaller than 9 % of the frame height
       ZW_GATE|<shot>|<name>|covered|... something (not a person) between the lens and that character's head
    and background walkers within ~3 of the lens leave the shot"""
    sc = bpy.context.scene
    cam = sc.camera
    if cam is None or "busy" not in ZW_T:
        return []
    f = (F(S["t0"]) + max(F(S["t0"]), F(S["t1"]) - 1)) // 2
    sc.frame_set(f)
    o = cam.matrix_world.translation.copy()
    lines = []
    for ob in list(D.objects):
        if ob.type == "EMPTY" and (ob.name.startswith("zw_cw") or ob.name.startswith("zw_cs")) and (Vector(ob.matrix_world.translation) - o).length < 3.0 + 2.0 * zw_ps():
            ob.hide_render = True
    for nm, ch in zw_cast():
        if nm in ZW_EXTRAS or nm in ZW_MON:
            continue
        sp = zw_span(cam.ob if hasattr(cam, "ob") else cam, zw_vpts([ch.root]) or zw_pts([ch.root]))
        if sp is None:
            continue
        u0, u1, v0, v1 = sp
        if u1 < 0.02 or u0 > 0.98 or v1 < 0.02 or v0 > 0.98:
            continue   # not in this frame
        if (v1 - v0) < 0.09:
            lines.append("ZW_GATE|%s|%s|small|body %.2f of the frame" % (S.get("id", "?"), nm, v1 - v0))
        hp = zw_head_pts(ch)
        if hp:
            hc = Vector((sum(p.x for p in hp) / len(hp), sum(p.y for p in hp) / len(hp), sum(p.z for p in hp) / len(hp)))
            dv = hc - o
            try:
                dg = bpy.context.evaluated_depsgraph_get()
                hit, loc, nrm, idx, hob, mw = sc.ray_cast(dg, o, dv.normalized(), distance=max(0.1, dv.length - 0.4))
            except Exception:
                hit, hob = False, None
            # (a ray also hits pieces hidden from the render, e.g. the yard pieces the porch recipe put away, and the
            # face parts are their own zp_f* objects: neither covers anyone)
            hidden = hob is not None and (hob.hide_render or (hasattr(hob, "original") and hob.original is not None and hob.original.hide_render))
            # a DRIVING car between the lens and a character leaves this shot (it never passes in front of the cast)
            car = None
            if hit and hob is not None and not hidden:
                for dob in list(ZW_DRIVING):
                    try:
                        if hob.name == dob.name or any(hob.name == k.name for k in dob.children_recursive):
                            car = dob
                            break
                    except Exception:
                        continue
            if car is not None:
                for o2 in [car] + list(car.children_recursive):
                    o2.hide_render = True
                print("ZW_FRAMED|%s|car|a driving car in front of %s left the shot" % (S.get("id", "?"), nm))
            elif hit and hob is not None and not hidden and not hob.name.startswith("zp_f") and not hob.name.startswith(ch.name + "_") and not any(hob.name.startswith(c2.name + "_") for n2, c2 in zw_cast()):
                lines.append("ZW_GATE|%s|%s|covered|%s in front" % (S.get("id", "?"), nm, hob.name[:30]))
    for l in lines:
        print(l)
    return lines


ZW_FIT6 = zw_fit


def zw_fit(cam, pts, *a, **kw):
    """(round 7) a camera asked to frame nothing visible (a monster that already went down its drain) frames the
    visible cast instead, and with nobody left it keeps its camera: never a crash on an empty box"""
    if not pts:
        for nm, ch in zw_cast():
            pts = pts + zw_vpts([ch.root])
        print("ZW_FRAMED|-|%s|nothing visible to frame: the visible cast (%d points)" % (kw.get("tag", "frame"), len(pts)))
        if not pts:
            return None
    return ZW_FIT6(cam, list(pts), *a, **kw)


ZW_GATE6 = zw_gate


def zw_gate(S):
    out = ZW_GATE6(S)
    try:
        out = list(out or []) + zw_gate7(S)
    except Exception as e:
        print("zw_gate7 skipped: %s" % e)
    return out
# ===== END OF EFFECTS ================================================================================================
