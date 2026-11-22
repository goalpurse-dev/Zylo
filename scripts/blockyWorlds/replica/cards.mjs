// THE REPLICA CARDS (owner 2026-11-22, INTERNAL TEST ONLY: never posted, never a template, never shown to customers).
// One card per shot of the reference, written by hand from its frames (4 a second, the shot cuts from ffmpeg): what is
// in frame, where everyone stands, the camera (a named SHOT RECIPE from worlds/pieces.py) and its move, the faces, the
// start and end frame, and the word it cuts on. The bodies use only the library (worlds.py + acts.py + pieces.py).
// The look: blue moonlit night (a cool sun added), a vignette + the fade in the finish (ffmpeg), the flashback in day.

// the set every night shot shares: the suburb street at night, the kid's bedroom (a real window to the street, the
// door in its back wall), Noah's streetlight across the street (x -10), a cool moonlight
export const PREAMBLE = `
RP_ROOM_LOC, RP_ROOM_ROT = (-3.0, -18.0, 0.0), 180.0
RP_FACE_WIN, RP_FACE_ROOM = RP_ROOM_ROT, RP_ROOM_ROT + 180.0
RP_LAMP = (-10.0, 9.6, 0.0)
RP_NOAH = (-8.8, 7.4, 0.0)   # Noah stands in front of the lamp (the bulb was right over his head)
RP_LOOKS = {
    "kid": dict(skin="#f1dfc6", shirt="#d8352a", pants="#2a3f8a", hair="spiky", hair_color="#3a2418", face="kid"),
    "noah": dict(skin="#f1dfc6", shirt="#3a5fd8", pants="#222428", hair="spiky", hair_color="#f2c14e", face="kid"),
    "mom": dict(skin="#f1dfc6", shirt="#2ab3a8", pants="#3a3a4a", hair="bun", hair_color="#e2581f", face="girl", kid=False),
    "girl": dict(skin="#f5d6b8", shirt="#3ec7d6", pants="#5a4a9a", hair="short", hair_color="#1a1a22", face="girl"),
    "curlers": dict(skin="#f2e14e", shirt="#e0803a", pants="#4a3a2a", hair="bun", hair_color="#7a3ad6", face="girl", kid=False),
    "man": dict(skin="#e0c070", shirt="#e8c02a", pants="#3a3a4a", hair="messy", hair_color="#2a1d16", face="plain", kid=False),
    "dark": dict(skin="#d9b48f", shirt="#2f3f7a", pants="#2b2b2b", hair="short", hair_color="#151212", face="plain", kid=False),
    "pink": dict(skin="#f1dfc6", shirt="#d8d8e8", pants="#5a5a7a", hair="bun", hair_color="#f07ab8", face="girl", kid=False),
    "kidg": dict(skin="#f2e14e", shirt="#2fae5a", pants="#2a3f8a", hair="short", hair_color="#2a1d16", face="kid"),
    "kidr": dict(skin="#a8714a", shirt="#d8352a", pants="#2b2b2b", hair="short", hair_color="#151212", face="kid"),
}


def rp_person(key, loc, rot, t0, name=None, face="neutral"):
    """copy mode: every character has a PLAIN head with our dot face (zp_dotface), not the kit's faces"""
    lk = dict(RP_LOOKS[key])
    kw = dict(shirt_kind="checker", shirt_c2="#1a2a6a") if key == "noah" else {}
    ch = chars.Char(name or key.title(), skin=lk["skin"], shirt=lk["shirt"], pants=lk["pants"], hair=lk["hair"], hair_color=lk["hair_color"], face=None, scale=1.0 if lk.get("kid", True) else 1.12, **kw)
    ch.pose(t0, loc=tuple(loc), rot=rot)
    if key == "girl":   # the reference's pigtails (our own two balls; the kit has no such hair)
        Mh = zw_m("pigtail", lk["hair_color"], 0.7)
        for sx in (-1, 1):
            sphere("%s_pig%d" % (ch.root.name, sx), 0.42, (sx * 0.9, 0.15, 0.25), Mh, (0.8, 0.8, 1.0), parent=ch.head, seg=10)
    zp_dotface(ch, [(t0 - 1.0, face)])
    return ch


def rp_face(ch, t0, t1, expr, talk=False, end=None):
    """a dot face from t0 (+ another one near the end), the mouth on the words when talk"""
    seq = [(t0 - 1.0, expr)] + ([(t0 + 0.6 * (t1 - t0), end)] if end else [])
    return zp_dotface(ch, seq, talk=(t0, t1) if talk else None)


def rp_room_pt(x, y, z=0.0):
    return tuple(zp_l2w(RP_ROOM_LOC, RP_ROOM_ROT, (x, y, z)))


def rp_set(t0, t1, time="night", room=True, people=0):
    ZW_INFO = zw_build("suburb_street", t0, t1, dict(time=time, people=0, props=["none"], copy=True, exposure=(-0.15 if room else -0.55) if time == "night" else 0.0))
    if time == "night":
        # the reference's night sky is near black: the sky light down to a third
        try:
            for nd in bpy.context.scene.world.node_tree.nodes:
                if nd.type == "BACKGROUND":
                    nd.inputs[1].default_value *= 0.35
        except Exception as e:
            print("rp_set sky: %s" % e)
        # COPY MODE night: the reference's cold blue moonlight on the house fronts and faces (from the street side, high)
        zw_novol(light("rp_moon", "SUN", (0, 0, 50), 1.25, (0.42, 0.55, 1.0), 2, rot=(52, 0, 12), shadow=True))
        zw_novol(light("rp_moon2", "SUN", (0, 0, 50), 0.35, (0.4, 0.5, 1.0), 6, rot=(60, 0, 190), shadow=False))
        zp_streetpool(RP_LAMP, 600.0)
    before = set(o.name for o in D.objects)
    R = zp_room(RP_ROOM_LOC, RP_ROOM_ROT, 12.0, 14.0, 9.0, 5.0, 4.0) if room else None   # deep like the reference's (the door small, far)
    if R:
        # the street set's own pieces INSIDE the room go (round 2 c4: the kid's house walls + roof stood in the deeper room)
        bpy.context.view_layer.update()
        a, b = rp_room_pt(-5.8, 0.45, 0.0), rp_room_pt(5.8, 13.6, 0.0)
        lo = Vector((min(a[0], b[0]), min(a[1], b[1]), 0.3))
        hi = Vector((max(a[0], b[0]), max(a[1], b[1]), 8.7))
        gone = 0
        for o in D.objects:
            if o.name not in before or o.name.startswith("zw_src_") or o.hide_render:
                continue
            bx = zw_box_of(o)
            if bx is None:
                continue
            l, h = bx
            if (h.x - l.x) > 60 or (h.y - l.y) > 60:
                continue   # the ground, the roads
            if l.x < hi.x and h.x > lo.x and l.y < hi.y and h.y > lo.y and l.z < hi.z and h.z > lo.z:
                o.hide_render = True
                gone += 1
        print("rp_set: %d street piece(s) inside the room hidden" % gone)
        zp_bed(rp_room_pt(-3.4, 5.6), RP_ROOM_ROT + 90, "#3d5fb8")
        box("rp_dresser", (2.6, 1.6, 2.2), rp_room_pt(4.2, 8.6, 1.1), zw_m("dresser", "#8a6040", 0.7), 0.06)
    return R


def rp_window_person(key, x, t0, smile=True, lit=True, curtain=None, z=3.2, depth=0.8, glow="#7d8fc8", estr=0.35, wall="#dde2ea", fill=True, mullion=True):
    """a neighbor behind a window on the north houses' fronts (the street side): a wall around the window (only the
    inside shows), a dim cool room behind, a soft cool light on the face from the street (the reference's faces read)"""
    w = zp_window((x, 16.9, z), 0.0, 3.2, 3.0, lit=lit, curtain=curtain, glow=glow, estr=estr, surround=wall, mullion=mullion)
    ch = rp_person(key, (x, 17.5, 0), 0.0, t0, name="N_%s_%d" % (key, int(x * 10)))
    zp_behind_window(ch, w, depth)
    if fill and zw_night():
        zw_novol(light("rp_wfill_%d" % int(x * 10 + z), "AREA", (x, 16.9 - 4.5, z + 2.6), 220.0, (0.62, 0.72, 1.0), 3.0, target=(x, 17.6, z + 1.4), shadow=False))
    if smile:
        rp_face(ch, t0, t0 + 5, "smile")
    return w, ch
`;

