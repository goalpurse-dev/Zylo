# ===== ROUND 9c (owner 2026-11-23): THE RULE AS A HARD CONSTRAINT + THE DARK SUBURB ==================================
# Pasted after stage9b.py.
#   THE RULE      the plan's town rule as a condition on the scene per time of day (here: at night every person, pet and
#                 car that is safe stands INSIDE a closed chalk line); zs_rule_place puts them there, zs_rule_check
#                 measures every shot (ZW_GATE|shot|name|rule_break|...); only the story's exceptions may be outside
#   CHALK         matte white, one width everywhere, readable at night, never glowing; the stick is hand-sized
#   THE WALL      almost invisible: a faint shimmer only where the hand hits, a small ripple, for a moment
#   THE CAMERA    a kid + the monster: both in frame (the kid's whole body, the monster's head), never inside a house
#   DARK SUBURB   a full neighbourhood (a reusable place, "dark_suburb"): brick walls with a brick pattern, tiled
#                 pitched roofs, window frames, doors, porches, chimneys, driveways and paths, several shapes and colours;
#                 textured grass, worn asphalt, kerbs, paving slabs, a crossing; houses on both sides into the distance,
#                 tall pines and bushes, fences, mailboxes, lamps, bins, planters; a tree line and hills for depth;
#                 dusk = a warm low sun with long shadows

# ---------------------------------------------------------------- materials with texture (procedural, our own)
def zs_tex_mat(name, kind, c1, c2, c3=None, rough=0.85, **p):
    """a material whose base colour is a procedural texture in OBJECT space: kind brick / slab / tile / noise"""
    m = bpy.data.materials.get(name)
    if m is not None and m.get("zs_tex"):
        return m
    m = zw_m(name[3:] if name.startswith("zw_") else name, c1, rough)
    nt = m.node_tree
    b = None
    for nd in nt.nodes:
        if nd.type == "BSDF_PRINCIPLED":
            b = nd
    if b is None:
        return m
    tc = nt.nodes.new("ShaderNodeTexCoord")
    A, B = hexc(c1), hexc(c2)
    if kind in ("brick", "slab", "tile"):
        t = nt.nodes.new("ShaderNodeTexBrick")
        t.inputs["Color1"].default_value = (A[0], A[1], A[2], 1.0)
        t.inputs["Color2"].default_value = (B[0], B[1], B[2], 1.0)
        C = hexc(c3 or "#cfc6b8")
        t.inputs["Mortar"].default_value = (C[0], C[1], C[2], 1.0)
        t.inputs["Scale"].default_value = 1.0
        t.inputs["Mortar Size"].default_value = p.get("mortar", 0.03)
        t.inputs["Brick Width"].default_value = p.get("w", 0.9)
        t.inputs["Row Height"].default_value = p.get("h", 0.35)
        t.offset = p.get("offset", 0.5)
        nt.links.new(tc.outputs["Object"], t.inputs["Vector"])
        nt.links.new(t.outputs["Color"], b.inputs["Base Color"])
    else:
        t = nt.nodes.new("ShaderNodeTexNoise")
        t.inputs["Scale"].default_value = p.get("scale", 0.08)
        t.inputs["Detail"].default_value = p.get("detail", 4.0)
        r = nt.nodes.new("ShaderNodeValToRGB")
        r.color_ramp.elements[0].color = (A[0], A[1], A[2], 1.0)
        r.color_ramp.elements[1].color = (B[0], B[1], B[2], 1.0)
        r.color_ramp.elements[0].position = p.get("lo", 0.35)
        r.color_ramp.elements[1].position = p.get("hi", 0.65)
        nt.links.new(tc.outputs["Object"], t.inputs["Vector"])
        nt.links.new(t.outputs["Fac"], r.inputs["Fac"])
        nt.links.new(r.outputs["Color"], b.inputs["Base Color"])
    m["zs_tex"] = 1
    return m


