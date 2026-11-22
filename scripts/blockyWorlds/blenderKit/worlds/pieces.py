# ===== ZYVO PIECES + SHOT RECIPES (worlds/pieces.py, owner 2026-11-22: the replica test) ===========================
# Reusable set pieces and named camera setups, pasted after worlds.py + actions.py + acts.py. The director reuses a
# RECIPE instead of inventing every shot (cheaper, and it works the first time).
# PIECES (zp_*):
#   zp_clock(loc, rot, size, t_change=None, a="9:58", b="9:59")      a digital clock (red LED numbers) that changes at t
#   zp_window(loc, rot, w, h, lit=True, curtain=None) -> dict          a window frame you can see through both ways
#   zp_curtain_close(win, t0, t1) / zp_light_off(win, t)              a curtain closing, the window light switching off
#   zp_door(loc, rot, color, w, h) -> dict ; zp_door_open(d, t0, t1, deg) ; zp_lock_turn(d, t0, t1)
#   zp_room(loc, rot, w, d, h, win_w, win_h) -> dict                   a bedroom shell with a REAL window + a door
#   zp_bed(loc, rot, color) ; zp_sign(loc, rot, text) ; zp_mailbox(loc, rot)
#   zp_streetpool(loc, power)                                          a pool of lamp light on the ground
#   zp_behind_window(ch, win, depth=0.7)                               a person standing just behind a window
# SHOT RECIPES (zr_*: the camera only):
#   zr_aerial(cam, t0, t1, over, height, back, lens, push)             high wide over a street / houses
#   zr_object(cam, t0, t1, obj, dist, lens, side)                      an object close-up (the thing fills the frame)
#   zr_over_shoulder(cam, t0, t1, ch, target, side, lens, push)        behind a person's shoulder, looking at target
#   zr_through_window(cam, t0, t1, room, target, lens, push)           from inside the room, through the window, to target
#   zr_at_window(cam, t0, t1, room, ch, dist, lens)                    from outside, looking at someone at the window
#   zr_door_behind(cam, t0, t1, ch, door, lens)                        the door opening behind someone (their head in front)
#   zr_face(cam, t0, t1, ch, push)                                     a face close-up (zw_frame close)
#   zr_top_down(cam, t0, t1, ch, height)                               straight down on someone (in bed)
#   zr_street_long(cam, t0, t1, frm, to, height, lens)                 the long street, low, toward a vanishing point
ZP_N = {"n": 0}


def zp_id(s):
    ZP_N["n"] += 1
    return "zp_%s_%d" % (s, ZP_N["n"])


def zp_l2w(loc, rot, v):
    """a point given in a piece's own frame (x right, y in, z up) -> world, for a piece at loc turned rot degrees"""
    a = math.radians(rot)
    return Vector((loc[0] + v[0] * math.cos(a) - v[1] * math.sin(a), loc[1] + v[0] * math.sin(a) + v[1] * math.cos(a), (loc[2] if len(loc) > 2 else 0.0) + v[2]))


def zp_root(loc, rot):
    r = empty(zp_id("root"), (float(loc[0]), float(loc[1]), float(loc[2]) if len(loc) > 2 else 0.0), None, None, (0, 0, rot))
    return r


def zp_hide_until(ob, t, show=True):
    """ob invisible before t (show=True) or from t (show=False)"""
    f = F(t)
    ob.hide_render = show
    ob.keyframe_insert("hide_render", frame=max(1, f - 1))
    ob.hide_render = not show
    ob.keyframe_insert("hide_render", frame=f)


def zp_clock(loc, rot=0.0, size=1.0, t_change=None, a="9:58", b="9:59"):
    r = zp_root(loc, rot)
    box(zp_id("clk"), (3.2, 1.2, 1.5), (0, 0, 0.75), zw_m("clockbody", "#141418", 0.4), 0.12, parent=r)
    box(zp_id("clkface"), (2.9, 0.05, 1.15), (0, -0.61, 0.78), zw_m("clockface", "#0a0a0c", 0.2), 0.0, parent=r)
    Ml = zw_m("led", "#ff2a2a", 0.3, emit="#ff2020", estr=6.0)
    ta = text(zp_id("clka"), a, (0, -0.65, 0.62), 0.95, Ml, rot=(90, 0, 0), extrude=0.02, parent=r)
    text(zp_id("clkpm"), "PM", (1.2, -0.65, 0.32), 0.18, Ml, rot=(90, 0, 0), extrude=0.01, parent=r)
    if t_change is not None and b:
        tb = text(zp_id("clkb"), b, (0, -0.65, 0.62), 0.95, Ml, rot=(90, 0, 0), extrude=0.02, parent=r)
        zp_hide_until(ta, t_change, show=False)
        zp_hide_until(tb, t_change, show=True)
    r.scale = (size, size, size)
    return r


