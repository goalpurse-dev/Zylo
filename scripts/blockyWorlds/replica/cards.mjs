// THE REPLICA CARDS (owner 2026-11-22, INTERNAL TEST ONLY: never posted, never a template, never shown to customers).
// One card per shot of the reference, written by hand from its frames (4 a second, the shot cuts from ffmpeg): what is
// in frame, where everyone stands, the camera (a named SHOT RECIPE from worlds/pieces.py) and its move, the faces, the
// start and end frame, and the word it cuts on. The bodies use only the library (worlds.py + acts.py + pieces.py).
// The look: blue moonlit night (a cool sun added), a vignette + the fade in the finish (ffmpeg), the flashback in day.

// the set every night shot shares: the suburb street at night, the kid's bedroom (a real window to the street, the
// door in its back wall), Noah's streetlight across the street (x -10), a cool moonlight
export const PREAMBLE = `
RP_ROOM_LOC, RP_ROOM_ROT = (-3.0, -18.0, 0.0), 180.0
RP_LAMP = (-10.0, 9.6, 0.0)
RP_LOOKS = {
    "kid": dict(skin="#f1dfc6", shirt="#d8352a", pants="#2a3f8a", hair="spiky", hair_color="#3a2418", face="kid"),
    "noah": dict(skin="#f1dfc6", shirt="#3a5fd8", pants="#222428", hair="messy", hair_color="#f2c14e", face="kid"),
    "mom": dict(skin="#f1dfc6", shirt="#2ab3a8", pants="#3a3a4a", hair="bun", hair_color="#e2581f", face="girl", kid=False),
    "girl": dict(skin="#f5d6b8", shirt="#3ec7d6", pants="#5a4a9a", hair="bob", hair_color="#1a1a22", face="girl"),
    "curlers": dict(skin="#f2e14e", shirt="#e0803a", pants="#4a3a2a", hair="bun", hair_color="#7a3ad6", face="girl", kid=False),
    "man": dict(skin="#e0c070", shirt="#e8c02a", pants="#3a3a4a", hair="messy", hair_color="#2a1d16", face="plain", kid=False),
    "dark": dict(skin="#d9b48f", shirt="#2f3f7a", pants="#2b2b2b", hair="short", hair_color="#151212", face="plain", kid=False),
    "pink": dict(skin="#f1dfc6", shirt="#d8d8e8", pants="#5a5a7a", hair="bun", hair_color="#f07ab8", face="girl", kid=False),
    "kidg": dict(skin="#f2e14e", shirt="#2fae5a", pants="#2a3f8a", hair="short", hair_color="#2a1d16", face="kid"),
    "kidr": dict(skin="#a8714a", shirt="#d8352a", pants="#2b2b2b", hair="short", hair_color="#151212", face="kid"),
}


def rp_person(key, loc, rot, t0, name=None):
    lk = dict(RP_LOOKS[key])
    if key == "noah":
        ch = chars.Char(name or "Noah", skin=lk["skin"], shirt=lk["shirt"], pants=lk["pants"], hair="messy", hair_color=lk["hair_color"], face="kid", shirt_kind="checker", shirt_c2="#1a2a6a")
        ch.pose(t0, loc=tuple(loc), rot=rot)
        return ch
    return zw_person(name or key.title(), lk, loc, rot, t0)


def rp_room_pt(x, y, z=0.0):
    return tuple(zp_l2w(RP_ROOM_LOC, RP_ROOM_ROT, (x, y, z)))


def rp_set(t0, t1, time="night", room=True, people=0):
    ZW_INFO = zw_build("suburb_street", t0, t1, dict(time=time, people=people))
    if time == "night":
        # the reference's blue moonlit night: a cool moon that lights faces and house fronts (on top of the library night)
        zw_novol(light("rp_moon", "SUN", (0, 0, 50), 0.42, (0.45, 0.56, 1.0), 2, rot=(48, 0, 160), shadow=True))
        zp_streetpool(RP_LAMP, 5200.0)
    R = zp_room(RP_ROOM_LOC, RP_ROOM_ROT, 12.0, 10.0, 9.0, 5.0, 4.0) if room else None
    if R:
        zp_bed(rp_room_pt(-3.4, 5.6), RP_ROOM_ROT + 90, "#3d5fb8")
        box("rp_dresser", (2.6, 1.6, 2.2), rp_room_pt(4.2, 8.6, 1.1), zw_m("dresser", "#8a6040", 0.7), 0.06)
    return R


def rp_window_person(key, x, t0, smile=True, lit=True, curtain=None, z=3.2):
    """a neighbor behind a window on the north houses' fronts (the street side)"""
    w = zp_window((x, 16.9, z), 0.0, 3.2, 3.0, lit=lit, curtain=curtain)
    ch = rp_person(key, (x, 17.5, 0), 0.0, t0, name="N_%s_%d" % (key, int(x * 10)))
    zp_behind_window(ch, w, 0.6)
    zw_emote(ch, t0, t0 + 5, "happy" if smile else "neutral")
    return w, ch
`;

