# ===== ROUND 9b (owner 2026-11-23): "IF THE ENGINE DOESN'T HAVE IT, BUILD IT" =========================================
# Pasted after stage9.py. Every piece the chalk-line replica needed and the engine did not have, built as a reusable
# piece (each is on the generated engine list):
#   SET        zs_low_house: a low brick house with a big lawn and dim windows (ZS["low_houses"]); zs_rain_streaks:
#              rain you can see (falling streaks near the camera); porch lights for a crowd at night
#   CHALK      thick, bright white chalk that reads at phone size, lit at night; zs_draw_path: the chalk in the hand
#              touches the ground and the line appears behind it as the drawer moves (crouched / bent-over run);
#              zs_wash2: the line fades and streaks away bit by bit in the rain
#   EFFECT     zs_wall_flash: a faint see-through curved wall flashes up from a chalk circle, a ripple where it is hit
#   PEOPLE     the pizza box (two hands); zs_dad: an older dad (balding, grey sides, moustache, white t-shirt, striped
#              pajama trousers)
#   MOTION     zs_gait: new walk / run styles: "panic" (leaning, arms pumping, a slip), "sprint", "chalk_run" (bent
#              over, the chalk hand down), "crouch" (drawing), "monster" (slow long stiff steps, arms hanging and
#              dragging, the head tilting)
#   MONSTER    pure black matte (never grey or shiny), thin + jointed (elbows, knees), arms down to the road; the roof
#              on posts sized to it (zs_roof_over)
#   CAMERA     zc_cut kinds "aerial" (high above, down the road at an angle), "high" (above a house), "legs" (only the
#              monster's legs and hanging arms)

# ---------------------------------------------------------------- SET: the low brick house (item 12)
ZW_HOUSE8 = zw_house
ZS_BRICKS = ["#7b4636", "#8a5240", "#6e3f31", "#93604b", "#7f4a3c"]


def zw_house(i, x, side, col):
    if not ZS.get("low_houses"):
        return ZW_HOUSE8(i, x, side, col)
    """a LOW brick house (one storey) set back on a big lawn: brick body, a low dark roof, white trim, a door, dim windows"""
    y = 28.0 * side
    W, Dp, Hh = 15.0, 11.0, 6.2
    fy = y - side * Dp / 2.0
    Mb = zw_m("house_brick%d" % (i % 5), ZS_BRICKS[i % 5], 0.85)
    box("zw_h%d" % i, (W, Dp, Hh), (x, y, Hh / 2), Mb, 0.05)
    Mr = zw_m("roof_dark", "#2f3238", 0.8)
    for s in (-1, 1):
        box("zw_hr%d_%d" % (i, s), (W + 1.2, Dp / 2.0 + 1.4, 0.45), (x, y + s * Dp / 4.0, Hh + 1.1), Mr, 0.05, rot=(-20 * s, 0, 0))
    box("zw_hbase%d" % i, (W + 0.3, Dp + 0.3, 0.5), (x, y, 0.25), zw_m("hbase", "#b9b0a3", 0.8), 0.03)
    box("zw_hdoor%d" % i, (1.8, 0.25, 3.4), (x - 2.5, fy - side * 0.08, 1.9), zw_m("hdoor_dark", "#3a2c26", 0.6), 0.03)
    Mt = zw_m("trimw", "#e9e4dc", 0.6)
    for k, wx in enumerate((x + 1.8, x + 5.0)):
        lit = zw_win_lit(i + k) and zw_time() in ("night", "sunset", "storm")
        Mg = zw_m("winlow_lit" if lit else "winlow_dark", "#ffcf8a" if lit else "#1e2738", 0.3, emit="#ffb866" if lit else None, estr=0.9 if lit else 0.0)
        box("zw_hwin%d_%d" % (i, k), (2.2, 0.2, 1.7), (wx, fy - side * 0.1, 3.0), Mg, 0.0)
        box("zw_hwinf%d_%d" % (i, k), (2.5, 0.15, 2.0), (wx, fy - side * 0.03, 3.0), Mt, 0.02)
    # the walk from the sidewalk to the door + the lawn's edge
    box("zw_hpath%d" % i, (1.6, abs(fy - side * 9.8), 0.08), (x - 2.5, (fy + side * 9.8) / 2.0, 0.05), zw_m("path_low", "#5c5a57", 0.9), 0.0)
    return None