def zp_window(loc, rot=0.0, w=3.2, h=3.0, lit=True, curtain=None, frame="#c8ccd8", glow="#e8b878"):
    """a window on a wall plane through loc (its front faces -y of its root): frame bars, an inside light panel 0.9 behind
    (lit at night: the room's glow), optional curtain panels (colour) open at the sides"""
    r = zp_root(loc, rot)
    Mf = zw_m("winframe" + frame[1:], frame, 0.4)
    for sx in (-1, 1):
        box(zp_id("wfs"), (0.2, 0.3, h + 0.4), (sx * (w / 2 + 0.1), 0, h / 2), Mf, 0.03, parent=r)
    for sz in (0, 1):
        box(zp_id("wfh"), (w + 0.6, 0.3, 0.2), (0, 0, sz * h), Mf, 0.03, parent=r)
    box(zp_id("wfm"), (0.1, 0.25, h), (0, 0, h / 2), Mf, 0.0, parent=r)
    Mg = zw_m("winglow" + glow[1:], glow, 0.5, emit=glow, estr=0.55 if lit else 0.0)
    panel = box(zp_id("wpanel"), (w + 0.4, 0.1, h + 0.4), (0, 1.0, h / 2), Mg, 0.0, parent=r)
    dark = box(zp_id("wpaneld"), (w + 0.4, 0.1, h + 0.4), (0, 1.02, h / 2), zw_m("windark", "#141a2e", 0.8), 0.0, parent=r)
    dark.hide_render = True
    out = {"root": r, "panel": panel, "dark": dark, "mat": Mg, "w": w, "h": h, "curtains": [], "loc": tuple(loc), "rot": rot}
    if curtain:
        Mc = zw_m("curtain" + curtain[1:], curtain, 0.8)
        for sx in (-1, 1):
            piv = empty(zp_id("cpiv"), (sx * w / 2, 0.25, h / 2), r, None)
            box(zp_id("curt"), (w / 2, 0.1, h), (-sx * w / 4, 0, 0), Mc, 0.02, parent=piv)
            piv.scale = (0.18, 1, 1)
            out["curtains"].append(piv)
    return out


def zp_curtain_close(win, t0, t1):
    for piv in win["curtains"]:
        piv.scale = (0.18, 1, 1)
        piv.keyframe_insert("scale", frame=F(t0))
        piv.scale = (1.0, 1, 1)
        piv.keyframe_insert("scale", frame=F(t1))


