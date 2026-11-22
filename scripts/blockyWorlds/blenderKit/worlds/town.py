# ===== ZYVO TOWN: REAL SIZES, FULL ACTIONS, ROOM FOR MONSTERS (worlds/town.py, owner 2026-11-22 round 6) ===========
# Pasted after crowds.py. Only for world-state scenes (the dress has "busy"); the replica and older shots are unchanged.
#   REAL SIZES outdoors: the people (and everything sized to them: marks, props, crowds, walking speeds, the monster) at
#     ZW_PS = 0.55 of the kit's size, the house walls / roofs / windows 1.5x taller (the doors, fences, hedges and
#     mailboxes stay): a door = 1.4x a kid, a one-storey house = 4x an adult, a two-storey house = 6x; lamps (2.4x a kid),
#     cars and trees as they are. Rooms stay 1.0 (their furniture is built for the kit's people).
#   FULL ACTIONS: kids PLAY by moving across the ground (tag around a circle, a ball kicked between two), a thing is GIVEN
#     from hand to hand (the taker walks up, takes it, walks off), an ice cream cart; walking / running always moves
#   ROOM: a monster (and any big thing that appears) stands clear of every person, its drain / hole too
#   CAMERA: never close up against a fence, a wall or the ground; never pushed into a person
ZW_PS_OUT = 0.55
ZW_HOUSE_TALL = 1.5
ZW_PSF[0] = lambda: zw_ps()


def zw_ps():
    """the people's scale for this shot: 0.55 on a world-state street, else 1.0"""
    if zw_copy() or "busy" not in ZW_T:
        return 1.0
    return ZW_PS_OUT if ZW_T.get("_place") in ZW_PLACE_WALK else 1.0


def zw_tsize(kind, size=1.2):
    """a thing's real size next to this shot's people"""
    return ZW_THING_SIZE.get(kind, size) * zw_ps()


# ---------------------------------------------------------------- the houses taller (the doors, fences, yards stay)
ZW_HOUSE_KEEP = ("zw_hdoor", "zw_hf", "zw_hmb", "zw_hhedge", "zw_hpath", "zw_hdrive")
ZW_HOUSE0 = zw_house


def zw_house(i, x, side, col):
    before = set(D.objects.keys())
    out = ZW_HOUSE0(i, x, side, col)
    if zw_ps() < 1.0:
        for o in D.objects:
            n = o.name
            if n in before or not n.startswith("zw_h") or n.startswith(ZW_HOUSE_KEEP):
                continue
            o.location.z *= ZW_HOUSE_TALL
            o.scale[2] *= ZW_HOUSE_TALL
    return out


# ---------------------------------------------------------------- the people + everything sized to them
ZW_PERSON1 = zw_person


def zw_person(name, look, loc, rot, t0):
    ch = ZW_PERSON1(name, look, loc, rot, t0)
    ps = zw_ps()
    if ps != 1.0:
        s = ch.root.scale
        ch.root.scale = (s[0] * ps, s[1] * ps, s[2] * ps)
    return ch


ZW_MONSTER1 = zw_monster


def zw_monster(name, loc, rot=0.0, size=3.5, style="horns", **kw):
    return ZW_MONSTER1(name, zw_clear_spot(loc, 2.2 * size * zw_ps()), rot=rot, size=size * zw_ps(), style=style, **kw)


def zw_mark(place, mark, k=0):
    """a mark's ground point (round 6: the steps between marks follow the people's size)"""
    c, d, right, rot = zw_stage(place)
    ps = zw_ps()
    sx, dep = ZW_MARKS.get(mark, ZW_MARKS["center"])
    p = c + right * ((sx * 2.8 + k * 1.3) * ps) + d * (dep * ps)
    return (p.x, p.y, 0.0)


def zw_spotpos(place, k, n, depth=0.0, spacing=2.6):
    c, d, right, rot = zw_stage(place)
    ps = zw_ps()
    p = c + right * ((k - (n - 1) / 2.0) * spacing * ps) + d * depth * ps
    return (p.x, p.y, 0.0)