ZS_BRICKS2 = ["#7b4636", "#8a5240", "#6e3f31", "#93604b", "#b4a493", "#5d4a40"]
ZS_ROOFS = ["#2f3238", "#3c2f2a", "#46494f"]
ZS_TRIM = ["#e9e4dc", "#f2efe8", "#d8d2c6"]


def zs_brick_mat(k):
    c = ZS_BRICKS2[k % len(ZS_BRICKS2)]
    d = hexc(c)
    dark = "#%02x%02x%02x" % tuple(int(255 * min(1.0, max(0.0, (x * 0.72) ** (1 / 2.2)))) for x in d)
    return zs_tex_mat("zw_house_brick9c_%d" % (k % len(ZS_BRICKS2)), "brick", c, dark, "#c9c0b2", 0.9, w=0.95, h=0.36)


def zs_roof_mat(k):
    c = ZS_ROOFS[k % len(ZS_ROOFS)]
    d = hexc(c)
    lite = "#%02x%02x%02x" % tuple(int(255 * min(1.0, max(0.0, (x * 1.35) ** (1 / 2.2)))) for x in d)
    return zs_tex_mat("zw_roof_tile9c_%d" % (k % len(ZS_ROOFS)), "tile", c, lite, "#1c1d20", 0.8, w=0.8, h=0.55, mortar=0.05)


# ---------------------------------------------------------------- THE HOUSE (several shapes and colours)
ZW_HOUSE9B = zw_house


