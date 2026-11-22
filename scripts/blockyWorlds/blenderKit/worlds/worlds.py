# ===== ZYVO WORLD LIBRARY v2 (scripts/blockyWorlds/blenderKit/worlds/worlds.py) ==============================
# Our own reusable Roblox-style base worlds, built from the kit's primitives (box, cyl, sphere, text, light, mat ...).
# The pipeline pastes this file into every shots.py right after the fixed header (no imports here: it uses the names
# `from shotkit import *` gives, plus W / W2 / story). The static check (shotcheck.py) applies to it like any shot code.
# Ground at z = 0; a character is ~5.2 units tall; streets run along +Y unless noted.
#   zw_build(place, t0, t1, dress=None) -> the place's info dict (marks)   builds one LOCATION of the library
#   zw_spot(cam, place, spot, t0, t1, push=0.08)                           a TESTED camera spot (+ a gentle push)
# DRESS (per story, cheap): {"time": "day"|"sunset"|"night", "weather": "clear"|"rain"|"snow",
#   "landmark": "bank"|"city_hall"|"tower"|"screen"|"none", "landmark_text": "...", "signs": ["BAKERY", ...],
#   "billboard": "...", "people": 0..40, "props": ["blimp", "bunting", "cars"], "blimp_text": "..."}
# v2 (2026-11-14): the LOOK (the camera sees a saturated blue sky with puffy clouds, the scene is lit by a warm sun and a
# neutral, weaker sky: no blue cast, deeper shadows; saturated pastels), DENSITY (every view has foreground, middle and
# background detail: rooftops, billboards, people, cars, furnished rooms, full shop shelves, a dressed moon), instanced
# props (trees, bushes, AC boxes, water tanks, products, people) to keep the build cheap.

ZW_T = {}  # this shot's dress (time of day decides the emissive materials)
ZW_N = {"n": 0}


def zw_m(name, color, rough=0.6, metal=0.0, emit=None, estr=0.0, alpha=1.0):
    return mat("zw_" + name, hexc(color), rough, metal, emit=hexc(emit) if emit else None, estr=estr, alpha=alpha)


def zw_time():
    return ZW_T.get("time", "day")


def zw_night():
    return zw_time() == "night"


def zw_copy():
    """COPY MODE (a replica of a reference): the engine adds nothing the reference frame does not have"""
    return bool(ZW_T.get("copy"))


def zw_win_lit(k=0):
    """ROUND 3 world state: is window group k lit? dress "windows": lit (default) | some (about 2 in 3) | dark"""
    w = ZW_T.get("windows", "lit")
    if w == "some":
        return (k * 7 + 3) % 3 != 0
    return w != "dark"


def zw_glass(name="glass", k=0):
    # windows: blue glass by day, warm light at night (copy mode: dark glass at night: lit only where the shot says)
    # ROUND 3: the world state's windows (lit / some / dark, per group k) and curtains (open / closed)
    if zw_night() and zw_copy():
        return zw_m(name + "_c", "#1c2742", 0.2, 0.2)
    closed = ZW_T.get("curtains") == "closed"
    if zw_night() or (zw_time() == "sunset" and "windows" in ZW_T):
        if not zw_win_lit(k):
            return zw_m(name + ("_dkc" if closed else "_dk"), "#262b40" if closed else "#1c2742", 0.6 if closed else 0.2, 0.0 if closed else 0.2)
        if closed:
            return zw_m(name + "_cl", "#d9a066", 0.85, emit="#c98b5a", estr=0.7)
        return zw_m(name + "_n", "#ffd9a0", 0.3, emit="#ffc070", estr=2.2)
    if closed:
        return zw_m(name + "_cd", "#c8b89a", 0.85)
    return zw_m(name + "_d", "#4f86c6", 0.12, 0.15)


def zw_tex_vec(nt):
    """object coordinates folded so ONE 2D pattern runs round every vertical side of a box: (x + y, z)"""
    co = nt.nodes.new("ShaderNodeTexCoord")
    sp = nt.nodes.new("ShaderNodeSeparateXYZ")
    ad = nt.nodes.new("ShaderNodeMath")
    cb = nt.nodes.new("ShaderNodeCombineXYZ")
    nt.links.new(co.outputs["Object"], sp.inputs[0])
    nt.links.new(sp.outputs["X"], ad.inputs[0])
    nt.links.new(sp.outputs["Y"], ad.inputs[1])
    nt.links.new(ad.outputs[0], cb.inputs["X"])
    nt.links.new(sp.outputs["Z"], cb.inputs["Y"])
    return cb.outputs[0]