def zs_rain_streaks(t0, t1, near=(0.0, 9.0), n=320, area=18.0, seed=9):
    """RAIN YOU CAN SEE (item 12): long thin pale streaks falling fast near the stage (the camera's side)"""
    rnd = random.Random(seed)
    src = collection("zs_rainsrc")
    M = zw_m("rainstreak", "#cfe0ff", 0.2, emit="#dfe9ff", estr=1.4, alpha=0.6)
    cyl("zs_rs0", 0.022, 2.2, (0, 0, 0), M, 5, rot=(6, 0, 0), coll=src)
    hide_coll_from_layer(src)
    dur = max(0.5, t1 - t0)
    for k in range(n):
        x, y = near[0] + rnd.uniform(-area, area), near[1] + rnd.uniform(-area, area * 0.6)
        ob = instance("zs_rain%d" % k, src, (x, y, 20.0))
        per = rnd.uniform(0.55, 0.8)
        t = t0 - rnd.uniform(0.0, per)
        while t < t1 + per:
            ob.location = (x, y, 18.0)
            ob.keyframe_insert("location", frame=F(t))
            set_interp(ob, "location", F(t), "LINEAR")
            ob.location = (x, y, -1.0)
            ob.keyframe_insert("location", frame=F(t + per) - 1)
            set_interp(ob, "location", F(t + per) - 1, "LINEAR")
            t += per
    return src


ZS_LIGHT9 = zs_light


def zs_light(time, t0, t1):
    r = ZS_LIGHT9(time, t0, t1)
    if time == "storm":
        st_c, st_d, st_r, st_rot = zw_stage(ZS["place"] or "suburb_street")
        zs_rain_streaks(t0 - 1.0, t1 + 1.0, near=(st_c.x, st_c.y))
    return r


# ---------------------------------------------------------------- CHALK (items 2-4)
def zs_chalk_mat():
    night = zw_time() in ("night", "storm") or ZS.get("deep")
    return zw_m("chalk_bright" + ("_n" if night else "_d"), "#ffffff", 0.9, emit="#f4f7ff", estr=2.6 if night else 0.9)


ZS_CHALK_W = 0.55   # thick: readable at phone size


def zs_chalk_path(name, pts, closed=True, width=None):
    return zs_chalk_path9(name, pts, closed, width or ZS_CHALK_W)


def zs_chalk_path9(name, pts, closed, width):
    r = empty(name, (0, 0, 0), None)
    M = zs_chalk_mat()
    P = list(pts) + ([pts[0]] if closed else [])
    for k in range(len(P) - 1):
        a, b = Vector((P[k][0], P[k][1], 0.0)), Vector((P[k + 1][0], P[k + 1][1], 0.0))
        d = b - a
        L = d.length
        if L < 1e-3:
            continue
        c = (a + b) / 2
        yaw = math.degrees(math.atan2(d.y, d.x))
        box("%s_s%03d" % (name, k), (L + width * 0.7, width, 0.04), (c.x, c.y, 0.1), M, 0.0, rot=(0, 0, yaw), parent=r)
    r["pts"] = [list(p) for p in pts]
    return r


def zs_house_rings(place, near=None, n=6, owner_k=None):
    """a chalk line round each house's lot (from the house's own size: the big lawn in front)"""
    st_c, st_d, st_r, st_rot = zw_stage(place)
    c = Vector(za_pos(near, (st_c.x, st_c.y, 0.0)))
    hs = [o for o in D.objects if o.type == "MESH" and o.name.startswith("zw_h") and o.name[4:].isdigit()]
    hs.sort(key=lambda o: (Vector((o.location.x, o.location.y, 0)) - Vector((c.x, c.y, 0))).length)
    out = {}
    for o in hs[:n]:
        x, y = o.location.x, o.location.y
        side = 1 if y > 0 else -1
        w, dp = o.dimensions.x / 2.0, o.dimensions.y / 2.0
        front = y - side * (dp + 6.0)
        back = y + side * (dp + 1.5)
        out[int(o.name[4:])] = zs_chalk_path("zs_ring%s" % o.name[4:], zs_rect_pts(x - w - 1.5, min(front, back), x + w + 1.5, max(front, back), 1.6), closed=True)
    return out


