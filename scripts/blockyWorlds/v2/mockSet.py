"""IN THIS TOWN v2, NIGHT BUILD: THE FREE MOCK RUN of set_v2.py (+ things_v2.py) without Blender.
Every kit call is a stand-in with the REAL parameter names, so a wrong name, a wrong argument or bad data fails here
for free, before a paid render.   python -I mockSet.py <head.py> <calls.py>"""
import sys, os, math, random, types
from unittest.mock import MagicMock

HERE = os.path.dirname(os.path.abspath(__file__))


class Vector:
    def __init__(self, v=(0.0, 0.0, 0.0)):
        v = list(v)
        assert len(v) == 3 and all(isinstance(a, (int, float)) for a in v), "Vector needs 3 numbers: %r" % (v,)
        self.x, self.y, self.z = float(v[0]), float(v[1]), float(v[2])
    def __iter__(self):
        return iter((self.x, self.y, self.z))
    def __getitem__(self, i):
        return (self.x, self.y, self.z)[i]
    def __len__(self):
        return 3
    def __add__(self, o):
        return Vector((self.x + o[0], self.y + o[1], self.z + o[2]))
    def __sub__(self, o):
        return Vector((self.x - o[0], self.y - o[1], self.z - o[2]))
    def __mul__(self, k):
        return Vector((self.x * k, self.y * k, self.z * k))
    __rmul__ = __mul__
    @property
    def length(self):
        return math.sqrt(self.x ** 2 + self.y ** 2 + self.z ** 2)
    def normalized(self):
        l = self.length or 1.0
        return Vector((self.x / l, self.y / l, self.z / l))
    def copy(self):
        return Vector((self.x, self.y, self.z))


COUNT = {"objects": 0}
COLL = MagicMock()


class Obj:
    def __init__(self, name, loc=(0, 0, 0)):
        assert isinstance(name, str) and name, "object name must be a string"
        self.name = name
        self.location = Vector(loc)
        self.rotation_euler = Vector((0, 0, 0))
        self.scale = (1, 1, 1)
        self.parent = None
        self.data = MagicMock()
        self.users_collection = [COLL]
        self.matrix_parent_inverse = MagicMock()
        self.animation_data = MagicMock()
        self.hide_render = False
        COUNT["objects"] += 1
    @property
    def children(self):
        return []
    def copy(self):
        return Obj(self.name + ".c", tuple(self.location))


def _num3(v, what):
    v = tuple(v)
    assert len(v) == 3 and all(isinstance(a, (int, float)) for a in v), "%s must be 3 numbers: %r" % (what, v)
    return v


def F(t):
    return int(round(float(t) * 30))


def mat(name, color=(0.8, 0.8, 0.8), rough=0.45, metal=0.0, emit=None, estr=0.0, alpha=1.0, coat=0.0, spec=0.5):
    assert isinstance(name, str)
    _num3(color, "colour of " + name)
    if emit is not None:
        _num3(emit, "emit of " + name)
    return name


def box(name, size, loc=(0, 0, 0), m=None, bev=0.06, rot=(0, 0, 0), parent=None, coll=None, seg=3, cuts_z=None, mats=None):
    _num3(size, "size of " + name); _num3(loc, "loc of " + name); _num3(rot, "rot of " + name)
    assert all(s > 0 for s in size), "box %s has a zero or negative size %r" % (name, size)
    return Obj(name, loc)


def cyl(name, r, h, loc=(0, 0, 0), m=None, verts=32, bev=0.0, rot=(0, 0, 0), parent=None, coll=None, r2=None, seg=3):
    assert r > 0 and h > 0, "cyl %s r/h" % name
    _num3(loc, "loc of " + name); _num3(rot, "rot of " + name)
    assert isinstance(verts, int) and verts >= 3
    return Obj(name, loc)


def sphere(name, r, loc=(0, 0, 0), m=None, scale=(1, 1, 1), parent=None, coll=None, seg=24, rot=(0, 0, 0)):
    assert r > 0
    _num3(loc, "loc of " + name); _num3(scale, "scale of " + name)
    return Obj(name, loc)


def text(name, body, loc, size=1.0, m=None, rot=(90, 0, 0), extrude=0.0, coll=None, font=None, align="CENTER", parent=None):
    assert isinstance(body, str) and body, "text %s is empty" % name
    _num3(loc, "loc of " + name)
    return Obj(name, loc)


def light(name, kind="AREA", loc=(0, 0, 5), energy=500, color=(1, 1, 1), size=2.0, rot=(0, 0, 0), target=None, coll=None, shadow=True, spot=45, blend=0.3, size_y=None):
    assert kind in ("AREA", "POINT", "SPOT", "SUN")
    _num3(loc, "loc of " + name); _num3(color, "colour of " + name)
    if target is not None:
        _num3(target, "target of " + name)
    return Obj(name, loc)


def empty(name, loc=(0, 0, 0), parent=None, coll=None, rot=(0, 0, 0), size=0.3):
    _num3(loc, "loc of " + name)
    return Obj(name, loc)


