# ===== ROUND 9d (owner 2026-11-23): THE LAST REPLICA FIXES + THE LIBRARY OF WHAT WE BUILT =============================
# Pasted after stage9c.py.
#   the dad redraws the line from INSIDE it (along the inner edge); the dusk aerial: a wider chalk line, a darker warm
#   dusk; the wall a little stronger (reads in a still, still see-through); the chalk melts with drips; the legs shot
#   keeps its own framing
#   ZS_LIBRARY: every piece built on the spot, by name (the generator lists them for later stories: reuse, never rebuild)

ZS_LIBRARY = {}
ZS_LIBRARY["gait_panic"] = ("animation", "a panic run (leaning forward, arms pumping, a slip half way): zs_gait(ch, t0, t1, pts, 'panic')")
ZS_LIBRARY["gait_sprint"] = ("animation", "a kid's sprint (strong lean, big arm pumps): zs_gait(..., 'sprint')")
ZS_LIBRARY["gait_chalk_run"] = ("animation", "a bent-over run with the chalk hand down (drawing as they run): zs_gait(..., 'chalk_run')")
ZS_LIBRARY["gait_crouch"] = ("animation", "a crouched walk, drawing on the ground: zs_gait(..., 'crouch')")
ZS_LIBRARY["gait_monster"] = ("animation", "the shadow monster's walk (slow long stiff steps, arms hanging and dragging, the head tilting)")
ZS_LIBRARY["draw_line"] = ("animation", "drawing a chalk line: the line appears behind the chalk as the drawer moves (zs_draw_path)")
ZS_LIBRARY["draw_around"] = ("animation", "running round someone dragging the chalk: the circle grows and closes (zs_draw_around)")
ZS_LIBRARY["wash_away"] = ("effect", "a chalk line washing away in the rain: thins, streaks downhill, fades bit by bit (zs_wash2)")
ZS_LIBRARY["wall_shimmer"] = ("effect", "an invisible wall: a faint see-through shimmer rising from a line where it is hit, a ripple (zs_wall_flash)")
ZS_LIBRARY["melt"] = ("effect", "a held thing melting in the rain, dripping (zs_melt)")
ZS_LIBRARY["rain_streaks"] = ("effect", "rain you can see: falling streaks near the camera (zs_rain_streaks)")
ZS_LIBRARY["deep_night"] = ("light", "the reference night: near-black deep blue, lit by lamps, windows, eyes (zs_deep_night)")
ZS_LIBRARY["dusk"] = ("light", "a warm low dusk sun, long shadows (zs_light 'sunset')")
ZS_LIBRARY["pizza_guy"] = ("character", "a delivery guy: dark hair, red uniform, a pizza box in both hands")
ZS_LIBRARY["dad_style"] = ("character", "an older dad: balding, grey sides, moustache, white t-shirt, striped pajama trousers (look style 'dad')")
ZS_LIBRARY["shadow_monster"] = ("character", "a pure black thin jointed silhouette taller than the lamps, two glowing eyes, a faint outline")
ZS_LIBRARY["dark_suburb"] = ("place", "a full dark suburb: brick houses with tiled roofs, porches, chimneys, driveways, fences, bins, pines, kerbs, slabs, a crossing, hills")
ZS_LIBRARY["chalk_rings"] = ("set piece", "a chalk line round every plot, the dog's circle, each parked car's straight box (zs_house_rings, rings_around)")
ZS_LIBRARY["roof_over"] = ("set piece", "a wooden roof on posts sized to stand over the monster (zs_roof_over)")
ZS_LIBRARY["pizza_box"] = ("prop", "a pizza box held in both hands")
ZS_LIBRARY["chalk"] = ("prop", "a small white chalk stick held in the fist")
ZS_LIBRARY["dog"] = ("prop", "a full-size blocky dog")
ZS_LIBRARY["car"] = ("prop", "a parked car (parallel to the kerb)")
ZS_LIBRARY["cam_aerial"] = ("camera", "high above, down the road at an angle (the opening)")
ZS_LIBRARY["cam_kid_monster"] = ("camera", "a kid + the monster: low, both in frame, never inside a house")
ZS_LIBRARY["cam_house"] = ("camera", "a house with its chalk line in the foreground, street level (ref 11)")
ZS_LIBRARY["cam_legs"] = ("camera", "only the legs (the monster's legs and hanging arms; a kid's legs at a line)")
ZS_LIBRARY["town_rule_check"] = ("check", "the town rule as a hard constraint: placement + a check on every shot (zs_rule_place / zs_rule_check)")


