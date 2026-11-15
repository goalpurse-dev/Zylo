# ===== ZYVO ACTION LIBRARY v1 (scripts/blockyWorlds/blenderKit/actions/actions.py) ===================================
# Reusable ACTION MOMENTS: a staged rig + animation + TESTED camera spots, like the world library. The director picks a
# moment and its phases; the moment does the staging (positions, timing, easing, the crowd, the camera). The pipeline
# pastes this file after the world library (no imports here; the same static check as any shot code). The catalog the
# director reads is actions.mjs (ACTIONS); its geometry mirrors the ZX_* numbers below (tests: actions.test.mjs).
#
# CATCH: a giant catches a toppling building right before it hits the ground, and sets it back upright.
#   The building is any object parented to a PIVOT at its front-bottom edge whose +X rotation tips it toward -Y (the
#   street), e.g. a bank built at y = 178: pivot (0, 171, 0). The giant kneels in the street in front of it, facing it.
#   zx_catch_plan(size=7.0, phi=40.0)           -> dict: theta (the catch angle), root (the giant's spot), hand_top, edge_y
#   zx_topple(piv, t0, t1, a0, a1, kind)         the building's angle a0 -> a1 (kind "tip" eases out, "fall" accelerates
#                                                like gravity, "set" eases in and out: gentle)
#   zx_catch_pose(ch, t, plan, reach=False)      the giant kneels (legs back, hips down) with both arms reaching forward
#                                                (reach=True: arms still high, coming down to meet the building later)
#   zx_stand(ch, t, plan)                        the giant back on his feet at the same spot (arms relaxed)
#   zx_crowd(name, n, t0, t1, y0, y1, expr, seed) small townsfolk running from y0 to y1 (toward the camera / away)
#   zx_hug(ch, t0, t1, target, approach)         a character runs to a point (an ankle) and hugs it
#   zx_catch_spot(cam, spot, plan, t0, t1)       TESTED camera spots (open street, clear lines, outside the giant):
#       "street"          behind the running crowd (the tip: the hero still kid-size)
#       "front_high"      the giant's FRONT from high over the building's back (the fall, the hold, the set-down)
#       "front_left_high" its mirror (two phases in a row never share a spot)
#       "face_kneel"      the kneeling giant's whole face from the front (zw_giant_cam assumes a standing giant)
#       "side"            3/4 from behind the giant's right, the building over his shoulder
#       "door"            from the steps back at the standing giant: the crowd running out to his feet, the hug
# Phases, one per shot: tip -> fall -> catch (hold, the gap) -> strain (the face: "face_kneel")
#   -> set (back upright, gently) -> cheer (people run out, someone hugs the giant's ankle)

ZX_CATCH = {"pivot_y": 171.0, "edge_z": 24.0, "front": -0.5, "size": 7.0, "phi": 40.0}
ZX_KNEEL = {"hip": 0.5, "shoulder": 1.55, "arm": 1.55, "hand": 0.5}
ZX_LANE = (-7.3, 7.3)   # downtown's street lane (worlds.py ZW_T["lanes"]); the sidewalks are 7..12 on each side


def zx_kneel_hand(size, phi):
    """a kneeling giant's hand (forward of the root, top height) for arms phi degrees forward of hanging"""
    a = math.radians(phi)
    fwd = ZX_KNEEL["arm"] * math.sin(a) * size
    top = (ZX_KNEEL["hip"] + ZX_KNEEL["shoulder"] - ZX_KNEEL["arm"] * math.cos(a) + ZX_KNEEL["hand"]) * size
    return fwd, top


def zx_catch_angle(hand_top, edge_z=None, front=None):
    """the building's angle (degrees) at which its top front edge rests on the hands: front*sin + edge_z*cos = hand_top"""
    ez = ZX_CATCH["edge_z"] if edge_z is None else edge_z
    fr = ZX_CATCH["front"] if front is None else front
    lo, hi = 0.0, 90.0
    for _ in range(50):
        mid = (lo + hi) / 2
        a = math.radians(mid)
        if fr * math.sin(a) + ez * math.cos(a) > hand_top:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def zx_catch_plan(size=None, phi=None, x=0.0):
    s = ZX_CATCH["size"] if size is None else size
    p = ZX_CATCH["phi"] if phi is None else phi
    fwd, top = zx_kneel_hand(s, p)
    th = zx_catch_angle(top)
    a = math.radians(th)
    edge_y = ZX_CATCH["pivot_y"] + ZX_CATCH["front"] * math.cos(a) - ZX_CATCH["edge_z"] * math.sin(a)
    return {"size": s, "phi": p, "theta": th, "hand_top": top, "edge_y": edge_y, "root": (x, edge_y - fwd, 0.0)}