def zw_house(i, x, side, col):
    if not ZS.get("low_houses"):
        return ZW_HOUSE9B(i, x, side, col)
    rnd = random.Random(i * 7 + 3)
    shape = i % 3 if i < 200 else i % 2   # (the in-between houses: narrower, never the wide shape)
    y = 28.0 * side
    W = (15.0 + (3.0 if shape == 2 else 0.0)) if i < 200 else 12.0
    Dp, Hh = 11.0, 6.0 + (0.6 if shape == 0 else 0.0)
    fy = y - side * Dp / 2.0
    Mb = zs_brick_mat(i)
    box("zw_h%d" % i, (W, Dp, Hh), (x, y, Hh / 2), Mb, 0.04)
    if shape == 1:   # an L: a wing that comes forward
        box("zw_hwing%d" % i, (6.0, 5.0, Hh * 0.92), (x + W / 2 - 3.0, fy - side * 2.5, Hh * 0.46), Mb, 0.04)
        box("zw_hwingr%d" % i, (6.8, 5.6, 0.4), (x + W / 2 - 3.0, fy - side * 2.5, Hh * 0.92 + 0.6), zs_roof_mat(i), 0.04, rot=(-12 * side, 0, 0))
    Mr = zs_roof_mat(i)
    for s in (-1, 1):
        box("zw_hr%d_%d" % (i, s), (W + 1.2, Dp / 2.0 + 1.5, 0.4), (x, y + s * Dp / 4.0, Hh + 1.25), Mr, 0.04, rot=(-24 * s, 0, 0))
    box("zw_hridge%d" % i, (W + 1.2, 0.5, 0.35), (x, y, Hh + 2.5), Mr, 0.05)
    box("zw_hchim%d" % i, (1.2, 1.2, 3.2), (x - W / 3.0, y + side * 1.6, Hh + 2.1), Mb, 0.03)
    box("zw_hbase%d" % i, (W + 0.3, Dp + 0.3, 0.45), (x, y, 0.22), zw_m("hbase", "#9f978b", 0.85), 0.03)
    Mt = zw_m("trim9c_%d" % (i % 3), ZS_TRIM[i % 3], 0.6)
    dx = -2.5 if shape != 2 else -4.0
    box("zw_hdoor%d" % i, (1.8, 0.25, 3.3), (x + dx, fy - side * 0.08, 1.85), zw_m("hdoor9c_%d" % (i % 3), ["#3a2c26", "#26324a", "#3d4a33"][i % 3], 0.6), 0.03)
    box("zw_hdoorf%d" % i, (2.2, 0.18, 3.6), (x + dx, fy - side * 0.03, 1.9), Mt, 0.02)
    # the porch: a step, two posts, a little roof, its light
    box("zw_hporch%d" % i, (3.6, 2.4, 0.3), (x + dx, fy - side * 1.2, 0.15), zw_m("porchstone", "#7d776f", 0.9), 0.03)
    box("zw_hporchr%d" % i, (4.0, 2.8, 0.22), (x + dx, fy - side * 1.3, 4.25), Mr, 0.03)
    for sx in (-1, 1):
        box("zw_hpost%d_%d" % (i, sx), (0.22, 0.22, 4.0), (x + dx + sx * 1.7, fy - side * 2.45, 2.15), Mt, 0.0)
    for k, wx in enumerate([x + 1.8, x + 5.0] + ([x - 6.0] if shape == 2 else [])):
        lit = zw_win_lit(i + k) and zw_time() in ("night", "sunset", "storm")
        Mg = zw_m("winlow_lit" if lit else "winlow_dark", "#ffcf8a" if lit else "#1e2738", 0.3, emit="#ffb866" if lit else None, estr=0.6 if lit else 0.0)
        box("zw_hwin%d_%d" % (i, k), (2.2, 0.2, 1.7), (wx, fy - side * 0.1, 3.0), Mg, 0.0)
        box("zw_hwinf%d_%d" % (i, k), (2.6, 0.15, 2.1), (wx, fy - side * 0.03, 3.0), Mt, 0.02)
        box("zw_hwins%d_%d" % (i, k), (2.8, 0.4, 0.15), (wx, fy - side * 0.2, 2.05), Mt, 0.02)
    # the path to the door, the driveway beside the house
    box("zw_hpath%d" % i, (1.6, abs(fy - side * 9.8), 0.07), (x + dx, (fy + side * 9.8) / 2.0, 0.05), zs_tex_mat("zw_slab9c", "slab", "#8b8781", "#7c7872", "#5a5652", 0.9, w=1.6, h=1.6, offset=0.0), 0.0)
    gx = x + W / 2.0 + 2.6
    box("zw_hdrive%d" % i, (3.6, abs(fy - side * 6.2) + 3.0, 0.06), (gx, (fy + side * 6.2) / 2.0 + side * 1.5, 0.04), zs_tex_mat("zw_drive9c", "noise", "#4d4b49", "#5d5a56", None, 0.95, scale=0.35), 0.0)
    # bins, a mailbox, bushes, a fence round the back of the lot, a planter
    box("zw_hmbin%d_0" % i, (0.9, 0.9, 1.3), (gx + 2.4, fy - side * 0.8, 0.65), zw_m("bin_g", "#2f5d3a", 0.7), 0.06)
    box("zw_hmbin%d_1" % i, (0.9, 0.9, 1.3), (gx + 2.4, fy - side * 2.0, 0.65), zw_m("bin_b", "#2c3e66", 0.7), 0.06)
    cyl("zw_hmb%d" % i, 0.09, 1.6, (x + dx - 2.2, side * 10.6, 0.8), zw_m("mbpost", "#5a4632", 0.8), 8)
    box("zw_hmbx%d" % i, (0.6, 0.9, 0.55), (x + dx - 2.2, side * 10.6, 1.75), zw_m("mbox", ["#2b2d31", "#7a1f1f", "#2b4a7a"][i % 3], 0.5, 0.3), 0.08)
    for k, bx in enumerate((x - W / 2.0 + 1.0, x + dx + 2.4, x + W / 2.0 - 1.2)):
        if zw_asset("qnature_bush_common", (bx, fy - side * 1.2, 0.0), rnd.uniform(0, 360), 0.9) is None:
            sphere("zw_hbush%d_%d" % (i, k), 1.0, (bx, fy - side * 1.0, 0.7), zw_m("bush9c", "#2d5a2b", 0.9), (1.3, 1.0, 0.8), seg=10)
    Mf = zw_m("fence9c", "#d9d2c4" if i % 2 else "#7a5a3a", 0.7)
    for k in range(9):
        fx = x - W / 2.0 - 2.0 + k * (W + 4.0) / 8.0
        box("zw_hf%d_%d" % (i, k), (0.18, 0.18, 1.6), (fx, y + side * (Dp / 2.0 + 2.5), 0.8), Mf, 0.0)
    box("zw_hfr%d" % i, (W + 4.0, 0.12, 0.2), (x, y + side * (Dp / 2.0 + 2.5), 1.3), Mf, 0.0)
    return None