def zs_draw_path(ch, pts, t0, t1, name, style="crouch", chalk=None, closed=False, reveal=True):
    """DRAWING (item 3): the drawer goes along the points in `style` (crouched / bent-over run), the chalk in the right
    hand down at the ground, and each piece of the line appears just behind the chalk as they pass it"""
    r = zs_chalk_path(name, pts, closed=closed)
    segs = zs_segs(r)
    P = [Vector((p[0], p[1], 0.0)) for p in pts] + ([Vector((pts[0][0], pts[0][1], 0.0))] if closed else [])
    Ls = [(P[k + 1] - P[k]).length for k in range(len(P) - 1)]
    tot = max(1e-3, sum(Ls))
    zs_gait(ch, t0, t1, [(p.x, p.y) for p in P], style)
    if reveal:
        acc = 0.0
        for k, o in enumerate(segs):
            acc += Ls[k] if k < len(Ls) else 0.0
            ts = t0 + (t1 - t0) * acc / tot
            o.scale = (0.001, 1.0, 1.0)
            o.keyframe_insert("scale", frame=max(1, F(ts - (t1 - t0) * Ls[min(k, len(Ls) - 1)] / tot)))
            o.scale = (1.0, 1.0, 1.0)
            o.keyframe_insert("scale", frame=F(ts))
    if chalk is not None:
        zw_grab(ch, t0 - 0.2, chalk)
    return r


def zs_draw_around(ch, target, t0, t1, name, rad=None):
    """the kid RUNS BENT OVER round a character dragging the chalk: the circle grows behind them and closes at t1"""
    c = za_here(target, t0) if hasattr(target, "root") else Vector(za_pos(target))
    rad = rad or (4.2 * zw_ps() / 0.55 if hasattr(target, "root") and target.name in ZW_MON else 2.0 * zw_ps() / 0.55)
    p0 = za_here(ch, t0)
    a0 = math.atan2(p0.y - c.y, p0.x - c.x)
    pts = [(c.x + rad * math.cos(a0 + 2 * math.pi * k / 20), c.y + rad * math.sin(a0 + 2 * math.pi * k / 20)) for k in range(21)]
    return zs_draw_path(ch, pts[:-1], t0, t1, name, style="chalk_run", closed=True)


def zs_wash2(r, t0, t1, toward=(0.0, -1.0)):
    """the line WASHES AWAY in the rain (item 4): each piece thins, streaks a little downhill and fades out, one after
    another (not a pop)"""
    S = zs_segs(r)
    rnd = random.Random(len(S))
    dv = Vector((toward[0], toward[1], 0.0)).normalized()
    Ms = zw_m("chalkstreak", "#ffffff", 0.9, emit="#f4f7ff", estr=1.2, alpha=0.6)
    for k, o in enumerate(S):
        ts = t0 + (t1 - t0) * (k / max(1, len(S))) * 0.7 + rnd.uniform(0.0, 0.15)
        p = Vector(o.location)
        o.keyframe_insert("scale", frame=F(ts))
        o.keyframe_insert("location", frame=F(ts))
        o.scale = (1.15, 0.45, 1.0)
        o.location = p + dv * 0.25
        o.keyframe_insert("scale", frame=F(ts + 0.45))
        o.keyframe_insert("location", frame=F(ts + 0.45))
        o.scale = (0.6, 0.02, 1.0)
        o.location = p + dv * 0.6
        o.keyframe_insert("scale", frame=F(ts + 1.0))
        o.keyframe_insert("location", frame=F(ts + 1.0))
        # a thin streak runs off it
        if k % 2 == 0:
            st = box("%s_streak%d" % (r.name, k), (0.12, 0.9, 0.03), (p.x, p.y, 0.11), Ms, 0.0, rot=(0, 0, math.degrees(math.atan2(dv.y, dv.x)) + 90))
            st.scale = (0.001, 0.001, 0.001)
            st.keyframe_insert("scale", frame=F(ts + 0.2) - 1)
            st.scale = (1.0, 1.0, 1.0)
            st.keyframe_insert("scale", frame=F(ts + 0.2))
            st.location = p + dv * 1.6
            st.keyframe_insert("location", frame=F(ts + 1.1))
            st.scale = (0.3, 0.001, 1.0)
            st.keyframe_insert("scale", frame=F(ts + 1.1))
    return r


zs_wash = zs_wash2


def zs_ring_pts(r):
    if r is None:
        return []
    if "pts" in r:
        return [tuple(p) for p in r["pts"]]
    return [(o.location.x, o.location.y) for o in zs_segs(r)]


def zs_ring_center(r):
    P = zs_ring_pts(r)
    if not P:
        return (0.0, 0.0, 0.0)
    return (sum(p[0] for p in P) / len(P), sum(p[1] for p in P) / len(P), 0.0)


