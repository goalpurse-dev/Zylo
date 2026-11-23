# ===== ROUND 9e (owner 2026-11-23): THE CHALK HANDOVER + THE HAND-OVER BLOCK + A PURE BLACK MONSTER =================
# Pasted after stage9d.py.
#   HAND-OVER    giving / handing over / into a pocket or bag: the thing held up between the two, then into the other's
#                hand or pocket, they look down at it; every camera in that moment keeps BOTH people + the thing in frame
#   POCKET       the same thing in the same pocket from scene to scene; taking it out = the hand at the pocket
#   HELD ARM     a held thing keeps the right arm out in front while walking / running (the swing does not lose it)
#   MONSTER      pure black in every light (never lit, no shine, no grey): only the two eyes glow; the arms joined to the
#                (thinner) body; the hand slams down, the wall shimmer reads in a still
#   CHALK        a short stick about as long as the hand is wide
#   PEOPLE       dad: balding, dark sides, a big moustache, brows; the pizza box: a flat box with a red pizza print; the
#                dog lies asleep
#   CAMERAS      hand (a close shot of a hand + the thing), behind (a person from behind, what they face ahead), top
#                (straight above, the long side upright, sized), two (both fully in frame), a kid's legs with the line
#                across the front, the monster's legs big with the kid behind the circle, the monster's eyes to the lens
#   LIGHT        dusk: dark and warm, low sun, olive grass, a wider chalk line; morning: a golden sunrise, darker grass

ZS_LIBRARY["hand_over"] = ("animation", "a hand-over: the thing held up between the two, then into the other's hand / pocket / bag; they look down at it; the camera keeps both + the thing (zs_hand_over)")
ZS_LIBRARY["pocket"] = ("animation", "a thing put in a pocket / taken out of it: the same thing, the same pocket (zs_in_pocket / zs_take_out)")
ZS_LIBRARY["held_arm"] = ("animation", "a held thing keeps the arm out in front while walking / running (zs_arm_hold)")
ZS_LIBRARY["cam_hand"] = ("camera", "a close shot of a hand and the thing in it (or the pocket), following it (shot hand)")
ZS_LIBRARY["cam_behind"] = ("camera", "a person from behind and what they face ahead of them (shot behind)")
ZS_LIBRARY["cam_top"] = ("camera", "straight above a thing on the ground, its long side upright in the frame, sized to it")
ZS_LIBRARY["cam_two"] = ("camera", "two people both fully in frame (or close, hips up, with the thing between them)")
ZS_LIBRARY["cam_legs_line"] = ("camera", "only a kid's legs, the chalk line across the front of the frame")
ZS_LIBRARY["cam_monster_legs"] = ("camera", "the monster's legs big in frame, the kid behind its circle")
ZS_LIBRARY["dog_asleep"] = ("prop", "a dog lying asleep, eyes shut, head on its paws")
ZS_LIBRARY["pizza_box"] = ("prop", "a flat pizza box with a red pizza print on the lid")
ZS_LIBRARY["chalk"] = ("prop", "a short white chalk stick, about as long as the hand is wide, held in the fist")
ZS_LIBRARY["shadow_monster"] = ("character", "a pure black thin jointed silhouette taller than the lamps, never lit, only two glowing eyes")
ZS_LIBRARY["sunrise"] = ("light", "a golden sunrise: a low warm sun, long shadows, darker grass")
ZS_LIBRARY["dusk"] = ("light", "a dark warm dusk: a low sun, long shadows, olive grass, a wide chalk line that reads from above")

ZS_HANDOVERS = []   # (t_from, t_to, giver, taker, thing): the cameras keep both + the thing in frame
ZS_ARM_HOLD = {}    # name -> [[t0, t1], ...]: the right arm holds something
ZS_HOLDER = {}      # thing name -> the character holding it
ZS_POCKETS = {}     # character name -> the pocket patch


def zs_try(fn, *a, **k):
    try:
        return fn(*a, **k)
    except Exception as e:
        print("ZW_LOOK|9e|%s skipped: %s" % (str(fn).split(" ")[1] if " " in str(fn) else "?", str(e)[:160]))
        return None


def zs_upd(t):
    bpy.context.scene.frame_set(F(t))
    bpy.context.view_layer.update()


def zs_upd_f(f):
    bpy.context.scene.frame_set(max(1, int(f)))
    bpy.context.view_layer.update()


# every take starts clean (a shot is built fresh; module globals outlive it)
ZS_CLEAR9E = zs_clear_stage


def zs_clear_stage(place, radius=13.0):
    del ZS_HANDOVERS[:]
    ZS_ARM_HOLD.clear()
    ZS_HOLDER.clear()
    ZS_POCKETS.clear()
    return ZS_CLEAR9E(place, radius)


def zs_fwd(ch, t):
    a = math.radians(zm_yaw_at(ch, t))
    return Vector((math.sin(a), -math.cos(a), 0.0))


# ---------------------------------------------------------------- THE HELD ARM
def zs_arm_hold(ch, t0, t1=1e9):
    if ch is None or not hasattr(ch, "root"):
        return
    W = ZS_ARM_HOLD.setdefault(ch.name, [])
    for w in W:
        if w[0] <= t0 + 0.05 and w[1] > t0:
            return
    W.append([t0, t1])


def zs_arm_release(ch, t):
    if ch is None:
        return
    for w in ZS_ARM_HOLD.get(ch.name, []):
        if w[0] <= t < w[1]:
            w[1] = t


def zs_held(ch, t):
    return any(w[0] <= t < w[1] for w in ZS_ARM_HOLD.get(ch.name, []))


def zs_gait(ch, t0, t1, pts, style="walk"):
    """(stage9b's gait) + a held thing keeps the right arm: no swing while ZS_ARM_HOLD says the hand is full"""
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
        held = zs_held(ch, tt)
        if astyle == "swing" or astyle == "pump":
            kw.update(armL=(-arm * sg, 8))
            if not held:
                kw.update(armR=(arm * sg, 8))
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
        end.update(armL=(0, 4))
        if not zs_held(ch, t1 + 0.2):
            end.update(armR=(0, 4))
    ch.pose(t1 + 0.2, **end)
    return ch


ZM_PICK9E = zm_pick_up


def zm_pick_up(ch, t, thing):
    r = ZM_PICK9E(ch, t, thing)
    if ch is not None and thing is not None:
        zs_arm_hold(ch, t)
        ZS_HOLDER[thing.name] = ch
        ch.pose(t + 1.05, armR=(82, -26))   # held out in front, a little to the side (it reads against the night)
    return r