# ---------------------------------------------------------------- THE DARK SUBURB (the ground, the fill, the depth)
def zs_dress_suburb(near=(3.0, 9.0)):
    """after zw_suburb in the low-houses mode: textured ground, kerbs, a crossing, more houses on both sides, pines,
    lamps on both sides, a tree line and hills"""
    cx = near[0]
    for m in list(bpy.data.materials):
        if m.name.startswith("zw_grass") and not m.get("zs_tex"):
            zs_retexture(m, "noise", "#3e6b2e", "#56853a", scale=0.06)
        if m.name.startswith("zw_asphalt") and not m.get("zs_tex"):
            zs_retexture(m, "noise", "#3a3d44", "#4b4e55", scale=0.45)
        if m.name.startswith("zw_sidewalk") and not m.get("zs_tex"):
            zs_retexture(m, "slab", "#9a958e", "#8d8882", c3="#5f5b56", w=2.0, h=2.0, offset=0.0)
    Mk = zw_m("kerb9c", "#a9a49c", 0.85)
    for side in (-1, 1):
        box("zw_kerb%d" % side, (300, 0.35, 0.22), (0, side * 6.15, 0.11), Mk, 0.02)
    Mz = zw_m("zebra", "#e9e6df", 0.8)
    for k in range(-5, 6):
        box("zw_zebra%d" % k, (3.2, 0.55, 0.03), (cx + 22.0, k * 1.05, 0.075), Mz, 0.0)
    # more houses: the rows run into the distance with no gaps (both sides)
    for k, x in enumerate((-104, -74, -44, -16, 16, 44, 74, 104)):
        zw_house(200 + 2 * k, x, 1, None)
        zw_house(201 + 2 * k, x + 12.0, -1, None)
    # lamps on the south side too
    for k in range(12):
        zw_inst("lamp", (-100 + k * 20, -10.2, 0.2), 180)
    # tall pines behind and between the houses, a tree line further back
    rnd = random.Random(31)
    pines = ["qnature_pine_1", "qnature_pine_2", "qnature_pine_3", "kgrave_pine", "ktown_tree_high"]
    for side in (-1, 1):
        for k in range(30):
            x = -140 + k * 9.6 + rnd.uniform(-3, 3)
            y = side * rnd.uniform(38, 50)
            if zw_asset(pines[k % len(pines)], (x, y, 0.0), rnd.uniform(0, 360), rnd.uniform(1.1, 1.7)) is None:
                zw_inst("tree2", (x, y, 0.0), rnd.uniform(0, 360), rnd.uniform(1.2, 1.8))
        for k in range(40):
            x = -170 + k * 8.5 + rnd.uniform(-3, 3)
            y = side * rnd.uniform(58, 72)
            if zw_asset(pines[(k + 2) % len(pines)], (x, y, 0.0), rnd.uniform(0, 360), rnd.uniform(1.4, 2.2)) is None:
                zw_inst("tree", (x, y, 0.0), rnd.uniform(0, 360), rnd.uniform(1.4, 2.2))
    # hills, lighter with distance (a little haze)
    Mh = zw_m("hill9c", "#3f5a46" if zw_time() != "day" else "#6f8f74", 0.95)
    for k in range(10):
        sphere("zw_hill9c%d" % k, rnd.uniform(40, 70), (-200 + k * 45, rnd.choice((-1, 1)) * rnd.uniform(110, 150), -8), Mh, (1.6, 1.0, 0.35), seg=14)
    print("ZW_FRAMED|-|set|the dark suburb (library %s)" % ("on" if ZA.get("ok") else "off"))


