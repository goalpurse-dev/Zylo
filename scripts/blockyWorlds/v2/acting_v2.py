# ===== IN THIS TOWN v2, OVERNIGHT BUILD 2: THE ACTING LIBRARY (scripts/blockyWorlds/v2/acting_v2.py) ================
# Pasted after giants_v2.py. Nobody just stands: every move is THREE poses (a 3-frame strip: start, middle, end) on the
# base character's joints (degrees: X swing, - = forward / up; Y = out to the side; Z = twist; hip_dz drops the hips).
# body_rx lays the whole body down (crawl, hide under a bed, sleep, fall), body_dz lowers it. The planner may only use
# moves whose strip passed (places/passed.json "moves").
ZC_POSES.update({
    "sprint":      {"thighL": (-62, 0, 0), "kneeL": (40, 0, 0), "thighR": (40, 0, 0), "kneeR": (95, 0, 0), "shoulderL": (60, -8, 0), "shoulderR": (-64, 8, 0), "elbowL": (-80, 0, 0), "elbowR": (-90, 0, 0), "torso": (-22, 0, 0), "hip_dz": -0.1},
    "sprint_back": {"thighL": (-58, 0, 0), "kneeL": (40, 0, 0), "thighR": (36, 0, 0), "kneeR": (90, 0, 0), "shoulderL": (56, -8, 0), "shoulderR": (-58, 8, 0), "elbowL": (-80, 0, 0), "elbowR": (-85, 0, 0), "torso": (-14, 0, 22), "neck": (0, 0, 70), "hip_dz": -0.1},
    "hide_low":    {"thighL": (-90, -10, 0), "kneeL": (125, 0, 0), "thighR": (-90, 10, 0), "kneeR": (125, 0, 0), "torso": (-38, 0, 0), "neck": (16, 0, 0), "shoulderL": (-70, -20, 0), "shoulderR": (-70, 20, 0), "elbowL": (-110, 0, 0), "elbowR": (-110, 0, 0), "hip_dz": -0.62},
    "prone":       {"thighL": (6, 0, 0), "thighR": (6, 0, 0), "shoulderL": (-170, -12, 0), "shoulderR": (-170, 12, 0), "elbowL": (-30, 0, 0), "elbowR": (-30, 0, 0), "neck": (40, 0, 0), "body_rx": -90, "body_dz": 0.35},
    "crawl1":      {"thighL": (-80, 0, 0), "kneeL": (90, 0, 0), "thighR": (-40, 0, 0), "kneeR": (60, 0, 0), "shoulderL": (-100, -6, 0), "shoulderR": (-70, 6, 0), "neck": (40, 0, 0), "body_rx": -70, "body_dz": 0.2},
    "crawl2":      {"thighL": (-40, 0, 0), "kneeL": (60, 0, 0), "thighR": (-80, 0, 0), "kneeR": (90, 0, 0), "shoulderL": (-70, -6, 0), "shoulderR": (-100, 6, 0), "neck": (40, 0, 0), "body_rx": -70, "body_dz": 0.2},
    "squeeze":     {"shoulderL": (-10, -2, 0), "shoulderR": (-10, 2, 0), "elbowL": (-120, 0, 0), "elbowR": (-120, 0, 0), "torso": (0, 0, 0), "neck": (-4, 0, 0)},
    "peek_side":   {"torso": (0, -34, 0), "neck": (0, -22, 0), "shoulderR": (-50, 34, 0), "elbowR": (-70, 0, 0), "shoulderL": (0, -10, 0), "thighL": (-8, -10, 0)},
    "climb1":      {"thighL": (-90, 0, 0), "kneeL": (95, 0, 0), "shoulderR": (-170, 6, 0), "shoulderL": (-120, -6, 0), "elbowL": (-30, 0, 0), "neck": (-20, 0, 0), "torso": (-6, 0, 0)},
    "climb2":      {"thighR": (-90, 0, 0), "kneeR": (95, 0, 0), "shoulderL": (-170, -6, 0), "shoulderR": (-120, 6, 0), "elbowR": (-30, 0, 0), "neck": (-20, 0, 0), "torso": (-6, 0, 0)},
    "jump_crouch": {"thighL": (-60, -6, 0), "kneeL": (90, 0, 0), "thighR": (-60, 6, 0), "kneeR": (90, 0, 0), "torso": (-28, 0, 0), "shoulderL": (40, -10, 0), "shoulderR": (40, 10, 0), "hip_dz": -0.35},
    "jump_air":    {"thighL": (-40, 0, 0), "kneeL": (70, 0, 0), "thighR": (-20, 0, 0), "kneeR": (90, 0, 0), "shoulderL": (-160, -20, 0), "shoulderR": (-160, 20, 0), "neck": (-12, 0, 0), "body_dz": 1.4},
    "stumble":     {"thighL": (-30, 0, 0), "kneeL": (20, 0, 0), "thighR": (40, 0, 0), "kneeR": (60, 0, 0), "torso": (-34, 0, 0), "shoulderL": (-110, -30, 0), "shoulderR": (-100, 30, 0), "elbowL": (-20, 0, 0), "elbowR": (-20, 0, 0)},
    "fall":        {"thighL": (20, 0, 0), "kneeL": (30, 0, 0), "thighR": (-10, 0, 0), "kneeR": (40, 0, 0), "shoulderL": (-140, -40, 0), "shoulderR": (-130, 40, 0), "neck": (30, 0, 0), "body_rx": -60, "body_dz": 0.6},
    "wave":        {"shoulderR": (-160, 30, 0), "elbowR": (-40, 0, 20), "shoulderL": (0, -8, 0), "torso": (0, 0, 6), "neck": (0, 0, -6)},
    "wave2":       {"shoulderR": (-160, 10, 0), "elbowR": (-40, 0, -20), "shoulderL": (0, -8, 0), "torso": (0, 0, -6)},
    "shiver":      {"shoulderL": (-60, 30, 0), "shoulderR": (-60, -30, 0), "elbowL": (-120, 0, 0), "elbowR": (-120, 0, 0), "torso": (-10, 0, 0), "neck": (14, 0, 0), "thighL": (0, 6, 0), "thighR": (0, -6, 0)},
    "cover_mouth": {"shoulderR": (-120, -20, 0), "elbowR": (-120, 0, 0), "shoulderL": (-20, -8, 0), "elbowL": (-40, 0, 0), "torso": (6, 0, 0), "neck": (8, 0, 0)},
    "cover_eyes":  {"shoulderL": (-130, 18, 0), "shoulderR": (-130, -18, 0), "elbowL": (-125, 0, 0), "elbowR": (-125, 0, 0), "neck": (10, 0, 0), "torso": (-4, 0, 0)},
    "look_up":     {"neck": (-36, 0, 0), "torso": (10, 0, 0), "shoulderL": (6, -10, 0), "shoulderR": (6, 10, 0)},
    "back_away":   {"thighL": (22, 0, 0), "kneeL": (14, 0, 0), "thighR": (-12, 0, 0), "torso": (10, 0, 0), "shoulderL": (-70, -24, 0), "shoulderR": (-70, 24, 0), "elbowL": (-30, 0, 0), "elbowR": (-30, 0, 0), "neck": (6, 0, 0)},
    "push":        {"thighL": (-30, 0, 0), "kneeL": (20, 0, 0), "thighR": (30, 0, 0), "torso": (-26, 0, 0), "shoulderL": (-88, -4, 0), "shoulderR": (-88, 4, 0), "elbowL": (-10, 0, 0), "elbowR": (-10, 0, 0)},
    "pull":        {"thighL": (-36, 0, 0), "kneeL": (30, 0, 0), "thighR": (20, 0, 0), "torso": (16, 0, 0), "shoulderL": (-70, -4, 0), "shoulderR": (-70, 4, 0), "elbowL": (-40, 0, 0), "elbowR": (-40, 0, 0), "hip_dz": -0.1},
    "sleep":       {"shoulderL": (-10, -20, 0), "shoulderR": (-10, 20, 0), "elbowL": (-30, 0, 0), "elbowR": (-30, 0, 0), "neck": (0, 0, 20), "body_rx": 90, "body_dz": 1.3},
    "wake_start":  {"thighL": (-80, 0, 0), "kneeL": (20, 0, 0), "thighR": (-80, 0, 0), "kneeR": (20, 0, 0), "shoulderL": (-60, -40, 0), "shoulderR": (-60, 40, 0), "elbowL": (-50, 0, 0), "elbowR": (-50, 0, 0), "torso": (-8, 0, 0), "hip_dz": -0.42, "body_dz": 1.0},
    "cheer":       {"shoulderL": (-170, -30, 0), "shoulderR": (-170, 30, 0), "elbowL": (-10, 0, 0), "elbowR": (-10, 0, 0), "neck": (-10, 0, 0), "torso": (6, 0, 0)},
    "freeze":      {"shoulderL": (-40, -20, 0), "shoulderR": (-40, 20, 0), "elbowL": (-60, 0, 0), "elbowR": (-60, 0, 0), "torso": (4, 0, 0), "thighL": (-12, 0, 0)},
    "head_tilt":   {"neck": (0, 26, 0), "torso": (-4, 0, 0), "shoulderL": (0, -6, 0), "shoulderR": (0, 6, 0)},
    "loom":        {"torso": (-30, 0, 0), "neck": (-20, 0, 0), "shoulderL": (-120, -30, 0), "shoulderR": (-120, 30, 0), "elbowL": (-40, 0, 0), "elbowR": (-40, 0, 0)},
    "stalk":       {"thighL": (-30, 0, 0), "kneeL": (40, 0, 0), "thighR": (20, 0, 0), "kneeR": (50, 0, 0), "torso": (-24, 0, 0), "neck": (-14, 0, 0), "shoulderL": (-30, -16, 0), "shoulderR": (-30, 16, 0), "elbowL": (-60, 0, 0), "elbowR": (-60, 0, 0), "hip_dz": -0.12},
    "grab_reach":  {"torso": (-24, 0, 0), "shoulderR": (-100, 10, 0), "shoulderL": (-90, -10, 0), "elbowR": (-10, 0, 0), "elbowL": (-14, 0, 0), "neck": (-6, 0, 0)},
})