def zs_ring_front(r, near=None):
    """the edge of a chalk line nearest the road (the one the dad redraws), from the drawer's end, about 7 units"""
    P = zs_ring_pts(r)
    if not P:
        return [(0.0, 9.0), (6.0, 9.0)]
    ymin = min(abs(p[1]) for p in P)
    E = sorted([p for p in P if abs(abs(p[1]) - ymin) < 0.4], key=lambda p: p[0])
    if near is not None and len(E) > 1:
        q = Vector(za_pos(near))
        if abs(E[-1][0] - q.x) < abs(E[0][0] - q.x):
            E = E[::-1]
    out, L = [E[0]], 0.0
    for p in E[1:]:
        L += math.hypot(p[0] - out[-1][0], p[1] - out[-1][1])
        out.append(p)
        if L > 7.0:
            break
    return out


# ---------------------------------------------------------------- EFFECT: the invisible wall (item 5)
def zs_wall_flash(center, rad, height, t, hit=None):
    """a faint see-through CURVED WALL flashes up from a chalk circle at t (rises in 0.15 s, glows, fades by t + 0.9),
    and a ripple spreads from where it was hit"""
    c = Vector(za_pos(center))
    M = zw_m("wallglow", "#bfe3ff", 0.1, emit="#cfeaff", estr=0.35, alpha=0.1)   # (the clip: 1.6 read as a solid glowing tube; the reference is faint)
    r = empty("zs_wall%d" % F(t), (c.x, c.y, 0.0), None)
    n = 28
    for k in range(n):
        a = 2 * math.pi * k / n
        box("zs_wallp%d_%d" % (F(t), k), (2 * math.pi * rad / n + 0.05, 0.06, height), (rad * math.cos(a), rad * math.sin(a), height / 2), M, 0.0, rot=(0, 0, math.degrees(a) + 90), parent=r)
    r.scale = (1.0, 1.0, 0.001)
    r.keyframe_insert("scale", frame=F(t) - 1)
    r.scale = (1.0, 1.0, 1.0)
    r.keyframe_insert("scale", frame=F(t + 0.15))
    r.keyframe_insert("scale", frame=F(t + 1.5))
    r.scale = (1.0, 1.0, 0.001)
    r.keyframe_insert("scale", frame=F(t + 1.9))
    if hit is not None:
        h = Vector(za_pos(hit))
        d = Vector((h.x - c.x, h.y - c.y, 0.0))
        d = d.normalized() if d.length > 1e-3 else Vector((1, 0, 0))
        p = c + d * rad
        Mr = zw_m("ripple", "#e8f6ff", 0.1, emit="#e8f6ff", estr=3.0, alpha=0.5)
        rg = cyl("zs_ripple%d" % F(t), 0.4, 0.05, (p.x, p.y, max(1.0, h.z * 0.5)), Mr, 24, rot=(90, 0, math.degrees(math.atan2(d.y, d.x)) + 90))
        rg.scale = (0.2, 0.2, 1.0)
        rg.keyframe_insert("scale", frame=F(t))
        rg.scale = (4.0, 4.0, 1.0)
        rg.keyframe_insert("scale", frame=F(t + 0.45))
        rg.scale = (0.001, 0.001, 0.001)
        rg.keyframe_insert("scale", frame=F(t + 0.5))
    print("ZW_FRAMED|-|wall|the invisible wall at %.2f" % t)
    return r


def zs_monster_hits_wall(m, t, circle_center, rad):
    """the monster's hand slams down at the circle: the arm reaches, the wall flashes where it hits"""
    m.pose(t - 0.35, armR=(20, 6))
    m.pose(t, armR=(95, 4))
    m.pose(t + 0.25, armR=(80, 6))
    bpy.context.scene.frame_set(F(t))
    arm = D.objects.get(m.name + "_armR")
    hit = arm.matrix_world @ Vector((0, 0, -2.0)) if arm is not None else za_here(m, t)
    return zs_wall_flash(circle_center, rad, 6.0 * m.root.scale[2] / 2.2, t, hit=hit)


ZS_CROWD9 = zs_crowd