def zs_retexture(m, kind, c1, c2, c3=None, **p):
    tmp = zs_tex_mat(m.name + "_tx", kind, c1, c2, c3, 0.9, **p)
    # copy the textured node set onto the existing material (the ground boxes keep their material)
    for ob in D.objects:
        if ob.type == "MESH":
            for sl in ob.material_slots:
                if sl.material is m:
                    sl.material = tmp
    m["zs_tex"] = 1
    return tmp


ZW_SUBURB9 = zw_suburb


def zw_suburb(t0, t1, dress):
    r = ZW_SUBURB9(t0, t1, dress)
    if ZS.get("low_houses"):
        try:
            zs_dress_suburb()
        except Exception as e:
            print("zs_dress_suburb skipped: %s" % e)
    return r


ZW_PLACES["dark_suburb"] = lambda t0, t1, d: (ZS.update(low_houses=True), zw_suburb(t0, t1, d))[1]
ZW_SPOTS["dark_suburb"] = ZW_SPOTS["suburb_street"]


# ---------------------------------------------------------------- dusk = a warm low sun, long shadows
ZS_LIGHT9C = zs_light


def zs_light(time, t0, t1):
    r = ZS_LIGHT9C(time, t0, t1)
    if time == "sunset":
        for o in D.objects:
            if o.type == "LIGHT" and o.data.type == "SUN":
                o.rotation_euler = (math.radians(76.0), 0.0, math.radians(-62.0))
                o.data.color = (1.0, 0.62, 0.38)
    return r


# ---------------------------------------------------------------- CHALK: matte, one width, not glowing; a small stick
def zs_chalk_mat():
    night = zw_time() in ("night", "storm") or ZS.get("deep")
    return zw_m("chalk_matte" + ("_n" if night else "_d"), "#f2f2ee", 0.95, emit="#e8ebf2" if night else None, estr=0.22 if night else 0.0)


ZS_CHALK_W = 0.42


def zt_build_chalk(r, c=None, col=None):
    cyl("zt_chalk%d" % ZT_N["n"], 0.07, 0.45, (0, 0, 0.22), zt_m("chalkstick", "#f6f6f2", 0.95), 8, parent=r, coll=c)
    return r


# ---------------------------------------------------------------- THE WALL: almost invisible
def zs_wall_flash(center, rad, height, t, hit=None):
    """a FAINT shimmer rising from the line only where the hand hits (an arc of the circle), a small ripple, for a moment"""
    c = Vector(za_pos(center))
    h = Vector(za_pos(hit)) if hit is not None else c + Vector((rad, 0, 2.0))
    d = Vector((h.x - c.x, h.y - c.y, 0.0))
    d = d.normalized() if d.length > 1e-3 else Vector((1, 0, 0))
    a0 = math.atan2(d.y, d.x)
    M = zw_m("wallshimmer", "#d8efff", 0.1, emit="#e4f4ff", estr=0.25, alpha=0.06)
    r = empty("zs_wall%d" % F(t), (c.x, c.y, 0.0), None)
    hh = max(2.0, min(height, h.z + 1.5))
    for k in range(-4, 5):
        a = a0 + math.radians(6.0 * k)
        box("zs_wallp%d_%d" % (F(t), k + 4), (2 * math.pi * rad / 60.0 + 0.04, 0.04, hh), (rad * math.cos(a), rad * math.sin(a), hh / 2), M, 0.0, rot=(0, 0, math.degrees(a) + 90), parent=r)
    r.scale = (1.0, 1.0, 0.001)
    r.keyframe_insert("scale", frame=F(t) - 1)
    r.scale = (1.0, 1.0, 1.0)
    r.keyframe_insert("scale", frame=F(t + 0.1))
    r.keyframe_insert("scale", frame=F(t + 0.35))
    r.scale = (1.0, 1.0, 0.001)
    r.keyframe_insert("scale", frame=F(t + 0.6))
    p = c + d * rad
    Mr = zw_m("ripple9c", "#eef8ff", 0.1, emit="#eef8ff", estr=0.6, alpha=0.22)
    rg = cyl("zs_ripple%d" % F(t), 0.35, 0.03, (p.x, p.y, max(0.8, min(hh - 0.4, h.z))), Mr, 20, rot=(90, 0, math.degrees(a0) + 90))
    rg.scale = (0.2, 0.2, 1.0)
    rg.keyframe_insert("scale", frame=F(t))
    rg.scale = (1.3, 1.3, 1.0)
    rg.keyframe_insert("scale", frame=F(t + 0.35))
    rg.scale = (0.001, 0.001, 0.001)
    rg.keyframe_insert("scale", frame=F(t + 0.4))
    print("ZW_FRAMED|-|wall|a faint shimmer at %.2f" % t)
    return r