# ---------------------------------------------------------------- THE POCKET
def zs_pocket_pt(ch, t):
    """the front of the right trouser leg, a quarter down from the hip (world), the leg, the leg's width"""
    zs_upd(t)
    lg = D.objects.get(ch.name + "_legR")
    f = zs_fwd(ch, t)
    s = zm_s(ch)
    if lg is None:
        p = za_here(ch, t)
        return Vector((p.x + f.x * 0.5 * s, p.y + f.y * 0.5 * s, 1.6 * s)), None, 0.5 * s
    P = zw_pts([lg])
    if not P:
        p = za_here(ch, t)
        return Vector((p.x + f.x * 0.5 * s, p.y + f.y * 0.5 * s, 1.6 * s)), lg, 0.5 * s
    lo = Vector((min(q.x for q in P), min(q.y for q in P), min(q.z for q in P)))
    hi = Vector((max(q.x for q in P), max(q.y for q in P), max(q.z for q in P)))
    c = (lo + hi) / 2.0
    w = max(0.05, min(hi.x - lo.x, hi.y - lo.y))
    h = hi.z - lo.z
    p = Vector((c.x + f.x * (w * 0.5 + 0.015), c.y + f.y * (w * 0.5 + 0.015), hi.z - 0.28 * h))
    return p, lg, w


def zs_stick(obj, target, t, name="zs_stick"):
    """obj follows target from now on (a constraint with the inverse at t: no jump)"""
    if obj is None or target is None:
        return obj
    zs_upd(t)
    k = obj.constraints.new("CHILD_OF")
    k.name = name
    k.target = target
    k.inverse_matrix = target.matrix_world.inverted()
    return k


def zs_pocket(ch, t):
    p, lg, w = zs_pocket_pt(ch, t)
    if ch.name not in ZS_POCKETS:
        yaw = zm_yaw_at(ch, t)
        M = zw_m("pocket9e", "#3a1612", 0.85)
        pk = box("zs_pocket_%s" % ch.name, (w * 0.66, 0.035, w * 0.5), (p.x, p.y, p.z - w * 0.16), M, 0.01, rot=(0, 0, yaw))
        zs_stick(pk, lg if lg is not None else ch.root, t)
        ZS_POCKETS[ch.name] = pk
    return p, lg, w


def zs_set_here(thing, t, loc, rot):
    """thing's own place from t (its old place kept up to the frame before)"""
    f = F(t)
    zs_upd_f(f - 1)
    thing.keyframe_insert("location", frame=f - 1)
    thing.keyframe_insert("rotation_euler", frame=f - 1)
    thing.location = loc
    thing.rotation_euler = rot
    thing.keyframe_insert("location", frame=f)
    thing.keyframe_insert("rotation_euler", frame=f)


def zs_let_go(thing, t, names=("zw_grab", "zw_give", "zs_hand", "zs_pocket")):
    f = F(t)
    zs_upd_f(f - 1)
    for k in list(thing.constraints):
        if (k.name in names or k.name.startswith(tuple(n + "." for n in names))) and k.influence > 0.5:
            k.influence = 1.0
            k.keyframe_insert("influence", frame=f - 1)
            k.influence = 0.0
            k.keyframe_insert("influence", frame=f)


def zs_take_hold(thing, target, t, name):
    f = F(t)
    k = zs_stick(thing, target, t, name)
    if k is not None:
        k.influence = 0.0
        k.keyframe_insert("influence", frame=f - 1)
        k.influence = 1.0
        k.keyframe_insert("influence", frame=f)
    return k


def zs_in_pocket(ch, thing, t):
    """the thing in ch's pocket (sticking out a little) from t: a scene that starts with it there"""
    if ch is None or thing is None:
        return thing
    p, lg, w = zs_pocket(ch, t)
    L = zt_centre(thing)[1]
    thing.rotation_euler = (0.0, 0.0, 0.0)
    thing.location = (p.x, p.y, p.z - L * 0.55)
    thing.keyframe_insert("location", frame=max(1, F(t)))
    thing.keyframe_insert("rotation_euler", frame=max(1, F(t)))
    zs_stick(thing, lg if lg is not None else ch.root, t, "zs_pocket")
    ZS_HOLDER[thing.name] = ch
    return thing


def zs_take_out(ch, thing, t):
    """the hand goes to the pocket, the SAME thing comes out of the SAME pocket into the hand, held up to look at"""
    if ch is None or thing is None:
        return thing
    zs_arm_hold(ch, t - 0.45)
    zm_hold(ch, t - 0.45, ("armR", "head"), root=False)
    ch.pose(t - 0.2, armR=(14, -12), head=(0, 22, 0))
    ch.pose(t, armR=(10, -10))
    zs_upd_f(F(t) - 1)
    mw = thing.matrix_world.copy()
    zs_let_go(thing, t)
    zs_set_here(thing, t, mw.translation.copy(), mw.to_quaternion().to_euler())
    arm = D.objects.get(ch.name + "_armR")
    zs_take_hold(thing, arm if arm is not None else ch.root, t, "zs_hand")
    ch.pose(t + 0.45, armR=(76, -14), head=(0, 12, 0))
    ch.pose(t + 1.2, armR=(72, -14), head=(0, 0, 0))
    ZS_HOLDER[thing.name] = ch
    return thing


# ---------------------------------------------------------------- THE HAND-OVER (item 2: a library block)
def zs_hand_over(giver, taker, thing, t0, t1, pocket=False):
    """GIVE / PUT IN A POCKET: the two face each other close (the taker comes up if far), the giver holds the thing UP
    between them, then puts it into the taker's hand or pocket; the taker looks up at it, then down at it"""
    if giver is None or taker is None:
        return thing
    d = max(1.4, t1 - t0)
    t_up = t0 + 0.25
    t_in = t0 + max(0.8, min(1.4, 0.65 * d))
    pg, pk = za_here(giver, t0), za_here(taker, t0)
    s = zm_s(giver)
    u = Vector((pk.x - pg.x, pk.y - pg.y, 0.0))
    dist = u.length
    u = u.normalized() if dist > 1e-3 else Vector((-1.0, 0.0, 0.0))
    want = 2.4 * s
    tw = t0 + 0.05
    if dist > want * 1.15:
        spot = Vector((pg.x, pg.y, 0.0)) + u * want
        tw = t0 + min(0.6, 0.4 * d)
        zm_walk(taker, t0, tw, (spot.x, spot.y, 0.0))
        pk = spot
    zm_turn(giver, t0 + 0.02, za_yaw(Vector((pg.x, pg.y, 0.0)), Vector((pk.x, pk.y, 0.0))), dur=0.3)
    zm_turn(taker, tw, za_yaw(Vector((pk.x, pk.y, 0.0)), Vector((pg.x, pg.y, 0.0))), dur=0.3)
    if thing is not None and not any(k.name.startswith(("zw_grab", "zs_hand")) for k in thing.constraints):
        zw_grab(giver, t0 + 0.05, thing)
    zs_arm_hold(giver, t0)
    zm_hold(giver, t0 + 0.08, ("armR", "torso"), root=False)
    giver.pose(t_up, armR=(158, -6), torso=(0, 0, 0), hipz=0.0)
    giver.pose(t_in - 0.4, armR=(155, -6))
    giver.pose(t_in - 0.05, armR=(42, 0, -18), torso=(0, 24, 0), hipz=-0.25)
    giver.pose(t_in + 0.45, armR=(0, 4), torso=(0, 0, 0), hipz=0.0)
    zs_arm_release(giver, t_in + 0.45)
    zm_hold(taker, t0 + 0.1, ("head",), root=False)
    taker.pose(t_up, head=(0, -14, 0))
    taker.pose(t_in - 0.4, head=(0, -10, 0))
    taker.pose(t_in - 0.05, head=(0, 30, 0))
    taker.pose(t1 + 0.1, head=(0, 28, 0))
    taker.pose(t1 + 0.5, head=(0, 0, 0))
    if thing is not None:
        zs_upd_f(F(t_in) - 1)
        mw = thing.matrix_world.copy()
        zs_let_go(thing, t_in)
        if pocket:
            p, lg, w = zs_pocket(taker, t_in)
            L = zt_centre(thing)[1]
            zs_set_here(thing, t_in, Vector((p.x, p.y, p.z - L * 0.55)), (0.0, 0.0, 0.0))
            zs_take_hold(thing, lg if lg is not None else taker.root, t_in, "zs_pocket")
        else:
            taker.pose(t_in - 0.3, armR=(70, -8))
            zs_arm_hold(taker, t_in - 0.3)
            zs_set_here(thing, t_in, mw.translation.copy(), mw.to_quaternion().to_euler())
            arm = D.objects.get(taker.name + "_armR")
            zs_take_hold(thing, arm if arm is not None else taker.root, t_in, "zs_hand")
        ZS_HOLDER[thing.name] = taker
    ZS_HANDOVERS.append((t_up - 0.15, t_in + 0.55, giver, taker, thing))
    print("ZW_LOOK|9e|hand-over %s -> %s%s" % (giver.name, taker.name, " (pocket)" if pocket else ""))
    return thing


