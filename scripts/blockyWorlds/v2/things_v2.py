# ===== IN THIS TOWN v2, NIGHT BUILD: PEOPLE PIECES, ANIMALS, ENTITIES, PROPS, EFFECTS (scripts/blockyWorlds/v2/things_v2.py)
# Pasted after set_v2.py. All our own designs, built from simple shapes; kid-safe (eerie, never gory). World units: a
# kid is 3.04 tall. Every entity has 6 states and 3 show modes (full / silhouette / eyes) so a shot can use any of them.
ZV_ENT_STATES = ["stand", "walk", "reach", "peek", "loom", "eyes"]
ZV_ENT_SCALE = {"crawler": 2.2, "watcher": 1.25, "rain_thing": 1.3, "hollow": 1.9, "many_arms": 1.5}
ZV_SHOW = {"mode": "full"}


def zv_m(name, col, rough=0.6, metal=0.0, emit=None, estr=0.0, alpha=1.0):
    """an entity material; in silhouette / eyes mode every non-glowing part is pure black"""
    if ZV_SHOW["mode"] in ("silhouette", "eyes") and emit is None:
        return mat("zt_black", (0.0, 0.0, 0.0), 1.0, spec=0.0) if True else None
    return mat("zt_%s_%s" % (name, ZV_SHOW["mode"]), zc_rgb(col) if isinstance(col, str) else col, rough, metal=metal, emit=(zc_rgb(emit) if isinstance(emit, str) else emit) if emit else None, estr=estr, alpha=alpha)


def zv_part(fn, name, *a, parent=None, **k):
    return fn(name, *a, parent=parent, **k)


# ---------------------------------------------------------------- ROLE PIECES ON THE BASE CHARACTER (one piece each)
def zv_wear(ch, kinds):
    """role pieces on a ZChar: police_cap, chef_hat, driver_cap, glasses, apron, stethoscope, bonnet, bow_tie"""
    n, H = ch.name, ch.head
    hs = ch.spec["body"]["head"]
    hw, hd, hh = ch.hdim
    top = hh / 2
    P = ch.spec["body"]
    for kind in kinds or []:
        if kind in ("police_cap", "driver_cap"):
            col = "#1E2A4A" if kind == "police_cap" else "#2E6FD8"
            m = zc_mat(n, kind, col, rough=0.5)
            cyl(n + "_capc", 0.98 * hw / 1.9 * 1.0, 0.55 * hs, (0, 0.05 * hs, top + 0.2 * hs), m, 28, parent=H)
            cyl(n + "_capt", 1.08 * hw / 1.9, 0.12 * hs, (0, 0.05 * hs, top + 0.5 * hs), m, 28, parent=H)
            box(n + "_visor", (hw * 0.75, 0.55 * hs, 0.06 * hs), (0, -hd / 2 - 0.12 * hs, top + 0.02 * hs), zc_mat(n, "visor", "#121418", rough=0.3), 0.02, rot=(-12, 0, 0), parent=H)
            if kind == "police_cap":
                sphere(n + "_capbadge", 0.13 * hs, (0, -hd / 2 + 0.02, top + 0.32 * hs), zc_mat(n, "capbadge", "#E8C43C", rough=0.3, spec=0.8), (1, 0.4, 1.2), parent=H, seg=10)
        elif kind == "chef_hat":
            m = zc_mat(n, "chef", "#FFFFFF", rough=0.8)
            cyl(n + "_chefb", 0.62 * hw / 1.9 * 1.55, 0.5 * hs, (0, 0.05 * hs, top + 0.22 * hs), m, 28, parent=H)
            sphere(n + "_chefp", 1.05 * hw / 1.9 * 1.0, (0, 0.05 * hs, top + 0.95 * hs), m, (1.0, 1.0, 0.8), parent=H, seg=18)
        elif kind == "bonnet":
            sphere(n + "_bonnet", hw * 0.62, (0, 0.12 * hs, top - 0.05 * hs), zc_mat(n, "bonnet", "#F6C7D8", rough=0.8), (1.0, 1.05, 0.95), parent=H, seg=16)
        elif kind == "glasses":
            gm = zc_mat(n, "glasses", "#1A1A1E", rough=0.3)
            for s in (-1, 1):
                cyl(n + "_gl%d" % s, 0.3 * hs, 0.05 * hs, (s * hw * 0.24, -hd / 2 - 0.07 * hs, 0.08 * hs), gm, 20, rot=(90, 0, 0), parent=H)
                cyl(n + "_gli%d" % s, 0.24 * hs, 0.06 * hs, (s * hw * 0.24, -hd / 2 - 0.08 * hs, 0.08 * hs), zc_mat(n, "lens", "#DDEEFF", rough=0.05), 20, rot=(90, 0, 0), parent=H)
            box(n + "_glb", (hw * 0.14, 0.04 * hs, 0.06 * hs), (0, -hd / 2 - 0.08 * hs, 0.1 * hs), gm, 0.0, parent=H)
        elif kind == "apron":
            am = zc_mat(n, "apron", "#2E7D5A", rough=0.85)
            box(n + "_apron", (P["torso_w"] * 0.78, 0.06, P["torso_h"] * 0.95), (0, -P["torso_d"] / 2 - 0.05, P["torso_h"] * 0.42), am, 0.03, parent=ch.torso)
            box(n + "_apronstrap", (P["torso_w"] * 0.5, 0.05, 0.12), (0, -P["torso_d"] / 2 - 0.05, P["torso_h"] * 0.9), am, 0.0, parent=ch.torso)
        elif kind == "stethoscope":
            sm = zc_mat(n, "steth", "#2A2A30", rough=0.4)
            for s in (-1, 1):
                cyl(n + "_st%d" % s, 0.05, P["torso_h"] * 0.55, (s * P["torso_w"] * 0.2, -P["torso_d"] / 2 - 0.08, P["torso_h"] * 0.68), sm, 8, rot=(0, s * 12, 0), parent=ch.torso)
            cyl(n + "_stdisc", 0.2, 0.08, (P["torso_w"] * 0.12, -P["torso_d"] / 2 - 0.1, P["torso_h"] * 0.36), zc_mat(n, "stdisc", "#C9CED6", rough=0.2, spec=0.9), 16, rot=(90, 0, 0), parent=ch.torso)
        elif kind == "bow_tie":
            bm = zc_mat(n, "bow", "#8C1E2A", rough=0.5)
            for s in (-1, 1):
                sphere(n + "_bow%d" % s, 0.2, (s * 0.2, -P["torso_d"] / 2 - 0.06, P["torso_h"] - 0.15), bm, (1.2, 0.4, 0.8), parent=ch.torso, seg=10)