def zs_crowd(t0, t1, n=10, thing=None, do="cheer", near=None, where=None):
    """(the replica's crowd at night came out black: a warm porch light over each person on a dark street)"""
    out = ZS_CROWD9(t0, t1, n=n, thing=thing, do=do, near=near, where=where)
    if zw_time() in ("night", "storm") or ZS.get("deep"):
        for k, ch in enumerate(out):
            p = ch.root.location
            zw_novol(light("zs_crowdl%d" % k, "POINT", (p.x, p.y - 1.0, 4.5), 90.0, (1.0, 0.8, 0.55), 0.6), 0.2)
    return out


# ---------------------------------------------------------------- PEOPLE (items 6-7)
def zt_build_pizza_box(r, c=None, col=None):
    box("zt_pzb%d" % ZT_N["n"], (1.9, 1.9, 0.32), (0, 0, 0.16), zt_m("pizzabox", "#c9a26b", 0.85), 0.03, parent=r, coll=c)
    box("zt_pzt%d" % ZT_N["n"], (1.9, 0.35, 0.02), (0, 0, 0.33), zt_m("pizzastripe", "#c0392b", 0.6), 0.0, parent=r, coll=c)
    return r


ZT_BUILD9 = zt_build


def zt_build(kind, r, c, col):
    if kind == "pizza_box":
        return zt_build_pizza_box(r, c, col)
    return ZT_BUILD9(kind, r, c, col)


ZW_THING_SIZE.update({"pizza_box": 1.0})
ZP_TWO_HANDS = tuple(ZP_TWO_HANDS) + ("pizza_box",)


def zs_dad(ch):
    """an older DAD (our own design): balding with grey sides, a dark moustache, a white t-shirt, striped pajama trousers"""
    H = ch.head
    for o in list(ch.root.children_recursive):
        if o.type == "MESH" and any(sl.material is not None and sl.material.name.startswith(ch.name + "_hair") for sl in o.material_slots):
            o.scale = (0.0001, 0.0001, 0.0001)
    Mg = zw_m("dad_grey", "#9a948c", 0.7)
    for sx in (-1, 1):
        box(ch.name + "_tuft%d" % sx, (0.18, 0.75, 0.5), (sx * 0.6, 0.05, 0.25), Mg, 0.06, parent=H)
    box(ch.name + "_tuftb", (1.0, 0.18, 0.45), (0, 0.6, 0.25), Mg, 0.06, parent=H)
    box(ch.name + "_moustache", (0.62, 0.08, 0.16), (0, -0.66, -0.1), zw_m("dad_moust", "#2a1c14", 0.6), 0.04, parent=H)
    Ms = zw_m("pj_stripe", "#ffffff", 0.7)
    for leg in ("_legL", "_legR"):
        lg = D.objects.get(ch.name + leg)
        if lg is None:
            continue
        for k in range(4):
            box(ch.name + leg + "_pj%d" % k, (1.02, 1.04, 0.12), (0, 0, -1.7 + k * 0.45), Ms, 0.0, parent=lg)
    return ch


ZW_PERSON9 = zw_person


def zw_person(name, look, loc, rot, t0):
    ch = ZW_PERSON9(name, look, loc, rot, t0)
    if (look or {}).get("style") == "dad":
        zs_dad(ch)
    return ch


# ---------------------------------------------------------------- MOTION (item 8): the new gaits
ZS_GAITS = {
    # swing (leg degrees), arm (degrees), lean (torso pitch), bob, steps a second, hipz (crouch), the arm style
    "walk": (24, 22, 0, 0.1, 1.6, 0.0, "swing"),
    "run": (40, 50, 10, 0.2, 2.4, 0.0, "swing"),
    "panic": (46, 72, 24, 0.24, 2.6, 0.0, "pump"),
    "sprint": (52, 78, 18, 0.26, 3.0, 0.0, "pump"),
    "chalk_run": (34, 20, 52, 0.12, 2.6, -0.45, "chalk"),
    "crouch": (14, 6, 36, 0.03, 1.1, -0.42, "chalk"),
    "monster": (30, 4, 6, 0.06, 0.55, 0.0, "hang"),
}