# ---------------------------------------------------------------- THE RULE: placement + the check on every shot
def zs_point_in(p, poly):
    x, y = p[0], p[1]
    inside = False
    n = len(poly)
    for k in range(n):
        x1, y1 = poly[k]
        x2, y2 = poly[(k + 1) % n]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / ((y2 - y1) or 1e-9) + x1:
            inside = not inside
    return inside


def zs_closed_lines():
    """every chalk line on the ground that is CLOSED and still there at the current frame (not washed away)"""
    out = []
    for o in D.objects:
        if o.type != "EMPTY" or "pts" not in o:
            continue
        segs = [s for s in o.children if s.type == "MESH"]
        if not segs:
            continue
        if sum(1 for s in segs if s.scale[1] > 0.2 and s.scale[0] > 0.2) < 0.85 * len(segs):
            continue   # washed away / not drawn yet
        out.append([tuple(p) for p in o["pts"]])
    return out


def zs_inside_any(pts, lines):
    return any(all(zs_point_in(p, L) for p in pts) for L in lines)


def zs_visible(ch):
    for o in [ch.root] + list(ch.root.children_recursive):
        if o.type == "MESH" and not o.hide_render and o.scale[2] > 0.01:
            return True
    return False


def zs_rule_check(H, allowed, t, tag):
    """THE TOWN'S RULE on this shot (at night): every person, pet and car that is not allowed outside stands INSIDE a
    closed chalk line -> ZW_GATE|tag|name|rule_break|outside its line"""
    sc = bpy.context.scene
    sc.frame_set(F(t))
    bpy.context.view_layer.update()
    lines = zs_closed_lines()
    n = 0
    for k, v in H.items():
        if v is None or k in allowed or k.startswith("crowd") or k.startswith("chalk"):
            continue
        kind = k.split("#")[0]
        if hasattr(v, "root"):
            if not zs_visible(v):
                continue
            p = v.root.matrix_world.translation
            pts = [(p.x, p.y)]
        elif kind in ("dog", "car"):
            if v.scale[2] < 0.01:
                continue
            mw = v.matrix_world
            vp = zw_vpts([v]) or zw_pts([v])
            if not vp:
                continue
            xs, ys = [q.x for q in vp], [q.y for q in vp]
            pts = [(min(xs), min(ys)), (max(xs), min(ys)), (max(xs), max(ys)), (min(xs), max(ys))]
        else:
            continue
        if not zs_inside_any(pts, lines):
            print("ZW_GATE|%s|%s|rule_break|outside a closed chalk line" % (tag, k))
            n += 1
    print("ZW_FRAMED|%s|rule|%d break(s), %d closed line(s)" % (tag, n, len(lines)))
    return n