def zv_person(name, spec_id, loc, face_to=None, pose="stand", face=None, t0=0.0, t1=1.0, badge=None):
    """a cast / role person from the library: the base character + its role pieces (spec "wear")"""
    S = ZC_SPECS[spec_id]
    ch = ZChar(name, S, tuple(loc), rot=0, badge=(spec_id == "me") if badge is None else badge)
    zv_wear(ch, S.get("wear"))
    ch.pose(t0, pose)
    ch.express(t0, face or S.get("default_face", "neutral"))
    if face_to is not None:
        ch.face_to(tuple(face_to))
    zc_blinks(ch, t0, t1)
    zc_idle(ch, t0, t1, 0.6)
    if S.get("stretch"):
        zv_stretch(ch, **S["stretch"])
    return ch


# ---------------------------------------------------------------- THE STRETCH EFFECT (any base character)
ZV_ARM_AXIS = {"i": 0}


def zv_stretch(ch, legs=1.0, neck=1.0, arms=1.0):
    """very long legs / neck / arms on a ZChar (the body is lifted so the feet stay on the ground)"""
    P = ch.spec["body"]
    if legs != 1.0:
        for side in ("L", "R"):
            ch.thigh[side].scale = (1.0, 1.0, legs)
        ch.root.location.z += (legs - 1.0) * (P["thigh"] + P["shin"] + 0.42) * ch.k
    if arms != 1.0:
        for side in ("L", "R"):
            for part in (ch.shoulder[side], ch.elbow[side]):
                part.scale = tuple(arms if i == ZV_ARM_AXIS["i"] else 1.0 for i in range(3))
    if neck != 1.0:
        extra = (neck - 1.0) * 0.9
        ch.neck.location.z += extra
        cyl(ch.name + "_longneck", 0.32 * P["head"], extra + 0.3, (0, 0, -extra / 2 - 0.05), ch.M["skin"], 16, parent=ch.neck)


# ---------------------------------------------------------------- ANIMALS (dog, cat, bird)
class ZAnimal:
    def __init__(self, name, kind, loc=(0, 0, 0), rot=0.0, col=None, pose="stand"):
        self.name, self.kind = name, kind
        self.root = empty(name + "_root", tuple(loc), None, None, (0, 0, rot))
        R = self.root
        eye = mat("zt_aeye", (0.02, 0.02, 0.02), 0.2)
        if kind == "dog":
            c = col or "#C68A4A"
            m, m2 = mat("zt_dog_" + c[1:], zc_rgb(c), 0.8), mat("zt_dog2", zc_rgb("#F2E2C8"), 0.8)
            box(name + "_body", (0.9, 1.9, 0.85), (0, 0.2, 1.1), m, 0.25, parent=R)
            for x in (-0.3, 0.3):
                for y in (-0.5, 0.9):
                    box(name + "_leg%d%d" % (int(x * 10), int(y * 10)), (0.26, 0.26, 0.75), (x, y, 0.38), m, 0.08, parent=R)
            box(name + "_head", (0.85, 0.8, 0.8), (0, -0.95, 1.65), m, 0.25, parent=R)
            box(name + "_snout", (0.5, 0.45, 0.38), (0, -1.45, 1.5), m2, 0.12, parent=R)
            sphere(name + "_nose", 0.1, (0, -1.68, 1.6), eye, seg=8, parent=R)
            for s in (-1, 1):
                sphere(name + "_eye%d" % s, 0.09, (s * 0.2, -1.36, 1.8), eye, seg=8, parent=R)
                box(name + "_ear%d" % s, (0.18, 0.3, 0.5), (s * 0.46, -0.9, 1.75), mat("zt_dogear", zc_rgb("#7A4A26"), 0.8), 0.06, rot=(0, s * 12, 0), parent=R)
            cyl(name + "_tail", 0.08, 0.7, (0, 1.3, 1.6), m, 8, rot=(-40 if pose != "sit" else -10, 0, 0), parent=R)
        elif kind == "cat":
            c = col or "#4A4A52"
            m = mat("zt_cat_" + c[1:], zc_rgb(c), 0.8)
            box(name + "_body", (0.6, 1.4, 0.6), (0, 0.15, 0.75), m, 0.22, parent=R)
            for x in (-0.18, 0.18):
                for y in (-0.35, 0.65):
                    box(name + "_leg%d%d" % (int(x * 10), int(y * 10)), (0.17, 0.17, 0.5), (x, y, 0.25), m, 0.05, parent=R)
            box(name + "_head", (0.62, 0.55, 0.55), (0, -0.7, 1.2), m, 0.2, parent=R)
            for s in (-1, 1):
                cyl(name + "_ear%d" % s, 0.13, 0.28, (s * 0.2, -0.7, 1.58), m, 4, r2=0.01, parent=R)
                sphere(name + "_eye%d" % s, 0.09, (s * 0.15, -0.98, 1.25), mat("zt_cateye", zc_rgb("#E8D84A"), 0.2, emit=zc_rgb("#E8D84A"), estr=0.6), seg=8, parent=R)
            cyl(name + "_tail", 0.06, 1.0, (0, 0.95, 1.2), m, 8, rot=(-15, 0, 0), parent=R)
        else:   # bird
            c = col or "#3D7BE0"
            m = mat("zt_bird_" + c[1:], zc_rgb(c), 0.7)
            sphere(name + "_body", 0.42, (0, 0, 0.6), m, (0.9, 1.2, 0.95), seg=14, parent=R)
            sphere(name + "_head", 0.28, (0, -0.42, 1.0), m, seg=12, parent=R)
            cyl(name + "_beak", 0.1, 0.24, (0, -0.72, 0.98), mat("zt_beak", zc_rgb("#F2A541"), 0.5), 6, r2=0.01, rot=(90, 0, 0), parent=R)
            for s in (-1, 1):
                sphere(name + "_eye%d" % s, 0.05, (s * 0.13, -0.62, 1.06), eye, seg=6, parent=R)
                sphere(name + "_wing%d" % s, 0.3, (s * 0.38, 0.05, 0.65), mat("zt_wing_" + c[1:], zc_rgb(c), 0.7), (0.25, 1.0, 0.6), seg=10, rot=(0, s * (60 if pose == "fly" else 10), 0), parent=R)
            for s in (-1, 1):
                cyl(name + "_foot%d" % s, 0.03, 0.25, (s * 0.12, 0, 0.12), mat("zt_beak", zc_rgb("#F2A541"), 0.5), 6, parent=R)