const at = (u) => `(t0 + ${u} * (t1 - t0))`;
// every card: cut = the first word of the shot (matched in order on the voice's words), the card data, the shot code
export const CARDS = [
  { cut: "In", what: "aerial wide over the night street: houses both sides, lamps, a car", camera: "zr_aerial high, slow push", faces: "-",
    py: `R = rp_set(t0, t1, room=False)\nzr_aerial(cam, t0, t1, over=(-30, 2, 0), height=40.0, back=36.0, lens=30, push=0.06, yaw=36)` },
  { cut: "nobody", what: "the aerial, still pushing in (the reference holds it)", camera: "zr_aerial lower, push", faces: "-",
    py: `R = rp_set(t0, t1, room=False)
zr_aerial(cam, t0, t1, over=(-30, 2, 0), height=37.6, back=33.8, lens=30, push=0.06, yaw=36)` },
  { cut: "after", what: "the red digital clock 9:58 on the kid's dresser, the room dark", camera: "zr_object (object close-up), side", faces: "-",
    py: `R = rp_set(t0, t1)
clk = zp_clock(rp_room_pt(4.2, 8.6, 2.2), RP_ROOM_ROT, 0.55)
zr_match(cam, t0, t1, clk, 0.30, u=0.6, v=0.47, angle="eye", side=-15, lens=30, maxd=7.0, card=3)` },
  { cut: "Every", what: "two kids walking on the sidewalk toward the camera at night", camera: "low, ahead of them, still", faces: "kids neutral",
    py: `R = rp_set(t0, t1, room=False)
a = rp_person("kidg", (21.0, 8.4, 0.2), 90, t0)
b = rp_person("kidr", (22.5, 7.4, 0.2), 90, t0)
a.walk(t0, t1, (21.0, 8.4, 0.2), (17.0, 8.4, 0.2))
b.walk(t0, t1, (22.5, 7.4, 0.2), (18.5, 7.4, 0.2))
zr_match(cam, t0, t1, a, 0.32, u=0.5, v=0.52, angle="eye", side=8, lens=30, card=4)` },
  { cut: "at", what: "the clock close: 9:58 turns to 9:59 on '9:59'", camera: "zr_object straight on, push", faces: "-",
    py: `R = rp_set(t0, t1)
clk = zp_clock(rp_room_pt(4.2, 8.6, 2.2), RP_ROOM_ROT, 0.55, t_change=${"{{9:59}}"})
zr_match(cam, t0, t1, clk, 0.26, u=0.5, v=0.5, angle="eye", side=0, lens=30, push=0.06, maxd=7.0, card=5)` },
  { cut: "all", what: "a dark-haired neighbor behind a lit window", camera: "straight on the window from the street", faces: "neutral",
    py: `R = rp_set(t0, t1, room=False)
w, n = rp_window_person("dark", 2.0, t0, smile=False, depth=2.2, glow="#c8a890", estr=0.3)
zr_match(cam, t0, t1, w["panel"], 0.48, u=0.5, v=0.44, angle="eye", lens=30, card=6)` },
  { cut: "close", what: "a blue curtain closing across a lit window", camera: "straight on the window", faces: "-",
    py: `R = rp_set(t0, t1, room=False)
w = zp_window((-28.0, 16.9, 3.2), 0.0, 3.2, 3.0, lit=True, curtain="#2a4a9a", glow="#9aa8d8", estr=0.3, surround="#dde2ea")
zp_curtain_close(w, ${at(0.15)}, t1)
zr_match(cam, t0, t1, w["panel"], 0.5, u=0.5, v=0.4, angle="eye", lens=30, card=7)` },
  { cut: "curtains,", what: "a pink-haired neighbor pulling her front door shut", camera: "from the yard, medium", faces: "neutral",
    py: `R = rp_set(t0, t1, room=False)\nd = zp_door((31.0, 17.8, 0.0), 0.0, "#5a3a2e")\nzp_door_open(d, t0 - 0.4, t0, -70)\nzp_door_open(d, ${at(0.2)}, t1, -70)\nd["hinge"].rotation_euler[2] = math.radians(-70)\nd["hinge"].keyframe_insert("rotation_euler", index=2, frame=F(${at(0.2)}))\nd["hinge"].rotation_euler[2] = math.radians(-10)\nd["hinge"].keyframe_insert("rotation_euler", index=2, frame=F(t1))\np = rp_person("pink", (32.4, 16.8, 0.0), 0.0, t0)\np.pose(t0, armR=(70, -10))\nzr_match(cam, t0, t1, p, 0.42, u=0.45, v=0.55, angle="eye", lens=30, card=8)` },
  { cut: "lock", what: "a dark front door, the gold lock turning", camera: "zr_object on the lock, close", faces: "-",
    py: `R = rp_set(t0, t1, room=False)\nd = zp_door((-60.0, 17.8, 0.0), 0.0, "#2a2226")\nzp_lock_turn(d, ${at(0.25)}, ${at(0.6)})\nzr_match(cam, t0, t1, d["root"], 0.9, u=0.52, v=0.5, angle="eye", side=-8, lens=30, card=9)` },
  { cut: "and", what: "a neighbor kid behind a lit window; the light goes off on 'off'", camera: "straight on, the house wall around", faces: "neutral",
    py: `R = rp_set(t0, t1, room=False)
w, n = rp_window_person("kidr", 31.0, t0, smile=False, glow="#c8a890", estr=0.35)
zp_light_off(w, ${"{{off}}"})
zr_match(cam, t0, t1, w["panel"], 0.34, u=0.5, v=0.45, angle="low", lens=30, card=10)` },
  { cut: "lights.", what: "the long dark street, lamps glowing, a car's tail lights far away", camera: "zr_street_long, low, push", faces: "-",
    py: `R = rp_set(t0, t1, room=False)\nzr_street_long(cam, t0, t1, frm=(40.0, -1.5, 3.4), to=(-120.0, 1.0, 3.2), lens=24)` },
  { cut: "Nobody", what: "the same street, darker, nobody", camera: "zr_street_long from the middle, slow", faces: "-",
    py: `R = rp_set(t0, t1, room=False)\nzr_street_long(cam, t0, t1, frm=(10.0, 0.0, 2.4), to=(-140.0, 0.0, 3.8), lens=26, push=0.04)` },
  { cut: "Ten", what: "DAY FLASHBACK: the kid and Noah by a red mailbox in a sunny front yard", camera: "wide from the street", faces: "happy",
    py: `R = rp_set(t0, t1, time="day", room=False)
n = rp_person("noah", (8.6, 13.4, 0.0), 0.0, t0, face="smile")
k = rp_person("kid", (5.4, 13.0, 0.0), 20.0, t0, face="smile")
mb = zp_mailbox((7.0, 11.2, 0.0), 0.0)
zr_match(cam, t0, t1, n, 0.26, u=0.6, v=0.62, angle="eye", side=-10, lens=30, maxd=20.0, card=13)   # on the street, not in the south yard (a bush filled the final)` },
  { cut: "best", what: "DAY FLASHBACK: Noah waving, smiling, medium", camera: "medium, front", faces: "Noah happy",
    py: `R = rp_set(t0, t1, time="day", room=False)
n = rp_person("noah", (8.6, 13.4, 0.0), 0.0, t0)
k = rp_person("kid", (5.6, 13.0, 0.0), 30.0, t0)
n.act(t0, "wave")
rp_face(n, t0, t1, "smile")
zr_match(cam, t0, t1, n, 0.62, u=0.58, v=0.6, angle="eye", side=6, lens=30, card=14)` },
  { cut: "after", what: "a figure (Noah) walking away down the dark street", camera: "behind him, low, still", faces: "-",
    py: `R = rp_set(t0, t1, room=False)
n = rp_person("noah", (2.0, 1.0, 0.0), -90.0, t0)
n.walk(t0, t1, (2.0, 1.0, 0.0), (-10.0, 1.0, 0.0))
zr_match(cam, t0, t1, n, 0.13, u=0.48, v=0.5, angle="eye", side=180, lens=30, push=0.0, card=15)` },
  { cut: "My", what: "the empty dark street", camera: "zr_street_long", faces: "-",
    py: `R = rp_set(t0, t1, room=False)\nzr_street_long(cam, t0, t1, frm=(-20.0, -2.0, 3.0), to=(-140.0, 2.0, 3.0), lens=26, push=0.05)` },
  { cut: "moved", what: "a red FOR SALE sign on a dark lawn", camera: "zr_object, low", faces: "-",
    py: `R = rp_set(t0, t1, room=False)
s = zp_sign((-40.0, 12.6, 0.0), 0.0, "FOR SALE")
zr_match(cam, t0, t1, s, 0.62, u=0.5, v=0.66, angle="eye", side=-8, lens=30, card=17)` },
  { cut: "But", what: "the kid lying in bed, seen from straight above", camera: "zr_top_down", faces: "kid neutral, eyes open",
    py: `R = rp_set(t0, t1)
k = rp_person("kid", (-2.2, -23.6, 2.05), 0.0, t0)
k.root.rotation_euler = (math.radians(-90), 0.0, math.radians(-90))
k.root.keyframe_insert("rotation_euler", frame=F(t0) - 5)
k.root.keyframe_insert("rotation_euler", frame=F(t0))
box("rp_blanket", (3.0, 3.6, 0.45), (-1.3, -23.6, 2.75), zw_m("blanket2", "#3d5fb8", 0.8), 0.15)
box("rp_pillow", (1.5, 2.6, 0.35), (3.1, -23.6, 1.9), zw_m("pillow", "#e8ecf6", 0.8), 0.15)
zw_novol(light("rp_bedlight", "AREA", (0.6, -23.6, 8.2), 160.0, (0.55, 0.66, 1.0), 4.0, target=(0.6, -23.6, 2.0), shadow=True))
zr_key(cam, t0, t1, (0.45, -23.6, 8.6), (0.65, -23.6, 2.0), (0.45, -23.6, 8.3), (0.65, -23.6, 2.0), lens=13)` },
  { cut: "I", what: "the kid walking to the window, seen from behind", camera: "behind him, eye level", faces: "-",
    py: `R = rp_set(t0, t1)
k = rp_person("kid", rp_room_pt(0.0, 4.4), RP_ROOM_ROT, t0)
zr_match(cam, t0, t1, k, 0.48, u=0.45, v=0.66, angle="eye", side=180, lens=20, push=0.0, maxd=8.5, card=19)
zw_walk_to(k, t0, t1, rp_room_pt(0.4, 2.4))` },
  { cut: "my", what: "the kid walking toward the window, seen from the window", camera: "from the window, into the room", faces: "kid neutral",
    py: `R = rp_set(t0, t1)
k = rp_person("kid", rp_room_pt(0.4, 3.8), RP_ROOM_ROT, t0)
zr_match(cam, t0, t1, k, 0.45, u=0.5, v=0.65, angle="eye", side=180, lens=20, push=0.0, maxd=9.0, card=20)
zw_walk_to(k, t0, t1, rp_room_pt(0.4, 2.4))` },
  { cut: "and", what: "over the kid's shoulder through the window: Noah tiny under the streetlight across the street", camera: "zr_over_shoulder through the window", faces: "-",
    py: `R = rp_set(t0, t1)\nk = rp_person("kid", rp_room_pt(0.6, 1.6), RP_ROOM_ROT, t0)\nn = rp_person("noah", RP_NOAH, 0.0, t0)\nzr_over_shoulder(cam, t0, t1, k, RP_LAMP, side=-1.0, lens=30, push=0.05, back=2.6, up=0.6)` },
  { cut: "was", what: "Noah standing under the streetlight, full body, the pool of light", camera: "across the street, medium-wide", faces: "Noah neutral",
    py: `R = rp_set(t0, t1, room=False)
n = rp_person("noah", RP_NOAH, 0.0, t0)
zr_match(cam, t0, t1, n, 0.21, u=0.45, v=0.56, angle="eye", lens=30, maxd=15.0, card=22)` },
  { cut: "Noah.", what: "the kid's shocked face at the window", camera: "zr_face", faces: "kid shocked",
    py: `R = rp_set(t0, t1)
k = rp_person("kid", rp_room_pt(1.25, 1.8), RP_FACE_WIN, t0, face="o")
zr_match(cam, t0, t1, k, 0.32, u=0.45, v=0.46, angle="eye", lens=30, part="head", card=23)` },
  { cut: "He", what: "Noah under the streetlight, medium, closer", camera: "medium front", faces: "Noah neutral",
    py: `R = rp_set(t0, t1, room=False)
n = rp_person("noah", RP_NOAH, 0.0, t0)
zr_match(cam, t0, t1, n, 0.47, u=0.48, v=0.58, angle="eye", lens=30, card=24)` },
  { cut: "the", what: "DAY FLASH: Noah waving in the sun (the same as then)", camera: "medium", faces: "Noah happy",
    py: `R = rp_set(t0, t1, time="day", room=False)
n = rp_person("noah", RP_NOAH, 0.0, t0, face="smile")
n.act(t0, "wave")
zr_match(cam, t0, t1, n, 0.5, u=0.5, v=0.58, angle="eye", lens=30, card=25)` },
  { cut: "the", what: "Noah under the streetlight again, medium", camera: "medium front, push", faces: "Noah neutral",
    py: `R = rp_set(t0, t1, room=False)
n = rp_person("noah", RP_NOAH, 0.0, t0)
zr_match(cam, t0, t1, n, 0.52, u=0.5, v=0.58, angle="eye", lens=30, push=0.05, card=26)` },
  { cut: "I", what: "the kid at the window, seen from outside through the window", camera: "zr_at_window", faces: "kid scared",
    py: `R = rp_set(t0, t1)
k = rp_person("kid", rp_room_pt(1.25, 3.4), RP_FACE_WIN, t0, face="scared")
zr_match(cam, t0, t1, k, 0.22, u=0.5, v=0.42, angle="eye", lens=30, part="upper", card=27)` },
  { cut: "He", what: "Noah's face close, looking straight at the camera", camera: "zr_face", faces: "Noah neutral",
    py: `R = rp_set(t0, t1, room=False)
n = rp_person("noah", RP_NOAH, 0.0, t0)
zr_match(cam, t0, t1, n, 0.26, u=0.5, v=0.47, angle="eye", lens=30, part="head", card=28)` },
  { cut: "slowly", what: "Noah full body under the streetlight, seen from the kid's window (zoomed)", camera: "from the window, long lens", faces: "Noah neutral",
    py: `R = rp_set(t0, t1)
n = rp_person("noah", RP_NOAH, 0.0, t0)
zr_match(cam, t0, t1, n, 0.17, u=0.5, v=0.63, angle="high", lens=30, card=29)` },
  { cut: "Your", what: "Noah close, mouthing 'Your mom lied' (NOAH tag)", camera: "zr_face", faces: "Noah neutral, lips moving",
    py: `R = rp_set(t0, t1, room=False)
n = rp_person("noah", RP_NOAH, 0.0, t0, face=None)
rp_face(n, t0, t1, "neutral", talk=True)
zr_match(cam, t0, t1, n, 0.35, u=0.47, v=0.43, angle="eye", lens=30, part="head", card=30)` },
  { cut: "Suddenly,", what: "the back of the kid's head; the bedroom door behind opens on 'open', Mom in the doorway", camera: "zr_door_behind", faces: "-",
    py: `R = rp_set(t0, t1)
k = rp_person("kid", rp_room_pt(-2.0, 4.6), RP_FACE_ROOM, t0)
m = rp_person("mom", rp_room_pt(2.0, 15.0), RP_FACE_WIN, t0, face="angry")
zp_door_open(R["door"], ${"{{open.}}"}, t1, -75)
zr_key(cam, t0, t1, rp_room_pt(-0.8, 0.7, 5.8), rp_room_pt(2.4, 14.0, 3.0), rp_room_pt(-0.8, 1.0, 5.8), rp_room_pt(2.4, 14.0, 3.0), lens=16)` },
  { cut: "My", what: "Mom standing inside the room behind the kid, seen over his shoulder", camera: "zr_over_shoulder toward Mom", faces: "Mom angry",
    py: `R = rp_set(t0, t1)
m = rp_person("mom", rp_room_pt(2.0, 12.4), RP_FACE_WIN, t0, face="angry")
R["door"]["hinge"].scale = (0.001, 0.001, 0.001)
zr_match(cam, t0, t1, m, 0.55, u=0.5, v=0.62, angle="eye", lens=30, part="upper", maxd=5.0, card=32)` },
  { cut: "I", what: "Mom's face close: 'I told you never to look outside' (MOM tag)", camera: "zr_face", faces: "Mom angry, talking",
    py: `R = rp_set(t0, t1)
m = rp_person("mom", rp_room_pt(1.6, 11.0), RP_FACE_WIN, t0, face=None)
R["door"]["hinge"].scale = (0.001, 0.001, 0.001)
rp_face(m, t0, t1, "angry", talk=True)
zr_match(cam, t0, t1, m, 0.35, u=0.5, v=0.45, angle="eye", lens=30, part="head", maxd=5.0, card=33)` },
  { cut: "I", what: "the kid turning back to the window, over his shoulder", camera: "zr_over_shoulder to the window", faces: "-",
    py: `R = rp_set(t0, t1)\nk = rp_person("kid", rp_room_pt(0.6, 1.8), RP_ROOM_ROT, t0)\nzr_over_shoulder(cam, t0, t1, k, RP_LAMP, side=1.0, lens=30, back=2.6, up=0.6)` },
  { cut: "Noah", what: "the empty streetlight (Noah gone)", camera: "across the street, still", faces: "-",
    py: `R = rp_set(t0, t1)
k = rp_person("kid", rp_room_pt(0.6, 1.8), RP_FACE_WIN, t0)
zr_over_shoulder(cam, t0, t1, k, RP_LAMP, side=1.0, lens=30, back=2.4, up=0.4)` },
  { cut: "but", what: "the kid's face, angry-scared", camera: "zr_face", faces: "kid angry",
    py: `R = rp_set(t0, t1)
k = rp_person("kid", rp_room_pt(1.25, 1.8), RP_FACE_WIN, t0, face="angry")
zr_match(cam, t0, t1, k, 0.48, u=0.45, v=0.45, angle="eye", lens=30, part="head", card=36)` },
  { cut: "terrifying.", what: "over the kid's shoulder through the window: the houses across, people in the windows", camera: "zr_through_window", faces: "-",
    py: `R = rp_set(t0, t1)\nk = rp_person("kid", rp_room_pt(0.6, 1.8), RP_ROOM_ROT, t0)\nfor x, key in ((-28.0, "girl"), (2.0, "curlers"), (31.0, "man")):\n    rp_window_person(key, x, t0)\nzr_over_shoulder(cam, t0, t1, k, (0.0, 17.0, 0.0), side=1.0, lens=26, back=2.6, up=0.8)` },
  { cut: "Every", what: "the pigtail girl smiling behind her window", camera: "straight on, close", faces: "girl happy",
    py: `R = rp_set(t0, t1, room=False)
w, n = rp_window_person("girl", -28.0, t0, mullion=False)
zr_match(cam, t0, t1, n, 0.24, u=0.5, v=0.47, angle="eye", lens=30, part="head", card=38)` },
  { cut: "neighbor", what: "a lady with curlers smiling behind her window", camera: "straight on, close", faces: "lady happy",
    py: `R = rp_set(t0, t1, room=False)
w, n = rp_window_person("curlers", 2.0, t0, mullion=False)
zr_match(cam, t0, t1, n, 0.24, u=0.5, v=0.45, angle="eye", lens=30, part="head", card=39)` },
  { cut: "behind", what: "a man smiling behind his window, the frame bar in front", camera: "straight on, close, a little to the side", faces: "man happy",
    py: `R = rp_set(t0, t1, room=False)
w, n = rp_window_person("man", 31.0, t0)
zr_match(cam, t0, t1, n, 0.26, u=0.45, v=0.47, angle="eye", side=6, lens=30, part="head", card=40)` },
  { cut: "and", what: "WIDE: the houses across the street, someone standing in every window, all looking at us", camera: "street level, wide, still", faces: "all happy",
    py: `R = rp_set(t0, t1, room=False)\nfor x, key in ((-58.0, "dark"), (-28.0, "girl"), (2.0, "curlers"), (31.0, "man"), (-31.0, "kidg"), (-1.0, "pink"), (28.0, "kidr")):\n    rp_window_person(key, x, t0, z=3.2 if int(x) % 2 == 0 else 8.2)\nzr_key(cam, t0, t1, (-2.0, -14.0, 3.2), (-2.0, 18.0, 6.5), (-2.0, -13.2, 3.2), (-2.0, 18.0, 6.5), lens=13)` },
  { cut: "house.", what: "the pigtail girl's smiling face, then the fade to black", camera: "close, push in", faces: "girl happy",
    py: `R = rp_set(t0, t1, room=False)
w, n = rp_window_person("girl", -28.0, t0, mullion=False)
zr_match(cam, t0, t1, n, 0.5, u=0.5, v=0.5, angle="eye", lens=30, part="head", push=0.05, card=42)` },
];