def zm_give(giver, taker, thing, t0, t1):
    """(every give is the hand-over block now: the thing between the two, both in frame)"""
    return zs_hand_over(giver, taker, thing, t0, t1, pocket=False)


# ---------------------------------------------------------------- THE PROPS
def zt_build_chalk(r, c=None, col=None):
    cyl("zt_chalk%d" % ZT_N["n"], 0.11, 0.8, (0, 0, 0.4), zw_m("chalkstick9e", "#f8f8f4", 0.9, emit="#f2f4f8", estr=0.35), 10, parent=r, coll=c)
    return r


def zt_build_dog(r, c=None, col=None):
    """the dog ASLEEP: lying down, head on its front paws, eyes shut, back legs tucked, the tail curled"""
    n = ZT_N["n"]
    M = zt_m("dog" + (col or "#8a5a3c")[1:], col or "#8a5a3c", 0.8)
    Md = zt_m("dognose", "#222222", 0.6)
    box("zt_dogb%d" % n, (0.8, 1.5, 0.55), (0, 0.05, 0.3), M, 0.1, parent=r, coll=c)
    box("zt_dogh%d" % n, (0.62, 0.62, 0.5), (0, -0.92, 0.27), M, 0.08, parent=r, coll=c)
    box("zt_dogn%d" % n, (0.32, 0.24, 0.22), (0, -1.33, 0.2), Md, 0.04, parent=r, coll=c)
    for j, sx in enumerate((-1, 1)):
        box("zt_doge%d_%d" % (n, j), (0.17, 0.03, 0.04), (sx * 0.15, -1.235, 0.36), Md, 0.0, parent=r, coll=c)
        box("zt_dogear%d_%d" % (n, j), (0.16, 0.22, 0.08), (sx * 0.3, -0.85, 0.5), M, 0.02, rot=(0, sx * 35, 0), parent=r, coll=c)
        box("zt_dogp%d_%d" % (n, j), (0.2, 0.62, 0.16), (sx * 0.2, -1.12, 0.08), M, 0.03, parent=r, coll=c)
        box("zt_dogk%d_%d" % (n, j), (0.22, 0.5, 0.28), (sx * 0.42, 0.45, 0.14), M, 0.05, parent=r, coll=c)
    box("zt_dogt%d" % n, (0.14, 0.6, 0.12), (0.32, 0.95, 0.07), M, 0.03, rot=(0, 0, 35), parent=r, coll=c)
    return r


def zt_build_pizza_box(r, c=None, col=None):
    """a flat pizza box: a red pizza print on the lid (pepperoni, cheese), a red band round the sides, PIZZA on the front"""
    n = ZT_N["n"]
    box("zt_pzb%d" % n, (1.9, 1.9, 0.22), (0, 0, 0.11), zt_m("pizzabox9e", "#eadcc2", 0.85), 0.02, parent=r, coll=c)
    Mr = zt_m("pizzaprint9e", "#d2301f", 0.6)
    cyl("zt_pzc%d" % n, 0.74, 0.02, (0, 0, 0.23), Mr, 28, parent=r, coll=c)
    cyl("zt_pzq%d" % n, 0.6, 0.02, (0, 0, 0.24), zt_m("pizzacheese9e", "#f3c13f", 0.6), 28, parent=r, coll=c)
    Mp = zt_m("pizzapep9e", "#a3170c", 0.6)
    for k, (x, y) in enumerate(((0.3, 0.2), (-0.32, 0.25), (0.05, -0.35), (-0.25, -0.2), (0.35, -0.22), (-0.02, 0.42), (0.0, 0.0))):
        cyl("zt_pzp%d_%d" % (n, k), 0.11, 0.02, (x, y, 0.255), Mp, 12, parent=r, coll=c)
    for k, (x, y, w, dd) in enumerate(((0, -0.955, 1.9, 0.02), (0, 0.955, 1.9, 0.02), (-0.955, 0, 0.02, 1.9), (0.955, 0, 0.02, 1.9))):
        box("zt_pzs%d_%d" % (n, k), (w, dd, 0.09), (x, y, 0.11), Mr, 0.0, parent=r, coll=c)
    try:
        text("zt_pzt%d" % n, "PIZZA", (0, -0.975, 0.115), 0.13, zt_m("pizzatxt9e", "#ffffff", 0.5), rot=(90, 0, 0), extrude=0.005, coll=c, parent=r)
    except Exception as e:
        print("ZW_LOOK|9e|pizza text skipped: %s" % e)
    return r