def key(ob, path, frame, value=None, interp="BEZIER", index=-1):
    assert hasattr(ob, path.split(".")[0]) or path in ("energy",), "key: %s has no %s" % (getattr(ob, "name", ob), path)


class Cam:
    def __init__(self, name="Cam", lens=35, coll=None):
        pass
    def key(self, t, loc, target, lens=None, roll=0.0, focus=None, fstop=None, interp="BEZIER", ease=None):
        _num3(loc, "camera loc"); _num3(target, "camera target")


def zc_rgb(h):
    assert isinstance(h, str) and len(h) == 7 and h[0] == "#", "bad colour %r" % (h,)
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (1, 3, 5))


ZC_POSES = {k: {} for k in ["stand", "walk", "run", "sit", "crouch", "crouch2", "hold_up2", "talk", "lean", "reach", "peek", "hug", "shield", "tilt", "point", "hold_up", "look_back", "hold_phone", "hold_stick", "hold_box"]}
ZC_SPECS = {}


class ZChar:
    def __init__(self, name, spec, loc=(0, 0, 0), rot=0.0, badge=True):
        assert isinstance(spec, dict) and "colors" in spec, "ZChar %s: no spec" % name
        _num3(loc, "loc of " + name)
        self.name, self.spec = name, spec
        self.root = Obj(name + "_root", loc)
        self.k = 1.0
        self.head, self.torso, self.neck = Obj(name + '_head'), Obj(name + '_torso'), Obj(name + '_neck')
        self.hdim = (2.0, 1.9, 1.8)
        self.thigh = {'L': Obj(name + '_tl'), 'R': Obj(name + '_tr')}
        self.shoulder = {'L': Obj(name + '_sl'), 'R': Obj(name + '_sr')}
        self.elbow = {'L': Obj(name + '_el'), 'R': Obj(name + '_er')}
        self.M = {'skin': 'skin'}
    def pose(self, t, name):
        assert name in ZC_POSES, "unknown pose %s" % name
    def express(self, t, face):
        assert isinstance(face, str)
    def face_to(self, p):
        _num3(p, "face_to")
    def turn(self, t, p, cam):
        _num3(p, "turn")
    def hold(self, t, prop, hands="R"):
        assert prop is not None, "hold: no prop"


def zc_mat(n, key, hexcol, rough=0.6, emit=None, estr=0.0, coat=0.0, spec=0.4):
    zc_rgb(hexcol)
    return n + key


class ZCritter:
    def __init__(self, name, spec, loc=(0, 0, 0), rot=0.0):
        self.name, self.root = name, Obj(name + "_root", loc)
    def express(self, t, name):
        pass


def zc_prop(kind, name, on=True):
    return Obj(name) if kind in ("phone", "spoon", "stick", "bucket", "flashlight", "drain", "box") else None


g = {"__name__": "mock", "math": math, "random": random, "Vector": Vector, "MagicMock": MagicMock}
for k, v in list(globals().items()):
    if k in ("mat", "box", "cyl", "sphere", "text", "light", "empty", "key", "Cam", "F", "zc_rgb", "ZC_POSES", "ZC_SPECS", "ZChar", "zc_prop", "zc_mat", "ZCritter"):
        g[k] = v
bpy = MagicMock()
g.update({"bpy": bpy, "D": MagicMock(), "ZW_T": {}, "ZV_TIME": {"t": None}, "ZV_SHOT": {}, "ZV_STAGES": {}, "zw_look_apply": lambda: None,
          "zv_build": lambda sid, time, t0, t1: {}, "zc_blinks": lambda ch, t0, t1, every=2.6: None, "zc_idle": lambda ch, t0, t1, amp=1.0: None,
          "zc_char_light": lambda ch, cam_loc, time="day": None, "zc_walk": lambda ch, t0, t1, run=False, back=1.6: None,
          "zc_look": lambda ch, t, pt, max_head=35.0: None, "zc_react": lambda ch, t0, face, default="neutral", delay=0.27: None})
class NL(list):
    def new(self, t):
        return MagicMock()
bpy.context.scene.world.node_tree.nodes = NL([MagicMock(type="BACKGROUND"), MagicMock(type="OUTPUT_WORLD")])
bpy.context.scene.ray_cast.return_value = (True, Vector((0, 0, 0.2)), None, 0, None, None)
srcs = ["set_v2.py"] + (["things_v2.py"] if os.path.exists(os.path.join(HERE, "things_v2.py")) else [])
for f in srcs:
    exec(compile(open(os.path.join(HERE, f), encoding="utf8").read(), f, "exec"), g)
exec(compile(open(sys.argv[1], encoding="utf8").read(), "head", "exec"), g)
n = 0
for block in open(sys.argv[2], encoding="utf8").read().split("t0, t1 = 1.0, 2.0\n")[1:]:
    exec(compile("t0, t1 = 1.0, 2.0\n" + block, "call%d" % n, "exec"), g)
    n += 1
print("mock: %d stills built, %d objects in all" % (n, COUNT["objects"]))
