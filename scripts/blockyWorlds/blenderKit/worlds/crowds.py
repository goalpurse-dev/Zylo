# ===== ZYVO PROPS, CROWDS + TRAFFIC WITH LOGIC (worlds/crowds.py, owner 2026-11-22 round 5) =========================
# Pasted after motion.py. Takes over from worlds.py's background people and cars when a scene has a WORLD STATE (the
# dress has "busy"), so older shots and the replica are unchanged.
#   PROPS: real sizes next to a 5.2-unit kid; a held thing sits IN the hand (its centre just past the hand, along the
#          arm), never on the wrist; book open in both hands at chest height; phone in one hand with a glowing screen;
#          a ball in both hands or at the feet; a box carried in both arms; a bag / shoe in one hand
#   CROWDS: people walk on the pavements in one lane per side (one way, facing the way they walk, a steady pace, a body
#          width or more apart, never through each other), spread along the whole street; people standing face
#          something real: each other in little circles, a shop window, their phone, their dog; at dusk they walk to
#          their own front doors and go inside
#   TRAFFIC: driving cars in their lanes, evenly spaced, one steady speed; parked cars in driveways / at the kerb only;
#          no jams; "no moving cars" = an empty road apart from the parked ones
ZW_CROWD_ON[0] = True

# ---------------------------------------------------------------- PROPS
ZW_THING_SIZE.update({"book": 1.0, "phone": 0.8, "ball": 0.9, "shoe": 0.8, "bag": 1.1, "box": 2.0, "key": 0.5, "apple": 0.6,
                      "ice_cream": 0.9, "flashlight": 0.9, "cake": 1.6, "pizza": 1.2, "candy": 0.6, "coin": 0.5, "hat": 0.8,
                      "pencil": 0.8, "bone": 0.9, "fish": 0.9, "balloon": 2.0, "heart": 1.0, "star": 1.0})
ZP_TWO_HANDS = ("box", "crate", "cake", "pizza", "bucket", "book")

def zt_vis(obj, t, show):
    """a thing (an empty with its pieces as children) visible from t (show=True) or gone from t"""
    for o in [obj] + list(obj.children_recursive):
        o.hide_render = show
        o.keyframe_insert("hide_render", frame=max(1, F(t) - 1))
        o.hide_render = not show
        o.keyframe_insert("hide_render", frame=F(t))
    return obj



def zt_kind(obj):
    n = obj.name
    return n[3:].rsplit("_", 1)[0] if n.startswith("zt_") else n


def zt_centre(obj):
    pts = zw_pts([obj])
    if not pts:
        return Vector(obj.matrix_world.translation), 0.6
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return (lo + hi) / 2, max(hi.z - lo.z, hi.x - lo.x, hi.y - lo.y)


def zw_grab(ch, t, obj):
    """GRAB: the right hand reaches, the thing comes INTO the hand (its centre just past the hand along the arm) and
    stays there; a box / crate / cake goes to both arms in front of the body"""
    if obj is None:
        return ch
    if zt_kind(obj) in ZP_TWO_HANDS:
        return zm_hold_front(ch, t, obj)
    zm_hold(ch, t - 0.3, ("armR",), root=False)
    ch.pose(t - 0.12, armR=(40, -6))
    ch.pose(t, armR=(70, -10))
    ch.pose(t + 0.35, armR=(55, -8))
    sc = bpy.context.scene
    sc.frame_set(F(t))
    arm = D.objects.get(ch.name + "_armR")
    if arm is None:
        return ch
    bpy.context.view_layer.update()
    hand = arm.matrix_world @ Vector((0, 0, -1.0))
    sh = arm.matrix_world @ Vector((0, 0, 1.0))
    dv = (hand - sh)
    dv = dv.normalized() if dv.length > 1e-4 else Vector((0, 0, -1))
    c, size = zt_centre(obj)
    off = c - Vector(obj.matrix_world.translation)
    obj.keyframe_insert("location", frame=max(1, F(t) - 1))
    obj.location = hand + dv * (0.1 + size * 0.38) - off
    obj.keyframe_insert("location", frame=F(t))
    bpy.context.view_layer.update()
    k = obj.constraints.new("CHILD_OF")
    k.name = "zw_grab"
    k.target = arm
    k.inverse_matrix = arm.matrix_world.inverted()
    k.influence = 0.0
    k.keyframe_insert("influence", frame=max(1, F(t) - 1))
    k.influence = 1.0
    k.keyframe_insert("influence", frame=F(t))
    return ch