# ---------------------------------------------------------------- the dad draws from INSIDE the line
ZS_RING_FRONT9B = zs_ring_front


def zs_ring_front(r, near=None):
    """the front edge of a house's line moved 0.9 INSIDE it (the drawer stands on the house side, along the inner edge)"""
    P = zs_ring_pts(r)
    if not P:
        return ZS_RING_FRONT9B(r, near)
    cy = sum(p[1] for p in P) / len(P)
    ymin = min(abs(p[1]) for p in P)
    fy = [p[1] for p in P if abs(abs(p[1]) - ymin) < 0.4][0]
    iy = fy + (0.9 if cy > fy else -0.9)
    xs = sorted(p[0] for p in P if abs(abs(p[1]) - ymin) < 0.4)
    x0 = float(za_pos(near)[0]) if near is not None else xs[0]
    x0 = max(xs[0], min(xs[-1], x0))
    # from where the drawer stands, 7 units along the inner edge (towards the end with more room: no jump)
    sgn = 1.0 if (xs[-1] - x0) >= (x0 - xs[0]) else -1.0
    x1 = max(xs[0], min(xs[-1], x0 + sgn * 7.0))
    n = 8
    return [(x0 + (x1 - x0) * k / n, iy) for k in range(n + 1)]


# ---------------------------------------------------------------- the dusk aerial: a wider line, a darker warm dusk
def zs_chalk_path(name, pts, closed=True, width=None):
    return zs_chalk_path9(name, pts, closed, width or ZS.get("chalk_w") or ZS_CHALK_W)


ZS_LIGHT9D = zs_light


def zs_light(time, t0, t1):
    r = ZS_LIGHT9D(time, t0, t1)
    ZS["chalk_w"] = 0.85 if time == "sunset" else None
    if time == "sunset":
        for o in D.objects:
            if o.type == "LIGHT" and o.data.type == "SUN":
                o.data.energy = o.data.energy * 0.6
                o.data.color = (1.0, 0.56, 0.32)
        w = bpy.context.scene.world
        if w is not None and w.use_nodes:
            for nd in w.node_tree.nodes:
                if nd.type == "BACKGROUND":
                    nd.inputs["Strength"].default_value = nd.inputs["Strength"].default_value * 0.55
    return r


# ---------------------------------------------------------------- the wall: a little stronger, still see-through
def zs_wall_flash(center, rad, height, t, hit=None):
    c = Vector(za_pos(center))
    h = Vector(za_pos(hit)) if hit is not None else c + Vector((rad, 0, 2.0))
    d = Vector((h.x - c.x, h.y - c.y, 0.0))
    d = d.normalized() if d.length > 1e-3 else Vector((1, 0, 0))
    a0 = math.atan2(d.y, d.x)
    M = zw_m("wallshimmer9d", "#d8efff", 0.1, emit="#e4f4ff", estr=0.7, alpha=0.14)
    r = empty("zs_wall%d" % F(t), (c.x, c.y, 0.0), None)
    hh = max(3.0, min(height, h.z + 2.5))
    for k in range(-5, 6):
        a = a0 + math.radians(6.0 * k)
        box("zs_wallp%d_%d" % (F(t), k + 5), (2 * math.pi * rad / 60.0 + 0.04, 0.04, hh), (rad * math.cos(a), rad * math.sin(a), hh / 2), M, 0.0, rot=(0, 0, math.degrees(a) + 90), parent=r)
    r.scale = (1.0, 1.0, 0.001)
    r.keyframe_insert("scale", frame=F(t) - 1)
    r.scale = (1.0, 1.0, 1.0)
    r.keyframe_insert("scale", frame=F(t + 0.1))
    r.keyframe_insert("scale", frame=F(t + 0.65))
    r.scale = (1.0, 1.0, 0.001)
    r.keyframe_insert("scale", frame=F(t + 1.0))
    p = c + d * rad
    Mr = zw_m("ripple9d", "#eef8ff", 0.1, emit="#eef8ff", estr=1.2, alpha=0.35)
    rg = cyl("zs_ripple%d" % F(t), 0.4, 0.03, (p.x, p.y, max(0.8, min(hh - 0.4, h.z))), Mr, 20, rot=(90, 0, math.degrees(a0) + 90))
    rg.scale = (0.2, 0.2, 1.0)
    rg.keyframe_insert("scale", frame=F(t))
    rg.scale = (1.6, 1.6, 1.0)
    rg.keyframe_insert("scale", frame=F(t + 0.5))
    rg.scale = (0.001, 0.001, 0.001)
    rg.keyframe_insert("scale", frame=F(t + 0.55))
    return r