def zs_gait(ch, t0, t1, pts, style="walk"):
    """a walk / run in a STYLE along ground points from t0 to t1 (the root moves at an even speed, faces the way, the
    legs step at the style's rate, the arms as the style says; "panic" slips once half way; "monster" tilts its head)"""
    sw, arm, lean, bob, rate, hipz, astyle = ZS_GAITS.get(style, ZS_GAITS["walk"])
    P = [Vector((float(p[0]), float(p[1]), 0.0)) for p in pts]
    if len(P) < 2:
        return ch
    Ls = [(P[k + 1] - P[k]).length for k in range(len(P) - 1)]
    tot = max(1e-3, sum(Ls))
    t = t0
    ch.pose(t0, loc=tuple(P[0]), interp="LINEAR")
    for k in range(len(P) - 1):
        dt = (t1 - t0) * Ls[k] / tot
        d = P[k + 1] - P[k]
        if d.length > 1e-3:
            ch.pose(t, rot=math.degrees(math.atan2(d.x, -d.y)), interp="LINEAR")
        t += dt
        ch.pose(t, loc=tuple(P[k + 1]), interp="LINEAR")
    ch.pose(t0, torso=(0, lean, 0), hipz=hipz)
    ch.pose(t1, torso=(0, lean, 0), hipz=hipz)
    step = 1.0 / (rate * 2.0)
    tt, k = t0 + step * 0.4, 0
    while tt <= t1 - step * 0.3:
        sg = 1 if k % 2 == 0 else -1
        kw = dict(legL=(sw * sg, 0), legR=(-sw * sg, 0), hipz=hipz)
        if astyle == "swing" or astyle == "pump":
            kw.update(armL=(-arm * sg, 8), armR=(arm * sg, 8))
        elif astyle == "chalk":
            kw.update(armL=(-arm * sg, 10), armR=(78, -6))
        elif astyle == "hang":
            kw.update(armL=(arm * sg, 3), armR=(-arm * sg, 3), head=(0, 4, 10 * sg))
        ch.pose(tt, **kw)
        if tt + step * 0.5 < t1:
            ch.pose(tt + step * 0.5, hipz=hipz + bob, legL=(0, 0), legR=(0, 0))
        tt += step
        k += 1
    if style == "panic":
        ts = (t0 + t1) / 2.0
        ch.pose(ts - 0.1, torso=(0, lean, 0))
        ch.pose(ts, torso=(0, lean + 10, 14), hipz=-0.35)
        ch.pose(ts + 0.22, torso=(0, lean, 0), hipz=0.0)
    end = dict(legL=(0, 0), legR=(0, 0), hipz=0.0, torso=(0, 0, 0))
    if astyle in ("swing", "pump"):
        end.update(armL=(0, 4), armR=(0, 4))
    ch.pose(t1 + 0.2, **end)
    return ch


ZS_WALK_STYLE = {}   # a character's own walk (the monster walks its own way everywhere)


def zm_walk(ch, t0, t1, to, run=False, face=True, arms=True, turn=True):
    style = ZS_WALK_STYLE.get(ch.name) or (ZS_RUN_STYLE.get(ch.name) if run else None)
    if style:
        p0 = za_here(ch, t0)
        b = Vector(za_pos(to, tuple(p0)))
        if (Vector((b.x, b.y, 0)) - Vector((p0.x, p0.y, 0))).length < 0.2:
            return ch
        return zs_gait(ch, t0, max(t0 + 0.3, t1), [(p0.x, p0.y), (b.x, b.y)], style)
    return ZM_WALK9(ch, t0, max(t0 + 0.3, t1), to, run=run, face=face, arms=arms, turn=turn)


ZS_RUN_STYLE = {}   # a character's own run ("panic" for the dad in the rain, "sprint" for the kid)


# ---------------------------------------------------------------- THE MONSTER (item 9) + its roof (item 10)
ZW_MON9B = zw_monster


def zw_monster(name, loc, rot=0.0, size=3.5, style="horns", **kw):
    m = ZW_MON9B(name, loc, rot=rot, size=size, style=style, **kw)
    if style != "shadow":
        return m
    ZS_WALK_STYLE[m.name] = "monster"
    # pure black MATTE (never grey or shiny): no specular, full roughness, a faint outline only
    for nm in (name + "_skin", name + "_shirt", name + "_pants"):
        mt = bpy.data.materials.get(nm)
        if mt is None or not mt.use_nodes:
            continue
        for nd in mt.node_tree.nodes:
            if nd.type == "BSDF_PRINCIPLED":
                nd.inputs["Base Color"].default_value = (0.004, 0.004, 0.006, 1.0)
                nd.inputs["Roughness"].default_value = 1.0
                for key in ("Specular IOR Level", "Specular"):
                    if key in nd.inputs:
                        nd.inputs[key].default_value = 0.0
                        break
            if nd.type == "MATH" and nd.operation == "MULTIPLY":
                nd.inputs[1].default_value = 1.3
    # the arms hang from the shoulders (the long arm block's top stays at the shoulder) and the limbs get JOINTS
    Mj = zw_m("shadow_joint", "#020203", 1.0)
    for side in ("L", "R"):
        armo = D.objects.get(name + "_arm" + side)
        if armo is not None:
            armo.location = (armo.location.x, armo.location.y, 0.45 - armo.scale[2])
        sh = m.shL if side == "L" else m.shR
        hp = m.hpL if side == "L" else m.hpR
        sphere(name + "_elbow" + side, 0.32, (0, 0, -1.9), Mj, parent=sh, coll=m.coll, seg=10)
        sphere(name + "_knee" + side, 0.36, (0, 0, -1.0), Mj, parent=hp, coll=m.coll, seg=10)
        sphere(name + "_shoulder" + side, 0.4, (0, 0, 0.1), Mj, parent=sh, coll=m.coll, seg=10)
    return m