# ---------------------------------------------------------------- THE DAD: clearly an adult dad in every close-up
def zs_dad(ch):
    """an older DAD: balding (no hair on top), dark hair at the sides, a big dark moustache, thick brows, a white t-shirt,
    striped pajama trousers"""
    H = ch.head
    for o in list(ch.root.children_recursive):
        if o.type == "MESH" and any(sl.material is not None and sl.material.name.startswith(ch.name + "_hair") for sl in o.material_slots):
            o.scale = (0.0001, 0.0001, 0.0001)
    Mh = zw_m("dad_sides9e", "#3b2a20", 0.8)
    for sx in (-1, 1):
        box(ch.name + "_tuft%d" % sx, (0.16, 0.78, 0.44), (sx * 0.6, 0.06, 0.2), Mh, 0.05, parent=H)
        box(ch.name + "_brow%d" % sx, (0.26, 0.07, 0.08), (sx * 0.22, -0.655, 0.27), Mh, 0.02, rot=(0, sx * -6, 0), parent=H)
        box(ch.name + "_mdroop%d" % sx, (0.13, 0.09, 0.22), (sx * 0.34, -0.665, -0.22), zw_m("dad_moust9e", "#1e140e", 0.7), 0.03, parent=H)
    box(ch.name + "_tuftb", (1.0, 0.16, 0.44), (0, 0.6, 0.2), Mh, 0.05, parent=H)
    box(ch.name + "_moustache", (0.76, 0.1, 0.2), (0, -0.67, -0.11), zw_m("dad_moust9e", "#1e140e", 0.7), 0.04, parent=H)
    Ms = zw_m("pj_stripe", "#ffffff", 0.7)
    for leg in ("_legL", "_legR"):
        lg = D.objects.get(ch.name + leg)
        if lg is None:
            continue
        for k in range(4):
            box(ch.name + leg + "_pj%d" % k, (1.02, 1.04, 0.12), (0, 0, -1.7 + k * 0.45), Ms, 0.0, parent=lg)
    return ch


# ---------------------------------------------------------------- THE MONSTER: pure black, never lit, eyes only
def zs_black_mat():
    mt = bpy.data.materials.get("zs_pure_black9e")
    if mt is not None:
        return mt
    mt = bpy.data.materials.new("zs_pure_black9e")
    mt.use_nodes = True
    nt = mt.node_tree
    for nd in list(nt.nodes):
        nt.nodes.remove(nd)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (0.0, 0.0, 0.0, 1.0)
    em.inputs["Strength"].default_value = 0.0
    nt.links.new(em.outputs["Emission"], out.inputs["Surface"])
    mt.diffuse_color = (0.0, 0.0, 0.0, 1.0)
    return mt


def zs_pure_black(m):
    MB = zs_black_mat()
    obs = set(list(m.coll.all_objects) + list(m.root.children_recursive))
    n = 0
    for ob in obs:
        if ob.type != "MESH":
            continue
        nm = ob.name
        if "eye" in nm.lower() or any(sl.material is not None and "eye" in sl.material.name for sl in ob.material_slots):
            continue
        hair = any(sl.material is not None and "_hair" in sl.material.name for sl in ob.material_slots)
        if hair or any(k in nm for k in ("_pupil", "_brow", "_fang", "_tooth", "_mouth", "_horn", "_spike")):
            ob.scale = (0.0001, 0.0001, 0.0001)
            continue
        if ob.material_slots:
            for sl in ob.material_slots:
                sl.material = MB
        else:
            ob.data.materials.append(MB)
        n += 1
    print("ZW_LOOK|9e|monster pure black (%d parts, eyes only glow)" % n)


def zs_shoulders_in(m):
    """the thinner body kept its wide shoulders: the arms floated beside it; the shoulders come in to the body's side"""
    bpy.context.view_layer.update()
    tor = D.objects.get(m.name + "_torso") or (m.torso if hasattr(m, "torso") else None)
    if tor is None:
        return
    Ri = m.root.matrix_world.inverted()
    tp = [Ri @ (tor.matrix_world @ Vector(cc)) for cc in tor.bound_box]
    if not tp:
        return
    tw = max(abs(p.x) for p in tp)
    n = 0
    for side in ("L", "R"):
        sh = m.shL if side == "L" else m.shR
        arm = D.objects.get(m.name + "_arm" + side)
        if sh is None or arm is None:
            continue
        ap = [Ri @ (arm.matrix_world @ Vector(cc)) for cc in arm.bound_box]
        if not ap:
            continue
        inner = min(abs(p.x) for p in ap)
        gap = inner - tw
        if gap <= 0.02:
            continue
        w = sh.matrix_world.copy()
        sgn = 1.0 if (Ri @ w.translation).x > 0 else -1.0
        dl = m.root.matrix_world.to_3x3() @ Vector((-sgn * (gap - 0.02), 0.0, 0.0))
        w.translation = w.translation + dl
        sh.matrix_world = w
        n += 1
    bpy.context.view_layer.update()
    print("ZW_LOOK|9e|monster shoulders in (%d)" % n)


ZW_MON9E = zw_monster


def zw_monster(name, loc, rot=0.0, size=3.5, style="horns", **kw):
    m = ZW_MON9E(name, loc, rot=rot, size=size, style=style, **kw)
    if style == "shadow":
        zs_try(zs_pure_black, m)
        zs_try(zs_shoulders_in, m)
    return m


def zs_monster_hits_wall(m, t, circle_center, rad):
    """the hand slams DOWN at the circle (the arm stays joined, in front of the body); the wall flashes where it hits"""
    m.pose(t - 0.35, armR=(30, 6))
    m.pose(t, armR=(62, 4))
    m.pose(t + 0.3, armR=(55, 6))
    m.pose(t + 1.6, armR=(52, 6))
    zs_upd(t)
    arm = D.objects.get(m.name + "_armR")
    hit = arm.matrix_world @ Vector((0, 0, -1.0)) if arm is not None else za_here(m, t)
    return zs_wall_flash(circle_center, rad, 6.0 * m.root.scale[2] / 2.2, t, hit=hit)


def zs_wall_flash(center, rad, height, t, hit=None):
    """the invisible wall: a see-through shimmer rising from the line where the hand hits, strong enough for a still,
    held a moment, a ripple at the hit"""
    c = Vector(za_pos(center))
    h = Vector(za_pos(hit)) if hit is not None else c + Vector((rad, 0, 2.0))
    d = Vector((h.x - c.x, h.y - c.y, 0.0))
    d = d.normalized() if d.length > 1e-3 else Vector((1, 0, 0))
    a0 = math.atan2(d.y, d.x)
    M = zw_m("wallshimmer9e", "#cfeaff", 0.1, emit="#dff2ff", estr=1.8, alpha=0.3)
    r = empty("zs_wall%d" % F(t), (c.x, c.y, 0.0), None)
    hh = max(3.5, min(height, h.z + 3.0))
    for k in range(-7, 8):
        a = a0 + math.radians(5.5 * k)
        box("zs_wallp%d_%d" % (F(t), k + 7), (2 * math.pi * rad / 64.0 + 0.04, 0.04, hh), (rad * math.cos(a), rad * math.sin(a), hh / 2), M, 0.0, rot=(0, 0, math.degrees(a) + 90), parent=r)
    r.scale = (1.0, 1.0, 0.001)
    r.keyframe_insert("scale", frame=F(t) - 1)
    r.scale = (1.0, 1.0, 1.0)
    r.keyframe_insert("scale", frame=F(t + 0.1))
    r.keyframe_insert("scale", frame=F(t + 1.5))
    r.scale = (1.0, 1.0, 0.001)
    r.keyframe_insert("scale", frame=F(t + 1.9))
    p = c + d * rad
    Mr = zw_m("ripple9e", "#eef8ff", 0.1, emit="#eef8ff", estr=2.0, alpha=0.5)
    rg = cyl("zs_ripple%d" % F(t), 0.5, 0.03, (p.x, p.y, max(0.8, min(hh - 0.4, h.z))), Mr, 20, rot=(90, 0, math.degrees(a0) + 90))
    rg.scale = (0.2, 0.2, 1.0)
    rg.keyframe_insert("scale", frame=F(t))
    rg.scale = (2.0, 2.0, 1.0)
    rg.keyframe_insert("scale", frame=F(t + 0.8))
    rg.scale = (0.001, 0.001, 0.001)
    rg.keyframe_insert("scale", frame=F(t + 0.85))
    return r