def zw_clear_spot(loc, r):
    """ROOM: a spot pushed deeper into the place (away from the camera side) until every person is r away"""
    p = Vector((float(loc[0]), float(loc[1]), 0.0))
    pl = ZW_T.get("_place")
    if pl not in ZW_SPOTS:
        return (p.x, p.y, 0.0)
    c, d, right, rot = zw_stage(pl)
    sc = bpy.context.scene
    # (only this shot's characters: chars.CHARS keeps the ones of earlier shots, whose objects are already removed)
    who = [ch for nm, ch in zw_cast() if nm not in ZW_MON]
    for _ in range(16):
        near = [ch for ch in who if (Vector((ch.root.location.x, ch.root.location.y, 0)) - p).length < r]
        if not near:
            break
        p = p + d * 1.6
    return (p.x, p.y, 0.0)


# the crowd at the people's size (instances scaled, their speeds and gaps too)
ZW_CROWD5 = zw_crowd


def zw_crowd(t0, t1, n):
    before = set(D.objects.keys())
    ps = zw_ps()
    made = ZW_CROWD5(t0, t1, n)
    if ps != 1.0:
        for o in D.objects:
            if o.name not in before and o.name.startswith("zw_cs") and o.type == "EMPTY":
                o.scale = (ps, ps, ps)
            elif o.name not in before and o.name.startswith("zw_cw") and o.type == "EMPTY":
                o.scale = (ps, ps, ps)
    if "kids_playing" in set(ZW_T.get("extras") or ()):
        zw_play_groups(t0, t1)
    return made


def zw_flee(m, t0, t1, n=3, seed=5):
    """people RUNNING AWAY from the monster (at the people's size), moving forward, terrified"""
    if ZW_T.get("busy") == "empty":
        return []
    rnd = random.Random(seed)
    ps = zw_ps()
    p = Vector(m.root.location)
    s = m.root.scale[2]
    f = zw_front([m])
    side = Vector((f.y, -f.x, 0))
    out = []
    for k in range(n):
        sx = (-1) ** k
        a = p + f * (1.4 * s + 1.4 * k * ps) + side * sx * (1.6 * s + rnd.uniform(0.0, 2.0) * ps)
        b = a + (f * 0.55 + side * sx * 0.85).normalized() * (6.0 + 2.0 * k) * ps
        ch = chars.kid(40 + k + seed)
        ch.root.scale = (ps, ps, ps)
        ch.pose(t0 - 0.05, loc=(a.x, a.y, 0.0))
        zm_walk(ch, t0, t1, (b.x, b.y, 0.0), run=True, turn=False)
        zw_emote(ch, t0, t1, "terrified")
        ZW_EXTRAS.add(ch.name)
        out.append(ch)
    return out


# ---------------------------------------------------------------- FULL ACTIONS
def zw_ahead(ch, t, dist):
    """the point `dist` ahead of a character (the way it faces)"""
    p = za_here(ch, t)
    a = math.radians(zm_yaw_at(ch, t))
    return (p.x + math.sin(a) * dist, p.y - math.cos(a) * dist, 0.0)


def zm_tag(kids, t0, t1, centre, r=3.2):
    """KIDS PLAY TAG: they run round a circle, one chasing the next (the body always moves forward)"""
    c = Vector((float(centre[0]), float(centre[1]), 0.0))
    n = max(1, len(kids))
    for k, ch in enumerate(kids):
        rr = r * zm_s(ch) / 0.55 if zm_s(ch) < 1 else r
        a0 = 2 * math.pi * k / n
        steps = 6
        prev = None
        for j in range(steps + 1):
            a = a0 + (j / steps) * math.pi * 1.4
            p = c + Vector((math.cos(a), math.sin(a), 0)) * rr
            t = t0 + (t1 - t0) * j / steps
            if prev is None:
                ch.pose(t - 0.05, loc=(p.x, p.y, 0.0), rot=zw_yaw_to(-math.sin(a), math.cos(a)))
            else:
                zm_walk(ch, prev[0], t, (p.x, p.y, 0.0), run=True, turn=False)
                ch.pose(t, rot=zw_yaw_to(-math.sin(a), math.cos(a)))
            prev = (t, p)
        zw_emote(ch, t0, t1, "laughing")
    return kids


