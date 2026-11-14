# ===== ZYVO WORLD LIBRARY v1 (scripts/blockyWorlds/blenderKit/worlds/worlds.py) ==============================
# Our own reusable Roblox-style base worlds, built from the kit's primitives (box, cyl, sphere, text, light, mat ...).
# The pipeline pastes this file into every shots.py right after the fixed header (no imports here: it uses the names
# `from shotkit import *` gives, plus W / W2 / story). The static check (shotcheck.py) applies to it like any shot code.
# Ground at z = 0; a character is ~5.2 units tall; streets run along +Y unless noted.
#   zw_build(place, t0, t1, dress=None) -> the place's info dict (marks)   builds one LOCATION of the library
#   zw_spot(cam, place, spot, t0, t1, push=0.08)                           a TESTED camera spot (+ a gentle push)
#   ZW_MARKS[place][mark] -> (x, y, z)                                     where to stand characters
# DRESS (per story, cheap): {"time": "day"|"sunset"|"night", "weather": "clear"|"rain"|"snow",
#   "landmark": "bank"|"city_hall"|"tower"|"screen"|"none", "landmark_text": "...", "signs": ["BAKERY", ...],
#   "billboard": "...", "people": 0..40, "props": ["blimp", "bunting", "cars"], "blimp_text": "..."}

ZW_T = {}  # this shot's dress (time of day decides the emissive materials)


def zw_m(name, color, rough=0.6, metal=0.0, emit=None, estr=0.0, alpha=1.0):
    return mat("zw_" + name, hexc(color), rough, metal, emit=hexc(emit) if emit else None, estr=estr, alpha=alpha)


def zw_night():
    return ZW_T.get("time", "day") == "night"


def zw_glass(name="glass"):
    # windows: dark blue glass by day, warm light at night
    if zw_night():
        return zw_m(name + "_n", "#ffd9a0", 0.3, emit="#ffc070", estr=2.2)
    return zw_m(name + "_d", "#3b5470", 0.08, 0.3)