# ---------------------------------------------------------------- THE MELT: visible, dripping; the hand lets go
ZS_MELT9E = zs_melt


def zs_melt(obj, t, dur=1.4):
    r = ZS_MELT9E(obj, t, dur)
    ch = ZS_HOLDER.get(obj.name) if obj is not None else None
    if ch is not None and hasattr(ch, "pose"):
        ch.pose(t + dur + 0.1, armR=(80, -24))
        ch.pose(t + dur + 0.6, armR=(10, 4))
        zs_arm_release(ch, t + dur + 0.6)
    return r


# ---------------------------------------------------------------- THE LINE: the dad's redraw may end on a mark
ZS_RING_FRONT9E = zs_ring_front


def zs_ring_front(r, near=None, end=None):
    pts = ZS_RING_FRONT9E(r, near)
    if end is None or not pts:
        return pts
    P = zs_ring_pts(r)
    xs = sorted(p[0] for p in P) if P else [pts[0][0], pts[-1][0]]
    x0, iy = pts[0][0], pts[0][1]
    x1 = max(xs[0], min(xs[-1], float(end[0])))
    n = 8
    return [(x0 + (x1 - x0) * k / n, iy) for k in range(n + 1)]


# ---------------------------------------------------------------- THE LIGHT: dark warm dusk, a golden sunrise
def zs_chalk_mat():
    night = zw_time() in ("night", "storm") or ZS.get("deep")
    if night:
        return zw_m("chalk_matte_n", "#f2f2ee", 0.95, emit="#e8ebf2", estr=0.22)
    if zw_time() == "sunset":
        return zw_m("chalk_matte_s", "#f4f2ec", 0.95, emit="#fff1e0", estr=0.5)
    return zw_m("chalk_matte_d", "#f2f2ee", 0.95)


def zs_grass_tone(mul):
    """the textured grass (a colour ramp) darker at dusk / morning; back to its own colours otherwise"""
    for m in bpy.data.materials:
        if not m.use_nodes or not m.name.startswith("zw_grass"):
            continue
        for nd in m.node_tree.nodes:
            if nd.type != "VALTORGB":
                continue
            els = nd.color_ramp.elements
            if "zs_r0" not in m:
                m["zs_r0"] = [float(v) for e in els for v in e.color]
            f0 = list(m["zs_r0"])
            for j, e in enumerate(els):
                c = f0[4 * j: 4 * j + 4] if 4 * j + 3 < len(f0) else list(e.color)
                e.color = (c[0] * mul[0], c[1] * mul[1], c[2] * mul[2], 1.0) if mul else (c[0], c[1], c[2], 1.0)


ZS_LAWN_WORDS = ("grass", "lawn", "yard", "turf")


def zs_lawn_tone(mul):
    """every other lawn / grass material (plain colour) darker at dusk / morning, back otherwise"""
    for m in bpy.data.materials:
        nm = m.name.lower()
        if not m.use_nodes or nm.startswith("zw_grass") or not any(k in nm for k in ZS_LAWN_WORDS):
            continue
        for nd in m.node_tree.nodes:
            if nd.type != "BSDF_PRINCIPLED" or nd.inputs["Base Color"].is_linked:
                continue
            if "zs_g0" not in m:
                if mul is None:
                    continue
                m["zs_g0"] = [float(v) for v in nd.inputs["Base Color"].default_value]
            c = list(m["zs_g0"])
            nd.inputs["Base Color"].default_value = (c[0] * mul[0], c[1] * mul[1], c[2] * mul[2], 1.0) if mul else (c[0], c[1], c[2], 1.0)


def zs_sky_gold(w):
    """the morning sky: the world gradient tinted to a golden sunrise"""
    if w is None or not w.use_nodes:
        return
    gold = (1.0, 0.68, 0.38)
    for nd in w.node_tree.nodes:
        if nd.type != "VALTORGB":
            continue
        els = nd.color_ramp.elements
        if "zs_w0" not in w:
            w["zs_w0"] = [float(v) for e in els for v in e.color]
        f0 = list(w["zs_w0"])
        for j, e in enumerate(els):
            c = f0[4 * j: 4 * j + 4] if 4 * j + 3 < len(f0) else list(e.color)
            e.color = (c[0] * 0.4 + gold[0] * 0.6 * 0.85, c[1] * 0.4 + gold[1] * 0.6 * 0.85, c[2] * 0.4 + gold[2] * 0.6 * 0.85, 1.0)
    print("ZW_LOOK|9e|sky gold")


def zs_light9e(time):
    ZS["time9e"] = time
    w = bpy.context.scene.world
    bg = [nd for nd in w.node_tree.nodes if nd.type == "BACKGROUND"] if w is not None and w.use_nodes else []
    if time in ("sunset", "morning"):
        for o in D.objects:
            if o.type == "LIGHT" and o.data.type == "SUN" and not o.name.startswith("zs_lightning"):
                if "zs_e9e" not in o.data:
                    o.data["zs_e9e"] = float(o.data.energy)
                if time == "sunset":
                    o.data.energy = o.data["zs_e9e"] * 0.7
                    o.data.color = (1.0, 0.52, 0.28)
                    o.rotation_euler = (math.radians(79.0), 0.0, math.radians(-62.0))
                else:
                    o.data.energy = o.data["zs_e9e"] * 0.9
                    o.data.color = (1.0, 0.7, 0.4)
                    o.rotation_euler = (math.radians(78.0), 0.0, math.radians(-40.0))
        for nd in bg:
            if "zs_s9e" not in w:
                w["zs_s9e"] = float(nd.inputs["Strength"].default_value)
                w["zs_c9e"] = list(nd.inputs["Color"].default_value)
            if time == "sunset":
                nd.inputs["Strength"].default_value = w["zs_s9e"] * 0.6
            else:
                nd.inputs["Strength"].default_value = w["zs_s9e"] * 0.8
                nd.inputs["Color"].default_value = (0.95, 0.66, 0.4, 1.0)
        zs_grass_tone((0.42, 0.36, 0.22) if time == "sunset" else (0.52, 0.46, 0.3))
        zs_try(zs_lawn_tone, (0.45, 0.4, 0.26) if time == "sunset" else (0.55, 0.48, 0.3))
        if time == "morning":
            zs_try(zs_sky_gold, w)
        if time == "sunset":
            ZS["chalk_w"] = 1.2
        print("ZW_LOOK|9e|light %s" % time)
    else:
        zs_grass_tone(None)
        zs_try(zs_lawn_tone, None)