# ---------------------------------------------------------------- THE ENTITIES (our own: eerie, never gory)
class ZEntity:
    """one of the town's entities. kind: long_one, crawler, watcher, hollow, many_arms, rain_thing, ghost, robot,
    slime, giant_critter. state: stand / walk / reach / peek / loom / eyes. show: full / silhouette / eyes."""
    def __init__(self, name, kind, loc=(0, 0, 0), rot=0.0, state="stand", show="full", t0=0.0, t1=1.0):
        self.name, self.kind, self.state = name, kind, state
        ZV_SHOW["mode"] = "eyes" if state == "eyes" else show
        self.root = empty(name + "_root", tuple(loc), None, None, (0, 0, rot))
        {"long_one": self._long_one, "crawler": self._crawler, "watcher": self._watcher, "hollow": self._hollow, "many_arms": self._many_arms,
         "rain_thing": self._rain_thing, "ghost": self._ghost, "robot": self._robot, "slime": self._slime, "giant_critter": self._giant_critter}[kind](t0, t1)
        # the scary ones are clearly bigger than a person (owner 2026-11-25: 1.5-3x; the giant creature house-sized)
        k = ZV_ENT_SCALE.get(kind, 1.0)
        self.root.scale = (k, k, k)
        ZV_SHOW["mode"] = "full"

    def _eye(self, nm, at, r, parent, col="#FFF6D0", glow=6.0, pupil=True, scale=(1, 1, 1)):
        sphere(nm, r, at, zv_m("eyew", col, 0.3, emit=col, estr=glow), scale, seg=12, parent=parent)
        if pupil:
            sphere(nm + "_p", r * 0.45, (at[0], at[1] - r * 0.8, at[2]), mat("zt_pupil", (0.0, 0.0, 0.0), 0.3), seg=8, parent=parent)

    def _lean(self):
        return {"stand": 0, "walk": 8, "reach": 14, "peek": 0, "loom": 28, "eyes": 0}[self.state]

    def _long_one(self, t0, t1):
        """a person stretched far too tall with too many joints: 3-segment legs, 4-segment arms to its knees, a pale blank face"""
        n, R = self.name, self.root
        sk, cl = zv_m("long_skin", "#D9D4CC", 0.7), zv_m("long_cloth", "#2A2830", 0.9)
        body = empty(n + "_body", (0, 0, 0), R)
        body.rotation_euler = (math.radians(-self._lean()), 0, math.radians(-25 if self.state == "peek" else 0))
        for s in (-1, 1):
            z, x = 0.0, s * 0.45
            for k, (L, a) in enumerate(((3.2, 8), (3.0, -14), (2.8, 10))):
                ang = a * (1 if self.state != "walk" else (1.6 if s > 0 else 0.4))
                cyl("%s_leg%d_%d" % (n, s, k), 0.2, L, (x + s * 0.05 * k, -math.sin(math.radians(ang)) * L / 2, z + L / 2), cl, 8, rot=(ang, 0, 0), parent=body)
                sphere("%s_knee%d_%d" % (n, s, k), 0.28, (x + s * 0.05 * k, 0, z + L), cl, seg=8, parent=body)
                z += L
        sphere(n + "_hip", 0.6, (0, 0, 9.0), cl, (1.2, 0.8, 0.7), seg=10, parent=body)
        cyl(n + "_torso", 0.55, 3.6, (0, 0, 10.8), cl, 10, r2=0.75, parent=body)
        cyl(n + "_neck", 0.18, 1.4, (0, 0, 13.2), sk, 8, parent=body)
        sphere(n + "_head", 0.62, (0, 0, 14.2), sk, (0.85, 0.8, 1.25), seg=16, parent=body)
        box(n + "_mouth", (0.5, 0.05, 0.05), (0, -0.52, 13.85), mat("zt_line", (0.05, 0.05, 0.05), 0.9), 0.0, parent=body)
        for s in (-1, 1):   # no eyes: two faint hollows
            sphere(n + "_hollow%d" % s, 0.12, (s * 0.2, -0.46, 14.35), mat("zt_hollowe", (0.3, 0.28, 0.27), 0.9), (1, 0.4, 1.3), seg=8, parent=body)
        if self.state == "eyes":
            for s in (-1, 1):
                self._eye(n + "_eye%d" % s, (s * 0.2, -0.5, 14.35), 0.1, body, col="#F4F4F4", glow=4.0, pupil=False)
        reach = self.state in ("reach", "loom")
        for s in (-1, 1):
            z, x, y = 12.4, s * 0.85, 0.0
            for k in range(4):
                L = 1.7
                ang = (-70 if reach else -8) + (k * (-12 if reach else 6)) * (1 if k % 2 else -1)
                dx, dy, dz = s * (0.35 if not reach else 0.05), -math.sin(math.radians(-ang)) * L if reach else -0.05, -math.cos(math.radians(ang)) * L
                cyl("%s_arm%d_%d" % (n, s, k), 0.13, L, (x + dx / 2, y + dy / 2, z + dz / 2), cl if k < 2 else sk, 8, rot=(ang if reach else 0, -s * 8, 0), parent=body)
                x, y, z = x + dx, y + dy, z + dz
                sphere("%s_elb%d_%d" % (n, s, k), 0.19, (x, y, z), sk, seg=8, parent=body)
            for f in range(3):
                cyl("%s_finger%d_%d" % (n, s, f), 0.05, 0.9, (x + (f - 1) * 0.12, y, z - 0.45), sk, 6, parent=body)

    def _crawler(self, t0, t1):
        """low on all fours, the limbs bent up like a spider's, the head turned upside down (the face the wrong way)"""
        n, R = self.name, self.root
        m, sk = zv_m("crawl", "#3A3F3A", 0.8), zv_m("crawl_skin", "#B9BDB0", 0.7)
        up = {"stand": 0.0, "walk": 0.1, "reach": 0.6, "peek": -0.2, "loom": 1.2, "eyes": 0.0}[self.state]
        box(n + "_torso", (1.4, 3.6, 1.0), (0, 0.4, 1.9 + up), m, 0.4, rot=(-8 - up * 25, 0, 0), parent=R)
        for s in (-1, 1):
            for y, fwd in ((-0.9, 1), (1.8, -1)):
                kx, kz = s * 1.6, 3.0 + up
                cyl("%s_u%d%d" % (n, s, int(y)), 0.16, 2.0, ((s * 0.6 + kx) / 2, y, (1.9 + up + kz) / 2), m, 8, rot=(0, s * -50, 0), parent=R)
                cyl("%s_l%d%d" % (n, s, int(y)), 0.13, 3.2, (kx + s * 0.5, y - fwd * 0.2, kz / 2), m, 8, rot=(0, s * 12, 0), parent=R)
                sphere("%s_k%d%d" % (n, s, int(y)), 0.22, (kx, y, kz), m, seg=8, parent=R)
        H = empty(n + "_headp", (0, -1.7, 2.3 + up), R)
        H.rotation_euler = (0, math.radians(180), 0)     # upside down
        sphere(n + "_head", 0.75, (0, 0, 0), sk, (0.9, 0.85, 1.05), seg=16, parent=H)
        for s in (-1, 1):
            self._eye(n + "_eye%d" % s, (s * 0.26, -0.6, 0.18), 0.17, H, col="#FFE36A", glow=9.0)
        box(n + "_grin", (0.6, 0.05, 0.08), (0, -0.7, -0.28), mat("zt_line", (0.05, 0.05, 0.05), 0.9), 0.0, parent=H)

    def _watcher(self, t0, t1):
        """a heavy body covered in eyes that all open at once (state stand = closed lids, every other state = open)"""
        n, R = self.name, self.root
        m = zv_m("watch", "#1E1828", 0.85)
        lean = self._lean()
        B = empty(n + "_b", (0, 0, 0), R)
        B.rotation_euler = (math.radians(-lean), 0, 0)
        for s in (-1, 1):
            cyl(n + "_leg%d" % s, 0.55, 2.6, (s * 0.8, 0, 1.3), m, 10, parent=B)
        sphere(n + "_body", 2.0, (0, 0, 4.6), m, (1.0, 0.8, 1.25), seg=24, parent=B)
        sphere(n + "_head", 1.1, (0, -0.1, 7.6), m, seg=18, parent=B)
        for s in (-1, 1):
            cyl(n + "_arm%d" % s, 0.35, 5.6, (s * 2.2, -1.2 if self.state == "reach" else 0, 3.2), m, 10, rot=(-60 if self.state == "reach" else 0, s * 12, 0), parent=B)
        rnd = random.Random(9)
        openy = self.state != "stand"
        pts = [(0, -1.05, 7.7, 0.32)]
        for k in range(26):
            a, zz = rnd.uniform(-1.1, 1.1), rnd.uniform(3.0, 6.6)
            pts.append((math.sin(a) * 1.95, -math.cos(a) * 1.55, zz, rnd.uniform(0.16, 0.3)))
        for k in range(5):
            a = rnd.uniform(-0.9, 0.9)
            pts.append((math.sin(a) * 1.0, -math.cos(a) * 0.95, 7.6 + rnd.uniform(-0.4, 0.5), 0.14))
        for k, (x, y, z, r) in enumerate(pts):
            if openy:
                self._eye("%s_e%d" % (n, k), (x, y, z), r, B, col="#FFF2A0", glow=7.0)
            else:
                sphere("%s_lid%d" % (n, k), r * 1.05, (x, y, z), zv_m("lid", "#4E4262", 0.8), (1, 0.6, 0.7), seg=10, parent=B)
                box("%s_lash%d" % (n, k), (r * 1.6, 0.04, 0.04), (x, y - r * 0.6, z), mat("zt_line", (0.05, 0.05, 0.05), 0.9), 0.0, parent=B)

    def _hollow(self, t0, t1):
        """a townsperson with an empty dark face: the base character, the face a void that does not reflect"""
        spec = dict(ZC_SPECS["nb2"])
        ch = ZChar(self.name + "_p", spec, (0, 0, 0), rot=0, badge=False)
        ch.root.parent = self.root
        zv_stretch(ch, legs=1.25, neck=1.6)
        ch.pose(t0, {"stand": "stand", "walk": "walk", "reach": "reach", "peek": "peek", "loom": "lean", "eyes": "stand"}[self.state])
        hw, hd, hh = ch.hdim
        box(self.name + "_void", (hw * 0.92, 0.5, hh * 0.84), (0, -hd / 2 - 0.12, -0.02 * hh), mat("zt_void", (0.0, 0.0, 0.0), 1.0, spec=0.0), 0.2, parent=ch.head)
        if True:     # two pinpoint eyes glow in the void (every state)
            for s in (-1, 1):
                self._eye(self.name + "_pin%d" % s, (s * hw * 0.2, -hd / 2 - 0.4, 0.05 * hh), 0.09, ch.head, col="#FFFFFF", glow=12.0, pupil=False)
        self.ch = ch
        if ZV_SHOW["mode"] in ("silhouette", "eyes"):
            for o in list(D.objects):
                if o.name.startswith(self.name + "_p") and o.type == "MESH":
                    o.data.materials.clear()
                    o.data.materials.append(mat("zt_black", (0.0, 0.0, 0.0), 1.0, spec=0.0))

    def _many_arms(self, t0, t1):
        """a shape in a doorway with arms reaching round the frame (the doorway is part of it)"""
        n, R = self.name, self.root
        fr, m = zv_m("frame", "#5A3A2A", 0.7), zv_m("arms", "#141218", 0.9)
        box(n + "_fl", (0.6, 0.8, 7.6), (-2.1, 0, 3.8), fr, 0.04, parent=R)
        box(n + "_fr", (0.6, 0.8, 7.6), (2.1, 0, 3.8), fr, 0.04, parent=R)
        box(n + "_ft", (4.8, 0.8, 0.6), (0, 0, 7.6), fr, 0.04, parent=R)
        box(n + "_dark", (3.6, 0.1, 7.3), (0, 0.3, 3.65), mat("zt_void", (0.0, 0.0, 0.0), 1.0, spec=0.0), 0.0, parent=R)
        if self.state != "peek":
            sphere(n + "_shape", 1.3, (0, 0.1, 5.4), m, (1.0, 0.6, 1.4), seg=16, parent=R)
        self._eye(n + "_eyeL", (-0.35, -0.6, 5.9), 0.13, R, col="#E8F4FF", glow=5.0, pupil=False)
        self._eye(n + "_eyeR", (0.35, -0.6, 5.9), 0.13, R, col="#E8F4FF", glow=5.0, pupil=False)
        reach = {"stand": 0.5, "walk": 0.7, "reach": 1.0, "peek": 0.35, "loom": 1.3, "eyes": 0.4}[self.state]
        sk = zv_m("arms_hand", "#2A2630", 0.8)
        for k in range(8):     # each arm comes out of the dark, bends round the frame's edge and grips its front
            side = -1 if k % 2 else 1
            z = 1.2 + (k // 2) * 1.7 + (0.4 if side > 0 else 0.0)
            x0 = side * 1.5
            cyl("%s_a%d" % (n, k), 0.14, 1.0, (x0 + side * 0.4, 0.1, z), m, 8, rot=(0, 90, 0), parent=R)
            sphere("%s_el%d" % (n, k), 0.2, (side * 2.0, -0.45, z), m, seg=8, parent=R)
            L = 0.8 + 1.1 * reach
            cyl("%s_b%d" % (n, k), 0.12, L, (side * (2.0 + L / 2 * 0.7), -0.55, z - L / 2 * 0.5), m, 8, rot=(0, side * 55, 0), parent=R)
            hx, hz = side * (2.0 + L * 0.7), z - L * 0.5
            for f in range(4):
                cyl("%s_f%d_%d" % (n, k, f), 0.045, 0.55, (hx + side * 0.15, -0.55 + 0.12 * (f - 1.5), hz - 0.25), sk, 6, rot=(side * 15, 0, 0), parent=R)
        if self.state != "peek":
            sphere(n + "_face", 0.55, (0, -0.5, 5.8), zv_m("arms_face", "#D9D4CC", 0.7), (0.9, 0.6, 1.2), seg=14, parent=R)
            for s in (-1, 1):
                self._eye(n + "_fe%d" % s, (s * 0.2, -0.82, 5.95), 0.09, R, col="#F4F4F4", glow=2.0)

    def _rain_thing(self, t0, t1):
        """a figure made of dripping black water: glossy blobs, drips hanging and falling, a puddle around it"""
        n, R = self.name, self.root
        m = zv_m("wet", "#05070C", 0.04, metal=0.2)
        lean = self._lean()
        B = empty(n + "_b", (0, 0, 0), R)
        B.rotation_euler = (math.radians(-lean), 0, 0)
        for s in (-1, 1):
            for k in range(4):
                sphere("%s_leg%d_%d" % (n, s, k), 0.45 - k * 0.03, (s * 0.55, 0, 0.5 + k * 0.85), m, (1, 1, 1.3), seg=12, parent=B)
        for k in range(5):
            sphere("%s_t%d" % (n, k), 1.0 - abs(k - 2) * 0.12, (0, 0, 3.8 + k * 0.6), m, (1.1, 0.8, 0.9), seg=14, parent=B)
        sphere(n + "_head", 0.75, (0, 0, 7.2), m, (0.9, 0.9, 1.15), seg=16, parent=B)
        reach = self.state in ("reach", "loom")
        for s in (-1, 1):
            for k in range(5):
                sphere("%s_arm%d_%d" % (n, s, k), 0.32 - k * 0.03, (s * (1.25 + (0.15 * k if not reach else 0.1)), -(k * 0.55 if reach else 0), 5.8 - (k * 0.6 if not reach else 0.0)), m, seg=10, parent=B)
        rnd = random.Random(4)
        for k in range(22):
            x, z = rnd.uniform(-1.6, 1.6), rnd.uniform(1.0, 7.0)
            sphere("%s_drip%d" % (n, k), 0.09, (x, -0.7, z), m, (0.7, 0.7, 2.4), seg=8, parent=B)
        for k in range(10):
            ob = sphere("%s_fall%d" % (n, k), 0.07, (rnd.uniform(-1.4, 1.4), -0.6, rnd.uniform(0.3, 3)), m, (0.7, 0.7, 2.0), seg=6, parent=R)
            key(ob, "location", F(t0))
            ob.location.z -= 3.0
            key(ob, "location", F(t1))
        cyl(n + "_puddle", 2.4, 0.03, (0, -0.2, 0.03), mat("zt_puddle", zc_rgb("#0A0D14"), 0.03, metal=0.3), 32, parent=R)
        for s in (-1, 1):
            self._eye(n + "_eye%d" % s, (s * 0.26, -0.62, 7.35), 0.16, B, col="#BFE8FF", glow=10.0, pupil=False)

    def _ghost(self, t0, t1):
        n, R = self.name, self.root
        m = zv_m("sheet", "#F4F6FA", 0.8, emit="#DDE8FF" if ZV_SHOW["mode"] == "full" else None, estr=0.25)
        fl = 0.6 + (0.3 if self.state == "loom" else 0.0)
        B = empty(n + "_b", (0, 0, fl), R)
        B.rotation_euler = (math.radians(-self._lean()), 0, 0)
        cyl(n + "_sheet", 1.6, 3.6, (0, 0, 2.2), m, 24, r2=0.9, parent=B)
        sphere(n + "_head", 1.05, (0, 0, 4.2), m, seg=20, parent=B)
        for k in range(8):
            a = k * math.pi / 4
            sphere("%s_hem%d" % (n, k), 0.42, (math.cos(a) * 1.4, math.sin(a) * 1.4, 0.45), m, seg=10, parent=B)
        for s in (-1, 1):
            sphere(n + "_eye%d" % s, 0.2, (s * 0.35, -0.92, 4.35), mat("zt_geye", (0.0, 0.0, 0.0), 0.9) if self.state != "eyes" else zv_m("geye", "#9FFFE8", 0.3, emit="#9FFFE8", estr=6), (1, 0.4, 1.5), seg=10, parent=B)
            if self.state in ("reach", "loom"):
                cyl(n + "_sl%d" % s, 0.3, 1.8, (s * 1.3, -0.9, 3.0), m, 10, rot=(-70, 0, 0), parent=B)
        sphere(n + "_mouth", 0.18, (0, -0.95, 3.85), mat("zt_geye", (0.0, 0.0, 0.0), 0.9), (1.2, 0.4, 1.6), seg=10, parent=B)

    def _robot(self, t0, t1):
        n, R = self.name, self.root
        m, d = zv_m("rob", "#A9B4C2", 0.35, metal=0.6), zv_m("rob2", "#4A5462", 0.4, metal=0.5)
        B = empty(n + "_b", (0, 0, 0), R)
        B.rotation_euler = (math.radians(-self._lean()), 0, 0)
        for s in (-1, 1):
            box(n + "_leg%d" % s, (0.7, 0.8, 2.4), (s * 0.6, 0, 1.2), d, 0.08, parent=B)
            box(n + "_foot%d" % s, (0.9, 1.3, 0.3), (s * 0.6, -0.2, 0.15), m, 0.06, parent=B)
        box(n + "_body", (2.6, 1.6, 2.6), (0, 0, 3.7), m, 0.12, parent=B)
        box(n + "_chest", (1.2, 0.1, 0.8), (0, -0.82, 4.0), zv_m("panel", "#2B3550", 0.4, emit="#3CFF7A", estr=1.5), 0.02, parent=B)
        box(n + "_head", (1.6, 1.4, 1.2), (0, 0, 5.7), m, 0.12, parent=B)
        box(n + "_visor", (1.3, 0.1, 0.4), (0, -0.72, 5.75), zv_m("visor", "#FF3030", 0.2, emit="#FF3030", estr=5), 0.04, parent=B)
        cyl(n + "_ant", 0.05, 0.8, (0.4, 0, 6.7), d, 6, parent=B)
        sphere(n + "_antb", 0.14, (0.4, 0, 7.15), zv_m("antb", "#FF3030", 0.3, emit="#FF3030", estr=4), seg=8, parent=B)
        reach = self.state in ("reach", "loom")
        for s in (-1, 1):
            box(n + "_arm%d" % s, (0.5, 0.5, 2.4), (s * 1.6, -1.1 if reach else 0, 4.4 if reach else 3.4), d, 0.06, rot=(-80 if reach else 0, 0, 0), parent=B)
            box(n + "_claw%d" % s, (0.6, 0.4, 0.4), (s * 1.6, -2.3 if reach else 0, 4.4 if reach else 2.0), m, 0.05, parent=B)

    def _slime(self, t0, t1):
        n, R = self.name, self.root
        m = zv_m("slime", "#5FD35A", 0.08, emit="#3FA83A" if ZV_SHOW["mode"] == "full" else None, estr=0.4)
        sq = {"stand": 1.0, "walk": 0.85, "reach": 1.2, "peek": 0.7, "loom": 1.45, "eyes": 1.0}[self.state]
        sphere(n + "_blob", 2.2, (0, 0, 1.6 * sq), m, (1.25, 1.1, 0.8 * sq), seg=24, parent=R)
        sphere(n + "_top", 1.2, (0.2, 0, 3.0 * sq), m, (1, 1, 0.8), seg=18, parent=R)
        for k in range(6):
            a = k * 1.05
            sphere("%s_drip%d" % (n, k), 0.35, (math.cos(a) * 2.6, math.sin(a) * 2.2, 0.25), m, (1.2, 1.2, 0.5), seg=10, parent=R)
        for s in (-1, 1):
            self._eye(n + "_eye%d" % s, (s * 0.55, -1.3, 3.0 * sq), 0.32, R, col="#FFFFFF", glow=1.5 if self.state != "eyes" else 6.0)

    def _giant_critter(self, t0, t1):
        cr = ZCritter(self.name + "_c", ZC_SPECS["critter"], (0, 0, 0), rot=0)
        cr.root.parent = self.root
        k = 16.0
        cr.root.scale = (cr.root.scale[0] * k, cr.root.scale[1] * k, cr.root.scale[2] * k)
        cr.express(t0, {"stand": "happy", "walk": "big_smile", "reach": "angry", "peek": "scared", "loom": "angry", "eyes": "angry"}[self.state])
        self.ch = cr


# ---------------------------------------------------------------- PROPS (world units; zv_hold puts one in a hand)
def zv_prop(kind, name, label=None, col=None):
    """props at real size: phone (readable screen text), key, clock, money, food, book, pencil, backpack, ball, umbrella,
    sign (text), bike, coin. Built at the origin under an empty."""
    e = empty(name, (0, 0, 0))
    g = mat("zs_gold", (1.0, 0.72, 0.18), 0.3, metal=0.85)
    if kind == "phone":
        box(name + "_b", (0.55, 0.06, 1.0), (0, 0, 0), mat("zt_phone", zc_rgb("#22252B"), 0.35), 0.05, parent=e)
        box(name + "_s", (0.48, 0.02, 0.88), (0, -0.035, 0), mat("zt_scr", zc_rgb("#F4F8FF"), 0.2, emit=zc_rgb("#F4F8FF"), estr=1.4), 0.0, parent=e)
        text(name + "_t", (label or "HELLO")[:14], (0, -0.05, 0.05), 0.09, mat("zt_scrt", zc_rgb("#1A1A2A"), 0.4), rot=(90, 0, 0), parent=e)
    elif kind == "key":
        cyl(name + "_bow", 0.16, 0.05, (0, 0, 0.3), g, 20, rot=(90, 0, 0), parent=e)
        cyl(name + "_hole", 0.06, 0.06, (0, 0, 0.3), mat("zs_keyhole", (0.05, 0.04, 0.03), 0.6), 12, rot=(90, 0, 0), parent=e)
        box(name + "_shaft", (0.06, 0.05, 0.5), (0, 0, -0.08), g, 0.01, parent=e)
        box(name + "_t1", (0.12, 0.05, 0.05), (0.08, 0, -0.28), g, 0.0, parent=e)
        box(name + "_t2", (0.09, 0.05, 0.05), (0.06, 0, -0.18), g, 0.0, parent=e)
        if label:
            box(name + "_tag", (0.3, 0.02, 0.2), (0.25, 0, 0.42), mat("zt_tag", zc_rgb("#FFF8EC"), 0.8), 0.0, rot=(0, 20, 0), parent=e)
            text(name + "_tt", label[:4], (0.25, -0.02, 0.42), 0.08, mat("zt_tagt", zc_rgb("#2B2B33"), 0.6), rot=(90, -20, 0), parent=e)
    elif kind == "clock":
        cyl(name + "_c", 0.45, 0.15, (0, 0, 0), mat("zt_clk", zc_rgb("#E8505B"), 0.4), 24, rot=(90, 0, 0), parent=e)
        cyl(name + "_f", 0.38, 0.05, (0, -0.08, 0), mat("zt_clkf", zc_rgb("#FFFFFF"), 0.4), 24, rot=(90, 0, 0), parent=e)
        box(name + "_h", (0.04, 0.02, 0.2), (0, -0.12, 0.08), mat("zt_line", (0.05, 0.05, 0.05), 0.9), 0.0, parent=e)
        box(name + "_m", (0.25, 0.02, 0.04), (0.1, -0.12, 0), mat("zt_line", (0.05, 0.05, 0.05), 0.9), 0.0, parent=e)
    elif kind == "money":
        for k in range(3):
            box(name + "_n%d" % k, (0.8, 0.02, 0.38), (0.03 * k, -0.02 * k, 0.03 * k), mat("zt_note", zc_rgb("#7FC48A"), 0.7), 0.0, rot=(0, 6 * k, 0), parent=e)
        cyl(name + "_seal", 0.08, 0.03, (0.06, -0.07, 0.06), mat("zt_seal", zc_rgb("#2E6B3A"), 0.6), 12, rot=(90, 0, 0), parent=e)
    elif kind == "food":
        sphere(name + "_bun", 0.32, (0, 0, 0.12), mat("zt_bun", zc_rgb("#D99A4A"), 0.7), (1, 1, 0.55), seg=14, parent=e)
        cyl(name + "_patty", 0.33, 0.1, (0, 0, -0.02), mat("zt_patty", zc_rgb("#6B3A22"), 0.8), 16, parent=e)
        cyl(name + "_salad", 0.36, 0.04, (0, 0, 0.05), mat("zt_salad", zc_rgb("#6FB04A"), 0.7), 16, parent=e)
        sphere(name + "_bun2", 0.32, (0, 0, -0.12), mat("zt_bun", zc_rgb("#D99A4A"), 0.7), (1, 1, 0.35), seg=14, parent=e)
    elif kind == "book":
        box(name + "_b", (0.7, 0.18, 0.9), (0, 0, 0), mat("zt_book_" + (col or "#3E7CB1")[1:], zc_rgb(col or "#3E7CB1"), 0.7), 0.02, parent=e)
        box(name + "_p", (0.64, 0.16, 0.86), (0.04, 0, 0), mat("zt_pages", zc_rgb("#F4F0E6"), 0.8), 0.0, parent=e)
    elif kind == "pencil":
        cyl(name + "_b", 0.05, 0.8, (0, 0, 0), mat("zt_pencil", zc_rgb("#F2C14E"), 0.5), 6, parent=e)
        cyl(name + "_t", 0.05, 0.14, (0, 0, -0.47), mat("zt_wood", zc_rgb("#E8C89A"), 0.7), 6, r2=0.005, parent=e)
    elif kind == "backpack":
        box(name + "_b", (0.9, 0.5, 1.1), (0, 0, 0), mat("zt_bag", zc_rgb(col or "#E8505B"), 0.8), 0.15, parent=e)
        box(name + "_p", (0.7, 0.15, 0.5), (0, -0.3, -0.2), mat("zt_bag2", zc_rgb("#B83A44"), 0.8), 0.08, parent=e)
    elif kind == "ball":
        sphere(name + "_b", 0.45, (0, 0, 0), mat("zt_ball", zc_rgb(col or "#E86A1E"), 0.6), seg=18, parent=e)
        box(name + "_l", (0.92, 0.92, 0.03), (0, 0, 0), mat("zt_line", (0.05, 0.05, 0.05), 0.9), 0.0, parent=e)
    elif kind == "umbrella":
        cyl(name + "_c", 1.3, 0.6, (0, 0, 1.0), mat("zt_umb_" + (col or "#E53935")[1:], zc_rgb(col or "#E53935"), 0.5), 8, r2=0.06, parent=e)
        cyl(name + "_s", 0.035, 1.6, (0, 0, 0.2), mat("zt_umbs", (0.15, 0.15, 0.15), 0.4), 6, parent=e)
    elif kind == "sign":
        cyl(name + "_s", 0.05, 1.6, (0, 0, -0.4), mat("zt_wood", zc_rgb("#E8C89A"), 0.7), 6, parent=e)
        box(name + "_b", (1.4, 0.05, 0.8), (0, 0, 0.6), mat("zt_signb", zc_rgb("#FFFFFF"), 0.7), 0.02, parent=e)
        text(name + "_t", (label or "HELP")[:12], (0, -0.04, 0.6), 0.2, mat("zt_signt", zc_rgb("#D63A2F"), 0.6), rot=(90, 0, 0), parent=e)
    elif kind == "bike":
        tm = mat("zt_tyre", zc_rgb("#1E1E22"), 0.6)
        fm = mat("zt_bikef_" + (col or "#2E6FD8")[1:], zc_rgb(col or "#2E6FD8"), 0.35, metal=0.4)
        for x in (-1.0, 1.0):
            cyl(name + "_w%d" % int(x), 0.75, 0.12, (x, 0, 0.75), tm, 24, rot=(90, 0, 0), parent=e)
        box(name + "_f1", (2.0, 0.1, 0.1), (0, 0, 1.2), fm, 0.02, parent=e)
        box(name + "_f2", (0.1, 0.1, 0.9), (-0.3, 0, 0.9), fm, 0.02, rot=(0, 25, 0), parent=e)
        box(name + "_seat", (0.5, 0.3, 0.12), (-0.4, 0, 1.6), tm, 0.04, parent=e)
        box(name + "_bars", (0.1, 0.9, 0.1), (0.9, 0, 1.7), fm, 0.02, parent=e)
    else:
        zv_thing(kind, name + "_th").parent = e
    return e


def zv_hold(ch, prop, hands="R"):
    """a world-size prop into a hand (the hand lives inside the character's scale)"""
    ch.hold(0.0, prop, hands)       # the base places it at the hand (and scales it to local units)
    prop.scale = (1.0, 1.0, 1.0)     # ours are built at world size
    return prop


# ---------------------------------------------------------------- EFFECTS
def zv_effect(kind, t0, t1, at=(0, 0, 0), size=1.0, cam=None, opt=None):
    """effects: lava / water covering the street, grow (a thing growing giant), glow, smoke, sparks, confetti,
    lights_out (the lights going out one by one: every prop light and lit window darkens in turn over the shot)"""
    opt = opt or {}
    at = Vector(at)
    rnd = random.Random(17)
    if kind in ("lava", "water"):
        lv = opt.get("level", 0.45)
        if kind == "lava":
            m = mat("zt_lava", zc_rgb("#FF5A1A"), 0.4, emit=zc_rgb("#FF6A1A"), estr=3.0)
            box("zt_lava", (400, 400, 0.1), (0, 0, lv), m, 0.0)
            for k in range(60):
                p = zv_view_pts(cam, 1, d0=3, d1=40, seed=100 + k)[0]
                sphere("zt_lavab%d" % k, 0.5 + rnd.random() * 1.5, (p.x, p.y, lv + 0.02), mat("zt_lavad", zc_rgb("#C2280E"), 0.6, emit=zc_rgb("#8A1A08"), estr=1.0), (1.6, 1.2, 0.08), seg=10)
            light("zt_lavaglow", "AREA", (at.x, at.y, lv + 2.0), 6000, (1.0, 0.35, 0.1), 60.0, rot=(180, 0, 0))
        else:
            box("zt_water", (400, 400, 0.1), (0, 0, lv), mat("zt_waterm", zc_rgb("#3F8FC8"), 0.03, metal=0.1, alpha=0.85), 0.0)
            for k in range(40):
                p = zv_view_pts(cam, 1, d0=3, d1=35, seed=200 + k)[0]
                box("zt_ripple%d" % k, (1.6, 0.08, 0.02), (p.x, p.y, lv + 0.06), mat("zt_ripm", zc_rgb("#BFE6FF"), 0.1, emit=zc_rgb("#BFE6FF"), estr=0.5), 0.0, rot=(0, 0, rnd.random() * 180))
    elif kind == "grow":
        ob = opt.get("object")
        if ob is not None:
            s0, s1 = opt.get("from", 1.0), opt.get("to", 6.0)
            ob.scale = (s0, s0, s0)
            key(ob, "scale", F(t0))
            ob.scale = (s1, s1, s1)
            key(ob, "scale", F(t1))
    elif kind == "glow":
        light("zt_glow", "POINT", (at.x, at.y, at.z + 1.5), 600 * size, zc_rgb(opt.get("col", "#FFE2A0")), 1.5)
        sphere("zt_glowb", 1.2 * size, (at.x, at.y, at.z + 1.5), mat("zt_glowm", zc_rgb(opt.get("col", "#FFE2A0")), 0.5, emit=zc_rgb(opt.get("col", "#FFE2A0")), estr=2.0, alpha=0.25), seg=16)
    elif kind == "smoke":
        for k in range(24):
            ob = sphere("zt_smoke%d" % k, (0.5 + rnd.random() * 0.8) * size, (at.x + rnd.uniform(-1, 1) * size, at.y + rnd.uniform(-1, 1) * size, at.z + 0.6 + k * 0.35 * size), mat("zt_smokem", zc_rgb("#8C8C94"), 0.95, alpha=0.6), seg=10)
            key(ob, "location", F(t0))
            ob.location.z += 1.5
            key(ob, "location", F(t1))
    elif kind == "sparks":
        m = mat("zt_spark", zc_rgb("#FFD36A"), 0.3, emit=zc_rgb("#FFC040"), estr=12.0)
        for k in range(40):
            a, b = rnd.random() * 6.28, rnd.random() * 1.2
            L = rnd.uniform(0.3, 0.8) * size
            box("zt_spark%d" % k, (0.04, 0.04, L), (at.x + math.cos(a) * b * size, at.y + math.sin(a) * b * size, at.z + 1 + rnd.random() * size), m, 0.0, rot=(rnd.random() * 90, rnd.random() * 90, 0))
        light("zt_sparkl", "POINT", (at.x, at.y, at.z + 1.2), 400 * size, (1.0, 0.75, 0.3), 0.5)
    elif kind == "confetti":
        cols = ["#E53935", "#F2B705", "#3D7BE0", "#7FB86A", "#C58AF9", "#FFFFFF"]
        for k, p in enumerate(zv_view_pts(cam, 300, d0=2, d1=22, z0=0.5, z1=9, seed=61)):
            ob = box("zt_conf%d" % k, (0.18, 0.12, 0.01), tuple(p), mat("zt_conf%d" % (k % 6), zc_rgb(cols[k % 6]), 0.5), 0.0, rot=(rnd.random() * 180, rnd.random() * 180, rnd.random() * 180))
            key(ob, "location", F(t0))
            ob.location.z -= 2.0
            key(ob, "location", F(t1))
    elif kind == "lights_out":
        lights = [o for o in D.objects if o.type == "LIGHT" and o.data.type in ("POINT", "SPOT", "AREA") and o.name.startswith("zs")]
        lights.sort(key=lambda o: (o.location - Vector(cam[0] if cam else (0, 0, 0))).length)
        for k, o in enumerate(lights):
            tk = t0 + (t1 - t0) * (k + 1) / (len(lights) + 1)
            e0 = o.data.energy
            o.data.keyframe_insert("energy", frame=F(tk) - 1)
            o.data.energy = 0.0
            o.data.keyframe_insert("energy", frame=F(tk))
            o.data.energy = e0 if opt.get("phase", 1.0) < (k + 1) / (len(lights) + 1) else 0.0
        if opt.get("phase", 1.0) >= 1.0:
            for o in lights:
                o.data.energy = 0.0
        # the lit windows and lamp heads go dark too, nearest first, up to the phase (one by one over the shot)
        dark = mat("zt_darkglass", (0.04, 0.05, 0.07), 0.2)
        glows = []
        for o in D.objects:
            mn = o.active_material.name.split("_") if o.type == "MESH" and o.name.startswith("zs") and o.active_material is not None else []
            if len(mn) == 7 and mn[0] == "zs" and mn[4] != "-":
                glows.append(o)
        glows.sort(key=lambda o: (o.location - Vector(cam[0] if cam else (0, 0, 0))).length)
        cut = int(len(glows) * min(1.0, opt.get("phase", 1.0)))
        for o in glows[:cut]:
            o.data.materials.clear()
            o.data.materials.append(dark)


# ---------------------------------------------------------------- THE STUDIO TEST (a lineup of people / entities / props)
def zv_studio_test(what, t0, t1, opt=None):
    """a test still on a plain stage: what = {"people": [spec ids]} | {"entity": kind, "state", "show"} |
    {"animals": [...]} | {"props": [...]} | {"effect": kind}. The camera frames the whole lineup."""
    opt = opt or {}
    time = opt.get("time", "day")
    dark = time == "night" or what.get("show") in ("silhouette", "eyes") or what.get("state") == "eyes"
    zv_world((0.05, 0.06, 0.1) if dark else (0.62, 0.68, 0.78), 0.9)
    zv_sun((0.6, 0.7, 1.0) if dark else (1.0, 0.96, 0.9), 0.4 if dark else 3.2, 50, -30)
    box("zt_floor", (300, 300, 0.2), (0, 0, -0.1), mat("zt_floorm", zc_rgb("#7A9A6A" if not dark else "#2A3038"), 0.9), 0.0)
    box("zt_back", (120, 0.4, 60), (0, 30, 30), mat("zt_backm", zc_rgb("#A9C4D8" if not dark else "#10141C"), 0.9), 0.0)
    ZW_T["time"] = "night" if dark else "day"
    ZW_T["_std"] = True
    ZV_TIME["t"] = None
    ZV_SETLOOK.update({"exposure": 0.0})
    subs, cr = [], None
    cam_loc, cam_tgt, lens = (0, -16, 3.6), (0, 0, 2.2), 26
    if "people" in what:
        ids = what["people"]
        n = len(ids)
        for k, sid in enumerate(ids):
            x = (k - (n - 1) / 2) * 2.7
            ch = zv_person("P%d" % k, sid, (x, 0, 0), face_to=(x * 0.3, -16, 2.0), t0=t0, t1=t1)
            subs.append((sid, ch))
        cam_loc, cam_tgt, lens = (0, -5.5 - 4.2 * n, 3.4), (0, 0, 1.5), 26
    elif "animals" in what:
        for k, kind in enumerate(what["animals"]):
            ZAnimal("A%d" % k, kind, ((k - 1) * 2.4, 0, 0), rot=0)
        ch = zv_person("Kid", "me", (3.8, 0.6, 0), face_to=(0, -12, 2), t0=t0, t1=t1)
        subs.append(("me", ch))
        cam_loc, cam_tgt, lens = (1.2, -15, 2.8), (1.2, 0, 1.3), 26
    elif "entity" in what:
        e = ZEntity("Ent", what["entity"], (0, 2, 0), 0, what.get("state", "stand"), what.get("show", "full"), t0, t1)
        ch = zv_person("Kid", "me", (-4.2 if what["entity"] != "hollow" else -2.6, -1.5, 0), face_to=(0, 2, 3), t0=t0, t1=t1, face="scared")
        cr = e
        subs = []        # the kid is only there for scale (not a subject of the gate)
        cam_loc, cam_tgt, lens = ((0.4, -9.5, 2.9), (-1, 1, 2.2), 30) if what["entity"] == "hollow" else ((0, -24, 6.5), (0, 0, 6.0), 26)
    elif "props" in what:
        for k, kind in enumerate(what["props"]):
            p = zv_prop(kind, "Pr%d" % k, label=opt.get("text"))
            x = (k - (len(what["props"]) - 1) / 2) * 2.0
            p.location = (x, 0, 1.6 if kind not in ("bike", "umbrella") else 0.0)
        cam_loc, cam_tgt, lens = (0, -9, 2.4), (0, 0, 1.4), 26
    elif "hold" in what:
        ch = zv_person("Kid", "me", (0, 0, 0), face_to=(0, -10, 2), pose="hold_up", t0=t0, t1=t1)
        zv_hold(ch, zv_prop(what["hold"], "Held", label=opt.get("text")), "R")
        subs.append(("me", ch))
        cam_loc, cam_tgt, lens = (0.4, -10.5, 3.2), (0.3, 0, 2.0), 30
    if opt.get("cam"):
        cam_loc, cam_tgt, lens = opt["cam"]
    cam = Cam()
    cam.key(t0, tuple(cam_loc), tuple(cam_tgt), lens=lens)
    cam.key(t1, tuple(Vector(cam_loc) + (Vector(cam_tgt) - Vector(cam_loc)) * 0.05), tuple(cam_tgt), lens=lens)
    if "effect" in what:
        eo = dict(opt)
        if what["effect"] == "grow":        # a thing growing giant (from its size to `to` x over the shot)
            eo["object"] = zv_prop(opt.get("thing", "ball"), "Grow")
            eo["object"].location = (0, 2, 0.6)
        zv_effect(what["effect"], t0, t1, at=(0, 0, 0), size=1.5, cam=(cam_loc, cam_tgt), opt=eo)
    for _, ch in subs:
        zc_char_light(ch, tuple(cam_loc), "night" if dark else "day")
    if dark:
        light("zt_rim", "AREA", (0, 8, 10), 900, (0.6, 0.7, 1.0), 8.0, target=(0, 2, 4))
    zv_set_look()
    ZV_SHOT.clear()
    ZV_SHOT.update({"cam": "eyes" if what.get("state") == "eyes" else "studio", "subjects": subs, "creature": cr})


ZV_CHAR_EXTRA = {}
# ===== END OF THINGS ==================================================================================================