ZP_HOLD = {"ball": ((58, 0, -35), -1.15, 0.72), "default": ((62, 0, -12), -1.4, 0.8)}   # arms, then the thing's centre (hip-local y, z)


def zm_hold_front(ch, t, obj, z=None, dist=None):
    """a thing held in BOTH arms in front of the body (a box, a cake, a ball): the hands at its sides; parented to the
    hips from t (the arms turn IN about the vertical so the hands meet it)"""
    arms, yc, zc = ZP_HOLD.get(zt_kind(obj), ZP_HOLD["default"])
    zm_hold(ch, t - 0.3, ("armL", "armR", "torso"), root=False)
    ch.pose(t - 0.1, armL=(arms[0] - 8, 0, arms[2]), armR=(arms[0] - 8, 0, arms[2]), torso=(0, 18, 0))
    ch.pose(t + 0.25, armL=arms, armR=arms, torso=(0, 0, 0))
    ch.zp_hold_arms = arms
    c, size = zt_centre(obj)
    obj.keyframe_insert("location", frame=max(1, F(t) - 1))
    obj.keyframe_insert("rotation_euler", frame=max(1, F(t) - 1))
    # a hidden twin holds the thing from t (parenting cannot be keyed): the ground copy goes, the held copy comes
    held = zw_thing(zt_kind(obj), (0, 0, 0), size=max(0.3, obj.scale[2]))
    held.parent = ch.hip
    held.location = (0.0, yc, zc - size * 0.45)
    zt_vis(held, t, show=True)
    zt_vis(obj, t, show=False)
    return held


def zm_open_book(col="#2f86fd"):
    """an OPEN book: two pages in a shallow V, a cover behind them (about 1.6 wide, 1.0 tall)"""
    r = empty("zt_openbook_%d" % ZT_N["n"], (0, 0, 0), None, None)
    ZT_N["n"] += 1
    Mc, Mp = zt_m("bookc" + col[1:], col, 0.6), zt_m("page", "#f8f4e8", 0.85)
    for s2 in (-1, 1):
        box("zt_bkc%d_%d" % (ZT_N["n"], s2), (0.82, 0.05, 1.05), (s2 * 0.4, 0.04, 0.0), Mc, 0.01, rot=(0, 0, s2 * -12), parent=r)
        box("zt_bkp%d_%d" % (ZT_N["n"], s2), (0.74, 0.06, 0.95), (s2 * 0.38, -0.01, 0.0), Mp, 0.0, rot=(0, 0, s2 * -12), parent=r)
        for k in range(3):
            box("zt_bkl%d_%d_%d" % (ZT_N["n"], s2, k), (0.5, 0.01, 0.03), (s2 * 0.38, -0.05, 0.25 - k * 0.2), zt_m("ink", "#4a4a5a", 0.6), 0.0, rot=(0, 0, s2 * -12), parent=r)
    return r


def zm_read(ch, t0, t1, book=None):
    """READ A BOOK: open, in both hands at chest height, in front of the body, the head tilted down to it, a page turn"""
    zm_hold(ch, t0, root=False)
    if book is not None:
        zt_vis(book, t0, show=False)   # the closed prop from the card: the open book replaces it
    ob = zm_open_book()
    ob.parent = ch.hip
    ob.location = (0.0, -1.55, 1.25)
    ob.rotation_euler = (math.radians(-38), 0, 0)
    d = max(0.8, t1 - t0)
    ch.pose(t0 + 0.35, armL=(80, 0, -26), armR=(80, 0, -26), head=(0, 24, 0))
    ch.pose(t0 + d * 0.5, armR=(90, 0, -10), head=(5, 22, 0))
    ch.pose(t0 + d * 0.62, armR=(80, 0, -26), head=(0, 24, 0))
    return ob