ZS_LIGHT9E = zs_light


def zs_light(time, t0, t1):
    r = ZS_LIGHT9E(time, t0, t1)
    zs_try(zs_light9e, time)
    return r


ZW_LOOK_APPLY9E = zw_look_apply


def zw_look_apply(*a, **k):
    r = ZW_LOOK_APPLY9E(*a, **k)
    if ZS.get("time9e") in ("sunset", "morning"):
        zs_try(zs_light9e, ZS["time9e"])
    return r


# ---------------------------------------------------------------- THE CAMERAS
def zs_street_dir(c):
    """from a point toward the street (the street runs along x at y = 0)"""
    if abs(c.y) > 3.0:
        return Vector((0.0, -1.0 if c.y > 0 else 1.0, 0.0))
    try:
        st_c, st_d, st_r, st_rot = zw_stage(ZS["place"] or "suburb_street")
        v = Vector((-st_d.x, -st_d.y, 0.0))
        return v.normalized() if v.length > 1e-3 else Vector((0.0, -1.0, 0.0))
    except Exception:
        return Vector((0.0, -1.0, 0.0))


def zs_rot(v, deg):
    a = math.radians(deg)
    return Vector((v.x * math.cos(a) - v.y * math.sin(a), v.x * math.sin(a) + v.y * math.cos(a), 0.0))


def zs_in_house(q):
    for o in D.objects:
        if o.type == "MESH" and o.name.startswith("zw_h") and o.name[4:].isdigit():
            b = zw_box_of(o)
            if b and b[0].x - 0.6 < q.x < b[1].x + 0.6 and b[0].y - 0.6 < q.y < b[1].y + 0.6 and q.z < b[1].z + 2.5:
                return True
    return False


def zs_fit(t0, t1, pts_at, dirs, lens, frac=None, zc=None, aimz=None, margin=0.05, push=0.06, d0=6.0, skip=()):
    """a camera on one of the horizontal directions `dirs` from the subjects' centre, measured at the middle frame: the
    points' box inside the margins and (frac) their height share = frac; not inside a house, not blocked"""
    tm = (t0 + t1) / 2.0
    zs_upd(tm)
    pts = pts_at(tm)
    if not pts:
        return None
    cx = sum(p.x for p in pts) / len(pts)
    cy = sum(p.y for p in pts) / len(pts)
    z0, z1 = min(p.z for p in pts), max(p.z for p in pts)
    az = aimz if aimz is not None else (z0 + z1) / 2.0
    cz = zc if zc is not None else az
    cam = Cam()
    best = None
    for dv in dirs:
        D_ = d0
        ok, last_in = False, None
        for it in range(9):
            loc = Vector((cx + dv.x * D_, cy + dv.y * D_, cz))
            aim = Vector((cx, cy, az))
            cam.key(t1, tuple(loc), tuple(aim), lens=lens)
            zs_upd(tm)
            sp = zw_span(cam.ob, pts)
            if sp is None:
                D_ *= 1.35
                continue
            u0, u1, v0, v1 = sp
            h = v1 - v0
            inside = u0 > margin and u1 < 1 - margin and v0 > margin and v1 < 1 - margin
            if inside:
                last_in = (loc.copy(), aim.copy(), D_)
            if frac is None:
                if inside:
                    ok = True
                    break
                k = 1.15
            else:
                if inside and abs(h - frac) < 0.05:
                    ok = True
                    break
                k = h / max(0.05, frac)
                if not inside:
                    k = max(k, 1.12)
            D_ = max(0.6, D_ * k)
        if last_in is not None:
            loc, aim, D_ = last_in
        bad = zs_in_house(loc) or zw_blocked(Vector((cx, cy, az)), loc, skip)
        score = (2 if (ok or last_in is not None) else 0) + (0 if bad else 1)
        if best is None or score > best[0]:
            best = (score, loc.copy(), aim.copy(), D_)
        if score == 3:
            break
    s, loc, aim, D_ = best
    dv = loc - aim
    dv.z = 0.0
    dv = dv.normalized() if dv.length > 1e-3 else Vector((0.0, -1.0, 0.0))
    cam.key(t0, tuple(loc + dv * D_ * push), tuple(aim), lens=lens)
    cam.key(t1, tuple(loc), tuple(aim), lens=lens)
    ZW_FRAMED["cut"] = "9e fit (%d of 3)" % s
    return cam


def zs_cam_two(two, t0, t1, close=False, thing=None, frac=None):
    """TWO PEOPLE: both fully in frame (or close, hips up, with the thing between them), seen across the line between
    them from the street side"""
    two = [p for p in two if p is not None]
    if len(two) < 2:
        return None
    tm = (t0 + t1) / 2.0
    zs_upd(tm)
    a, b = za_here(two[0], tm), za_here(two[1], tm)
    ax = Vector((b.x - a.x, b.y - a.y, 0.0))
    ax = ax.normalized() if ax.length > 1e-3 else Vector((1.0, 0.0, 0.0))
    c = (a + b) / 2.0
    base = zs_street_dir(c)
    perp = Vector((-ax.y, ax.x, 0.0))
    if perp.dot(base) < 0:
        perp = -perp

    def pts_at(t):
        out = []
        for ch in two:
            out += zw_body_pts(ch) if close else zw_vpts([ch.root])
        if thing is not None:
            out += zw_pts([thing]) or []
        return out
    P = pts_at(tm)
    if not P:
        return None
    top = max(p.z for p in P)
    dirs = [perp, zs_rot(perp, 25), zs_rot(perp, -25), zs_rot(perp, 45), zs_rot(perp, -45), base]
    skip = tuple(p.name + "_" for p in two) + ("zt_",)
    return zs_fit(t0, t1, pts_at, dirs, 32 if close else 26, frac=None if close else frac,
                  zc=top * (0.78 if close else 0.5), margin=0.07 if close else 0.05, d0=4.0 if close else 7.0, skip=skip)