# THE MOVES: three poses + faces each (start, middle, end); "set" = a simple prop of the move's strip
ZV_MOVES = {
    # hero + townspeople
    "run": (["walk", "run", "sprint"], ["worried", "scared", "scared"], None),
    "sprint_look_back": (["run", "sprint", "sprint_back"], ["scared", "scared", "terrified"], None),
    "crouch_hide": (["crouch2", "hide_low", "hide_low"], ["worried", "scared", "terrified"], "crate"),
    "hide_under_bed": (["crouch", "crawl1", "prone"], ["scared", "scared", "terrified"], "bed"),
    "hide_in_closet": (["walk", "squeeze", "squeeze"], ["scared", "terrified", "scared"], "closet"),
    "peek_corner": (["stand", "peek", "peek_side"], ["worried", "worried", "scared"], "wall"),
    "climb": (["reach_up", "climb1", "climb2"], ["thinking", "worried", "happy"], "ladder"),
    "jump": (["jump_crouch", "jump_air", "jump_crouch"], ["happy", "big_smile", "happy"], None),
    "fall": (["stumble", "fall", "prone"], ["worried", "scared", "sad"], None),
    "crawl": (["crouch", "crawl1", "crawl2"], ["worried", "scared", "worried"], None),
    "trip": (["walk", "stumble", "fall"], ["neutral", "scared", "scared"], None),
    "point": (["stand", "point", "point"], ["thinking", "worried", "scared"], None),
    "wave": (["stand", "wave", "wave2"], ["happy", "big_smile", "big_smile"], None),
    "shiver": (["shiver", "shiver", "shiver"], ["worried", "scared", "worried"], None),
    "cover_mouth": (["flinch", "cover_mouth", "cover_mouth"], ["scared", "terrified", "scared"], None),
    "cover_eyes": (["flinch", "cover_eyes", "cover_eyes"], ["scared", "scared", "terrified"], None),
    "look_up_slowly": (["stand", "look_up", "look_up"], ["neutral", "worried", "terrified"], None),
    "back_away": (["flinch", "back_away", "back_away"], ["scared", "scared", "terrified"], None),
    "carry": (["pick_up", "hold_box", "hold_box"], ["thinking", "happy", "happy"], "box"),
    "push": (["lean_in", "push", "push"], ["thinking", "angry", "angry"], "crate"),
    "pull": (["reach", "pull", "pull"], ["thinking", "angry", "angry"], "crate"),
    "hug": (["walk", "hug", "hug"], ["happy", "big_smile", "happy"], "hug"),
    "sit": (["stand", "crouch", "sit"], ["neutral", "neutral", "happy"], "bench"),
    "sleep": (["sleep", "sleep", "sleep"], ["sleepy", "sleepy", "sleepy"], "bed_top"),
    "wake_with_a_start": (["sleep", "wake_start", "wake_start"], ["sleepy", "scared", "terrified"], "bed_top"),
    # villains
    "head_tilt": (["stand", "head_tilt", "head_tilt"], ["smug", "smug", "smug"], None),
    "lean_in_villain": (["stand", "lean_in", "loom"], ["smug", "smug", "angry"], None),
    "grin_widening": (["stand", "head_tilt", "head_tilt"], ["neutral", "smug", "big_smile"], None),
    "villain_reach": (["stand", "grab_reach", "grab_reach"], ["smug", "angry", "angry"], None),
    "loom": (["stand", "lean_in", "loom"], ["smug", "angry", "angry"], None),
    "stalk_walk": (["stalk", "stalk", "stalk"], ["smug", "smug", "angry"], None),
    "appear_behind": (["stand", "lean_in", "loom"], ["smug", "smug", "big_smile"], "victim"),
    "stretch_tall": (["stand", "loom", "loom"], ["smug", "smug", "angry"], "stretch"),
}
# crowds: the town's people, three phases each (the action per phase; the crowd placement is the place test's)
ZV_CROWD_MOVES = {
    "panic_run": [["run", "flinch", "run"], ["sprint", "sprint_back", "run"], ["sprint", "sprint", "sprint_back"]],
    "freeze_all": [["walk", "talk", "walk"], ["freeze", "freeze", "freeze"], ["freeze", "freeze", "freeze"]],
    "all_look_up": [["walk", "talk", "stand"], ["look_up", "point", "look_up"], ["look_up", "look_up", "look_up"]],
    "cheer": [["stand", "wave", "stand"], ["cheer", "wave", "cheer"], ["cheer", "cheer", "jump_air"]],
    "gather_ring": [["walk", "walk", "walk"], ["walk", "point", "lean_in"], ["lean_in", "point", "lean_in"]],
    "scatter": [["flinch", "flinch", "flinch"], ["run", "sprint_back", "run"], ["sprint", "sprint", "sprint"]],
}