def zm_pass_ball(a, b, t0, t1, ball=None):
    """two kids KICK a ball to each other along the ground"""
    ball = ball if ball is not None else zw_thing("ball", zm_front(a, t0, 0.9 * zm_s(a)), size=zw_tsize("ball"))
    t, k = t0 + 0.2, 0
    while t + 0.7 <= t1:
        kk, rr = (a, b) if k % 2 == 0 else (b, a)
        zm_kick(kk, t, ball, zm_front(rr, t + 0.7, 0.9 * zm_s(rr)))
        t += 0.95
        k += 1
    return ball


def zm_give(giver, taker, thing, t0, t1):
    """GIVE / SELL: the taker walks up, the giver holds the thing out, it goes from hand to hand, the taker walks off
    happy with it (sound off, you know what happened)"""
    d = max(1.2, t1 - t0)
    pg = za_here(giver, t0)
    a = math.radians(zm_yaw_at(giver, t0))
    # the taker comes up BESIDE the giver (not between her and the camera: round 6 check, Max hid Grandma)
    fx, fy = math.sin(a), -math.cos(a)
    sx_, sy_ = fy, -fx
    s0 = zm_s(giver)
    meet = (pg.x + sx_ * 2.3 * s0 + fx * 0.9 * s0, pg.y + sy_ * 2.3 * s0 + fy * 0.9 * s0, 0.0)
    zm_turn(giver, t0 + d * 0.3, za_yaw(pg, Vector(meet)) * 0.5 + math.degrees(a) * 0.5, dur=0.35)
    zm_walk(taker, t0, t0 + d * 0.38, meet)
    zm_turn(taker, t0 + d * 0.38, za_yaw(Vector(meet), pg), dur=0.3)
    th = t0 + d * 0.55
    if thing is not None:
        zw_grab(giver, t0 + 0.05, thing)
    zm_hold(giver, th - 0.35, ("armR",), root=False)
    giver.pose(th - 0.05, armR=(88, 0, -8))
    zm_hold(taker, th - 0.35, ("armR",), root=False)
    taker.pose(th, armR=(80, 0, -8))
    if thing is not None:
        for k in list(thing.constraints):
            if k.name == "zw_grab":
                k.keyframe_insert("influence", frame=F(th) - 1)
                k.influence = 0.0
                k.keyframe_insert("influence", frame=F(th))
        sc = bpy.context.scene
        sc.frame_set(F(th))
        arm = D.objects.get(taker.name + "_armR")
        if arm is not None:
            bpy.context.view_layer.update()
            hand = arm.matrix_world @ Vector((0, 0, -1.0))
            c, size = zt_centre(thing)
            thing.location = hand - (c - Vector(thing.matrix_world.translation)) * 0.0
            thing.keyframe_insert("location", frame=F(th))
            bpy.context.view_layer.update()
            k2 = thing.constraints.new("CHILD_OF")
            k2.name = "zw_give"
            k2.target = arm
            k2.inverse_matrix = arm.matrix_world.inverted()
            k2.influence = 0.0
            k2.keyframe_insert("influence", frame=F(th) - 1)
            k2.influence = 1.0
            k2.keyframe_insert("influence", frame=F(th))
    giver.pose(th + 0.35, armR=(0, 4))
    zw_emote(taker, th, t1, "happy")
    back = (Vector(meet) - pg)
    back.z = 0
    back = back.normalized() if back.length > 1e-3 else Vector((1, 0, 0))
    side = Vector((back.y, -back.x, 0))
    away = Vector(meet) + side * 4.0 * zm_s(taker) + back * 1.5 * zm_s(taker)
    zm_walk(taker, th + 0.3, t1, (away.x, away.y, 0.0))
    return thing