def zs_cam_hand(t0, t1, ppl, Tt):
    """A HAND + THE THING IN IT (or the pocket it is going into), close, following it"""
    th = [o for o in Tt if "pts" not in o and not o.name.startswith("zs_")]
    if not th:
        return None
    o = th[0]
    ps = zw_ps()
    tm = (t0 + t1) / 2.0

    def at(t):
        zs_upd(t)
        return zt_centre(o)[0]
    cm = at(tm)
    holder = ZS_HOLDER.get(o.name) or (ppl[0] if ppl else None)
    base = zs_street_dir(cm)
    dv = base
    if holder is not None:
        f = zs_fwd(holder, tm)
        if (f + base).length > 0.3:
            dv = (f + base).normalized()
    cam = Cam()
    pocketed = any(k.name.startswith("zs_pocket") and k.influence > 0.5 for k in o.constraints)
    D_ = (3.4 if pocketed else 2.3) * ps / 0.55
    up = (0.2 if pocketed else 0.55) * ps / 0.55
    for t in (t0, tm, t1):
        c = at(t)
        k = (t - t0) / max(0.05, t1 - t0)
        dd = D_ * (1.08 - 0.08 * k)
        loc = c + dv * dd + Vector((0.0, 0.0, up))
        cam.key(t, tuple(loc), tuple(c + Vector((0.0, 0.0, 0.08 * ps / 0.55))), lens=38)
    ZW_FRAMED["cut"] = "9e hand (%s)" % o.name
    return cam


def zs_cam_behind(t0, t1, ch, ahead):
    """A PERSON FROM BEHIND, what they face ahead (the dad, the monster down the street)"""
    tm = (t0 + t1) / 2.0
    zs_upd(tm)
    pc = za_here(ch, tm)
    if ahead is not None and hasattr(ahead, "root"):
        pa = za_here(ahead, tm)
    else:
        pa = pc + zs_fwd(ch, tm) * 8.0
    d = Vector((pc.x - pa.x, pc.y - pa.y, 0.0))
    d = d.normalized() if d.length > 1e-3 else Vector((0.0, 1.0, 0.0))
    rgt = Vector((d.y, -d.x, 0.0))

    def pts_at(t):
        out = zw_vpts([ch.root])
        if ahead is not None and hasattr(ahead, "root"):
            out += zw_vpts([ahead.root])
        return out
    P = pts_at(tm)
    if not P:
        return None
    top = max(p.z for p in P)
    ps = zw_ps()
    dirs = [(d + rgt * k).normalized() for k in (0.18, -0.18, 0.35, -0.35, 0.0)]
    skip = (ch.name + "_",) + ((ahead.name + "_",) if ahead is not None and hasattr(ahead, "name") else ())
    return zs_fit(t0, t1, pts_at, dirs, 20, frac=None, zc=1.3 * ps / 0.55, aimz=top * 0.45, margin=0.04, d0=3.0 * ps / 0.55, skip=skip)


def zs_cam_top(t0, t1, P, Tt, frac):
    """STRAIGHT ABOVE a thing on the ground: its long side upright in the frame, sized to the reference"""
    tm = (t0 + t1) / 2.0
    zs_upd(tm)
    o = Tt[0]
    R = zs_ring_pts(o) if "pts" in o else []
    if R:
        pts = [Vector((p[0], p[1], 0.05)) for p in R]
    else:
        pts = zw_vpts([o]) or zw_pts([o])
    if not pts:
        return None
    xs, ys = [p.x for p in pts], [p.y for p in pts]
    cx, cy = (min(xs) + max(xs)) / 2.0, (min(ys) + max(ys)) / 2.0
    ex, ey = max(xs) - min(xs), max(ys) - min(ys)
    top = 0.5
    for nm, ch in zw_cast():
        q = za_here(ch, tm)
        if abs(q.x - cx) < ex / 2.0 + 1.0 and abs(q.y - cy) < ey / 2.0 + 1.0:
            vp = zw_vpts([ch.root])
            top = max([top] + [p.z for p in vp])
    zs_upd(tm)
    upv = Vector((1.0, 0.0, 0.0)) if ex >= ey else Vector((0.0, 1.0, 0.0))
    lens = 28
    tv = 12.0 / lens
    long_, short = max(ex, ey), min(ex, ey)
    want = frac or 0.7
    h = long_ / (2.0 * tv * want)
    h = max(h, short / (2.0 * tv * 9.0 / 16.0 * 0.92), top + 2.0, top * 1.8 if top > 4.0 else 0.0)   # (round 9f: well above a tall monster: its head filled the frame)
    cam = Cam()

    def keys(hh):
        eps = 0.01 * hh
        cam.key(t0, (cx, cy, hh * 1.07), (cx + upv.x * eps, cy + upv.y * eps, 0.0), lens=lens)
        cam.key(t1, (cx, cy, hh), (cx + upv.x * eps, cy + upv.y * eps, 0.0), lens=lens)
    keys(h)
    if frac:
        zs_upd(tm)
        sp = zw_span(cam.ob, pts)
        if sp is not None:
            hg = sp[3] - sp[2]
            if hg > 0.05 and abs(hg - frac) > 0.04:
                keys(max(top + 1.5, h * hg / frac))
    ZW_FRAMED["cut"] = "9e top (straight above, long side upright)"
    return cam


def zs_line_pts_near(ring, x, y, sy, span=3.5):
    """points along the ring's edge in front of (x, y) toward sy (the street side), every 0.25"""
    R = zs_ring_pts(ring) if ring is not None else []
    out = []
    for k in range(len(R)):
        a, b = R[k], R[(k + 1) % len(R)]
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        n = max(1, int(L / 0.25))
        for j in range(n + 1):
            px, py_ = a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n
            if abs(px - x) < span and (py_ - y) * sy > -0.2:
                out.append(Vector((px, py_, 0.03)))
    return out


def zs_cam_kid_legs(t0, t1, kid, Tt):
    """ONLY A KID'S LEGS, the chalk line across the front of the frame (a low camera just outside the line)"""
    tm = (t0 + t1) / 2.0
    zs_upd(tm)
    pk = za_here(kid, tm)
    vp = zw_vpts([kid.root])
    if not vp:
        return None
    top = max(p.z for p in vp)
    hip = top * 0.42
    legs = [p for p in vp if p.z < hip]
    if not legs:
        return None
    sy = -1.0 if pk.y > 0 else 1.0
    ring = Tt[0] if Tt and "pts" in Tt[0] else None
    line = zs_line_pts_near(ring, pk.x, pk.y, sy)
    near = [p for p in line if (p.y - pk.y) * sy > 0]
    gap = min([abs(p.y - pk.y) for p in near] + [3.0]) if near else 0.8
    ps = zw_ps()
    cam = Cam()
    best = None
    for dd in (0.35, 0.6, 0.9, 1.3):
        for z in (0.12, 0.22, 0.35):
            for lens in (24, 30):
                for az in (0.45, 0.3):
                    loc = Vector((pk.x + 0.2, pk.y + sy * (gap + dd), z * ps / 0.55))
                    aim = Vector((pk.x, pk.y, hip * az))
                    cam.key(t1, tuple(loc), tuple(aim), lens=lens)
                    zs_upd(tm)
                    sp = zw_span(cam.ob, legs)
                    if sp is None:
                        continue
                    h = min(1.0, sp[3]) - max(0.0, sp[2])
                    ok_u = sp[0] > -0.05 and sp[1] < 1.05
                    seen = 0
                    for q in line:
                        uv = zw_uv(cam.ob, q)
                        if uv is not None and 0.0 < uv[0] < 1.0 and 0.6 < uv[1] < 1.0:
                            seen += 1
                    score = -abs(h - 0.9) + (0.6 if seen >= 3 else 0.0) + (0.2 if ok_u else 0.0)
                    if best is None or score > best[0]:
                        best = (score, loc.copy(), aim.copy(), lens)
    if best is None:
        return None
    s, loc, aim, lens = best
    cam.key(t0, tuple(loc + Vector((0.0, sy * 0.12, 0.0))), tuple(aim), lens=lens)
    cam.key(t1, tuple(loc), tuple(aim), lens=lens)
    ZW_FRAMED["cut"] = "9e kid legs + the line (%.2f)" % s
    return cam