def zp_light_off(win, t):
    zp_hide_until(win["panel"], t, show=False)
    zp_hide_until(win["dark"], t, show=True)
    return
    try:
        b = next(n for n in win["mat"].node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        s = b.inputs["Emission Strength"]
        s.keyframe_insert("default_value", frame=max(1, F(t) - 1))
        s.default_value = 0.0
        s.keyframe_insert("default_value", frame=F(t))
    except Exception as e:
        print("zp_light_off: %s" % e)


def zp_door(loc, rot=0.0, color="#3a2e28", w=3.4, h=6.6):
    """a door in a frame; its hinge on the left (as seen from its front, -y); a gold lock knob on the right"""
    r = zp_root(loc, rot)
    Mf = zw_m("doorframe", "#f4f4f6", 0.5)
    for sx in (-1, 1):
        box(zp_id("dfs"), (0.25, 0.4, h + 0.25), (sx * (w / 2 + 0.12), 0, h / 2), Mf, 0.02, parent=r)
    box(zp_id("dft"), (w + 0.5, 0.4, 0.25), (0, 0, h + 0.12), Mf, 0.02, parent=r)
    hinge = empty(zp_id("hinge"), (-w / 2, 0, 0), r, None)
    box(zp_id("door"), (w, 0.2, h), (w / 2, 0, h / 2), zw_m("door" + color[1:], color, 0.5), 0.03, parent=hinge)
    lock = empty(zp_id("lock"), (w - 0.45, -0.14, h * 0.48), hinge, None)
    Mg = zw_m("gold", "#ffcf1f", 0.3, 0.9)
    box(zp_id("lockp"), (0.35, 0.06, 0.6), (0, 0, 0), Mg, 0.02, parent=lock)
    box(zp_id("lockk"), (0.32, 0.12, 0.08), (0, -0.06, 0.05), Mg, 0.02, parent=lock)
    return {"root": r, "hinge": hinge, "lock": lock, "w": w, "h": h, "loc": tuple(loc), "rot": rot}


def zp_door_open(d, t0, t1, deg=-75.0):
    hz = d["hinge"]
    hz.rotation_euler[2] = 0.0
    hz.keyframe_insert("rotation_euler", index=2, frame=F(t0))
    hz.rotation_euler[2] = math.radians(deg)
    hz.keyframe_insert("rotation_euler", index=2, frame=F(t1))


def zp_lock_turn(d, t0, t1):
    k = d["lock"]
    k.rotation_euler[1] = 0.0
    k.keyframe_insert("rotation_euler", index=1, frame=F(t0))
    k.rotation_euler[1] = math.radians(90)
    k.keyframe_insert("rotation_euler", index=1, frame=F(t1))


def zp_bed(loc, rot=0.0, color="#3d5fb8"):
    r = zp_root(loc, rot)
    box(zp_id("bedf"), (4.2, 7.4, 1.0), (0, 0, 0.5), zw_m("bedframe", "#7a5234", 0.7), 0.06, parent=r)
    box(zp_id("bedh"), (4.2, 0.4, 3.0), (0, 3.6, 1.5), zw_m("bedframe", "#7a5234", 0.7), 0.06, parent=r)
    box(zp_id("bedm"), (3.9, 7.0, 0.6), (0, -0.1, 1.25), zw_m("mattress", "#f4f6f8", 0.8), 0.1, parent=r)
    box(zp_id("bedp"), (2.6, 1.2, 0.45), (0, 2.7, 1.75), zw_m("pillow", "#ffffff", 0.9), 0.15, parent=r)
    box(zp_id("bedb"), (4.0, 4.2, 0.35), (0, -1.3, 1.62), zw_m("blanket" + color[1:], color, 0.8), 0.12, parent=r)
    return r


def zp_sign(loc, rot=0.0, text_body="FOR SALE", color="#e8302a"):
    r = zp_root(loc, rot)
    cyl(zp_id("sgp"), 0.12, 5.5, (0, 0, 2.75), zw_m("signpost", "#f4f4f6", 0.5), 8, parent=r)
    box(zp_id("sgb"), (3.8, 0.15, 2.6), (0, -0.2, 4.1), zw_m("signred" + color[1:], color, 0.5), 0.04, parent=r)
    lines = text_body.split(" ", 1) if len(text_body) > 5 else [text_body]
    for k, ln in enumerate(lines):
        text(zp_id("sgt"), ln, (0, -0.3, 4.55 - k * 0.95), 0.85, zw_m("bbtffffff", "#ffffff", 0.4), rot=(90, 0, 0), extrude=0.03, parent=r)
    return r


def zp_mailbox(loc, rot=0.0):
    r = zp_root(loc, rot)
    cyl(zp_id("mbp"), 0.12, 3.0, (0, 0, 1.5), zw_m("mbpost", "#f4f4f6", 0.5), 8, parent=r)
    box(zp_id("mbb"), (1.0, 1.8, 0.9), (0, 0, 3.3), zw_m("mailbox", "#e8302a", 0.4), 0.2, parent=r)
    return r


def zp_streetpool(loc, power=4500.0):
    if not zw_night():
        return None
    return zw_novol(light(zp_id("pool"), "SPOT", (loc[0], loc[1], 7.6), power, (1.0, 0.86, 0.62), 0.6, spot=95, blend=0.6), 0.2)


def zp_room(loc, rot=0.0, w=12.0, d=10.0, h=9.0, win_w=5.0, win_h=4.0, wall="#6f80b8", floor="#5a4436"):
    """a bedroom shell: its FRONT wall (toward -y of the root... the street side) has a real window opening (win_w x win_h,
    the sill at 2.8), a door in the back wall, a floor, a ceiling, a soft moon light through the window and a dim lamp"""
    r = zp_root(loc, rot)
    Mw, Mfl = zw_m("roomwall" + wall[1:], wall, 0.9), zw_m("roomfloor" + floor[1:], floor, 0.8)
    box(zp_id("rfl"), (w, d, 0.3), (0, d / 2, -0.15 + 0.05), Mfl, 0, parent=r)
    box(zp_id("rce"), (w, d, 0.3), (0, d / 2, h + 0.15), zw_m("roomceil", "#7d8cc0", 0.9), 0, parent=r)
    for sx in (-1, 1):
        box(zp_id("rsd"), (0.3, d, h), (sx * w / 2, d / 2, h / 2), Mw, 0, parent=r)
    dx, dw, dh = 2.0, 3.0, 6.4
    lw = w / 2 + dx - dw / 2
    box(zp_id("rbk1"), (lw, 0.3, h), (-w / 2 + lw / 2, d, h / 2), Mw, 0, parent=r)
    rw = w / 2 - dx - dw / 2
    box(zp_id("rbk2"), (rw, 0.3, h), (w / 2 - rw / 2, d, h / 2), Mw, 0, parent=r)
    box(zp_id("rbk3"), (dw, 0.3, h - dh), (dx, d, dh + (h - dh) / 2), Mw, 0, parent=r)
    sill, top = 2.8, 2.8 + win_h
    side = (w - win_w) / 2
    box(zp_id("rfa"), (side, 0.3, h), (-(win_w / 2 + side / 2), 0, h / 2), Mw, 0, parent=r)
    box(zp_id("rfb"), (side, 0.3, h), ((win_w / 2 + side / 2), 0, h / 2), Mw, 0, parent=r)
    box(zp_id("rfc"), (win_w, 0.3, sill), (0, 0, sill / 2), Mw, 0, parent=r)
    box(zp_id("rfd"), (win_w, 0.3, h - top), (0, 0, top + (h - top) / 2), Mw, 0, parent=r)
    Mf = zw_m("winframe", "#f4f4f6", 0.4)
    for sx in (-1, 1):
        box(zp_id("rwf"), (0.2, 0.45, win_h), (sx * win_w / 2, 0, sill + win_h / 2), Mf, 0.02, parent=r)
    box(zp_id("rws"), (win_w + 0.4, 0.6, 0.2), (0, 0, sill), Mf, 0.02, parent=r)
    box(zp_id("rwt"), (win_w + 0.4, 0.45, 0.2), (0, 0, top), Mf, 0.02, parent=r)
    box(zp_id("rwm"), (0.12, 0.3, win_h), (0, 0, sill + win_h / 2), Mf, 0.0, parent=r)
    door = zp_door(tuple(zp_l2w(loc, rot, (dx, d - 0.05, 0))), rot, "#efe8dc", dw, dh)
    zw_novol(light(zp_id("rmoon"), "AREA", tuple(zp_l2w(loc, rot, (0, -3.0, sill + win_h / 2))), 260.0, (0.5, 0.62, 1.0), 4.0, target=tuple(zp_l2w(loc, rot, (0, d / 2, 2.0))), shadow=True))
    zw_novol(light(zp_id("rfill"), "AREA", tuple(zp_l2w(loc, rot, (0, d * 0.45, h - 0.6))), 60.0, (0.55, 0.65, 1.0), 6.0, target=tuple(zp_l2w(loc, rot, (0, d * 0.45, 0.0))), shadow=False))
    zw_novol(light(zp_id("rlamp"), "POINT", tuple(zp_l2w(loc, rot, (-w / 2 + 1.5, d - 1.5, h - 2.0))), 120.0, (1.0, 0.8, 0.55), 1.0))
    return {"root": r, "door": door, "w": w, "d": d, "h": h, "sill": sill, "win_top": top, "loc": (loc[0], loc[1], 0.0), "rot": rot}


def zp_behind_window(ch, win, depth=0.6):
    """put ch just behind a zp_window (its root's local +y), facing out, the head in the window's middle"""
    p = zp_l2w(win["loc"], win["rot"], (0, depth, win["h"] * 0.5 - 3.8))
    ch.pose(-5.0, loc=(p.x, p.y, p.z), rot=win["rot"])
    return ch


# ---------------------------------------------------------------- SHOT RECIPES (the camera only)
def zr_key(cam, t0, t1, a0, b0, a1=None, b1=None, lens=30):
    cam.key(t0, tuple(a0), tuple(b0), lens=lens)
    cam.key(t1, tuple(a1 if a1 is not None else a0), tuple(b1 if b1 is not None else b0), lens=lens)


def zr_aerial(cam, t0, t1, over=(0, 0, 0), height=34.0, back=30.0, lens=24, push=0.12, yaw=0.0):
    o = Vector(over)
    a = math.radians(yaw)
    d = Vector((math.sin(a), -math.cos(a), 0))
    p0 = o + d * back + Vector((0, 0, height))
    p1 = p0 + (o - p0) * push
    zr_key(cam, t0, t1, p0, o, p1, o, lens)


def zr_object(cam, t0, t1, obj, dist=4.0, lens=40, side=0.0, push=0.08, up=0.0):
    bpy.context.scene.frame_set(F(t0))
    pts = zw_pts([obj])
    c = sum(pts, Vector((0, 0, 0))) / len(pts) if pts else Vector(obj.matrix_world.translation)
    f = obj.matrix_world.to_3x3() @ Vector((0, -1, 0))
    f.z = 0
    f = f.normalized() if f.length > 1e-3 else Vector((0, -1, 0))
    a = math.radians(side)
    f = Vector((f.x * math.cos(a) - f.y * math.sin(a), f.x * math.sin(a) + f.y * math.cos(a), 0))
    p0 = c + f * dist + Vector((0, 0, up))
    p1 = p0 + (c - p0) * push
    zr_key(cam, t0, t1, p0, c, p1, c, lens)


def zr_over_shoulder(cam, t0, t1, ch, target, side=1.0, lens=32, push=0.06, back=3.2, up=1.0):
    here = za_here(ch, t0)
    s = ch.root.scale[2]
    head = here + Vector((0, 0, 4.6 * s))
    tg = za_pos(target)
    d = tg - here
    d.z = 0
    d = d.normalized() if d.length > 1e-3 else Vector((0, 1, 0))
    right = Vector((d.y, -d.x, 0))
    p0 = head - d * back + right * side * 1.3 + Vector((0, 0, up))
    aim = tg + Vector((0, 0, 3.5)) if not hasattr(target, "root") else za_pos(target) + Vector((0, 0, 3.6))
    p1 = p0 + (aim - p0).normalized() * (back * push)
    zr_key(cam, t0, t1, p0, aim, p1, aim, lens)


def zr_through_window(cam, t0, t1, room, target, lens=30, push=0.05, back=5.5):
    """from inside the room, eye height, through the window to target (the window frame around the view)"""
    L, R = tuple(room["loc"]), room["rot"]
    win = zp_l2w(L, R, (0, 0, room["sill"] + 1.8))
    inside = zp_l2w(L, R, (0.6, back, room["sill"] + 2.2))
    tg = za_pos(target) + Vector((0, 0, 2.6))
    p1 = inside + (win - inside) * push * 4
    zr_key(cam, t0, t1, inside, tg, p1, tg, lens)


def zr_at_window(cam, t0, t1, room, ch=None, dist=7.0, lens=34, push=0.06):
    """from outside (the street side), looking at the window (someone at it)"""
    L, R = tuple(room["loc"]), room["rot"]
    win = zp_l2w(L, R, (0, 0, room["sill"] + 2.0))
    out = zp_l2w(L, R, (0.8, -dist, room["sill"] + 1.4))
    p1 = out + (win - out) * push
    zr_key(cam, t0, t1, out, win, p1, win, lens)


def zr_door_behind(cam, t0, t1, ch, door, lens=28, push=0.04):
    """the door behind someone: their head big in the near frame (one side), the door deep in the room"""
    here = za_here(ch, t0)
    dp = zp_l2w(door["loc"], door["rot"], (0, 0, 3.4))
    d = dp - here
    d.z = 0
    d = d.normalized() if d.length > 1e-3 else Vector((0, 1, 0))
    right = Vector((d.y, -d.x, 0))
    p0 = here - d * 1.6 + right * 1.0 + Vector((0, 0, 4.9))
    p1 = p0 + (dp - p0) * push
    zr_key(cam, t0, t1, p0, dp, p1, dp, lens)


def zr_face(cam, t0, t1, ch, push=0.05):
    return zw_frame(cam, [ch], t0, t1, kind="close", push=push)


def zr_top_down(cam, t0, t1, ch, height=11.0, lens=30, push=0.06):
    here = za_here(ch, t0) + Vector((0, 0, 1.6))
    p0 = here + Vector((0.01, 0.4, height))
    p1 = p0 + (here - p0) * push
    zr_key(cam, t0, t1, p0, here, p1, here, lens)


def zr_street_long(cam, t0, t1, frm=(40, -2, 3.2), to=(-120, 2, 3.0), lens=24, push=0.08):
    p0, tg = Vector(frm), Vector(to)
    zr_key(cam, t0, t1, p0, tg, p0 + (tg - p0).normalized() * 3.0 * push * 10, tg, lens)
# ===== END OF PIECES + SHOT RECIPES =================================================================================