def zw_pattern(key, c1, c2, mortar, scale, bw, rh, ms, rough=0.8, metal=0.0, emit=0.0, offset=0.5):
    """a brick-texture material on the folded coordinates: real bricks (offset 0.5) or a window grid (offset 0)"""
    m = D.materials.get("zw_pat_" + key)
    if m:
        return m
    m = D.materials.new("zw_pat_" + key)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes.get("Principled BSDF")
    br = nt.nodes.new("ShaderNodeTexBrick")
    br.offset = offset
    nt.links.new(zw_tex_vec(nt), br.inputs["Vector"])
    a, c, mo = hexc(c1), hexc(c2), hexc(mortar)
    br.inputs["Color1"].default_value = (a[0], a[1], a[2], 1)
    br.inputs["Color2"].default_value = (c[0], c[1], c[2], 1)
    br.inputs["Mortar"].default_value = (mo[0], mo[1], mo[2], 1)
    br.inputs["Scale"].default_value = scale
    br.inputs["Mortar Size"].default_value = ms
    br.inputs["Brick Width"].default_value = bw
    br.inputs["Row Height"].default_value = rh
    nt.links.new(br.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit:
        nt.links.new(br.outputs["Color"], b.inputs["Emission Color"])
        b.inputs["Emission Strength"].default_value = emit
    m.diffuse_color = (a[0], a[1], a[2], 1)
    return m


def zw_brick(name, base="#a5523e", mortar="#d8cfc4"):
    c = hexc(base)
    dark = "#%02x%02x%02x" % tuple(int(255 * min(1.0, max(0.0, (x * 0.74) ** (1 / 2.2)))) for x in c)
    return zw_pattern("brk_" + name, base, dark, mortar, 1.0, 0.7, 0.26, 0.03, 0.85)


def zw_windows(name, glass="#5aaee8", glass2="#8cc8f2", wall="#f4f1ea"):
    """a window grid on a whole facade (cheap background buildings): glass panes in a wall colour; lit at night"""
    if zw_night() and (zw_copy() or ZW_T.get("windows") == "dark"):
        return zw_pattern("win_" + name + "_c", "#1c2742", "#26324e", "#2a3550", 0.32, 1.0, 0.7, 0.16, 0.5, 0.0, 0.0, 0.0)
    if zw_night() and ZW_T.get("curtains") == "closed":
        return zw_pattern("win_" + name + "_cl", "#c98b5a", "#22304f", "#2a3550", 0.32, 1.0, 0.7, 0.16, 0.8, 0.0, 0.5, 0.0)
    if zw_night():
        return zw_pattern("win_" + name + "_n", "#ffd890", "#22304f", "#2a3550", 0.32, 1.0, 0.7, 0.16, 0.5, 0.0, 1.3, 0.0)
    return zw_pattern("win_" + name, glass, glass2, wall, 0.32, 1.0, 0.7, 0.16, 0.35, 0.0, 0.0, 0.0)


# ---------------------------------------------------------------- sky, light, weather (v2: the LOOK)
# cam: what the CAMERA sees (gradient stops by height of the view direction); amb: how the sky LIGHTS the scene (a
# neutral, weaker colour: no blue cast, deeper shadows); a warm sun.
ZW_SKY = {
    "day": dict(cam=[(0.0, (0.60, 0.83, 1.0)), (0.16, (0.24, 0.58, 1.0)), (0.6, (0.06, 0.30, 0.92))], amb=(0.88, 0.9, 1.0), amb_str=0.42,
                sun=(1.0, 0.84, 0.62), sun_str=5.6, sun_rot=(60, 0, -24), cloud=("#ffffff", "#fff8f0", 0.55), grass="#5fcc4c"),
    "sunset": dict(cam=[(0.0, (1.0, 0.52, 0.2)), (0.18, (0.92, 0.36, 0.32)), (0.62, (0.2, 0.12, 0.42))], amb=(1.0, 0.72, 0.58), amb_str=0.36,
                   sun=(1.0, 0.58, 0.3), sun_str=4.8, sun_rot=(72, 0, -38), cloud=("#ffb28c", "#ff9a7a", 0.5), grass="#6aa846"),
    "night": dict(cam=[(0.0, (0.04, 0.07, 0.18)), (0.3, (0.014, 0.025, 0.08)), (0.8, (0.004, 0.008, 0.03))], amb=(0.3, 0.38, 0.7), amb_str=0.22,
                  sun=(0.62, 0.72, 1.0), sun_str=1.0, sun_rot=(40, 0, -40), cloud=("#2c3654", "#1e2744", 0.12), grass="#2c5a30"),
}


def zw_world(stops, amb, amb_str, cam_str=1.0):
    """the world: the camera sees the gradient, everything else is lit by the flat ambient colour (Light Path)"""
    w = D.worlds.new("zw_sky")
    bpy.context.scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    out = next(n for n in nt.nodes if n.type == "OUTPUT_WORLD")
    bl = next(n for n in nt.nodes if n.type == "BACKGROUND")
    bl.inputs[0].default_value = (amb[0], amb[1], amb[2], 1)
    bl.inputs[1].default_value = amb_str
    bc = nt.nodes.new("ShaderNodeBackground")
    bc.inputs[1].default_value = cam_str
    co = nt.nodes.new("ShaderNodeTexCoord")
    sp = nt.nodes.new("ShaderNodeSeparateXYZ")
    cr = nt.nodes.new("ShaderNodeValToRGB")
    els = cr.color_ramp.elements
    els[0].position = stops[0][0]
    els[0].color = (stops[0][1][0], stops[0][1][1], stops[0][1][2], 1)
    els[1].position = stops[-1][0]
    els[1].color = (stops[-1][1][0], stops[-1][1][1], stops[-1][1][2], 1)
    for pos, col in stops[1:-1]:
        e = els.new(pos)
        e.color = (col[0], col[1], col[2], 1)
    nt.links.new(co.outputs["Generated"], sp.inputs[0])
    nt.links.new(sp.outputs["Z"], cr.inputs[0])
    nt.links.new(cr.outputs[0], bc.inputs[0])
    lp = nt.nodes.new("ShaderNodeLightPath")
    mx = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(lp.outputs["Is Camera Ray"], mx.inputs[0])
    nt.links.new(bl.outputs[0], mx.inputs[1])
    nt.links.new(bc.outputs[0], mx.inputs[2])
    nt.links.new(mx.outputs[0], out.inputs["Surface"])
    return w


# LOOK v3 (owner 2026-11-21, upgrade round 1): the street places render with Blender's STANDARD view transform (no AgX /
# Filmic: Roblox colours are bright and saturated, not filmic), so their light is set for Standard: a warm sun at 40
# degrees, a neutral sky light, two shadowless side fills so both sides of a street read, a deeper blue sky. NEVER
# exposure (zw_look_apply keeps it at 0). Night: a dark navy sky, a weak cool moon, a thin haze; the light comes from
# the lamps, lit windows and glowing signs (+ zw_night_cast_light on the cast). Interiors and the kit's sets keep the
# kit's AgX look this round.
# round 1b (owner 2026-11-21): EVERY library place, the rooms and the kit's own sets included
ZW_STD_PLACES = ("downtown_street", "downtown_plaza", "downtown_landmark", "suburb_street", "suburb_porch", "brick_street", "brick_alley",
                 "living_room", "bedroom", "kitchen", "shop", "big_hall", "plane_cabin", "cockpit", "moon", "sky_airliner", "classroom", "hallway")
ZW_SKY_STD = {
    "day": dict(cam=[(0.0, (0.40, 0.68, 1.0)), (0.16, (0.12, 0.42, 1.0)), (0.6, (0.03, 0.19, 0.86))], amb=(0.86, 0.92, 1.0), amb_str=0.5,
                sun=(1.0, 0.94, 0.82), sun_str=2.6, sun_rot=(50, 0, -24), fill=0.4),
    "sunset": dict(cam=[(0.0, (1.0, 0.5, 0.18)), (0.18, (0.9, 0.3, 0.28)), (0.62, (0.16, 0.08, 0.38))], amb=(1.0, 0.8, 0.68), amb_str=0.42,
                   sun=(1.0, 0.6, 0.32), sun_str=2.4, sun_rot=(70, 0, -38), fill=0.25),
    "night": dict(cam=[(0.0, (0.03, 0.05, 0.14)), (0.25, (0.008, 0.016, 0.06)), (0.8, (0.002, 0.004, 0.02))], amb=(0.32, 0.4, 0.8), amb_str=0.09,
                  sun=(0.6, 0.72, 1.0), sun_str=0.32, sun_rot=(45, 0, -40), fill=0.0, fog=0.0028),
}


def zw_fog(density, color=(0.55, 0.62, 0.85)):
    """a thin haze: one big volume box around the street (a world volume would also swallow the sky), Principled Volume"""
    m = D.materials.get("zw_fogm")
    if m is None:
        m = D.materials.new("zw_fogm")
        m.use_nodes = True
        nt = m.node_tree
        for n in list(nt.nodes):
            if n.type != "OUTPUT_MATERIAL":
                nt.nodes.remove(n)
        out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
        v = nt.nodes.new("ShaderNodeVolumePrincipled")
        v.inputs["Density"].default_value = density
        v.inputs["Color"].default_value = (color[0], color[1], color[2], 1)
        try:
            v.inputs["Anisotropy"].default_value = 0.35
        except Exception:
            pass
        nt.links.new(v.outputs[0], out.inputs["Volume"])
    ob = box("zw_fog", (420, 520, 36), (0, 60, 17.5), m, 0.0)
    ob.visible_shadow = False
    ee = bpy.context.scene.eevee
    try:
        ee.volumetric_end = 170.0
    except Exception:
        pass
    return ob


def zw_sky_time(time="day", weather="clear", sun=True):
    ZW_T["time"] = time
    if ZW_T.get("_std") and sun:
        S = dict(ZW_SKY.get(time, ZW_SKY["day"]))
        S.update(ZW_SKY_STD.get(time, ZW_SKY_STD["day"]))
        stops, amb, amb_str, sun_str = S["cam"], S["amb"], S["amb_str"], S["sun_str"]
        if weather in ("rain", "snow"):
            g = (0.5, 0.55, 0.62) if weather == "rain" else (0.78, 0.82, 0.9)
            stops = [(p, tuple(c[k] * 0.35 + g[k] * 0.65 for k in range(3))) for p, c in stops]
            amb_str, sun_str = amb_str * 1.3, sun_str * 0.35
        zw_world(stops, amb, amb_str)
        light("zw_sun", "SUN", (0, 0, 50), sun_str, S["sun"], 3, rot=S["sun_rot"])
        if S.get("fill"):
            for k, zr in enumerate((80, -80)):
                light("zw_fill%d" % k, "SUN", (0, 0, 50), S["fill"], (1.0, 0.97, 0.94) if k == 0 else (0.92, 0.95, 1.0), 10, rot=(72, 0, zr), shadow=False)
        if S.get("fog"):
            zw_fog(S["fog"])
        return
    S = ZW_SKY.get(time, ZW_SKY["day"])
    stops, amb, amb_str, sun_str = S["cam"], S["amb"], S["amb_str"], S["sun_str"]
    if weather in ("rain", "snow"):
        g = (0.5, 0.55, 0.62) if weather == "rain" else (0.78, 0.82, 0.9)
        stops = [(p, tuple(c[k] * 0.35 + g[k] * 0.65 for k in range(3))) for p, c in stops]
        amb_str, sun_str = amb_str * 1.3, sun_str * 0.35
    zw_world(stops, amb, amb_str)
    if sun:
        light("zw_sun", "SUN", (0, 0, 50), sun_str, S["sun"], 3, rot=S["sun_rot"])


def zw_weather(kind, area=((-40, 40), (-40, 200)), n=260, seed=4):
    if kind not in ("rain", "snow"):
        return
    rnd = random.Random(seed)
    src = collection("zw_wx_src")
    if kind == "rain":
        Mr = zw_m("rain", "#bcd4f0", 0.2, emit="#9fb8d8", estr=0.6, alpha=0.55)
        for i in range(6):
            cyl("zw_rd%d" % i, 0.025, 1.6, (rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(0, 3)), Mr, 6, rot=(8, 0, 0), coll=src)
    else:
        Ms = zw_m("snow", "#ffffff", 0.9, emit="#ffffff", estr=0.4)
        for i in range(8):
            sphere("zw_sf%d" % i, 0.09, (rnd.uniform(-1.5, 1.5), rnd.uniform(-1.5, 1.5), rnd.uniform(0, 3)), Ms, seg=6, coll=src)
    hide_coll_from_layer(src)
    for i in range(n):
        instance("zw_wx%d" % i, src, (rnd.uniform(*area[0]), rnd.uniform(*area[1]), rnd.uniform(0, 26)))


# ---------------------------------------------------------------- instanced sources (built once per shot, used many times)
def zw_src(name, build):
    src = D.collections.get(name)
    if src:
        return src
    src = collection(name)
    build(src, name)
    hide_coll_from_layer(src)
    return src


def zw_b_tree(src, nm):
    cyl(nm + "_trunk", 0.35, 4.2, (0, 0, 2.1), zw_m("trunk", "#7a5234", 0.9), 10, coll=src)
    Mt = zw_m("leaf", "#4cbf45", 0.85)
    sphere(nm + "_l1", 2.6, (0, 0, 5.6), Mt, (1, 1, 0.9), coll=src, seg=14)
    sphere(nm + "_l2", 1.8, (1.2, 0.4, 6.6), Mt, (1, 1, 0.9), coll=src, seg=12)
    sphere(nm + "_l3", 1.7, (-1.0, -0.6, 6.4), Mt, (1, 1, 0.9), coll=src, seg=12)


def zw_b_tree2(src, nm):
    cyl(nm + "_trunk", 0.4, 5.0, (0, 0, 2.5), zw_m("trunk", "#7a5234", 0.9), 10, coll=src)
    Mt = zw_m("leaf2", "#6ad455", 0.85)
    for k, (x, y, z, r) in enumerate(((0, 0, 6.2, 2.4), (1.4, 0.6, 5.4, 1.8), (-1.3, 0.4, 5.6, 1.9), (0.2, -1.2, 5.3, 1.8), (0.1, 0.4, 7.6, 1.7))):
        sphere(nm + "_l%d" % k, r, (x, y, z), Mt, coll=src, seg=12)


def zw_b_lamp(src, nm):
    Mp = zw_m("lamppost", "#2f3a4a", 0.4, 0.6)
    cyl(nm + "_pole", 0.14, 6.6, (0, 0, 3.3), Mp, 10, coll=src)
    cyl(nm + "_base", 0.32, 0.5, (0, 0, 0.25), Mp, 10, coll=src)
    on = zw_time() in ("night", "sunset")
    cool = zw_copy()
    b = sphere(nm + "_bulb", 0.42, (0, 0, 6.9), zw_m("lampbulb" + ("_on" if on else "") + ("_c" if cool else "") + ("_k" if zw_copy() else ""), "#eef3ff" if cool else "#fff3c4", 0.3, emit="#dfe8ff" if cool else "#ffd27a", estr=(1.4 if zw_copy() else 3.2) if on else 0.6), coll=src, seg=12)
    b.visible_shadow = False


def zw_b_bench(src, nm):
    Mw, Mm = zw_m("benchwood", "#c98a4e", 0.7), zw_m("benchmetal", "#39404d", 0.4, 0.5)
    box(nm + "_seat", (3.2, 1.0, 0.18), (0, 0, 1.1), Mw, 0.04, coll=src)
    box(nm + "_back", (3.2, 0.16, 0.9), (0, 0.45, 1.65), Mw, 0.04, coll=src)
    for sx in (-1.3, 1.3):
        box(nm + "_leg%d" % int(sx * 10), (0.14, 0.9, 1.1), (sx, 0, 0.55), Mm, 0.02, coll=src)


def zw_b_bush(src, nm):
    Mg = zw_m("bush", "#3fae3f", 0.85)
    sphere(nm + "_a", 1.0, (0, 0, 0.8), Mg, (1.2, 1.0, 0.85), coll=src, seg=10)
    sphere(nm + "_b", 0.75, (0.7, 0.3, 1.0), Mg, coll=src, seg=10)


def zw_b_flowers(src, nm):
    k = int(nm[-1])
    zw_b_bush(src, nm)
    cols = [["#ff5fa2", "#ffd23f"], ["#ff6b4a", "#ffffff"], ["#b26bff", "#ff9fd0"]][k % 3]
    rnd = random.Random(k)
    for i in range(7):
        a = i / 7.0 * math.tau
        sphere(nm + "_f%d" % i, 0.22, (math.cos(a) * 0.9, math.sin(a) * 0.75, 1.15 + rnd.uniform(0, 0.4)), zw_m("flower" + cols[i % 2][1:], cols[i % 2], 0.5), coll=src, seg=8)


def zw_b_hydrant(src, nm):
    Mr = zw_m("hydrant", "#e23b3b", 0.45)
    cyl(nm + "_b", 0.3, 1.3, (0, 0, 0.65), Mr, 12, coll=src)
    sphere(nm + "_t", 0.32, (0, 0, 1.3), Mr, coll=src, seg=10)
    cyl(nm + "_n", 0.13, 0.9, (0, 0, 0.85), Mr, 8, rot=(0, 90, 0), coll=src)


def zw_b_bin(src, nm):
    cyl(nm + "_b", 0.5, 1.6, (0, 0, 0.8), zw_m("bin", "#2f7a52", 0.6), 14, coll=src)
    cyl(nm + "_l", 0.56, 0.16, (0, 0, 1.66), zw_m("binlid", "#24603f", 0.5), 14, coll=src)


def zw_b_planter(src, nm):
    box(nm + "_b", (1.4, 1.4, 1.0), (0, 0, 0.5), zw_m("planter", "#b9844e", 0.7), 0.06, coll=src)
    sphere(nm + "_g", 0.85, (0, 0, 1.35), zw_m("bush", "#3fae3f", 0.85), (1, 1, 0.8), coll=src, seg=10)
    for i in range(4):
        a = i / 4.0 * math.tau + 0.4
        sphere(nm + "_f%d" % i, 0.2, (math.cos(a) * 0.6, math.sin(a) * 0.6, 1.75), zw_m("flowerff5fa2", "#ff5fa2", 0.5), coll=src, seg=8)


def zw_b_ac(src, nm):
    box(nm + "_b", (2.0, 1.6, 1.2), (0, 0, 0.6), zw_m("acbox", "#c9ced6", 0.5, 0.2), 0.06, coll=src)
    cyl(nm + "_f", 0.55, 0.06, (0.2, 0, 1.23), zw_m("acfan", "#4a505a", 0.5), 16, coll=src)


def zw_b_tank(src, nm):
    Ml = zw_m("wtleg", "#4a3a2a", 0.7)
    for k in range(4):
        cyl(nm + "_leg%d" % k, 0.16, 4.0, ((k % 2) * 2.6 - 1.3, (k // 2) * 2.6 - 1.3, 2.0), Ml, 6, coll=src)
    cyl(nm + "_t", 2.0, 3.4, (0, 0, 5.7), zw_m("wtank", "#9a6f48", 0.8), 18, coll=src)
    cyl(nm + "_r", 2.2, 1.6, (0, 0, 8.2), zw_m("wroof", "#5a4a3a", 0.7), 18, r2=0.2, coll=src)


def zw_b_antenna(src, nm):
    Ma = zw_m("antenna", "#8a9099", 0.4, 0.6)
    cyl(nm + "_p", 0.08, 6.0, (0, 0, 3.0), Ma, 6, coll=src)
    for k in range(3):
        box(nm + "_x%d" % k, (1.6 - k * 0.4, 0.08, 0.08), (0, 0, 3.6 + k * 1.0), Ma, 0, coll=src)
    sphere(nm + "_tip", 0.18, (0, 0, 6.1), zw_m("antred", "#ff3b3b", 0.4, emit="#ff3b3b", estr=2.0), coll=src, seg=8)


def zw_b_rock(src, nm):
    k = int(nm[-1])
    sphere(nm + "_r", 1.0, (0, 0, 0.35), zw_m("rock", "#8d8d92", 0.95), (1.2, 0.9 + k * 0.15, 0.7), seg=6, coll=src)


def zw_b_star(src, nm):
    sphere(nm + "_s", 1.0, (0, 0, 0), zw_m("star", "#ffffff", 0.5, emit="#ffffff", estr=8.0), seg=6, coll=src)


ZW_SRC = {"tree": zw_b_tree, "tree2": zw_b_tree2, "lamp": zw_b_lamp, "bench": zw_b_bench, "bush": zw_b_bush,
          "flowers0": zw_b_flowers, "flowers1": zw_b_flowers, "flowers2": zw_b_flowers, "hydrant": zw_b_hydrant, "bin": zw_b_bin,
          "planter": zw_b_planter, "ac": zw_b_ac, "tank": zw_b_tank, "antenna": zw_b_antenna, "rock0": zw_b_rock, "rock1": zw_b_rock,
          "rock2": zw_b_rock, "star": zw_b_star}


def zw_novol(ob, k=0.0):
    """a light's share in the haze (0 = it lights things, never the fog itself)"""
    try:
        ob.data.volume_factor = k
    except Exception:
        pass
    return ob


def zw_inst(kind, loc, rot=0, scale=1.0):
    ZW_N["n"] += 1
    src = zw_src("zw_src_" + kind, ZW_SRC[kind])
    s = scale if isinstance(scale, (tuple, list)) else (scale, scale, scale)
    if kind == "lamp" and zw_night() and ZW_T.get("_std"):
        # NIGHT (look v3): a street lamp is a REAL warm light, not only a glowing bulb (a pool of light on the street and
        # on whoever stands near it); soft shadow from the bulb's size
        sz = s[2]
        zw_novol(light("zw_lamppool%d" % ZW_N["n"], "SPOT", (loc[0], loc[1], loc[2] + 6.64 * sz), 10000.0 * sz * sz * (0.3 if zw_copy() else 0.55), (0.82, 0.88, 1.0) if zw_copy() else (1.0, 0.72, 0.42), 0.4 * sz, spot=100, blend=0.7), 0.15)
        zw_novol(light("zw_lamplight%d" % ZW_N["n"], "POINT", (loc[0], loc[1], loc[2] + 6.9 * sz), 450.0 * sz * sz * (0.3 if zw_copy() else 0.5), (0.82, 0.88, 1.0) if zw_copy() else (1.0, 0.7, 0.4), 0.5 * sz), 0.35)
    return instance("zw_%s_i%d" % (kind, ZW_N["n"]), src, loc, s, rot=(0, 0, rot))


def zw_place_inst(kind, loc, rot=0, scale=1.0):
    return zw_inst(kind, loc, rot, scale)


# ---------------------------------------------------------------- sky backdrop: puffy clouds + far green hills
def zw_b_cloud(src, nm):
    k = int(nm[-1])
    c1, c2, est = ZW_SKY.get(zw_time(), ZW_SKY["day"])["cloud"]
    M = zw_m("cloud_" + zw_time(), c1, 0.95, emit=c2, estr=est)
    rnd = random.Random(40 + k)
    sphere(nm + "_base", 9.0, (0, 0, 1.5), M, (1.7, 0.75, 0.4), coll=src, seg=16)
    for i in range(7):
        r = rnd.uniform(4.5, 8.0)
        sphere(nm + "_%d" % i, r, (rnd.uniform(-12, 12), rnd.uniform(-3, 3), 2.0 + r * 0.45), M, (1.0, 0.85, 0.82), coll=src, seg=14)


for _k in range(4):
    ZW_SRC["cloud%d" % _k] = zw_b_cloud


def zw_backdrop(c=(0, 60), n=18, seed=9, hills=True, rmin=230):
    rnd = random.Random(seed)
    for k in range(n):
        a = (k + rnd.uniform(-0.3, 0.3)) / n * math.tau
        r = rnd.uniform(rmin, rmin + 140)
        s = rnd.uniform(1.2, 2.3)
        zw_inst("cloud%d" % (k % 4), (c[0] + math.cos(a) * r, c[1] + math.sin(a) * r, rnd.uniform(55, 115)), math.degrees(a) + 90, s)
    if hills:
        g = ZW_SKY.get(zw_time(), ZW_SKY["day"])["grass"]
        box("zw_farground", (3000, 3000, 0.2), (c[0], c[1], -0.5), zw_m("farground" + g[1:], g, 0.95), 0)
        Mh = zw_m("hill" + g[1:], g, 0.95)
        for k in range(16):
            a = (k + rnd.uniform(-0.3, 0.3)) / 16 * math.tau
            r = rnd.uniform(rmin + 90, rmin + 170)
            sphere("zw_hill%d" % k, rnd.uniform(45, 80), (c[0] + math.cos(a) * r, c[1] + math.sin(a) * r, -6), Mh, (1.5, 1.0, 0.3), seg=16)


# ---------------------------------------------------------------- THE ASSET LIBRARY (CC0 packs, assets/catalog.json)
# The image holds /app/zyvo_assets/zyvo_assets.blend (built by assets/build_assets.py): one collection "za_<id>" per
# asset, in our units (a character is 5.2 tall), origin at the bottom centre, pastel pass applied. Shot code LINKS the
# collections it needs (one library read per shot) and instances them. No library (an older image): every helper
# returns None and the worlds keep their primitive versions.
ZA_LIB = "/app/zyvo_assets/zyvo_assets.blend"
ZA = {"ok": None, "c": {}}


def za_load(ids):
    """link these assets' collections in ONE library read (unknown ids are skipped)"""
    want = ["za_" + i for i in ids if i not in ZA["c"]]
    if not want or ZA["ok"] is False:
        return
    try:
        with D.libraries.load(ZA_LIB, link=True) as (src, dst):
            have = set(src.collections)
            dst.collections = [n for n in want if n in have]
        ZA["ok"] = True
    except Exception:
        ZA["ok"] = False
        return
    for n in want:
        ZA["c"][n[3:]] = D.collections.get(n)


def za_size(aid):
    c = ZA["c"].get(aid)
    if c is None:
        return (0.0, 0.0, 0.0)
    s = c.get("zw_size")
    return tuple(s) if s else (0.0, 0.0, 0.0)


def zw_asset(aid, loc, rot=0, scale=1.0, coll=None):
    """an instance of a library asset (bottom centre at loc), or None when the asset / the library is missing"""
    if aid not in ZA["c"]:
        za_load([aid])
    c = ZA["c"].get(aid)
    if c is None:
        return None
    ZW_N["n"] += 1
    s = scale if isinstance(scale, (tuple, list)) else (scale, scale, scale)
    return instance("za_%s_%d" % (aid[:24], ZW_N["n"]), c, loc, s, coll=coll, rot=(0, 0, rot))


def zw_asset_fit(aid, loc, maxw, maxh, rot=0, coll=None, grow=1.5):
    """an asset scaled to fit a footprint (maxw) and a height (maxh); returns (instance, fitted width)"""
    if aid not in ZA["c"]:
        za_load([aid])
    sx, sy, sz = za_size(aid)
    if sz <= 0:
        return None, 0.0
    k = min(grow, maxw / max(sx, sy, 1e-3), maxh / sz)
    return zw_asset(aid, loc, rot, k, coll), max(sx, sy) * k


# ---------------------------------------------------------------- people that MOVE (walk, talk, sit, stand) and cars that drive
ZW_KID_BASE = {"walk": 11, "stand": 41, "sit": 71, "talk": 101, "bag": 131, "play": 161, "hurry": 191, "run": 221, "dog": 251,
               "cheer": 281, "look": 311}
ZW_MOVERS = {"walk": 2.8, "bag": 2.6, "dog": 2.4, "hurry": 5.2, "run": 7.0}   # round 3: units a second


def zw_person_src(mode, j, t0, t1):
    """a hidden source: one kid walking in place / standing / sitting, or a pair talking (instanced many times)"""
    nm = "zw_ps_%s%d" % (mode, j)
    src = D.collections.get(nm)
    if src:
        return src
    src = collection(nm)
    b = ZW_KID_BASE[mode] + j * 3
    if mode == "talk":
        for k, (x, r) in enumerate(((-1.15, 90), (1.15, -90))):
            ch = chars.kid(b + k, coll=src)
            ch.pose(t0, loc=(x, 0, 0), rot=r)
            ch.blink(t0, t1)
            ch.talk(t0 + 0.15 + k * 0.45, t1)
            ch.pose(t0, head=(0, -6 + k * 10, 4 - k * 8), torso=(0, 4, 3 - k * 6), armL=(8, 10), armR=(8, 10))
            ch.wiggle(t0, t1, part="armR" if k else "armL", amp=(30, 14), rate=1.8 + k * 0.7, base=(70 - k * 15, 24))
            ch.nod(t0 + 0.35 + k * 0.5, 2, 10, 5.0)
    else:
        ch = chars.kid(b, coll=src)
        ch.pose(t0, loc=(0, 0, 0), rot=0)
        ch.blink(t0, t1)
        if mode in ZW_MOVERS:
            fast = mode in ("hurry", "run")
            sw = 40.0 if mode == "run" else (32.0 if fast else 24.0)
            rt = max(0.6, min(2.3, ZW_MOVERS[mode] / (4.0 * 2.0 * math.sin(math.radians(sw)))))   # round 4: no sliding feet
            ch.walk(t0, t1, (0, 0, 0), (0, -0.001, 0), face_dir=False, start_phase=j, swing=sw, arm=sw * 1.15, bob=0.18 if fast else 0.1, rate=rt)
            ch.pose(t0, torso=(0, 12 if fast else 5, 0), head=((-1) ** j * 12, -4, 0))
            if mode == "bag":   # a shopping bag in the right hand
                box("zw_bag_%s" % nm, (0.7, 0.45, 0.9), (0.0, 0.0, -2.0), zw_m("bag%d" % (j % 3), ["#c98a4e", "#e8e2d4", "#d8352a"][j % 3], 0.8), 0.04, parent=ch.shR, coll=src)
            if mode == "dog":
                zw_dog_into(src, (1.3, -0.2, 0.0), j)
        elif mode == "play":   # kids playing: jumping, arms up
            ch.pose(t0, armL=(150, 20), armR=(150, 20), head=(0, 10, 0))
            for k in range(int((t1 - t0) / 0.8) + 1):
                ch.jump(t0 + 0.1 + j * 0.25 + k * 0.8)
        elif mode == "cheer":   # relief after the threat: arms up
            ch.pose(t0, armL=(160, 30), armR=(160, 30), head=(-10, 0, 0))
            ch.idle(1.5)
        elif mode == "look":    # the threat is near: still, staring
            ch.pose(t0, armL=(4, 6), armR=(4, 6), head=(-6, 0, 0), torso=(-4, 0, 0))
        elif mode == "sit":
            ch.pose(t0, legL=(85, 3 + j * 6), legR=(85, -3 - j * 6), armL=(30, 10), armR=(55 if j else 20, 12), torso=(0, -4, 0), head=(15 - j * 30, 0, 0), hipz=-0.8)
            ch.talk(t0 + 0.2, t1)
            ch.idle()
        else:
            # three natural standing poses: hands on hips, a wave, pointing and looking
            ch.pose(t0, **[dict(armL=(-12, 42), armR=(-12, 42), torso=(0, 0, 4), head=(18, 0, 0)),
                           dict(armL=(6, 8), armR=(160, 30), head=(-10, -6, 0)),
                           dict(armL=(10, 6), armR=(88, -8), head=(-25, 4, 0), torso=(-10, 0, 0))][j % 3])
            ch.idle(1.5)
            if j % 3 == 1:
                ch.wiggle(t0, t1, part="armR", amp=(14, 24), rate=2.4, base=(160, 30))
    hide_coll_from_layer(src)
    return src


def zw_off_lane(x, y, pad=0.9):
    """a point inside a traffic lane (ZW_T["lanes"], minus the crosswalks ZW_T["xwalks"]) moves to the nearest sidewalk side"""
    for (x0, x1), (y0, y1) in ZW_T.get("lanes", ()):
        if x0 - pad < x < x1 + pad and y0 - pad < y < y1 + pad:
            if any(c0 <= y <= c1 for c0, c1 in ZW_T.get("xwalks", ())):
                continue
            if (x1 - x0) <= (y1 - y0):
                x = x0 - pad - 0.6 if x < (x0 + x1) / 2 else x1 + pad + 0.6
            else:
                y = y0 - pad - 0.6 if y < (y0 + y1) / 2 else y1 + pad + 0.6
    return x, y


def zw_in_lane(x, y, pad=0.9):
    return zw_off_lane(x, y, pad) != (x, y)


def zw_people(t0, t1, n, areas, seed=7, modes=("walk", "walk", "stand", "talk", "walk")):
    """n background people over areas [((x0, x1), (y0, y1), z), ...]: walkers move along the area's long side (legs
    swinging), talkers come in pairs facing each other, standers idle; a talking pair counts as two"""
    if n <= 0 or not areas:
        return
    if ZW_CROWD_ON[0] and "busy" in ZW_T and seed in (7, 9, 12):
        return zw_crowd(t0, t1, n)
    if ZW_CROWD_ON[0] and "busy" in ZW_T and seed == 31:
        return None   # the crowd already spreads people along the whole street (the stage included)
    rnd = random.Random(seed)
    i = made = 0
    while made < n:
        mode = modes[i % len(modes)]
        ar = areas[i % len(areas)]
        z = ar[2] if len(ar) > 2 else 0.0
        x, y = zw_off_lane(rnd.uniform(*ar[0]), rnd.uniform(*ar[1]))
        along_y = (ar[1][1] - ar[1][0]) >= (ar[0][1] - ar[0][0])
        src = zw_person_src(mode, (i // len(modes)) % 3, t0, t1)
        name = "zw_person%d_%d" % (seed, i)
        if mode in ZW_MOVERS:
            sgn = rnd.choice((-1, 1))
            ta = ZW_T.get("threat_at")
            if mode == "run" and ta:   # away from the threat
                sgn = (1 if y > ta[1] else -1) if along_y else (1 if x > ta[0] else -1)
            rot = (180 if sgn > 0 else 0) if along_y else (90 if sgn > 0 else -90)
            dist = min(ZW_MOVERS[mode] * (t1 - t0), 12.0 if mode in ("hurry", "run") else 6.0)
            dx, dy = (0.0, sgn * dist) if along_y else (sgn * dist, 0.0)
            if zw_in_lane(x - dx / 2, y - dy / 2) or zw_in_lane(x + dx / 2, y + dy / 2):
                dx, dy = 0.0, 0.0      # never walk into the traffic lane
            ob = instance(name, src, (x - dx / 2, y - dy / 2, z), rot=(0, 0, rot))
            ob.keyframe_insert("location", frame=F(t0))
            ob.location = (x + dx / 2, y + dy / 2, z)
            ob.keyframe_insert("location", frame=F(t1))
            set_interp(ob, "location", F(t0), "LINEAR")
        elif mode == "talk":
            instance(name, src, (x, y, z), rot=(0, 0, (90 if along_y else 0) + rnd.choice((0, 180))))
        else:
            instance(name, src, (x, y, z), rot=(0, 0, rnd.choice((0, 0, 30, -30, 180, 90, -90))))
        made += 2 if mode == "talk" else 1
        i += 1


def zw_sitters(t0, t1, seats, seed=3):
    """people sitting on benches: seats = [(x, y, z, rot)] at the bench's own location and rotation"""
    for k, (x, y, z, r) in enumerate(seats):
        a = math.radians(r)
        instance("zw_sitter%d_%d" % (seed, k), zw_person_src("sit", k % 2, t0, t1), (x + math.sin(a) * 0.15, y - math.cos(a) * 0.15, z), rot=(0, 0, r))


# ---- the Milo lessons (owner 2026-11-15): GROUNDING + VEHICLES THAT PUSH CARS ASIDE
def zw_top(ob):
    """the world-space top (highest z) of an object and its children: what a character stands on"""
    if ob is None:
        return 0.0
    top = None
    for o in [ob] + list(ob.children_recursive):
        if o.type != "MESH" and o is not ob:
            continue
        for c in o.bound_box:
            z = (o.matrix_world @ Vector(c)).z
            top = z if top is None or z > top else top
    return 0.0 if top is None else top


def zw_ground(ch, t, surface, x, y, **pose):
    """stand ch ON a surface at (x, y): surface = an object (its top is measured) or a top height (a number); the feet
    touch the top, never floating, never sunk in (a roof, a table, a shelf, a car)"""
    z = float(surface) if isinstance(surface, (int, float)) else zw_top(surface)
    ch.pose(t, loc=(x, y, z), **pose)
    return z


def zw_knock(ob, t0, t1, dx, dy, spin=90.0):
    """a car / prop that is hit at t0 slides (dx, dy) and spins `spin` degrees by t1, easing out (pushed aside, never
    driven through)"""
    x, y, z = ob.location
    rz = ob.rotation_euler[2]
    ob.keyframe_insert("location", frame=F(t0))
    ob.keyframe_insert("rotation_euler", index=2, frame=F(t0))
    ob.location = (x + dx, y + dy, z)
    ob.rotation_euler[2] = rz + math.radians(spin)
    ob.keyframe_insert("location", frame=F(t1))
    ob.keyframe_insert("rotation_euler", index=2, frame=F(t1))
    set_interp(ob, "location", F(t0), "QUAD", "EASE_OUT")
    return ob


# library cars (front toward -Y at rot 0, the glTF / OBJ convention after import) + their pastel-ish colours
ZA_CARS = ["kaykit_car_sedan", "rveh_car_hatchback_citrus", "kaykit_car_taxi", "rveh_car_coupe_red", "kaykit_car_stationwagon",
           "rveh_car_mpv_violet", "kaykit_car_hatchback", "rveh_car_van_blue", "rveh_car_micro_green", "rveh_car_minibus_orange",
           "rveh_car_normal_blue", "rveh_car_pickup_citrus"]
ZA_CAR_FRONT = -1   # the models' front faces -Y before rotation
ZA_CITY = ["kcity_building_a", "kcity_building_b", "kcity_building_d", "kcity_building_f", "kcity_building_g", "kcity_building_h", "kcity_building_c"]
ZA_TALL = ["kcity_building_m", "kcity_building_skyscraper_e", "kcity_building_i"]
ZA_SHELF = ["kfood_soda_bottle", "kfood_carton", "kfood_can", "kfood_bag", "kfood_bottle_ketchup", "kfood_honey", "kfood_peanut_butter",
            "kfood_soda_can", "kfood_carton_small", "kfood_bottle_musterd", "kfood_can_small", "kfood_bottle_oil", "kfood_loaf", "kfood_soda"]
ZA_FRUIT = ["kfood_apple", "kfood_orange", "kfood_lemon", "kfood_pear", "kfood_banana"]


def zw_cars(spots, t0=None, t1=None, speed=8.0, reach=18.0, lights=False):
    """cars: spots = [(x, y, colour, heading, drive)] (heading 0 = toward +Y, 180 = -Y, 90 = -X, -90 = +X); a car with
    drive=True moves along its heading during the shot (at most `reach` units); library cars when present, else W.car;
    lights=True (round 3): two glowing headlights at the front of every driving car"""
    za_load(ZA_CARS)
    for k, sp in enumerate(spots):
        x, y, c, r = sp[:4]
        drive = sp[4] if len(sp) > 4 else False
        if lights and drive:
            zw_headlights(k, x, y, r, t0, t1, min(speed * (t1 - t0), reach) if t0 is not None else 0.0)
        aid = ZA_CARS[k % len(ZA_CARS)]
        ob = zw_asset(aid, (x, y, 0.06), r + (180 if ZA_CAR_FRONT < 0 else 0)) if ZA["c"].get(aid) is not None else None
        if ob is None:
            ob = W.car("zw_car%d_%d" % (int(x), int(y)), (x, y, 0.06), c, rot=r)
        if drive and ob is not None:
            ZW_DRIVING.append(ob)   # round 6: a driving car is never let through the lens (town.py)
        if drive and t0 is not None and ob is not None:
            a = math.radians(r)
            d = min(speed * (t1 - t0), reach)
            ob.location = (x, y, 0.06)
            ob.keyframe_insert("location", frame=F(t0))
            ob.location = (x - math.sin(a) * d, y + math.cos(a) * d, 0.06)
            ob.keyframe_insert("location", frame=F(t1))
            set_interp(ob, "location", F(t0), "LINEAR")


def zw_blimp(text_body="ZYVO", loc=(-30, 90, 55)):
    root = empty("zw_blimp", loc)
    sphere("zw_blimp_body", 6, (0, 0, 0), zw_m("blimp", "#f5f5f5", 0.4), (1, 3.2, 1), parent=root, seg=24)
    for k, (dx, dz) in enumerate(((0, 6), (5, 0), (-5, 0))):
        box("zw_blimp_fin%d" % k, (0.4 if dx == 0 else 3.5, 4, 3.5 if dx == 0 else 0.4), (dx * 0.4, -18, dz * 0.6), zw_m("blimpfin", "#e2725b", 0.5), 0.1, parent=root)
    box("zw_blimp_cab", (2.4, 5, 1.6), (0, 0, -6.4), zw_m("blimpcab", "#3b4a5c", 0.4), 0.3, parent=root)
    text("zw_blimp_txt", text_body, (6.1, 0, 0.6), 3.4, zw_m("blimptxt", "#e2725b", 0.4), rot=(90, 0, 90), extrude=0.05, parent=root)
    return root


def zw_billboard(k, x, y, z, side, txt, col, tcol="#ffffff"):
    """a rooftop billboard turned to the street and the camera down the street (side +1 east, -1 west)"""
    th = -45 * side
    ca, sa = math.cos(math.radians(th)), math.sin(math.radians(th))
    Mf = zw_m("bbframe", "#3a3f4a", 0.5, 0.4)
    for d in (-3.6, 3.6):
        box("zw_bbleg%d_%d" % (k, int(d)), (0.4, 0.4, 4.2), (x + ca * d, y + sa * d, z + 2.1), Mf, 0.02)
    lit = zw_time() in ("night", "sunset")
    box("zw_bb%d" % k, (10.5, 0.5, 5.2), (x, y, z + 6.6), zw_m("bb" + col[1:] + ("_n" if lit else ""), col, 0.5, emit=col if lit else None, estr=1.2 if lit else 0.0), 0.08, rot=(0, 0, th))
    box("zw_bbtrim%d" % k, (10.9, 0.4, 0.35), (x, y, z + 9.3), zw_m("bbtrim", "#ffffff", 0.5), 0.02, rot=(0, 0, th))
    nx, ny = sa, -ca
    body = txt.upper()[:14]
    text("zw_bbt%d" % k, body, (x + nx * 0.32, y + ny * 0.32, z + 6.6), min(1.7, 15.0 / max(6, len(body))), zw_m("bbt" + tcol[1:], tcol, 0.4, emit=tcol if lit else None, estr=2.0 if lit else 0.0), rot=(90, 0, th), extrude=0.04)


# ---------------------------------------------------------------- PASTEL DOWNTOWN
ZW_PASTEL = ["#ff9ec0", "#8fe0c4", "#b9a3f5", "#ffc38a", "#ffe680", "#8fcdf7", "#ffab8f", "#a9e88f", "#f6f1e7", "#d6b4f0"]
ZW_AWN = [("#ff4f7e", "#ffffff"), ("#22b5a3", "#ffffff"), ("#7b5cf6", "#ffffff"), ("#ff8c2a", "#ffffff"), ("#ffcf1f", "#ffffff"), ("#2f86fd", "#ffffff")]
ZW_SIGNS = ["BAKERY", "TOYS", "CAFE", "BOOKS", "FLOWERS", "ARCADE", "DINER", "SWEETS", "MUSIC", "PETS"]
ZW_GLASS = [("#2fa8e8", "#5cc4f5"), ("#2a7fd9", "#4a9ff0"), ("#3cc2e0", "#6fdcf0"), ("#3a62e0", "#5d86f2"), ("#4fa6f0", "#7cc0ff"), ("#1f9bbf", "#45bcd8")]


def zw_shop(i, side, y, w, h, sign, fx=None):
    """one shop: side +1 = east of the street (front faces -X), -1 = west (front faces +X)"""
    fx = 12.0 * side if fx is None else fx       # the facade plane
    cx = fx + side * 7.0
    col = ZW_PASTEL[i % len(ZW_PASTEL)]
    if i % 7 == 5:
        Mb = zw_brick("shop", "#b85a44")
    else:
        Mb = zw_m("shop%d" % (i % len(ZW_PASTEL)), col, 0.7)
    box("zw_shop%d" % i, (14, w, h), (cx, y, h / 2), Mb, 0.12)
    Mw = zw_m("shopcap", "#fdfcf7", 0.6)
    box("zw_shopcap%d" % i, (14.4, w + 0.4, 0.6), (cx, y, h + 0.3), Mw, 0.1)
    box("zw_shopband%d" % i, (0.5, w + 0.2, 0.45), (fx - side * 0.2, y, 10.3), Mw, 0.04)
    # the shop window + door at street level
    G = zw_glass("shopwin")
    box("zw_win%d" % i, (0.2, w * 0.55, 3.6), (fx - side * 0.05, y - w * 0.12, 2.6), G, 0.02)
    box("zw_winfr%d" % i, (0.25, w * 0.58, 0.25), (fx - side * 0.08, y - w * 0.12, 4.5), Mw, 0.02)
    box("zw_door%d" % i, (0.25, 2.2, 4.4), (fx - side * 0.08, y + w * 0.3, 2.2), zw_m("door%d" % (i % 3), ["#6b4a3a", "#3a6b5e", "#4a4f8a"][i % 3], 0.5), 0.05)
    # the window display (a ledge of colourful goods), an OPEN sign on the door, two wall lamps
    box("zw_wled%d" % i, (0.7, w * 0.55, 0.15), (fx - side * 0.4, y - w * 0.12, 0.72), Mw, 0.02)
    zw_inst("products%d" % (i % 4), (fx - side * 0.45, y - w * 0.12 - w * 0.26, 0.8), 0, (0.45, w * 0.52 / 7.0, 0.85))
    box("zw_opn%d" % i, (0.12, 1.5, 0.6), (fx - side * 0.24, y + w * 0.3, 3.4), zw_m("opensign", "#e2405b", 0.5), 0.03)
    text("zw_opnt%d" % i, "OPEN", (fx - side * 0.32, y + w * 0.3, 3.4), 0.38, zw_m("bbtffffff", "#ffffff", 0.4), rot=(90, 0, -90 * side), extrude=0.02)
    lit = zw_time() in ("night", "sunset")
    for s2 in (-1, 1):
        sphere("zw_wlamp%d_%d" % (i, s2), 0.28, (fx - side * 0.4, y + w * 0.3 + s2 * 1.7, 4.9), zw_m("plamp" + ("_on" if lit else ""), "#fff3c4", 0.3, emit="#ffd27a", estr=5.0 if lit else 0.4), seg=8)
    # the striped awning, sloping down toward the street
    a, b = ZW_AWN[i % len(ZW_AWN)]
    n = max(4, int(w / 1.2))
    for k in range(n):
        yy = y - w / 2 + (k + 0.5) * w / n
        box("zw_awn%d_%d" % (i, k), (3.2, w / n, 0.16), (fx - side * 1.5, yy, 7.0), zw_m("awn" + (a if k % 2 == 0 else b)[1:], a if k % 2 == 0 else b, 0.6), 0.0, rot=(0, -18 * side, 0))
    # the sign board + its text (dressed per story)
    box("zw_signb%d" % i, (0.3, w * 0.8, 1.6), (fx - side * 0.2, y, 8.9), zw_m("signboard", "#fffdf5", 0.5), 0.08)
    # NIGHT (look v3): the sign's letters glow in their own colour (a lit shop sign), the board stays matt
    stc = ["#e2405b", "#2a7f74", "#5b4bd6", "#e07a1f"][i % 4]
    glow = zw_night() and ZW_T.get("_std")
    text("zw_signt%d" % i, sign, (fx - side * 0.4, y, 8.9), 1.05, zw_m("signtxt%d" % (i % 4) + ("_n" if glow else ""), stc, 0.4, emit=("#ff5a7a", "#3fe0c8", "#8a7bff", "#ffa040")[i % 4] if glow else None, estr=3.0 if glow else 0.0), rot=(90, 0, -90 * side), extrude=0.06)
    # upper floors: framed windows with sills (2 or 3 a floor)
    cols = 3 if w >= 16 else 2
    fl, z = 0, 12.4
    while z + 1.6 < h - 0.8:
        for k in range(cols):
            yy = y + (k - (cols - 1) / 2.0) * (w / cols)
            box("zw_uwf%d_%d_%d" % (i, fl, k), (0.16, 2.7, 3.1), (fx - side * 0.04, yy, z), Mw, 0.0)
            box("zw_uw%d_%d_%d" % (i, fl, k), (0.2, 2.2, 2.6), (fx - side * 0.08, yy, z), zw_glass("upwin"), 0.02)
            box("zw_uws%d_%d_%d" % (i, fl, k), (0.5, 2.9, 0.22), (fx - side * 0.22, yy, z - 1.6), Mw, 0.0)
        fl += 1
        z += 3.9
    # rooftop: AC boxes, water tanks, antennas (instanced)
    zw_inst("ac", (cx - side * 2.0, y + w * 0.2, h + 0.6))
    if i % 3 == 0:
        zw_inst("tank", (cx + side * 2.6, y - w * 0.22, h + 0.6))
    if i % 2 == 1:
        zw_inst("ac", (cx + side * 3.0, y - w * 0.3, h + 0.6), 90)
    if i % 4 == 2:
        zw_inst("antenna", (cx, y + w * 0.05, h + 0.6))


def zw_block(i, x, y, w, d, h, col=None):
    """a cheap background building: one box with a window grid, a cap and roof bits"""
    col = col or ZW_PASTEL[(i * 3) % len(ZW_PASTEL)]
    g1, g2 = ZW_GLASS[i % len(ZW_GLASS)]
    box("zw_blk%d" % i, (d, w, h), (x, y, h / 2), zw_windows("blk%d_%s" % (i % len(ZW_GLASS), col[1:]), g1, g2, col), 0.0)
    box("zw_blkcap%d" % i, (d + 0.6, w + 0.6, 0.8), (x, y, h + 0.4), zw_m("shopcap", "#fdfcf7", 0.6), 0.05)
    zw_inst("ac", (x - d * 0.2, y + w * 0.15, h + 0.8))
    if i % 2 == 0:
        zw_inst("tank", (x + d * 0.2, y - w * 0.2, h + 0.8))


def zw_tower_bg(i, x, y, h, w=16):
    g1, g2 = ZW_GLASS[i % len(ZW_GLASS)]
    if zw_night():
        M = zw_pattern("tower_n%d" % (i % 3), "#ffd890", "#1d2a48", "#26324e", 0.36, 1.0, 0.62, 0.1, 0.4, 0.0, 1.2, 0.0)
    else:
        M = zw_pattern("tower%d" % (i % len(ZW_GLASS)), g1, g2, "#e6f0ff", 0.36, 1.0, 0.62, 0.1, 0.18, 0.15, 0.0, 0.0)
    box("zw_sky%d" % i, (w, w, h), (x, y, h / 2), M, 0.0)
    box("zw_skycap%d" % i, (w + 0.8, w + 0.8, 1.2), (x, y, h + 0.6), zw_m("towercap", "#f4f6fa", 0.5), 0.0)
    if i % 3 == 0:
        box("zw_skytop%d" % i, (w * 0.6, w * 0.6, 9), (x, y, h + 5.7), M, 0.0)
        cyl("zw_skyant%d" % i, 0.25, 14, (x, y, h + 17), zw_m("antenna", "#8a9099", 0.4, 0.6), 6)
    elif i % 3 == 1:
        zw_inst("ac", (x - w * 0.2, y, h + 1.2))
        zw_inst("ac", (x + w * 0.2, y + w * 0.2, h + 1.2), 90)


def zw_landmark(kind, label, y=178.0):
    if kind == "none":
        return
    if zw_night():
        light("zw_lm_flood", "SPOT", (0, y - 40, 14), 60000, (1.0, 0.86, 0.62), 2, target=(0, y, 22), spot=55)
    Mw, Mt = zw_m("lm_white", "#f7f3ea", 0.5), zw_m("lm_trim", "#e0b84a", 0.4, 0.3)
    if kind == "bank":
        box("zw_lm_steps", (40, 10, 2), (0, y - 4, 1), Mw, 0.1)
        box("zw_lm_body", (36, 14, 20), (0, y + 4, 12), Mw, 0.2)
        for k in range(6):
            cyl("zw_lm_col%d" % k, 1.0, 16, (-15 + k * 6, y - 4.5, 10), Mw, 16)
        box("zw_lm_top", (38, 12, 2.4), (0, y - 1, 19.4), Mt, 0.1)
        poly_extrude("zw_lm_ped", [(-19, 0), (19, 0), (0, 7)], 11, (0, y + 4.5, 20.6), Mw, rot=(90, 0, 0))
        text("zw_lm_txt", label or "BANK", (0, y - 7.2, 19.4), 1.9, zw_m("lm_txt", "#6b5a2a", 0.4), extrude=0.08)
    elif kind == "city_hall":
        box("zw_lm_body", (40, 16, 18), (0, y + 4, 9), Mw, 0.2)
        cyl("zw_lm_drum", 7, 6, (0, y + 4, 21), Mw, 32)
        sphere("zw_lm_dome", 7.2, (0, y + 4, 24), zw_m("lm_dome", "#e8b93c", 0.3, 0.5), (1, 1, 0.8), seg=32)
        cyl("zw_lm_flagpole", 0.15, 8, (0, y + 4, 33), Mt, 8)
        card("zw_lm_flag", 3.2, 2.0, (1.7, y + 4, 35.6), zw_m("lm_flag", "#e2405b", 0.5), "-Y")
        for k in range(8):
            cyl("zw_lm_col%d" % k, 0.7, 12, (-17.5 + k * 5, y - 4.4, 6), Mw, 14)
        text("zw_lm_txt", label or "CITY HALL", (0, y - 4.2, 15.2), 1.8, zw_m("lm_txt", "#3a4a6b", 0.4), extrude=0.08)
    elif kind == "tower":
        box("zw_lm_body", (12, 12, 70), (0, y + 4, 35), zw_m("lm_tower", "#f2d7c0", 0.6), 0.2)
        cyl("zw_lm_clock", 4, 0.6, (0, y - 2.2, 58), zw_m("lm_clock", "#fffdf2", 0.4, emit="#fff2c0", estr=0.6), 32, rot=(90, 0, 0))
        cyl("zw_lm_spire", 7, 14, (0, y + 4, 77), zw_m("lm_spire", "#5a7bd6", 0.4), 4, r2=0.2, rot=(0, 0, 45))
        text("zw_lm_txt", label or "TOWER", (0, y - 2.2, 8), 1.6, zw_m("lm_txt", "#6b3a2a", 0.4), extrude=0.08)
    elif kind == "screen":
        box("zw_lm_frame", (34, 2, 22), (0, y, 26), zw_m("lm_frame", "#2b2f3a", 0.4, 0.4), 0.3)
        box("zw_lm_screen", (31, 0.3, 19), (0, y - 1.05, 26), zw_m("lm_screen", "#1e2a5a", 0.3, emit="#5fa8ff", estr=2.5), 0.02)
        text("zw_lm_txt", label or "BREAKING NEWS", (0, y - 1.3, 26), 2.6, zw_m("lm_scrtxt", "#ffffff", 0.3, emit="#ffffff", estr=4.0), extrude=0.02)
        for sx in (-12, 12):
            box("zw_lm_leg%d" % sx, (1.5, 1.5, 15), (sx, y, 7.5), zw_m("lm_frame", "#2b2f3a", 0.4, 0.4), 0.1)
    # flower beds + flags in front of every landmark
    for s in (-1, 1):
        cyl("zw_lm_bed%d" % s, 3.2, 1.0, (s * 15, y - 13, 0.5), zw_m("bedstone", "#efe7da", 0.7), 24)
        for k in range(3):
            zw_inst("flowers%d" % k, (s * 15 + (k - 1) * 1.6, y - 13 + (k % 2) * 0.8, 0.9), k * 50)
        cyl("zw_lm_fp%d" % s, 0.16, 12, (s * 21, y - 9, 6), zw_m("flagpole", "#dfe3ea", 0.3, 0.6), 8)
        card("zw_lm_fl%d" % s, 3.4, 2.2, (s * 21 + 1.75, y - 9, 10.6), zw_m("lmflag%d" % s, "#2f86fd" if s > 0 else "#ff4f7e", 0.5), "-Y")


def zw_downtown(t0, t1, dress):
    zw_sky_time(dress.get("time", "day"), dress.get("weather", "clear"))
    ZW_T["lanes"], ZW_T["xwalks"] = [((-7.3, 7.3), (-2.0, 182.0))], [(-0.2, 3.2), (151.3, 154.7)]
    zw_backdrop((0, 90))
    rnd = random.Random(11)
    # ground: plaza tiles + the street + the sidewalks
    box("zw_ground", (420, 420, 0.4), (0, 80, -0.2), zw_m("dt_ground", "#ded8cc", 0.9), 0)
    box("zw_road", (14, 200, 0.06), (0, 80, 0.03), zw_m("asphalt", "#474c5a", 0.85), 0)
    for k in range(20):
        box("zw_dash%d" % k, (0.35, 4, 0.02), (0, -12 + k * 10, 0.07), zw_m("dash_y", "#ffcf2a", 0.6), 0)
    Mline = zw_m("dash_w", "#fbfaf5", 0.6)
    for side in (-1, 1):
        box("zw_edge%d" % side, (0.25, 200, 0.02), (side * 6.3, 80, 0.07), Mline, 0)
        box("zw_walk%d" % side, (5, 200, 0.3), (side * 9.5, 80, 0.15), zw_m("sidewalk", "#ece8e1", 0.85), 0)
        box("zw_curb%d" % side, (0.4, 200, 0.36), (side * 7.1, 80, 0.18), zw_m("curb", "#cfc8bb", 0.8), 0.04)
    for cy in (1.5, 153.0):
        for k in range(7):
            box("zw_xw%d_%d" % (int(cy), k), (1.1, 3.4, 0.02), (-5.4 + k * 1.8, cy, 0.075), Mline, 0)
    # shops both sides (+ rooftops)
    signs = list(dress.get("signs") or []) + ZW_SIGNS
    roofs = []
    i, y = 0, 4.0
    while y < 150:
        w = rnd.choice([14, 16, 18])
        for side in (1, -1):
            h = rnd.choice([16, 19, 21, 24])
            zw_shop(i, side, y + w / 2, w, h, signs[i % len(signs)].upper()[:12])
            roofs.append((side, y + w / 2, h))
            i += 1
        y += w + 1.0
    # the back row (mid-rise blocks behind the shops) + the skyline (glass towers), the end of the street included
    k = 0
    for side in (-1, 1):
        yy = -4.0
        while yy < 172:
            w = rnd.choice([16, 18, 20])
            bh = rnd.choice([24, 28, 32, 36])
            lib = ZA_CITY[(k // 4) % len(ZA_CITY)] if k % 4 == 0 else (ZA_TALL[(k // 4) % len(ZA_TALL)] if k % 4 == 2 else None)
            if not (lib and zw_asset(lib, (side * 34, yy + w / 2, 0), -90 * side)):
                zw_block(k, side * 34, yy + w / 2, w, 12, bh)
            k += 1
            yy += w + 1.5
    for t in range(18):
        side = 1 if t % 2 == 0 else -1
        zw_tower_bg(t, side * (54 + (t // 2 % 2) * 26 + rnd.uniform(-3, 3)), -8 + (t // 2) * 24 + rnd.uniform(-4, 4), rnd.choice([60, 75, 90, 105, 120]), rnd.choice([14, 16, 18]))
    for t in range(6):
        zw_tower_bg(18 + t, -45 + t * 18 + rnd.uniform(-3, 3), 222 + (t % 2) * 24, rnd.choice([80, 95, 110, 130]), rnd.choice([16, 18, 20]))
    za_load(ZA_CITY + ZA_TALL + ["kaykit_trafficlight_a", "kcity_detail_parasol_a", "kcity_detail_parasol_b", "ktown_stall_red", "ktown_stall_green", "ktown_cart"] + ZA_FRUIT)
    # traffic lights at both crossings, cafe parasols on the sidewalks
    for tx, ty, r in ((7.9, -0.8, 180), (-7.9, 3.8, 0), (7.9, 151.0, 180), (-7.9, 155.0, 0)):
        zw_asset("kaykit_trafficlight_a", (tx, ty, 0.3), r)
    for k, (px, py) in enumerate(((-9.7, 18), (-9.7, 60), (9.7, 70), (-9.7, 112), (9.7, 124))):
        zw_asset("kcity_detail_parasol_a" if k % 2 else "kcity_detail_parasol_b", (px, py, 0.3), 0, 1.0)
    # rooftop billboards (the story's line first)
    bb = [dress.get("billboard")] if dress.get("billboard") else []
    bb += ["MEGA SALE", "FRESH PIZZA", "GO TEAM"]
    picks = [(1, 36), (-1, 78), (1, 112)]
    cols = [("#e23fa8", "#ffffff"), ("#7b3fe4", "#ffe14a"), ("#ff6a2a", "#ffffff")]
    for k, (sd, yt) in enumerate(picks):
        r = min([q for q in roofs if q[0] == sd], key=lambda q: abs(q[1] - yt))
        zw_billboard(k, sd * 19.0, r[1], r[2] + 0.6, sd, bb[k], cols[k][0], cols[k][1])
    # street furniture: trees, lamps, benches, hydrants, bins, planters
    for k in range(9):
        yy = 8 + k * 17
        for side in (-1, 1):
            zw_inst("tree" if k % 2 == 0 else "lamp", (side * 10.6, yy, 0.3))
        if k % 3 == 1:
            zw_inst("bench", (11.2, yy + 6, 0.3), 90)
            zw_inst("bench", (-11.2, yy + 6, 0.3), -90)
    for k in range(12):
        yy = 12 + k * 12.0
        for side in (-1, 1):
            if side == 1 and 20 < yy < 42:
                continue      # keep the close-up spot clear
            kind = ("hydrant", "planter", "bin")[(k + (side > 0)) % 3]
            zw_inst(kind, (side * 8.1, yy + side * 2.5, 0.3), 0)
    # the plaza (y < 0) with the fountain, enclosed by blocks
    box("zw_plaza", (60, 44, 0.12), (0, -24, 0.06), zw_m("plaza", "#f3d9c4", 0.8), 0)
    for k in range(5):
        box("zw_plz_ring%d" % k, (60 - k * 10, 0.4, 0.13), (0, -24 - 22 + 2 + k * 10, 0.07), zw_m("plaza_line", "#e6bfa3", 0.8), 0)
    cyl("zw_fnt_basin", 6, 1.2, (0, -26, 0.6), zw_m("fnt_stone", "#f6f1e8", 0.6), 40)
    cyl("zw_fnt_water", 5.5, 0.2, (0, -26, 1.15), zw_m("fnt_water", "#4fb8f0", 0.15, emit="#5fb8ee", estr=0.4), 40)
    cyl("zw_fnt_col", 0.7, 4.0, (0, -26, 2.8), zw_m("fnt_stone", "#f6f1e8", 0.6), 16)
    cyl("zw_fnt_bowl", 2.2, 0.6, (0, -26, 4.8), zw_m("fnt_stone", "#f6f1e8", 0.6), 24, r2=1.4)
    sphere("zw_fnt_spray", 1.4, (0, -26, 5.7), zw_m("fnt_spray", "#cdeeff", 0.1, emit="#bfe6ff", estr=0.8, alpha=0.6), (1, 1, 0.8), seg=16)
    for k, (bx, by, r) in enumerate(((-12, -16, 90), (12, -16, -90), (-12, -34, 90), (12, -34, -90))):
        zw_inst("bench", (bx, by, 0.12), r)
        zw_inst("tree2" if k % 2 else "tree", (bx * 1.8, by, 0.12))
    for k, (bx, by) in enumerate(((-8, -8), (8, -8), (8, -42), (-9, -44))):
        cyl("zw_plbed%d" % k, 2.2, 0.9, (bx, by, 0.45), zw_m("bedstone", "#efe7da", 0.7), 20)
        zw_inst("flowers%d" % (k % 3), (bx, by, 0.8), k * 40)
    for k, (bx, by) in enumerate(((-28, -4), (28, -4), (-28, -44), (28, -44))):
        zw_inst("lamp", (bx, by, 0.12))
    # market stalls with fruit, a hand cart
    for k, (sx, sy, aid) in enumerate(((21, -40, "ktown_stall_red"), (21, -14, "ktown_stall_green"))):
        if zw_asset(aid, (sx, sy, 0.12), -90):
            for q in range(6):
                zw_asset_fit(ZA_FRUIT[(q + k) % len(ZA_FRUIT)], (18.6, sy - 2.0 + q * 0.8, 2.2), 0.9, 0.9, q * 40)
    zw_asset("ktown_cart", (-22, -33, 0.12), 20, 0.8)
    # an ice-cream cart
    box("zw_cart", (2.6, 4.0, 2.2), (16, -28, 1.5), zw_m("cart", "#ff9ec0", 0.6), 0.15)
    cyl("zw_cart_pole", 0.08, 4.6, (16, -28, 4.6), zw_m("lamppost", "#2f3a4a", 0.4, 0.6), 6)
    cyl("zw_cart_umb", 3.2, 1.2, (16, -28, 7.2), zw_m("umb", "#ffcf1f", 0.6), 12, r2=0.15)
    for side in (-1, 1):
        for k, yy in enumerate((-35.0, -15.0)):
            zw_block(40 + k + (side > 0) * 2, side * 37, yy, 19, 12, rnd.choice([18, 22, 26]))
    # cars on the street (the close-up spot's lane kept clear)
    if "cars" in (dress.get("props") or ["cars"]):
        # west lane drives +Y, east lane -Y; nobody drives into a tested camera or a target (east-lane cars start at 66+)
        zw_life_cars(dress, ((-3.5, 12, "#22b5a3", 0, False), (-3.5, 50, "#7b5cf6", 0, True), (-3.5, 66, "#f6f1e7", 0, True), (-3.5, 84, "#ffd23f", 0, True),
                 (-3.5, 102, "#4cbf45", 0, True), (-3.5, 120, "#e2405b", 0, True), (-3.5, 146, "#e2405b", 0, False),
                 (3.5, 66, "#3d8bfd", 180, True), (3.5, 82, "#ff8c2a", 180, True), (3.5, 98, "#2f86fd", 180, True), (3.5, 114, "#ff6fa8", 180, True),
                 (3.5, 130, "#22b5a3", 180, True)), t0, t1)
    zw_landmark(dress.get("landmark", "bank"), (dress.get("landmark_text") or "").upper()[:16])
    if "blimp" in (dress.get("props") or []):
        zw_blimp((dress.get("blimp_text") or "ZYVO").upper()[:10])
    n = zw_life_n(dress, 24)
    zw_people(t0, t1, n, [((8.4, 11.6), (46, 140), 0.3), ((-11.6, -8.4), (14, 140), 0.3), ((8.4, 11.6), (8, 22), 0.3),
                          ((6, 13), (-44, -6), 0.12), ((-26, -14), (-20, -6), 0.12), ((8.5, 11.5), (146, 166), 0.3)], modes=zw_life_modes(dress, ("walk", "walk", "stand", "talk", "walk")))
    zw_life_extras(dress, t0, t1, ((-20, 20), (0, 80)))
    if n > 0:
        zw_sitters(t0, t1, [(11.2, 31, 0.3, 90), (-11.2, 82, 0.3, -90), (11.2, 133, 0.3, 90), (-12, -16, 0.12, 90), (12, -34, 0.12, -90)])
    zw_weather(dress.get("weather", "clear"))
    if zw_night():
        for k in range(6):
            light("zw_nl%d" % k, "POINT", ((-1) ** k * 9, 10 + k * 25, 7), 900, (1.0, 0.82, 0.55), 1.5)
    return dict(street=(0, 40, 0), sidewalk_east=(9.5, 36, 0.3), sidewalk_west=(-9.5, 36, 0.3), plaza=(0, -12, 0.12), fountain=(0, -26, 0), landmark=(0, 165, 0))


# ---------------------------------------------------------------- SUBURB (street along X)
# copy mode: the reference's white / blue-grey house fronts
ZW_HOUSE_COPY = ["#e9edf3", "#cdd5e2", "#dde2ea", "#b9c4d6", "#f2f4f7"]
ZW_HOUSE = ["#ffd27f", "#9fe3c8", "#c3a8f5", "#ff9fbf", "#fff08a", "#8fcaf7", "#ffb48a", "#b5ec8f", "#f4f1ea"]
ZW_ROOF = ["#a8483a", "#4a5568", "#6b4f8a", "#3f6f8f", "#7a4a2e"]


def zw_house(i, x, side, col):
    """side +1: north of the street (front faces -Y), -1: south (front faces +Y)"""
    y = 24.0 * side
    fy = y - side * 6.0          # the front wall
    two = i % 3 != 1
    H = 13.0 if two else 9.0
    box("zw_h%d" % i, (14, 12, H), (x, y, H / 2), zw_m("house%d" % (i % len(ZW_HOUSE)), col, 0.7), 0.12)
    Mtrim = zw_m("trimw", "#ffffff", 0.5)
    box("zw_hbase%d" % i, (14.3, 12.3, 0.8), (x, y, 0.4), zw_m("hbase", "#d9cfc0", 0.8), 0.04)
    Mr = zw_m("roof%d" % (i % len(ZW_ROOF)), ZW_ROOF[i % len(ZW_ROOF)], 0.65)
    for s in (-1, 1):
        box("zw_hr%d_%d" % (i, s), (15.4, 7.6, 0.6), (x, y + s * 3.1, H + 2.0), Mr, 0.1, rot=(-38 * s, 0, 0))
    box("zw_hgable%d" % i, (13.6, 0.4, 0.4), (x, y, H + 4.3), Mr, 0.1)
    if i % 2 == 0:
        box("zw_hchim%d" % i, (1.4, 1.4, 4.4), (x + (4.5 if i % 4 == 0 else -4.5), y + 2, H + 3.4), zw_brick("chim"), 0.08)
    # porch (deck, posts, roof) or a small stoop with a canopy
    if i % 4 != 3:
        box("zw_hdeck%d" % i, (10, 3.6, 0.6), (x, fy - side * 1.8, 0.3), zw_m("porch", "#e9dcc6", 0.7), 0.05)
        for px in (-4.6, 4.6):
            cyl("zw_hpost%d_%d" % (i, int(px)), 0.22, 6.0, (x + px, fy - side * 3.3, 3.4), Mtrim, 10)
        box("zw_hproof%d" % i, (10.8, 4.2, 0.35), (x, fy - side * 1.9, 6.5), Mtrim, 0.05)
        box("zw_hrail%d" % i, (3.2, 0.15, 0.15), (x - 3.0, fy - side * 3.3, 1.6), Mtrim, 0.0)
        box("zw_hrail2%d" % i, (3.2, 0.15, 0.15), (x + 3.0, fy - side * 3.3, 1.6), Mtrim, 0.0)
    else:
        box("zw_hdeck%d" % i, (4, 2.4, 0.5), (x, fy - side * 1.2, 0.25), zw_m("porch", "#e9dcc6", 0.7), 0.05)
        box("zw_hcan%d" % i, (4.4, 2.2, 0.3), (x, fy - side * 1.1, 5.4), Mr, 0.05)
    box("zw_hdoor%d" % i, (2.2, 0.25, 4.0), (x, fy - side * 0.08, 2.6), zw_m("hdoor%d" % (i % 3), ["#c0392b", "#2e6f95", "#3e7b4f"][i % 3], 0.5), 0.05)
    lit = zw_time() in ("night", "sunset") and not zw_copy() and zw_win_lit(i)
    sphere("zw_hplamp%d" % i, 0.3, (x + 1.7, fy - side * 0.3, 4.6), zw_m("plamp" + ("_on" if lit else ""), "#fff3c4", 0.3, emit="#ffd27a", estr=2.0 if lit else 0.4), seg=8)
    Msh = zw_m("shutter%d" % (i % 3), ["#2e6f95", "#3e7b4f", "#8a3a4a"][i % 3], 0.6)
    for wx in (-4.2, 4.2):
        box("zw_hwin%d_%d" % (i, int(wx)), (2.6, 0.2, 2.4), (x + wx, fy - side * 0.06, 3.2), zw_glass("hwin", i), 0.02)
        box("zw_hwinf%d_%d" % (i, int(wx)), (3.0, 0.22, 0.3), (x + wx, fy - side * 0.08, 4.5), Mtrim, 0.02)
        box("zw_hwins%d_%d" % (i, int(wx)), (3.0, 0.4, 0.22), (x + wx, fy - side * 0.15, 1.9), Mtrim, 0.0)
        for s in (-1, 1):
            box("zw_hsh%d_%d_%d" % (i, int(wx), s), (0.7, 0.18, 2.6), (x + wx + s * 1.75, fy - side * 0.1, 3.2), Msh, 0.0)
        zh = 7.1 if not two else 9.2
        box("zw_hwin2%d_%d" % (i, int(wx)), (2.2, 0.2, 2.0 if not two else 2.6), (x + wx, fy - side * 0.06, zh), zw_glass("hwin", i), 0.02)
        box("zw_hwin2f%d_%d" % (i, int(wx)), (2.6, 0.22, 0.25), (x + wx, fy - side * 0.08, zh + (1.15 if not two else 1.45)), Mtrim, 0.02)
    if two:
        box("zw_hwin3%d" % i, (1.8, 0.2, 2.2), (x, fy - side * 0.06, 9.2), zw_glass("hwin", i), 0.02)
    # a garage on the one-storey houses
    if not two:
        box("zw_hgar%d" % i, (6.2, 10, 6.4), (x + 10.1, y + side * 0.6, 3.2), zw_m("house%d" % (i % len(ZW_HOUSE)), col, 0.7), 0.1)
        box("zw_hgarr%d" % i, (6.8, 10.6, 0.5), (x + 10.1, y + side * 0.6, 6.6), Mr, 0.05)
        gf = y + side * 0.6 - side * 5.0          # the garage front
        box("zw_hgard%d" % i, (5.0, 0.25, 4.6), (x + 10.1, gf - side * 0.1, 2.3), zw_pattern("garage", "#f4f4f2", "#e6e6e2", "#cfcfc8", 2.0, 4.0, 0.9, 0.05, 0.6, 0.0, 0.0, 0.0), 0.02)
        box("zw_hdrive%d" % i, (5.0, abs(gf - side * 6.0), 0.08), (x + 10.1, (gf + side * 6.0) / 2, 0.05), zw_m("path", "#d9d0c0", 0.8), 0)
    # lawn, path, fence, mailbox, hedges, flowers, trees
    box("zw_hpath%d" % i, (2.4, 9, 0.08), (x, fy - side * 8.2, 0.05), zw_m("path", "#d9d0c0", 0.8), 0)
    Mf = zw_m("fence", "#fbfbf6", 0.6)
    fyy = y - side * 13.0
    for k in range(-6, 7):
        if abs(k) <= 1:
            continue
        box("zw_hf%d_%d" % (i, k), (0.3, 0.16, 2.2), (x + k * 1.0, fyy, 1.1), Mf, 0.03)
    for zz in (0.8, 1.7):
        for s in (-1, 1):
            box("zw_hfr%d_%d_%d" % (i, int(zz * 10), s), (4.6, 0.12, 0.18), (x + s * 4.3, fyy - side * 0.12, zz), Mf, 0.01)
    mx = x + 6.6
    cyl("zw_hmbp%d" % i, 0.12, 2.6, (mx, fyy - side * 0.6, 1.3), zw_m("mbpost", "#6b4a3a", 0.7), 8)
    box("zw_hmb%d" % i, (0.9, 1.6, 0.9), (mx, fyy - side * 0.6, 2.9), zw_m("mailbox", "#3a5a8a", 0.4, 0.3), 0.25)
    box("zw_hmbf%d" % i, (0.08, 0.3, 0.8), (mx + 0.5, fyy - side * 0.6, 3.2), zw_m("mbflag", "#e2405b", 0.5), 0.02)
    Mh = zw_m("hedge", "#3a9e3c", 0.85)
    for s in (-1, 1):
        box("zw_hhedge%d_%d" % (i, s), (3.0, 1.2, 1.6), (x + s * 4.6, fy - side * (4.4 if i % 4 != 3 else 1.0), 0.8), Mh, 0.4)
        zw_inst("flowers%d" % ((i + (s > 0)) % 3), (x + s * 3.6, fyy + side * 1.6, 0.0), i * 37 + s * 20, 0.9)
    if not (i % 3 == 0 and zw_asset("ktown_tree_high_round" if i % 2 else "ktown_tree", (x - 7.5, y - side * 10, 0.0), i * 40, 0.55)):
        zw_inst("tree" if i % 2 else "tree2", (x - 7.5, y - side * 10, 0.0), 0, 1.15)


def zw_suburb(t0, t1, dress):
    zw_sky_time(dress.get("time", "day"), dress.get("weather", "clear"))
    zw_backdrop((0, 20))
    ZW_T["lanes"], ZW_T["xwalks"] = [((-160.0, 160.0), (-6.2, 6.2))], []
    za_load(["ktown_tree", "ktown_tree_high_round", "ktown_tree_high"] + ZA_CARS)
    g = ZW_SKY.get(zw_time(), ZW_SKY["day"])["grass"]
    box("zw_lawn", (400, 400, 0.4), (0, 0, -0.2), zw_m("grass" + g[1:], g, 0.9), 0)
    box("zw_sroad", (300, 12, 0.06), (0, 0, 0.03), zw_m("asphalt", "#474c5a", 0.85), 0)
    for k in range(30):
        box("zw_sdash%d" % k, (4, 0.3, 0.02), (-145 + k * 10, 0, 0.07), zw_m("dash_y", "#ffcf2a", 0.6), 0)
    for side in (-1, 1):
        box("zw_sedge%d" % side, (300, 0.22, 0.02), (0, side * 5.5, 0.07), zw_m("dash_w", "#fbfaf5", 0.6), 0)
        box("zw_swalk%d" % side, (300, 3.6, 0.25), (0, side * 8.0, 0.12), zw_m("sidewalk", "#ece8e1", 0.85), 0)
    for k, x in enumerate((-120, -90, -60, -30, 0, 30, 60, 90, 120)):
        pal = ZW_HOUSE_COPY if zw_copy() else ZW_HOUSE
        zw_house(2 * k, x, 1, pal[k % len(pal)])
        zw_house(2 * k + 1, x + 12, -1, pal[(k + 4) % len(pal)])
    rnd = random.Random(21)
    for side in (-1, 1):
        for k in range(22):
            tx, ty, tr, ts = -130 + k * 12 + rnd.uniform(-3, 3), side * rnd.uniform(42, 56), rnd.uniform(0, 360), rnd.uniform(1.1, 1.6)
            if not (k % 4 == 1 and zw_asset("ktown_tree_high", (tx, ty, 0.0), tr, ts * 0.5)):
                zw_inst("tree2" if k % 3 else "tree", (tx, ty, 0.0), tr, ts)
    for k in range(12):
        zw_inst("lamp", (-110 + k * 20, 10.2, 0.2))
    if "cars" in (dress.get("props") or ["cars"]):
        zw_life_cars(dress, ((-14, 3.2, "#e2405b", 90, True), (22, -3.2, "#3d8bfd", -90, True), (48, 3.2, "#ffcf1f", 90, True), (-52, -3.2, "#22b5a3", -90, True)), t0, t1)
    if "blimp" in (dress.get("props") or []):
        zw_blimp((dress.get("blimp_text") or "ZYVO").upper()[:10], (20, 80, 50))
    n = zw_life_n(dress, 10)
    zw_people(t0, t1, n, [((16, 60), (7.0, 9.0), 0.25), ((24, 36), (12, 14), 0.0), ((0, 60), (-9.0, -7.0), 0.25), ((-80, -20), (-9.0, -7.0), 0.25),
                          ((-36, -24), (12, 14), 0.0), ((-70, -22), (7.0, 9.0), 0.25)], seed=12, modes=zw_life_modes(dress, ("walk", "talk", "stand", "walk")))
    zw_life_extras(dress, t0, t1, ((-40, 40), (-10, 30)))
    zw_weather(dress.get("weather", "clear"), ((-60, 60), (-40, 40)))
    if zw_night():
        for k in range(0 if (zw_copy() or ZW_T.get("windows") == "dark") else 5):
            light("zw_snl%d" % k, "POINT", (-60 + k * 30, 10, 7), 800, (1.0, 0.82, 0.55), 1.5)
    return dict(street=(0, 0, 0), porch=(0, 15.5, 0.6), sidewalk=(0, 8, 0.25), mailbox=(6.6, 11.4, 0), yard=(0, 13, 0))


# ---------------------------------------------------------------- BRICK CITY (street along Y)
def zw_apartment(i, side, y, w, h):
    fx = 11.0 * side
    cx = fx + side * 8.0
    base = ["#b0533c", "#93452f", "#bf6a4a", "#a35a46", "#c97a52"][i % 5]
    box("zw_apt%d" % i, (16, w, h), (cx, y, h / 2), zw_brick("apt%d" % (i % 5), base), 0.05)
    box("zw_aptcap%d" % i, (16.6, w + 0.6, 0.8), (cx, y, h + 0.4), zw_m("aptcap", "#d8cfc4", 0.7), 0.05)
    lit_share = 0.85 if zw_night() else (0.45 if zw_time() == "sunset" else 0.3)
    Gl = zw_m("aptlit", "#ffd38a", 0.3, emit="#ffbf66", estr=1.8 if not zw_night() else 2.6)
    Gd = zw_m("aptdark", "#3d4f66", 0.12, 0.2)
    Mf = zw_m("aptframe", "#efe6d8", 0.6)
    Mb = zw_m("balcony", "#2f343c", 0.4, 0.5)
    rnd = random.Random(100 + i)
    floors = int((h - 2) / 4.2)
    escape = i % 2 == 0
    for fl in range(floors):
        z = 2.6 + fl * 4.2
        for k in (-1, 0, 1):
            yy = y + k * w * 0.3
            if fl == 0 and (k == -1 or (i % 3 == 0 and k >= 0)):
                continue      # the door / the small shopfront
            box("zw_awf%d_%d_%d" % (i, fl, k), (0.14, 2.7, 3.1), (fx - side * 0.03, yy, z), Mf, 0.0)
            box("zw_aw%d_%d_%d" % (i, fl, k), (0.2, 2.2, 2.6), (fx - side * 0.06, yy, z), Gl if rnd.random() < lit_share else Gd, 0.0)
            box("zw_aws%d_%d_%d" % (i, fl, k), (0.5, 2.8, 0.25), (fx - side * 0.2, yy, z - 1.55), Mf, 0.0)
            if fl >= 1 and rnd.random() < 0.18:
                zw_inst("ac", (fx - side * 0.7, yy, z - 1.4), 90, 0.6)
            elif fl >= 1 and rnd.random() < 0.15:
                box("zw_afb%d_%d_%d" % (i, fl, k), (0.7, 2.4, 0.5), (fx - side * 0.45, yy, z - 1.2), zw_m("flowerbox", "#6b4a3a", 0.7), 0.04)
                for q in range(4):
                    sphere("zw_afl%d_%d_%d_%d" % (i, fl, k, q), 0.22, (fx - side * 0.45, yy - 0.9 + q * 0.6, z - 0.8), zw_m("flower" + ("ff5fa2", "ffd23f")[q % 2], ("#ff5fa2", "#ffd23f")[q % 2], 0.5), seg=8)
        # a fire escape (even buildings) or balconies (odd ones)
        ye = y + w * 0.3
        if escape and fl >= 1:
            box("zw_fe%d_%d" % (i, fl), (2.4, w * 0.42, 0.18), (fx - side * 1.3, ye, z - 1.7), Mb, 0.0)
            box("zw_fer%d_%d" % (i, fl), (0.1, w * 0.42, 0.1), (fx - side * 2.45, ye, z - 0.5), Mb, 0.0)
            for q in range(5):
                cyl("zw_febr%d_%d_%d" % (i, fl, q), 0.05, 1.2, (fx - side * 2.45, ye - w * 0.2 + q * w * 0.1, z - 1.1), Mb, 4)
            if fl + 1 < floors:
                span = w * 0.34
                d = 1 if fl % 2 else -1
                ang = math.degrees(math.atan2(4.2, span))
                box("zw_fes%d_%d" % (i, fl), (0.9, math.hypot(span, 4.2), 0.14), (fx - side * 1.3, ye, z - 1.7 + 2.1), Mb, 0.0, rot=(ang * d, 0, 0))
        elif not escape and fl >= 2 and fl % 2 == 0:
            box("zw_abal%d_%d" % (i, fl), (2.6, w * 0.5, 0.3), (fx - side * 1.3, y, z - 1.7), Mb, 0.04)
            for k in range(6):
                cyl("zw_abr%d_%d_%d" % (i, fl, k), 0.06, 1.4, (fx - side * 2.5, y - w * 0.24 + k * w * 0.096, z - 0.9), Mb, 6)
            box("zw_abrt%d_%d" % (i, fl), (0.12, w * 0.5, 0.12), (fx - side * 2.5, y, z - 0.2), Mb, 0.01)
    box("zw_adoor%d" % i, (0.3, 2.6, 4.2), (fx - side * 0.1, y - w * 0.3, 2.1), zw_m("aptdoor", "#2f4a3a", 0.5), 0.05)
    box("zw_astoop%d" % i, (1.6, 3.4, 0.6), (fx - side * 0.8, y - w * 0.3, 0.3), zw_m("stoop", "#c9c0b4", 0.8), 0.04)
    # a drain pipe, a street poster, a small lit shopfront on every third building
    cyl("zw_apipe%d" % i, 0.22, h, (fx - side * 0.3, y + w / 2 - 0.6, h / 2), zw_m("pipe", "#4a5a52", 0.5, 0.4), 8)
    pc = ["#ff4f7e", "#ffcf1f", "#22b5a3", "#7b5cf6", "#2f86fd"][i % 5]
    card("zw_apost%d" % i, 1.6, 2.2, (fx - side * 0.04, y - w * 0.15, 3.0), zw_m("poster" + pc[1:], pc, 0.6), "-X" if side > 0 else "+X")
    card("zw_aposti%d" % i, 1.0, 0.5, (fx - side * 0.05, y - w * 0.15, 3.3), zw_m("postin", "#ffffff", 0.6), "-X" if side > 0 else "+X")
    if i % 3 == 0 or (zw_night() and i % 3 == 1):   # night: two of every three shopfronts lit
        box("zw_ashop%d" % i, (0.2, w * 0.36, 3.0), (fx - side * 0.07, y + w * 0.12, 2.0), zw_m("shoplit", "#ffd9a0", 0.3, emit="#ffc070", estr=1.6), 0.0)
        a = ZW_AWN[i % len(ZW_AWN)][0]
        for k in range(5):
            box("zw_aawn%d_%d" % (i, k), (2.4, w * 0.4 / 5, 0.14), (fx - side * 1.1, y + w * 0.12 - w * 0.16 + k * w * 0.08, 4.4), zw_m("awn" + (a if k % 2 == 0 else "#ffffff")[1:], a if k % 2 == 0 else "#ffffff", 0.6), 0.0, rot=(0, -18 * side, 0))


def zw_brick_city(t0, t1, dress):
    zw_sky_time(dress.get("time", "day"), dress.get("weather", "clear"))
    zw_backdrop((0, 90))
    za_load(["kaykit_box_a", "kaykit_box_b", "kaykit_trash_a", "kaykit_dumpster"])
    ZW_T["lanes"], ZW_T["xwalks"] = [((-7.2, 7.2), (-30.0, 200.0))], []
    box("zw_bground", (400, 400, 0.4), (0, 80, -0.2), zw_m("bc_ground", "#8f8a84", 0.9), 0)
    box("zw_broad", (14, 220, 0.06), (0, 80, 0.03), zw_m("cobble", "#55555c", 0.9), 0)
    for k in range(22):
        box("zw_bdash%d" % k, (0.3, 3, 0.02), (0, -20 + k * 10, 0.07), zw_m("dash_w", "#fbfaf5", 0.6), 0)
    for side in (-1, 1):
        box("zw_bwalk%d" % side, (4, 220, 0.3), (side * 9, 80, 0.15), zw_m("bc_walk", "#bdb5aa", 0.85), 0)
    rnd = random.Random(5)
    i, y = 0, 0.0
    alley_s, alley_n, roofs = 0.0, 200.0, []
    while y < 150:
        w = rnd.choice([16, 18, 20])
        for side in (1, -1):
            hh = rnd.choice([18, 22, 26, 30])
            if not (side == -1 and y < 84 and y + w > 60):   # the ALLEY on the west side (y 60..84 kept open)
                zw_apartment(i, side, y + w / 2, w, hh)
                roofs.append((side * 19.0, y + w / 2, hh))
                if side == -1 and y + w <= 60:
                    alley_s = max(alley_s, y + w)
                if side == -1 and y >= 84:
                    alley_n = min(alley_n, y)
            i += 1
        y += w + 0.6
    # rooftop water towers + AC boxes
    for k, r in enumerate(roofs):
        if k % 4 == 1:
            zw_inst("tank", (r[0] + (2 if r[0] > 0 else -2), r[1], r[2] + 0.8))
        elif k % 4 == 3:
            zw_inst("ac", (r[0], r[1] - 3, r[2] + 0.8))
    # street: puddles, manholes, trash bags, crates, hydrants
    Mp = zw_m("puddle", "#3d4a5c", 0.03, 0.0)
    for k, (px, py, pr) in enumerate(((-3.2, 22, 1.8), (4.0, 47, 1.3), (-1.5, 78, 2.3), (3.0, 104, 1.6), (-4.0, 130, 1.4), (1.5, 8, 1.0))):
        cyl("zw_pud%d" % k, pr, 0.03, (px, py, 0.075), Mp, 20)
    for k, py in enumerate((30, 66, 96, 126)):
        cyl("zw_manh%d" % k, 1.0, 0.04, (2.2 * (-1) ** k, py, 0.08), zw_m("manhole", "#3a3a3e", 0.6, 0.5), 20)
    Mbag = zw_m("trashbag", "#22262b", 0.35)
    for k, (bx, by) in enumerate(((-8.4, 18), (8.6, 56), (-8.5, 98), (8.4, 88), (-8.4, 128))):
        for q in range(3):
            sphere("zw_bag%d_%d" % (k, q), 0.6, (bx + (q % 2) * 0.5, by + q * 0.7, 0.85), Mbag, (1, 1, 0.85), seg=10)
        box("zw_bcr%d" % k, (1.4, 1.4, 1.4), (bx, by - 1.6, 1.0), zw_m("crate", "#a07a4a", 0.8), 0.06)
        zw_asset("kaykit_box_a" if k % 2 else "kaykit_box_b", (bx, by + 2.8, 0.3), k * 35)
        zw_asset("kaykit_trash_a", (bx, by - 3.4, 0.3), k * 50)
    for k, (hx, hy) in enumerate(((8.3, 14), (-8.3, 46), (8.3, 112))):
        zw_inst("hydrant", (hx, hy, 0.3))
    # the alley: dumpsters, crates, trash, barrels, pipes, posters, a lit door, puddles, a fire escape
    a0, a1 = alley_s, alley_n
    box("zw_alleyfloor", (24, a1 - a0, 0.1), (-22, (a0 + a1) / 2, 0.05), zw_m("bc_walk", "#bdb5aa", 0.85), 0)
    box("zw_alleyback", (2, a1 - a0 + 2, 24), (-34, (a0 + a1) / 2, 12), zw_brick("apt1", "#93452f"), 0.05)
    for s, yw in ((1, a0 + 0.35), (-1, a1 - 0.35)):
        box("zw_alleyside%d" % s, (23, 0.7, 20), (-22.5, yw, 10), zw_brick("apt3", "#a35a46"), 0.02)
        Gl = zw_m("aptlit", "#ffd38a", 0.3, emit="#ffbf66", estr=1.8)
        for fl in range(4):
            for k in range(3):
                zz, xx = 6.6 + fl * 4.2, -16 - k * 6
                box("zw_alw%d_%d_%d" % (s, fl, k), (2.2, 0.2, 2.6), (xx, yw + s * 0.4, zz), Gl if (fl + k + s) % 3 == 0 else zw_m("aptdark", "#3d4f66", 0.12, 0.2), 0.0)
                box("zw_alwf%d_%d_%d" % (s, fl, k), (2.7, 0.14, 3.1), (xx, yw + s * 0.36, zz), zw_m("aptframe", "#efe6d8", 0.6), 0.0)
        for q in range(3):
            cyl("zw_alp%d_%d" % (s, q), 0.2, 20, (-21, yw + s * 0.6, 3.6 + q * 1.1), zw_m("pipe", "#4a5a52", 0.5, 0.4), 8, rot=(0, 90, 0))
        cyl("zw_alpv%d" % s, 0.25, 20, (-13, yw + s * 0.6, 10), zw_m("pipe", "#4a5a52", 0.5, 0.4), 8)
        zw_inst("ac", (-27, yw + s * 1.0, 7.0), 0, 0.8)
    # the fire escape on the south alley wall
    Mb = zw_m("balcony", "#2f343c", 0.4, 0.5)
    for fl in range(3):
        box("zw_alfe%d" % fl, (7, 2.4, 0.18), (-24, a1 - 1.9, 8.6 + fl * 4.2), Mb, 0.0)
        box("zw_alfer%d" % fl, (7, 0.1, 0.1), (-24, a1 - 3.05, 9.8 + fl * 4.2), Mb, 0.0)
    box("zw_dump0", (5, 3, 3), (-17, a1 - 2.8, 1.5), zw_m("dumpster", "#2e7a4a", 0.5, 0.3), 0.15)
    box("zw_dump0l", (5.2, 3.2, 0.25), (-17, a1 - 2.8, 3.1), zw_m("dumplid", "#1f5a36", 0.5, 0.3), 0.05)
    box("zw_dump1", (4, 3, 3), (-22.6, a1 - 2.8, 1.5), zw_m("dumpster2", "#2f6fae", 0.5, 0.3), 0.15)
    for k in range(4):
        box("zw_crate%d" % k, (1.6, 1.6, 1.6), (-26.5 - k * 1.7, a1 - 2.0, 0.8 + (k == 1) * 1.6), zw_m("crate", "#a07a4a", 0.8), 0.06)
    for k in range(4):
        sphere("zw_abag%d" % k, 0.7, (-31.0 + (k % 2) * 0.9, 69.6 - k * 0.7, 0.7), Mbag, (1, 1, 0.85), seg=10)
    for k in range(2):
        cyl("zw_barrel%d" % k, 0.8, 2.2, (-31.5 + k * 1.8, 66.0, 1.1), zw_m("barrel", "#c0552f", 0.6, 0.2), 14)
    for k, (qx, qy, qz, aid) in enumerate(((-31.4, 77.6, 0.1, "kaykit_box_a"), (-31.4, 79.8, 0.1, "kaykit_box_b"), (-31.4, 78.6, 1.85, "kaykit_box_b"))):
        zw_asset(aid, (qx, qy, qz), k * 25)
    zw_asset("kaykit_dumpster", (-28.0, a0 + 2.4, 0.1), 0)
    box("zw_aldoor", (0.3, 2.8, 4.6), (-32.9, 74, 2.3), zw_m("aptdoor", "#2f4a3a", 0.5), 0.05)
    sphere("zw_aldlamp", 0.35, (-32.6, 74, 5.4), zw_m("plamp_on", "#fff3c4", 0.3, emit="#ffd27a", estr=5.0), seg=10)
    light("zw_aldlight", "POINT", (-31.8, 74, 5.2), 220, (1.0, 0.8, 0.55), 0.5)
    for k, (py, pz, pc) in enumerate(((69.5, 3.8, "#ff4f7e"), (79, 4.2, "#ffcf1f"), (77.2, 7.0, "#22b5a3"))):
        card("zw_alpost%d" % k, 1.8, 2.4, (-32.92, py, pz), zw_m("poster" + pc[1:], pc, 0.6), "+X")
        card("zw_alposti%d" % k, 1.1, 0.6, (-32.9, py, pz + 0.3), zw_m("postin", "#ffffff", 0.6), "+X")
    for k, (px, py, pr) in enumerate(((-15, 70, 1.2), (-26, 77, 1.5))):
        cyl("zw_apud%d" % k, pr, 0.03, (px, py, 0.115), Mp, 18)
    # factory with banded smokestacks at the end of the street
    box("zw_factory", (60, 24, 16), (0, 190, 8), zw_brick("factory", "#7e3e30"), 0.05)
    for k, sx in enumerate((-16, 4, 18)):
        hs = 34 + k * 4
        cyl("zw_stack%d" % k, 2.2, hs, (sx, 194, 17 + k * 2), zw_brick("stack", "#a8483a"), 24)
        for b in range(3):
            cyl("zw_stackb%d_%d" % (k, b), 2.3, 1.6, (sx, 194, 17 + k * 2 + hs * 0.5 - 3 - b * 6), zw_m("stackband", "#f2efe8", 0.6), 24)
        for s in range(4):
            sphere("zw_smoke%d_%d" % (k, s), 3 + s * 1.2, (sx + s * 1.5, 194 + s, 36 + k * 4 + s * 4.5), zw_m("smoke", "#d8d5d0", 0.95, alpha=0.8), seg=12)
    text("zw_fac_txt", (dress.get("landmark_text") or "WORKS").upper()[:14], (0, 177.8, 13), 2.4, zw_m("factxt", "#f3ead8", 0.6), extrude=0.06)
    # bunting across the street
    if "bunting" in (dress.get("props") or ["bunting"]):
        cols = ["#e2405b", "#ffd23f", "#3d8bfd", "#3fb6a8", "#ffffff"]
        for r, yy in enumerate((30, 62, 100)):
            cyl("zw_bline%d" % r, 0.05, 22, (0, yy, 13), zw_m("bline", "#333333", 0.6), 6, rot=(0, 90, 0))
            for k in range(12):
                poly_extrude("zw_flag%d_%d" % (r, k), [(-0.7, 0), (0.7, 0), (0, -1.4)], 0.05, (-10 + k * 1.8, yy, 13), zw_m("bunt%d" % (k % 5), cols[k % 5], 0.6), rot=(90, 0, 0))
    for k in range(8):
        if k != 3:      # the alley mouth stays open
            zw_inst("lamp", ((-1) ** k * 9.8, 6 + k * 20, 0.3))
    if "cars" in (dress.get("props") or []):
        W.car("zw_bcar0", (3.5, 50, 0.06), "#2f4a7a", rot=180)
    if "blimp" in (dress.get("props") or []):
        zw_blimp((dress.get("blimp_text") or "ZYVO").upper()[:10], (-25, 100, 60))
    n = zw_life_n(dress, 16)
    zw_people(t0, t1, n, [((8.0, 10.6), (48, 140), 0.3), ((-10.6, -8.0), (12, 56), 0.3), ((-10.6, -8.0), (88, 140), 0.3),
                          ((8.0, 10.6), (8, 28), 0.3), ((-27, -25), (79, 82), 0.1)], seed=9, modes=zw_life_modes(dress, ("walk", "stand", "talk", "walk")))
    zw_life_extras(dress, t0, t1, ((-20, 20), (0, 80)))
    zw_weather(dress.get("weather", "clear"))
    if zw_night() and ZW_T.get("_std") and n > 0 and "busy" not in dress:
        zw_people(t0, t1, 3, [((7.6, 10.4), (6, 20), 0.3), ((-10.4, -7.6), (6, 20), 0.3), ((-3.0, 3.0), (10, 18), 0.0)], seed=23, modes=("walk", "walk", "talk"))
    if zw_night():
        for k in range(5):
            light("zw_bnl%d" % k, "POINT", ((-1) ** k * 9, 10 + k * 30, 7), 900, (1.0, 0.78, 0.5), 1.5)
    return dict(street=(0, 40, 0), stoop=(7.6, 40, 0.3), alley=(-18, 74, 0), factory=(0, 170, 0), sidewalk_east=(9, 40, 0.3), sidewalk_west=(-9, 40, 0.3))


# ---------------------------------------------------------------- INTERIORS (each at the origin; open toward -Y)
def zw_world_room():
    zw_world([(0.0, (0.9, 0.86, 0.8)), (1.0, (0.9, 0.86, 0.8))], (1.0, 0.95, 0.88), 0.55)


def zw_win_back(name, x, z, w, h, d, curtain="#e2725b"):
    """a window on the back wall (sky behind it), frame, sill, curtains on a rod"""
    yb = d / 2 - 0.16
    lit = zw_night()
    card("zw_%s_sky" % name, w, h, (x, yb - 0.01, z), zw_m("roomsky" + ("_n" if lit else ""), "#1b2850" if lit else "#9fd4ff", 0.2, emit="#24346a" if lit else "#a8dcff", estr=0.6 if lit else 1.5), "-Y")
    Mf = zw_m("trimw", "#ffffff", 0.5)
    for dx in (-w / 2, 0, w / 2):
        box("zw_%s_mv%d" % (name, int(dx * 10)), (0.22, 0.3, h + 0.2), (x + dx, yb - 0.1, z), Mf, 0.0)
    for dz in (-h / 2, 0, h / 2):
        box("zw_%s_mh%d" % (name, int(dz * 10)), (w + 0.4, 0.3, 0.22), (x, yb - 0.1, z + dz), Mf, 0.0)
    box("zw_%s_sill" % name, (w + 1.0, 0.7, 0.2), (x, yb - 0.35, z - h / 2 - 0.2), Mf, 0.02)
    Mc = zw_m("curtain" + curtain[1:], curtain, 0.9)
    for s in (-1, 1):
        box("zw_%s_cur%d" % (name, s), (1.1, 0.4, h + 1.4), (x + s * (w / 2 + 0.55), yb - 0.5, z + 0.1), Mc, 0.18)
    cyl("zw_%s_rod" % name, 0.07, w + 3.4, (x, yb - 0.5, z + h / 2 + 0.85), zw_m("rod", "#8a6a4a", 0.4, 0.4), 8, rot=(0, 90, 0))


def zw_frame_pic(name, loc, w, h, col, facing="-Y", frame="#3a2e28"):
    """a framed picture / poster on a wall: facing -Y (back wall), +X (left wall), -X (right wall)"""
    x, y, z = loc
    if facing == "-Y":
        box(name + "_f", (w + 0.3, 0.12, h + 0.3), (x, y + 0.06, z), zw_m("pframe" + frame[1:], frame, 0.5), 0.02)
        card(name, w, h, (x, y - 0.01, z), zw_m("pic" + col[1:], col, 0.6), "-Y")
    else:
        s = 1 if facing == "+X" else -1
        box(name + "_f", (0.12, w + 0.3, h + 0.3), (x - s * 0.06, y, z), zw_m("pframe" + frame[1:], frame, 0.5), 0.02)
        card(name, w, h, (x + s * 0.01, y, z), zw_m("pic" + col[1:], col, 0.6), facing)


def zw_chair(name, loc, rot, col="#c98a4e"):
    root = empty(name, loc, rot=(0, 0, rot))
    M = zw_m("chair" + col[1:], col, 0.6)
    box(name + "_s", (1.7, 1.7, 0.25), (0, 0, 1.75), M, 0.05, parent=root)
    box(name + "_b", (1.7, 0.25, 2.0), (0, 0.75, 2.85), M, 0.05, parent=root)
    for sx in (-0.7, 0.7):
        for sy in (-0.7, 0.7):
            box(name + "_l%d%d" % (int(sx * 10), int(sy * 10)), (0.2, 0.2, 1.7), (sx, sy, 0.85), M, 0.02, parent=root)
    return root


def zw_room(name, w=18, d=16, h=9, wall="#f3e6d6", floor=None, window=(None, 5.0, 5.0, 3.6), curtain="#e2725b"):
    box("zw_%s_floor" % name, (w, d, 0.3), (0, 0, -0.15), floor or zw_m(name + "_floor", "#c99a6b", 0.6), 0)
    Mw = zw_m(name + "_wall", wall, 0.85)
    box("zw_%s_back" % name, (w, 0.3, h), (0, d / 2, h / 2), Mw, 0)
    for s in (-1, 1):
        box("zw_%s_side%d" % (name, s), (0.3, d, h), (s * w / 2, 0, h / 2), Mw, 0)
    box("zw_%s_ceil" % name, (w, d, 0.3), (0, 0, h + 0.15), zw_m(name + "_ceil", "#fbf8f2", 0.9), 0)
    Mbb = zw_m("baseboard", "#ffffff", 0.5)
    box("zw_%s_bbb" % name, (w, 0.2, 0.5), (0, d / 2 - 0.25, 0.25), Mbb, 0)
    for s in (-1, 1):
        box("zw_%s_bbs%d" % (name, s), (0.2, d, 0.5), (s * (w / 2 - 0.25), 0, 0.25), Mbb, 0)
    if window and window[0] is not None:
        zw_win_back(name + "_win", window[0], window[1], window[2], window[3], d, curtain)
    cyl("zw_%s_clamp" % name, 1.0, 0.25, (0, 0, h - 0.12), zw_m("clamp", "#fff8e8", 0.3, emit="#ffe9c0", estr=3.0), 24)
    light("zw_%s_key" % name, "AREA", (0, -6, h - 0.6), 1100, (1.0, 0.93, 0.82), 8, target=(0, 2, 0))
    light("zw_%s_fill" % name, "AREA", (-w / 2 + 2, -2, 5), 260, (0.95, 0.96, 1.0), 4, target=(0, 0, 2))
    light("zw_%s_ceil" % name, "POINT", (0, 0, h - 1.2), 350, (1.0, 0.88, 0.7), 1.0)
    zw_world_room()


def zw_shelf_books(name, x, y0, y1, z, rnd):
    """books standing along Y on a shelf (a wall shelf on the left / right wall)"""
    cols = ["#d4423a", "#4fae5a", "#f0c040", "#3e6fd0", "#f08a3a", "#8a4fd0", "#2fb5b0"]
    y, k = y0, 0
    while y < y1 - 0.3:
        t = rnd.uniform(0.22, 0.36)
        hh = rnd.uniform(0.9, 1.3)
        c = cols[k % len(cols)]
        box("%s%d" % (name, k), (0.85, t, hh), (x, y + t / 2, z + hh / 2), zw_m("book" + c[1:], c, 0.6), 0.0)
        y += t + 0.04
        k += 1
        if k % 9 == 8:
            y += 0.6


def zw_living(t0, t1, dress):
    zw_room("liv", wall="#fbe0cc", floor=sets.planks("zw_liv_planks", "#c8915c", "#b98452", "#7a5034", 1.0), window=(-4.5, 5.2, 4.6, 3.6), curtain="#3f8f8a")
    rnd = random.Random(31)
    # the sofa against the back wall
    Mc, Mc2 = zw_m("couch", "#4f74d6", 0.8), zw_m("couch2", "#6a8ce6", 0.85)
    box("zw_couch", (8, 3, 1.2), (2, 5.0, 0.9), Mc, 0.3)
    box("zw_couchb", (8, 1.0, 2.6), (2, 6.6, 1.9), Mc, 0.3)
    for s in (-1, 1):
        box("zw_coucha%d" % s, (1.0, 3.4, 2.0), (2 + s * 4.4, 5.2, 1.3), Mc, 0.3)
        box("zw_couchc%d" % s, (3.8, 2.6, 0.5), (2 + s * 1.95, 4.9, 1.75), Mc2, 0.2)
        box("zw_pillow%d" % s, (1.5, 0.5, 1.3), (2 + s * 3.0, 5.9, 2.6), zw_m("pillow" + ("a" if s < 0 else "b"), "#ffcf1f" if s < 0 else "#ff6f91", 0.9), 0.2, rot=(0, s * 8, 0))
    for k, (px, pw, ph, pc) in enumerate(((-0.4, 1.6, 2.0, "#8fd18c"), (2.0, 2.4, 1.7, "#ffb48a"), (4.4, 1.6, 2.0, "#8fcaf7"))):
        zw_frame_pic("zw_liv_pic%d" % k, (px, 7.82, 6.1), pw, ph, pc)
    # rug, coffee table + things on it
    box("zw_rug", (9, 6.4, 0.05), (1.5, 1.2, 0.03), zw_m("rug", "#e2725b", 0.95), 0)
    box("zw_rugin", (7.6, 5.0, 0.06), (1.5, 1.2, 0.035), zw_m("rugin", "#f2c14e", 0.95), 0)
    box("zw_ctable", (3.8, 2.0, 0.25), (2, 1.8, 1.05), zw_m("wood", "#8a5a3a", 0.6), 0.05)
    for sx in (-1.6, 1.6):
        for sy in (-0.8, 0.8):
            box("zw_ctl%d%d" % (int(sx * 10), int(sy * 10)), (0.2, 0.2, 0.95), (2 + sx, 1.8 + sy, 0.47), zw_m("wood", "#8a5a3a", 0.6), 0.02)
    cyl("zw_mug", 0.22, 0.45, (1.2, 1.6, 1.4), zw_m("mug", "#ffffff", 0.4), 12)
    sets.books("zw_liv_bk", (2.4, 1.9, 1.17), None, n=3, lie=True)
    za_load(["kfood_plate", "kfood_cookie", "kfood_soda_can"])
    if zw_asset_fit("kfood_plate", (3.4, 1.6, 1.18), 1.0, 0.2)[0]:
        for k in range(3):
            zw_asset_fit("kfood_cookie", (3.2 + (k % 2) * 0.4, 1.5 + k * 0.15, 1.24 + k * 0.07), 0.45, 0.1, k * 50)
    # the TV on its stand (left wall, facing the room), a plant beside it
    box("zw_tvstand", (1.8, 5.6, 1.8), (-8.0, 1.5, 0.9), zw_m("tvstand", "#5a3e2c", 0.6), 0.08)
    box("zw_tv", (0.3, 5.0, 3.0), (-7.95, 1.5, 3.6), zw_m("tvbody", "#15181e", 0.3), 0.08)
    card("zw_tvscr", 4.6, 2.6, (-7.78, 1.5, 3.6), zw_m("tvscreen", "#2a64c8", 0.2, emit="#4f9cff", estr=1.4), "+X")
    sets.plant("zw_liv_pl1", (-8.0, 5.6, 0), None, 1.8)
    sets.plant("zw_liv_pl2", (8.0, -4.5, 0), None, 1.6)
    zw_frame_pic("zw_liv_pic3", (-8.82, -2.6, 5.4), 1.8, 2.4, "#c3a8f5", "+X")
    # the armchair, the floor lamp, the bookshelf
    root = empty("zw_arm", (6.6, 0.0, 0), rot=(0, 0, -66))
    Ma = zw_m("armchair", "#e0a030", 0.8)
    box("zw_arm_s", (3.0, 3.0, 1.2), (0, 0, 0.9), Ma, 0.25, parent=root)
    box("zw_arm_b", (3.0, 0.9, 2.6), (0, 1.3, 2.0), Ma, 0.25, parent=root)
    for s in (-1, 1):
        box("zw_arm_a%d" % s, (0.8, 3.0, 1.9), (s * 1.5, 0, 1.25), Ma, 0.25, parent=root)
    cyl("zw_lamp_l", 0.12, 5, (-3.6, 6.4, 2.5), zw_m("lampmetal", "#39404d", 0.4, 0.5), 8)
    sphere("zw_lamp_shade", 0.9, (-3.6, 6.4, 5.3), zw_m("shade", "#fff3c4", 0.6, emit="#ffd9a0", estr=1.5), (1, 1, 0.8), seg=14)
    Msh = zw_m("shelfwood", "#8a5a3a", 0.6)
    box("zw_bshelf_back", (0.2, 4.0, 6.6), (8.75, 5.6, 3.3), Msh, 0.02)
    for s in (-1, 1):
        box("zw_bshelf_s%d" % s, (1.2, 0.2, 6.6), (8.2, 5.6 + s * 1.9, 3.3), Msh, 0.02)
    for k in range(5):
        z = 0.3 + k * 1.55
        box("zw_bshelf_b%d" % k, (1.2, 3.8, 0.15), (8.2, 5.6, z), Msh, 0.0)
        if k < 4:
            zw_shelf_books("zw_lbk%d_" % k, 8.2, 3.9, 7.3, z + 0.08, rnd)
    return dict(couch=(2, 3.0, 0.0), center=(1.5, -0.6, 0.0), tv=(-5.6, 1.5, 0.0))


def zw_bedroom(t0, t1, dress):
    zw_room("bed", wall="#dcd0f2", floor=sets.planks("zw_bed_planks", "#c99a6b", "#bb8c5e", "#7a5034", 1.0), window=(-4.5, 5.4, 4.4, 2.8), curtain="#ffcf1f")
    rnd = random.Random(41)
    # the bed: frame, headboard, mattress, blanket, pillows
    Mwd = zw_m("bedframe", "#8a5a3a", 0.6)
    box("zw_bedframe", (5.4, 8, 1.2), (4.5, 3.5, 0.6), Mwd, 0.1)
    box("zw_headb", (5.8, 0.4, 3.4), (4.5, 7.6, 1.7), Mwd, 0.12)
    box("zw_mattress", (5.0, 7.6, 0.8), (4.5, 3.5, 1.6), zw_m("sheet", "#f6f3ee", 0.85), 0.25)
    box("zw_blanket", (5.3, 5.2, 0.35), (4.5, 1.9, 2.1), zw_m("blanket", "#3d8bfd", 0.85), 0.15)
    box("zw_blfold", (5.35, 0.6, 0.38), (4.5, 4.5, 2.12), zw_m("sheet", "#f6f3ee", 0.85), 0.12)
    for s in (-1, 1):
        box("zw_pillow%d" % s, (2.1, 1.2, 0.6), (4.5 + s * 1.2, 6.5, 2.3), zw_m("pillow", "#ffffff", 0.9), 0.25)
    # nightstand + lamp + clock
    box("zw_nstand", (1.6, 1.6, 1.8), (0.7, 6.6, 0.9), zw_m("wood", "#8a5a3a", 0.6), 0.08)
    cyl("zw_nlamp", 0.15, 0.9, (0.5, 6.6, 2.25), zw_m("lampmetal", "#39404d", 0.4, 0.5), 8)
    sphere("zw_nshade", 0.55, (0.5, 6.6, 2.9), zw_m("shade", "#fff3c4", 0.6, emit="#ffd9a0", estr=1.5), (1, 1, 0.8), seg=12)
    box("zw_nclock", (0.6, 0.3, 0.45), (1.1, 6.3, 2.03), zw_m("clockred", "#e2405b", 0.4), 0.06)
    # desk + chair + laptop + desk lamp + books
    Md = zw_m("desk", "#f2e6d0", 0.6)
    box("zw_desk", (5, 2.4, 0.3), (-5, 6.4, 2.6), Md, 0.05)
    for s in (-1, 1):
        box("zw_deskleg%d" % s, (0.3, 2.2, 2.5), (-5 + s * 2.2, 6.4, 1.25), Md, 0.03)
    zw_chair("zw_bchair", (-5, 4.3, 0), 180, "#ff6f91")
    box("zw_lapb", (1.6, 1.1, 0.08), (-5.4, 6.2, 2.8), zw_m("laptop", "#c9ced6", 0.4, 0.4), 0.02)
    box("zw_laps", (1.6, 0.08, 1.05), (-5.4, 6.8, 3.35), zw_m("laptop", "#c9ced6", 0.4, 0.4), 0.02)
    card("zw_lapscr", 1.4, 0.85, (-5.4, 6.75, 3.35), zw_m("lapscr", "#2a64c8", 0.2, emit="#6fb0ff", estr=1.2), "-Y")
    cyl("zw_dlamp", 0.1, 1.4, (-3.0, 6.9, 3.4), zw_m("lampmetal", "#39404d", 0.4, 0.5), 8)
    sphere("zw_dlshade", 0.45, (-3.0, 6.6, 4.1), zw_m("dlshade", "#22b5a3", 0.5), (1, 1, 0.7), seg=10)
    sets.books("zw_bed_bk", (-7.3, 6.5, 2.75), None, n=4)
    zw_asset_fit("kfood_soda_can", (-3.9, 6.0, 2.75), 0.5, 0.7, 0)
    # posters, the closet, a toy shelf above the bed
    zw_frame_pic("zw_bposter0", (1.6, 7.82, 5.9), 2.0, 2.6, "#ff9f43", "-Y", "#ffffff")
    zw_frame_pic("zw_bposter3", (5.6, 7.82, 6.3), 3.0, 2.0, "#8fe0c4", "-Y", "#ffffff")
    for k, c in enumerate(("#ff4f7e", "#ffcf1f", "#3d8bfd", "#4cbf45", "#7b5cf6")):
        poly_extrude("zw_pen%d" % k, [(-0.35, 0), (0.35, 0), (0, -0.7)], 0.03, (4.6 + k * 0.5, 7.7, 7.85 - (k % 2) * 0.12), zw_m("toy" + c[1:], c, 0.5), rot=(90, 0, 0))
    zw_frame_pic("zw_bposter1", (-8.82, 2.4, 5.6), 2.4, 3.2, "#7b6cf6", "+X", "#ffffff")
    zw_frame_pic("zw_bposter2", (8.82, -1.8, 5.6), 2.4, 3.0, "#22b5a3", "-X", "#ffffff")
    for k, (px, py, pz, pc) in enumerate(((1.6, 7.74, 6.4, "#ffe14a"), (-8.74, 2.4, 6.3, "#ff4f7e"), (8.74, -1.8, 5.9, "#ffffff"))):
        sphere("zw_bpdot%d" % k, 0.55, (px, py, pz), zw_m("pic" + pc[1:], pc, 0.6), (1, 0.15, 1) if k == 0 else (0.15, 1, 1), seg=12)
    Mcl = zw_m("closet", "#f7f3ea", 0.6)
    box("zw_closet", (2.0, 4.6, 7.4), (-7.9, -2.5, 3.7), Mcl, 0.1)
    box("zw_closetl", (0.06, 0.06, 7.0), (-6.88, -2.5, 3.6), zw_m("pframe3a2e28", "#3a2e28", 0.5), 0.0)
    for s in (-1, 1):
        sphere("zw_closetk%d" % s, 0.12, (-6.84, -2.5 + s * 0.35, 3.8), zw_m("knob", "#c9a23a", 0.3, 0.6), seg=8)
    box("zw_tshelf", (1.0, 4.0, 0.2), (8.45, 3.5, 6.2), zw_m("wood", "#8a5a3a", 0.6), 0.02)
    for k, (c, sh) in enumerate((("#ff4f7e", "box"), ("#ffcf1f", "ball"), ("#3d8bfd", "box"), ("#4cbf45", "ball"))):
        if sh == "box":
            box("zw_tsh%d" % k, (0.6, 0.6, 0.6), (8.45, 2.0 + k * 1.0, 6.6), zw_m("toy" + c[1:], c, 0.5), 0.06)
        else:
            sphere("zw_tsh%d" % k, 0.32, (8.45, 2.0 + k * 1.0, 6.62), zw_m("toy" + c[1:], c, 0.5), seg=12)
    # toys on the floor, the round rug, a toy chest with a teddy
    cyl("zw_brug", 3.2, 0.05, (-1.6, 0.6, 0.03), zw_m("brug", "#ff9fbf", 0.95), 32)
    cyl("zw_brugin", 2.2, 0.06, (-1.6, 0.6, 0.035), zw_m("brugin", "#ffffff", 0.95), 32)
    sphere("zw_ball", 0.6, (-3.4, -1.4, 0.6), zw_m("toye2405b", "#e2405b", 0.5), seg=16)
    for k, c in enumerate(("#3d8bfd", "#ffcf1f", "#4cbf45")):
        box("zw_block%d" % k, (0.8, 0.8, 0.8), (-3.6 + (k == 2) * 0.4, 2.0 + (k == 1) * 0.1, 0.4 + (k == 2) * 0.8), zw_m("toy" + c[1:], c, 0.5), 0.06, rot=(0, 0, k * 20))
    box("zw_chest", (3.6, 1.6, 1.8), (4.5, -1.5, 0.9), zw_m("chest", "#22b5a3", 0.6), 0.12)
    Mt = zw_m("teddy", "#b07a4a", 0.9)
    sphere("zw_ted_b", 0.55, (5.6, -1.5, 2.3), Mt, seg=12)
    sphere("zw_ted_h", 0.42, (5.6, -1.55, 3.0), Mt, seg=12)
    for s in (-1, 1):
        sphere("zw_ted_e%d" % s, 0.16, (5.6 + s * 0.3, -1.5, 3.35), Mt, seg=8)
    return dict(bed=(4.5, 1.5, 0.0), desk=(-5, 3.0, 0.0), center=(0, 0, 0.0))


def zw_kitchen(t0, t1, dress):
    zw_room("kit", wall="#fbefc9", floor=sets.checker_mat("zw_kit_chk", "#f4f1ea", "#7fb2e8", 0.5), window=(-4.2, 5.5, 4.4, 2.8), curtain="#ff6f91")
    Mc = zw_m("cabinet", "#8fd1c0", 0.6)
    Mh = zw_m("handle", "#e8e8ea", 0.3, 0.7)
    # the counter run: cabinets with doors and handles, the top, the sink, the stove with its oven
    box("zw_counter", (13.2, 2.4, 3), (1.0, 6.6, 1.5), Mc, 0.08)
    box("zw_ctop", (13.4, 2.6, 0.3), (1.0, 6.6, 3.15), zw_m("ctop", "#f4f1ea", 0.3), 0.04)
    for k in range(6):
        x = -4.6 + k * 2.2
        if abs(x - 4) < 2.3:
            continue      # the oven
        box("zw_cdoor%d" % k, (1.9, 0.08, 2.3), (x, 5.37, 1.45), zw_m("cabdoor", "#a6ddd0", 0.6), 0.03)
        box("zw_chand%d" % k, (0.5, 0.1, 0.1), (x, 5.3, 2.3), Mh, 0.0)
    box("zw_sink", (2.4, 1.6, 0.1), (-4.2, 6.5, 3.28), zw_m("sink", "#9aa3ad", 0.2, 0.7), 0.02)
    cyl("zw_faucet", 0.1, 1.0, (-4.2, 7.3, 3.8), Mh, 8)
    box("zw_faucet2", (0.16, 0.8, 0.16), (-4.2, 6.95, 4.3), Mh, 0.02)
    box("zw_stove", (2.8, 2.4, 0.2), (4, 6.6, 3.35), zw_m("stove", "#22262e", 0.3), 0.03)
    for k, (bx, by) in enumerate(((-0.65, -0.5), (0.65, -0.5), (-0.65, 0.5), (0.65, 0.5))):
        cyl("zw_burn%d" % k, 0.42, 0.05, (4 + bx, 6.6 + by, 3.47), zw_m("burner", "#555a63", 0.4, 0.5), 16)
    box("zw_oven", (2.6, 0.1, 2.4), (4, 5.36, 1.5), zw_m("oven", "#2b2f36", 0.3, 0.3), 0.04)
    box("zw_ovenw", (1.8, 0.12, 1.0), (4, 5.32, 1.6), zw_m("ovenw", "#4a3a2a", 0.2, emit="#ff9a4a", estr=0.3), 0.02)
    cyl("zw_pot", 0.65, 0.9, (3.35, 6.1, 3.95), zw_m("pot", "#e2405b", 0.3, 0.2), 16)
    # upper cabinets + the hood
    box("zw_upper", (7, 1.4, 2.4), (5.0, 7.2, 6.4), Mc, 0.06)
    for k in range(3):
        box("zw_udoor%d" % k, (2.1, 0.08, 2.1), (2.65 + k * 2.35, 6.47, 6.4), zw_m("cabdoor", "#a6ddd0", 0.6), 0.03)
        box("zw_uhand%d" % k, (0.1, 0.1, 0.5), (3.45 + k * 2.35, 6.4, 5.8), Mh, 0.0)
    box("zw_hood", (2.8, 1.8, 0.5), (4, 6.8, 4.95), zw_m("hood", "#c9ced6", 0.3, 0.5), 0.05)
    # the fridge: doors, handles, magnets
    box("zw_fridge", (3, 2.6, 7), (-7.4, 5.6, 3.5), zw_m("fridge", "#eef3f8", 0.3, 0.2), 0.2)
    box("zw_fridgel", (3.02, 0.05, 0.08), (-7.4, 4.27, 5.0), zw_m("pframe3a2e28", "#3a2e28", 0.5), 0.0)
    for zz in (3.2, 6.0):
        box("zw_fhand%d" % int(zz), (0.14, 0.18, 1.4), (-6.3, 4.2, zz), Mh, 0.02)
    for k, c in enumerate(("#ff4f7e", "#ffcf1f", "#3d8bfd", "#4cbf45")):
        box("zw_magnet%d" % k, (0.45, 0.06, 0.45), (-8.2 + (k % 2) * 0.7, 4.27, 3.6 + (k // 2) * 0.7), zw_m("toy" + c[1:], c, 0.5), 0.02)
    # things on the counter
    cyl("zw_bowl", 0.75, 0.4, (0.6, 6.4, 3.5), zw_m("bowl", "#ffffff", 0.4), 16, r2=0.5)
    for k, c in enumerate(("#ff3b3b", "#ffcf1f", "#ff8c2a", "#4cbf45")):
        sphere("zw_fruit%d" % k, 0.3, (0.35 + (k % 2) * 0.5, 6.25 + (k // 2) * 0.4, 3.85), zw_m("fruit" + c[1:], c, 0.5), seg=10)
    box("zw_toaster", (1.2, 0.8, 0.9), (-1.4, 6.9, 3.75), zw_m("toaster", "#c9ced6", 0.3, 0.6), 0.12)
    for k, c in enumerate(("#ff9ec0", "#8fe0c4", "#ffe680")):
        cyl("zw_jar%d" % k, 0.32, 0.9, (5.9 + k * 0.6, 7.4, 3.75), zw_m("jar" + c[1:], c, 0.4), 12)
    sets.plant("zw_kit_pl", (-5.3, 7.0, 3.3), None, 0.9)
    za_load(["kfood_frying_pan", "kfood_cutting_board", "kfood_loaf", "kfood_knife_block", "kfood_pancakes", "kfood_salad", "kfood_pizza", "kfood_burger", "kfood_bottle_ketchup"])
    zw_asset_fit("kfood_frying_pan", (4.7, 7.1, 3.47), 1.6, 0.5, 20)
    zw_asset_fit("kfood_cutting_board", (2.2, 6.4, 3.3), 1.9, 0.3, 90)
    zw_asset_fit("kfood_loaf", (2.2, 6.4, 3.45), 1.3, 1.0, 90)
    zw_asset_fit("kfood_knife_block", (-2.5, 7.4, 3.3), 1.0, 1.3, 0)
    locs.wall_clock("zw_kclock", (0.3, 7.82, 7.0), None, "-Y")
    # the table: chairs, plates, cups, a vase
    Mwd = zw_m("wood", "#8a5a3a", 0.6)
    box("zw_ktable", (5, 3.6, 0.3), (0, 0.5, 2.8), Mwd, 0.05)
    for sx in (-2.2, 2.2):
        for sy in (-1.5, 1.5):
            box("zw_ktl%d%d" % (int(sx), int(sy)), (0.25, 0.25, 2.7), (sx, 0.5 + sy, 1.35), Mwd, 0.02)
    box("zw_kcloth", (3.6, 3.7, 0.04), (0, 0.5, 2.97), zw_m("cloth", "#ff6f91", 0.9), 0)
    zw_chair("zw_kch0", (-3.4, 0.5, 0), 90, "#ffcf1f")
    zw_chair("zw_kch1", (3.4, 0.5, 0), -90, "#ffcf1f")
    zw_chair("zw_kch2", (1.8, 3.0, 0), 0, "#ffcf1f")
    for k, (px, py) in enumerate(((-1.4, -0.4), (1.4, -0.4), (-1.4, 1.4), (1.4, 1.4))):
        cyl("zw_plate%d" % k, 0.6, 0.08, (px, py + 0.0, 3.04), zw_m("plate", "#ffffff", 0.3), 20)
        cyl("zw_cup%d" % k, 0.2, 0.4, (px + 0.75, py, 3.2), zw_m("cup" + ("a" if k % 2 else "b"), "#3d8bfd" if k % 2 else "#ff8c2a", 0.4), 10)
    for k, (aid, (px, py)) in enumerate(zip(("kfood_pancakes", "kfood_salad", "kfood_pizza", "kfood_burger"), ((-1.4, -0.4), (1.4, -0.4), (-1.4, 1.4), (1.4, 1.4)))):
        zw_asset_fit(aid, (px, py, 3.09), 0.95, 0.8, k * 30)
    zw_asset_fit("kfood_bottle_ketchup", (0.4, 0.6, 2.97), 0.5, 1.0, 0)
    cyl("zw_vase", 0.3, 0.9, (-0.6, 0.5, 3.45), zw_m("vase", "#7b5cf6", 0.3), 12)
    for k in range(3):
        sphere("zw_vfl%d" % k, 0.25, (-0.85 + k * 0.25, 0.5, 4.1 + (k % 2) * 0.2), zw_m("flowerff5fa2", "#ff5fa2", 0.5), seg=8)
    light("zw_kit_pend", "POINT", (0, 0.5, 7.2), 260, (1.0, 0.85, 0.65), 0.6)
    cyl("zw_kit_pendc", 0.05, 1.4, (0, 0.5, 8.3), Mh, 6)
    cyl("zw_kit_pends", 0.9, 0.8, (0, 0.5, 7.25), zw_m("pendant", "#ffcf1f", 0.4, emit="#ffd27a", estr=0.8), 16, r2=0.25)
    return dict(table=(0, -2, 0.0), counter=(0, 4.2, 0.0), fridge=(-7.4, 3.5, 0.0))


def zw_b_products(src, nm):
    """one shelf row of colourful products along +Y, 7 units long (instanced along every shelf): library food packs
    when the library is there, else our own boxes / cans / bottles"""
    k = int(nm[-1])
    za_load(ZA_SHELF)
    if ZA["c"].get(ZA_SHELF[0]) is not None:
        y, q = 0.15, 0
        while y < 6.4:
            aid = ZA_SHELF[(q * 5 + k * 3) % len(ZA_SHELF)]
            sx, sy, sz = za_size(aid)
            if sz <= 0:
                q += 1
                continue
            f = min(2.5, 0.85 / max(sx, sy, 1e-3), 1.3 / sz)
            wd = max(sx, sy) * f
            zw_asset(aid, (0, y + wd / 2, 0), (q % 3) * 15, f, coll=src)
            y += wd + 0.06
            q += 1
        return
    cols = ["#e2405b", "#ffcf1f", "#3d8bfd", "#22b5a3", "#7b5cf6", "#ff8c2a", "#ff6fa8", "#4cbf45", "#ffffff"]
    rnd = random.Random(60 + k)
    y, q = 0.15, 0
    while y < 6.6:
        kind = rnd.choice(("box", "box", "can", "bottle", "tall"))
        c = cols[(q * 3 + k) % len(cols)]
        M = zw_m("prod" + c[1:], c, 0.45)
        if kind == "box":
            sy, sz = rnd.uniform(0.7, 1.0), rnd.uniform(0.9, 1.3)
            box("%s_%d" % (nm, q), (0.9, sy, sz), (0, y + sy / 2, sz / 2), M, 0.03, coll=src)
            box("%s_l%d" % (nm, q), (0.92, sy * 0.85, sz * 0.28), (0, y + sy / 2, sz * 0.55), zw_m("prodlabel", "#ffffff", 0.5), 0.0, coll=src)
        elif kind == "tall":
            sy, sz = 0.65, 1.35
            box("%s_%d" % (nm, q), (0.8, sy, sz), (0, y + sy / 2, sz / 2), M, 0.03, coll=src)
        else:
            sy = 0.55
            for j in range(2):
                yy = y + sy / 2 + j * (sy + 0.05)
                if kind == "can":
                    cyl("%s_%d_%d" % (nm, q, j), 0.27, 0.8, (-0.2, yy, 0.4), M, 10, coll=src)
                    cyl("%s_b%d_%d" % (nm, q, j), 0.27, 0.8, (0.25, yy, 0.4), M, 10, coll=src)
                else:
                    cyl("%s_%d_%d" % (nm, q, j), 0.24, 1.0, (0, yy, 0.5), M, 10, coll=src)
                    cyl("%s_n%d_%d" % (nm, q, j), 0.1, 0.3, (0, yy, 1.15), M, 8, coll=src)
            sy = 2 * sy + 0.05
        y += sy + 0.08
        q += 1


for _k in range(4):
    ZW_SRC["products%d" % _k] = zw_b_products


def zw_shelf(name, x, y0, length, levels, depth=1.4, double=False, z0=0.3, dz=1.6, col="#f4f1ea"):
    """a shelf unit along +Y at x (uprights, boards) full of products (instanced rows)"""
    M = zw_m("shelf" + col[1:], col, 0.5)
    hh = z0 + levels * dz + 0.3
    for e in (0, 1):
        box("%s_u%d" % (name, e), (depth, 0.2, hh), (x, y0 + e * length, hh / 2), M, 0.02)
    if double:
        box("%s_mid" % name, (0.12, length, hh), (x, y0 + length / 2, hh / 2), M, 0.0)
    for lv in range(levels + 1):
        z = z0 + lv * dz
        box("%s_b%d" % (name, lv), (depth, length, 0.14), (x, y0 + length / 2, z), M, 0.0)
        if lv == levels:
            break
        for side in ((-1, 1) if double else (0,)):
            px = x + side * depth * 0.25
            yy, q = y0 + 0.1, 0
            while yy < y0 + length - 1.0:
                zw_inst("products%d" % ((lv + q + (side > 0)) % 4), (px, yy, z + 0.07), 0, (0.62 if double else 1.0, 1.0, 1.0))
                yy += 7.0
                q += 1


def zw_shop_in(t0, t1, dress):
    zw_room("shp", w=22, d=18, wall="#fdf0e0", floor=sets.checker_mat("zw_shp_chk", "#f4f1ea", "#e2d6c6", 0.45), window=None)
    # wall shelves (left / right), two gondolas down the middle, coolers on the back wall
    for s in (-1, 1):
        zw_shelf("zw_wsh%d" % s, s * 10.2, -7.6, 14.0, 4)
        zw_shelf("zw_gon%d" % s, s * 3.8, -6.6, 7.0, 2, depth=1.6, double=True, col="#22b5a3")
        cx = s * 7.6
        box("zw_cool%d" % s, (5.0, 1.6, 7.0), (cx, 8.0, 3.5), zw_m("cooler", "#f4f6fa", 0.4, 0.2), 0.08)
        card("zw_coolg%d" % s, 4.4, 5.8, (cx, 7.18, 3.6), zw_m("coolglow", "#cfefff", 0.2, emit="#bfe8ff", estr=1.2), "-Y")
        for lv in range(3):
            zw_inst("products%d" % ((lv + (s > 0)) % 4), (cx - 2.0, 7.0, 1.2 + lv * 1.9), -90, (0.4, 0.58, 0.7))
            box("zw_coolb%d_%d" % (s, lv), (4.4, 0.6, 0.08), (cx, 7.0, 1.15 + lv * 1.9), zw_m("handle", "#e8e8ea", 0.3, 0.7), 0.0)
    # the snack wall behind the counter (fills the close-ups' background)
    for lv in range(2):
        box("zw_snackb%d" % lv, (9.2, 1.0, 0.14), (0, 8.35, 3.6 + lv * 1.6), zw_m("shelff4f1ea", "#f4f1ea", 0.5), 0.0)
        zw_inst("products%d" % ((lv + 1) % 4), (-4.4, 8.35, 3.67 + lv * 1.6), -90, (0.62, 1.25, 0.9))
    # the counter, the register, a candy rack, the sign + aisle signs
    box("zw_scounter", (7, 2.6, 3.2), (0, 5, 1.6), zw_m("scounter", "#4f74d6", 0.6), 0.1)
    box("zw_sctop", (7.3, 2.9, 0.25), (0, 5, 3.3), zw_m("ctop", "#f4f1ea", 0.3), 0.04)
    box("zw_register", (1.6, 1.2, 1.0), (2.2, 5, 3.95), zw_m("register", "#2b2f3a", 0.4, 0.3), 0.08)
    box("zw_regscr", (1.2, 0.12, 0.8), (2.2, 4.6, 4.8), zw_m("regscr", "#2b2f3a", 0.4, 0.3), 0.04)
    card("zw_regscrg", 1.0, 0.6, (2.2, 4.53, 4.8), zw_m("lapscr", "#2a64c8", 0.2, emit="#6fb0ff", estr=1.2), "-Y")
    zw_inst("products2", (-2.0, 4.0, 3.42), -90, (0.5, 0.5, 0.5))
    box("zw_shpsign", (8, 0.3, 1.6), (0, 8.84, 7.6), zw_m("signboard", "#fffdf5", 0.5), 0.05)
    text("zw_shpsign_t", ((dress.get("signs") or ["SHOP"])[0]).upper()[:12], (0, 8.6, 7.6), 1.1, zw_m("signtxt0", "#e2405b", 0.4), extrude=0.05)
    for s, word, c in ((-1, "SNACKS", "#ff8c2a"), (1, "TOYS", "#7b5cf6")):
        box("zw_asign%d" % s, (3.6, 0.2, 1.0), (s * 3.8, -3.1, 7.2), zw_m("asign" + c[1:], c, 0.5), 0.05)
        text("zw_asignt%d" % s, word, (s * 3.8, -3.24, 7.2), 0.7, zw_m("bbtffffff", "#ffffff", 0.4), rot=(90, 0, 0), extrude=0.03)
        cyl("zw_asignw%d" % s, 0.03, 1.4, (s * 3.8, -3.1, 8.3), zw_m("handle", "#e8e8ea", 0.3, 0.7), 4)
    # a fruit stand by the door, customers
    box("zw_fstand", (2.4, 3.6, 1.6), (6.8, -6.4, 0.8), zw_m("crate", "#a07a4a", 0.8), 0.06)
    for k in range(10):
        c = ("#ff3b3b", "#ffcf1f", "#ff8c2a", "#4cbf45")[k % 4]
        sphere("zw_fs%d" % k, 0.38, (6.3 + (k % 2) * 0.9, -7.6 + (k // 2) * 0.6, 1.9), zw_m("fruit" + c[1:], c, 0.5), seg=10)
    za_load(ZA_FRUIT + ["kfood_watermelon"])
    for k in range(8):
        zw_asset_fit((ZA_FRUIT + ["kfood_watermelon"])[k % 6], (6.3 + (k % 2) * 1.0, -7.8 + (k // 2) * 0.8, 2.05), 0.8, 0.9, k * 45)
    zw_people(t0, t1, 3, [((-7.2, -6.6), (0.5, 1.5), 0.0), ((6.8, 7.4), (1.0, 2.0), 0.0), ((-7.2, -6.6), (3.0, 4.0), 0.0)], seed=15, modes=("stand",))
    return dict(counter=(0, 2.6, 0.0), aisle=(7.0, -2, 0.0), center=(0, -2, 0.0))


def zw_big_hall(t0, t1, dress):
    zw_room("hall", w=40, d=44, h=18, wall="#efe2c8", floor=sets.planks("zw_hall_planks", "#b07a48", "#a26e40", "#6a4428", 1.0), window=None)
    box("zw_stage", (24, 10, 2.4), (0, 17, 1.2), zw_m("stage", "#7a4a2a", 0.6), 0.1)
    for s in (-1, 1):
        box("zw_curtain%d" % s, (7, 0.6, 15), (s * 15, 21.4, 7.5), zw_m("curtain", "#c42a40", 0.8), 0.1)
    box("zw_hall_backdrop", (22, 0.2, 10), (0, 21.7, 7.6), zw_m("backdrop", "#3a4fa8", 0.8), 0.02)
    for k in range(7):
        sphere("zw_hall_star%d" % k, 0.7, (-9 + k * 3.0, 21.55, 6.5 + (k % 3) * 2.2), zw_m("lm_trim", "#e0b84a", 0.4, 0.3), (1, 0.2, 1), seg=10)
    box("zw_hall_banner", (16, 0.3, 2.4), (0, 21.6, 15), zw_m("signboard", "#fffdf5", 0.5), 0.05)
    text("zw_hall_banner_t", (dress.get("landmark_text") or "WELCOME").upper()[:16], (0, 21.4, 15), 1.5, zw_m("signtxt2", "#5b4bd6", 0.4), extrude=0.05)
    src = collection("zw_chair_src")
    box("zw_chs", (1.4, 1.4, 0.2), (0, 0, 1.4), zw_m("hchair", "#3a5a8a", 0.6), 0.05, coll=src)
    box("zw_chb", (1.4, 0.2, 1.6), (0, 0.6, 2.2), zw_m("hchair", "#3a5a8a", 0.6), 0.05, coll=src)
    hide_coll_from_layer(src)
    for r in range(6):
        for c in range(10):
            instance("zw_ch%d_%d" % (r, c), src, (-11.25 + c * 2.5, 6 - r * 3.2, 0), rot=(0, 0, 180))
    for k in range(3):
        sphere("zw_chand%d" % k, 1.2, (-12 + k * 12, 0, 16), zw_m("chand", "#fff3c4", 0.3, emit="#ffd27a", estr=4.0), seg=14)
    light("zw_hall_stage", "SPOT", (0, 2, 16), 4000, (1.0, 0.9, 0.75), 2, target=(0, 17, 3), spot=50)
    return dict(stage=(0, 16, 2.4), aisle=(0, -6, 0.0), seats=(-3, 2, 0.0))


# ---------------------------------------------------------------- the KIT's sets (as library locations)
def zw_kit_cabin(t0, t1, dress):
    zw_sky_time("day", sun=False)
    W2.cabin()
    return dict(aisle=(0, 0, 0))


def zw_kit_cockpit(t0, t1, dress):
    zw_sky_time("day", sun=False)
    W.cockpit()
    return dict(seat=(0, 0, 0))


def zw_b_lander(root):
    Mg, Mw = zw_m("foil", "#e8b93c", 0.35, 0.8), zw_m("lander", "#eef0f4", 0.5)
    box("zw_lnd_body", (4, 4, 3), (0, 0, 3.6), Mg, 0.2, parent=root)
    box("zw_lnd_top", (3, 3, 1.6), (0, 0, 5.9), Mw, 0.2, parent=root)
    for k in range(4):
        a = k * 90 + 45
        x, y = math.cos(math.radians(a)) * 2.8, math.sin(math.radians(a)) * 2.8
        cyl("zw_lnd_leg%d" % k, 0.12, 3.6, (x, y, 1.6), Mw, 6, parent=root)
        cyl("zw_lnd_foot%d" % k, 0.5, 0.15, (x, y, 0.08), Mw, 12, parent=root)
    cyl("zw_lnd_dish", 1.0, 0.3, (1.4, 0, 7.2), Mw, 16, r2=0.2, rot=(0, -30, 0), parent=root)


def zw_kit_moon(t0, t1, dress):
    W2.moon()
    ZW_T["time"] = "night"
    # the Earth: bigger and inside every tested view
    for nm in ("moon_earth", "moon_earth_atmo"):
        ob = D.objects.get(nm)
        if ob:
            ob.location = (-70, 300, 104)
            ob.scale = (1.25, 1.25, 1.25)
    # near craters, rocks, a flag, a lander, stars
    Mc, Mr = zw_m("mcrater", "#5d5d62", 0.95), zw_m("mrim", "#a9a9ae", 0.95)
    for k, (x, y, r) in enumerate(((-11, 8, 3.2), (12, 12, 2.6), (-18, 24, 4.5), (16, 30, 3.8), (-4, 38, 3.0), (24, 6, 2.2), (-24, -2, 2.8), (6, 50, 5.0), (-14, 62, 4.0))):
        cyl("zw_mc%d" % k, r, 0.08, (x, y, 0.03), Mc, 28)
        cyl("zw_mr%d" % k, r * 1.15, 0.5, (x, y, 0.0), Mr, 28, r2=r * 1.0)
    rnd = random.Random(77)
    for k in range(34):
        x, y = rnd.uniform(-40, 40), rnd.uniform(-8, 80)
        if -8 < x < 10 and y < 8:
            continue      # keep the tested spots clear
        s = rnd.uniform(0.5, 1.8)
        zw_inst("rock%d" % (k % 3), (x, y, 0), rnd.uniform(0, 360), (s, s, s * 0.8))
    cyl("zw_flagpole", 0.1, 8, (-5, 4, 4), zw_m("flagpole", "#dfe3ea", 0.3, 0.6), 8)
    card("zw_flag", 3.4, 2.2, (-3.25, 4, 6.9), zw_m("mflag", "#22b5a3", 0.5), "-Y")
    poly_extrude("zw_flagstar", [(math.cos(math.radians(90 + k * 36)) * (0.75 if k % 2 == 0 else 0.3), math.sin(math.radians(90 + k * 36)) * (0.75 if k % 2 == 0 else 0.3)) for k in range(10)], 0.02, (-3.25, 3.97, 6.9), zw_m("mstar", "#ffe14a", 0.4), rot=(90, 0, 0))
    zw_b_lander(empty("zw_lander", (13, 18, 0), rot=(0, 0, 20)))
    for k in range(160):
        a, el = rnd.uniform(-70, 70), rnd.uniform(4, 58)
        r = rnd.uniform(420, 480)
        x = math.sin(math.radians(a)) * math.cos(math.radians(el)) * r
        y = math.cos(math.radians(a)) * math.cos(math.radians(el)) * r
        zw_inst("star", (x, y, math.sin(math.radians(el)) * r), 0, rnd.uniform(0.5, 1.1))
    return dict(surface=(0, 0, 0))


def zw_kit_sky(t0, t1, dress):
    zw_sky_time("day")
    W2.airliner("zw_airliner", (0, 0, 0), rot=0)
    W.cloud_field("zw_cf", (0, 0, -12), n=24)
    return dict(plane=(0, 0, 0))


def zw_kit_classroom(t0, t1, dress):
    zw_sky_time("day", sun=False)
    W.classroom_day()
    return dict(front=(0, 0, 0))


def zw_kit_hallway(t0, t1, dress):
    zw_sky_time("day", sun=False)
    W.hallway_day()
    return dict(hall=(0, 0, 0))


# ---------------------------------------------------------------- THE LIBRARY: place -> builder, tested camera spots
# spot = (camera location, look-at point, lens): checked with stills (worlds/stills.mjs) before a director may use them
ZW_PLACES = {
    "downtown_street": zw_downtown, "downtown_plaza": zw_downtown, "downtown_landmark": zw_downtown,
    "suburb_street": zw_suburb, "suburb_porch": zw_suburb,
    "brick_street": zw_brick_city, "brick_alley": zw_brick_city,
    "living_room": zw_living, "bedroom": zw_bedroom, "kitchen": zw_kitchen, "shop": zw_shop_in, "big_hall": zw_big_hall,
    "plane_cabin": zw_kit_cabin, "cockpit": zw_kit_cockpit, "moon": zw_kit_moon, "sky_airliner": zw_kit_sky,
    "classroom": zw_kit_classroom, "hallway": zw_kit_hallway,
}
ZW_SPOTS = {
    "downtown_street": {"wide": ((0, -14, 9), (0, 70, 8), 22), "street": ((5, 6, 3.4), (-3, 40, 5), 26), "close": ((5.4, 31.5, 5.0), (8.6, 39.0, 6.2), 28), "skyline": ((-6, -40, 26), (0, 90, 30), 30)},
    "downtown_plaza": {"wide": ((-20, -48, 10), (0, -20, 3), 22), "street": ((-8, -40, 3.6), (0, -24, 3.5), 26), "close": ((-4.5, -19.5, 5.0), (0, -12, 6.2), 28)},
    "downtown_landmark": {"wide": ((0, 112, 6), (0, 178, 16), 22), "street": ((4, 140, 3.4), (0, 178, 12), 24), "close": ((-4.5, 152.0, 3.0), (0, 160, 6.8), 28)},
    "suburb_street": {"wide": ((-40, -3, 7), (10, 16, 5), 22), "street": ((-12, -6, 3.4), (6, 14, 4), 26), "close": ((-4.5, 4.0, 5.0), (3.0, 9.0, 6.2), 28)},
    "suburb_porch": {"wide": ((8, -2, 6), (0, 18, 4), 24), "street": ((4, 6, 3.4), (0, 16, 3.6), 28), "close": ((2.6, 7.5, 4.8), (0, 15.5, 6.2), 28)},
    "brick_street": {"wide": ((0, -16, 10), (0, 80, 14), 22), "street": ((4, 10, 3.4), (-2, 50, 6), 26), "close": ((4.6, 31.5, 5.0), (8.0, 39.5, 6.2), 28), "skyline": ((-4, -30, 30), (0, 120, 25), 30)},
    "brick_alley": {"wide": ((4, 58, 6), (-20, 74, 3), 24), "street": ((-5, 66, 3.8), (-20, 74, 3.2), 26), "close": ((-10.5, 70.5, 5.0), (-18, 74, 6.2), 28)},
    "living_room": {"wide": ((5.6, -7.4, 6.6), (-1.5, 3, 2.4), 20), "street": ((1.2, -4.6, 3.8), (2, 3.0, 2.8), 24), "close": ((3.5, -5.5, 4.6), (-1.0, 0.0, 4.4), 35)},
    "bedroom": {"wide": ((3.0, -7.4, 6.6), (-2, 3.5, 2.4), 20), "street": ((1, -3.6, 3.6), (4.5, 2, 2.4), 24), "close": ((3.0, -5.6, 4.6), (-0.5, 0.5, 4.4), 35)},
    "kitchen": {"wide": ((7.4, -7.4, 6.2), (-1, 4.2, 2.4), 20), "street": ((0, -6.4, 3.6), (0, 3, 3), 24), "close": ((1.4, -9.0, 4.6), (0, -2, 4.4), 35)},
    "shop": {"wide": ((-9.4, -8.6, 7.6), (2, 4, 2.2), 20), "street": ((0, -8.4, 3.8), (0, 4, 3.2), 24), "close": ((0.8, -4.6, 4.8), (0, 2.6, 5.8), 28)},
    "big_hall": {"wide": ((-16, -20, 10), (0, 12, 3), 22), "street": ((0, -14, 4), (0, 16, 5), 24), "close": ((1.5, 8.8, 7.2), (0, 16, 8.4), 28)},
    # the kit's sets: the cameras its own example videos use (close: head and shoulders)
    "plane_cabin": {"wide": ((0, -3, 6.5), (0, 16, 3.8), 22), "street": ((0, 2, 5.2), (0, 14, 3.8), 24), "close": ((0.8, 3.0, 4.9), (0, 10, 5.6), 28)},
    "cockpit": {"wide": ((0.6, -7.5, 6.8), (-1.2, 1.5, 4.4), 20), "street": ((1.8, -4.6, 5.2), (-2.2, -0.5, 4.6), 22), "close": ((0.6, -7.5, 6.2), (-1.2, 1.5, 5.4), 30)},
    "moon": {"wide": ((8, -16, 5), (0, 2, 5), 24), "street": ((4, -10, 3.2), (0, 0, 3.0), 24), "close": ((2.0, -7.6, 4.6), (0, 0, 6.2), 28)},
    "sky_airliner": {"wide": ((30, -60, 10), (0, 10, 0), 26), "street": ((15, -30, 4), (0, 0, 0), 26), "close": ((10, -12, 3), (0, -2, 1), 30)},
    "classroom": {"wide": ((7, -4, 8), (-2, 14, 4.5), 22), "street": ((0, 2, 4.2), (-2, 14, 4.5), 26), "close": ((-0.6, 2.6, 4.9), (-1.5, 9.6, 6.0), 28)},
    "hallway": {"wide": ((1.5, -6, 5.5), (0, 10, 4), 22), "street": ((0.6, -1, 4.4), (0, 8, 4), 28), "close": ((0.6, 1.0, 4.9), (0, 8, 5.8), 28)},
}
ZW_DRESS_DEFAULT = {"downtown_street": {"landmark": "bank"}, "downtown_plaza": {"landmark": "bank"}, "downtown_landmark": {"landmark": "bank"}}


def zw_build(place, t0, t1, dress=None):
    d = dict(ZW_DRESS_DEFAULT.get(place, {}))
    d.update(dress or {})
    ZW_T.clear()
    ZW_T.update(d)
    ZW_T["_place"] = place
    ZW_T["_std"] = place in ZW_STD_PLACES   # look v3: Standard colour + the Standard light set
    if d.get("threat") in ("near", "react", "after") and place in ZW_SPOTS:
        ZW_T["threat_at"] = tuple(ZW_SPOTS[place]["close"][1][:2])
    ZW_N["n"] = 0
    ZA["c"].clear()
    info = ZW_PLACES[place](t0, t1, d)
    zw_life_near(place, d, t0, t1)
    return info


def zw_spot(cam, place, spot, t0, t1, push=0.08, lens=None):
    """a TESTED camera spot of a library place, with a gentle push in (every shot moves)"""
    loc, tgt, ln = ZW_SPOTS[place][spot]
    loc, tgt = Vector(loc), Vector(tgt)
    end = loc + (tgt - loc) * push
    cam.key(t0, tuple(loc), tuple(tgt), lens=lens or ln)
    cam.key(t1, tuple(end), tuple(tgt), lens=lens or ln)
    return loc, tgt


# ---------------------------------------------------------------- GIANT CAMERA RULES (owner 2026-11-14)
# Growing / shrinking characters: zw_grow scales a character over a shot (feet stay on the ground). zw_giant_cam gives a
# SAFE camera for a character of any size: distance and height scale with the size, the face framed from outside with
# a longer lens, never closer than the head's own size. zw_cam_guard MOVES a camera that is inside or touching a
# character's body back out along its own view (every 6th frame + the last; world bounding box of the character's
# meshes, scale animation included): a camera rule fixes the shot, it never fails it (owner 2026-11-18).
def zw_grow(ch, t0, t1, s0, s1, interp="BEZIER"):
    """the character's size from s0 to s1 between t0 and t1 (1.0 = a kid, 5.2 tall)"""
    ch.root.scale = (s0, s0, s0)
    ch.root.keyframe_insert("scale", frame=F(t0))
    ch.root.scale = (s1, s1, s1)
    ch.root.keyframe_insert("scale", frame=F(t1))
    set_interp(ch.root, "scale", F(t0), interp)
    return ch


def zw_giant_cam(cam, ch, size, t0, t1, view="hero", yaw=0.0, push=0.06):
    """a safe camera for a character `size` times a kid at its root position:
    view "face": the face from outside (longer lens, 4.4 x size away: over 3 head sizes), "hero": street level looking UP at the
    giant (people, cars, buildings at his feet), "full": the whole body; yaw turns the camera round the character"""
    p = Vector(ch.root.location)
    head = p + Vector((0, 0, 4.6 * size))
    # yaw counts from the character's FRONT (its root's turn; a kit character at rot 0 faces -y): the first test filmed
    # the back of a giant's head from the fixed -y side
    a = math.radians(yaw) + ch.root.rotation_euler[2]
    fwd = Vector((math.sin(a), -math.cos(a), 0))
    if view == "face":
        # the WHOLE face in frame (owner 2026-11-14: never just the chin or a cheek): 4.4 x size away (over 3 head sizes),
        # lens 30 on the kit's 24 mm vertical sensor = about 3.5 x size of frame height (the head about 45% of it)
        d, z, tgt, lens = max(4.5, 4.4 * size), 4.5 * size, p + Vector((0, 0, 4.4 * size)), 30
    elif view == "full":
        d, z, tgt, lens = 9.0 * size + 6, 2.6 * size + 2, p + Vector((0, 0, 2.6 * size)), 30
    else:
        d, z, tgt, lens = 4.5 * size + 8, 2.2, p + Vector((0, 0, 3.6 * size)), 22
    loc = p + fwd * d + Vector((0, 0, z - p.z))
    end = loc + (tgt - loc) * push
    cam.key(t0, tuple(loc), tuple(tgt), lens=lens)
    cam.key(t1, tuple(end), tuple(tgt), lens=lens)
    return loc, tgt


def zw_cast_boxes():
    """(name, lo, hi) world bounding boxes of every visible kit character (a "<name>_root" empty with a "_hip" child)"""
    out = []
    for o in D.objects:
        if o.type != "EMPTY" or not o.name.endswith("_root") or not any(c.name.endswith("_hip") for c in o.children):
            continue
        lo, hi = Vector((1e9, 1e9, 1e9)), Vector((-1e9, -1e9, -1e9))
        for m in o.children_recursive:
            if m.type != "MESH" or not m.visible_get():
                continue
            for c in m.bound_box:
                w = m.matrix_world @ Vector(c)
                lo = Vector((min(lo.x, w.x), min(lo.y, w.y), min(lo.z, w.z)))
                hi = Vector((max(hi.x, w.x), max(hi.y, w.y), max(hi.z, w.z)))
        if lo.x < 1e8:
            out.append((o.name[:-5], lo, hi))
    return out


def zw_cam_guard(t0, t1, step=6):
    """THE CAMERA NEVER INSIDE A BODY (owner 2026-11-18: camera rules FIX a shot, they never fail it): at the checked frames
    a camera inside or touching a character's box is moved BACK along its own view (the nearest clear point behind it,
    0.25 at a time, at most 12 units) and keyed there. A camera that cannot be moved (driven by a constraint) is left
    as it is with a warning: the checker then judges the frame. Never raises."""
    sc = bpy.context.scene
    cam = sc.camera
    if cam is None:
        return 0
    f0, f1 = F(t0), max(F(t0), F(t1) - 1)
    frames = sorted(set(list(range(f0, f1 + 1, step)) + [f1]))
    moved = 0
    for f in frames:
        sc.frame_set(f)
        if cam.matrix_world.translation.z < 0.6 and not cam.parent:   # round 3: never under the ground
            cam.location.z = 0.6
            cam.keyframe_insert("location", frame=f)
            moved += 1
            print("zw_cam_guard: frame %d: the camera was under the ground, raised" % f)
            sc.frame_set(f)
        boxes = []
        for name, lo, hi in zw_cast_boxes():
            m = 0.12 * max(1.0, (hi.z - lo.z) / 5.2)
            boxes.append((name, lo - Vector((m, m, m)), hi + Vector((m, m, m))))
        inside = lambda p: [n for n, lo, hi in boxes if lo.x <= p.x <= hi.x and lo.y <= p.y <= hi.y and lo.z <= p.z <= hi.z]
        c = cam.matrix_world.translation.copy()
        hit = inside(c)
        if not hit:
            continue
        back = cam.matrix_world.to_3x3() @ Vector((0.0, 0.0, 1.0))   # the camera looks down -Z: +Z is behind it
        back.normalize()
        p = c.copy()
        for _ in range(48):
            p = p + back * 0.25
            if not inside(p):
                break
        if inside(p):
            print("zw_cam_guard: frame %d: no clear point behind the camera inside %s (left as it is)" % (f, ", ".join(hit)))
            continue
        try:
            new = cam.parent.matrix_world.inverted() @ p if cam.parent else p
            cam.location = new
            cam.keyframe_insert("location", frame=f)
            sc.frame_set(f)
            if (cam.matrix_world.translation - p).length > 0.05:
                print("zw_cam_guard: frame %d: the camera is driven (constraint), not moved" % f)
                continue
            moved += 1
            print("zw_cam_guard: frame %d: camera moved %.1f back out of %s" % (f, (p - c).length, ", ".join(hit)))
        except Exception as e:   # never fails a shot
            print("zw_cam_guard: frame %d: could not move the camera (%s)" % (f, e))
    sc.frame_set(f0)
    return moved


def zw_box_of(o):
    """world AABB (lo, hi) of a mesh or of a collection instance (an instanced tree, lamp, asset ...), else None"""
    pts = []
    mw = o.matrix_world
    if o.type == "MESH":
        pts = [mw @ Vector(c) for c in o.bound_box]
    elif o.type == "EMPTY" and o.instance_type == "COLLECTION" and o.instance_collection is not None:
        off = Vector(o.instance_collection.instance_offset)
        for m in o.instance_collection.all_objects:
            if m.type == "MESH":
                for c in m.bound_box:
                    pts.append(mw @ (m.matrix_world @ Vector(c) - off))
    if not pts:
        return None
    lo = Vector((min(q.x for q in pts), min(q.y for q in pts), min(q.z for q in pts)))
    hi = Vector((max(q.x for q in pts), max(q.y for q in pts), max(q.z for q in pts)))
    return lo, hi


def zw_seg_hits(a, b, lo, hi):
    """does the segment a -> b cross the box lo..hi (slab test)"""
    u0, u1 = 0.0, 1.0
    for k in range(3):
        d = b[k] - a[k]
        if abs(d) < 1e-9:
            if a[k] < lo[k] or a[k] > hi[k]:
                return False
            continue
        u, v = (lo[k] - a[k]) / d, (hi[k] - a[k]) / d
        if u > v:
            u, v = v, u
        u0, u1 = max(u0, u), min(u1, v)
        if u0 > u1:
            return False
    return True


def zw_clear_view(t0, t1, step=12):
    """NO TREE / PROP BETWEEN THE LENS AND THE CAST (owner 2026-11-14): at a few frames, the lines from the camera to the
    characters in view; a library tree, lamp, bench, car, asset or small prop that crosses one (before the character)
    is hidden for this shot. Buildings are never hidden (the static check keeps cameras in open space); the landmark, the
    story's own builds and the characters are never touched. Best effort: never fails a shot."""
    sc = bpy.context.scene
    cam = sc.camera
    if cam is None:
        return 0
    f0, f1 = F(t0), max(F(t0), F(t1) - 1)
    cands = []
    for o in D.objects:
        n = o.name
        if not (n.startswith("zw_") or n.startswith("za_")) or n.startswith("zw_lm_") or n.startswith("zw_src_") or "cloud" in n or "hill" in n:
            continue
        if o.hide_render:
            continue
        inst = o.type == "EMPTY" and o.instance_type == "COLLECTION"
        if not inst and o.type != "MESH":
            continue
        bx = zw_box_of(o)
        if bx is None:
            continue
        lo, hi = bx
        h, w = hi.z - lo.z, max(hi.x - lo.x, hi.y - lo.y)
        if h < 0.3 or w > 60 or (not inst and (h > 6.5 or w > 12)):
            continue   # ground, roads, buildings, walls: never hidden
        cands.append((o, lo, hi))
    hidden = set()
    for f in sorted(set([f0, (f0 + f1) // 2, f1])):
        sc.frame_set(f)
        tv = cam.data.sensor_height / (2.0 * cam.data.lens) * 1.05   # tan of half the vertical view (the lens is keyed)
        th = tv * 9.0 / 16.0
        c = cam.matrix_world.translation.copy()
        inv = cam.matrix_world.inverted()
        pts = []
        for name, lo, hi in zw_cast_boxes():
            for fz in (0.35, 0.8):
                q = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z + fz * (hi.z - lo.z)))
                v = inv @ q
                if v.z < -0.5 and abs(v.y / -v.z) < tv and abs(v.x / -v.z) < th:
                    pts.append(q)
        segs = [(c, c + (q - c) * 0.9) for q in pts[:8]]
        # the NEAR CENTRE of the view (round 2 of the first test: a tested "close" spot aimed past the cast at a sidewalk
        # tree that filled the frame): 9 rays through the middle of the frame, as far as the nearest cast point (max 14)
        rot = cam.matrix_world.to_3x3()
        near = min([(q - c).length * 0.9 for q in pts] + [14.0])
        for u in (-0.4, 0.0, 0.4):
            for v in (-0.4, 0.0, 0.4):
                d = rot @ Vector((u * th, v * tv, -1.0))
                d.normalize()
                segs.append((c, c + d * near))
        for a, e in segs:
            for o, lo, hi in cands:
                inst = o.type == "EMPTY"
                inside = lo.x <= c.x <= hi.x and lo.y <= c.y <= hi.y and lo.z <= c.z <= hi.z
                # a camera inside an instanced tree / lamp: that tree goes (a mesh around the camera, e.g. a room, stays)
                if o.name not in hidden and (inst or not inside) and zw_seg_hits(a, e, lo, hi):
                    hidden.add(o.name)
    for o, lo, hi in cands:
        if o.name in hidden:
            sc.frame_set(f1 + 1)
            after = o.hide_render
            o.hide_render = True
            o.keyframe_insert("hide_render", frame=f0)
            o.hide_render = after
            o.keyframe_insert("hide_render", frame=f1 + 1)
    sc.frame_set(f0)
    if hidden:
        print("zw_clear_view: hid %d object(s) in front of the lens: %s" % (len(hidden), ", ".join(sorted(hidden)[:12])))
    return len(hidden)


# ================================================================ ROUND 1 (owner 2026-11-21): look, night, monsters, faces
# SAFE AREA of a 9:16 frame (u = 0 left .. 1 right, v = 0 top .. 1 bottom): faces sit inside it; below v 0.64 is the
# caption zone (captions run at about 66-73 % of the height)
ZW_SAFE = {"l": 0.06, "r": 0.94, "t": 0.05, "b": 0.64}
# rooms + the kit's sets in Standard (round 1b): their AgX-tuned lights x this (walls stayed white-hot at 1.0)
ZW_INDOOR_LIGHT = {"living_room": 0.6, "bedroom": 0.6, "kitchen": 0.6, "shop": 0.7, "big_hall": 0.7, "plane_cabin": 0.65,
                   "cockpit": 0.65, "classroom": 0.6, "hallway": 0.6, "moon": 0.8, "sky_airliner": 0.8}
ZW_CAPTION = (0.62, 0.76)
ZW_MON = {}      # name -> the monster Char (zw_monster), this shot
ZW_MON_RIM = {}  # name -> its rim light colour
ZW_EXTRAS = set()  # background extras this shot (zw_flee): not measured by the face gate
ZW_FRAMED = {}   # what zw_frame / zw_monster_cam did this shot (for the log)
ZW_LASTFIT = {}  # the last zw_fit: loc, aim, lens, clear, ok (round 2: zw_scene_cam keys start + end from it)


def zw_pts(obs):
    """the 8 world corners of the bounding box of these objects' visible meshes (children included)"""
    lo, hi = Vector((1e9, 1e9, 1e9)), Vector((-1e9, -1e9, -1e9))
    for ob in obs:
        for m in [ob] + list(ob.children_recursive):
            if m.type not in ("MESH", "CURVE", "FONT") or not m.visible_get():
                continue
            for c in m.bound_box:
                w = m.matrix_world @ Vector(c)
                lo = Vector((min(lo.x, w.x), min(lo.y, w.y), min(lo.z, w.z)))
                hi = Vector((max(hi.x, w.x), max(hi.y, w.y), max(hi.z, w.z)))
    if lo.x > 1e8:
        return []
    return [Vector((x, y, z)) for x in (lo.x, hi.x) for y in (lo.y, hi.y) for z in (lo.z, hi.z)]


def zw_head_pts(ch):
    return zw_pts([ch.head])


def zw_body_pts(ch):
    """head + torso + arms (not the legs: a two-shot frames people from the hips up)"""
    obs = [ch.head, ch.torso] + [o for o in ch.root.children_recursive if o.name.endswith("_armL") or o.name.endswith("_armR")]
    return zw_pts(obs)


def zw_uv(cam, p):
    """a world point -> (u, v) on the 9:16 frame (0..1, v from the top), or None behind the lens"""
    q = cam.matrix_world.inverted() @ p
    if q.z > -0.05:
        return None
    tv = cam.data.sensor_height / (2.0 * cam.data.lens)
    th = tv * 9.0 / 16.0
    return (0.5 + 0.5 * (q.x / -q.z) / th, 0.5 - 0.5 * (q.y / -q.z) / tv)


def zw_span(cam, pts):
    uv = [zw_uv(cam, p) for p in pts]
    if not uv or any(x is None for x in uv):
        return None
    us, vs = [x[0] for x in uv], [x[1] for x in uv]
    return min(us), max(us), min(vs), max(vs)


def zw_front(chars):
    """the average facing of these characters (a kit character at rot 0 faces -y)"""
    f = Vector((0, 0, 0))
    for ch in chars:
        a = ch.root.rotation_euler[2]
        f += Vector((math.sin(a), -math.cos(a), 0))
    if f.length < 1e-3:
        return Vector((0, -1, 0))
    return f.normalized()


def zw_blocked(a, b, skip):
    """True when a solid object (not a character in `skip`, not a library tree / lamp / prop that zw_clear_view hides)
    sits between the points a and b"""
    try:
        dg = bpy.context.evaluated_depsgraph_get()
        d = b - a
        hit, loc, nrm, idx, ob, mw = bpy.context.scene.ray_cast(dg, a, d.normalized(), distance=d.length)
    except Exception:
        return False
    if not hit or ob is None:
        return False
    n = ob.name
    if any(n.startswith(s) for s in skip) or n.startswith("zw_fog"):
        return False
    return not any(k in n for k in ("tree", "lamp", "bench", "bush", "flower", "hydrant", "bin", "planter", "person", "car", "za_"))


def zw_fit(cam, pts, fwd, t0, t1, lens, safe, frac=None, cam_dz=0.0, yaws=(0.0,), push=0.05, skip=(), tag="frame"):
    """THE FRAMING SOLVER: put the camera in front of `fwd` (turned by the first clear yaw) so the box of `pts` sits INSIDE
    `safe` (u/v limits) at the start AND the end of the push; `frac` = the box's wanted share of the frame height
    (None: as big as fits). Distance from the box and the lens's field of view; the aim corrected until it fits."""
    sc = bpy.context.scene
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    c = (lo + hi) / 2
    h = max(0.3, hi.z - lo.z)
    w = max(0.3, hi.x - lo.x, hi.y - lo.y)
    tv = 12.0 / lens
    th = tv * 9.0 / 16.0
    bv, bu = safe["b"] - safe["t"], safe["r"] - safe["l"]
    want_v, want_u = (safe["t"] + safe["b"]) / 2, (safe["l"] + safe["r"]) / 2
    d0 = h / ((frac or bv * 0.92) * 2 * tv)
    d0 = max(d0, w / (bu * 2 * th))
    up = Vector((0, 0, 1))
    best = None
    for yaw in yaws:
        a = math.radians(yaw)
        f = Vector((fwd.x * math.cos(a) - fwd.y * math.sin(a), fwd.x * math.sin(a) + fwd.y * math.cos(a), 0))
        d = d0
        aim = c.copy()
        ok, loc, aim_v = False, c + f * d, c.copy()
        for it in range(24):
            loc = c + f * d + up * cam_dz
            if loc.z < 0.8:   # round 3 (the replica lesson): never under the ground
                loc.z = 0.8
            aim_v = aim.copy()
            end = loc + (aim_v - loc) * push
            cam.key(t0, tuple(loc), tuple(aim_v), lens=lens)
            cam.key(t1, tuple(end), tuple(aim_v), lens=lens)
            spans = []
            for fr in (F(t0), max(F(t0), F(t1) - 1)):
                sc.frame_set(fr)
                spans.append(zw_span(cam.ob, pts))
            sc.frame_set(F(t0))
            if any(s is None for s in spans):
                d *= 1.15
                continue
            u0, u1 = min(s[0] for s in spans), max(s[1] for s in spans)
            v0, v1 = min(s[2] for s in spans), max(s[3] for s in spans)
            ok = u0 >= safe["l"] and u1 <= safe["r"] and v0 >= safe["t"] and v1 <= safe["b"]
            if ok:
                break
            if (u1 - u0) > bu or (v1 - v0) > bv:
                d *= 1.08
                continue
            # move the aim so the box's centre lands in the middle of the safe area
            vis_h, vis_w = 2 * tv * d, 2 * th * d
            right = up.cross(f).normalized()   # the camera looks along -f: its right is up x f
            dv, du = (v0 + v1) / 2 - want_v, (u0 + u1) / 2 - want_u
            aim = aim - up * (dv * vis_h) + right * (du * vis_w)
        sights = [c] + [c + (p - c) * 0.8 for p in (pts[0], pts[3], pts[4], pts[7])]
        clear = not any(zw_blocked(q + (loc - q).normalized() * min(1.5, d * 0.2), loc, skip) for q in sights)
        if best is None or (clear and not best[2]):
            best = (loc, aim_v, clear, yaw, d, ok)
        if clear and ok:
            break
    loc, aim_v, clear, yaw, d, ok = best
    end = loc + (aim_v - loc) * push
    cam.key(t0, tuple(loc), tuple(aim_v), lens=lens)
    cam.key(t1, tuple(end), tuple(aim_v), lens=lens)
    ZW_FRAMED[tag] = "yaw %d d %.1f lens %d fits %s clear %s" % (yaw, d, lens, ok, clear)
    ZW_LASTFIT.clear()
    ZW_LASTFIT.update(loc=loc.copy(), aim=aim_v.copy(), lens=lens, clear=clear, ok=ok)
    return loc, aim_v


def zw_frame(cam, chars, t0, t1, kind="close", yaw=16.0, lens=None, push=0.05):
    """A FACE THAT IS NEVER CROPPED (owner 2026-11-21): the camera is placed by MEASURING the head box (kind "close") or
    the hips-up box of every character listed (kind "two", any number of people), so the whole head / bodies sit inside
    the safe area (top 64 % of the frame, 6 % from the sides, 5 % from the top), above the captions. Close-up: the head
    about 27 % of the frame height, lens 34 (a 39 degree view); two-shot: lens 30, as big as fits. The camera stays in
    front of the faces (their average facing), turned `yaw` degrees; a wall in the way tries the other side / straight on."""
    chars = list(chars)
    bpy.context.scene.frame_set(F(t0))   # the pose at the start: new objects have no world matrix before an update
    pts = []
    for ch in chars:
        pts += zw_head_pts(ch) if kind == "close" else zw_body_pts(ch)
    if not pts:
        return None
    s = max(ch.root.scale[2] for ch in chars)
    skip = tuple(ch.name + "_" for ch in chars)
    yaws = (yaw, -yaw, 0.0, 2 * yaw, -2 * yaw, 3 * yaw, -3 * yaw)
    if kind == "close":
        # round 1b (owner): head + the TOP OF THE SHOULDERS only (round 1 was a waist shot): the box is the head and a
        # 0.7-unit band at the top of the torso and arms; it fills half the frame height, so the head is about a third of it
        for ch in chars:
            sh = zw_pts([ch.torso])   # the arms may leave the 9:16 frame at the sides (a close-up), the face never
            if sh:
                top = max(p.z for p in sh)
                pts += [Vector((p.x, p.y, max(p.z, top - 0.7 * ch.root.scale[2]))) for p in sh]
        return zw_fit(cam, pts, zw_front(chars), t0, t1, lens or 34, ZW_SAFE, frac=0.5, cam_dz=0.1 * s, yaws=yaws, push=push, skip=skip, tag="close")
    return zw_fit(cam, pts, zw_front(chars), t0, t1, lens or 30, ZW_SAFE, frac=None, cam_dz=0.1 * s, yaws=yaws, push=push, skip=skip, tag="two")


# ---------------------------------------------------------------- MONSTERS AS CHARACTERS (owner 2026-11-21)
ZW_MON_STYLES = {
    # skin, shirt, pants, eyes, brows/mouth, rim light
    "horns": ("#8a4fe0", "#3b2470", "#24163f", "#ffe14d", "#1a0f2e", (0.55, 0.85, 1.0)),
    "slime": ("#4fd16a", "#1f7a3a", "#14502a", "#ff4040", "#0d2a14", (1.0, 0.55, 0.85)),
    "ember": ("#e0503a", "#5a1d1a", "#2e0f0e", "#ffe680", "#200806", (0.6, 0.8, 1.0)),
    "frost": ("#7fd3ff", "#2a5f9e", "#163a66", "#ff5ad1", "#0b1d33", (1.0, 0.75, 0.45)),
}


def zw_monster(name, loc, rot=0.0, size=3.5, style="horns", skin=None, shirt=None, pants=None, eyes=None):
    """A MONSTER IS A CHARACTER, NOT A WALL: a blocky kit character `size` times a kid (2-4), in its OWN colours (never
    plain grey), with a face you can read from far away: glowing eyes (the only thing that glows), angry brows, a wide
    mouth with teeth, horns (style "horns") and back spikes for a clear outline. A rim light behind it (zw_after_build,
    from the camera's side) separates its outline from the background. Returns the Char: pose / walk / zw_grow it like
    any character; film it with zw_monster_cam."""
    st = ZW_MON_STYLES.get(style, ZW_MON_STYLES["horns"])
    size = min(4.0, max(3.0, float(size)))   # owner 2026-11-21: 3-4x a person's height
    sk, sh, pa, ey, dk = skin or st[0], shirt or st[1], pants or st[2], eyes or st[3], st[4]
    m = chars.Char(name, skin=sk, shirt=sh, pants=pa, hair="spiky", hair_color=dk, face=None, loc=tuple(loc), rot=rot, scale=size)
    n, H = name, m.head
    Me = zw_m("mon_eye_" + ey[1:], "#ffffff", 0.3, emit=ey, estr=9.0)
    Md = zw_m("mon_dark_" + dk[1:], dk, 0.6)
    Mt = zw_m("mon_teeth", "#fff8e8", 0.4)
    # head-local: the head is a 0.62-radius cylinder centred on its object, front face at y = -0.62
    for sx in (-1, 1):
        # meaner (round 1b), still kid-safe: narrow slanted eyes, steep heavy brows, two fangs; nothing gory
        box(n + "_eye%d" % sx, (0.3, 0.05, 0.14), (sx * 0.24, -0.63, 0.1), Me, 0.03, rot=(0, sx * -10, 0), parent=H, coll=m.coll)
        box(n + "_pupil%d" % sx, (0.06, 0.03, 0.13), (sx * 0.22, -0.665, 0.1), Md, 0.0, parent=H, coll=m.coll)
        box(n + "_brow%d" % sx, (0.4, 0.09, 0.11), (sx * 0.25, -0.65, 0.3), Md, 0.02, rot=(0, sx * -32, 0), parent=H, coll=m.coll)
        box(n + "_fang%d" % sx, (0.09, 0.06, 0.2), (sx * 0.24, -0.66, -0.36), Mt, 0.0, parent=H, coll=m.coll)
        cyl(n + "_horn%d" % sx, 0.16, 0.7, (sx * 0.36, 0.0, 0.85), Md, 12, rot=(0, sx * 24, 0), parent=H, coll=m.coll, r2=0.02) if style == "horns" else None
    box(n + "_mouth", (0.62, 0.05, 0.2), (0, -0.63, -0.24), Md, 0.04, parent=H, coll=m.coll)
    for k in range(4):
        box(n + "_tooth%d" % k, (0.1, 0.06, 0.09), (-0.22 + k * 0.147, -0.655, -0.17), Mt, 0.0, parent=H, coll=m.coll)
    for k in range(3):
        cyl(n + "_spike%d" % k, 0.22, 0.55, (0, 0.62, 1.7 - k * 0.6), zw_m("mon_spike_" + dk[1:], dk, 0.5), 8, rot=(-70, 0, 0), parent=m.hip, coll=m.coll, r2=0.02)
    ZW_MON[name] = m
    ZW_MON_RIM[name] = st[5]
    return m


def zw_monster_cam(cam, m, t0, t1, view="full", yaw=14.0, push=0.05):
    """the monster SHOWN: view "full" = the whole body with its outline clear of the frame edges, from a low camera
    (looking up: it is big), feet in frame for scale; "face" = the whole head above the captions (a close-up that never
    turns into a wall of skin). Uses the same measuring solver as zw_frame."""
    bpy.context.scene.frame_set(F(t0))
    s = m.root.scale[2]
    yaws = (yaw, -yaw, 0.0, 2 * yaw, -2 * yaw, 3 * yaw, -3 * yaw, 70.0, -70.0, 100.0, -100.0)   # round 5: the street sides too (a roof blocked every near angle)
    skip = (m.name + "_",)
    if view == "face":
        return zw_fit(cam, zw_head_pts(m), zw_front([m]), t0, t1, 32, ZW_SAFE, frac=0.3, cam_dz=-0.4 * s, yaws=yaws, push=push, skip=skip, tag="monster_face")
    safe = {"l": 0.08, "r": 0.92, "t": 0.06, "b": 0.93}
    if view == "reveal":
        # THE REVEAL (owner 2026-11-21): from a LOW angle (the lens 1.2 above the street, looking up), the whole monster
        # with its face inside the frame, the street and the people running away at its feet
        safe = {"l": 0.07, "r": 0.93, "t": 0.05, "b": 0.95}
        box = zw_pts([m.root])
        mid_z = (min(p.z for p in box) + max(p.z for p in box)) / 2
        return zw_fit(cam, box, zw_front([m]), t0, t1, 22, safe, frac=0.62, cam_dz=1.2 - mid_z, yaws=yaws, push=push, skip=skip, tag="monster_reveal")
    return zw_fit(cam, zw_pts([m.root]), zw_front([m]), t0, t1, 26, safe, frac=0.6, cam_dz=-(2.6 * s) + 2.2, yaws=yaws, push=push, skip=skip, tag="monster_full")


def zw_flee(m, t0, t1, n=3, seed=5):
    """people RUNNING AWAY from the monster: n kids start near its feet (in front of it, to both sides) and run out and
    toward the front, terrified faces; returns them"""
    rnd = random.Random(seed)
    p = Vector(m.root.location)
    s = m.root.scale[2]
    f = zw_front([m])
    side = Vector((f.y, -f.x, 0))
    out = []
    for k in range(n):
        sx = (-1) ** k
        a = p + f * (1.2 * s + 1.4 * k) + side * sx * (1.4 * s + rnd.uniform(0.0, 2.0))
        b = a + (f * 0.55 + side * sx * 0.85).normalized() * (5.0 + 2.0 * k)
        ch = chars.kid(40 + k + seed)
        ch.run(t0, t1, (a.x, a.y, 0.0), (b.x, b.y, 0.0))
        zw_emote(ch, t0, t1, "terrified")
        ZW_EXTRAS.add(ch.name)
        out.append(ch)
    return out


# ---------------------------------------------------------------- EXPRESSIONS (owner 2026-11-21, round 1b)
# Faces match the line, never one blank stare: our emotion names -> the kit's layered face expressions (eyes + mouth
# cells). zw_emote(ch, t0, t1, emo, talk=False): the face from t0, lip flaps on the shot's words when talk=True (the mouth
# rests in the emotion's shape between words), blinks every 2-4 s. A character the shot code gave no face gets one from
# the shot's words + desc in the after-build hook (zw_auto_faces).
ZW_EMO = {"neutral": "neutral", "scared": "scared", "terrified": "terror", "shocked": "shock", "happy": "happy",
          "laughing": "joy", "sad": "worried", "crying": "cry", "angry": "angry", "confused": "confused",
          "smirk": "smug", "determined": "determined", "surprised": "gasp", "panic": "panic"}
ZW_EMO_WORDS = [
    ("terrified", ("terrif", "horrif", "run for", "screams", "scream", "run!", "runs away", "panic")),
    ("crying", ("cry", "cries", "tears", "sob")),
    ("laughing", ("laugh", "giggl", "haha", "joke", "funny")),
    ("angry", ("angry", "mad ", "furious", "yell", "shout")),
    ("shocked", ("shock", "gasp", "can't believe", "suddenly", "what?!", "no way", "wait")),
    ("scared", ("scared", "afraid", "fear", "creep", "monster", "dark", "shadow", "noise", "behind")),
    ("sad", ("sad", "lonely", "miss ", "sorry", "lost", "alone")),
    ("confused", ("confus", "why", "huh", "weird", "strange", "how")),
    ("smirk", ("smirk", "sneak", "trick", "secret", "plan")),
    ("determined", ("determin", "decide", "must", "brave", "stop it", "fight", "save")),
    ("happy", ("happy", "smile", "love", "yay", "fun", "best", "great")),
]
ZW_EMOTED = {}   # character name -> the expression this shot gave it
# THE FIRST LIVE RUNS (2026-11-21, run df9b8ec8: 26 of 74 shots crashed): the director also calls the kit's own
# ch.face(t, "terrified") with OUR emotion names (KeyError in the kit's EXPR) and writes ch.armR / ch.legL (the pose
# keyword names; the kit's pivots are shL / shR / hpL / hpR). Both work now: our names are added to the kit's EXPR,
# and armL / armR / legL / legR read the matching pivot.
try:
    for zk, zv in ZW_EMO.items():
        if zk not in story.acting.EXPR and zv in story.acting.EXPR:
            story.acting.EXPR[zk] = story.acting.EXPR[zv]
    chars.Char.armL = property(lambda c: c.shL)
    chars.Char.armR = property(lambda c: c.shR)
    chars.Char.legL = property(lambda c: c.hpL)
    chars.Char.legR = property(lambda c: c.hpR)
except Exception as e:
    print("zw_compat skipped: %s" % e)


def zw_emo_of(text):
    t = " %s " % str(text or "").lower()
    for emo, keys in ZW_EMO_WORDS:
        if any(k in t for k in keys):
            return emo
    return "neutral"


def zw_emote(ch, t0, t1, emo="neutral", talk=False, blink=True):
    """the character's FACE for this shot: emo = scared | terrified | shocked | happy | laughing | sad | crying | angry |
    confused | smirk | determined | surprised | panic | neutral; talk=True flaps the lips on the shot's spoken words"""
    if ch.name in ZW_DOTCHARS:   # round 3: our dot face (the In This Town default)
        zw_dot_apply(ch, t0 - 0.05, emo, talk=(t0, t1) if talk else None)
        ZW_EMOTED[ch.name] = emo
        return ch
    expr = ZW_EMO.get(emo, emo if emo in story.acting.EXPR else "neutral")
    ch.face(t0, expr)
    if talk:
        e_eyes, e_mouth = story.acting.EXPR[expr]
        ch.talk(t0, t1, V.span(t0, t1), rest=e_mouth)
    if blink:
        ch.blink(t0, t1, every=(2.0, 4.0))
    ZW_EMOTED[ch.name] = expr
    return ch


def zw_auto_faces(S):
    """the hook's fallback: every visible character the shot code gave no face in this shot gets the emotion of the shot's
    words and desc (and blinks); a character the code DID give a face keeps it (+ blinks)"""
    t0, t1 = S["t0"], S["t1"]
    try:
        words = " ".join(w.get("word", "") for w in V.span(t0, t1))
    except Exception:
        words = ""
    emo = zw_emo_of(words + " " + str(S.get("desc", "")))
    n = 0
    for nm, ch in zw_cast():
        if nm in ZW_MON or nm in ZW_EMOTED:
            continue
        if ch.name in ZW_DOTCHARS:
            zw_emote(ch, t0, t1, emo)
            n += 1
            continue
        if not hasattr(ch, "_eye_track"):
            continue
        if any(t0 - 0.01 <= t < t1 for t, _ in ch._eye_track):
            ch.blink(t0, t1, every=(2.0, 4.0))
            continue
        zw_emote(ch, t0, t1, emo)
        n += 1
    return n


# ---------------------------------------------------------------- ROUND 2 (owner 2026-11-21): shot cards -> the stage
# The director's shot cards (director2.mjs) are compiled by cards.mjs into calls of these helpers: the stage of a place
# (where the cast stands, facing the camera side), a cast member with the plan's exact look, and ONE camera for every
# card type, measured on the things the card must show (zw_fit).
def zw_stage(place):
    """(centre (x, y), forward (unit, from the camera side INTO the place), right (unit), rot in degrees for people facing
    the camera side) from the place's tested close spot"""
    loc, tgt, ln = ZW_SPOTS.get(place, ZW_SPOTS["downtown_street"])["close"]
    d = Vector((tgt[0] - loc[0], tgt[1] - loc[1], 0))
    d = d.normalized() if d.length > 1e-3 else Vector((0, 1, 0))
    right = Vector((d.y, -d.x, 0))
    rot = math.degrees(math.atan2(-d.x, d.y))   # a kit character at rot a faces (sin a, -cos a); we want it to face -d
    return Vector((tgt[0], tgt[1], 0)), d, right, rot


def zw_spotpos(place, k, n, depth=0.0, spacing=2.6):
    """the k-th of n stage marks (left to right as the camera sees them), `depth` units further into the place"""
    c, d, right, rot = zw_stage(place)
    p = c + right * ((k - (n - 1) / 2.0) * spacing) + d * depth
    return (p.x, p.y, 0.0)


def zw_person(name, look, loc, rot, t0):
    """a cast member with the plan's look: {skin, shirt, pants, hair, hair_color, face, kid}; adults 1.15x"""
    lk = look or {}
    hair = lk.get("hair", "short") if lk.get("hair") in ("spiky", "slick", "short", "messy", "cap", "bob", "buzz", "bun", "tophat", "bald", "none") else "short"
    face = lk.get("face", "kid") if lk.get("face") in ("kid", "girl", "hero", "plain", "mustache", "villain") else "kid"
    col = lambda v, d: v if isinstance(v, str) and len(v) == 7 and v.startswith("#") else d
    dot = zw_dot_style()
    ch = chars.Char(name, skin=col(lk.get("skin"), "#f1dfc6"), shirt=col(lk.get("shirt"), "#4aa5e8"), pants=col(lk.get("pants"), "#2f3f7a"),
                    hair=hair, hair_color=col(lk.get("hair_color"), "#3a2a1e"), face=None if dot else face, scale=1.0 if lk.get("kid", True) else 1.15)
    ch.pose(t0, loc=tuple(loc), rot=rot)
    if dot:
        ZW_DOTCHARS.add(ch.name)
        zw_dot_apply(ch, t0 - 1.0, "neutral")
    return ch


ZW_SHOT_KINDS = {
    # lens, safe area, frac (box share of the frame height; None = as big as fits), camera height over the box centre
    "wide": (22, {"l": 0.06, "r": 0.94, "t": 0.08, "b": 0.92}, 0.42, 3.0),
    "medium": (30, ZW_SAFE, 0.55, 0.6),   # round 3: measured to a target size (hips-up box 55% of the height), not as big as fits
    "insert": (34, {"l": 0.1, "r": 0.9, "t": 0.12, "b": 0.6}, 0.45, 1.2),
    "low": (26, {"l": 0.06, "r": 0.94, "t": 0.05, "b": 0.9}, 0.62, -2.2),
    "high": (24, {"l": 0.06, "r": 0.94, "t": 0.08, "b": 0.92}, 0.5, 9.0),
}


def zw_shot(cam, kind, t0, t1, people=(), things=(), yaw=14.0, move="push"):
    """ONE camera for a card: the box of the card's people (hips up; the whole body for wide / low / high) and things,
    fitted into the frame (zw_fit: measured, tries other sides when a wall is in the way); move: push / pull / still / pan"""
    bpy.context.scene.frame_set(F(t0))
    people = [p for p in people if p is not None]
    things = [t for t in things if t is not None]
    if kind == "close" and people:
        return zw_frame(cam, people[:1], t0, t1, kind="close", push=0.05 if move == "push" else 0.0)
    if kind == "two" and people:
        return zw_frame(cam, people, t0, t1, kind="two", push=0.04 if move == "push" else 0.0)
    if kind in ("monster_reveal", "monster_full") and people:
        mon = [p for p in people if p.name in ZW_MON]
        if mon:
            return zw_monster_cam(cam, mon[0], t0, t1, view="reveal" if kind == "monster_reveal" else "full")
    lens, safe, frac, dz = ZW_SHOT_KINDS.get(kind, ZW_SHOT_KINDS["medium"])
    pts = []
    for p in people:
        # round 3: the RENDERED outline (vertices), not boxes (spiky hair's empty box made heads ~20% small)
        obs = [p.root] if kind in ("wide", "low", "high") or p.name in ZW_MON else [p.head, p.torso] + [o for o in p.root.children_recursive if o.name.endswith("_armL") or o.name.endswith("_armR")]
        vp = zw_vpts(obs)
        pts += vp if len(vp) >= 8 else (zw_pts([p.root]) if kind in ("wide", "low", "high") or p.name in ZW_MON else zw_body_pts(p))
    for t in things:
        pts += zw_pts([t])
    if not pts:
        return None
    s = max([p.root.scale[2] for p in people] + [1.0])
    front = zw_front(people) if people else Vector((0, -1, 0))
    push = {"push": 0.06, "pull": -0.05, "still": 0.0, "pan": 0.0}.get(move, 0.04)
    yaws = (yaw, -yaw, 0.0, 2 * yaw, -2 * yaw, 3 * yaw, -3 * yaw) if move != "pan" else (yaw + 10, -yaw - 10, yaw, -yaw)
    skip = tuple(p.name + "_" for p in people)
    r = zw_fit(cam, pts, front, t0, t1, lens, safe, frac=frac, cam_dz=dz * s, yaws=yaws, push=push, skip=skip, tag=kind)
    if not ZW_LASTFIT.get("clear", True) and ZW_T.get("_place") in ZW_SPOTS:
        # round 2 (the first storyboards: a wide camera backed into a wall / the fountain = one flat colour): the TESTED spot
        sp = "wide" if kind in ("wide", "high") else ("street" if "street" in ZW_SPOTS[ZW_T["_place"]] else "close")
        loc, tgt = zw_spot(cam, ZW_T["_place"], sp, t0, t1)
        ZW_FRAMED[kind] = "tested %s spot (the measured camera was blocked)" % sp
        ZW_LASTFIT.update(loc=Vector(loc), aim=Vector(tgt), lens=ZW_SPOTS[ZW_T["_place"]][sp][2], clear=True, ok=False)
    return r


def zw_scene_cam(cam, t0, t1, a, b, yaw=14.0, cut=False):
    """ROUND 2 SCENE CARDS: the camera of the START frame and of the END frame, each measured on that frame's own people and
    things (a = (kind, people, things, side) at t0, b = the same at t1); the camera moves between them over the scene.
    side: front / left / right / behind -> the yaw the solver starts from."""
    def one(spec, ta, tb):
        kind, people, things, side = spec
        y = {"left": -40.0, "right": 40.0, "behind": 120.0}.get(side, yaw)
        ZW_LASTFIT.clear()
        if people or things:
            zw_shot(cam, kind, ta, tb, people=people, things=things, yaw=y, move="still")
        return ZW_LASTFIT.get("loc"), ZW_LASTFIT.get("aim"), ZW_LASTFIT.get("lens", 30)
    eps = 0.04
    lb, ab, nb = one(b, t1 - eps, t1)
    la, aa, na = one(a, t0, t0 + eps)
    for o in (cam.ob, cam.cd):
        if o.animation_data:
            o.animation_data_clear()
    if la is None and lb is None:
        return zw_spot(cam, ZW_T.get("_place", "downtown_street"), "wide", t0, t1)
    if la is None:
        la, aa, na = lb, ab, nb
    if cut and lb is not None and (t1 - t0) > 1.2:
        # round 4 (owner: a cut about every 1.2 s): the start framing (a small push) to halfway, a hard CUT, the end framing
        tm = (t0 + t1) / 2.0
        cam.key(t0, tuple(la), tuple(aa), lens=na)
        cam.key(tm - 1.0 / 30.0, tuple(Vector(la) + (Vector(aa) - Vector(la)) * 0.04), tuple(aa), lens=na, interp="CONSTANT")
        cam.key(tm, tuple(lb), tuple(ab), lens=nb)
        cam.key(t1, tuple(Vector(lb) + (Vector(ab) - Vector(lb)) * 0.04), tuple(ab), lens=nb)
        return la, aa
    cam.key(t0, tuple(la), tuple(aa), lens=na)
    if lb is not None:
        cam.key(t1, tuple(lb), tuple(ab), lens=nb)
    return la, aa


# ---------------------------------------------------------------- SHOW THE TOWN (owner 2026-11-22, round 4)
# The first shot of every place MOVES through the set: STREET GLIDE (down the street past houses, people and cars, at
# eye level), LOW DRONE (low over the street, looking down a little), FOLLOW WALK (behind a character walking along the
# street). Never one house. Paths per place: a = start, b = end; la / lb = where the lens looks.
ZW_GLIDE = {
    "suburb_street": dict(a=(-40, -2.2, 4.4), b=(-12, -0.8, 4.0), la=(-14, 13, 3.6), lb=(3, 9, 3.4)),
    "suburb_porch": dict(a=(-34, -2.2, 4.4), b=(-8, 1.0, 4.0), la=(-10, 14, 3.6), lb=(0, 16, 3.6)),
    "downtown_street": dict(a=(3.5, -14, 4.6), b=(2.5, 16, 4.2), la=(-2, 26, 5.5), lb=(7, 38, 4.4)),
    "downtown_plaza": dict(a=(-16, -64, 5.0), b=(-7, -38, 4.2), la=(-4, -40, 4.0), lb=(0, -18, 3.4)),
    "downtown_landmark": dict(a=(3, 96, 5.0), b=(1.5, 126, 4.4), la=(0, 130, 8), lb=(0, 160, 10)),
    "brick_street": dict(a=(3.5, -14, 4.6), b=(3.0, 16, 4.2), la=(-2, 22, 5), lb=(6, 38, 4.4)),
    "brick_alley": dict(a=(3, 46, 4.4), b=(-6, 62, 4.0), la=(-8, 66, 3.6), lb=(-18, 74, 3.2)),
}


def zw_est_clear(pts):
    """no path point inside a character (incl. the monsters) or right next to one"""
    boxes = [(lo - Vector((1.2, 1.2, 1.2)), hi + Vector((1.2, 1.2, 1.2))) for _, lo, hi in zw_cast_boxes()]
    for nm, m in ZW_MON.items():
        try:
            pp = zw_pts([m.root])
            lo = Vector((min(p.x for p in pp), min(p.y for p in pp), min(p.z for p in pp)))
            hi = Vector((max(p.x for p in pp), max(p.y for p in pp), max(p.z for p in pp)))
            boxes.append((lo - Vector((2.0, 2.0, 2.0)), hi + Vector((2.0, 2.0, 2.0))))
        except Exception:
            pass
    for p in pts:
        for lo, hi in boxes:
            if lo.x <= p.x <= hi.x and lo.y <= p.y <= hi.y and lo.z <= p.z <= hi.z:
                return False
    return True


def zw_establish(cam, t0, t1, place, style="glide", follow=None, end=None):
    """round 5: with end = the card's END framing spec (kind, people, things, side), the move ends exactly on it (the
    people the words are about in frame), from the place's glide / drone start; the path stays clear of every body"""
    if end is not None and (end[1] or end[2]):
        ZW_LASTFIT.clear()
        kind, people, things, side = end
        y = {"left": -40.0, "right": 40.0, "behind": 120.0}.get(side, 14.0)
        zw_shot(cam, kind, t1 - 0.04, t1, people=people, things=things, yaw=y, move="still")
        lb, ab, nb = ZW_LASTFIT.get("loc"), ZW_LASTFIT.get("aim"), ZW_LASTFIT.get("lens", 26)
        if lb is not None:
            for o in (cam.ob, cam.cd):
                if o.animation_data:
                    o.animation_data_clear()
            g = ZW_GLIDE.get(place)
            lb, ab = Vector(lb), Vector(ab)
            if g is not None and style != "follow":
                a, la = Vector(g["a"]), Vector(g["la"])
                if style == "drone":
                    a = a + Vector((0, 0, 9.0))
            else:
                back = (lb - ab)
                back.z = 0
                back = back.normalized() if back.length > 1e-3 else Vector((0, -1, 0))
                a, la = lb + back * 9.0 + Vector((0, 0, 2.5 if style == "drone" else 0.6)), ab
            mid = a.lerp(lb, 0.5)
            for k in range(4):
                if zw_est_clear([a.lerp(lb, u / 6.0) for u in range(7)]):
                    break
                a = a + Vector((0, 0, 2.5))   # over the heads
            cam.key(t0, tuple(a), tuple(la), lens=24)
            cam.key((t0 + t1) / 2.0, tuple(mid + Vector((0, 0, 0.8))), tuple(la.lerp(ab, 0.6)), lens=int(round((24 + nb) / 2)))
            cam.key(t1, tuple(lb), tuple(ab), lens=nb)
            ZW_FRAMED["establish"] = "%s -> the card's end framing" % style
            return a, la
    return zw_establish0(cam, t0, t1, place, style, follow)


def zw_establish0(cam, t0, t1, place, style="glide", follow=None):
    """the place's MOVING establishing shot: glide / drone / follow (a character walking); indoors: a slow move through
    the room from its tested wide spot"""
    g = ZW_GLIDE.get(place)
    if follow is not None and g is not None:
        style = "follow"
    if g is None:
        loc, tgt, ln = ZW_SPOTS.get(place, ZW_SPOTS["downtown_street"])["wide"]
        lv, tv = Vector(loc), Vector(tgt)
        side = Vector(((tv - lv).y, -(tv - lv).x, 0)).normalized() if (tv - lv).length > 1e-3 else Vector((1, 0, 0))
        cam.key(t0, tuple(lv - side * 1.6), tuple(tv), lens=ln)
        cam.key(t1, tuple(lv + (tv - lv) * 0.16 + side * 1.2), tuple(tv), lens=ln)
        ZW_FRAMED["establish"] = "room move"
        return lv, tv
    a, b, la, lb = Vector(g["a"]), Vector(g["b"]), Vector(g["la"]), Vector(g["lb"])
    if style == "follow" and follow is not None:
        # behind the walker, a little to the side, the street ahead of them in frame
        p0, p1 = za_here(follow, t0), za_here(follow, t1)
        d = p1 - p0
        d.z = 0
        d = d.normalized() if d.length > 0.3 else (lb - la).normalized()
        sd = Vector((d.y, -d.x, 0))
        for t, p in ((t0, p0), ((t0 + t1) / 2.0, za_here(follow, (t0 + t1) / 2.0)), (t1, p1)):
            c = Vector((p.x, p.y, 0)) - d * 7.5 + sd * 2.2 + Vector((0, 0, 4.2))
            cam.key(t, tuple(c), tuple(Vector((p.x, p.y, 2.8)) + d * 6.0), lens=26)
        ZW_FRAMED["establish"] = "follow walk"
        return a, la
    if style == "drone":
        a2, b2 = a + Vector((0, 0, 9.0)), b + Vector((0, 0, 6.5))
        cam.key(t0, tuple(a2), tuple(la - Vector((0, 0, 2.5))), lens=24)
        cam.key(t1, tuple(b2), tuple(lb - Vector((0, 0, 1.5))), lens=24)
        ZW_FRAMED["establish"] = "low drone"
        return a2, la
    cam.key(t0, tuple(a), tuple(la), lens=24)
    cam.key(t1, tuple(b), tuple(lb), lens=24)
    ZW_FRAMED["establish"] = "street glide"
    return a, la



# ================================================================ ROUND 3 (owner 2026-11-22): A LIVING WORLD
# The story plan gives every scene a WORLD STATE (worldState.js dressOf -> the dress): how busy (busy / normal / quiet /
# empty), how people move (walking / hurrying / still / none), extras (pairs, bags, kids_playing, dogs, birds,
# people_at_windows), cars (driving / parked / leaving / none; headlights at dusk and night), windows (lit / some / dark),
# curtains (open / closed), threat (none / near / react / after: the background looks, runs away from the stage, cars
# drive off; after = relief). A dress without these keys builds the place as before.
ZW_BUSY = {"busy": 1.7, "normal": 1.0, "quiet": 0.35, "empty": 0.0}
ZW_CROWD_ON = [False]
ZW_DRIVING = []   # this shot's driving cars   # round 5: worlds/crowds.py (crowds + traffic with logic) sets it when it is pasted in
ZW_DOTCHARS = set()   # the shot's characters with OUR dot face
ZW_DOTSEQ = {}        # name -> {"seq": [(t, expr)], "talk": (t0, t1) | None}
ZW_DOT = {"happy": "smile", "laughing": "smile", "smirk": "smile", "scared": "scared", "terrified": "scared", "panic": "scared",
          "shocked": "o", "surprised": "o", "angry": "angry", "determined": "angry", "sad": "sad", "crying": "sad",
          "neutral": "neutral", "confused": "neutral", "smile": "smile", "o": "o"}


def zw_dot_style():
    """the face style: dress "faces": dot (the In This Town default since round 3) | kit (the old big-eye faces)"""
    return ZW_T.get("faces", "dot") == "dot"


def zw_dot_apply(ch, t, emo, talk=None):
    """one more face moment for a dot-face character (all its moments are rebuilt together: pieces.py zp_dotface)"""
    st = ZW_DOTSEQ.setdefault(ch.name, {"seq": [], "talk": None})
    st["seq"] = sorted([x for x in st["seq"] if abs(x[0] - t) > 0.02] + [(t, ZW_DOT.get(emo, "neutral"))])
    if talk:
        st["talk"] = talk
    zp_dotface(ch, st["seq"], talk=st["talk"])
    return ch


def zw_face_at(ch, t, emo):
    """the face at time t (the scene card's end face): dot or kit"""
    if ch.name in ZW_DOTCHARS:
        return zw_dot_apply(ch, t, emo)
    ch.face(t, ZW_EMO.get(emo, emo if emo in story.acting.EXPR else "neutral"))
    return ch


def zw_vpts(obs, cap=600):
    """the world positions of the VERTICES these objects render (children included, render-hidden ones skipped)"""
    out = []
    for ob in obs:
        if ob is None:
            continue
        for m in [ob] + list(ob.children_recursive):
            if m.type != "MESH" or m.hide_render:
                continue
            vs = m.data.vertices
            step = max(1, len(vs) // cap)
            mw = m.matrix_world
            for i in range(0, len(vs), step):
                out.append(mw @ vs[i].co)
    return out


def zw_life_n(dress, base):
    """how many background people: the world state's busy x the place's base (no busy key: the old "people" count)"""
    b = dress.get("busy")
    if b is None:
        return int(dress.get("people", base))
    return int(round(base * ZW_BUSY.get(b, 1.0)))


def zw_life_modes(dress, base):
    """how the background people move this scene"""
    thr = dress.get("threat", "none")
    if thr == "react":
        return ("run",)
    if thr == "near":
        return ("look", "look", "stand")
    if thr == "after":
        return ("cheer", "stand", "talk")
    mv = dress.get("walkers")
    if mv == "hurrying":
        return ("hurry", "hurry", "bag", "hurry")
    if mv in ("still", "none"):
        return ("stand", "talk")
    ex = set(dress.get("extras") or ())
    modes = list(base)
    for key, m in (("bags", "bag"), ("kids_playing", "play"), ("dogs", "dog"), ("pairs", "talk")):
        if key in ex:
            modes.append(m)
    return tuple(modes)


def zw_life_cars(dress, spots, t0, t1):
    """the street's cars by the world state: driving (the place's own) | parked (at the kerb, still) | leaving (fast,
    away) | none; driving cars have headlights at dusk and night. No "cars" key: as before."""
    mode = dress.get("cars")
    lights = zw_time() in ("sunset", "night")
    if ZW_CROWD_ON[0] and "busy" in dress and zw_traffic(t0, t1):
        return None
    if mode is None:
        return zw_cars(spots, t0, t1, lights=lights)
    if mode == "none":
        return None
    if mode == "parked":
        park = []
        for sp in spots:
            x, y, c, rr = sp[:4]
            if rr in (90, -90):
                y = y + (1.4 if y > 0 else -1.4)
            else:
                x = x + (1.4 if x > 0 else -1.4)
            park.append((x, y, c, rr, False))
        return zw_cars(park, t0, t1)
    if mode == "leaving":
        return zw_cars([tuple(sp[:4]) + (True,) for sp in spots], t0, t1, speed=17.0, reach=45.0, lights=lights)
    return zw_cars(spots, t0, t1, lights=lights)


def zw_headlights(k, x, y, r, t0, t1, dist):
    """two glowing headlights at a car's front (heading r), moving with it when it drives"""
    a = math.radians(r)
    fx, fy = -math.sin(a), math.cos(a)
    px, py = math.cos(a), math.sin(a)
    M = zw_m("headlight", "#fff6dc", 0.2, emit="#fff1c8", estr=6.0)
    for s2 in (-1, 1):
        ob = sphere("zw_hl%d_%d" % (k, s2), 0.22, (x + fx * 2.25 + px * 0.7 * s2, y + fy * 2.25 + py * 0.7 * s2, 0.95), M, (1, 1, 0.8), seg=8)
        ob.visible_shadow = False
        if t0 is not None and dist > 0:
            ob.keyframe_insert("location", frame=F(t0))
            ob.location = (ob.location.x + fx * dist, ob.location.y + fy * dist, 0.95)
            ob.keyframe_insert("location", frame=F(t1))
            set_interp(ob, "location", F(t0), "LINEAR")


def zw_dog_into(coll, off, j):
    """a small blocky dog (into a person source collection), walking beside its owner"""
    M = zw_m("dog%d" % (j % 3), ["#a86b3c", "#e8d8b8", "#3a3030"][j % 3], 0.8)
    ox, oy, oz = off
    box("zw_dogb%d" % j, (0.7, 1.5, 0.7), (ox, oy, oz + 0.95), M, 0.08, coll=coll)
    box("zw_dogh%d" % j, (0.6, 0.6, 0.6), (ox, oy - 0.95, oz + 1.45), M, 0.08, coll=coll)
    box("zw_dogn%d" % j, (0.32, 0.3, 0.26), (ox, oy - 1.35, oz + 1.32), zw_m("dognose", "#222222", 0.6), 0.04, coll=coll)
    for k, (lx, ly) in enumerate(((-0.22, -0.55), (0.22, -0.55), (-0.22, 0.55), (0.22, 0.55))):
        box("zw_dogl%d_%d" % (j, k), (0.2, 0.2, 0.62), (ox + lx, oy + ly, oz + 0.31), M, 0.02, coll=coll)
    box("zw_dogt%d" % j, (0.14, 0.5, 0.14), (ox, oy + 0.95, oz + 1.25), M, 0.02, rot=(35, 0, 0), coll=coll)


def zw_birds(t0, t1, n, area, seed=4):
    """birds crossing the sky (day): small dark V shapes moving across"""
    rnd = random.Random(seed)
    M = zw_m("bird", "#2a2a33", 0.6)
    for k in range(n):
        x, y, z = rnd.uniform(*area[0]), rnd.uniform(*area[1]), rnd.uniform(9, 15)
        root = empty("zw_bird%d" % k, (x, y, z))
        for s2 in (-1, 1):
            box("zw_birdw%d_%d" % (k, s2), (0.9, 0.12, 0.06), (s2 * 0.4, 0, 0.12), M, 0.0, rot=(0, s2 * -25, 0), parent=root)
        root.keyframe_insert("location", frame=F(t0))
        root.location = (x + rnd.choice((-1, 1)) * 6.0 * (t1 - t0), y + rnd.uniform(-1, 1), z + rnd.uniform(-0.5, 0.5))
        root.keyframe_insert("location", frame=F(t1))
        set_interp(root, "location", F(t0), "LINEAR")


def zw_watchers(t0, xs, side=1, look=None):
    """people behind house windows (suburb, north side), each window with a WALL around it (the replica lesson: only
    what is inside the window shows, never a body below a floating sill)"""
    out = []
    for k, x in enumerate(xs):
        col = (ZW_HOUSE_COPY if zw_copy() else ZW_HOUSE)[k % len(ZW_HOUSE)]
        w = zp_window((x, 16.9, 2.0), 0.0, 2.6, 2.4, lit=zw_win_lit(k), glow="#d9b48f" if zw_win_lit(k) else "#26324e", estr=0.4, surround=col, mullion=False)
        ch = zw_person("Watcher%d" % k, look or {}, (x, 17.5, 0.0), 0.0, t0)
        zp_behind_window(ch, w, 0.6)
        # the threat arc on their faces (near: staring, react: scared, after: relief); a soft cool light so a face in a
        # dark window still reads
        thr = ZW_T.get("threat", "none")
        if thr != "none":
            zw_dot_apply(ch, t0 - 0.5, {"near": "shocked", "react": "terrified", "after": "happy"}.get(thr, "neutral"))
        if zw_night():
            zw_novol(light("zw_wfill%d" % k, "AREA", (x, 16.9 - 4.5, 4.6), 70.0, (0.62, 0.72, 1.0), 3.0, target=(x, 17.6, 3.4), shadow=False))
        out.append((w, ch))
    return out


ZW_NEAR = {"busy": 7, "normal": 4, "quiet": 2, "empty": 0}


def zw_life_near(place, dress, t0, t1):
    """the world state IN THE SHOT (engine check 2026-11-22: a busy day framed on the cast showed an empty street; the
    town's people were further down the road): a few background people and the birds just behind the stage, where every
    camera of the scene looks"""
    if "busy" not in dress or place not in ZW_SPOTS or place not in ("downtown_street", "downtown_plaza", "downtown_landmark", "suburb_street", "suburb_porch", "brick_street", "brick_alley"):
        return
    loc, tgt, ln = ZW_SPOTS[place]["close"]
    dv = Vector((tgt[0] - loc[0], tgt[1] - loc[1], 0))
    dv = dv.normalized() if dv.length > 1e-3 else Vector((0, 1, 0))
    rv = Vector((dv.y, -dv.x, 0))
    c = Vector((tgt[0], tgt[1], 0))
    n = ZW_NEAR.get(dress.get("busy"), 0)
    if n > 0:
        pts = [c + dv * a + rv * b for a in (6.0, 15.0) for b in (-8.0, 8.0)]
        area = ((min(p.x for p in pts), max(p.x for p in pts)), (min(p.y for p in pts), max(p.y for p in pts)), 0.25)
        zw_people(t0, t1, n, [area], seed=31, modes=zw_life_modes(dress, ("walk", "talk", "stand", "walk")))
    if "birds" in set(dress.get("extras") or ()) and zw_time() == "day":
        b0 = c + dv * 14.0
        zw_birds(t0, t1, 6, ((b0.x - 10, b0.x + 10), (b0.y - 4, b0.y + 6)))


def zw_life_extras(dress, t0, t1, area):
    """the world state's extras the people modes do not cover: birds (day), people at windows"""
    ex = set(dress.get("extras") or ())
    if "people_at_windows" in ex and ZW_T.get("_place") in ("suburb_street", "suburb_porch"):
        zw_watchers(t0, (-28.0, 2.0, 31.0))

# ---------------------------------------------------------------- the after-build hook (every shot, after the kit's build)
def zw_cast():
    """(name, Char) of the shot's visible characters (kit Chars; the library's instanced background people are not Chars)"""
    out = []
    for nm, ch in list(chars.CHARS.items()):
        try:
            if ch.root.name in D.objects and ch.head.visible_get():
                out.append((nm, ch))
        except Exception:
            continue
    return out


def zw_look_apply():
    """the colour mode: Standard on the street places (look v3), never a raised exposure; the bloom per time of day"""
    sc = bpy.context.scene
    vs = sc.view_settings
    if ZW_T.get("_std"):
        vs.view_transform = "Standard"
        try:
            vs.look = "None"
        except TypeError:
            pass
    # copy mode (replica round 2) may darken: the reference's night is darker than ours (dress "exposure", e.g. -0.6)
    vs.exposure = float(ZW_T.get("exposure", 0.0)) if zw_copy() else 0.0
    vs.gamma = 1.0
    t = zw_time()
    pl = ZW_T.get("_place", "")
    if ZW_T.get("_std") and pl in ZW_INDOOR_LIGHT:
        k = ZW_INDOOR_LIGHT[pl]
        for o in D.objects:
            if o.type == "LIGHT" and not o.name.startswith(("zw_spill", "zw_moonrim", "zw_mon")):
                o.data.energy *= k
        try:
            for n in sc.world.node_tree.nodes:
                if n.type == "BACKGROUND":
                    n.inputs[1].default_value *= k
        except Exception:
            pass
    try:
        gl = next(n for n in sc.compositing_node_group.nodes if n.type == "GLARE")
        if ZW_T.get("_std"):
            thr, stg, siz = {"night": (0.85, 0.35, 0.75), "sunset": (0.95, 0.2, 0.7)}.get(t, (1.0, 0.1, 0.6))
            if zw_copy() and t == "night":
                thr, stg = 0.95, 0.12   # copy mode: the reference's lamps glow softly (ours were white blobs)
            elif t == "night":
                thr, stg = 0.9, 0.2     # round 3: the replica's softer glare in normal videos too
            gl.inputs["Threshold"].default_value = thr
            gl.inputs["Strength"].default_value = stg
            gl.inputs["Size"].default_value = siz
    except Exception as e:
        print("zw_look_apply glare: %s" % e)
    print("ZW_LOOK|%s|%s|%s|exposure %.1f" % (ZW_T.get("_place", "-"), t, vs.view_transform, vs.exposure))


def zw_night_cast_light(t0, t1):
    """NIGHT, CHARACTERS STILL READABLE: each character near the camera gets the spill of a warm lamp / lit window from
    the camera's side (soft, from above) and a cool moon rim from behind; the scene itself stays dark"""
    sc = bpy.context.scene
    cam = sc.camera
    if cam is None or not (zw_night() and ZW_T.get("_std")):
        return 0
    sc.frame_set((F(t0) + max(F(t0), F(t1) - 1)) // 2)
    c = cam.matrix_world.translation.copy()
    n = 0
    for nm, ch in zw_cast():
        if nm in ZW_MON:
            continue
        pts = zw_head_pts(ch)
        if not pts or n >= 6:
            continue
        hd = sum(pts, Vector((0, 0, 0))) / len(pts)
        if (hd - c).length > 34:
            continue
        s = ch.root.scale[2]
        to = Vector((c.x - hd.x, c.y - hd.y, 0))
        if to.length < 1e-3:
            continue
        to.normalize()
        side = to.cross(Vector((0, 0, 1)))
        key = hd + to * 3.2 * s + side * 2.2 * s + Vector((0, 0, 2.0 * s))
        zw_novol(light("zw_spill_%s" % nm, "AREA", tuple(key), 260.0 * s * s, (1.0, 0.78, 0.52), 1.6 * s, target=tuple(hd), shadow=False))
        rim = hd - to * 3.0 * s - side * 1.2 * s + Vector((0, 0, 1.6 * s))
        zw_novol(light("zw_moonrim_%s" % nm, "AREA", tuple(rim), 220.0 * s * s, (0.6, 0.75, 1.0), 1.2 * s, target=tuple(hd), shadow=False))
        n += 1
    sc.frame_set(F(t0))
    return n


def zw_monster_rim(t0, t1):
    """each monster: a strong rim light BEHIND it (seen from the camera), in a colour that is not its own, so its outline
    cuts out of any background; plus a soft under-fill on the face so the features read"""
    sc = bpy.context.scene
    cam = sc.camera
    if cam is None or not ZW_MON:
        return 0
    sc.frame_set((F(t0) + max(F(t0), F(t1) - 1)) // 2)
    c = cam.matrix_world.translation.copy()
    for nm, m in ZW_MON.items():
        pts = zw_pts([m.root])
        if not pts:
            continue
        s = m.root.scale[2]
        mid = sum(pts, Vector((0, 0, 0))) / len(pts)
        top = Vector((mid.x, mid.y, max(p.z for p in pts)))
        to = Vector((c.x - mid.x, c.y - mid.y, 0))
        to = to.normalized() if to.length > 1e-3 else Vector((0, -1, 0))
        side = to.cross(Vector((0, 0, 1)))
        for k, sx in enumerate((-1, 1)):
            p = top - to * 2.6 * s + side * sx * 2.2 * s + Vector((0, 0, 0.6 * s))
            zw_novol(light("zw_monrim_%s_%d" % (nm, k), "AREA", tuple(p), 650.0 * s * s, ZW_MON_RIM.get(nm, (0.55, 0.85, 1.0)), 1.4 * s, target=tuple(mid + Vector((0, 0, 0.8 * s))), shadow=False))
        hd = sum(zw_head_pts(m), Vector((0, 0, 0))) / 8
        zw_novol(light("zw_monfill_%s" % nm, "AREA", tuple(hd + to * 3.0 * s - Vector((0, 0, 1.6 * s))), 160.0 * s * s, (1.0, 0.9, 0.8), 1.2 * s, target=tuple(hd), shadow=False))
        k = hd + to * 4.0 * s + side * 2.5 * s + Vector((0, 0, 1.2 * s))
        zw_novol(light("zw_monkey_%s" % nm, "AREA", tuple(k), (320.0 if zw_night() else 140.0) * s * s, (1.0, 0.92, 0.85), 2.0 * s, target=tuple(hd), shadow=False))
    sc.frame_set(F(t0))
    return len(ZW_MON)


def zw_gate(S):
    """THE FRAMING GATE (owner 2026-11-21), measured on the geometry at the start, middle and end frame; one log line per
    problem, read by the pipeline (frameGate.mjs):
      ZW_GATE|<shot>|<name>|face_cut|...           a face (head box over 5 % of the frame height) cut by the frame edge
      ZW_GATE|<shot>|<name>|face_under_captions|... over half of that face inside the caption band (62-76 % down)
      ZW_GATE|<shot>|<name>|monster_wall|...        a monster covering over 80 % of the frame or crossing 3+ edges
      ZW_GATE|<shot>|<name>|monster_shown|...       a monster fully readable: outline inside the frame (at most 1 edge
                                                    crossed), the whole head in frame and over 6 % of the height"""
    sc = bpy.context.scene
    cam = sc.camera
    if cam is None:
        return {}
    f0 = F(S["t0"])
    f1 = max(f0, F(S["t1"]) - 1)
    bad, shown = {}, {}
    for fr in sorted(set([f0, (f0 + f1) // 2, f1])):
        sc.frame_set(fr)
        for nm, ch in zw_cast():
            if nm in ZW_EXTRAS:
                continue
            sp = zw_span(cam, zw_head_pts(ch))
            if sp is None:
                continue
            u0, u1, v0, v1 = sp
            if u1 < 0 or u0 > 1 or v1 < 0 or v0 > 1:
                continue
            hh = v1 - v0
            if hh < 0.05:
                continue
            if u0 < -0.005 or u1 > 1.005 or v0 < -0.005 or v1 > 1.005:
                bad[(nm, "face_cut")] = "head u %.2f-%.2f v %.2f-%.2f" % (u0, u1, v0, v1)
            ov = max(0.0, min(v1, ZW_CAPTION[1]) - max(v0, ZW_CAPTION[0]))
            if ov > 0.5 * hh:
                bad[(nm, "face_under_captions")] = "head v %.2f-%.2f" % (v0, v1)
        for nm, m in ZW_MON.items():
            sp = zw_span(cam, zw_pts([m.root]))
            if sp is None:
                continue
            u0, u1, v0, v1 = sp
            if u1 < 0 or u0 > 1 or v1 < 0 or v0 > 1:
                continue
            cover = max(0.0, min(u1, 1) - max(u0, 0)) * max(0.0, min(v1, 1) - max(v0, 0))
            edges = (u0 < 0) + (u1 > 1) + (v0 < 0) + (v1 > 1)
            if cover > 0.8 or edges >= 3:
                bad[(nm, "monster_wall")] = "covers %d%% of the frame, crosses %d edges" % (round(cover * 100), edges)
            hs = zw_span(cam, zw_head_pts(m))
            hp = zw_head_pts(m)
            seen = hp and not zw_blocked(cam.matrix_world.translation.copy(), sum(hp, Vector((0, 0, 0))) / len(hp), (nm + "_",))
            if not seen:
                bad[(nm, "monster_hidden")] = "something stands between the lens and its head"
            if seen and edges <= 1 and cover <= 0.8 and hs and hs[0] >= 0 and hs[1] <= 1 and hs[2] >= 0 and hs[3] <= 1 and hs[3] - hs[2] >= 0.06:
                shown[nm] = "covers %d%%" % round(cover * 100)
    sc.frame_set(f0)
    lines = ["ZW_GATE|%s|%s|%s|%s" % (S.get("id", "?"), nm, kind, why) for (nm, kind), why in bad.items()]
    lines += ["ZW_GATE|%s|%s|monster_shown|%s" % (S.get("id", "?"), nm, why) for nm, why in shown.items() if (nm, "monster_wall") not in bad]
    lines += ["ZW_FRAMED|%s|%s|%s" % (S.get("id", "?"), k, v) for k, v in ZW_FRAMED.items()]
    for l in lines:
        print(l)
    return lines


ZW_BUILD0 = []
try:
    ZW_BUILD0.append(V.build)
except NameError:
    pass


ZW_PREVIEW = {"pct": 0, "samples": 0}   # round 4: a cheap preview video (the shots file sets these: resolution %, samples)


def zw_preview_res():
    sc = bpy.context.scene
    if ZW_PREVIEW.get("pct"):
        sc.render.resolution_percentage = int(ZW_PREVIEW["pct"])
    if ZW_PREVIEW.get("samples"):
        try:
            sc.eevee.taa_render_samples = int(ZW_PREVIEW["samples"])
        except Exception:
            pass


def zw_guarded_build(i, *a, **k):
    ZW_T.clear()
    ZW_MON.clear()
    ZW_FRAMED.clear()
    ZW_EMOTED.clear()
    ZW_EXTRAS.clear()
    ZW_DOTCHARS.clear()
    ZW_DOTSEQ.clear()
    del ZW_DRIVING[:]
    S = ZW_BUILD0[0](i, *a, **k)
    if ZW_T.get("copy"):
        try:
            zw_look_apply()
            zw_gate(S)
        except Exception as e:
            print("zw_copy hook skipped: %s" % e)
        return S
    zw_cam_guard(S["t0"], S["t1"])
    try:
        zw_clear_view(S["t0"], S["t1"])
    except Exception as e:   # best effort: a clear-view failure never fails a shot
        print("zw_clear_view skipped: %s" % e)
    # round 1 (owner 2026-11-21): the colour mode, the night light on the cast, the monsters' rim, the framing gate.
    # Best effort like the camera rules: a failure here never fails a shot (the gate only reports)
    for step in (zw_look_apply, lambda: zw_auto_faces(S), lambda: zm_alive_all(S), lambda: zw_night_cast_light(S["t0"], S["t1"]), lambda: zw_monster_rim(S["t0"], S["t1"]), zw_preview_res, lambda: zw_gate(S)):
        try:
            step()
        except Exception as e:
            print("zw_round1 step skipped: %s" % e)
    return S


if ZW_BUILD0:
    V.build = zw_guarded_build
# ===== END OF THE ZYVO WORLD LIBRARY =====================================================================
