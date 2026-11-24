# ===== IN THIS TOWN v2: THE CHARACTER BASE (scripts/blockyWorlds/v2/char_v2.py) =====================================
# One base for everyone: the same body build, face system and finish; a SPEC (data) picks proportions, hair, outfit and
# colours. "Me" (the narrator, our main character) and the adults are specs on this base. Pasted after stage_v2.py.
# Local frame: feet at z=0, the character faces -Y (a kit character at rot a faces (sin a, -cos a)); the root is scaled
# to the spec's height in world units. Every material name carries the character's name (no shared state: one
# character's face / eyes / glow can never show on another). Pivots: root > hip > torso > neck > head; torso > shoulders
# > elbows > hands; hip > thighs > knees. The checks (zv_gate) see it through .name / .root / .head like a kit Char.

ZC_SPECS = {}     # filled by the runner from characters.mjs
ZC_BADGE = {}     # the badge image (built once per shot from ZV_BADGE_HEX)


def zc_link(ob, coll):
    (coll if coll is not None else bpy.context.scene.collection).objects.link(ob)


def zc_rgb(h):
    h = h.lstrip("#")
    return tuple(((int(h[i:i + 2], 16) / 255.0) ** 2.2) for i in (0, 2, 4))


ZC_BLACK = {"on": False}


def zc_mat(n, key, hexcol, rough=0.6, emit=None, estr=0.0, coat=0.0, spec=0.4):
    if ZC_BLACK["on"] and not emit:   # the Shadow: pure black in every light (no colour, no shine)
        return mat("%s_%s" % (n, key), (0.0, 0.0, 0.0), rough=1.0, spec=0.0)
    return mat("%s_%s" % (n, key), zc_rgb(hexcol), rough=rough, emit=zc_rgb(emit) if emit else None, estr=estr, coat=coat, spec=spec)


def zc_fabric(m, scale=90.0, strength=0.18, rib=False):
    """a soft knit / cotton surface: fine noise (and ribs for cuffs) into the normal"""
    if m.get("zc_fab"):
        return m
    nt = m.node_tree
    b = next(x for x in nt.nodes if x.type == "BSDF_PRINCIPLED")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = scale
    nz.inputs["Detail"].default_value = 6.0
    bp = nt.nodes.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = strength
    bp.inputs["Distance"].default_value = 0.02
    nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
    if rib:
        wv = nt.nodes.new("ShaderNodeTexWave")
        wv.inputs["Scale"].default_value = 18.0
        wv.wave_type = "BANDS"
        wv.bands_direction = "X"
        nt.links.new(tc.outputs["Object"], wv.inputs["Vector"])
        mx = nt.nodes.new("ShaderNodeMath")
        mx.operation = "ADD"
        nt.links.new(nz.outputs["Fac"], mx.inputs[0])
        nt.links.new(wv.outputs["Fac"], mx.inputs[1])
        nt.links.new(mx.outputs[0], bp.inputs["Height"])
    else:
        nt.links.new(nz.outputs["Fac"], bp.inputs["Height"])
    nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
    m["zc_fab"] = 1
    return m


def zc_hair_mat(n, base, light, z0, z1, ref=None):
    """hair with a lighter highlight band toward the top (object-space height ramp) and a soft sheen"""
    m = zc_mat(n, "hair", base, rough=0.42, spec=0.6, coat=0.25)
    if m.get("zc_hair"):
        return m
    nt = m.node_tree
    b = next(x for x in nt.nodes if x.type == "BSDF_PRINCIPLED")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sp = nt.nodes.new("ShaderNodeSeparateXYZ")
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = z0
    mr.inputs["From Max"].default_value = z1
    cr = nt.nodes.new("ShaderNodeValToRGB")
    cr.color_ramp.elements[0].color = (*zc_rgb(base), 1)
    cr.color_ramp.elements[1].color = (*zc_rgb(light), 1)
    cr.color_ramp.elements[0].position = 0.45
    if ref is not None:
        tc.object = ref
    nt.links.new(tc.outputs["Object"], sp.inputs[0])
    nt.links.new(sp.outputs["Z"], mr.inputs["Value"])
    nt.links.new(mr.outputs["Result"], cr.inputs["Fac"])
    nt.links.new(cr.outputs["Color"], b.inputs["Base Color"])
    m["zc_hair"] = 1
    return m


def zc_meta(n, parent, elems, m, coll):
    """sculpted volume (hair, mustache) from metaball ellipsoids; the family name is unique per character"""
    mb = D.metaballs.new(n)
    mb.resolution = 0.05
    mb.render_resolution = 0.035
    mb.threshold = 0.6
    ob = D.objects.new(n, mb)
    zc_link(ob, coll)
    ob.parent = parent
    for (co, size, rz) in elems:
        e = mb.elements.new(type="ELLIPSOID")
        e.co = co
        e.radius = 1.0
        e.size_x, e.size_y, e.size_z = size
        e.stiffness = 2.0
        if rz:
            e.rotation = Euler((math.radians(rz[0]), math.radians(rz[1]), math.radians(rz[2]))).to_quaternion()
    mb.materials.append(m)
    return ob