def zs_rule_place(H, names, t):
    """the engine PLACES the safe ones inside a closed line: anyone of `names` outside every closed line moves to the
    nearest line's inside (its front strip, near the stage)"""
    sc = bpy.context.scene
    sc.frame_set(F(t))
    bpy.context.view_layer.update()
    lines = zs_closed_lines()
    if not lines:
        return 0
    n = 0
    for k in names:
        ch = H.get(k)
        if ch is None or not hasattr(ch, "root"):
            continue
        p = ch.root.matrix_world.translation
        if zs_inside_any([(p.x, p.y)], lines):
            continue
        best = None
        for L in lines:
            cx, cy = sum(q[0] for q in L) / len(L), sum(q[1] for q in L) / len(L)
            d = math.hypot(cx - p.x, cy - p.y)
            if best is None or d < best[0]:
                best = (d, L, cx, cy)
        d, L, cx, cy = best
        fy = min(L, key=lambda q: abs(q[1]))[1]
        ty = fy + (1.4 if cy > fy else -1.4)
        ch.pose(t - 0.5, loc=(max(min(p.x, max(q[0] for q in L) - 1.2), min(q[0] for q in L) + 1.2), ty, 0.0))
        n += 1
    return n


# ---------------------------------------------------------------- THE CAMERA: a kid + the monster, both in frame
def zc_kid_monster(t0, t1, kid, mon, tag=""):
    """a LOW camera behind / beside the kid looking up at the monster: the kid's whole body AND the monster's head in
    the frame, never inside a house; a step further back until both fit"""
    cam = Cam()
    tm = (t0 + t1) / 2.0
    sc = bpy.context.scene
    sc.frame_set(F(tm))
    bpy.context.view_layer.update()
    pk, pm = za_here(kid, tm), za_here(mon, tm)
    ps = zw_ps()
    d = pk - pm
    d.z = 0
    d = d.normalized() if d.length > 1e-3 else Vector((0, -1, 0))
    rgt = Vector((d.y, -d.x, 0))
    mpts = zw_vpts([mon.root])
    mh = max([p.z for p in mpts] + [6.0])
    kpts = zw_vpts([kid.root])
    hpts = zw_head_pts(mon) or [Vector((pm.x, pm.y, mh))]
    houses = [o for o in D.objects if o.type == "MESH" and o.name.startswith("zw_h") and o.name[4:].isdigit()]

    def in_house(q):
        for o in houses:
            b = zw_box_of(o)
            if b and b[0].x - 0.6 < q.x < b[1].x + 0.6 and b[0].y - 0.6 < q.y < b[1].y + 0.6 and q.z < b[1].z + 2.5:
                return True
        return False
    best = None
    for dist in (4.0, 6.0, 8.5, 11.5, 15.0):
        for sx in (1.2, -1.2, 2.4, -2.4, 0.0):
            for z in (0.6, 1.4):
                loc = pk + d * dist * ps / 0.55 + rgt * sx * ps / 0.55
                loc.z = z * ps / 0.55
                if in_house(loc):
                    continue
                aim = Vector((pm.x * 0.55 + pk.x * 0.45, pm.y * 0.55 + pk.y * 0.45, mh * 0.5))
                cam.key(t0, tuple(loc + d * 0.4), tuple(aim), lens=16)
                cam.key(t1, tuple(loc), tuple(aim), lens=16)
                sc.frame_set(F(tm))
                bpy.context.view_layer.update()
                sk, sh = zw_span(cam.ob, kpts), zw_span(cam.ob, hpts)
                ok_k = sk is not None and sk[0] > 0.02 and sk[1] < 0.98 and sk[2] > 0.02 and sk[3] < 0.97
                ok_h = sh is not None and sh[0] > 0.02 and sh[1] < 0.98 and sh[2] > 0.02 and sh[3] < 0.9
                clear = not zw_blocked(Vector((pk.x, pk.y, 1.6 * ps / 0.55)), loc, (kid.name + "_", mon.name + "_"))
                score = int(ok_k) + int(ok_h) + int(clear)
                if best is None or score > best[0]:
                    best = (score, loc.copy(), aim.copy())
                if score == 3:
                    break
            if best and best[0] == 3:
                break
        if best and best[0] == 3:
            break
    if best is None:
        return ZC_CUT8(t0, t1, "low", [kid, mon], [], "push_in", None)
    s, loc, aim = best
    cam.key(t0, tuple(loc + d * 0.4), tuple(aim), lens=16)
    cam.key(t1, tuple(loc), tuple(aim + Vector((0, 0, 0.3))), lens=16)
    ZW_FRAMED["cut"] = "kid+monster low (%d of 3: kid in frame, head in frame, clear)" % s
    return cam