def zw_brick(name, base="#a5523e", mortar="#d8cfc4"):
    m = D.materials.get("zw_brk_" + name)
    if m:
        return m
    m = D.materials.new("zw_brk_" + name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes.get("Principled BSDF")
    br = nt.nodes.new("ShaderNodeTexBrick")
    co = nt.nodes.new("ShaderNodeTexCoord")
    nt.links.new(co.outputs["Object"], br.inputs["Vector"])
    c = hexc(base)
    br.inputs["Color1"].default_value = (c[0], c[1], c[2], 1)
    br.inputs["Color2"].default_value = (c[0] * 0.78, c[1] * 0.74, c[2] * 0.72, 1)
    mc = hexc(mortar)
    br.inputs["Mortar"].default_value = (mc[0], mc[1], mc[2], 1)
    br.inputs["Scale"].default_value = 0.9
    br.inputs["Mortar Size"].default_value = 0.025
    nt.links.new(br.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.85
    m.diffuse_color = (c[0], c[1], c[2], 1)
    return m


# ---------------------------------------------------------------- sky, light, weather
def zw_sky_time(time="day"):
    ZW_T["time"] = time
    if time == "sunset":
        W.sky(1.0, top=(0.10, 0.07, 0.30), bottom=(1.0, 0.42, 0.18))
        light("zw_sun", "SUN", (0, 0, 50), 3.2, (1.0, 0.62, 0.38), 2, rot=(76, 0, 150))
    elif time == "night":
        W.sky(1.6, top=(0.004, 0.008, 0.04), bottom=(0.03, 0.06, 0.16))
        light("zw_moon", "SUN", (0, 0, 50), 1.6, (0.62, 0.72, 1.0), 2, rot=(40, 0, -40))
    else:
        W.sky(1.35)
        W.sun(5.0, rot=(32, 0, 28))


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


# ---------------------------------------------------------------- reusable props (instanced)
def zw_tree_src():
    src = D.collections.get("zw_tree_src")
    if src:
        return src
    src = collection("zw_tree_src")
    cyl("zw_trunk", 0.35, 4.2, (0, 0, 2.1), zw_m("trunk", "#7a5234", 0.9), 10, coll=src)
    Mt = zw_m("leaf", "#5fbf5a", 0.85)
    sphere("zw_leaf1", 2.6, (0, 0, 5.6), Mt, (1, 1, 0.9), coll=src, seg=14)
    sphere("zw_leaf2", 1.8, (1.2, 0.4, 6.6), Mt, (1, 1, 0.9), coll=src, seg=12)
    sphere("zw_leaf3", 1.7, (-1.0, -0.6, 6.4), Mt, (1, 1, 0.9), coll=src, seg=12)
    hide_coll_from_layer(src)
    return src


def zw_lamp_src():
    src = D.collections.get("zw_lamp_src")
    if src:
        return src
    src = collection("zw_lamp_src")
    Mp = zw_m("lamppost", "#2f3a4a", 0.4, 0.6)
    cyl("zw_lp_pole", 0.14, 6.6, (0, 0, 3.3), Mp, 10, coll=src)
    cyl("zw_lp_base", 0.32, 0.5, (0, 0, 0.25), Mp, 10, coll=src)
    on = zw_night() or ZW_T.get("time") == "sunset"
    sphere("zw_lp_bulb", 0.42, (0, 0, 6.9), zw_m("lampbulb" + ("_on" if on else ""), "#fff3c4", 0.3, emit="#ffd27a", estr=6.0 if on else 0.6), coll=src, seg=12)
    hide_coll_from_layer(src)
    return src


def zw_bench_src():
    src = D.collections.get("zw_bench_src")
    if src:
        return src
    src = collection("zw_bench_src")
    Mw, Mm = zw_m("benchwood", "#b9844e", 0.7), zw_m("benchmetal", "#39404d", 0.4, 0.5)
    box("zw_bn_seat", (3.2, 1.0, 0.18), (0, 0, 1.1), Mw, 0.04, coll=src)
    box("zw_bn_back", (3.2, 0.16, 0.9), (0, 0.45, 1.65), Mw, 0.04, coll=src)
    for sx in (-1.3, 1.3):
        box("zw_bn_leg%d" % int(sx * 10), (0.14, 0.9, 1.1), (sx, 0, 0.55), Mm, 0.02, coll=src)
    hide_coll_from_layer(src)
    return src


def zw_place_inst(kind, loc, rot=0, scale=1.0):
    src = {"tree": zw_tree_src, "lamp": zw_lamp_src, "bench": zw_bench_src}[kind]()
    return instance("zw_%s_%d_%d" % (kind, int(loc[0] * 10), int(loc[1] * 10)), src, loc, (scale, scale, scale), rot=(0, 0, rot))


def zw_people(t0, t1, n, area, seed=7, mode="cheer"):
    """n background people (the kit's instanced crowd: cheap) in area ((x0, x1), (y0, y1))"""
    if n <= 0:
        return
    src = story.crowd_src("zw_crowd_src", t0, t1, [1, 2, 3, 4, 5, 6], mode=mode, spread=2.0, seed=seed)
    hide_coll_from_layer(src)
    story.crowd(src, t0, t1, max(1, n // 6), area, seed=seed)


def zw_blimp(text_body="ZYVO", loc=(-30, 90, 55)):
    root = empty("zw_blimp", loc)
    sphere("zw_blimp_body", 6, (0, 0, 0), zw_m("blimp", "#f5f5f5", 0.4), (1, 3.2, 1), parent=root, seg=24)
    for k, (dx, dz) in enumerate(((0, 6), (5, 0), (-5, 0))):
        box("zw_blimp_fin%d" % k, (0.4 if dx == 0 else 3.5, 4, 3.5 if dx == 0 else 0.4), (dx * 0.4, -18, dz * 0.6), zw_m("blimpfin", "#e2725b", 0.5), 0.1, parent=root)
    box("zw_blimp_cab", (2.4, 5, 1.6), (0, 0, -6.4), zw_m("blimpcab", "#3b4a5c", 0.4), 0.3, parent=root)
    text("zw_blimp_txt", text_body, (6.1, 0, 0.6), 3.4, zw_m("blimptxt", "#e2725b", 0.4), rot=(90, 0, 90), extrude=0.05, parent=root)
    return root


# ---------------------------------------------------------------- PASTEL DOWNTOWN
ZW_PASTEL = ["#f7b6c8", "#bfe7d6", "#cdbdf2", "#ffd6a8", "#fff1a8", "#b9dcf7", "#f9c9a5", "#c8f0b8"]
ZW_AWN = [("#ff6f91", "#ffffff"), ("#3fb6a8", "#ffffff"), ("#7b6cf6", "#ffffff"), ("#ff9f43", "#ffffff"), ("#ffd23f", "#ffffff"), ("#3d8bfd", "#ffffff")]
ZW_SIGNS = ["BAKERY", "TOYS", "CAFE", "BOOKS", "FLOWERS", "ARCADE", "DINER", "SWEETS", "MUSIC", "PETS"]


def zw_shop(i, side, y, w, h, sign):
    """one shop: side +1 = east of the street (front faces -X), -1 = west (front faces +X)"""
    fx = 12.0 * side                      # the facade plane
    cx = fx + side * 7.0
    col = ZW_PASTEL[i % len(ZW_PASTEL)]
    box("zw_shop%d" % i, (14, w, h), (cx, y, h / 2), zw_m("shop%d" % (i % 8), col, 0.7), 0.12)
    box("zw_shopcap%d" % i, (14.4, w + 0.4, 0.6), (cx, y, h + 0.3), zw_m("shopcap", "#fdfcf7", 0.6), 0.1)
    # the shop window + door at street level
    G = zw_glass("shopwin")
    box("zw_win%d" % i, (0.2, w * 0.55, 3.6), (fx - side * 0.05, y - w * 0.12, 2.6), G, 0.02)
    box("zw_winfr%d" % i, (0.25, w * 0.58, 0.25), (fx - side * 0.08, y - w * 0.12, 4.5), zw_m("frame", "#ffffff", 0.5), 0.02)
    box("zw_door%d" % i, (0.25, 2.2, 4.4), (fx - side * 0.08, y + w * 0.3, 2.2), zw_m("door%d" % (i % 3), ["#6b4a3a", "#3a6b5e", "#4a4f8a"][i % 3], 0.5), 0.05)
    # the striped awning, sloping down toward the street
    a, b = ZW_AWN[i % len(ZW_AWN)]
    n = max(4, int(w / 1.2))
    for k in range(n):
        yy = y - w / 2 + (k + 0.5) * w / n
        box("zw_awn%d_%d" % (i, k), (3.2, w / n, 0.16), (fx - side * 1.5, yy, 7.0), zw_m("awn" + (a if k % 2 == 0 else b)[1:], a if k % 2 == 0 else b, 0.6), 0.0, rot=(0, -18 * side, 0))
    # the sign board + its text (dressed per story)
    box("zw_signb%d" % i, (0.3, w * 0.8, 1.6), (fx - side * 0.2, y, 8.9), zw_m("signboard", "#fffdf5", 0.5), 0.08)
    text("zw_signt%d" % i, sign, (fx - side * 0.4, y, 8.9), 1.05, zw_m("signtxt%d" % (i % 4), ["#e2405b", "#2a7f74", "#5b4bd6", "#e07a1f"][i % 4], 0.4), rot=(90, 0, -90 * side), extrude=0.06)
    # upper floor windows
    for fl in range(1, int((h - 9.6) / 3.4) + 1):
        for k in (-1, 1):
            box("zw_uw%d_%d_%d" % (i, fl, k), (0.2, w * 0.22, 1.9), (fx - side * 0.05, y + k * w * 0.24, 10.2 + fl * 3.4 - 1.6), zw_glass("upwin"), 0.02)


def zw_tower_bg(i, x, y, h, w=16):
    col = ["#e8eef6", "#f3e1ec", "#e1f0ec", "#efe7d8", "#dfe2f5"][i % 5]
    box("zw_sky%d" % i, (w, w, h), (x, y, h / 2), zw_m("skyb%d" % (i % 5), col, 0.35, 0.2), 0.1)
    G = zw_glass("towerwin")
    for k in range(int(h / 6)):
        box("zw_skyw%d_%d" % (i, k), (w + 0.12, w * 0.86, 1.2), (x, y, 3 + k * 6), G, 0.0)


def zw_landmark(kind, label, y=178.0):
    if kind == "none":
        return
    if zw_night():
        light("zw_lm_flood", "SPOT", (0, y - 40, 14), 60000, (1.0, 0.86, 0.62), 2, target=(0, y, 22), spot=55)
    Mw, Mt = zw_m("lm_white", "#f7f3ea", 0.5), zw_m("lm_trim", "#d8c27a", 0.4, 0.3)
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
        sphere("zw_lm_dome", 7.2, (0, y + 4, 24), zw_m("lm_dome", "#7fb7e8", 0.3, 0.2), (1, 1, 0.8), seg=32)
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


def zw_downtown(t0, t1, dress):
    zw_sky_time(dress.get("time", "day"))
    # ground: plaza tiles + the street + the sidewalks
    box("zw_ground", (420, 420, 0.4), (0, 80, -0.2), zw_m("dt_ground", "#d9d3c7", 0.9), 0)
    box("zw_road", (14, 200, 0.06), (0, 80, 0.03), zw_m("asphalt", "#4d5059", 0.85), 0)
    for k in range(20):
        box("zw_dash%d" % k, (0.35, 4, 0.02), (0, -12 + k * 10, 0.07), zw_m("dash", "#fff6d6", 0.6), 0)
    for side in (-1, 1):
        box("zw_walk%d" % side, (5, 200, 0.3), (side * 9.5, 80, 0.15), zw_m("sidewalk", "#efe7da", 0.85), 0)
        box("zw_curb%d" % side, (0.4, 200, 0.36), (side * 7.1, 80, 0.18), zw_m("curb", "#cfc8bb", 0.8), 0.04)
    # shops both sides
    signs = list(dress.get("signs") or []) + ZW_SIGNS
    rnd = random.Random(11)
    i, y = 0, 4.0
    while y < 150:
        w = rnd.choice([14, 16, 18])
        for side in (1, -1):
            zw_shop(i, side, y + w / 2, w, rnd.choice([12, 14, 16, 18]), signs[i % len(signs)].upper()[:12])
            i += 1
        y += w + 1.0
    # street furniture
    for k in range(9):
        yy = 8 + k * 17
        for side in (-1, 1):
            zw_place_inst("tree" if k % 2 == 0 else "lamp", (side * 10.6, yy, 0.3))
        if k % 3 == 1:
            zw_place_inst("bench", (11.2, yy + 6, 0.3), rot=90)
            zw_place_inst("bench", (-11.2, yy + 6, 0.3), rot=-90)
    # background skyscrapers + a billboard
    for k in range(12):
        side = 1 if k % 2 == 0 else -1
        zw_tower_bg(k, side * (44 + (k % 3) * 18), 10 + (k // 2) * 30, 45 + ((k * 37) % 55))
    if dress.get("billboard"):
        box("zw_bb", (0.6, 26, 11), (37, 70, 34), zw_m("bb_board", "#fffdf5", 0.5), 0.1)
        text("zw_bb_txt", dress["billboard"].upper()[:20], (36.5, 70, 34), 2.6, zw_m("bb_txt", "#e2405b", 0.4), rot=(90, 0, -90), extrude=0.05)
    # the plaza (y < 0) with the fountain
    box("zw_plaza", (60, 44, 0.12), (0, -24, 0.06), zw_m("plaza", "#f3d9c4", 0.8), 0)
    for k in range(5):
        box("zw_plz_ring%d" % k, (60 - k * 10, 0.4, 0.13), (0, -24 - 22 + 2 + k * 10, 0.07), zw_m("plaza_line", "#e6bfa3", 0.8), 0)
    cyl("zw_fnt_basin", 6, 1.2, (0, -26, 0.6), zw_m("fnt_stone", "#f6f1e8", 0.6), 40)
    cyl("zw_fnt_water", 5.5, 0.2, (0, -26, 1.15), zw_m("fnt_water", "#7cc8f0", 0.15, emit="#5fb8ee", estr=0.4), 40)
    cyl("zw_fnt_col", 0.7, 4.0, (0, -26, 2.8), zw_m("fnt_stone", "#f6f1e8", 0.6), 16)
    cyl("zw_fnt_bowl", 2.2, 0.6, (0, -26, 4.8), zw_m("fnt_stone", "#f6f1e8", 0.6), 24, r2=1.4)
    sphere("zw_fnt_spray", 1.4, (0, -26, 5.7), zw_m("fnt_spray", "#cdeeff", 0.1, emit="#bfe6ff", estr=0.8, alpha=0.6), (1, 1, 0.8), seg=16)
    for k, (bx, by, r) in enumerate(((-12, -16, 90), (12, -16, -90), (-12, -34, 90), (12, -34, -90))):
        zw_place_inst("bench", (bx, by, 0.12), rot=r)
        zw_place_inst("tree", (bx * 1.8, by, 0.12))
    # cars
    if "cars" in (dress.get("props") or ["cars"]):
        for k, (x, y, c, r) in enumerate(((-3.5, 30, "#e2405b", 0), (3.5, 58, "#3d8bfd", 180), (-3.5, 92, "#ffd23f", 0), (3.5, 120, "#3fb6a8", 180))):
            W.car("zw_car%d" % k, (x, y, 0.06), c, rot=r)
    zw_landmark(dress.get("landmark", "bank"), (dress.get("landmark_text") or "").upper()[:16])
    if "blimp" in (dress.get("props") or []):
        zw_blimp((dress.get("blimp_text") or "ZYVO").upper()[:10])
    zw_people(t0, t1, int(dress.get("people", 12)), ((-11, 11), (10, 60)))
    zw_weather(dress.get("weather", "clear"))
    if zw_night():
        for k in range(6):
            light("zw_nl%d" % k, "POINT", ((-1) ** k * 9, 10 + k * 25, 7), 900, (1.0, 0.82, 0.55), 1.5)
    return dict(street=(0, 40, 0), sidewalk_east=(8.0, 36, 0.3), sidewalk_west=(-8.0, 36, 0.3), plaza=(0, -12, 0.12), fountain=(0, -26, 0), landmark=(0, 165, 0))


# ---------------------------------------------------------------- SUBURB (street along X)
def zw_house(i, x, side, col):
    """side +1: north of the street (front faces -Y), -1: south (front faces +Y)"""
    y = 24.0 * side
    fy = y - side * 6.0          # the front wall
    box("zw_h%d" % i, (14, 12, 9), (x, y, 4.5), zw_m("house%d" % (i % 6), col, 0.7), 0.12)
    Mr = zw_m("roof%d" % (i % 3), ["#b0473a", "#4a5568", "#6b4f8a"][i % 3], 0.65)
    for s in (-1, 1):
        box("zw_hr%d_%d" % (i, s), (15.4, 7.6, 0.6), (x, y + s * 3.1, 11.0), Mr, 0.1, rot=(-38 * s, 0, 0))
    box("zw_hgable%d" % i, (13.6, 0.4, 0.4), (x, y, 13.3), Mr, 0.1)
    box("zw_hchim%d" % i, (1.4, 1.4, 4), (x + 4.5, y + 2, 12.2), zw_brick("chim"), 0.08)
    # porch: deck, posts, roof
    box("zw_hdeck%d" % i, (10, 3.6, 0.6), (x, fy - side * 1.8, 0.3), zw_m("porch", "#e9dcc6", 0.7), 0.05)
    for px in (-4.6, 4.6):
        cyl("zw_hpost%d_%d" % (i, int(px)), 0.22, 6.0, (x + px, fy - side * 3.3, 3.4), zw_m("trimw", "#ffffff", 0.5), 10)
    box("zw_hproof%d" % i, (10.8, 4.2, 0.35), (x, fy - side * 1.9, 6.5), zw_m("trimw", "#ffffff", 0.5), 0.05)
    box("zw_hdoor%d" % i, (2.2, 0.25, 4.0), (x, fy - side * 0.08, 2.6), zw_m("hdoor%d" % (i % 3), ["#c0392b", "#2e6f95", "#3e7b4f"][i % 3], 0.5), 0.05)
    for wx in (-4.2, 4.2):
        box("zw_hwin%d_%d" % (i, int(wx)), (2.6, 0.2, 2.4), (x + wx, fy - side * 0.06, 3.2), zw_glass("hwin"), 0.02)
        box("zw_hwinf%d_%d" % (i, int(wx)), (3.0, 0.22, 0.3), (x + wx, fy - side * 0.08, 4.5), zw_m("trimw", "#ffffff", 0.5), 0.02)
        box("zw_hwin2%d_%d" % (i, int(wx)), (2.2, 0.2, 2.0), (x + wx, fy - side * 0.06, 7.1), zw_glass("hwin"), 0.02)
    # lawn, path, fence, mailbox, tree
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
    zw_place_inst("tree", (x - 7.5, y - side * 10, 0.0), scale=1.15)


def zw_suburb(t0, t1, dress):
    zw_sky_time(dress.get("time", "day"))
    box("zw_lawn", (400, 400, 0.4), (0, 0, -0.2), zw_m("grass", "#7cc66a", 0.9), 0)
    box("zw_sroad", (240, 12, 0.06), (0, 0, 0.03), zw_m("asphalt", "#4d5059", 0.85), 0)
    for k in range(24):
        box("zw_sdash%d" % k, (4, 0.3, 0.02), (-115 + k * 10, 0, 0.07), zw_m("dash", "#fff6d6", 0.6), 0)
    for side in (-1, 1):
        box("zw_swalk%d" % side, (240, 3.6, 0.25), (0, side * 8.0, 0.12), zw_m("sidewalk", "#efe7da", 0.85), 0)
    cols = ["#ffd6a8", "#bfe7d6", "#cdbdf2", "#f7b6c8", "#fff1a8", "#b9dcf7"]
    for k, x in enumerate((-60, -30, 0, 30, 60)):
        zw_house(2 * k, x, 1, cols[k % 6])
        zw_house(2 * k + 1, x + 12, -1, cols[(k + 3) % 6])
    for k in range(10):
        zw_place_inst("lamp", (-90 + k * 20, 10.2, 0.2))
    if "cars" in (dress.get("props") or ["cars"]):
        W.car("zw_scar0", (-14, 3.2, 0.06), "#e2405b", rot=90)
        W.car("zw_scar1", (22, -3.2, 0.06), "#3d8bfd", rot=-90)
    if "blimp" in (dress.get("props") or []):
        zw_blimp((dress.get("blimp_text") or "ZYVO").upper()[:10], (20, 80, 50))
    zw_people(t0, t1, int(dress.get("people", 0)), ((-30, 30), (-7, 7)))
    zw_weather(dress.get("weather", "clear"), ((-60, 60), (-40, 40)))
    if zw_night():
        for k in range(5):
            light("zw_snl%d" % k, "POINT", (-60 + k * 30, 10, 7), 800, (1.0, 0.82, 0.55), 1.5)
    return dict(street=(0, 0, 0), porch=(0, 15.5, 0.6), sidewalk=(0, 8, 0.25), mailbox=(6.6, 11.4, 0), yard=(0, 13, 0))


# ---------------------------------------------------------------- BRICK CITY (street along Y)
def zw_apartment(i, side, y, w, h):
    fx = 11.0 * side
    cx = fx + side * 8.0
    base = ["#a5523e", "#8f4636", "#b3654a", "#9a5a48"][i % 4]
    box("zw_apt%d" % i, (16, w, h), (cx, y, h / 2), zw_brick("apt%d" % (i % 4), base), 0.05)
    box("zw_aptcap%d" % i, (16.6, w + 0.6, 0.8), (cx, y, h + 0.4), zw_m("aptcap", "#d8cfc4", 0.7), 0.05)
    G = zw_glass("aptwin")
    Mf = zw_m("aptframe", "#efe6d8", 0.6)
    Mb = zw_m("balcony", "#3a3f48", 0.4, 0.5)
    floors = int((h - 2) / 4.2)
    for fl in range(floors):
        z = 2.6 + fl * 4.2
        for k in (-1, 0, 1):
            yy = y + k * w * 0.3
            box("zw_aw%d_%d_%d" % (i, fl, k), (0.2, 2.2, 2.6), (fx - side * 0.05, yy, z), G, 0.02)
            box("zw_awf%d_%d_%d" % (i, fl, k), (0.3, 2.6, 0.3), (fx - side * 0.1, yy, z - 1.45), Mf, 0.02)
        if fl >= 2 and fl % 2 == 0:
            box("zw_abal%d_%d" % (i, fl), (2.6, w * 0.5, 0.3), (fx - side * 1.3, y, z - 1.7), Mb, 0.04)
            for k in range(6):
                cyl("zw_abr%d_%d_%d" % (i, fl, k), 0.06, 1.4, (fx - side * 2.5, y - w * 0.24 + k * w * 0.096, z - 0.9), Mb, 6)
            box("zw_abrt%d_%d" % (i, fl), (0.12, w * 0.5, 0.12), (fx - side * 2.5, y, z - 0.2), Mb, 0.01)
    box("zw_adoor%d" % i, (0.3, 2.6, 4.2), (fx - side * 0.1, y - w * 0.3, 2.1), zw_m("aptdoor", "#2f4a3a", 0.5), 0.05)


def zw_brick_city(t0, t1, dress):
    zw_sky_time(dress.get("time", "day"))
    box("zw_bground", (400, 400, 0.4), (0, 80, -0.2), zw_m("bc_ground", "#8a8580", 0.9), 0)
    box("zw_broad", (14, 220, 0.06), (0, 80, 0.03), zw_m("cobble", "#5a5550", 0.9), 0)
    for side in (-1, 1):
        box("zw_bwalk%d" % side, (4, 220, 0.3), (side * 9, 80, 0.15), zw_m("bc_walk", "#b8b0a5", 0.85), 0)
    rnd = random.Random(5)
    i, y = 0, 0.0
    while y < 150:
        w = rnd.choice([16, 18, 20])
        for side in (1, -1):
            if not (side == -1 and y < 84 and y + w > 60):   # the ALLEY on the west side (y 60..84 kept open)
                zw_apartment(i, side, y + w / 2, w, rnd.choice([18, 22, 26, 30]))
            i += 1
        y += w + 0.6
    # the alley: dumpster, crates, a lamp
    box("zw_alleyfloor", (24, 24, 0.1), (-22, 72, 0.05), zw_m("bc_walk", "#b8b0a5", 0.85), 0)
    box("zw_alleyback", (2, 26, 24), (-34, 72, 12), zw_brick("apt1", "#8f4636"), 0.05)
    box("zw_dump", (3, 5, 3), (-22, 66, 1.5), zw_m("dumpster", "#2e6b4a", 0.5, 0.3), 0.15)
    for k in range(3):
        box("zw_crate%d" % k, (1.6, 1.6, 1.6), (-26 - k * 0.3, 78 + k * 1.8, 0.8 + (k == 2) * 1.6), zw_m("crate", "#a07a4a", 0.8), 0.06)
    # factory with smokestacks at the end of the street
    box("zw_factory", (60, 24, 16), (0, 190, 8), zw_brick("factory", "#7e3e30"), 0.05)
    for k, sx in enumerate((-16, 4, 18)):
        cyl("zw_stack%d" % k, 2.2, 34 + k * 4, (sx, 194, 17 + k * 2), zw_brick("stack", "#8f4636"), 24)
        for s in range(4):
            sphere("zw_smoke%d_%d" % (k, s), 3 + s * 1.2, (sx + s * 1.5, 194 + s, 36 + k * 4 + s * 4.5), zw_m("smoke", "#b9b6b2", 0.95, alpha=0.75), seg=12)
    text("zw_fac_txt", (dress.get("landmark_text") or "WORKS").upper()[:14], (0, 177.8, 13), 2.4, zw_m("factxt", "#f3ead8", 0.6), extrude=0.06)
    # bunting across the street
    if "bunting" in (dress.get("props") or ["bunting"]):
        cols = ["#e2405b", "#ffd23f", "#3d8bfd", "#3fb6a8", "#ffffff"]
        for r, yy in enumerate((30, 62, 100)):
            cyl("zw_bline%d" % r, 0.05, 22, (0, yy, 13), zw_m("bline", "#333333", 0.6), 6, rot=(0, 90, 0))
            for k in range(12):
                poly_extrude("zw_flag%d_%d" % (r, k), [(-0.7, 0), (0.7, 0), (0, -1.4)], 0.05, (-10 + k * 1.8, yy, 13), zw_m("bunt%d" % (k % 5), cols[k % 5], 0.6), rot=(90, 0, 0))
    # a rooftop water tower
    for k in range(4):
        cyl("zw_wtleg%d" % k, 0.2, 6, (19 + (k % 2) * 4, 40 + (k // 2) * 4, 33), zw_m("wtleg", "#4a3a2a", 0.7), 6)
    cyl("zw_wtank", 3, 5, (21, 42, 38.5), zw_m("wtank", "#8a6a4a", 0.8), 20)
    cyl("zw_wroof", 3.3, 2.4, (21, 42, 42.2), zw_m("wroof", "#5a4a3a", 0.7), 20, r2=0.3)
    for k in range(8):
        zw_place_inst("lamp", ((-1) ** k * 9.8, 6 + k * 20, 0.3))
    if "cars" in (dress.get("props") or []):
        W.car("zw_bcar0", (3.5, 50, 0.06), "#2f4a7a", rot=180)
    if "blimp" in (dress.get("props") or []):
        zw_blimp((dress.get("blimp_text") or "ZYVO").upper()[:10], (-25, 100, 60))
    zw_people(t0, t1, int(dress.get("people", 8)), ((-10, 10), (10, 60)))
    zw_weather(dress.get("weather", "clear"))
    if zw_night():
        for k in range(5):
            light("zw_bnl%d" % k, "POINT", ((-1) ** k * 9, 10 + k * 30, 7), 900, (1.0, 0.78, 0.5), 1.5)
    return dict(street=(0, 40, 0), stoop=(7.6, 40, 0.3), alley=(-18, 74, 0), factory=(0, 170, 0))


# ---------------------------------------------------------------- INTERIORS (each at the origin; open toward -Y)
def zw_room(name, w=18, d=16, h=9, wall="#f3e6d6", floor="#c99a6b", window=True):
    box("zw_%s_floor" % name, (w, d, 0.3), (0, 0, -0.15), zw_m(name + "_floor", floor, 0.6), 0)
    box("zw_%s_back" % name, (w, 0.3, h), (0, d / 2, h / 2), zw_m(name + "_wall", wall, 0.85), 0)
    for s in (-1, 1):
        box("zw_%s_side%d" % (name, s), (0.3, d, h), (s * w / 2, 0, h / 2), zw_m(name + "_wall", wall, 0.85), 0)
    box("zw_%s_ceil" % name, (w, d, 0.3), (0, 0, h + 0.15), zw_m(name + "_ceil", "#fbf8f2", 0.9), 0)
    if window:
        box("zw_%s_win" % name, (5, 0.2, 3.6), (-w / 4, d / 2 - 0.1, 5), zw_m("roomwin", "#cfe8ff", 0.1, emit="#bfe0ff", estr=1.4), 0.02)
        box("zw_%s_winf" % name, (5.5, 0.3, 0.3), (-w / 4, d / 2 - 0.15, 3.1), zw_m("trimw", "#ffffff", 0.5), 0.02)
    light("zw_%s_key" % name, "AREA", (0, -6, h - 0.6), 900, (1.0, 0.95, 0.88), 8, target=(0, 2, 0))
    light("zw_%s_fill" % name, "AREA", (-w / 2 + 2, -2, 5), 250, (0.9, 0.95, 1.0), 4, target=(0, 0, 2))
    W.sky(0.8)


def zw_living(t0, t1, dress):
    zw_room("liv", wall="#f6dfd0", floor="#b88a5e")
    Mc = zw_m("couch", "#5b7fd6", 0.8)
    box("zw_couch", (8, 3, 1.4), (0, 4.8, 1.0), Mc, 0.3)
    box("zw_couchb", (8, 1.0, 2.6), (0, 6.3, 1.9), Mc, 0.3)
    for s in (-1, 1):
        box("zw_coucha%d" % s, (1.0, 3, 2.0), (s * 4.3, 4.8, 1.3), Mc, 0.3)
    box("zw_rug", (9, 6, 0.06), (0, 0.5, 0.03), zw_m("rug", "#f2c14e", 0.9), 0)
    box("zw_ctable", (3.6, 2, 1.0), (0, 0.8, 0.5), zw_m("wood", "#8a5a3a", 0.6), 0.1)
    box("zw_tvstand", (6, 1.6, 1.6), (0, -6.2, 0.8), zw_m("wood", "#8a5a3a", 0.6), 0.1)
    box("zw_tv", (5.4, 0.3, 3.0), (0, -6.2, 3.3), zw_m("tvscreen", "#10141c", 0.2, emit="#3a6aaa", estr=0.6), 0.1)
    cyl("zw_lamp_l", 0.12, 5, (6.5, 6, 2.5), zw_m("lampmetal", "#39404d", 0.4, 0.5), 8)
    sphere("zw_lamp_shade", 0.9, (6.5, 6, 5.3), zw_m("shade", "#fff3c4", 0.6, emit="#ffd9a0", estr=1.5), (1, 1, 0.8), seg=14)
    card("zw_liv_pic", 3, 2, (3, 7.84, 5.5), zw_m("pic", "#8fd18c", 0.6), "-Y")
    return dict(couch=(0, 4.2, 0.0), center=(0, 0.5, 0.0), tv=(0, -5, 0.0))


def zw_bedroom(t0, t1, dress):
    zw_room("bed", wall="#d9e8f6", floor="#c99a6b")
    box("zw_bedframe", (5.4, 8, 1.2), (4.5, 3.5, 0.6), zw_m("bedframe", "#8a5a3a", 0.6), 0.1)
    box("zw_mattress", (5.0, 7.6, 0.8), (4.5, 3.5, 1.6), zw_m("blanket", "#e2725b", 0.85), 0.25)
    box("zw_pillow", (3.4, 1.4, 0.6), (4.5, 6.6, 2.2), zw_m("pillow", "#ffffff", 0.9), 0.25)
    box("zw_nstand", (1.6, 1.6, 1.8), (1.0, 6.4, 0.9), zw_m("wood", "#8a5a3a", 0.6), 0.08)
    box("zw_desk", (5, 2.4, 0.3), (-5, 6.2, 2.6), zw_m("desk", "#e9dcc6", 0.6), 0.05)
    for s in (-1, 1):
        box("zw_deskleg%d" % s, (0.3, 2.2, 2.5), (-5 + s * 2.2, 6.2, 1.25), zw_m("desk", "#e9dcc6", 0.6), 0.03)
    box("zw_closet", (4, 2, 7.5), (-7.6, -3, 3.75), zw_m("closet", "#f7f3ea", 0.6), 0.1)
    card("zw_bed_poster", 2.6, 3.6, (-1.6, 7.84, 5.6), zw_m("poster", "#7b6cf6", 0.6), "-Y")
    return dict(bed=(4.5, 1.5, 0.0), desk=(-5, 4.6, 0.0), center=(0, 0, 0.0))


def zw_kitchen(t0, t1, dress):
    zw_room("kit", wall="#e8f5e8", floor="#e6e1d6")
    Mc = zw_m("cabinet", "#f7f3ea", 0.6)
    box("zw_counter", (14, 2.4, 3), (0, 6.6, 1.5), Mc, 0.08)
    box("zw_ctop", (14.2, 2.6, 0.3), (0, 6.6, 3.15), zw_m("ctop", "#5a6372", 0.3), 0.04)
    box("zw_upper", (10, 1.4, 2.4), (2, 7.2, 6.4), Mc, 0.06)
    box("zw_fridge", (3, 2.6, 7), (-7.4, 5.6, 3.5), zw_m("fridge", "#dfe7ef", 0.3, 0.2), 0.2)
    box("zw_stove", (2.8, 2.4, 0.2), (4, 6.6, 3.35), zw_m("stove", "#22262e", 0.3), 0.03)
    box("zw_ktable", (5, 3.6, 0.3), (0, 0.5, 2.8), zw_m("wood", "#8a5a3a", 0.6), 0.05)
    for sx in (-2.2, 2.2):
        for sy in (-1.5, 1.5):
            box("zw_ktl%d%d" % (int(sx), int(sy)), (0.25, 0.25, 2.7), (sx, 0.5 + sy, 1.35), zw_m("wood", "#8a5a3a", 0.6), 0.02)
    return dict(table=(0, -2, 0.0), counter=(0, 4.4, 0.0), fridge=(-7.4, 3.5, 0.0))


def zw_shop_in(t0, t1, dress):
    zw_room("shp", w=22, d=18, wall="#fdf0e0", floor="#d9d3c7")
    cols = ["#e2405b", "#ffd23f", "#3d8bfd", "#3fb6a8", "#7b6cf6", "#ff9f43"]
    for s in (-1, 1):
        for lvl in range(3):
            box("zw_shelf%d_%d" % (s, lvl), (2, 12, 0.25), (s * 9.6, 1, 1.6 + lvl * 2.2), zw_m("shelf", "#a87a4a", 0.6), 0.03)
            for k in range(7):
                box("zw_goods%d_%d_%d" % (s, lvl, k), (1.2, 1.0, 1.2), (s * 9.5, -4.4 + k * 1.6, 2.35 + lvl * 2.2), zw_m("goods%d" % ((k + lvl) % 6), cols[(k + lvl + s) % 6], 0.5), 0.12)
    box("zw_scounter", (8, 2.6, 3.2), (0, 5, 1.6), zw_m("scounter", "#5b7fd6", 0.6), 0.1)
    box("zw_register", (1.6, 1.2, 1.0), (2.4, 5, 3.7), zw_m("register", "#2b2f3a", 0.4, 0.3), 0.08)
    box("zw_shpsign", (8, 0.3, 1.6), (0, 8.84, 7.2), zw_m("signboard", "#fffdf5", 0.5), 0.05)
    text("zw_shpsign_t", ((dress.get("signs") or ["SHOP"])[0]).upper()[:12], (0, 8.6, 7.2), 1.1, zw_m("signtxt0", "#e2405b", 0.4), extrude=0.05)
    return dict(counter=(0, 2.6, 0.0), aisle=(5, -2, 0.0), center=(0, -2, 0.0))


def zw_big_hall(t0, t1, dress):
    zw_room("hall", w=40, d=44, h=18, wall="#efe2c8", floor="#a87444", window=False)
    box("zw_stage", (24, 10, 2.4), (0, 17, 1.2), zw_m("stage", "#7a4a2a", 0.6), 0.1)
    for s in (-1, 1):
        box("zw_curtain%d" % s, (7, 0.6, 15), (s * 15, 21.4, 7.5), zw_m("curtain", "#b3263a", 0.8), 0.1)
    box("zw_hall_banner", (16, 0.3, 2.4), (0, 21.6, 15), zw_m("signboard", "#fffdf5", 0.5), 0.05)
    text("zw_hall_banner_t", (dress.get("landmark_text") or "WELCOME").upper()[:16], (0, 21.4, 15), 1.5, zw_m("signtxt2", "#5b4bd6", 0.4), extrude=0.05)
    src = collection("zw_chair_src")
    box("zw_chs", (1.4, 1.4, 0.2), (0, 0, 1.4), zw_m("chair", "#3a5a8a", 0.6), 0.05, coll=src)
    box("zw_chb", (1.4, 0.2, 1.6), (0, 0.6, 2.2), zw_m("chair", "#3a5a8a", 0.6), 0.05, coll=src)
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
    W.sky(1.0)
    W2.cabin()
    return dict(aisle=(0, 0, 0))


def zw_kit_cockpit(t0, t1, dress):
    W.sky(1.0)
    W.cockpit()
    return dict(seat=(0, 0, 0))


def zw_kit_moon(t0, t1, dress):
    W.space_world(1.0)
    W2.moon()
    W2.earth()
    W.sun(3.0, rot=(60, 0, 30))
    return dict(surface=(0, 0, 0))


def zw_kit_sky(t0, t1, dress):
    W.sky(1.0)
    W.sun(4.0)
    W2.airliner("zw_airliner", (0, 0, 0), rot=0)
    W.cloud_field("zw_cf", (0, 0, -12), n=24)
    return dict(plane=(0, 0, 0))


def zw_kit_classroom(t0, t1, dress):
    W.sky(1.0)
    W.classroom_day()
    return dict(front=(0, 0, 0))


def zw_kit_hallway(t0, t1, dress):
    W.sky(1.0)
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
    "downtown_street": {"wide": ((0, -14, 9), (0, 70, 8), 22), "street": ((5, 6, 3.4), (-3, 40, 5), 26), "close": ((2.6, 30.4, 4.6), (8.0, 34, 4.4), 30), "skyline": ((-6, -40, 26), (0, 90, 30), 30)},
    "downtown_plaza": {"wide": ((-20, -48, 10), (0, -20, 3), 22), "street": ((-8, -40, 3.6), (0, -24, 3.5), 26), "close": ((-3, -17.5, 4.8), (0, -12, 4.4), 30)},
    "downtown_landmark": {"wide": ((0, 112, 6), (0, 178, 16), 22), "street": ((4, 140, 3.4), (0, 178, 12), 24), "close": ((1.5, 154.6, 4.8), (0, 160, 4.4), 30)},
    "suburb_street": {"wide": ((-40, -3, 7), (10, 16, 5), 22), "street": ((-12, -6, 3.4), (6, 14, 4), 26), "close": ((-2, 6, 4.8), (0, 11, 4.4), 30)},
    "suburb_porch": {"wide": ((8, -2, 6), (0, 18, 4), 24), "street": ((4, 6, 3.4), (0, 16, 3.6), 28), "close": ((2, 9.6, 4.2), (0, 15.5, 4.4), 30)},
    "brick_street": {"wide": ((0, -16, 10), (0, 80, 14), 22), "street": ((4, 10, 3.4), (-2, 50, 6), 26), "close": ((2.4, 35.6, 4.6), (7.6, 40, 4.4), 30), "skyline": ((-4, -30, 30), (0, 120, 25), 30)},
    "brick_alley": {"wide": ((4, 58, 6), (-20, 74, 3), 24), "street": ((-5, 66, 3.8), (-20, 74, 3.2), 26), "close": ((-12.6, 72, 4.8), (-18, 74, 4.4), 30)},
    "living_room": {"wide": ((-7, -7.4, 6.2), (1, 3, 2.2), 20), "street": ((0, -4.4, 3.6), (0, 4.2, 2.6), 24), "close": ((0.6, -1.4, 4.8), (0, 4.2, 4.4), 30)},
    "bedroom": {"wide": ((-7, -7.4, 6.4), (2, 3, 2), 20), "street": ((1, -3.6, 3.6), (4.5, 2, 2.4), 24), "close": ((2.6, -3.8, 4.8), (4.5, 1.5, 4.4), 30)},
    "kitchen": {"wide": ((7.4, -7.4, 6.2), (-1, 3, 2.4), 20), "street": ((0, -6.4, 3.6), (0, 3, 3), 24), "close": ((1, -7.4, 4.8), (0, -2, 4.4), 30)},
    "shop": {"wide": ((-9, -8.4, 6.4), (2, 4, 2.4), 20), "street": ((0, -6.6, 3.6), (0, 4, 3.2), 24), "close": ((0.8, -2.8, 4.8), (0, 2.6, 4.4), 30)},
    "big_hall": {"wide": ((-16, -20, 10), (0, 12, 3), 22), "street": ((0, -14, 4), (0, 16, 5), 24), "close": ((1, 10.6, 7.0), (0, 16, 6.8), 30)},
    # the kit's sets: the cameras its own example videos use (close: head and shoulders)
    "plane_cabin": {"wide": ((0, -3, 6.5), (0, 16, 3.8), 22), "street": ((0, 2, 5.2), (0, 14, 3.8), 24), "close": ((0.8, 4.6, 4.8), (0, 10, 4.4), 30)},
    "cockpit": {"wide": ((0.6, -7.5, 6.8), (-1.2, 1.5, 4.4), 20), "street": ((1.8, -4.6, 5.2), (-2.2, -0.5, 4.6), 22), "close": ((-0.4, -5.0, 5.4), (-2.2, -0.5, 5.0), 30)},
    "moon": {"wide": ((8, -16, 5), (0, 2, 4), 24), "street": ((4, -10, 3.2), (0, 0, 2.6), 24), "close": ((1.4, -5.4, 4.8), (0, 0, 4.4), 30)},
    "sky_airliner": {"wide": ((30, -60, 10), (0, 10, 0), 26), "street": ((15, -30, 4), (0, 0, 0), 26), "close": ((10, -12, 3), (0, -2, 1), 30)},
    "classroom": {"wide": ((7, -4, 8), (-2, 14, 4.5), 22), "street": ((0, 2, 4.2), (-2, 14, 4.5), 26), "close": ((-0.8, 4.2, 4.8), (-1.5, 9.6, 4.4), 30)},
    "hallway": {"wide": ((1.5, -6, 5.5), (0, 10, 4), 22), "street": ((0.6, -1, 4.4), (0, 8, 4), 28), "close": ((0.6, 2.6, 4.8), (0, 8, 4.4), 30)},
}
ZW_DRESS_DEFAULT = {"downtown_street": {"landmark": "bank"}, "downtown_plaza": {"landmark": "bank"}, "downtown_landmark": {"landmark": "bank"}}


def zw_build(place, t0, t1, dress=None):
    d = dict(ZW_DRESS_DEFAULT.get(place, {}))
    d.update(dress or {})
    ZW_T.clear()
    ZW_T.update(d)
    return ZW_PLACES[place](t0, t1, d)


def zw_spot(cam, place, spot, t0, t1, push=0.08, lens=None):
    """a TESTED camera spot of a library place, with a gentle push in (every shot moves)"""
    loc, tgt, ln = ZW_SPOTS[place][spot]
    loc, tgt = Vector(loc), Vector(tgt)
    end = loc + (tgt - loc) * push
    cam.key(t0, tuple(loc), tuple(tgt), lens=lens or ln)
    cam.key(t1, tuple(end), tuple(tgt), lens=lens or ln)
    return loc, tgt
# ===== END OF THE ZYVO WORLD LIBRARY =====================================================================
