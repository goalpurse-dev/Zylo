# ===== IN THIS TOWN v2, OVERNIGHT BUILD 2: THE GIANTS + SMALL SCARES (scripts/blockyWorlds/v2/giants_v2.py) ==========
# Pasted after things_v2.py. Three building-sized entities, our own shapes, eerie and never gory:
#   stilt   - tall and thin: endless legs, a small hunched body, a long neck, an oval head with two glowing slits (~52 tall)
#   mound   - wide and heavy: a hill of a body with heavy knuckled arms, a row of small glowing eyes (~30 tall, ~30 wide)
#   folder  - many parts that unfold: a stack of hinged panels that opens like a folding screen, eyes between the panels (~44)
# Moves (state): stand, walk, turn_head, bend_down, peek_window, reach_down, cover_eyes, crouch_behind.
# Each giant has its own rim light + eye glow; a walk cracks the ground at its feet. ZGiant.head = the head's world point.
ZG_H = {"stilt": 52.0, "mound": 30.0, "folder": 44.0}
ZG_STATES = ["stand", "walk", "turn_head", "bend_down", "peek_window", "reach_down", "cover_eyes", "crouch_behind"]


def zg_m(nm, col, rough=0.7, emit=None, estr=0.0):
    return mat("zg_%s" % nm, zc_rgb(col), rough, emit=zc_rgb(emit) if emit else None, estr=estr)