def zs_roof_over(roof, m, t):
    """the town's ROOF ON POSTS over the monster (item 10): sized so it stands fully under it, centred on it"""
    if roof is None or m is None:
        return roof
    bpy.context.scene.frame_set(F(t))
    bpy.context.view_layer.update()
    vp = zw_vpts([m.root])
    top = max([p.z for p in vp] + [8.0])
    s = top * 1.12 / 6.4
    p = za_here(m, t)
    roof.location = (p.x, p.y, 0.0)
    ZS_SIZE[roof.name] = (s, s, s)
    return zo_appear(roof, t)


# ---------------------------------------------------------------- THE CAMERA: measured to the target (size + position)
def zc_fix_frame(cam, t0, t1, people, things, frac, v=None, tries=2):
    """after a cut is framed: MEASURE the subjects at the middle frame and move the camera along its view (closer /
    further) until their height share is `frac`, and tilt it until their vertical centre is `v` (the replica's 10 %)"""
    sc = bpy.context.scene
    tm = (t0 + t1) / 2.0
    for it in range(tries):
        sc.frame_set(F(tm))
        bpy.context.view_layer.update()
        pts = []
        for ch in people:
            pts += zw_vpts([ch.root]) if ch is not None else []
        for o in things:
            pts += (zw_vpts([o]) or zw_pts([o])) if o is not None else []
        if not pts:
            return cam
        sp = zw_span(cam.ob, pts)
        if sp is None:
            return cam
        h = max(0.02, min(1.0, sp[3]) - max(0.0, sp[2]))
        vc = (max(0.0, sp[2]) + min(1.0, sp[3])) / 2.0
        k = 1.0 if frac is None or abs(h - frac) < 0.05 else max(0.4, min(2.6, h / max(0.05, frac)))
        dv = 0.0 if v is None or abs(vc - v) < 0.05 else (vc - v)
        if k == 1.0 and dv == 0.0:
            return cam
        c = Vector((sum(p.x for p in pts) / len(pts), sum(p.y for p in pts) / len(pts), sum(p.z for p in pts) / len(pts)))
        for t in (t0, t1):
            sc.frame_set(F(t))
            bpy.context.view_layer.update()
            loc = Vector(cam.ob.matrix_world.translation)
            fwd = cam.ob.matrix_world.to_3x3() @ Vector((0, 0, -1))
            dist = max(0.5, (c - loc).length)
            aim = loc + fwd * dist
            nl = aim + (loc - aim) * k
            nl.z = max(0.45, nl.z)
            vis = 2.0 * dist * k * (12.0 / max(8.0, cam.cd.lens))
            na = aim - Vector((0, 0, dv * vis))
            cam.key(t, tuple(nl), tuple(na), lens=cam.cd.lens)
    ZW_FRAMED["fix"] = "measured to size %.2f / position %s" % (frac or 0, "-" if v is None else "%.2f" % v)
    return cam


# ---------------------------------------------------------------- THE CAMERA: aerial / high / legs
ZC_CUT9B = zc_cut


def zc_cut(t0, t1, kind, people=(), things=(), move="push_in", side=None, hero=None, tag="", frac=None, v=None):
    cam = zc_cut9b(t0, t1, kind, people, things, move, side, hero, "", frac)
    if (frac is not None or v is not None) and kind not in ("aerial", "high", "place", "street", "top"):
        P = [p for p in people if p is not None]
        Tt = [o for o in things if o is not None]
        if kind == "legs":
            Tt = []
        zc_fix_frame(cam, t0, t1, P, Tt, frac, v)
    if tag:
        zc_measure(cam, t0, t1, [p for p in people if p is not None], [o for o in things if o is not None], tag)
    return cam