def zx_topple(piv, t0, t1, a0, a1, kind="fall"):
    piv.rotation_euler[0] = math.radians(a0)
    piv.keyframe_insert("rotation_euler", index=0, frame=F(t0))
    piv.rotation_euler[0] = math.radians(a1)
    piv.keyframe_insert("rotation_euler", index=0, frame=F(t1))
    ease = {"tip": ("QUAD", "EASE_OUT"), "fall": ("QUAD", "EASE_IN"), "set": ("SINE", "EASE_IN_OUT")}.get(kind, ("BEZIER", None))
    set_interp(piv, "rotation_euler", F(t0), ease[0], ease[1])
    return piv


def zx_catch_pose(ch, t, plan, reach=False):
    ph = 105 if reach else plan["phi"]
    ch.pose(t, loc=plan["root"], rot=180, hipz=-1.5, legL=(-90, 4), legR=(-90, 4), armL=(ph, 10), armR=(ph, 10), torso=(0, 0, 0))
    return ch


def zx_stand(ch, t, plan, arms=(10, 12)):
    ch.pose(t, loc=plan["root"], rot=180, hipz=0.0, legL=(0, 0), legR=(0, 0), armL=arms, armR=arms)
    return ch


ZX_SHIRTS = ["#e74c3c", "#3498db", "#f1c40f", "#9b59b6", "#1abc9c", "#e67e22", "#ff6fa8", "#2ecc71"]
ZX_HAIR = ["messy", "bob", "buzz", "bun", "cap", "spiky"]
ZX_FACES = ["kid", "girl", "mustache", "plain"]


def zx_person(name, t0, t1, expr="scream", seed=0, shirt=None, hair=None, face=None):
    rnd = random.Random(seed)
    return story._live(chars.Char(name, skin=rnd.choice(["#f1dfc6", "#e0b48c", "#c99a72", "#8d5a3c"]), shirt=shirt or rnd.choice(ZX_SHIRTS),
                                  pants=rnd.choice(["#2c3e50", "#34495e", "#5d4037", "#1f3a68"]), hair=hair or rnd.choice(ZX_HAIR),
                                  hair_color=rnd.choice(["#3a2a1a", "#5a3a22", "#d9a441", "#1c1c1c"]), face=face or rnd.choice(ZX_FACES)), t0, t1, expr)


def zx_crowd_x(x, avoid=None):
    """a crowd member's x: never in the street (MILO LESSON, owner 2026-11-15: the crowd ran down the middle of the
    street) -> the nearest sidewalk side (zw_off_lane, the same lanes as the background people); and it PARTS around
    `avoid` = (ax, ay, r) (the hero): nobody runs through him"""
    if avoid is not None and abs(x - avoid[0]) < avoid[2]:
        x = avoid[0] + (avoid[2] if x >= avoid[0] else -avoid[2])
    x0, x1 = ZX_LANE
    if x0 - 0.9 < x < x1 + 0.9:      # in the street: onto the sidewalk on its side, spread over the sidewalk's width
        x = x0 - 1.0 - (abs(x - x0) % 2.6) if x < (x0 + x1) / 2 else x1 + 1.0 + (abs(x1 - x) % 2.6)
    return x


