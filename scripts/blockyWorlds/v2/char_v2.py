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


def zc_mat(n, key, hexcol, rough=0.6, emit=None, estr=0.0, coat=0.0, spec=0.4):
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
        if S["outfit"] == "hoodie":
            box(n + "_pocket", (tw * 0.64, 0.07, 0.58), (0, -td / 2 - 0.02, 0.62), top2, 0.05, parent=self.torso, coll=self.coll)
            box(n + "_pocketline", (tw * 0.6, 0.02, 0.03), (0, -td / 2 - 0.06, 0.9), trim, 0.0, parent=self.torso, coll=self.coll)
            box(n + "_hood", (tw * 0.78, 0.5, 0.6), (0, td / 2 + 0.12, tl - 0.05), top, 0.24, parent=self.torso, coll=self.coll)
            box(n + "_hoodrim", (tw * 0.82, 0.22, 0.2), (0, td / 2 - 0.02, tl + 0.18), top2, 0.08, parent=self.torso, coll=self.coll)
            cyl(n + "_collar", 0.56, 0.2, (0, 0, tl + 0.12), top2, 28, bev=0.06, parent=self.torso, coll=self.coll)
            for s in (-1, 1):
                cyl("%s_string%d" % (n, s), 0.035, 0.62, (s * 0.22, -td / 2 - 0.05, tl - 0.3), trim, 8, parent=self.torso, coll=self.coll)
                cyl("%s_aglet%d" % (n, s), 0.052, 0.12, (s * 0.22, -td / 2 - 0.05, tl - 0.66), zc_mat(n, "aglet", "#C9CED6", rough=0.3, spec=0.8), 8, parent=self.torso, coll=self.coll)
        else:   # shirt: collar points, a button line, a chest pocket
            for s in (-1, 1):
                box("%s_collar%d" % (n, s), (0.42, 0.08, 0.3), (s * 0.24, -td / 2 - 0.02, tl - 0.08), top2, 0.04, rot=(0, s * 28, 0), parent=self.torso, coll=self.coll)
            box(n + "_placket", (0.16, 0.04, tl - 0.4), (0, -td / 2 - 0.01, tl / 2 - 0.05), top2, 0.01, parent=self.torso, coll=self.coll)
            for k in range(4):
                cyl("%s_button%d" % (n, k), 0.05, 0.04, (0, -td / 2 - 0.04, tl - 0.45 - k * 0.42), trim, 12, rot=(90, 0, 0), parent=self.torso, coll=self.coll)
            box(n + "_chestpk", (0.5, 0.05, 0.46), (-tw * 0.26, -td / 2 - 0.02, tl - 0.75), top2, 0.03, parent=self.torso, coll=self.coll)
            cyl(n + "_collar", 0.5, 0.16, (0, 0, tl + 0.1), top2, 28, bev=0.04, parent=self.torso, coll=self.coll)
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
            box("%s_fore%s" % (n, side), (0.78, 0.84, fa), (0, 0, -fa / 2 + 0.04), top, 0.14, parent=ep, coll=self.coll)
            box("%s_cuff%s" % (n, side), (0.84, 0.9, 0.24), (0, 0, -fa + 0.1), top2, 0.06, parent=ep, coll=self.coll)
            box("%s_hand%s" % (n, side), (0.62, 0.66, 0.52), (0, 0, -fa - 0.22), skin, 0.2, parent=ep, coll=self.coll)
            box("%s_thumb%s" % (n, side), (0.2, 0.26, 0.3), (-s * 0.31, -0.12, -fa - 0.16), skin, 0.08, parent=ep, coll=self.coll)
            self.hand[side] = empty("%s_hold%s" % (n, side), (0, -0.05, -fa - 0.3), ep, self.coll)
            self.shoulder[side], self.elbow[side] = sp, ep
        # ---- neck + head (a soft rounded block) + ears + nose
        self.neck = empty(n + "_neck", (0, 0, tl + 0.12), self.torso, self.coll)
        cyl(n + "_neckm", 0.3, 0.3, (0, 0, 0.1), skin, 20, parent=self.neck, coll=self.coll)
        hw, hd, hh = 1.9 * hs, 1.8 * hs, 1.75 * hs
        self.hdim = (hw, hd, hh)
        self.head = box(n + "_head", (hw, hd, hh), (0, 0, 0.1 + hh / 2), skin, 0.34 * hs, parent=self.neck, coll=self.coll, seg=6)
        for s in (-1, 1):
            sphere("%s_ear%d" % (n, s), 0.2 * hs, (s * hw / 2, 0.08, -0.02), skin, (0.45, 0.9, 1.15), parent=self.head, coll=self.coll, seg=16)
        sphere(n + "_nose", 0.085 * hs, (0, -hd / 2 - 0.01, -0.12 * hs), skin2, (1.2, 0.7, 0.9), parent=self.head, coll=self.coll, seg=16)
        self._face(hs, hw, hd, hh)
        self._hair(hs, hw, hd, hh)
        # ---- the whole body to the spec's height (world units)
        self.local_h = hip_z + 0.05 + tl + 0.12 + 0.1 + hh + S.get("hair_top", 0.3) * hs
        k = S["height"] / self.local_h
        self.root.scale = (k, k, k)
        self.k = k
        self.expr = "neutral"
        self.pose(0, "stand")
        self.express(0, "neutral")
        CHARS_V2[name] = self

    # ------------------------------------------------------------------ THE FACE
    def _face(self, hs, hw, hd, hh):
        n, H, C = self.name, self.head, self.coll
        c = self.spec["colors"]
        fy = -hd / 2
        eye_m = zc_mat(n, "eye", c.get("eyes", "#1B1410"), rough=0.12, spec=0.9, coat=0.6)
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
            sphere("%s_eye%s" % (n, side), er, (0, 0.02, 0), eye_m, (1.0, 0.38, 1.28), parent=ep, coll=C, seg=24)
            sphere("%s_glint%s" % (n, side), 0.055 * hs, (-0.06 * hs, -0.07, 0.1 * hs), glint, parent=ep, coll=C, seg=12)
            sphere("%s_glint2%s" % (n, side), 0.025 * hs, (0.05 * hs, -0.07, -0.06 * hs), glint, parent=ep, coll=C, seg=8)
            self.F["eyes"][side], self.F["eye0"][side] = ep, (s * ex, fy, ez)
            # upper lid: pivot at the eye's top edge, a lid that grows down over the eye (scale z = how closed)
            lp = empty("%s_lidp%s" % (n, side), (s * ex, fy - 0.045, ez + er * 1.28), H, C)
            sphere("%s_lid%s" % (n, side), er * 1.1, (0, 0.03, -er * 1.28), zc_mat(n, "lidskin", c["skin"], rough=0.55), (1.08, 0.48, 1.32), parent=lp, coll=C, seg=24)
            self.F["lid"][side] = lp
            # lower lid: a curved cheek that rises (the smiling eye)
            lo = empty("%s_lowp%s" % (n, side), (s * ex, fy - 0.04, ez - er * 1.28), H, C)
            sphere("%s_low%s" % (n, side), er * 1.1, (0, 0, -er * 1.05), zc_mat(n, "cheek", c["skin"], rough=0.55), (1.1, 0.22, 0.8), parent=lo, coll=C, seg=20)
            self.F["low"][side] = lo
            bp = empty("%s_browp%s" % (n, side), (s * ex, fy - 0.03, ez + 0.4 * hs), H, C)
            box("%s_brow%s" % (n, side), (0.4 * hs, 0.07, 0.09 * hs), (0, 0, 0), brow_m, 0.035, parent=bp, coll=C)
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
            e = empty("%s_mouth_%s" % (n, key), (0, fy - 0.02, mz), H, C)
            M[key] = e
            return e
        r = 0.035 * hs
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
        top = hh / 2
        m = zc_hair_mat(n, c["hair"], c["hair_light"], top * 0.3, top + 0.5 * hs, ref=self.head)
        H, C = self.head, self.coll
        # the cover: never a bald side or back (a cap over the crown, a wrap round the back and the sides)
        box(n + "_hcap", (hw + 0.14 * hs, hd + 0.14 * hs, 0.62 * hs), (0, 0.02 * hs, top - 0.18 * hs), m, 0.3 * hs, parent=H, coll=C, seg=5)
        drop = {"swoop": 0.55, "short": 0.75, "bun": 0.35}.get(st, 0.6)
        box(n + "_hwrap", (hw + 0.12 * hs, hd * 0.62, top * (1.0 + drop) - 0.1 * hs), (0, hd * 0.22 + 0.06 * hs, top * (1.0 - drop) / 2 + 0.05 * hs), m, 0.28 * hs, parent=H, coll=C, seg=5)
        E = []
        if st == "swoop":   # Me: a full mop with a side-swept fringe, a crown tuft and a back that covers the head
            E += [((-0.3 * hs, -hd * 0.5, top - 0.12 * hs), (0.62 * hs, 0.3 * hs, 0.32 * hs), (0, -18, 14)),   # the swept fringe
                  ((0.32 * hs, -hd * 0.48, top - 0.02 * hs), (0.46 * hs, 0.28 * hs, 0.28 * hs), (0, 22, -16)),
                  ((0.72 * hs, -hd * 0.36, top - 0.2 * hs), (0.28 * hs, 0.24 * hs, 0.3 * hs), (0, 30, -10)),
                  ((0.05 * hs, -0.1 * hs, top + 0.22 * hs), (0.42 * hs, 0.48 * hs, 0.3 * hs), (16, 0, 0)),     # the crown swirl
                  ((-0.32 * hs, 0.36 * hs, top + 0.14 * hs), (0.34 * hs, 0.38 * hs, 0.3 * hs), (-20, 12, 0)),
                  ((0.38 * hs, 0.3 * hs, top + 0.12 * hs), (0.3 * hs, 0.36 * hs, 0.28 * hs), (-14, -18, 0)),
                  ((-0.42 * hs, hd * 0.56, top * 0.62), (0.4 * hs, 0.2 * hs, 0.36 * hs), (0, 0, 10)),     # the back, in locks
                  ((0.38 * hs, hd * 0.56, top * 0.55), (0.42 * hs, 0.2 * hs, 0.36 * hs), (0, 0, -12)),
                  ((-0.2 * hs, hd * 0.58, top * 0.05), (0.42 * hs, 0.2 * hs, 0.34 * hs), (0, 0, 8)),
                  ((0.3 * hs, hd * 0.58, top * -0.05), (0.38 * hs, 0.2 * hs, 0.32 * hs), (0, 0, -6)),
                  ((0.0, hd * 0.56, top * -0.42), (0.5 * hs, 0.18 * hs, 0.2 * hs), None),               # the nape
                  ((hw * 0.56, hd * 0.12, top * 0.5), (0.16 * hs, 0.4 * hs, 0.34 * hs), (0, 0, 0)),     # the sides, over the ears
                  ((-hw * 0.56, hd * 0.12, top * 0.5), (0.16 * hs, 0.4 * hs, 0.34 * hs), (0, 0, 0)),
                  ((hw * 0.55, hd * 0.36, top * 0.05), (0.15 * hs, 0.3 * hs, 0.3 * hs), None),
                  ((-hw * 0.55, hd * 0.36, top * 0.05), (0.15 * hs, 0.3 * hs, 0.3 * hs), None)]
        elif st == "short":  # an adult: short, neat, a side part
            E += [((0, 0.08 * hs, top - 0.02 * hs), (hw * 0.6, hd * 0.6, 0.36 * hs), None),
                  ((0, hd * 0.38, top * 0.3), (hw * 0.58, hd * 0.3, top * 0.95), None),
                  ((hw * 0.5, hd * 0.12, top * 0.55), (0.18 * hs, hd * 0.44, top * 0.5), None),
                  ((-hw * 0.5, hd * 0.12, top * 0.55), (0.18 * hs, hd * 0.44, top * 0.5), None),
                  ((0.28 * hs, -hd * 0.46, top - 0.06 * hs), (hw * 0.36, 0.26 * hs, 0.2 * hs), (0, 10, 0))]
        elif st == "bun":    # a grandma: grey, a bun on top
            E += [((0, 0.06 * hs, top - 0.02 * hs), (hw * 0.6, hd * 0.6, 0.4 * hs), None),
                  ((0, hd * 0.38, top * 0.3), (hw * 0.58, hd * 0.3, top * 1.0), None),
                  ((0, 0.1 * hs, top + 0.5 * hs), (0.4 * hs, 0.4 * hs, 0.36 * hs), None)]
        zc_meta(n + "_hair", self.head, E, m, self.coll)

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
            v = 1.0 if k == X["mouth"] else 0.0001
            e.scale = (v, v, v)
            key(e, "scale", f, interp="CONSTANT")
        for ob in self.F["blush"]:
            v = 1.0 if X.get("blush") else 0.0001
            ob.scale = (1.3 * v, 0.2 * v, 0.75 * v)
            key(ob, "scale", f, interp="CONSTANT")
        v = 1.0 if X.get("tears") else 0.0001
        self.F["tears"].scale = (v, v, v)
        key(self.F["tears"], "scale", f, interp="CONSTANT")

    def blink(self, t):
        """the lids close for 3 frames and open again (on top of the expression's lid)"""
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

    def hold(self, t, thing, hands="R"):
        """a prop in one hand (L / R) or between both hands ("both"), placed where the posed hands really are, at the
        character's scale, turned with the body (the still's hands do not move)"""
        bpy.context.view_layer.update()
        hp = {k: self.hand[k].matrix_world.translation.copy() for k in ("L", "R")}
        yaw = self.root.rotation_euler[2]
        thing.scale = (self.k, self.k, self.k)
        p = (hp["L"] + hp["R"]) / 2.0 if hands == "both" else hp[hands]
        thing.location = (p.x, p.y, p.z + (0.05 * self.k if hands == "both" else 0.0))
        thing.rotation_euler = (thing.rotation_euler[0], 0.0, yaw)
        return thing