def zc_arc(n, pts, r, m, parent, coll):
    """a round tube along points in the face plane (mouth lines): pts = [(x, z)], at the face's front"""
    cu = D.curves.new(n, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = r
    cu.bevel_resolution = 3
    sp = cu.splines.new("NURBS")
    sp.points.add(len(pts) - 1)
    for i, (x, z) in enumerate(pts):
        sp.points[i].co = (x, 0.0, z, 1.0)
    sp.use_endpoint_u = True
    sp.order_u = min(3, len(pts))
    ob = D.objects.new(n, cu)
    zc_link(ob, coll)
    ob.parent = parent
    cu.materials.append(m)
    return ob


def zc_ellipse(n, rx, rz, cz, m, parent, coll, top_flat=False, bottom_flat=False, depth=0.05, y=-0.93, x=0.0):
    """a flat shape in the face plane (open mouths): an ellipse, or a half-ellipse (D shape)"""
    pts = []
    for k in range(24):
        a = 2 * math.pi * k / 24
        px, pz = rx * math.cos(a), rz * math.sin(a)
        if top_flat and pz > 0:
            pz = 0.0
        if bottom_flat and pz < 0:
            pz = 0.0
        pts.append((px, pz))
    clean = [pts[0]]
    for p in pts[1:]:
        if abs(p[0] - clean[-1][0]) > 1e-4 or abs(p[1] - clean[-1][1]) > 1e-4:
            clean.append(p)
    return poly_extrude(n, clean, depth, (x, y, cz), m, rot=(90, 0, 0), parent=parent, coll=coll, bev=0.01)


class ZChar:
    def __init__(self, name, spec, loc=(0, 0, 0), rot=0.0, badge=True):
        self.name, self.spec = name, spec
        n, S = name, spec
        self.coll = collection(n)
        self.mode = S.get("mode", "normal")      # normal / shadow / mimic
        ZC_BLACK["on"] = self.mode == "shadow"
        c = S["colors"]
        P = S["body"]
        self.root = empty(n + "_root", loc, None, self.coll, (0, 0, rot))
        # ---- materials (all named per character)
        skin = zc_mat(n, "skin", c["skin"], rough=0.55, spec=0.35)
        skin2 = zc_mat(n, "skin2", c.get("skin_dark", c["skin"]), rough=0.6)
        top = zc_fabric(zc_mat(n, "top", c["top"], rough=0.85, spec=0.2))
        top2 = zc_fabric(zc_mat(n, "top2", c["top_dark"], rough=0.9, spec=0.15), rib=True)
        trim = zc_mat(n, "trim", c["trim"], rough=0.6)
        legs = zc_fabric(zc_mat(n, "legs", c["legs"], rough=0.85, spec=0.2), scale=120, strength=0.12)
        legs2 = zc_mat(n, "legs2", c["legs_dark"], rough=0.85)
        shoe = zc_mat(n, "shoe", c["shoe"], rough=0.5, spec=0.5)
        sole = zc_mat(n, "sole", c["sole"], rough=0.6)
        self.M = dict(skin=skin, skin2=skin2, top=top, top2=top2, trim=trim, legs=legs, legs2=legs2, shoe=shoe, sole=sole)
        # ---- proportions (local units)
        th, sh, shoe_h = P["thigh"], P["shin"], 0.42
        hip_z = th + sh + shoe_h + 0.1
        tw, td, tl = P["torso_w"], P["torso_d"], P["torso_h"]
        hs = P["head"]
        self.hip = empty(n + "_hip", (0, 0, hip_z), self.root, self.coll)
        # ---- legs: thigh > knee > shin + rolled hem + seam + shoe with sole and laces
        self.thigh, self.knee = {}, {}
        for s, side in ((1, "L"), (-1, "R")):
            x = s * (tw / 2 - 0.47)
            tp = empty("%s_thigh%s" % (n, side), (x, 0, 0), self.hip, self.coll)
            box("%s_thighm%s" % (n, side), (0.86, 0.9, th + 0.05), (0, 0, -th / 2), legs, 0.1, parent=tp, coll=self.coll)
            box("%s_seamt%s" % (n, side), (0.03, 0.5, th), (s * 0.44, 0, -th / 2), legs2, 0.0, parent=tp, coll=self.coll)
            kp = empty("%s_knee%s" % (n, side), (0, 0, -th), tp, self.coll)
            box("%s_shin%s" % (n, side), (0.84, 0.88, sh), (0, 0, -sh / 2 + 0.03), legs, 0.1, parent=kp, coll=self.coll)
            box("%s_seams%s" % (n, side), (0.03, 0.5, sh - 0.2), (s * 0.43, 0, -sh / 2), legs2, 0.0, parent=kp, coll=self.coll)
            box("%s_hem%s" % (n, side), (0.92, 0.96, 0.16), (0, 0, -sh + 0.08), legs2, 0.06, parent=kp, coll=self.coll)
            box("%s_shoe%s" % (n, side), (0.92, 1.22, shoe_h), (0, -0.16, -sh - shoe_h / 2), shoe, 0.16, parent=kp, coll=self.coll)
            box("%s_toe%s" % (n, side), (0.94, 0.42, 0.24), (0, -0.62, -sh - shoe_h + 0.12), sole, 0.1, parent=kp, coll=self.coll)
            box("%s_sole%s" % (n, side), (0.96, 1.28, 0.1), (0, -0.16, -sh - shoe_h - 0.05), sole, 0.04, parent=kp, coll=self.coll)
            for k in range(2):
                box("%s_lace%s%d" % (n, side, k), (0.5, 0.06, 0.05), (0, -0.25 - k * 0.2, -sh - 0.02 + k * -0.04), sole, 0.02, parent=kp, coll=self.coll, rot=(20, 0, 0))
            self.thigh[side], self.knee[side] = tp, kp
        # ---- torso
        self.torso = empty(n + "_torso", (0, 0, 0), self.hip, self.coll)
        box(n + "_body", (tw, td, tl), (0, 0, tl / 2 + 0.05), top, 0.2, parent=self.torso, coll=self.coll)
        box(n + "_hemband", (tw + 0.06, td + 0.06, 0.24), (0, 0, 0.14), top2, 0.08, parent=self.torso, coll=self.coll)
        box(n + "_backseam", (0.03, 0.02, tl - 0.3), (0, td / 2 + 0.005, tl / 2 + 0.1), top2, 0.0, parent=self.torso, coll=self.coll)
        self._outfit(S["outfit"], tw, td, tl)
        # ---- the ZYVO BADGE (a separate switchable layer): a small round patch with the icon, on his left chest
        self.badge = empty(n + "_badge", (tw * 0.26, -td / 2 - 0.035, tl - 0.62), self.torso, self.coll)
        if S.get("badge_ok", True):
            cyl(n + "_badgedisc", 0.19, 0.04, (0, 0, 0), zc_mat(n, "badgebg", "#FFFFFF", rough=0.45), 32, bev=0.012, rot=(90, 0, 0), parent=self.badge, coll=self.coll)
            img = zc_badge_image()
            if img is not None:
                bm = D.materials.new(n + "_badgeimg")
                bm.use_nodes = True
                nt = bm.node_tree
                bs = next(x for x in nt.nodes if x.type == "BSDF_PRINCIPLED")
                ti = nt.nodes.new("ShaderNodeTexImage")
                ti.image = img
                ti.interpolation = "Cubic"
                nt.links.new(ti.outputs["Color"], bs.inputs["Base Color"])
                nt.links.new(ti.outputs["Alpha"], bs.inputs["Alpha"])
                bs.inputs["Roughness"].default_value = 0.4
                tc = nt.nodes.new("ShaderNodeTexCoord")
                sx = nt.nodes.new("ShaderNodeSeparateXYZ")
                cx = nt.nodes.new("ShaderNodeCombineXYZ")
                nt.links.new(tc.outputs["Generated"], sx.inputs[0])
                nt.links.new(sx.outputs["X"], cx.inputs["X"])
                nt.links.new(sx.outputs["Z"], cx.inputs["Y"])
                nt.links.new(cx.outputs[0], ti.inputs["Vector"])
                try:
                    bm.surface_render_method = "BLENDED"
                except Exception:
                    pass
                box(n + "_badgelogo", (0.3, 0.012, 0.3), (0, -0.026, 0), bm, 0.0, parent=self.badge, coll=self.coll)
        self.set_badge(0.0, badge)
        # ---- arms: shoulder > upper sleeve > elbow > forearm + ribbed cuff + hand (+ a hold point)
        self.shoulder, self.elbow, self.hand = {}, {}, {}
        ua, fa = P["upper_arm"], P["fore_arm"]
        for s, side in ((1, "L"), (-1, "R")):
            sp = empty("%s_shoulder%s" % (n, side), (s * (tw / 2 + 0.41), 0, tl - 0.22), self.torso, self.coll)
            box("%s_upper%s" % (n, side), (0.8, 0.86, ua + 0.2), (0, 0, -ua / 2 + 0.1), top, 0.2, parent=sp, coll=self.coll)
            ep = empty("%s_elbow%s" % (n, side), (0, 0, -ua), sp, self.coll)
            slv = S.get("sleeves", "long")
            box("%s_fore%s" % (n, side), (0.78, 0.84, fa), (0, 0, -fa / 2 + 0.04), top if slv == "long" else skin, 0.14, parent=ep, coll=self.coll)
            if slv == "long":
                box("%s_cuff%s" % (n, side), (0.84, 0.9, 0.24), (0, 0, -fa + 0.1), top2, 0.06, parent=ep, coll=self.coll)
            elif slv == "rolled":   # rolled up above the elbow: a fat folded band
                box("%s_roll%s" % (n, side), (0.88, 0.94, 0.3), (0, 0, 0.06), top2, 0.1, parent=ep, coll=self.coll)
            box("%s_hand%s" % (n, side), (0.62, 0.66, 0.52), (0, 0, -fa - 0.22), skin, 0.2, parent=ep, coll=self.coll)
            box("%s_thumb%s" % (n, side), (0.2, 0.26, 0.3), (-s * 0.31, -0.12, -fa - 0.16), skin, 0.08, parent=ep, coll=self.coll)
            self.hand[side] = empty("%s_hold%s" % (n, side), (0, -0.05, -fa - 0.3), ep, self.coll)
            self.shoulder[side], self.elbow[side] = sp, ep
        # ---- neck + head (a soft rounded block) + ears + nose
        self.neck = empty(n + "_neck", (0, 0, tl + 0.12), self.torso, self.coll)
        cyl(n + "_neckm", 0.3, 0.3, (0, 0, 0.1), skin, 20, parent=self.neck, coll=self.coll)
        hsh = S.get("head_shape", (1.0, 1.0, 1.0))
        hw, hd, hh = 1.9 * hs * hsh[0], 1.8 * hs * hsh[1], 1.75 * hs * hsh[2]
        self.hdim = (hw, hd, hh)
        self.head = box(n + "_head", (hw, hd, hh), (0, 0, 0.1 + hh / 2), skin, 0.34 * hs, parent=self.neck, coll=self.coll, seg=6)
        if self.mode != "shadow":
            for s in (-1, 1):   # the ear: in front of the hair wrap, standing out (it reads in a side view)
                sphere("%s_ear%d" % (n, s), 0.22 * hs, (s * (hw / 2 + 0.05 * hs), -0.12 * hs, -0.04 * hs), skin, (0.5, 0.85, 1.15), parent=self.head, coll=self.coll, seg=18)
                sphere("%s_earin%d" % (n, s), 0.12 * hs, (s * (hw / 2 + 0.1 * hs), -0.12 * hs, -0.04 * hs), skin2, (0.3, 0.6, 0.8), parent=self.head, coll=self.coll, seg=12)
            sphere(n + "_nose", 0.11 * hs, (0, -hd / 2 - 0.03, -0.12 * hs), skin2, (1.1, 1.25, 0.95), parent=self.head, coll=self.coll, seg=16)
        self._face(hs, hw, hd, hh)
        self._hair(hs, hw, hd, hh)
        # ---- the whole body to the spec's height (world units)
        self.local_h = hip_z + 0.05 + tl + 0.12 + 0.1 + hh + S.get("hair_top", 0.3) * hs
        k = S["height"] / self.local_h
        self.root.scale = (k, k, k)
        self.k = k
        self.expr = "neutral"
        self.pose(0, "stand")
        self.express(0, {"shadow": "shadow_stare", "mimic": "mimic_smile"}.get(self.mode, "neutral"))
        ZC_BLACK["on"] = False
        CHARS_V2[name] = self

    # ------------------------------------------------------------------ THE OUTFITS
    def _outfit(self, kind, tw, td, tl):
        n, C, M, T = self.name, self.coll, self.M, self.torso
        c = self.spec["colors"]
        acc = zc_mat(n, "accent", c.get("accent", c["top_dark"]), rough=0.5, spec=0.5)
        gold = zc_mat(n, "gold", "#E8B83A", rough=0.25, spec=0.9, coat=0.4)
        if kind == "hoodie":
            box(n + "_pocket", (tw * 0.64, 0.07, 0.58), (0, -td / 2 - 0.02, 0.62), M["top2"], 0.05, parent=T, coll=C)
            box(n + "_pocketline", (tw * 0.6, 0.02, 0.03), (0, -td / 2 - 0.06, 0.9), M["trim"], 0.0, parent=T, coll=C)
            box(n + "_hood", (tw * 0.78, 0.5, 0.6), (0, td / 2 + 0.12, tl - 0.05), M["top"], 0.24, parent=T, coll=C)
            box(n + "_hoodrim", (tw * 0.82, 0.22, 0.2), (0, td / 2 - 0.02, tl + 0.18), M["top2"], 0.08, parent=T, coll=C)
            cyl(n + "_collar", 0.56, 0.2, (0, 0, tl + 0.12), M["top2"], 28, bev=0.06, parent=T, coll=C)
            for sx in (-1, 1):
                cyl("%s_string%d" % (n, sx), 0.035, 0.62, (sx * 0.22, -td / 2 - 0.05, tl - 0.3), M["trim"], 8, parent=T, coll=C)
                cyl("%s_aglet%d" % (n, sx), 0.052, 0.12, (sx * 0.22, -td / 2 - 0.05, tl - 0.66), zc_mat(n, "aglet", "#C9CED6", rough=0.3, spec=0.8), 8, parent=T, coll=C)
        elif kind == "shirt":   # collar points, a button line, a chest pocket
            for sx in (-1, 1):
                box("%s_collar%d" % (n, sx), (0.44, 0.1, 0.32), (sx * 0.25, -td / 2 - 0.03, tl - 0.08), M["top2"], 0.04, rot=(0, sx * 28, 0), parent=T, coll=C)
            box(n + "_placket", (0.18, 0.05, tl - 0.4), (0, -td / 2 - 0.01, tl / 2 - 0.05), M["top2"], 0.01, parent=T, coll=C)
            for k in range(4):
                cyl("%s_button%d" % (n, k), 0.06, 0.05, (0, -td / 2 - 0.045, tl - 0.45 - k * 0.42), M["trim"], 12, rot=(90, 0, 0), parent=T, coll=C)
            box(n + "_chestpk", (0.5, 0.05, 0.46), (-tw * 0.26, -td / 2 - 0.02, tl - 0.75), M["top2"], 0.03, parent=T, coll=C)
            box(n + "_belt", (tw + 0.08, td + 0.08, 0.2), (0, 0, 0.16), zc_mat(n, "belt", "#3A2A20", rough=0.5), 0.05, parent=T, coll=C)
            box(n + "_buckle", (0.3, 0.06, 0.18), (0, -td / 2 - 0.06, 0.16), gold, 0.03, parent=T, coll=C)
            cyl(n + "_collar", 0.5, 0.16, (0, 0, tl + 0.1), M["top2"], 28, bev=0.04, parent=T, coll=C)
        elif kind == "dungarees":  # a tee under a bib and straps (the dungaree colour is the legs' colour)
            dm = M["legs"]
            box(n + "_lower", (tw + 0.04, td + 0.04, tl * 0.42), (0, 0, tl * 0.21 + 0.05), dm, 0.16, parent=T, coll=C)
            box(n + "_bib", (tw * 0.62, 0.1, tl * 0.5), (0, -td / 2 - 0.02, tl * 0.55), dm, 0.06, parent=T, coll=C)
            box(n + "_bibpk", (tw * 0.34, 0.05, tl * 0.2), (0, -td / 2 - 0.08, tl * 0.56), M["legs2"], 0.03, parent=T, coll=C)
            box(n + "_backbib", (tw * 0.5, 0.08, tl * 0.4), (0, td / 2 + 0.02, tl * 0.5), dm, 0.05, parent=T, coll=C)
            for sx in (-1, 1):
                box("%s_strap%d" % (n, sx), (0.2, td + 0.14, 0.12), (sx * tw * 0.26, 0, tl - 0.02), dm, 0.03, parent=T, coll=C)
                box("%s_strapf%d" % (n, sx), (0.2, 0.08, tl * 0.32), (sx * tw * 0.26, -td / 2 - 0.03, tl * 0.84), dm, 0.03, parent=T, coll=C)
                cyl("%s_bbtn%d" % (n, sx), 0.08, 0.05, (sx * tw * 0.26, -td / 2 - 0.08, tl * 0.76), gold, 14, rot=(90, 0, 0), parent=T, coll=C)
            cyl(n + "_collar", 0.5, 0.14, (0, 0, tl + 0.1), M["top2"], 28, bev=0.04, parent=T, coll=C)
        elif kind == "cardigan":   # a cardigan open over a blouse: edges, buttons, two pockets, a blouse collar
            bl = zc_mat(n, "blouse", c.get("under", "#FFFFFF"), rough=0.7)
            box(n + "_blouse", (tw * 0.3, 0.06, tl * 0.82), (0, -td / 2 - 0.0, tl * 0.56), bl, 0.03, parent=T, coll=C)
            for sx in (-1, 1):
                box("%s_cedge%d" % (n, sx), (0.12, 0.08, tl * 0.92), (sx * tw * 0.17, -td / 2 - 0.03, tl * 0.5), M["top2"], 0.03, parent=T, coll=C)
                box("%s_cpk%d" % (n, sx), (tw * 0.24, 0.06, tl * 0.2), (sx * tw * 0.3, -td / 2 - 0.02, tl * 0.25), M["top2"], 0.03, parent=T, coll=C)
                box("%s_bcol%d" % (n, sx), (0.3, 0.08, 0.2), (sx * 0.16, -td / 2 - 0.04, tl - 0.04), bl, 0.03, rot=(0, sx * 30, 0), parent=T, coll=C)
            for k in range(4):
                cyl("%s_cbtn%d" % (n, k), 0.06, 0.05, (tw * 0.17, -td / 2 - 0.08, tl * 0.82 - k * tl * 0.2), M["trim"], 12, rot=(90, 0, 0), parent=T, coll=C)
            cyl(n + "_collar", 0.52, 0.16, (0, 0, tl + 0.1), M["top2"], 28, bev=0.05, parent=T, coll=C)
        elif kind == "suit":       # a jacket with lapels, a shirt + tie, buttons, a sash with a gold medal
            sh = zc_mat(n, "shirtw", c.get("under", "#F4F4F0"), rough=0.6)
            box(n + "_shirtv", (tw * 0.3, 0.06, tl * 0.5), (0, -td / 2 - 0.0, tl * 0.74), sh, 0.02, parent=T, coll=C)
            box(n + "_tie", (0.16, 0.06, tl * 0.42), (0, -td / 2 - 0.04, tl * 0.72), acc, 0.03, parent=T, coll=C)
            for sx in (-1, 1):
                box("%s_lapel%d" % (n, sx), (0.26, 0.08, tl * 0.5), (sx * tw * 0.17, -td / 2 - 0.04, tl * 0.72), M["top2"], 0.03, rot=(0, -sx * 14, 0), parent=T, coll=C)
            for k in range(2):
                cyl("%s_jbtn%d" % (n, k), 0.07, 0.05, (tw * 0.04, -td / 2 - 0.06, tl * 0.38 - k * tl * 0.18), M["trim"], 12, rot=(90, 0, 0), parent=T, coll=C)
            # the sash: from the right shoulder across to the left hip, front and back
            sash = zc_mat(n, "sash", c.get("sash", "#C8283C"), rough=0.45, spec=0.5)
            for sy, nm in ((-1, "f"), (1, "b")):
                box("%s_sash%s" % (n, nm), (0.36, 0.08, tl * 1.12), (0, sy * (td / 2 + 0.06), tl * 0.5), sash, 0.03, rot=(0, -sy * 36, 0), parent=T, coll=C)
            cyl(n + "_medal", 0.18, 0.06, (-tw * 0.16, -td / 2 - 0.12, tl * 0.38), gold, 24, rot=(90, 0, 0), parent=T, coll=C)
            cyl(n + "_collar", 0.52, 0.16, (0, 0, tl + 0.1), sh, 28, bev=0.04, parent=T, coll=C)
        elif kind == "plain":
            cyl(n + "_collar", 0.45, 0.12, (0, 0, tl + 0.08), M["top"], 24, parent=T, coll=C)

    # ------------------------------------------------------------------ THE FACE
    def _face(self, hs, hw, hd, hh):
        n, H, C = self.name, self.head, self.coll
        c = self.spec["colors"]
        fy = -hd / 2
        eye_m = zc_mat(n, "eye", c.get("eyes", "#1B1410"), rough=0.12, spec=0.9, coat=0.6) if self.mode != "shadow" else zc_mat(n, "eyeglow", "#FFF4B8", rough=0.3, emit="#FFF0A0", estr=14.0)
        glint = zc_mat(n, "glint", "#FFFFFF", rough=0.2, emit="#FFFFFF", estr=4.0)
        brow_m = zc_mat(n, "brow", c.get("brows", c["hair"]), rough=0.6)
        lid_m = zc_mat(n, "lid", c.get("skin_dark", c["skin"]), rough=0.6)
        mouth_m = zc_mat(n, "mouth", "#5A1E24", rough=0.5)
        line_m = zc_mat(n, "mline", "#3A1A16", rough=0.5)
        teeth_m = zc_mat(n, "teeth", "#FFF8EE", rough=0.35)
        tongue_m = zc_mat(n, "tongue", "#E46A78", rough=0.5)
        blush_m = zc_mat(n, "blush", "#F59A9A", rough=0.7)
        tear_m = zc_mat(n, "tear", "#9ED8FF", rough=0.05, spec=1.0, coat=1.0, emit="#7CC8FF", estr=0.6)
        ex, ez, er = 0.38 * hs, 0.06 * hs, 0.2 * hs
        self.F = {"eyes": {}, "lid": {}, "low": {}, "brow": {}, "mouth": {}, "eye0": {}}
        for s, side in ((1, "L"), (-1, "R")):
            ep = empty("%s_eyep%s" % (n, side), (s * ex, fy, ez), H, C)
            sphere("%s_eye%s" % (n, side), er, (0, 0.0, 0), eye_m, (1.0, 0.95, 1.28), parent=ep, coll=C, seg=24)
            if self.mode != "shadow":
                sphere("%s_glint%s" % (n, side), 0.055 * hs, (-0.06 * hs, -0.17 * hs, 0.1 * hs), glint, parent=ep, coll=C, seg=12)
                sphere("%s_glint2%s" % (n, side), 0.025 * hs, (0.05 * hs, -0.17 * hs, -0.06 * hs), glint, parent=ep, coll=C, seg=8)
            self.F["eyes"][side], self.F["eye0"][side] = ep, (s * ex, fy, ez)
            # upper lid: pivot at the eye's top edge, a lid that grows down over the eye (scale z = how closed)
            lp = empty("%s_lidp%s" % (n, side), (s * ex, fy - 0.07 * hs, ez + er * 1.28), H, C)
            sphere("%s_lid%s" % (n, side), er * 1.12, (0, 0.0, -er * 1.28), zc_mat(n, "lidskin", c["skin"], rough=0.55), (1.08, 1.02, 1.32), parent=lp, coll=C, seg=24)
            self.F["lid"][side] = lp
            # lower lid: a curved cheek that rises (the smiling eye)
            lo = empty("%s_lowp%s" % (n, side), (s * ex, fy - 0.04, ez - er * 1.28), H, C)
            sphere("%s_low%s" % (n, side), er * 1.1, (0, 0, -er * 1.05), zc_mat(n, "cheek", c["skin"], rough=0.55), (1.1, 0.22, 0.8), parent=lo, coll=C, seg=20)
            self.F["low"][side] = lo
            bp = empty("%s_browp%s" % (n, side), (s * ex, fy - 0.07 * hs, ez + 0.4 * hs), H, C)
            box("%s_brow%s" % (n, side), (0.4 * hs, 0.26 * hs, 0.11 * hs), (0, -0.03 * hs, 0), brow_m, 0.04, parent=bp, coll=C)
            self.F["brow"][side] = bp
            sphere("%s_blush%d" % (n, s), 0.13 * hs, (s * 0.62 * hs, fy - 0.005, -0.2 * hs), blush_m, (1.3, 0.2, 0.75), parent=H, coll=C, seg=16)
        self.F["blush"] = [D.objects["%s_blush%d" % (n, s)] for s in (-1, 1)]
        # tears (crying)
        tp = empty(n + "_tears", (0, fy - 0.03, 0), H, C)
        for s in (-1, 1):
            sphere("%s_tear%d" % (n, s), 0.06 * hs, (s * ex, 0, ez - er * 1.6), tear_m, (0.9, 0.5, 1.6), parent=tp, coll=C, seg=12)
            box("%s_stream%d" % (n, s), (0.07 * hs, 0.03, 0.42 * hs), (s * ex, 0, ez - er * 2.4), tear_m, 0.03, parent=tp, coll=C)
        self.F["tears"] = tp
        # mouths: one empty each, only one shown at a time (scale 1 / 0)
        mz = -0.43 * hs
        M = self.F["mouth"]

        def mo(key):
            e = empty("%s_mouth_%s" % (n, key), (0, fy - 0.05 * hs, mz), H, C)
            M[key] = e
            return e
        r = 0.05 * hs
        # the Mimic's smile: too wide, ear to ear
        zc_arc(n + "_m_wide", [(-0.62 * hs, 0.16 * hs), (-0.4 * hs, -0.08 * hs), (0.0, -0.13 * hs), (0.4 * hs, -0.08 * hs), (0.62 * hs, 0.16 * hs)], r, line_m, mo("wide"), C)
        _tw = mo("too_wide")
        # the last smile: far too wide, past the cheeks, the corners curling up (with a second line: the teeth)
        zc_arc(n + "_m_toowide", [(-0.9 * hs, 0.34 * hs), (-0.7 * hs, 0.0), (-0.36 * hs, -0.2 * hs), (0.0, -0.25 * hs), (0.36 * hs, -0.2 * hs), (0.7 * hs, 0.0), (0.9 * hs, 0.34 * hs)], r * 1.15, line_m, _tw, C)
        zc_arc(n + "_m_toowide2", [(-0.66 * hs, 0.06 * hs), (-0.33 * hs, -0.07 * hs), (0.0, -0.1 * hs), (0.33 * hs, -0.07 * hs), (0.66 * hs, 0.06 * hs)], r * 0.6, line_m, _tw, C)
        zc_arc(n + "_m_line", [(-0.16 * hs, 0), (0, -0.01 * hs), (0.16 * hs, 0)], r, line_m, mo("line"), C)
        zc_arc(n + "_m_small", [(-0.08 * hs, 0), (0.08 * hs, 0)], r, line_m, mo("small_line"), C)
        zc_arc(n + "_m_smile", [(-0.27 * hs, 0.07 * hs), (-0.1 * hs, -0.06 * hs), (0.1 * hs, -0.06 * hs), (0.27 * hs, 0.07 * hs)], r, line_m, mo("smile"), C)
        zc_arc(n + "_m_frown", [(-0.22 * hs, -0.07 * hs), (-0.08 * hs, 0.04 * hs), (0.08 * hs, 0.04 * hs), (0.22 * hs, -0.07 * hs)], r, line_m, mo("frown"), C)
        zc_arc(n + "_m_wavy", [(-0.24 * hs, -0.02 * hs), (-0.12 * hs, 0.04 * hs), (0.0, -0.03 * hs), (0.12 * hs, 0.04 * hs), (0.24 * hs, -0.02 * hs)], r * 0.9, line_m, mo("wavy"), C)
        zc_arc(n + "_m_smirk", [(-0.2 * hs, -0.02 * hs), (0.04 * hs, -0.04 * hs), (0.2 * hs, 0.02 * hs), (0.28 * hs, 0.09 * hs)], r, line_m, mo("smirk"), C)
        zc_arc(n + "_m_side", [(0.0, -0.01 * hs), (0.2 * hs, 0.02 * hs)], r, line_m, mo("side_line"), C)
        g = mo("grin")
        zc_ellipse(n + "_m_grin", 0.3 * hs, 0.22 * hs, 0.03 * hs, mouth_m, g, C, top_flat=True, y=0.0)
        box(n + "_m_teeth", (0.5 * hs, 0.03, 0.07 * hs), (0, -0.04, 0.0), teeth_m, 0.01, parent=g, coll=C)
        zc_ellipse(n + "_m_tongue", 0.15 * hs, 0.08 * hs, -0.1 * hs, tongue_m, g, C, y=-0.035, depth=0.02)
        o = mo("small_o")
        zc_ellipse(n + "_m_so", 0.08 * hs, 0.1 * hs, 0.0, mouth_m, o, C, y=0.0)
        bo = mo("big_o")
        zc_ellipse(n + "_m_bo", 0.15 * hs, 0.22 * hs, -0.03 * hs, mouth_m, bo, C, y=0.0)
        zc_ellipse(n + "_m_bot", 0.09 * hs, 0.06 * hs, -0.17 * hs, tongue_m, bo, C, y=-0.035, depth=0.02)
        fo = mo("frown_open")
        zc_ellipse(n + "_m_fo", 0.22 * hs, 0.14 * hs, -0.03 * hs, mouth_m, fo, C, bottom_flat=True, y=0.0)
        gr = mo("grit")
        box(n + "_m_grit", (0.46 * hs, 0.05, 0.17 * hs), (0, 0, 0), mouth_m, 0.04, parent=gr, coll=C)
        box(n + "_m_gteeth", (0.42 * hs, 0.03, 0.11 * hs), (0, -0.03, 0), teeth_m, 0.01, parent=gr, coll=C)
        box(n + "_m_gline", (0.42 * hs, 0.02, 0.012 * hs), (0, -0.05, 0), line_m, 0.0, parent=gr, coll=C)
        if self.spec.get("mustache"):
            zc_meta(n + "_stache", H, [((-0.16 * hs, fy - 0.05, -0.27 * hs), (0.2 * hs, 0.09, 0.08 * hs), (0, 0, -12)), ((0.16 * hs, fy - 0.05, -0.27 * hs), (0.2 * hs, 0.09, 0.08 * hs), (0, 0, 12))],
                    zc_hair_mat(n, c["hair"], c["hair_light"], 0.4 * hs, 1.1 * hs), C)

    # ------------------------------------------------------------------ THE HAIR (sculpted volume)
    def _hair(self, hs, hw, hd, hh):
        n, c = self.name, self.spec["colors"]
        st = self.spec["hair"]
        if st == "none":
            return
        top = hh / 2
        m = zc_hair_mat(n, c["hair"], c["hair_light"], top * 0.3, top + 0.5 * hs, ref=self.head)
        H, C = self.head, self.coll
        # the cover: never bald (a cap over the crown, a wrap behind the ears round the back)
        box(n + "_hcap", (hw + 0.04 * hs, hd + 0.04 * hs, 0.5 * hs), (0, 0.02 * hs, top - 0.14 * hs), m, 0.3 * hs, parent=H, coll=C, seg=5)
        drop = {"swoop": 0.6, "short": 0.75, "bun": 0.5, "bob": 1.5, "pigtails": 0.55, "grey_neat": 0.8}.get(st, 0.6)
        y0, y1 = 0.02 * hs, hd / 2 + 0.02 * hs
        box(n + "_hwrap", (hw + 0.04 * hs, y1 - y0, top * (1.0 + drop)), (0, (y0 + y1) / 2, top * (1.0 - drop) / 2), m, 0.26 * hs, parent=H, coll=C, seg=5)
        if st in ("bob", "pigtails", "short", "grey_neat", "bun"):   # the fringe: part of the cap, never a floating bar
            box(n + "_fringe", (hw * (0.92 if st in ("bob", "pigtails") else 0.7), 0.22 * hs, 0.3 * hs), (0.0 if st in ("bob", "pigtails") else 0.12 * hs, -hd / 2 - 0.02 * hs, top - 0.24 * hs), m, 0.1 * hs, parent=H, coll=C, seg=4)
        E = []

        def lock(x, y, z, length, width, rz=0.0, rx=0.0, ry=0.0):
            E.append(((x, y, z), (width, width * 0.75, length), (rx, ry, rz)))
        # the back: two rows of locks flowing down, fanning out
        rows = {"swoop": 2, "short": 1, "bun": 1, "bob": 3, "pigtails": 2, "grey_neat": 1}.get(st, 2)
        for row in range(rows):
            zc = top * (0.62 - row * 0.62)
            for i in range(7):
                a = math.radians(-72 + i * 24)
                lock(math.sin(a) * (hw * 0.5 + 0.08 * hs), math.cos(a) * (hd * 0.5 + 0.08 * hs), zc, 0.6 * hs, 0.26 * hs, ry=-math.degrees(a) * 0.35, rx=12)
        # the top: locks from the crown, sweeping forward and back
        cx, cy = 0.12 * hs, 0.2 * hs
        for i in range(8):
            b = math.radians(-160 + i * 45)
            lock(cx + math.sin(b) * 0.5 * hs, cy - math.cos(b) * 0.5 * hs, top + 0.14 * hs, 0.5 * hs, 0.24 * hs, rz=-math.degrees(b), rx=80)
        if st == "swoop":    # Me: a side-swept fringe and a crown tuft
            E += [((-0.3 * hs, -hd * 0.5, top - 0.12 * hs), (0.62 * hs, 0.3 * hs, 0.32 * hs), (0, -18, 14)),
                  ((0.32 * hs, -hd * 0.48, top - 0.02 * hs), (0.46 * hs, 0.28 * hs, 0.28 * hs), (0, 22, -16)),
                  ((0.72 * hs, -hd * 0.36, top - 0.2 * hs), (0.28 * hs, 0.24 * hs, 0.3 * hs), (0, 30, -10)),
                  ((0.15 * hs, 0.12 * hs, top + 0.38 * hs), (0.12 * hs, 0.1 * hs, 0.3 * hs), (-30, 0, 20))]
        elif st in ("short", "grey_neat"):   # neat with a side part and a lifted front (a quiff)
            E += [((0.2 * hs, -hd * 0.4, top + 0.1 * hs), (hw * 0.4, 0.34 * hs, 0.3 * hs), (20, 10, 0))]
        elif st == "bun":
            E += [((0, 0.1 * hs, top + 0.5 * hs), (0.42 * hs, 0.42 * hs, 0.38 * hs), None)]
        elif st == "bob":    # Mom: a rounded bob to the jaw (the fringe is the cut's own box)
            for sx in (-1, 1):
                E += [((sx * hw * 0.56, -0.1 * hs, top * -0.2), (0.22 * hs, hd * 0.42, top * 0.9), (0, sx * 6, 0)),
                      ((sx * hw * 0.5, -hd * 0.32, top * -0.55), (0.2 * hs, 0.26 * hs, 0.26 * hs), (0, -sx * 20, 0))]
        elif st == "pigtails":   # the sister: two bunches tied at the sides
            tie = zc_mat(n, "tie", c.get("accent", "#FFD23F"), rough=0.4, spec=0.6)
            for sx in (-1, 1):
                E += [((sx * (hw * 0.7), 0.15 * hs, top * 0.15), (0.38 * hs, 0.38 * hs, 0.55 * hs), (0, sx * 28, 0)),
                      ((sx * (hw * 0.84), 0.2 * hs, top * -0.45), (0.3 * hs, 0.3 * hs, 0.48 * hs), (0, sx * 18, 0))]
                sphere("%s_tie%d" % (n, sx), 0.14 * hs, (sx * (hw * 0.56), 0.15 * hs, top * 0.45), tie, (1.0, 1.0, 0.7), parent=H, coll=C, seg=14)
        zc_meta(n + "_hair", self.head, E, m, self.coll)
        if self.spec.get("hat") == "top":   # the Mayor's top hat
            hm = zc_mat(n, "hat", "#1C1C22", rough=0.35, spec=0.6)
            cyl(n + "_brim", 0.95 * hs * max(1.0, hw / 1.9), 0.08 * hs, (0, 0.02 * hs, top + 0.28 * hs), hm, 32, bev=0.02, parent=H, coll=C)
            cyl(n + "_crown", 0.62 * hs, 1.05 * hs, (0, 0.02 * hs, top + 0.82 * hs), hm, 32, bev=0.04, parent=H, coll=C)
            cyl(n + "_band", 0.635 * hs, 0.18 * hs, (0, 0.02 * hs, top + 0.42 * hs), zc_mat(n, "hatband", c.get("sash", "#C8283C"), rough=0.4), 32, parent=H, coll=C)

    # ------------------------------------------------------------------ BADGE, EXPRESSIONS, BLINKS, POSES, HOLDING
    def set_badge(self, t, on):
        s = 1.0 if on else 0.0001
        self.badge.scale = (s, s, s)
        key(self.badge, "scale", F(t), interp="CONSTANT")

    def express(self, t, name):
        X = ZC_EXPR.get(name, ZC_EXPR["neutral"])
        f = F(t)
        self.expr = name
        hs = self.spec["body"]["head"]
        for s, side in ((1, "L"), (-1, "R")):
            asym = X.get("asym", {}).get(side, {})
            b = self.F["brow"][side]
            x0, y0, z0 = b.location
            b.location = (x0, y0, self.F["eye0"][side][2] + (0.4 + X["brow_z"] + asym.get("brow_z", 0.0)) * hs)
            b.rotation_euler = (0, math.radians(s * (X["brow_tilt"] + asym.get("brow_tilt", 0.0))), 0)
            key(b, "location", f, interp="CONSTANT")
            key(b, "rotation_euler", f, interp="CONSTANT")
            lid = self.F["lid"][side]
            v = max(0.0001, min(1.0, X["lid"] + asym.get("lid", 0.0)))
            lid.scale = (1, 1, v)
            lid.rotation_euler = (0, math.radians(-s * X["lid_tilt"]), 0)
            key(lid, "scale", f, interp="CONSTANT")
            key(lid, "rotation_euler", f, interp="CONSTANT")
            lo = self.F["low"][side]
            ex0, ey0, ez0 = self.F["eye0"][side]
            lo.location = (ex0, ey0 + 0.06 - 0.1 * min(1.0, X["low"] * 2.5), ez0 - 0.2 * 1.28 * hs - 0.08 * hs + X["low"] * 0.36 * hs)
            key(lo, "location", f, interp="CONSTANT")
            ep = self.F["eyes"][side]
            dx, dz = X.get("look", (0.0, 0.0))
            ep.location = (ex0 + dx * hs, ey0, ez0 + dz * hs)
            es = X.get("eye_scale", 1.0)
            ep.scale = (es, 1, es)
            key(ep, "location", f, interp="CONSTANT")
            key(ep, "scale", f, interp="CONSTANT")
        for k, e in self.F["mouth"].items():
            v = 1.0 if (k == X["mouth"] and self.mode != "shadow") else 0.0001
            e.scale = (v, v, v)
            key(e, "scale", f, interp="CONSTANT")
        for ob in self.F["blush"]:
            v = 1.0 if (X.get("blush") and self.mode == "normal") else 0.0001
            ob.scale = (1.3 * v, 0.2 * v, 0.75 * v)
            key(ob, "scale", f, interp="CONSTANT")
        v = 1.0 if X.get("tears") else 0.0001
        self.F["tears"].scale = (v, v, v)
        key(self.F["tears"], "scale", f, interp="CONSTANT")

    def blink(self, t):
        """the lids close for 3 frames and open again (on top of the expression's lid); the Mimic never blinks"""
        if self.mode == "mimic":
            return
        f = F(t)
        lv = ZC_EXPR.get(self.expr, ZC_EXPR["neutral"])["lid"]
        for side in ("L", "R"):
            lid = self.F["lid"][side]
            for df, v in ((-1, lv), (0, 1.0), (2, 1.0), (3, lv)):
                lid.scale = (1, 1, max(0.0001, v))
                key(lid, "scale", f + df, interp="CONSTANT")

    def pose(self, t, name, extra=None):
        Pz = dict(ZC_POSES["stand"])
        Pz.update(ZC_POSES.get(name, {}))
        if extra:
            Pz.update(extra)
        f = F(t)
        J = {"torso": self.torso, "neck": self.neck, "thighL": self.thigh["L"], "thighR": self.thigh["R"], "kneeL": self.knee["L"], "kneeR": self.knee["R"],
             "shoulderL": self.shoulder["L"], "shoulderR": self.shoulder["R"], "elbowL": self.elbow["L"], "elbowR": self.elbow["R"]}
        for j, ob in J.items():
            r = Pz.get(j, (0, 0, 0))
            ob.rotation_euler = tuple(math.radians(a) for a in r)
            key(ob, "rotation_euler", f, interp="CONSTANT")
        P = self.spec["body"]
        hip_z = P["thigh"] + P["shin"] + 0.42 + 0.1
        self.hip.location = (0, Pz.get("hip_dy", 0.0), hip_z + Pz.get("hip_dz", 0.0) * (P["thigh"] + P["shin"]))
        key(self.hip, "location", f, interp="CONSTANT")

    def face_to(self, p):
        """turn the whole body to face a world point (people face what they look at; the lens only when they look at it)"""
        r = self.root.location
        self.root.rotation_euler[2] = math.atan2(p[0] - r.x, -(p[1] - r.y))

    def turn(self, t, look, cam, max_body=45.0, max_head=35.0):
        """FACING (owner 2026-11-24): the body turns at most 45 degrees away from the camera toward what they look at
        (three-quarter, never a pure profile); the head takes the rest, at most 35 degrees; the eyes do the last bit"""
        r = self.root.location
        yc = math.atan2(cam[0] - r.x, -(cam[1] - r.y))
        yl = math.atan2(look[0] - r.x, -(look[1] - r.y))
        d = (yl - yc + math.pi) % (2 * math.pi) - math.pi
        b = max(-math.radians(max_body), min(math.radians(max_body), d))
        self.root.rotation_euler[2] = yc + b
        h = max(-math.radians(max_head), min(math.radians(max_head), d - b))
        f = F(t)
        self.neck.rotation_euler[2] = self.neck.rotation_euler[2] + h
        key(self.neck, "rotation_euler", f, interp="CONSTANT")
        return math.degrees(b), math.degrees(h)

    def hold(self, t, thing, hands="R", upright=False):
        """a prop in one hand (L / R) or between both hands ("both"), placed where the posed hands really are, at the
        character's scale, turned with the body (the still's hands do not move)"""
        bpy.context.view_layer.update()
        hp = {k: self.hand[k].matrix_world.translation.copy() for k in ("L", "R")}
        yaw = self.root.rotation_euler[2]
        thing.scale = (self.k, self.k, self.k)
        p = (hp["L"] + hp["R"]) / 2.0 if hands == "both" else hp[hands]
        thing.location = (p.x, p.y, p.z + (0.05 * self.k if hands == "both" else 0.0))
        thing.rotation_euler = (0.0 if upright else thing.rotation_euler[0], 0.0, yaw)
        return thing


CHARS_V2 = {}


class ZCritter:
    """the little creature: knee-high, round and fuzzy, big eyes; cute or grumpy (the same face params as the cast)"""
    def __init__(self, name, spec, loc=(0, 0, 0), rot=0.0):
        self.name, self.spec, n = name, spec, name
        self.mode = "critter"
        self.coll = collection(n)
        c = spec["colors"]
        self.root = empty(n + "_root", loc, None, self.coll, (0, 0, rot))
        fur = zc_fabric(zc_mat(n, "fur", c["fur"], rough=0.95, spec=0.1), scale=40.0, strength=0.6)
        fur2 = zc_mat(n, "fur2", c["fur_dark"], rough=0.9, spec=0.1)
        belly = zc_fabric(zc_mat(n, "belly", c["belly"], rough=0.95, spec=0.1), scale=40.0, strength=0.4)
        R = 1.0
        self.body = sphere(n + "_body", R, (0, 0, R * 0.95), fur, (1.0, 0.92, 0.95), parent=self.root, coll=self.coll, seg=48)
        md2 = self.body.modifiers.new("sub", "SUBSURF")
        md2.levels = 2
        md2.render_levels = 3
        tx = D.textures.new(n + "_furtex", "CLOUDS")
        tx.noise_scale = 0.06
        md = self.body.modifiers.new("fuzz", "DISPLACE")
        md.texture = tx
        md.strength = 0.07
        sphere(n + "_belly", R * 0.62, (0, -R * 0.5, R * 0.75), belly, (1.0, 0.5, 0.9), parent=self.root, coll=self.coll, seg=32)
        for s in (-1, 1):
            sphere("%s_foot%d" % (n, s), R * 0.26, (s * R * 0.42, -R * 0.22, R * 0.1), fur2, (1.0, 1.35, 0.6), parent=self.root, coll=self.coll, seg=16)
            sphere("%s_arm%d" % (n, s), R * 0.2, (s * R * 0.95, -R * 0.12, R * 0.82), fur, (0.7, 0.8, 1.25), parent=self.root, coll=self.coll, seg=16, rot=(0, s * 20, 0))
            cyl("%s_ear%d" % (n, s), R * 0.16, R * 0.5, (s * R * 0.5, 0.0, R * 1.78), fur, 12, rot=(0, s * 22, 0), parent=self.root, coll=self.coll, r2=0.02)
        self.head = self.body
        # the face: re-use the cast's face parts on a small virtual "head" frame
        self.F = {"eyes": {}, "lid": {}, "low": {}, "brow": {}, "mouth": {}, "eye0": {}}
        hs = 0.95
        fy = -R * 0.9
        eye_m = zc_mat(n, "eye", "#120E0C", rough=0.1, spec=0.9, coat=0.7)
        glint = zc_mat(n, "glint", "#FFFFFF", rough=0.2, emit="#FFFFFF", estr=4.0)
        line_m = zc_mat(n, "mline", "#2A1612", rough=0.5)
        mouth_m = zc_mat(n, "mouth", "#5A1E24", rough=0.5)
        ex, ez, er = 0.34, 1.12, 0.24
        for s, side in ((1, "L"), (-1, "R")):
            ep = empty("%s_eyep%s" % (n, side), (s * ex, fy + 0.05, ez), self.root, self.coll)
            sphere("%s_eye%s" % (n, side), er, (0, 0, 0), eye_m, (1.0, 0.75, 1.2), parent=ep, coll=self.coll, seg=24)
            sphere("%s_glint%s" % (n, side), 0.07, (-0.07, -0.17, 0.1), glint, parent=ep, coll=self.coll, seg=12)
            self.F["eyes"][side], self.F["eye0"][side] = ep, (s * ex, fy + 0.05, ez)
            lp = empty("%s_lidp%s" % (n, side), (s * ex, fy - 0.03, ez + er * 1.2), self.root, self.coll)
            sphere("%s_lid%s" % (n, side), er * 1.14, (0, 0.03, -er * 1.2), fur, (1.08, 0.85, 1.3), parent=lp, coll=self.coll, seg=20)
            self.F["lid"][side] = lp
            lo = empty("%s_lowp%s" % (n, side), (s * ex, fy + 0.02, ez - er * 1.2), self.root, self.coll)
            sphere("%s_low%s" % (n, side), er * 1.0, (0, 0, -er * 1.0), fur, (1.1, 0.3, 0.8), parent=lo, coll=self.coll, seg=16)
            self.F["low"][side] = lo
            bp = empty("%s_browp%s" % (n, side), (s * ex, fy - 0.05, ez + 0.36), self.root, self.coll)
            box("%s_brow%s" % (n, side), (0.3, 0.12, 0.08), (0, 0, 0), fur2, 0.03, parent=bp, coll=self.coll)
            self.F["brow"][side] = bp
        M = self.F["mouth"]
        mz = 0.72

        def mo(key):
            e = empty("%s_mouth_%s" % (n, key), (0, fy - 0.06, mz), self.root, self.coll)
            M[key] = e
            return e
        r = 0.04
        zc_arc(n + "_m_line", [(-0.12, 0), (0.12, 0)], r, line_m, mo("line"), self.coll)
        zc_arc(n + "_m_smile", [(-0.2, 0.06), (-0.07, -0.05), (0.07, -0.05), (0.2, 0.06)], r, line_m, mo("smile"), self.coll)
        zc_arc(n + "_m_frown", [(-0.18, -0.06), (-0.06, 0.04), (0.06, 0.04), (0.18, -0.06)], r, line_m, mo("frown"), self.coll)
        zc_arc(n + "_m_wavy", [(-0.18, -0.02), (-0.09, 0.03), (0.0, -0.02), (0.09, 0.03), (0.18, -0.02)], r, line_m, mo("wavy"), self.coll)
        g = mo("grin")
        zc_ellipse(n + "_m_grin", 0.22, 0.16, 0.02, mouth_m, g, self.coll, top_flat=True, y=0.0)
        o = mo("small_o")
        zc_ellipse(n + "_m_so", 0.08, 0.1, 0.0, mouth_m, o, self.coll, y=0.0)
        for k in ("big_o", "frown_open", "grit", "small_line", "smirk", "side_line", "wide", "too_wide"):
            M[k] = M["small_o"] if k in ("big_o", "frown_open") else (M["frown"] if k == "grit" else M["line"])
        self.F["blush"] = []
        self.F["tears"] = empty(n + "_tears", (0, 0, 0), self.root, self.coll)
        self.spec = dict(spec, body={"head": hs})
        self.local_h = R * 2.1
        k = spec["height"] / self.local_h
        self.root.scale = (k, k, k)
        self.k = k
        self.expr = "happy"
        self.express(0, "happy")
        CHARS_V2[name] = self

    def express(self, t, name):
        ZChar.express(self, t, name)

    def face_to(self, p):
        ZChar.face_to(self, p)


def zv_open_window(i=8, wx=-4, light_on=True):
    """the hero house's window as a real opening (a hole in the wall, the pane removed, a warm lamp inside): someone
    can stand at it, inside. Returns the opening's centre (world)."""
    pane = D.objects.get("zw_hwin%d_%d" % (i, wx))
    house = D.objects.get("zw_h%d" % i)
    if pane is None or house is None:
        print("zv_open_window: no window %d_%d" % (i, wx))
        return None
    bpy.context.view_layer.update()
    c = pane.matrix_world.translation.copy()
    dm = pane.dimensions
    # the opening: the window's upper 60 pct (a high sill: someone inside shows head and shoulders, never legs)
    cut = box("zv_wcut%d" % i, (dm.x * 0.98, 6.0, dm.z * 0.58), (c.x, c.y + 2.7, c.z + dm.z * 0.2), None, 0.0)   # a room-deep pocket (the house is solid)
    cut.hide_render = True
    cut.display_type = "WIRE"
    md = house.modifiers.new("zv_window", "BOOLEAN")
    md.object = cut
    md.operation = "DIFFERENCE"
    D.objects.remove(pane, do_unlink=True)
    box("zv_wsill%d" % i, (dm.x + 0.5, 0.5, 0.22), (c.x, c.y - 0.2, c.z + dm.z * 0.2 - dm.z * 0.29), mat("zv_sillw", zc_rgb("#F4F1EA"), 0.5), 0.03)
    box("zv_room%d" % i, (8, 0.2, 9), (c.x, c.y + 4.5, 4.5), mat("zv_roomwall", zc_rgb("#E9D9B8"), 0.9), 0.0)
    if light_on:
        light("zv_roomlamp%d" % i, "POINT", (c.x + 0.6, c.y + 2.5, c.z + 1.6), 220, (1.0, 0.82, 0.58), 0.8)
    return c


def zc_head_c(ch):
    bpy.context.view_layer.update()
    h = ch.head
    pts = [h.matrix_world @ Vector(c) for c in h.bound_box]
    return Vector((sum(p.x for p in pts) / 8.0, sum(p.y for p in pts) / 8.0, sum(p.z for p in pts) / 8.0)) if pts else ch.root.location


def zc_face_cam(t0, ch, dist=2.2, lens=50, side=0.0, up=0.06, fstop=2.0, dz=0.0):
    """a close-up made from where the head really is: in front of the face (side = degrees round it), DOF on the eyes"""
    c = zc_head_c(ch)
    a = ch.root.rotation_euler[2] + math.radians(side)
    fwd = Vector((math.sin(a), -math.cos(a), 0.0))
    loc = c + fwd * dist + Vector((0, 0, up))
    cam = Cam()
    cam.key(t0, tuple(loc), (c.x, c.y, c.z - 0.04 + dz), lens=lens, focus=dist, fstop=fstop)
    return cam


ZC_CHAR_LIGHT = {"day": (60, 40), "morning": (80, 60), "sunset": (110, 90), "night": (170, 160), "storm": (150, 160)}


def zc_char_light(ch, cam_loc, time="day"):
    """the soft glow on the character: a warm area key from the camera side, a cool rim from behind"""
    kw, rw = ZC_CHAR_LIGHT.get(time, ZC_CHAR_LIGHT["day"])
    c = zc_head_c(ch)
    d = Vector(cam_loc) - c
    d.z = 0
    d = d.normalized() if d.length > 1e-3 else Vector((0, -1, 0))
    side = Vector((-d.y, d.x, 0))
    k = ch.k
    light(ch.name + "_key", "AREA", tuple(c + d * 6 * k + side * 3 * k + Vector((0, 0, 3 * k))), kw, (1.0, 0.86, 0.72), 4 * k, target=tuple(c))
    light(ch.name + "_rim", "AREA", tuple(c - d * 5 * k - side * 2 * k + Vector((0, 0, 4 * k))), rw, (0.7, 0.8, 1.0), 3 * k, target=tuple(c))


def zc_badge_image():
    """the Zyvo icon (src/assets/Logo.png, 96 px) rebuilt from its RGBA bytes: no file leaves the shot"""
    if "img" in ZC_BADGE:
        try:
            ZC_BADGE["img"].name   # (each shot's scene reset removes it: then it is rebuilt)
            return ZC_BADGE["img"]
        except ReferenceError:
            ZC_BADGE.pop("img", None)
    try:
        hx = ZV_BADGE_HEX
    except NameError:
        return None
    raw = bytes.fromhex(hx)
    img = D.images.new("zyvo_badge", 96, 96, alpha=True)
    img.pixels = [v / 255.0 for v in raw]
    img.alpha_mode = "STRAIGHT"
    ZC_BADGE["img"] = img
    return img


# the 12 expressions: brow height / tilt (+ = inner end up), upper lid (0 open .. 1 closed) and its tilt (+ = inner end
# down: angry), the lower lid rising (smiling eyes), the mouth, blush, tears, where the eyes look, eye size
ZC_EXPR = {
    "neutral":   {"brow_z": 0.0, "brow_tilt": 0, "lid": 0.05, "lid_tilt": 0, "low": 0.0, "mouth": "line"},
    "happy":     {"brow_z": 0.04, "brow_tilt": 4, "lid": 0.05, "lid_tilt": 0, "low": 0.35, "mouth": "smile", "blush": True},
    "big_smile": {"brow_z": 0.08, "brow_tilt": 6, "lid": 0.0001, "lid_tilt": 0, "low": 0.62, "mouth": "grin", "blush": True},
    "worried":   {"brow_z": 0.05, "brow_tilt": 22, "lid": 0.18, "lid_tilt": -10, "low": 0.0, "mouth": "wavy"},
    "scared":    {"brow_z": 0.1, "brow_tilt": 24, "lid": 0.0001, "lid_tilt": 0, "low": 0.0, "mouth": "small_o", "eye_scale": 1.08},
    "terrified": {"brow_z": 0.16, "brow_tilt": 28, "lid": 0.0001, "lid_tilt": 0, "low": 0.0, "mouth": "big_o", "eye_scale": 1.18},
    "sad":       {"brow_z": -0.02, "brow_tilt": 22, "lid": 0.38, "lid_tilt": -16, "low": 0.0, "mouth": "frown", "look": (0.0, -0.04)},
    "crying":    {"brow_z": 0.0, "brow_tilt": 26, "lid": 0.5, "lid_tilt": -16, "low": 0.2, "mouth": "frown_open", "tears": True},
    "angry":     {"brow_z": -0.1, "brow_tilt": -30, "lid": 0.32, "lid_tilt": 22, "low": 0.1, "mouth": "grit"},
    "sleepy":    {"brow_z": -0.04, "brow_tilt": 0, "lid": 0.66, "lid_tilt": 0, "low": 0.1, "mouth": "small_line"},
    "smug":      {"brow_z": 0.0, "brow_tilt": -6, "lid": 0.42, "lid_tilt": 4, "low": 0.15, "mouth": "smirk", "look": (0.05, 0.0),
                  "asym": {"L": {"brow_z": 0.12, "brow_tilt": 10}}},
    # the Shadow (eyes only): stare / narrow / wide / half-shut / one eye / look aside
    "shadow_stare":  {"brow_z": 0.0, "brow_tilt": 0, "lid": 0.0001, "lid_tilt": 0, "low": 0.0, "mouth": "line", "eye_scale": 1.0},
    "shadow_narrow": {"brow_z": 0.0, "brow_tilt": 0, "lid": 0.55, "lid_tilt": 24, "low": 0.25, "mouth": "line"},
    "shadow_wide":   {"brow_z": 0.0, "brow_tilt": 0, "lid": 0.0001, "lid_tilt": 0, "low": 0.0, "mouth": "line", "eye_scale": 1.3},
    "shadow_sleepy": {"brow_z": 0.0, "brow_tilt": 0, "lid": 0.7, "lid_tilt": 0, "low": 0.0, "mouth": "line"},
    "shadow_wink":   {"brow_z": 0.0, "brow_tilt": 0, "lid": 0.0001, "lid_tilt": 0, "low": 0.0, "mouth": "line", "asym": {"L": {"lid": 1.0}}},
    "shadow_aside":  {"brow_z": 0.0, "brow_tilt": 0, "lid": 0.2, "lid_tilt": 0, "low": 0.0, "mouth": "line", "look": (0.07, 0.0)},
    # the Mimic: almost right (eyes that never blink, a smile too wide, brows too still)
    "mimic_smile":   {"brow_z": 0.08, "brow_tilt": 0, "lid": 0.0001, "lid_tilt": 0, "low": 0.0, "mouth": "wide", "eye_scale": 0.86},
    "mimic_wide":    {"brow_z": 0.1, "brow_tilt": 0, "lid": 0.0001, "lid_tilt": 0, "low": 0.0, "mouth": "too_wide", "eye_scale": 0.92},
    "mimic_stare":   {"brow_z": 0.12, "brow_tilt": 0, "lid": 0.0001, "lid_tilt": 0, "low": 0.0, "mouth": "line", "eye_scale": 0.8},
    "mimic_grin":    {"brow_z": 0.04, "brow_tilt": -8, "lid": 0.2, "lid_tilt": 10, "low": 0.0, "mouth": "wide", "eye_scale": 0.86, "look": (0.0, 0.03)},
    "mimic_copy":    {"brow_z": 0.04, "brow_tilt": 4, "lid": 0.0001, "lid_tilt": 0, "low": 0.1, "mouth": "smile", "eye_scale": 0.84},
    "thinking":  {"brow_z": 0.0, "brow_tilt": 0, "lid": 0.15, "lid_tilt": 0, "low": 0.0, "mouth": "side_line", "look": (0.06, 0.07),
                  "asym": {"L": {"brow_z": 0.14, "brow_tilt": 12}, "R": {"brow_z": -0.03}}},
}
# poses: joint rotations in degrees (X = swing, - forward; Y = out to the side; Z = twist); hip_dz drops the hips
# (a share of the leg length); hip_dy moves them back
ZC_POSES = {
    "stand":  {"shoulderL": (0, -7, 0), "shoulderR": (0, 7, 0), "elbowL": (-6, 0, 0), "elbowR": (-6, 0, 0)},
    "walk":   {"thighL": (-26, 0, 0), "kneeL": (8, 0, 0), "thighR": (20, 0, 0), "kneeR": (28, 0, 0), "shoulderL": (24, -6, 0), "shoulderR": (-24, 6, 0),
               "elbowL": (-12, 0, 0), "elbowR": (-22, 0, 0), "torso": (-3, 0, 0), "hip_dz": -0.03},
    "run":    {"thighL": (-50, 0, 0), "kneeL": (35, 0, 0), "thighR": (34, 0, 0), "kneeR": (78, 0, 0), "shoulderL": (48, -8, 0), "shoulderR": (-52, 8, 0),
               "elbowL": (-70, 0, 0), "elbowR": (-80, 0, 0), "torso": (-14, 0, 0), "neck": (8, 0, 0), "hip_dz": -0.08},
    "sit":    {"thighL": (-88, 0, 0), "kneeL": (88, 0, 0), "thighR": (-88, 0, 0), "kneeR": (88, 0, 0), "shoulderL": (-18, -6, 0), "shoulderR": (-18, 6, 0),
               "elbowL": (-38, 0, 0), "elbowR": (-38, 0, 0), "hip_dz": -0.43, "hip_dy": 0.15},
    "crouch": {"thighL": (-82, -6, 0), "kneeL": (118, 0, 0), "thighR": (-82, 6, 0), "kneeR": (118, 0, 0), "torso": (-24, 0, 0), "neck": (-18, 0, 0),
               "shoulderL": (-48, -10, 0), "shoulderR": (-48, 10, 0), "elbowL": (-30, 0, 0), "elbowR": (-30, 0, 0), "hip_dz": -0.6, "hip_dy": 0.35},
    "crouch2": {"thighL": (-58, -8, 0), "kneeL": (86, 0, 0), "thighR": (-50, 8, 0), "kneeR": (80, 0, 0), "torso": (-12, 0, 0), "neck": (-6, 0, 0),
                "shoulderL": (-36, -6, 0), "shoulderR": (-30, 6, 0), "elbowL": (-24, 0, 0), "elbowR": (-20, 0, 0), "hip_dz": -0.3, "hip_dy": 0.18},
    "hold_up2": {"shoulderR": (-172, -30, 0), "elbowR": (-4, 0, 0), "shoulderL": (0, -10, 0), "neck": (-16, 0, -12), "torso": (0, 0, -6)},
    "talk":   {"shoulderR": (-34, 22, 0), "elbowR": (-62, 0, 0), "shoulderL": (8, -8, 0), "neck": (0, 0, 8)},
    "lean":   {"torso": (-38, 0, 0), "neck": (-12, 0, 0), "shoulderL": (-30, -4, 0), "shoulderR": (-30, 4, 0), "elbowL": (-10, 0, 0), "elbowR": (-10, 0, 0)},
    "reach":  {"torso": (-16, 0, 0), "shoulderR": (-96, 6, 0), "elbowR": (-6, 0, 0), "shoulderL": (-20, -10, 0), "neck": (-4, 0, 0)},
    "peek":   {"torso": (0, -28, 0), "neck": (0, -18, 0), "shoulderR": (-40, 30, 0), "elbowR": (-60, 0, 0)},
    "hug":    {"shoulderL": (-78, 24, 0), "shoulderR": (-78, -24, 0), "elbowL": (-48, 0, 0), "elbowR": (-48, 0, 0), "neck": (6, 0, 0)},
    "shield": {"shoulderL": (-12, -40, 0), "shoulderR": (-12, 40, 0), "elbowL": (-20, 0, 0), "elbowR": (-20, 0, 0), "torso": (6, 0, 0)},
    "tilt":   {"neck": (0, 34, 0), "shoulderL": (0, -3, 0), "shoulderR": (0, 3, 0)},
    "point":  {"shoulderR": (-92, 4, 0), "elbowR": (0, 0, 0), "torso": (0, 0, 8), "neck": (0, 0, -6), "shoulderL": (0, -8, 0)},
    "hold_up": {"shoulderR": (-168, 6, 0), "elbowR": (-8, 0, 0), "shoulderL": (0, -10, 0), "neck": (-10, 0, 0)},
    "look_back": {"torso": (0, 0, 24), "neck": (0, 0, 68), "shoulderL": (8, -8, 0), "shoulderR": (-6, 8, 0)},
    "hold_phone": {"shoulderL": (-30, 12, 0), "shoulderR": (-30, -12, 0), "elbowL": (-72, 0, 0), "elbowR": (-72, 0, 0), "neck": (24, 0, 0)},
    "hold_stick": {"shoulderR": (-20, 10, 0), "elbowR": (-70, 0, 0)},
    "hold_box": {"shoulderL": (-62, 4, 0), "shoulderR": (-62, -4, 0), "elbowL": (-24, 0, 0), "elbowR": (-24, 0, 0), "neck": (12, 0, 0)},
}


def zc_prop(kind, name, on=True):
    """the three tested hand props at real size (local character units: a kid is ~6.6 tall before scaling)"""
    C = None
    if kind == "phone":
        e = empty(name, (0, 0, 0))
        box(name + "_body", (0.42, 0.08, 0.78), (0, 0, 0), mat(name + "_pb", zc_rgb("#22252B"), 0.35), 0.05, parent=e)
        box(name + "_scr", (0.36, 0.02, 0.68), (0, -0.05, 0), mat(name + "_ps", zc_rgb("#9FD8FF"), 0.2, emit=zc_rgb("#9FD8FF"), estr=2.5), 0.0, parent=e)
        e.rotation_euler = (math.radians(-60), 0, 0)
        return e
    if kind == "stick":
        e = empty(name, (0, 0, 0))
        cyl(name + "_s", 0.09, 3.2, (0, 0, 0.6), mat(name + "_sw", zc_rgb("#9A6B3F"), 0.8), 10, parent=e)
        return e
    if kind == "bucket":   # a metal bucket of light bulbs (full) or empty
        e = empty(name, (0, 0, 0))
        mm = mat(name + "_m", zc_rgb("#9AA4B0"), 0.35, metal=0.6)
        cyl(name + "_b", 0.42, 0.75, (0, 0, -0.55), mm, 24, parent=e, r2=0.34)
        cyl(name + "_rim", 0.44, 0.06, (0, 0, -0.18), mm, 24, parent=e)
        cyl(name + "_h", 0.03, 0.9, (0, 0, 0.0), mat(name + "_hm", zc_rgb("#5A5F66"), 0.4, metal=0.5), 8, rot=(0, 90, 0), parent=e)
        if on:
            for k, (x, y) in enumerate(((-0.15, -0.1), (0.15, 0.05), (0.0, 0.18), (0.12, -0.18))):
                sphere("%s_bulb%d" % (name, k), 0.17, (x, y, 0.0), mat(name + "_bulbm", zc_rgb("#FFF6D0"), 0.2, emit=zc_rgb("#FFE9A0"), estr=1.5), parent=e, seg=12)
        return e
    if kind == "flashlight":   # a torch: the lens glows when it is on (and lights what it points at)
        e = empty(name, (0, 0, 0))
        cyl(name + "_b", 0.1, 0.7, (0, -0.2, 0), mat(name + "_m", zc_rgb("#2E6FD8"), 0.4), 16, rot=(90, 0, 0), parent=e)
        cyl(name + "_hd", 0.15, 0.2, (0, -0.6, 0), mat(name + "_hm", zc_rgb("#C9CED6"), 0.3, metal=0.6), 16, rot=(90, 0, 0), parent=e)
        cyl(name + "_lens", 0.12, 0.03, (0, -0.71, 0), mat(name + "_lm", zc_rgb("#FFFBE0"), 0.1, emit=zc_rgb("#FFF4C0") if on else None, estr=12.0 if on else 0.0), 16, rot=(90, 0, 0), parent=e)
        if on:
            sp = light(name + "_beam", "SPOT", (0, -0.75, 0), 260, (1.0, 0.95, 0.8), 0.05, rot=(90, 0, 0), spot=40)
            sp.parent = e
        return e
    if kind == "drain":    # a storm drain in the road: a dark hole with a grate
        e = empty(name, (0, 0, 0))
        box(name + "_hole", (1.6, 1.0, 0.02), (0, 0, 0.02), mat(name + "_hm", zc_rgb("#0B0B0E"), 0.9), 0.0, parent=e)
        for k in range(6):
            box("%s_bar%d" % (name, k), (0.1, 1.0, 0.05), (-0.65 + k * 0.26, 0, 0.05), mat(name + "_gm", zc_rgb("#4A4E56"), 0.5, metal=0.6), 0.01, parent=e)
        return e
    if kind == "box":
        e = empty(name, (0, 0, 0))
        box(name + "_b", (1.5, 1.1, 1.0), (0, 0, 0), mat(name + "_bc", zc_rgb("#C89B62"), 0.85), 0.04, parent=e)
        box(name + "_t", (0.3, 1.12, 1.02), (0, 0, 0), mat(name + "_bt", zc_rgb("#E8D9B0"), 0.6), 0.0, parent=e)
        return e
    return C


def zc_studio(t0, t1, time="day"):
    """the reference-sheet studio: a soft cyclorama, a warm key, a cool fill, a rim; soft bloom"""
    W = bpy.context.scene.world or D.worlds.new("W")
    bpy.context.scene.world = W
    W.use_nodes = True
    bg = next(x for x in W.node_tree.nodes if x.type == "BACKGROUND")
    bg.inputs["Color"].default_value = (*zc_rgb("#B8C4D8" if time == "day" else "#1E2740"), 1)
    bg.inputs["Strength"].default_value = 0.6 if time == "day" else 0.25
    floor = mat("zc_cyc", zc_rgb("#D9DEE8" if time == "day" else "#2A3350"), 0.9)
    box("zc_floor", (60, 60, 0.2), (0, 0, -0.1), floor, 0.0)
    box("zc_wall", (60, 0.2, 40), (0, 14, 20), floor, 0.0)
    light("zc_key", "AREA", (-6, -9, 10), 1800, (1.0, 0.92, 0.82), 7.0, target=(0, 0, 3))
    light("zc_fill", "AREA", (8, -7, 5), 600, (0.78, 0.86, 1.0), 8.0, target=(0, 0, 3))
    light("zc_rim", "AREA", (3, 9, 9), 1400, (1.0, 0.95, 0.9), 4.0, target=(0, 0, 4))
    zc_soft_look()


def zc_soft_look(bloom=0.5, threshold=0.8):
    """THE LOOK: soft bloom on glows and highlights (the scene's own glare node when it has one)"""
    sc = bpy.context.scene
    try:
        ng = sc.compositing_node_group
    except Exception:
        ng = None
    gl = next((x for x in ng.nodes if x.type == "GLARE"), None) if ng is not None else None
    if gl is None:
        print("zc_soft_look: no glare node in this scene")
        return
    try:
        gl.inputs["Strength"].default_value = bloom
        gl.inputs["Threshold"].default_value = threshold
    except Exception:
        pass
# ===== END OF v2 CHARACTER =============================================================================================


# ---------------------------------------------------------------- MOTION (the preview / the final video)
def zc_blinks(ch, t0, t1, every=2.6):
    """blinks every ~2.6 s (3 frames each); the Mimic never blinks"""
    t = t0 + 0.5 + (hash(ch.name) % 7) * 0.13
    while t < t1 - 0.2:
        ch.blink(t)
        t += every + ((int(t * 10) % 5) - 2) * 0.15


def zc_idle(ch, t0, t1, amp=1.0):
    """a living hold: breathing (a slow torso lift) and a small sway of the head; nobody stands frozen"""
    if not isinstance(ch, ZChar):
        return
    base_t = tuple(ch.torso.rotation_euler)
    base_n = tuple(ch.neck.rotation_euler)
    t, k = t0, 0
    while t <= t1 + 0.01:
        s = math.sin(k * 1.7 + len(ch.name))
        ch.torso.rotation_euler = (base_t[0] + math.radians(1.6 * amp * s), base_t[1], base_t[2] + math.radians(1.2 * amp * s))
        ch.neck.rotation_euler = (base_n[0] + math.radians(-2.0 * amp * s), base_n[1] + math.radians(1.5 * amp * math.cos(k * 1.3)), base_n[2])
        key(ch.torso, "rotation_euler", F(t))
        key(ch.neck, "rotation_euler", F(t))
        t += 1.1
        k += 1


def zc_react(ch, t0, face, default="neutral", delay=0.27):
    """a reaction lands 6-8 frames after the cut, head first: the default face at the cut, the reaction a beat later"""
    if face == default:
        ch.express(t0, face)
        return
    ch.express(t0, default)
    ch.express(t0 + delay, face)
    n = ch.neck
    r0 = tuple(n.rotation_euler)
    n.rotation_euler = (r0[0] - math.radians(6), r0[1], r0[2])
    key(n, "rotation_euler", F(t0 + delay * 0.6))
    n.rotation_euler = r0
    key(n, "rotation_euler", F(t0 + delay + 0.25))


def zc_walk(ch, t0, t1, run=False, back=1.6):
    """walking: the legs and arms swing, the body moves forward onto its spot; it starts BEFORE the cut"""
    step = 0.17 if run else 0.26
    sw = 42 if run else 26
    end = ch.root.location.copy()
    a = ch.root.rotation_euler[2]
    fwd = Vector((math.sin(a), -math.cos(a), 0.0))
    start = end - fwd * back * (1.6 if run else 1.0)
    tA = t0 - 0.35
    ch.root.location = start
    key(ch.root, "location", F(tA))
    ch.root.location = end
    key(ch.root, "location", F(t1))
    t, k = tA, 0
    while t <= t1:
        s = 1 if k % 2 == 0 else -1
        ch.thigh["L"].rotation_euler = (math.radians(-sw * s), 0, 0)
        ch.thigh["R"].rotation_euler = (math.radians(sw * s), 0, 0)
        ch.knee["L"].rotation_euler = (math.radians(10 + (30 if s < 0 else 0)), 0, 0)
        ch.knee["R"].rotation_euler = (math.radians(10 + (30 if s > 0 else 0)), 0, 0)
        ch.shoulder["L"].rotation_euler = (math.radians(sw * 0.8 * s), math.radians(-6), 0)
        ch.shoulder["R"].rotation_euler = (math.radians(-sw * 0.8 * s), math.radians(6), 0)
        for ob in (ch.thigh["L"], ch.thigh["R"], ch.knee["L"], ch.knee["R"], ch.shoulder["L"], ch.shoulder["R"]):
            key(ob, "rotation_euler", F(t))
        t += step
        k += 1


def zc_look(ch, t, pt, max_head=35.0):
    """a seated person: the body stays at the table, the head turns (at most 35 degrees) toward what they look at"""
    r = ch.root.location
    yb = ch.root.rotation_euler[2]
    yl = math.atan2(pt[0] - r.x, -(pt[1] - r.y))
    d = (yl - yb + math.pi) % (2 * math.pi) - math.pi
    h = max(-math.radians(max_head), min(math.radians(max_head), d))
    ch.neck.rotation_euler = (ch.neck.rotation_euler[0], ch.neck.rotation_euler[1], ch.neck.rotation_euler[2] + h)
    key(ch.neck, "rotation_euler", F(t), interp="CONSTANT")


def zv_at_window(ch, wc, inside=0.9):
    """someone standing inside an opened front window: the head in the opening, a little high (their body below the sill)"""
    if wc is None:
        return
    bpy.context.view_layer.update()
    hc = zc_head_c(ch)
    r = ch.root.location
    ch.root.location = (wc.x + (r.x - hc.x), wc.y + inside + (r.y - hc.y), r.z + (wc.z + 0.45 - hc.z))


def zv_window_cam(t0, t1, wc, dist=6.2, lens=40, side=0.3, push=0.06, ch=None):
    """the face at the window from outside: the head high in the frame (the captions below), a slow push"""
    if wc is None:
        cam = Cam()
        cam.key(t0, (0, -20, 5), (0, 0, 2), lens=30)
        return cam
    hz = zc_head_c(ch).z if ch is not None else wc.z + 0.45
    loc = Vector((wc.x + side, wc.y - dist, hz - 0.3))
    tgt = Vector((wc.x, wc.y + 0.9, hz - 0.62))    # the head high in the frame (a hat fits), both curtains at the sides
    f = (tgt - loc).length
    cam = Cam()
    cam.key(t0, tuple(loc), tuple(tgt), lens=lens, focus=f, fstop=2.4)
    e = loc + (tgt - loc) * push
    cam.key(t1, tuple(e), tuple(tgt), lens=lens, focus=f * (1.0 - push), fstop=2.4)
    return cam