def zv_body_pose(ch, pose, t0):
    """a pose that lays the body down (body_rx) or lifts it (body_dz): the whole root turns / rises"""
    P_ = ZC_POSES.get(pose, {})
    if "body_rx" in P_ or "body_dz" in P_:
        r = ch.root.rotation_euler
        ch.root.rotation_euler = (math.radians(P_.get("body_rx", 0.0)), r[1], r[2])
        lx, ly, lz = tuple(ch.root.location)
        ch.root.location = (lx, ly, lz + P_.get("body_dz", 0.0))


def zv_move_set(kind, at, t0, t1):
    """the simple prop a move's strip needs (all solid-looking, our own)"""
    x, y, z = at
    wood, dk = mat("zm_wood", zc_rgb("#8A5A3A"), 0.8), mat("zm_dark", zc_rgb("#2E2A2A"), 0.9)
    if kind == "crate":
        box("zm_crate", (2.2, 1.6, 1.6), (x + 0.2, y - 1.9, z + 0.8), wood, 0.05)
    elif kind == "bed":
        box("zm_bedtop", (3.2, 5.0, 0.45), (x, y + 0.6, z + 1.35), mat("zm_quilt", zc_rgb("#5B7FD0"), 0.9), 0.08)
        for sx in (-1.5, 1.5):
            for sy in (-1.8, 3.0):
                box("zm_bedleg%d%d" % (int(sx), int(sy)), (0.2, 0.2, 1.15), (x + sx, y + sy, z + 0.58), wood, 0.02)
    elif kind == "bed_top":
        box("zm_bed", (3.2, 5.4, 1.0), (x, y, z + 0.5), mat("zm_quilt", zc_rgb("#5B7FD0"), 0.9), 0.08)
        box("zm_pillow", (2.0, 0.9, 0.35), (x, y - 2.0, z + 1.2), mat("zm_pil", zc_rgb("#F4F0E6"), 0.9), 0.1)
    elif kind == "closet":
        box("zm_closet_back", (3.0, 0.2, 5.6), (x, y + 1.2, z + 2.8), wood, 0.02)
        for s in (-1, 1):
            box("zm_closet_side%d" % s, (0.2, 2.4, 5.6), (x + s * 1.5, y, z + 2.8), wood, 0.02)
        box("zm_closet_top", (3.2, 2.4, 0.2), (x, y, z + 5.7), wood, 0.02)
        box("zm_closet_door", (1.5, 0.15, 5.4), (x + 0.75, y - 1.25, z + 2.8), mat("zm_door", zc_rgb("#B07A4A"), 0.8), 0.02)
    elif kind == "wall":
        box("zm_wall", (0.6, 6.0, 6.0), (x - 1.3, y + 0.4, z + 3.0), mat("zm_wallm", zc_rgb("#C8B8A0"), 0.9), 0.02)
    elif kind == "ladder":
        e = zv_recipe("ladder", "fw_ladder", None)
        e.location = (x, y + 0.9, z)
    elif kind == "box":
        pass
    elif kind == "bench":
        box("zm_bench", (3.0, 1.2, 0.3), (x, y + 0.4, z + 1.25), wood, 0.05)
    return None