const norm = (w) => String(w).toLowerCase().replace(/[^a-z0-9:']/g, "");
/** the cards on the voice's words: each cut word found in order -> [{ k, w0, w1, t0, t1, card }]; {{word}} = that word's time inside the shot */
export function placeCards(words) {
  let j = 0;
  const out = [];
  for (const [k, c] of CARDS.entries()) {
    const n = norm(c.cut);
    let i = j;
    while (i < words.length && norm(words[i].word) !== n) i++;
    if (i >= words.length) throw new Error(`card ${k + 1}: cut word "${c.cut}" not found after word ${j}`);
    out.push({ k: k + 1, w0: i, card: c });
    j = i + 1;
  }
  for (let k = 0; k < out.length; k++) {
    out[k].w1 = k + 1 < out.length ? out[k + 1].w0 : null;
    out[k].t0 = k === 0 ? 0 : words[out[k].w0].start;
    out[k].t1 = out[k].w1 != null ? words[out[k].w1].start : words.at(-1).end + 0.25;
  }
  // {{word}}: the time of that word within this card (as t0 + u * (t1 - t0))
  for (const x of out) {
    x.py = "cam = Cam()\n" + x.card.py.replace(/\{\{([^}]+)\}\}/g, (_, w) => {
      const n = norm(w);
      let i = x.w0; while (i < (x.w1 ?? words.length) && norm(words[i].word) !== n) i++;
      const t = i < words.length ? words[i].start : x.t0 + 0.4 * (x.t1 - x.t0);
      return `(t0 + ${Math.max(0, Math.min(0.95, (t - x.t0) / Math.max(0.1, x.t1 - x.t0))).toFixed(3)} * (t1 - t0))`;
    });
  }
  return out;
}