# ---------------------------------------------------------------- the chalk melts in the rain, dripping
def zs_melt(obj, t, dur=1.4):
    if obj is None:
        return obj
    bpy.context.scene.frame_set(F(t))
    bpy.context.view_layer.update()
    p = Vector(obj.matrix_world.translation)
    s = tuple(obj.scale)
    obj.keyframe_insert("scale", frame=F(t))
    obj.scale = (s[0] * 1.3, s[1] * 1.3, s[2] * 0.5)
    obj.keyframe_insert("scale", frame=F(t + dur * 0.6))
    obj.scale = (0.001, 0.001, 0.001)
    obj.keyframe_insert("scale", frame=F(t + dur))
    Md = zw_m("chalkdrip", "#f4f4f0", 0.9)
    for k in range(5):
        td = t + 0.15 + k * dur / 6.0
        dr = sphere("zs_drip%d_%d" % (F(t), k), 0.07, (p.x + 0.05 * (k - 2), p.y, p.z), Md, (1.0, 1.0, 1.6), seg=8)
        dr.scale = (0.001, 0.001, 0.001)
        dr.keyframe_insert("scale", frame=F(td) - 1)
        dr.scale = (1.0, 1.0, 1.6)
        dr.keyframe_insert("scale", frame=F(td))
        dr.keyframe_insert("location", frame=F(td))
        dr.location = (p.x + 0.05 * (k - 2), p.y, 0.05)
        dr.keyframe_insert("location", frame=F(td + 0.45))
        set_interp(dr, "location", F(td), "LINEAR")
    return obj


# ---------------------------------------------------------------- the legs shot keeps its framing (the line in front)
ZC_CUT9D = zc_cut


def zc_cut(t0, t1, kind, people=(), things=(), move="push_in", side=None, hero=None, tag="", frac=None, v=None):
    if kind == "house" and things and things[0] is not None and "pts" in things[0]:
        # THE HOUSE AT NIGHT with its line in front (ref 11): street level from across the front lawn, the line in the
        # foreground, the house behind it
        P = zs_ring_pts(things[0])
        cx = sum(q[0] for q in P) / len(P)
        fy = min(P, key=lambda q: abs(q[1]))[1]
        sy = 1.0 if sum(q[1] for q in P) / len(P) > 0 else -1.0
        cam = Cam()
        cam.key(t0, (cx - 4.5, fy - sy * 8.5, 3.4), (cx + 0.5, fy + sy * 6.0, 2.6), lens=24)
        cam.key(t1, (cx - 4.0, fy - sy * 7.8, 3.3), (cx + 0.5, fy + sy * 6.0, 2.6), lens=24)
        ZS_LIBRARY["cam_house"] = ("camera", "a house with its line in front, street level")
        return cam
    if kind == "legs":
        frac, v = None, None
    return ZC_CUT9D(t0, t1, kind, people, things, move, side, hero, tag, frac, v)
# ===== END OF STAGE 9d ===============================================================================================