class ZGiant:
    def __init__(self, name, kind, loc=(0, 0, 0), rot=0.0, state="stand", t0=0.0, t1=1.0, head_to=None):
        self.name, self.kind, self.state = name, kind, state if state in ZG_STATES else "stand"
        self.root = empty(name + "_root", tuple(loc), None, None, (0, 0, rot))
        self.head = None
        {"stilt": self._stilt, "mound": self._mound, "folder": self._folder}[kind](t0, t1)
        if head_to is not None and self.head is not None:      # peek into a window: the whole giant moved so its head is there
            bpy.context.view_layer.update()
            hp = self.head.matrix_world.translation
            d = Vector(head_to) - hp
            self.root.location = (self.root.location.x + d.x, self.root.location.y + d.y, self.root.location.z + min(0.0, d.z))
        if self.state == "walk":
            zg_cracks(name, Vector(loc), 4.0 if kind != "mound" else 7.0)

    def _eyes(self, n, at, parent, r=0.6, gap=1.2, slit=False, col="#FFF2A0"):
        if self.state == "cover_eyes":
            return
        for s in (-1, 1):
            sphere("%s_eye%d" % (n, s), r, (at[0] + s * gap, at[1], at[2]), zg_m("eye", col, 0.2, emit=col, estr=14.0), (1.4, 0.4, 0.45) if slit else (1, 0.5, 1), seg=12, parent=parent)

    def _stilt(self, t0, t1):
        n, R = self.name, self.root
        sk, dk = zg_m("stilt_skin", "#C9C4BA", 0.8), zg_m("stilt_dark", "#24222A", 0.9)
        st = self.state
        crouch = {"bend_down": 0.55, "peek_window": 0.5, "crouch_behind": 0.42, "reach_down": 0.78}.get(st, 1.0)
        legL = 30.0 * crouch
        for s in (-1, 1):       # the legs: two long thin segments, the knee bent out when crouching
            kx = s * (2.2 + (1.0 - crouch) * 6.0)
            stride = (3.5 if st == "walk" else 0.0) * s
            cyl("%s_shin%d" % (n, s), 0.55, legL / 2 + 1.0, (kx * 0.6, stride * 0.5, legL / 4), dk, 10, rot=(math.degrees(math.atan2(stride, legL / 2)), -s * (1.0 - crouch) * 35, 0), parent=R)
            cyl("%s_thigh%d" % (n, s), 0.7, legL / 2 + 1.0, (kx * 0.6, stride * 0.25, legL * 0.75), dk, 10, rot=(0, s * (1.0 - crouch) * 35, 0), parent=R)
            sphere("%s_knee%d" % (n, s), 0.9, (kx, stride * 0.4, legL / 2), dk, seg=10, parent=R)
        hip = legL + 0.5
        lean = {"bend_down": 55, "peek_window": 62, "reach_down": 48, "crouch_behind": 20, "turn_head": 5, "walk": 10}.get(st, 0)
        body = empty(n + "_body", (0, 0, hip), R)
        body.rotation_euler = (math.radians(-lean), 0, 0)
        cyl(n + "_torso", 1.6, 9.0, (0, 0, 4.5), sk, 12, r2=2.2, parent=body)
        neck = empty(n + "_neckj", (0, 0, 9.0), body)
        neck.rotation_euler = (math.radians(-lean * 0.4), 0, math.radians(60 if st == "turn_head" else 0))
        cyl(n + "_neck", 0.6, 7.0, (0, 0, 3.5), sk, 10, parent=neck)
        self.head = sphere(n + "_head", 2.6, (0, 0, 8.6), sk, (0.8, 0.75, 1.3), seg=20, parent=neck)
        self._eyes(n, (0, -1.85, 9.0), neck, 0.55, 0.9, slit=True)
        box(n + "_mouth", (1.4, 0.1, 0.1), (0, -2.0, 7.4), zg_m("line", "#1A1A1A", 0.9), 0.0, parent=neck)
        for s in (-1, 1):       # the arms: very long, three segments, the hands with long fingers
            sh = empty("%s_sh%d" % (n, s), (s * 2.2, 0, 8.2), body)
            a = {"reach_down": (-150, s * 10), "cover_eyes": (-160, -s * 28), "peek_window": (-120, s * 15), "bend_down": (-60, s * 8), "walk": (s * 20, 0)}.get(st, (8, s * 6))
            sh.rotation_euler = (math.radians(a[0]), math.radians(a[1]), 0)
            cyl("%s_arm%d" % (n, s), 0.45, 13.0, (0, 0, -6.5), sk, 8, parent=sh)
            el = empty("%s_el%d" % (n, s), (0, 0, -13.0), sh)
            el.rotation_euler = (math.radians(-50 if st == "cover_eyes" else -12), 0, 0)
            cyl("%s_fore%d" % (n, s), 0.38, 11.0, (0, 0, -5.5), sk, 8, parent=el)
            for f in range(4):
                cyl("%s_f%d_%d" % (n, s, f), 0.12, 3.0, ((f - 1.5) * 0.35, 0, -12.4), sk, 6, rot=((f - 1.5) * 6, 0, 0), parent=el)

    def _mound(self, t0, t1):
        n, R = self.name, self.root
        fur, dk = zg_m("mound_skin", "#5B5466", 0.95), zg_m("mound_dark", "#2E2A36", 0.95)
        st = self.state
        squash = {"crouch_behind": 0.62, "bend_down": 0.8, "reach_down": 0.85, "peek_window": 0.75}.get(st, 1.0)
        lean = {"bend_down": 25, "peek_window": 30, "reach_down": 20, "walk": 8}.get(st, 0)
        body = empty(n + "_body", (0, 0, 0), R)
        body.rotation_euler = (math.radians(-lean), 0, math.radians(30 if st == "turn_head" else 0))
        sphere(n + "_belly", 13.0, (0, 0, 13.0 * squash), fur, (1.15, 0.85, 0.95 * squash), seg=32, parent=body)
        for k in range(9):      # lumpy hide: a few bumps
            a = k * 0.7
            sphere("%s_lump%d" % (n, k), 3.0 + (k % 3), (13.0 * math.cos(a) * 0.9, 9.0 * math.sin(a) * 0.6 + 4, (14 + 6 * math.sin(k)) * squash), dk, seg=12, parent=body)
        self.head = sphere(n + "_brow", 5.5, (0, -7.5, 24.0 * squash), fur, (1.4, 0.8, 0.6), seg=20, parent=body)
        if st != "cover_eyes":
            for k in range(5):      # a row of small eyes under the brow
                x = (k - 2) * 2.0
                sphere("%s_eye%d" % (n, k), 0.55 + 0.15 * (k % 2), (x, -11.6, (22.2 - abs(k - 2) * 0.5) * squash), zg_m("eye", "#FFE36A", 0.2, emit="#FFE36A", estr=14.0), (1, 0.4, 1), seg=10, parent=body)
        for s in (-1, 1):       # heavy arms that hang to the ground (knuckles on the street)
            sh = empty("%s_sh%d" % (n, s), (s * 13.5, -2.0, 18.0 * squash), body)
            a = {"reach_down": -70, "cover_eyes": -150, "walk": -25 * s, "peek_window": -95}.get(st, -8)
            sh.rotation_euler = (math.radians(a), math.radians(-s * (35 if st == "cover_eyes" else 10)), 0)
            cyl("%s_arm%d" % (n, s), 2.6, 16.0, (0, 0, -8.0), fur, 12, r2=3.4, parent=sh)
            sphere("%s_fist%d" % (n, s), 4.0, (0, 0, -17.0), dk, (1, 1, 0.8), seg=14, parent=sh)
        for s in (-1, 1):
            cyl("%s_leg%d" % (n, s), 3.6, 6.0, (s * 6.5, 0, 3.0), dk, 12, parent=body)

    def _folder(self, t0, t1):
        n, R = self.name, self.root
        pm, dk = zg_m("fold_panel", "#D8D2C4", 0.6), zg_m("fold_dark", "#3A3846", 0.8)
        st = self.state
        unfold = {"stand": 0.85, "walk": 0.7, "turn_head": 0.85, "bend_down": 0.6, "peek_window": 0.5, "reach_down": 1.0, "cover_eyes": 0.15, "crouch_behind": 0.3}.get(st, 0.85)
        lean = {"bend_down": 40, "peek_window": 50, "reach_down": 35, "crouch_behind": 25, "walk": 8}.get(st, 0)
        for s in (-1, 1):       # three thin legs per side, like folding rulers
            for k in range(3):
                cyl("%s_leg%d_%d" % (n, s, k), 0.45, 18.0, (s * (2.0 + k * 1.4), (k - 1) * 1.6, 9.0), dk, 8, rot=((k - 1) * 8, s * 10, 0), parent=R)
        body = empty(n + "_body", (0, 0, 17.0), R)
        body.rotation_euler = (math.radians(-lean), 0, math.radians(35 if st == "turn_head" else 0))
        prev = body
        for k in range(7):      # a column of hinged panels: each one opens from the last (the unfolding)
            hj = empty("%s_hinge%d" % (n, k), (0, 0, 3.6 if k else 0.0), prev)
            hj.rotation_euler = (0, 0, math.radians((1 if k % 2 else -1) * 70 * unfold))
            box("%s_panel%d" % (n, k), (6.0 - k * 0.35, 0.5, 3.4), (3.0 - k * 0.17, 0, 1.7), pm, 0.08, parent=hj)
            box("%s_seam%d" % (n, k), (0.25, 0.6, 3.4), (0, 0, 1.7), dk, 0.0, parent=hj)
            if k in (2, 4) and st != "cover_eyes":       # eyes in the gaps between panels
                sphere("%s_geye%d" % (n, k), 0.5, (0.6, -0.5, 1.7), zg_m("eye", "#BFF4FF", 0.2, emit="#BFF4FF", estr=14.0), (1, 0.4, 1), seg=10, parent=hj)
            prev = hj
        self.head = box(n + "_crown", (4.0, 2.0, 3.0), (1.5, 0, 3.6 + 1.5), pm, 0.2, parent=prev)
        if st != "cover_eyes":
            self._eyes(n, (1.5, -1.05, 5.4), prev, 0.45, 0.8)
        for s in (-1, 1):       # two long folding arms
            sh = empty("%s_sh%d" % (n, s), (s * 3.2, 0, 3.0), body)
            a = {"reach_down": -150, "cover_eyes": -165, "peek_window": -110, "walk": s * 15}.get(st, 10)
            sh.rotation_euler = (math.radians(a), math.radians(s * 12), 0)
            for k in range(3):
                box("%s_arm%d_%d" % (n, s, k), (0.6, 0.6, 5.0), (0, 0, -2.5 - 5.0 * k), pm if k % 2 else dk, 0.05, parent=sh)