def zm_phone(ch, t0, t1, phone=None):
    """LOOK AT A PHONE: in the right hand in front of the chest, the glowing screen toward the face, the head down to it"""
    zm_hold(ch, t0, root=False)
    if phone is not None:
        zt_vis(phone, t0, show=False)
    r = empty("zt_phone_h%d" % ZT_N["n"], (0, 0, 0), ch.hip, None)
    ZT_N["n"] += 1
    box("zt_phb%d" % ZT_N["n"], (0.5, 0.1, 0.85), (0, 0, 0), zt_m("phonebody", "#22252c", 0.4), 0.04, parent=r)
    box("zt_phs%d" % ZT_N["n"], (0.42, 0.02, 0.74), (0, 0.06, 0.0), zt_m("phonescreen", "#9fd8ff", 0.3, emit="#bfe6ff", estr=2.2), 0.0, parent=r)
    r.location = (-0.85, -1.62, 1.33)
    r.rotation_euler = (math.radians(-35), 0, math.radians(-20))
    ch.pose(t0 + 0.35, armR=(80, 0, -22), armL=(22, 8), head=(-8, 28, 0))
    return r


def zm_hold_ball(ch, t, ball):
    """a ball held in both hands in front of the tummy"""
    return zm_hold_front(ch, t, ball, z=0.85, dist=1.4)


def zm_carry(ch, t0, t1, to, thing):
    """CARRY: a box / crate / cake in both arms, a bag / shoe in one hand; walk with it (no arm swing when two-handed)"""
    two = thing is not None and zt_kind(thing) in ZP_TWO_HANDS
    zm_pick_up(ch, t0, None)
    if thing is not None:
        zw_grab(ch, t0 + 0.45, thing)
    zm_walk(ch, t0 + 0.9, t1, to, arms=not two)
    if two:
        arms = ZP_HOLD.get(zt_kind(thing), ZP_HOLD["default"])[0]
        ch.pose(t0 + 0.9, armL=arms, armR=arms)
        ch.pose(t1, armL=arms, armR=arms)
    return ch


# ---------------------------------------------------------------- CROWDS
# per place: the pavements (the lane coordinate, the walking direction along the street axis), where people stand,
# the doors they go home to at dusk
ZW_HOUSES_N = [-120 + 30 * k for k in range(9)]
ZW_HOUSES_S = [x + 12 for x in ZW_HOUSES_N]
ZW_WALKWAYS = {
    "suburb": dict(axis="x", span=(-48.0, 48.0), lanes=((8.0, -1), (-8.0, 1)),
                   circles=((13.8, 1), (-13.8, -1)), doors=[(x, 17.4, 8.0) for x in ZW_HOUSES_N] + [(x, -17.4, -8.0) for x in ZW_HOUSES_S]),
    "downtown": dict(axis="y", span=(6.0, 140.0), lanes=((9.2, 1), (-9.2, -1)), windows=((11.4, 90.0), (-11.4, -90.0)),
                     doors=[(sd * 12.0, 14.0 + 16.0 * k, sd * 9.2) for k in range(8) for sd in (1, -1)]),
    "brick": dict(axis="y", span=(8.0, 140.0), lanes=((9.0, 1), (-9.0, -1)), windows=((10.4, 90.0), (-10.4, -90.0)),
                  doors=[(sd * 11.0, 16.0 + 18.0 * k, sd * 9.0) for k in range(7) for sd in (1, -1)]),
}
ZW_PLACE_WALK = {"suburb_street": "suburb", "suburb_porch": "suburb", "downtown_street": "downtown", "downtown_plaza": "downtown",
                 "downtown_landmark": "downtown", "brick_street": "brick", "brick_alley": "brick"}