def zs_cam_mon_legs(t0, t1, m, ppl):
    """THE MONSTER'S LEGS big in frame, from outside its circle, the kid behind it (beyond the circle)"""
    tm = (t0 + t1) / 2.0
    zs_upd(tm)
    pm = za_here(m, tm)
    kid = ppl[0] if ppl else None
    if kid is None:
        best_d = None
        for nm, ch in zw_cast():
            if ch.name in ZW_MON:
                continue
            q = za_here(ch, tm)
            dd = (Vector((q.x, q.y, 0)) - Vector((pm.x, pm.y, 0))).length
            if best_d is None or dd < best_d:
                best_d, kid = dd, ch
    zs_upd(tm)
    vp = zw_vpts([m.root])
    if not vp:
        return None
    top = max(p.z for p in vp)
    legs = [p for p in vp if p.z < top * 0.45]
    if kid is not None:
        pk = za_here(kid, tm)
        d = Vector((pm.x - pk.x, pm.y - pk.y, 0.0))
    else:
        d = zs_street_dir(pm)
    d = d.normalized() if d.length > 1e-3 else Vector((0.0, -1.0, 0.0))
    ps = zw_ps()
    rad = 4.2 * ps / 0.55
    kp = zw_vpts([kid.root]) if kid is not None else []
    cam = Cam()
    best = None
    zs_upd(tm)
    for R in (rad + 1.0, rad + 2.0, rad + 3.2):
        for yaw in (0.0, 14.0, -14.0):
            for lens in (22, 26):
                dv = zs_rot(d, yaw)
                loc = Vector((pm.x + dv.x * R, pm.y + dv.y * R, 1.1 * ps / 0.55))
                aim = Vector((pm.x, pm.y, top * 0.24))
                if zs_in_house(loc):
                    continue
                cam.key(t1, tuple(loc), tuple(aim), lens=lens)
                zs_upd(tm)
                sp = zw_span(cam.ob, legs)
                if sp is None:
                    continue
                h = min(1.0, sp[3]) - max(0.0, sp[2])
                ks = zw_span(cam.ob, kp) if kp else None
                kid_in = ks is not None and ks[0] > 0.02 and ks[1] < 0.98 and ks[2] > 0.02 and ks[3] < 0.98
                score = -abs(h - 0.88) + (0.5 if kid_in else 0.0)
                if best is None or score > best[0]:
                    best = (score, loc.copy(), aim.copy(), lens)
    if best is None:
        return None
    s, loc, aim, lens = best
    cam.key(t0, tuple(loc + (loc - aim).normalized() * 0.3), tuple(aim), lens=lens)
    cam.key(t1, tuple(loc), tuple(aim), lens=lens)
    ZW_FRAMED["cut"] = "9e monster legs, the kid behind (%.2f)" % s
    return cam


def zs_face_cam(m, cam, t0, t1):
    """the monster's head turns to the lens (its two eyes in the shot)"""
    tm = (t0 + t1) / 2.0
    zs_upd(tm)
    pm = za_here(m, tm)
    cl = Vector(cam.ob.matrix_world.translation)
    want = za_yaw(Vector((pm.x, pm.y, 0.0)), Vector((cl.x, cl.y, 0.0)))
    cur = zm_yaw_at(m, tm)
    dl = ((want - cur + 180.0) % 360.0) - 180.0
    hy = max(-80.0, min(80.0, dl))
    if abs(hy) < 8.0:
        return
    for t in (t0 - 0.4, tm, t1 + 0.1):
        m.pose(t, head=(hy, 12, 0))


def zc_cut9e(t0, t1, kind, P, Tt, frac):
    mons = [p for p in P if p.name in ZW_MON]
    ppl = [p for p in P if p.name not in ZW_MON]
    if kind in ("two", "medium", "close", "wide", "low") and not mons:
        for (ha, hb, g, k, th) in ZS_HANDOVERS:
            if ha < t1 and hb > t0 and (g in P or k in P):
                return zs_cam_two([g, k], t0, t1, close=True, thing=th)
    if kind == "hand":
        return zs_cam_hand(t0, t1, ppl, Tt)
    if kind == "behind" and ppl:
        return zs_cam_behind(t0, t1, ppl[0], mons[0] if mons else (ppl[1] if len(ppl) > 1 else None))
    if kind == "two" and len(ppl) >= 2 and not mons and not any("crowd" in p.name.lower() for p in ppl):
        return zs_cam_two(ppl[:2], t0, t1, close=False, frac=frac)
    if kind == "top" and Tt:
        return zs_cam_top(t0, t1, P, Tt, frac)
    if kind == "legs" and ppl and not mons:
        return zs_cam_kid_legs(t0, t1, ppl[0], Tt)
    if kind == "legs" and mons:
        return zs_cam_mon_legs(t0, t1, mons[0], ppl)
    return None


ZC_CUT9E = zc_cut


def zc_cut(t0, t1, kind, people=(), things=(), move="push_in", side=None, hero=None, tag="", frac=None, v=None):
    P = [p for p in people if p is not None]
    Tt = [o for o in things if o is not None]
    cam = None
    try:
        cam = zc_cut9e(t0, t1, kind, P, Tt, frac)
    except Exception as e:
        print("ZW_LOOK|9e|cut %s fell back: %s" % (kind, str(e)[:160]))
        cam = None
    if cam is None:
        kk = {"hand": "insert", "behind": "low"}.get(kind, kind)
        cam = ZC_CUT9E(t0, t1, kk, people, things, move, side, hero, tag, frac, v)
        mons = [p for p in P if p.name in ZW_MON]
        if mons and any(p.name not in ZW_MON for p in P) and cam is not None:
            zs_try(zs_face_cam, mons[0], cam, t0, t1)
        return cam
    if tag:
        zc_measure(cam, t0, t1, P, Tt, tag)
    return cam
# ===== END OF STAGE 9e ===============================================================================================