def zt_build_cart(r, c=None):
    """an ICE CREAM CART: a white box on wheels, a striped umbrella, three tubs of ice cream, a cone sign"""
    Mw, Mr = zt_m("cartw", "#f6f4ee", 0.6), zt_m("cartr", "#ff6fa8", 0.6)
    box("zt_cart_b%d" % ZT_N["n"], (2.6, 1.4, 1.4), (0, 0, 1.0), Mw, 0.08, parent=r, coll=c)
    box("zt_cart_s%d" % ZT_N["n"], (2.7, 1.45, 0.3), (0, 0, 0.55), Mr, 0.04, parent=r, coll=c)
    for sx in (-1, 1):
        cyl("zt_cart_wh%d_%d" % (ZT_N["n"], sx), 0.32, 0.2, (sx * 0.95, -0.72, 0.32), zt_m("wheel", "#2a2a33", 0.6), 14, parent=r, coll=c, rot=(90, 0, 0))
    cyl("zt_cart_pole%d" % ZT_N["n"], 0.05, 2.0, (0, 0, 2.6), zt_m("pole", "#d8d8d8", 0.4), 6, parent=r, coll=c)
    for k in range(6):
        cyl("zt_cart_um%d_%d" % (ZT_N["n"], k), 1.6 - k * 0.22, 0.12, (0, 0, 3.6 + k * 0.08), zt_m("umb%d" % (k % 2), ["#ff6fa8", "#ffffff"][k % 2], 0.6), 18, parent=r, coll=c)
    for k, col in enumerate(("#fff1c4", "#ff9ec0", "#9b6a3e")):
        sphere("zt_cart_ic%d_%d" % (ZT_N["n"], k), 0.28, (-0.7 + k * 0.7, 0.0, 1.85), zt_m("ic%d" % k, col, 0.5), parent=r, coll=c, seg=10)
    return r


ZT_BUILD0 = zt_build


def zt_build(kind, r, c, col):
    if kind == "ice_cream_cart":
        return zt_build_cart(r, c)
    return ZT_BUILD0(kind, r, c, col)


ZW_THING_SIZE.update({"ice_cream_cart": 1.0, "ice_cream": 1.0})