def zx_crowd(name, n, t0, t1, y0, y1, expr="scream", seed=0, xspan=9.0, run_t1=None, cheer=False, avoid=None, street=False):
    """n small townsfolk running from y0 to y1 (staggered, never in a line) ON THE SIDEWALKS (street=True only when the
    line puts a crowd in the street); avoid=(x, y, r): the crowd parts around that point (the hero); on screen t0..t1,
    running until run_t1 (default t1); cheer=True: arms up and a jump when they arrive"""
    out = []
    rnd = random.Random(seed)
    te = t1 if run_t1 is None else min(t1, run_t1)
    for i in range(n):
        x = -xspan + (2 * xspan) * (i + 0.5) / n + rnd.uniform(-0.8, 0.8)
        x2 = x + rnd.uniform(-1.5, 1.5)
        if not street:
            x, x2 = zx_crowd_x(x, avoid), zx_crowd_x(x2, avoid)
        elif avoid is not None:
            x, x2 = zx_crowd_x(x, avoid) if abs(x - avoid[0]) < avoid[2] else x, zx_crowd_x(x2, avoid) if abs(x2 - avoid[0]) < avoid[2] else x2
        dy = rnd.uniform(-3, 3)
        k = zx_person("%s%d" % (name, i), t0, t1, expr, seed * 31 + i)
        k.walk(t0, te, (x, y0 + dy, 0), (x2, y1 + dy, 0), rate=3.6, swing=48, arm=55, bob=0.3)
        if cheer and te + 0.1 < t1:
            k.act(te + 0.03 * i, "cheer")
        out.append(k)
    return out


def zx_hug(ch, t0, t1, target, approach):
    """ch runs from `approach` to just in front of `target` (x, y) and hugs it (arms around, cheek in)"""
    tx, ty = target
    ax, ay = approach
    d = math.hypot(ax - tx, ay - ty) or 1.0
    stop = (tx + (ax - tx) / d * 0.9, ty + (ay - ty) / d * 0.9, 0)
    tm = t0 + min(0.9, 0.55 * (t1 - t0))
    ch.walk(t0, tm, (ax, ay, 0), stop, rate=3.6, swing=48, arm=55, bob=0.3)
    ch.pose(tm + 0.05, armL=(85, -28), armR=(85, -28), head=(0, 10, 12))
    ch.pose(t1, armL=(80, -32), armR=(80, -32), head=(0, 12, 12))
    return ch


# the TESTED spots (actions.test.mjs: every spot stands in open street and sees its subject along a clear line)
def zx_catch_spot(cam, spot, plan, t0, t1, push=0.05):
    rx, ry, _ = plan["root"]
    s = plan["size"]
    if spot == "street":      # the tip: a kid-size hero, the crowd running at the lens, the building leaning over them
        loc, tgt, lens = (6.0, ry - 36.0, 3.0), (0.0, ry + 18.0, 14.0), 22
    elif spot == "front_high":  # the giant's FRONT, from high over the building's back (clears its top while it falls)
        loc, tgt, lens = (12.0, ZX_CATCH["pivot_y"] + 25.0, 52.0), (rx, ry + 2.0, 3.7 * s), 28
    elif spot == "front_left_high":  # the mirror of front_high (two phases in a row never share a spot)
        loc, tgt, lens = (-14.0, ZX_CATCH["pivot_y"] + 25.0, 48.0), (rx, ry + 2.0, 3.7 * s), 28
    elif spot == "face_kneel":  # the kneeling giant's WHOLE face from the front, looking down over the caught building's
        # top edge (preview 2: a level camera had the building's band across the face)
        hz = (ZX_KNEEL["hip"] + 2.35) * s
        loc, tgt, lens = (rx + 1.0, ry + 4.4 * s, hz + 2.0 * s), (rx, ry, hz + 0.15 * s), 30
    elif spot == "side":      # 3/4 from behind the giant's right, far enough to see the building over his shoulder
        loc, tgt, lens = (11.0, ry - 34.0, 10.0), (-2.0, ry + 16.0, 18.0), 22
    else:  # "door": from the bank's steps back at the standing giant: the crowd running out to his feet, the hug
        loc, tgt, lens = (10.0, ZX_CATCH["pivot_y"] - 6.0, 4.0), (2.0, ry + 5.0, 1.3 * s), 24
    end = tuple(loc[k] + (tgt[k] - loc[k]) * push for k in range(3))
    cam.key(t0, loc, tgt, lens=lens)
    cam.key(t1, end, tgt, lens=lens)
    return loc, tgt
# ===== END OF THE ZYVO ACTION LIBRARY ================================================================================