def zc_cut9b(t0, t1, kind, people=(), things=(), move="push_in", side=None, hero=None, tag="", frac=None):
    if kind == "aerial":
        # high above, looking down the road at an angle (the reference's opening): the stage's street, slow pan
        st_c, st_d, st_r, st_rot = zw_stage(ZS["place"] or "suburb_street")
        cam = Cam()
        loc = Vector((st_c.x - 26.0, st_c.y - 22.0, 30.0))
        a0, a1 = Vector((st_c.x + 14.0, st_c.y + 10.0, 0.0)), Vector((st_c.x + 4.0, st_c.y + 16.0, 0.0))
        cam.key(t0, tuple(loc), tuple(a0), lens=24)
        cam.key(t1, tuple(loc + Vector((2.0, 0.0, -1.0))), tuple(a1), lens=24)
        print("ZW_FRAMED|%s|measure|place" % tag)
        return cam
    if kind == "high" and things:
        bpy.context.scene.frame_set(F(t0))
        o = things[0]
        p = Vector(zs_ring_center(o)) if "pts" in o else (Vector(o.matrix_world.translation) if not hasattr(o, "root") else za_here(o, t0))
        side_y = -1.0 if p.y > 0 else 1.0
        cam = Cam()
        cam.key(t0, (p.x - 6.0, p.y + side_y * 20.0, 17.0), (p.x, p.y, 1.0), lens=24)
        cam.key(t1, (p.x - 5.0, p.y + side_y * 18.5, 15.5), (p.x, p.y, 1.0), lens=24)
        print("ZW_FRAMED|%s|measure|place" % tag)
        return cam
    if kind == "legs" and people:
        # ONLY the monster's legs and hanging arms (the reference's close monster shots)
        mon = [p for p in people if p.name in ZW_MON] or [people[0]]   # (a kid's legs at the line too: ref 13)
        if mon:
            m = mon[0]
            tm = (t0 + t1) / 2.0
            bpy.context.scene.frame_set(F(tm))
            vp = zw_vpts([m.root])
            top = max([p.z for p in vp] + [6.0])
            cam = Cam()
            pts = [p for p in vp if p.z < top * 0.55] + [o for o in []]
            if pts:
                r = zw_fit(cam, pts, zw_front([m]), t0, t1, 22, ZW_SAFE, frac=0.85, cam_dz=-0.3 * top * 0.55, yaws=(15.0, -15.0, 30.0, -30.0, 0.0), push=0.06, skip=(m.name + "_",), tag="legs")
                zc_measure(cam, t0, t1, [m], [], tag)
                return cam
    return ZC_CUT9B(t0, t1, kind, people, things, move, side, hero, tag, frac)
# ===== END OF STAGE 9b ===============================================================================================


# ---------------------------------------------------------------- round 9b fix 2: chalk that melts, dusk that is dusk
def zs_melt(obj, t, dur=1.2):
    """a held thing MELTS (the chalk in the rain): it shrinks and flattens over dur, a little white drip falls"""
    if obj is None:
        return obj
    s = tuple(obj.scale)
    obj.keyframe_insert("scale", frame=F(t))
    obj.scale = (s[0] * 1.25, s[1] * 1.25, s[2] * 0.45)
    obj.keyframe_insert("scale", frame=F(t + dur * 0.6))
    obj.scale = (0.001, 0.001, 0.001)
    obj.keyframe_insert("scale", frame=F(t + dur))
    return obj


ZS_LIGHT9B = zs_light


def zs_light(time, t0, t1):
    r = ZS_LIGHT9B(time, t0, t1)
    if time == "sunset":
        # DUSK (the reference's opening): a low warm dim sun, darker grass
        for o in D.objects:
            if o.type == "LIGHT" and o.data.type == "SUN":
                o.data.energy = o.data.energy * 0.5
                o.data.color = (1.0, 0.66, 0.42)
        for m in bpy.data.materials:
            if m.use_nodes and m.name.startswith("zw_grass"):
                for nd in m.node_tree.nodes:
                    if nd.type == "BSDF_PRINCIPLED":
                        if "zs_c0" not in m:
                            m["zs_c0"] = list(nd.inputs["Base Color"].default_value)
                        c = m["zs_c0"]
                        nd.inputs["Base Color"].default_value = (c[0] * 0.55, c[1] * 0.5, c[2] * 0.45, 1.0)
    return r