# ---------------------------------------------------------------- CAMERA: never against a fence / the ground, never in a person
def zw_near_clear(t0, t1):
    """at the start and the end: the first thing the lens sees in the middle of the frame must be at least ~2.5 (x the
    people's size) away unless it is a person; a fence / wall / the ground right at the lens moves the camera up and back"""
    sc = bpy.context.scene
    cam = sc.camera
    if cam is None or cam.parent:
        return 0
    moved = 0
    lim = 2.5 * zw_ps() + 0.6
    for f in sorted(set([F(t0), (F(t0) + F(t1)) // 2, max(F(t0), F(t1) - 1)])):
        sc.frame_set(f)
        o = cam.matrix_world.translation.copy()
        fw = cam.matrix_world.to_3x3() @ Vector((0, 0, -1))
        # never pushed into a person: the lens inside a person's box (+ a margin) backs off and up
        close = False
        for nm, ch in zw_cast():
            try:
                pp = zw_pts([ch.root])
            except Exception:
                continue
            if not pp:
                continue
            m = 0.9 * max(0.5, ch.root.scale[2])
            lo = Vector((min(p.x for p in pp) - m, min(p.y for p in pp) - m, min(p.z for p in pp) - m))
            hi = Vector((max(p.x for p in pp) + m, max(p.y for p in pp) + m, max(p.z for p in pp) + m))
            if lo.x <= o.x <= hi.x and lo.y <= o.y <= hi.y and lo.z <= o.z <= hi.z:
                close = True
                break
        if close:
            cam.location = o - fw * (lim * 1.4) + Vector((0, 0, lim * 0.5))
            cam.keyframe_insert("location", frame=f)
            moved += 1
            print("zw_near_clear: frame %d: the lens was against a person: moved back" % f)
            continue
        try:
            dg = bpy.context.evaluated_depsgraph_get()
            hit, loc, nrm, idx, ob, mw = sc.ray_cast(dg, o, fw, distance=lim)
        except Exception:
            continue
        if not hit or ob is None:
            continue
        n = ob.name
        if any(n.startswith(ch.name + "_") for nm, ch in zw_cast()):
            continue
        cam.location = o - fw * (lim * 1.2) + Vector((0, 0, lim * 0.8))
        cam.keyframe_insert("location", frame=f)
        moved += 1
        print("zw_near_clear: frame %d: %s right at the lens: the camera moved up and back" % (f, n))
    sc.frame_set(F(t0))
    return moved


ZW_SPOT0 = zw_spot


def zw_spot(cam, place, spot, t0, t1, push=0.08, lens=None):
    """a TESTED camera spot at the people's size (round 6: the full-size spots aimed at the walls above small people)"""
    ps = zw_ps()
    if ps == 1.0 or place not in ZW_SPOTS:
        return ZW_SPOT0(cam, place, spot, t0, t1, push, lens)
    loc, tgt, ln = ZW_SPOTS[place][spot]
    loc, tgt = Vector(loc), Vector(tgt)
    tgt = Vector((tgt.x, tgt.y, tgt.z * ps))
    loc = tgt + (Vector((loc.x, loc.y, loc.z * ps)) - tgt) * (0.75 if spot != "wide" else 1.0)
    end = loc + (tgt - loc) * push
    cam.key(t0, tuple(loc), tuple(tgt), lens=lens or ln)
    cam.key(t1, tuple(end), tuple(tgt), lens=lens or ln)
    return loc, tgt


def zw_cars_clear_lens(t0, t1):
    """a driving car whose path passes right by the lens is taken out of this shot (it never drives through the camera)"""
    sc = bpy.context.scene
    cam = sc.camera
    if cam is None:
        return 0
    n = 0
    f0, f1 = F(t0), max(F(t0), F(t1) - 1)
    for ob in list(ZW_DRIVING):
        try:
            hit = False
            for f in range(f0, f1 + 1, 4):
                sc.frame_set(f)
                if (Vector(ob.matrix_world.translation) - cam.matrix_world.translation).length < 7.0:
                    hit = True
                    break
            if hit:
                for o in [ob] + list(ob.children_recursive):
                    o.hide_render = True
                n += 1
        except Exception:
            continue
    sc.frame_set(f0)
    if n:
        print("zw_cars_clear_lens: %d driving car(s) out of this shot (they passed the lens)" % n)
    return n


ZW_GUARD0 = zw_cam_guard


def zw_cam_guard(t0, t1, step=6):
    n = ZW_GUARD0(t0, t1, step)
    if "busy" in ZW_T:
        try:
            n += zw_near_clear(t0, t1)
            zw_cars_clear_lens(t0, t1)
        except Exception as e:
            print("zw_near_clear skipped: %s" % e)
    return n


def zw_play_groups(t0, t1):
    """the background KIDS PLAYING (world state extras: kids_playing): a tag chase on a front lawn and a ball kicked
    between two kids, away from the story's own stage"""
    pl = ZW_T.get("_place")
    W = ZW_WALKWAYS.get(ZW_PLACE_WALK.get(pl, ""))
    if W is None or W["axis"] != "x":
        return 0
    sx, sy = zw_stage_xy()
    ps = zw_ps()
    made = 0
    for k, (gx, gy) in enumerate(((sx - 16.0, 13.6), (sx + 15.0, -13.6))):
        kids = []
        for j in range(3 if k == 0 else 2):
            ch = chars.kid(160 + k * 5 + j, face=None)
            ch.root.scale = (ps, ps, ps)
            ZW_DOTCHARS.add(ch.name)
            zw_dot_apply(ch, t0 - 1.0, "happy")
            ch.pose(t0 - 0.1, loc=(gx + j * 3.0 * ps, gy, 0.0))
            ZW_EXTRAS.add(ch.name)
            kids.append(ch)
        if k == 0:
            zm_tag(kids, t0, t1, (gx, gy), r=3.2 * ps)
        else:
            a, b = kids
            a.pose(t0 - 0.1, loc=(gx - 3.2 * ps, gy, 0.0), rot=90.0)
            b.pose(t0 - 0.1, loc=(gx + 3.2 * ps, gy, 0.0), rot=-90.0)
            zm_pass_ball(a, b, t0, t1)
        made += len(kids)
    return made
# ===== END OF TOWN ===================================================================================================