const at = (u) => `(t0 + ${u} * (t1 - t0))`;
// every card: cut = the first word of the shot (matched in order on the voice's words), the card data, the shot code
export const CARDS = [
  { cut: "In", what: "aerial wide over the night street: houses both sides, lamps, a car", camera: "zr_aerial high, slow push", faces: "-",
    py: `R = rp_set(t0, t1, room=False)\nzr_aerial(cam, t0, t1, over=(-30, 2, 0), height=44.0, back=40.0, lens=28, push=0.08, yaw=40)` },
  { cut: "nobody", what: "lower aerial along the street, a lamp near the lens", camera: "zr_aerial lower, push", faces: "-",
    py: `R = rp_set(t0, t1, room=False)\nzr_aerial(cam, t0, t1, over=(-10, 6, 0), height=24.0, back=30.0, lens=26, push=0.1, yaw=-28)` },
  { cut: "after", what: "the red digital clock 9:58 on the kid's dresser, the room dark", camera: "zr_object (object close-up), side", faces: "-",
    py: `R = rp_set(t0, t1)\nclk = zp_clock(rp_room_pt(4.2, 8.6, 2.2), RP_ROOM_ROT, 0.55)\nzr_object(cam, t0, t1, clk, dist=2.6, lens=32, side=-28)` },
  { cut: "Every", what: "two kids walking on the sidewalk toward the camera at night", camera: "low, ahead of them, still", faces: "kids neutral",
    py: `R = rp_set(t0, t1, room=False)\na = rp_person("kidg", (21.0, 8.4, 0.2), 90, t0)\nb = rp_person("kidr", (22.5, 7.4, 0.2), 90, t0)\na.walk(t0, t1, (21.0, 8.4, 0.2), (17.0, 8.4, 0.2))\nb.walk(t0, t1, (22.5, 7.4, 0.2), (18.5, 7.4, 0.2))\nzr_key(cam, t0, t1, (6.0, 6.6, 3.4), (19.0, 8.0, 3.0), lens=32)` },
  { cut: "at", what: "the clock close: 9:58 turns to 9:59 on '9:59'", camera: "zr_object straight on, push", faces: "-",
    py: `R = rp_set(t0, t1)\nclk = zp_clock(rp_room_pt(4.2, 8.6, 2.2), RP_ROOM_ROT, 0.55, t_change=${"{{9:59}}"})\nzr_object(cam, t0, t1, clk, dist=2.3, lens=36, side=0, push=0.1)` },
  { cut: "all", what: "a dark-haired neighbor behind a lit window", camera: "straight on the window from the street", faces: "neutral",
    py: `R = rp_set(t0, t1, room=False)\nw, n = rp_window_person("dark", 2.0, t0, smile=False)\nzr_key(cam, t0, t1, (2.0, 7.4, 5.0), (2.0, 16.9, 4.8), (2.0, 8.0, 5.0), (2.0, 16.9, 4.8), lens=30)` },
  { cut: "close", what: "a blue curtain closing across a lit window", camera: "straight on the window", faces: "-",
    py: `R = rp_set(t0, t1, room=False)\nw = zp_window((-28.0, 16.9, 3.2), 0.0, 3.2, 3.0, lit=True, curtain="#2a4a9a")\nzp_curtain_close(w, ${at(0.15)}, t1)\nzr_key(cam, t0, t1, (-28.0, 8.6, 4.8), (-28.0, 16.9, 4.7), lens=32)` },
  { cut: "curtains,", what: "a pink-haired neighbor pulling her front door shut", camera: "from the yard, medium", faces: "neutral",
    py: `R = rp_set(t0, t1, room=False)\nd = zp_door((31.0, 17.8, 0.0), 0.0, "#5a3a2e")\nzp_door_open(d, t0 - 0.4, t0, -70)\nzp_door_open(d, ${at(0.2)}, t1, -70)\nd["hinge"].rotation_euler[2] = math.radians(-70)\nd["hinge"].keyframe_insert("rotation_euler", index=2, frame=F(${at(0.2)}))\nd["hinge"].rotation_euler[2] = math.radians(-10)\nd["hinge"].keyframe_insert("rotation_euler", index=2, frame=F(t1))\np = rp_person("pink", (32.4, 16.8, 0.0), 0.0, t0)\np.pose(t0, armR=(70, -10))\nzr_key(cam, t0, t1, (29.6, 6.6, 4.0), (31.0, 17.8, 3.4), lens=30)` },
  { cut: "lock", what: "a dark front door, the gold lock turning", camera: "zr_object on the lock, close", faces: "-",
    py: `R = rp_set(t0, t1, room=False)\nd = zp_door((-60.0, 17.8, 0.0), 0.0, "#2a2226")\nzp_lock_turn(d, ${at(0.25)}, ${at(0.6)})\nzr_object(cam, t0, t1, d["lock"], dist=3.0, lens=36, side=-12, push=0.06)` },
  { cut: "and", what: "a neighbor kid behind a lit window; the light goes off on 'off'", camera: "straight on, the house wall around", faces: "neutral",
    py: `R = rp_set(t0, t1, room=False)\nw, n = rp_window_person("kidr", 31.0, t0, smile=False)\nzp_light_off(w, ${"{{off}}"})\nzr_key(cam, t0, t1, (31.0, 7.0, 5.0), (31.0, 16.9, 4.8), (31.0, 7.6, 5.0), (31.0, 16.9, 4.8), lens=30)` },
  { cut: "lights.", what: "the long dark street, lamps glowing, a car's tail lights far away", camera: "zr_street_long, low, push", faces: "-",
    py: `R = rp_set(t0, t1, room=False)\nzr_street_long(cam, t0, t1, frm=(40.0, -1.5, 3.4), to=(-120.0, 1.0, 3.2), lens=24)` },
  { cut: "Nobody", what: "the same street, darker, nobody", camera: "zr_street_long from the middle, slow", faces: "-",
    py: `R = rp_set(t0, t1, room=False)\nzr_street_long(cam, t0, t1, frm=(10.0, 0.0, 2.4), to=(-140.0, 0.0, 3.8), lens=26, push=0.04)` },
  { cut: "Ten", what: "DAY FLASHBACK: the kid and Noah by a red mailbox in a sunny front yard", camera: "wide from the street", faces: "happy",
    py: `R = rp_set(t0, t1, time="day", room=False)\nmb = zp_mailbox((6.6, 12.4, 0.0), 0.0)\nk = rp_person("kid", (4.6, 13.2, 0.0), 0.0, t0)\nn = rp_person("noah", (8.6, 13.4, 0.0), 0.0, t0)\nzw_emote(k, t0, t1, "happy")\nzw_emote(n, t0, t1, "happy")\nzr_key(cam, t0, t1, (2.0, 2.0, 4.6), (6.6, 13.0, 3.2), (2.4, 3.0, 4.6), (6.6, 13.0, 3.2), lens=28)` },
  { cut: "best", what: "DAY FLASHBACK: Noah waving, smiling, medium", camera: "medium, front", faces: "Noah happy",
    py: `R = rp_set(t0, t1, time="day", room=False)\nn = rp_person("noah", (8.6, 13.4, 0.0), 0.0, t0)\nk = rp_person("kid", (5.6, 13.0, 0.0), 30.0, t0)\nn.act(t0, "wave")\nzw_emote(n, t0, t1, "happy")\nzw_shot(cam, "medium", t0, t1, people=[n], things=[], yaw=10)` },
  { cut: "after", what: "a figure (Noah) walking away down the dark street", camera: "behind him, low, still", faces: "-",
    py: `R = rp_set(t0, t1, room=False)\nn = rp_person("noah", (2.0, 1.0, 0.0), -90.0, t0)\nn.walk(t0, t1, (2.0, 1.0, 0.0), (-10.0, 1.0, 0.0))\nzr_key(cam, t0, t1, (10.0, 0.4, 3.2), (-30.0, 1.0, 3.0), lens=30)` },
  { cut: "My", what: "the empty dark street", camera: "zr_street_long", faces: "-",
    py: `R = rp_set(t0, t1, room=False)\nzr_street_long(cam, t0, t1, frm=(-20.0, -2.0, 3.0), to=(-140.0, 2.0, 3.0), lens=26, push=0.05)` },
  { cut: "moved", what: "a red FOR SALE sign on a dark lawn", camera: "zr_object, low", faces: "-",
    py: `R = rp_set(t0, t1, room=False)\ns = zp_sign((-40.0, 12.6, 0.0), 0.0, "FOR SALE")\nzr_object(cam, t0, t1, s, dist=7.0, lens=30, side=-10, up=-1.0)` },
  { cut: "But", what: "the kid lying in bed, seen from straight above", camera: "zr_top_down", faces: "kid neutral, eyes open",
    py: `R = rp_set(t0, t1)\nk = rp_person("kid", rp_room_pt(-3.4, 6.6, 1.55), RP_ROOM_ROT + 90, t0)\nzw_fall(k, t0 - 0.6, back=True)\nzr_top_down(cam, t0, t1, k, height=4.4, lens=16)` },
  { cut: "I", what: "the kid walking to the window, seen from behind", camera: "behind him, eye level", faces: "-",
    py: `R = rp_set(t0, t1)\nk = rp_person("kid", rp_room_pt(0.0, 6.0), RP_ROOM_ROT, t0)\nzw_walk_to(k, t0, t1, rp_room_pt(0.4, 2.4))\nzr_key(cam, t0, t1, rp_room_pt(1.2, 9.2, 4.8), rp_room_pt(0.0, 0.0, 4.2), lens=26)` },
  { cut: "my", what: "the kid walking toward the window, seen from the window", camera: "from the window, into the room", faces: "kid neutral",
    py: `R = rp_set(t0, t1)\nk = rp_person("kid", rp_room_pt(0.4, 6.4), RP_ROOM_ROT + 180, t0)\nzw_walk_to(k, t0, t1, rp_room_pt(0.4, 2.6))\nzr_key(cam, t0, t1, rp_room_pt(-0.8, 0.8, 5.2), rp_room_pt(0.4, 6.0, 3.6), lens=20)` },
  { cut: "and", what: "over the kid's shoulder through the window: Noah tiny under the streetlight across the street", camera: "zr_over_shoulder through the window", faces: "-",
    py: `R = rp_set(t0, t1)\nk = rp_person("kid", rp_room_pt(0.6, 1.6), RP_ROOM_ROT, t0)\nn = rp_person("noah", RP_LAMP, 0.0, t0)\nzr_over_shoulder(cam, t0, t1, k, RP_LAMP, side=-1.0, lens=30, push=0.05, back=2.6, up=0.6)` },
  { cut: "was", what: "Noah standing under the streetlight, full body, the pool of light", camera: "across the street, medium-wide", faces: "Noah neutral",
    py: `R = rp_set(t0, t1, room=False)\nn = rp_person("noah", RP_LAMP, 0.0, t0)\nzw_emote(n, t0, t1, "neutral")\nzr_key(cam, t0, t1, (-11.0, -7.0, 3.2), (-10.0, 9.6, 3.4), (-11.0, -5.8, 3.2), (-10.0, 9.6, 3.4), lens=30)` },
  { cut: "Noah.", what: "the kid's shocked face at the window", camera: "zr_face", faces: "kid shocked",
    py: `R = rp_set(t0, t1)\nk = rp_person("kid", rp_room_pt(0.6, 1.8), RP_ROOM_ROT, t0)\nzw_emote(k, t0, t1, "shocked")\nzr_face(cam, t0, t1, k)` },
  { cut: "He", what: "Noah under the streetlight, medium, closer", camera: "medium front", faces: "Noah neutral",
    py: `R = rp_set(t0, t1, room=False)\nn = rp_person("noah", RP_LAMP, 0.0, t0)\nzw_emote(n, t0, t1, "neutral")\nzr_key(cam, t0, t1, (-10.4, 1.8, 3.8), (-10.0, 9.6, 3.0), (-10.4, 2.8, 3.8), (-10.0, 9.6, 3.0), lens=34)` },
  { cut: "the", what: "DAY FLASH: Noah waving in the sun (the same as then)", camera: "medium", faces: "Noah happy",
    py: `R = rp_set(t0, t1, time="day", room=False)\nn = rp_person("noah", RP_LAMP, 0.0, t0)\nn.act(t0, "wave")\nzw_emote(n, t0, t1, "happy")\nzw_shot(cam, "medium", t0, t1, people=[n], things=[], yaw=-8)` },
  { cut: "the", what: "Noah under the streetlight again, medium", camera: "medium front, push", faces: "Noah neutral",
    py: `R = rp_set(t0, t1, room=False)\nn = rp_person("noah", RP_LAMP, 0.0, t0)\nzw_emote(n, t0, t1, "neutral")\nzr_key(cam, t0, t1, (-10.4, 1.8, 3.8), (-10.0, 9.6, 3.0), (-10.4, 2.8, 3.8), (-10.0, 9.6, 3.0), lens=34)` },
  { cut: "I", what: "the kid at the window, seen from outside through the window", camera: "zr_at_window", faces: "kid scared",
    py: `R = rp_set(t0, t1)\nk = rp_person("kid", rp_room_pt(0.6, 2.4), RP_ROOM_ROT, t0)\nzw_walk_to(k, t0, t1, rp_room_pt(0.6, 1.4))\nzw_emote(k, t0, t1, "scared")\nzr_at_window(cam, t0, t1, R, k, dist=8.0, lens=32)` },
  { cut: "He", what: "Noah's face close, looking straight at the camera", camera: "zr_face", faces: "Noah neutral",
    py: `R = rp_set(t0, t1, room=False)\nn = rp_person("noah", RP_LAMP, 0.0, t0)\nzw_emote(n, t0, t1, "neutral")\nzr_face(cam, t0, t1, n)` },
  { cut: "slowly", what: "Noah full body under the streetlight, seen from the kid's window (zoomed)", camera: "from the window, long lens", faces: "Noah neutral",
    py: `R = rp_set(t0, t1)\nn = rp_person("noah", RP_LAMP, 0.0, t0)\nzw_emote(n, t0, t1, "neutral")\nzr_key(cam, t0, t1, rp_room_pt(0.4, 0.6, 5.0), (-10.0, 9.6, 3.0), lens=52)` },
  { cut: "Your", what: "Noah close, mouthing 'Your mom lied' (NOAH tag)", camera: "zr_face", faces: "Noah neutral, lips moving",
    py: `R = rp_set(t0, t1, room=False)\nn = rp_person("noah", RP_LAMP, 0.0, t0)\nzw_emote(n, t0, t1, "neutral", talk=True)\nzr_face(cam, t0, t1, n, push=0.08)` },
  { cut: "Suddenly,", what: "the back of the kid's head; the bedroom door behind opens on 'open', Mom in the doorway", camera: "zr_door_behind", faces: "-",
    py: `R = rp_set(t0, t1)\nk = rp_person("kid", rp_room_pt(0.6, 1.6), RP_ROOM_ROT, t0)\nm = rp_person("mom", rp_room_pt(2.0, 11.2), RP_ROOM_ROT, t0)\nzp_door_open(R["door"], ${"{{open.}}"}, t1, 75)\nzr_door_behind(cam, t0, t1, k, R["door"], lens=28)` },
  { cut: "My", what: "Mom standing inside the room behind the kid, seen over his shoulder", camera: "zr_over_shoulder toward Mom", faces: "Mom angry",
    py: `R = rp_set(t0, t1)\nk = rp_person("kid", rp_room_pt(0.6, 1.8), RP_ROOM_ROT + 180, t0)\nm = rp_person("mom", rp_room_pt(1.6, 7.6), RP_ROOM_ROT, t0)\nzp_door_open(R["door"], t0 - 1.0, t0 - 0.5, 75)\nzw_emote(m, t0, t1, "angry")\nzr_over_shoulder(cam, t0, t1, k, m, side=1.0, lens=30, back=2.4, up=0.4)` },
  { cut: "I", what: "Mom's face close: 'I told you never to look outside' (MOM tag)", camera: "zr_face", faces: "Mom angry, talking",
    py: `R = rp_set(t0, t1)\nm = rp_person("mom", rp_room_pt(1.6, 7.6), RP_ROOM_ROT, t0)\nzp_door_open(R["door"], t0 - 1.0, t0 - 0.5, 75)\nzw_emote(m, t0, t1, "angry", talk=True)\nzr_face(cam, t0, t1, m)` },
  { cut: "I", what: "the kid turning back to the window, over his shoulder", camera: "zr_over_shoulder to the window", faces: "-",
    py: `R = rp_set(t0, t1)\nk = rp_person("kid", rp_room_pt(0.6, 1.8), RP_ROOM_ROT, t0)\nzr_over_shoulder(cam, t0, t1, k, RP_LAMP, side=1.0, lens=30, back=2.6, up=0.6)` },
  { cut: "Noah", what: "the empty streetlight (Noah gone)", camera: "across the street, still", faces: "-",
    py: `R = rp_set(t0, t1, room=False)\nzr_key(cam, t0, t1, (-10.8, -5.4, 3.6), (-10.0, 9.6, 3.4), (-10.8, -4.8, 3.6), (-10.0, 9.6, 3.4), lens=30)` },
  { cut: "but", what: "the kid's face, angry-scared", camera: "zr_face", faces: "kid angry",
    py: `R = rp_set(t0, t1)\nk = rp_person("kid", rp_room_pt(0.6, 1.8), RP_ROOM_ROT, t0)\nzw_emote(k, t0, t1, "angry")\nzr_face(cam, t0, t1, k)` },
  { cut: "terrifying.", what: "over the kid's shoulder through the window: the houses across, people in the windows", camera: "zr_through_window", faces: "-",
    py: `R = rp_set(t0, t1)\nk = rp_person("kid", rp_room_pt(0.6, 1.8), RP_ROOM_ROT, t0)\nfor x, key in ((-28.0, "girl"), (2.0, "curlers"), (31.0, "man")):\n    rp_window_person(key, x, t0)\nzr_over_shoulder(cam, t0, t1, k, (0.0, 17.0, 0.0), side=1.0, lens=26, back=2.6, up=0.8)` },
  { cut: "Every", what: "the pigtail girl smiling behind her window", camera: "straight on, close", faces: "girl happy",
    py: `R = rp_set(t0, t1, room=False)\nw, n = rp_window_person("girl", -28.0, t0)\nzr_key(cam, t0, t1, (-28.0, 9.8, 5.4), (-28.0, 16.9, 5.0), (-28.0, 10.4, 5.4), (-28.0, 16.9, 5.0), lens=34)` },
  { cut: "neighbor", what: "a lady with curlers smiling behind her window", camera: "straight on, close", faces: "lady happy",
    py: `R = rp_set(t0, t1, room=False)\nw, n = rp_window_person("curlers", 2.0, t0)\nzr_key(cam, t0, t1, (2.0, 9.8, 5.6), (2.0, 16.9, 5.2), (2.0, 10.4, 5.6), (2.0, 16.9, 5.2), lens=34)` },
  { cut: "behind", what: "a man smiling behind his window, the frame bar in front", camera: "straight on, close, a little to the side", faces: "man happy",
    py: `R = rp_set(t0, t1, room=False)\nw, n = rp_window_person("man", 31.0, t0)\nzr_key(cam, t0, t1, (30.0, 10.0, 5.6), (31.0, 16.9, 5.2), (30.2, 10.6, 5.6), (31.0, 16.9, 5.2), lens=34)` },
  { cut: "and", what: "WIDE: the houses across the street, someone standing in every window, all looking at us", camera: "street level, wide, still", faces: "all happy",
    py: `R = rp_set(t0, t1, room=False)\nfor x, key in ((-58.0, "dark"), (-28.0, "girl"), (2.0, "curlers"), (31.0, "man"), (-31.0, "kidg"), (-1.0, "pink"), (28.0, "kidr")):\n    rp_window_person(key, x, t0, z=3.2 if int(x) % 2 == 0 else 8.2)\nzr_key(cam, t0, t1, (-2.0, -14.0, 3.2), (-2.0, 18.0, 6.5), (-2.0, -13.2, 3.2), (-2.0, 18.0, 6.5), lens=13)` },
  { cut: "house.", what: "the pigtail girl's smiling face, then the fade to black", camera: "close, push in", faces: "girl happy",
    py: `R = rp_set(t0, t1, room=False)\nw, n = rp_window_person("girl", -28.0, t0)\nzr_key(cam, t0, t1, (-28.0, 11.6, 5.4), (-28.0, 16.9, 5.0), (-28.0, 12.6, 5.4), (-28.0, 16.9, 5.0), lens=36)` },
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