def zg_cracks(name, at, r):
    """the ground cracked at the giant's feet (dark jagged strips; nobody hurt)"""
    m = mat("zg_crack", (0.04, 0.035, 0.03), 0.9)
    for k in range(9):
        a = k * 0.7
        L = r * (0.6 + 0.5 * ((k * 37) % 10) / 10.0)
        box("%s_crack%d" % (name, k), (L, 0.25, 0.04), (at.x + math.cos(a) * L / 2, at.y + math.sin(a) * L / 2, at.z + 0.03), m, 0.0, rot=(0, 0, math.degrees(a)))


def zg_light(g, cam_loc, night):
    lo, hi = zv_name_bounds(g.name)
    zv_entity_light(lo, hi, Vector(cam_loc), night)


def zg_shake(cam, t0, t1, amp=0.25):
    """the camera shakes with the steps (a few small keyed jolts; a video shows it, a still is unchanged)"""
    try:
        ob = cam.ob
    except Exception:
        return
    rnd = random.Random(5)
    base = ob.location.copy()
    k = 0
    t = t0
    while t < t1:
        ob.location = (base.x + rnd.uniform(-amp, amp), base.y + rnd.uniform(-amp, amp), base.z + rnd.uniform(-amp, amp))
        key(ob, "location", F(t))
        t += 0.12
        k += 1