# ===== END OF STAGE 9c ===============================================================================================


# a chalk line round EVERY plot near the stage (the aerial sees the whole street)
ZS_RINGS9B = zs_house_rings


def zs_house_rings(place, near=None, n=24, owner_k=None):
    return ZS_RINGS9B(place, near=near, n=n, owner_k=owner_k)


# ---------------------------------------------------------------- round 9c fix: leaving the scene
def zs_hide_at(ch, t0, t1):
    """visible until t1, hidden after (a key BEFORE too: a lone hidden key holds backwards in Blender: the round 9c pizza
    guy vanished from his whole scene, only his face left in the sky); the face parts (head children) go with him"""
    obs = set(list(ch.coll.all_objects) + [o for o in ch.root.children_recursive])
    for ob in obs:
        ob.hide_render = False
        ob.keyframe_insert("hide_render", frame=F(t0))
        ob.hide_render = True
        ob.keyframe_insert("hide_render", frame=F(t1))
    return ch


def zs_exit(ch, t0, t1, side=1):
    st_c, st_d, st_r, st_rot = zw_stage(ZS["place"] or "suburb_street")
    ps = zw_ps()
    p = za_here(ch, t0)
    b = p + st_r * (10.0 * ps * side)
    zm_walk(ch, t0, max(t0 + 0.6, t1), (b.x, b.y, 0.0))
    return zs_hide_at(ch, t0, max(t0 + 0.6, t1))


ZS_DIVE9 = zs_dive


def zs_dive(m, t0, t1, at):
    hx, hy = float(at[0]), float(at[1])
    ta = t0 + (t1 - t0) * 0.45
    zm_walk(m, t0, ta, (hx, hy, 0.0), run=True)
    zm_jump(m, ta)
    H = 5.6 * m.root.scale[2]
    m.pose(ta + 0.25, loc=(hx, hy, 0.0), armL=(170, 12), armR=(170, 12))
    m.pose(t1, loc=(hx, hy, -H * 1.05), armL=(170, 12), armR=(170, 12))
    return zs_hide_at(m, t0, t1 + 0.04)


ZC_CUT9C = zc_cut


def zc_cut(t0, t1, kind, people=(), things=(), move="push_in", side=None, hero=None, tag="", frac=None, v=None):
    P = [p for p in people if p is not None]
    if any(p.name in ZW_MON for p in P) and any(p.name not in ZW_MON for p in P) and kind in ("low", "wide", "medium", "two"):
        # a kid + the monster: the both-in-frame recipe decides; no size correction (it pushed the head out)
        frac, v = None, None
    if kind == "legs" and P and not any(p.name in ZW_MON for p in P):
        # the kid's legs WITH the line in front: the chalk pieces near the feet join the framing
        bpy.context.scene.frame_set(F((t0 + t1) / 2.0))
        q = za_here(P[0], (t0 + t1) / 2.0)
        near = [o for o in D.objects if o.type == "MESH" and o.name.startswith("zs_ring") and (Vector((o.matrix_world.translation.x, o.matrix_world.translation.y, 0)) - Vector((q.x, q.y, 0))).length < 2.6]
        things = list(things) + near[:4]
    return ZC_CUT9C(t0, t1, kind, people, things, move, side, hero, tag, frac, v)