def zw_yaw_to(dx, dy):
    """the kit's root yaw for a character facing (dx, dy) (rot a faces (sin a, -cos a))"""
    return math.degrees(math.atan2(dx, -dy))


def zw_stage_xy():
    pl = ZW_T.get("_place")
    if pl in ZW_SPOTS:
        return ZW_SPOTS[pl]["close"][1][:2]
    return (0.0, 0.0)


def zw_crowd(t0, t1, n):
    """the background people of a world-state scene: walkers in lanes + standers facing something real (see the top)"""
    W = ZW_WALKWAYS.get(ZW_PLACE_WALK.get(ZW_T.get("_place"), ""))
    if W is None or n <= 0:
        return 0
    n = int(round(n * {"busy": 1.8, "normal": 1.3}.get(ZW_T.get("busy"), 1.0)))
    rnd = random.Random(41)
    mv = ZW_T.get("walkers", "walking")
    thr = ZW_T.get("threat", "none")
    ex = set(ZW_T.get("extras") or ())
    ax = W["axis"]
    lo, hi = W["span"]
    sx, sy = zw_stage_xy()
    s_al = sx if ax == "x" else sy
    pos = lambda along, lane: (along, lane) if ax == "x" else (lane, along)
    made = 0
    walking = mv in ("walking", "hurrying") or thr == "react"
    n_walk = n if mv == "hurrying" or thr == "react" else (int(round(n * 0.6)) if walking else 0)
    n_stand = n - n_walk
    # WALKERS: per lane, evenly spread along the street (stratified), one way, one pace; kept off the stage itself
    lanes = W["lanes"]
    per = [n_walk // len(lanes) + (1 if i < n_walk % len(lanes) else 0) for i in range(len(lanes))]
    mode0 = "run" if thr == "react" else ("hurry" if mv == "hurrying" else "walk")
    v = ZW_MOVERS[mode0]
    for li, (lane, sgn) in enumerate(lanes):
        k = per[li]
        if k <= 0:
            continue
        seg = (hi - lo) / k
        for j in range(k):
            a0 = lo + seg * (j + rnd.uniform(0.25, 0.75))
            dist = min(v * (t1 - t0), 14.0)
            if thr == "react":   # running AWAY from the danger
                sgn = 1 if a0 > s_al else -1
            a1 = a0 + sgn * dist
            if min(a0, a1) - 3.0 < s_al < max(a0, a1) + 3.0 and abs(lane - (sy if ax == "x" else sx)) < 4.0:
                continue   # never walk through the story's own stage
            mode = mode0
            if mode0 == "walk":
                mode = rnd.choice(["walk", "walk", "bag"] + (["dog"] if "dogs" in ex else []))
            src = zw_person_src(mode, j % 3, t0, t1)
            face = zw_yaw_to(sgn, 0.0) if ax == "x" else zw_yaw_to(0.0, sgn)
            x0, y0 = pos(a0, lane)
            ob = instance("zw_cw%d_%d" % (li, j), src, (x0, y0, 0.25), rot=(0, 0, face))
            ob.keyframe_insert("location", frame=F(t0))
            if mv == "hurrying" and thr != "react":
                zw_go_home(ob, t0, t1, (x0, y0), sgn, W, ax, v)
            else:
                x1, y1 = pos(a1, lane)
                ob.location = (x1, y1, 0.25)
                ob.keyframe_insert("location", frame=F(t1))
                set_interp(ob, "location", F(t0), "LINEAR")
            made += 1
    # STANDERS: little circles (2-3 facing each other), at shop windows, on their phone, with their dog
    if n_stand > 0 and thr != "react":
        spots = []
        for (c_lane, side) in W.get("circles", ()):
            for j in range(max(1, n_stand // 3)):
                spots.append(("circle", lo + (hi - lo) * rnd.uniform(0.1, 0.9), c_lane, side))
        for (w_lane, face) in W.get("windows", ()):
            for j in range(max(1, n_stand // 4)):
                spots.append(("window", lo + (hi - lo) * rnd.uniform(0.05, 0.95), w_lane, face))
        rnd.shuffle(spots)
        used = []
        left = n_stand
        for kind, along, lane, side in spots:
            if left <= 0:
                break
            if any(abs(along - u) < 7.0 for u in used) or abs(along - s_al) < 6.0:
                continue
            used.append(along)
            cx, cy = pos(along, lane)
            if kind == "window":
                m = rnd.choice(["stand", "phone", "stand"])
                instance("zw_cs%d" % made, zw_person_src(m, made % 3, t0, t1), (cx, cy, 0.25), rot=(0, 0, side))
                made += 1
                left -= 1
                continue
            g = 3 if left >= 3 and rnd.random() < 0.6 else 2
            if g == 2:   # a pair talking (the talk source is two people facing each other)
                instance("zw_cs%d" % made, zw_person_src("talk", made % 3, t0, t1), (cx, cy, 0.0), rot=(0, 0, 90 if ax == "x" else 0))
            else:
                for q in range(3):
                    ang = math.radians(90 + q * 120)
                    px, py = cx + math.cos(ang) * 1.7, cy + math.sin(ang) * 1.7
                    m = "phone" if (q == 2 and "phone" in ex) else ("stand" if q != 1 else "look")
                    instance("zw_cs%d_%d" % (made, q), zw_person_src(m, (made + q) % 3, t0, t1), (px, py, 0.0), rot=(0, 0, zw_yaw_to(cx - px, cy - py)))
            made += g
            left -= g
    return made


def zw_go_home(ob, t0, t1, p0, sgn, W, ax, v):
    """DUSK: the walker goes along the pavement to the next front door ahead, turns up the path, goes inside (hidden)"""
    al0 = p0[0] if ax == "x" else p0[1]
    lane = p0[1] if ax == "x" else p0[0]
    best = None
    for d in W["doors"]:
        dx, dy, dl = d
        if (dl > 0) != (lane > 0):
            continue
        dal = dx if ax == "x" else dy
        ahead = (dal - al0) * sgn
        if ahead > 1.0 and (best is None or ahead < best[0]):
            best = (ahead, d)
    if best is None:
        ob.location = (p0[0] + (sgn * v * (t1 - t0) if ax == "x" else 0), p0[1] + (0 if ax == "x" else sgn * v * (t1 - t0)), 0.25)
        ob.keyframe_insert("location", frame=F(t1))
        set_interp(ob, "location", F(t0), "LINEAR")
        return
    ahead, (dx, dy, dl) = best
    tc = t0 + ahead / v
    corner = (dx, lane) if ax == "x" else (lane, dy)
    door = (dx, dy)
    td = tc + (abs(dy - lane) if ax == "x" else abs(dx - lane)) / v
    ob.location = (corner[0], corner[1], 0.25)
    ob.keyframe_insert("location", frame=F(tc))
    set_interp(ob, "location", F(t0), "LINEAR")
    r0 = ob.rotation_euler[2]
    ob.keyframe_insert("rotation_euler", index=2, frame=F(tc))
    ob.rotation_euler[2] = math.radians(zw_yaw_to(door[0] - corner[0], door[1] - corner[1]))
    ob.keyframe_insert("rotation_euler", index=2, frame=F(tc) + 2)
    ob.location = (door[0], door[1], 0.25)
    ob.keyframe_insert("location", frame=F(td))
    set_interp(ob, "location", F(tc), "LINEAR")
    ob.hide_render = False
    ob.keyframe_insert("hide_render", frame=max(1, F(td) - 1))
    ob.hide_render = True
    ob.keyframe_insert("hide_render", frame=F(td))
    ob.hide_render = False


# the stand-still sources the crowd needs (a phone user; "look" = a calm standing pose for a circle)
ZW_KID_BASE.update({"phone": 341})
ZW_PERSON_SRC0 = zw_person_src


def zw_person_src(mode, j, t0, t1):
    if mode != "phone":
        return ZW_PERSON_SRC0(mode, j, t0, t1)
    nm = "zw_ps_phone%d" % j
    src = D.collections.get(nm)
    if src:
        return src
    src = collection(nm)
    ch = chars.kid(ZW_KID_BASE["phone"] + j * 3, coll=src)
    ch.pose(t0, loc=(0, 0, 0), rot=0, armR=(80, 0, -22), armL=(18, 8), head=(-6, 26, 0))
    ch.blink(t0, t1)
    ch.idle(1.0)
    ph = box("zw_psph%d" % j, (0.5, 0.1, 0.85), (-0.85, -1.62, 1.33), zw_m("phonebody", "#22252c", 0.4), 0.04, rot=(-35, 0, -20), parent=ch.hip, coll=src)
    box("zw_pssc%d" % j, (0.42, 0.02, 0.74), (0, 0.06, 0.0), zw_m("phonescreen", "#9fd8ff", 0.3, emit="#bfe6ff", estr=2.2), 0.0, parent=ph, coll=src)
    hide_coll_from_layer(src)
    return src


# ---------------------------------------------------------------- TRAFFIC
ZW_ROADS = {
    # lanes: (lane coordinate, heading, the street-axis span the cars spread over); parked: (x, y, heading)
    "suburb": dict(axis="x", lanes=((3.2, 90, (-70, 70)), (-3.2, -90, (-70, 70))),
                   parked=((-7.9, -12.8, 0), (40.1, 12.8, 180), (-49.9, 12.8, 180), (82.1, -12.8, 0))),
    "downtown": dict(axis="y", lanes=((-3.5, 0, (0, 150)), (3.5, 180, (0, 150))),
                     parked=((6.3, 30.0, 180), (-6.3, 62.0, 0), (6.3, 96.0, 180), (-6.3, 124.0, 0))),
}
ZW_CARCOL = ["#e2405b", "#3d8bfd", "#ffcf1f", "#22b5a3", "#7b5cf6", "#f6f1e7", "#ff8c2a", "#4cbf45"]


def zw_traffic(t0, t1):
    """the world state's cars: driving (in lane, evenly spaced, one steady speed), parked (driveways / kerb only),
    leaving (driving away fast), none. -> True when it handled the place"""
    R = ZW_ROADS.get(ZW_PLACE_WALK.get(ZW_T.get("_place"), ""))
    if R is None:
        return False
    mode = ZW_T.get("cars", "driving")
    busy = ZW_T.get("busy", "normal")
    if mode == "none":
        return True
    lights = zw_time() in ("sunset", "night")
    spots = []
    n_park = {"busy": 4, "normal": 3, "quiet": 2, "empty": 2}.get(busy, 2)
    for k, (x, y, hd) in enumerate(R["parked"][:n_park]):
        spots.append((x, y, ZW_CARCOL[(k + 3) % len(ZW_CARCOL)], hd, False))
    if mode in ("driving", "leaving"):
        per = {"busy": 2, "normal": 2, "quiet": 1, "empty": 1}.get(busy, 1)
        for li, (lane, hd, (a, b)) in enumerate(R["lanes"]):
            gap = (b - a) / max(1, per)
            for j in range(per):
                al = a + gap * (j + 0.35 + 0.3 * li)
                x, y = (al, lane) if R["axis"] == "x" else (lane, al)
                spots.append((x, y, ZW_CARCOL[(li * 3 + j) % len(ZW_CARCOL)], hd, True))
    zw_cars(spots, t0, t1, speed=15.0 if mode == "leaving" else 8.0, reach=40.0 if mode == "leaving" else 24.0, lights=lights)
    return True
# ===== END OF PROPS, CROWDS + TRAFFIC ================================================================================