# ---------------------------------------------------------------- SMALL SCARES (eerie, never gory)
def zv_scare(kind, at, face_to, t0, t1):
    """under_bed: two eyes in the dark gap under a bed; closet: eyes in the gap of a closet door; door_hand: a long pale hand round a door edge"""
    at = Vector(at)
    em = mat("zs_scareeye", zc_rgb("#FFF4B0"), 0.2, emit=zc_rgb("#FFEE88"), estr=16.0)
    if kind in ("under_bed", "closet"):
        dx = 0.32 if kind == "under_bed" else 0.22
        for s in (-1, 1):
            sphere("zs_scare_eye%d" % s, 0.11 if kind == "under_bed" else 0.09, (at.x + s * dx, at.y, at.z), em, (1.3, 0.4, 0.8), seg=10)
        box("zs_scare_dark", (1.6 if kind == "under_bed" else 0.5, 0.05, 0.6 if kind == "under_bed" else 1.6), (at.x, at.y + 0.3, at.z), mat("zs_black", (0.0, 0.0, 0.0), 1.0), 0.0)
        light("zs_scare_glow", "POINT", (at.x, at.y - 0.4, at.z), 8, (1.0, 0.92, 0.6), 0.2)
    else:
        sk = mat("zs_scarehand", zc_rgb("#D9D2C6"), 0.7)
        for f in range(4):      # four long fingers curling round the door edge, the palm hidden
            z = at.z + (f - 1.5) * 0.18
            box("zs_scare_f%d" % f, (0.65 + 0.08 * (f % 2), 0.1, 0.1), (at.x - 0.25, at.y - 0.06, z), sk, 0.04)
            box("zs_scare_t%d" % f, (0.1, 0.16, 0.1), (at.x - 0.58, at.y - 0.1, z), sk, 0.03)