def zv_move_test(move, phase, t0, t1, opt=None):
    """ONE frame of a move's 3-frame strip on a plain stage (night-blue backdrop): the person in that phase's pose + face,
    the move's prop; villains are the villain spec; 'appear_behind' puts a victim in front"""
    opt = opt or {}
    poses, faces, setk = ZV_MOVES[move]
    pose, face = poses[phase], faces[phase]
    zv_world((0.32, 0.38, 0.5), 0.9)
    zv_sun((1.0, 0.96, 0.9), 2.6, 50, -30)
    box("zt_floor", (300, 300, 0.2), (0, 0, -0.1), mat("zt_floorm", zc_rgb("#6A7A62"), 0.9), 0.0)
    box("zt_back", (120, 0.4, 60), (0, 30, 30), mat("zt_backm", zc_rgb("#9FB4C8"), 0.9), 0.0)
    ZW_T["time"] = "day"
    ZW_T["_std"] = True
    ZV_TIME["t"] = None
    ZV_SETLOOK.update({"exposure": 0.0})
    villain = move in ("head_tilt", "lean_in_villain", "grin_widening", "villain_reach", "loom", "stalk_walk", "appear_behind", "stretch_tall")
    spec = "villain_mayor" if villain and "villain_mayor" in ZC_SPECS else opt.get("spec", "me")
    z0 = 1.85 if setk in ("bed_top",) else 0.0
    ch = zv_person("Mv", spec, (0, 0, 0), face_to=(2.5, -16, 2.0), pose=pose, face=face, t0=t0, t1=t1)
    zv_body_pose(ch, pose, t0)
    if setk == "bed":
        ch.root.location = (0, 0.6, 0.35)
    if setk:
        zv_move_set(setk, (0, 0, 0), t0, t1)
    if setk == "box":
        zv_attach(ch, zv_recipe("box", "fw_carry", "closed"), "hand", "box")
    if setk == "hug":
        o = zv_person("Mv2", "mom", (1.4, 0.6, 0), face_to=(0, 0, 2.0), pose="hug", face="happy", t0=t0, t1=t1)
    if setk == "victim":
        v = zv_person("Mv2", "me", (1.2, -2.2, 0), face_to=(0, -16, 2.0), pose="freeze", face="scared", t0=t0, t1=t1)
        ch.root.location = (-0.4, 1.4, 0)
    if setk == "stretch" and phase > 0:
        zv_stretch(ch, legs=1.0 + 0.35 * phase, neck=1.0 + 0.5 * phase)
    cam = Cam()
    lay = ZC_POSES.get(pose, {}).get("body_rx")
    cl, ct, lens = ((5.5, -9.5, 3.2), (0, 0.4, 1.6), 30) if not lay else ((4.5, -8.0, 4.4), (0, 0.8, 0.9), 30)
    if setk in ("closet", "ladder") or (setk == "stretch"):
        cl, ct, lens = (4.5, -11.5, 4.0), (0, 0, 2.6), 28
    cam.key(t0, cl, ct, lens=lens)
    cam.key(t1, cl, ct, lens=lens)
    zc_char_light(ch, cl, "day")
    ZV_SHOT.clear()
    ZV_SHOT.update({"cam": "move", "subjects": [] if lay or setk in ("bed", "closet") else [("mv", ch)], "creature": None, "need": [], "hand_head": None, "entity_seen": False, "read_texts": None})
    return {"move": move, "phase": phase}


ZV_PERSON0 = zv_person


def zv_person(name, spec_id, loc, face_to=None, pose="stand", face=None, t0=0.0, t1=1.0, badge=None):
    ch = ZV_PERSON0(name, spec_id, loc, face_to=face_to, pose=pose, face=face, t0=t0, t1=t1, badge=badge)
    zv_body_pose(ch, pose, t0)
    return ch