CHARS_V2 = {}


def zc_head_c(ch):
    bpy.context.view_layer.update()
    pts = zw_pts([ch.head])
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
    "point":  {"shoulderR": (-92, 4, 0), "elbowR": (0, 0, 0), "torso": (0, 0, 8), "neck": (0, 0, -6), "shoulderL": (0, -8, 0)},
    "hold_up": {"shoulderR": (-168, 6, 0), "elbowR": (-8, 0, 0), "shoulderL": (0, -10, 0), "neck": (-10, 0, 0)},
    "look_back": {"torso": (0, 0, 24), "neck": (0, 0, 68), "shoulderL": (8, -8, 0), "shoulderR": (-6, 8, 0)},
    "hold_phone": {"shoulderL": (-30, 12, 0), "shoulderR": (-30, -12, 0), "elbowL": (-72, 0, 0), "elbowR": (-72, 0, 0), "neck": (24, 0, 0)},
    "hold_stick": {"shoulderR": (-20, 10, 0), "elbowR": (-70, 0, 0)},
    "hold_box": {"shoulderL": (-62, 4, 0), "shoulderR": (-62, -4, 0), "elbowL": (-24, 0, 0), "elbowR": (-24, 0, 0), "neck": (12, 0, 0)},
}


def zc_prop(kind, name):
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
