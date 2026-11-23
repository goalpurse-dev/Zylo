# ===== ROUND 9f (owner 2026-11-23): ACTING, THE STORM, THE LAMPS, LIGHT AS STATE, SHARP CLOSE SHOTS ===================
# Pasted after stage9e.py.
#   ACTING      zs_act: every character on stage, every line: a FEEL played as a face AND a body (scared = wide eyes,
#               arms pulled in / up, a step back, shaking; confident = a smirk, chin up, hands on hips; relieved = a
#               breath out), a LOOK (the head turns to it, the body too when it is behind), from the plan
#   REACTIONS   back away (facing the threat, small steps back), hide (crouched, arms over the head), try to redraw a
#               line (crouched, scrubbing with the chalk)
#   THE DOOR    marks "door" (in the open doorway), "door_side" (beside it on the porch), "line_front" (just inside
#               the front of the house's line, in front of the door)
#   THE LAMPS   zs_lamps_out: the row of street lamps goes out ONE BY ONE, far to near, one per beat (each a dark bulb);
#               the "lamps" shot looks down that row
#   LIGHT       the monster's rim / fill / key lights are off for a pure black monster (they lit the whole street:
#               daytime in the middle of the night); a morning = a low warm sun, a weak fill, darker warm greens
#   SHARP       no motion blur; a close shot keeps the whole hand + the thing inside the frame; the part check
#               (ZW_GATE|S..|part|bigpart|share): one body part filling > 60 % of the frame fails

ZS_LIBRARY["acting"] = ("animation", "a feel played as a face and a body + a look at someone / something, every line, every character (zs_act)")
ZS_LIBRARY["back_away"] = ("animation", "backing away from a threat, facing it (zs_back_away)")
ZS_LIBRARY["hide"] = ("animation", "hiding: crouched, arms over the head (zs_hide_pose)")
ZS_LIBRARY["try_draw"] = ("animation", "crouched at a line, trying to redraw it with the chalk (zs_try_draw)")
ZS_LIBRARY["lamps_out"] = ("effect", "the street lamps going out one by one, far to near, one per beat, each bulb going dark (zs_lamps_out)")
ZS_LIBRARY["cam_lamps"] = ("camera", "down the dark street at the row of lamps (shot lamps)")
ZS_LIBRARY["door_marks"] = ("set piece", "the house's open doorway, beside it on the porch, the front of the house's line (marks door / door_side / line_front)")
ZS_LIBRARY["sunrise"] = ("light", "a golden sunrise: a low warm sun, a weak fill, darker warm greens, a golden sky")

ZS_SHADOW = set()
ZS_FEEL_FACE = {"scared": "scared", "terrified": "terrified", "panic": "terrified", "worried": "scared", "confident": "smirk", "relieved": "happy", "happy": "happy", "loving": "happy", "sad": "sad", "determined": "determined", "serious": "determined", "calm": "neutral", "shocked": "shocked", "curious": "surprised", "angry": "angry", "hungry": "angry"}


def zs_pos_of(x, t):
    if x is None:
        return None
    if hasattr(x, "root"):
        zs_upd(t)
        p = za_here(x, t)
        vp = zw_pts([x.head]) if hasattr(x, "head") else []
        z = max([q.z for q in vp] + [p.z + 2.0])
        return Vector((p.x, p.y, z))
    if hasattr(x, "matrix_world"):
        zs_upd(t)
        return Vector(x.matrix_world.translation)
    return Vector((float(x[0]), float(x[1]), float(x[2]) if len(x) > 2 else 0.0))


# ---------------------------------------------------------------- ACTING
def zs_look_at(ch, look, t0, t1, body=True, feel="calm"):
    """the head turns to `look` all line long (the body first when it is behind); confident = chin up"""
    tt = t0 + 0.15
    first = True
    while tt <= t1 + 0.01:
        q = zs_pos_of(look, tt)
        if q is None:
            return
        p = za_here(ch, tt)
        want = za_yaw(Vector((p.x, p.y, 0.0)), Vector((q.x, q.y, 0.0)))
        cur = zm_yaw_at(ch, tt)
        rel = ((want - cur + 180.0) % 360.0) - 180.0
        if first and body and abs(rel) > 75.0:
            zm_turn(ch, tt, want, dur=0.4)
            rel = 0.0
        first = False
        hz = ch.head.matrix_world.translation.z if hasattr(ch, "head") else p.z + 2.0
        dist = max(0.5, (Vector((q.x, q.y, 0.0)) - Vector((p.x, p.y, 0.0))).length)
        down = -math.degrees(math.atan2(q.z - hz, dist))
        down = max(-35.0, min(30.0, down)) + (-10.0 if feel == "confident" else 0.0)
        ch.pose(tt, head=(max(-70.0, min(70.0, rel)), down, 0))
        tt += 0.6


def zs_body_feel(ch, feel, t0, t1, look=None):
    """the body plays the feel (only when the character has no action of its own in the line)"""
    held = zs_held(ch, t0)
    zm_hold(ch, t0, ("armL", "torso") if held else ("armL", "armR", "torso"), root=False)

    def arms(t, a):
        if held:
            ch.pose(t, armL=a)
        else:
            ch.pose(t, armL=a, armR=a)
    if feel in ("scared", "worried", "terrified", "panic"):
        up = feel in ("terrified", "panic")
        a = (150, 22) if up else (48, -14)
        arms(t0 + 0.3, a)
        arms(t1, a)
        q = zs_pos_of(look, t0) if look is not None else None
        if q is not None and feel != "worried":
            p = za_here(ch, t0)
            v = Vector((p.x - q.x, p.y - q.y, 0.0))
            if v.length > 1e-3:
                v.normalize()
                back = (0.9 if up else 0.5) * zw_ps() / 0.55
                ch.pose(t0 + 0.05, loc=tuple(p), interp="LINEAR")
                ch.pose(t0 + 0.6, loc=tuple(p + v * back), interp="LINEAR")
                ch.pose(t0 + 0.2, legL=(-18, 0))
                ch.pose(t0 + 0.4, legL=(0, 0), legR=(-18, 0))
                ch.pose(t0 + 0.6, legR=(0, 0))
        tt, k = t0 + 0.35, 0
        while tt < t1:
            ch.pose(tt, torso=(0, 4 if up else 2, 3 if k % 2 else -3))
            tt += 0.11
            k += 1
        ch.pose(t1, torso=(0, 0, 0))
    elif feel == "confident":
        arms(t0 + 0.35, (-14, 40))
        arms(t1, (-14, 40))
        ch.pose(t0 + 0.35, torso=(0, -4, 0))
    elif feel == "relieved":
        arms(t0 + 0.3, (4, 6))
        ch.pose(t0 + 0.3, torso=(0, 10, 0))
        ch.pose(t0 + 0.9, torso=(0, 0, 0))
    elif feel == "sad":
        arms(t0 + 0.4, (2, 4))
        ch.pose(t0 + 0.4, torso=(0, 8, 0))
    elif feel in ("happy", "loving"):
        arms(t0 + 0.3, (8, 10))
    elif feel in ("determined", "serious", "angry"):
        arms(t0 + 0.3, (16, 10))
    else:
        arms(t0 + 0.3, (3, 5))


def zs_act(ch, t0, t1, feel, look=None, body=True, talk=False):
    """ACTING: the feel as a face (+ a body when free) and the look, for the whole line"""
    if ch is None:
        return ch
    zw_emote(ch, t0, t1, ZS_FEEL_FACE.get(feel, "neutral"), talk=talk)
    if body:
        zs_try(zs_body_feel, ch, feel, t0, t1, look)
    if look is not None:
        zs_try(zs_look_at, ch, look, t0, t1, body, feel)
    return ch


def zs_back_away(ch, t0, t1, frm):
    """BACK AWAY from a threat: facing it, small steps back"""
    if ch is None:
        return ch
    q = zs_pos_of(frm, t0) if frm is not None else None
    p = za_here(ch, t0)
    if q is None:
        q = p + zs_fwd(ch, t0) * 5.0
    v = Vector((p.x - q.x, p.y - q.y, 0.0))
    v = v.normalized() if v.length > 1e-3 else Vector((0.0, 1.0, 0.0))
    face = za_yaw(Vector((p.x, p.y, 0.0)), Vector((q.x, q.y, 0.0)))
    d = max(0.8, t1 - t0)
    dist = min(3.0, 1.2 * d) * zw_ps() / 0.55
    zm_hold(ch, t0)
    ch.pose(t0 + 0.2, rot=face)
    ch.pose(t0 + 0.05, loc=tuple(p), interp="LINEAR")
    ch.pose(t0 + d, loc=tuple(p + v * dist), interp="LINEAR")
    tt, k = t0 + 0.2, 0
    while tt < t0 + d - 0.1:
        sg = 1 if k % 2 == 0 else -1
        ch.pose(tt, legL=(-16 * sg, 0), legR=(16 * sg, 0))
        tt += 0.28
        k += 1
    ch.pose(t0 + d, legL=(0, 0), legR=(0, 0))
    return ch


def zs_hide_pose(ch, t0, t1):
    if ch is None:
        return ch
    zm_hold(ch, t0, root=False)
    ch.pose(t0 + 0.35, hipz=-0.7, torso=(0, 36, 0), armL=(155, 12), armR=(155, 12), legL=(40, 0), legR=(40, 0))
    ch.pose(t1, hipz=-0.7, torso=(0, 36, 0), armL=(155, 12), armR=(155, 12), legL=(40, 0), legR=(40, 0))
    ch.pose(t1 + 0.4, hipz=0.0, torso=(0, 0, 0), armL=(0, 4), armR=(0, 4), legL=(0, 0), legR=(0, 0))
    return ch


def zs_try_draw(ch, t0, t1):
    """crouched at the line, scrubbing at the ground with the chalk, then standing up"""
    if ch is None:
        return ch
    zm_hold(ch, t0, root=False)
    ch.pose(t0 + 0.3, hipz=-0.6, torso=(0, 40, 0), legL=(36, 0), legR=(36, 0), armL=(30, 10))
    tt, k = t0 + 0.35, 0
    while tt < t1 - 0.1:
        ch.pose(tt, armR=(70 + (12 if k % 2 else 0), -10, 0))
        tt += 0.22
        k += 1
    ch.pose(t1, hipz=-0.6, torso=(0, 40, 0))
    ch.pose(t1 + 0.35, hipz=0.0, torso=(0, 0, 0), legL=(0, 0), legR=(0, 0), armL=(0, 4), armR=(10, 4))
    return ch


# ---------------------------------------------------------------- THE DOOR, THE FRONT OF THE LINE
def zs_door_obj(ring):
    c = Vector(zs_ring_center(ring)) if ring is not None else Vector((0.0, 20.0, 0.0))
    doors = [o for o in D.objects if o.name.startswith("zw_hdoor") and o.name[8:].isdigit()]
    if not doors:
        return None
    return min(doors, key=lambda o: (Vector((o.matrix_world.translation.x, o.matrix_world.translation.y, 0.0)) - Vector((c.x, c.y, 0.0))).length)


def zs_door_pt(ring, kind="door"):
    """in the open doorway ("door"), or beside it on the porch ("door_side"); the door leaf swings away (open)"""
    o = zs_door_obj(ring)
    if o is None:
        c = zs_ring_center(ring)
        return (c[0], c[1], 0.0)
    d = Vector(o.matrix_world.translation)
    inward = 1.0 if d.y > 0 else -1.0
    if not o.get("zs_open"):
        o.scale = (0.0001, 0.0001, 0.0001)
        o["zs_open"] = 1
    if kind == "door_side":
        return (d.x + 1.6 * zw_ps() / 0.55, d.y - inward * 0.75, 0.0)
    return (d.x, d.y - inward * 0.35, 0.0)


def zs_line_front_pt(ring):
    """just inside the front of the house's line, in front of the door"""
    P = zs_ring_pts(ring)
    o = zs_door_obj(ring)
    if not P:
        return (0.0, 16.0, 0.0)
    ymin = min(abs(p[1]) for p in P)
    front = [p for p in P if abs(abs(p[1]) - ymin) < 0.5]
    fy = front[0][1]
    x = o.matrix_world.translation.x if o is not None else sum(p[0] for p in front) / len(front)
    xs = sorted(p[0] for p in front)
    x = max(xs[0] + 0.5, min(xs[-1] - 0.5, x))
    inward = 1.0 if fy > 0 else -1.0
    return (x, fy + inward * 0.8, 0.0)


# ---------------------------------------------------------------- THE LAMPS ONE BY ONE
def zs_lamp_row():
    """the row of lamps the 'lamps' shot looks down (the side of the street with the most lamps near the stage) and the
    camera spot at its near end"""
    st_c, st_d, st_r, st_rot = zw_stage(ZS["place"] or "suburb_street")
    L = [o for o in D.objects if o.type == "LIGHT" and o.name.startswith("zw_lamplight") and abs(o.location.x - st_c.x) < 70.0]
    if not L:
        return None
    sides = {}
    for o in L:
        sides.setdefault(1 if o.location.y > 0 else -1, []).append(o)
    side = max(sides, key=lambda k: len(sides[k]))
    row = sorted(sides[side], key=lambda o: o.location.x)
    ys = sum(o.location.y for o in row) / len(row)
    cam = Vector((row[0].location.x - 7.0, ys - side * 3.2, 2.0))
    far = Vector((row[-1].location.x, ys, 3.2))
    return row, cam, far


def zs_lamp_off(o, t, on=False):
    f = F(t)
    if "zs_e0" not in o.data:
        o.data["zs_e0"] = float(o.data.energy if o.data.energy > 0 else 60.0)
    e = o.data["zs_e0"]
    o.data.energy = e if not on else 0.0
    o.data.keyframe_insert("energy", frame=f - 1)
    o.data.energy = 0.0 if not on else e
    o.data.keyframe_insert("energy", frame=f)
    if o.name.startswith("zw_lamplight"):
        r = 0.5 * o.data.shadow_soft_size / 0.5 if o.data.shadow_soft_size else 0.5
        sh = sphere("zw_lampoff%d_%s" % (f, o.name[12:]), r * 1.08, tuple(o.location), zw_m("lampoff", "#22252d", 0.6), seg=12)
        zt_vis(sh, -10.0, on)
        zt_vis(sh, t, not on)


def zs_lamps_out(times, on=False):
    """the lamps go out ONE BY ONE (one per beat), far to near from the lamps shot's spot; the rest of the town's
    lamps with the last beat"""
    if not times:
        return 0
    R = zs_lamp_row()
    if R is None:
        return zs_switch_all("lamps", times[0], on, stagger=0.35)
    row, cam, far = R
    order = sorted(row, key=lambda o: -(Vector((o.location.x, o.location.y, 0.0)) - Vector((cam.x, cam.y, 0.0))).length)
    pools = [o for o in D.objects if o.type == "LIGHT" and o.name.startswith("zw_lamppool")]
    done = set()
    for i, o in enumerate(order):
        t = times[min(i, len(times) - 1)]
        zs_lamp_off(o, t, on)
        done.add(o.name)
        for pl in pools:
            if (Vector((pl.location.x, pl.location.y, 0.0)) - Vector((o.location.x, o.location.y, 0.0))).length < 0.8:
                zs_lamp_off(pl, t, on)
                done.add(pl.name)
    for o in D.objects:
        if o.type == "LIGHT" and (o.name.startswith("zw_lamplight") or o.name.startswith("zw_lamppool")) and o.name not in done:
            zs_lamp_off(o, times[-1], on)
    print("ZW_LOOK|9f|lamps one by one (%d in the row, %d beats)" % (len(order), len(times)))
    return len(order)


ZS_SWITCH_ALL9F = zs_switch_all


def zs_switch_all(kind, t, on, stagger=0.02, near=None, radius=60.0):
    """(the lamps going off at a scene's start: the bulbs dark too)"""
    if kind == "lamps" and not on and stagger <= 0.05:
        for o in list(D.objects):
            if o.type == "LIGHT" and (o.name.startswith("zw_lamplight") or o.name.startswith("zw_lamppool")):
                zs_lamp_off(o, t, False)
        return 1
    return ZS_SWITCH_ALL9F(kind, t, on, stagger=stagger, near=near, radius=radius)


def zs_cam_lamps(t0, t1):
    R = zs_lamp_row()
    if R is None:
        return None
    row, cam, far = R
    c = Cam()
    c.key(t0, tuple(cam + Vector((-0.6, 0.0, 0.0))), tuple(far), lens=26)
    c.key(t1, tuple(cam), tuple(far), lens=26)
    ZW_FRAMED["cut"] = "9f lamps (%d in the row)" % len(row)
    return c


# ---------------------------------------------------------------- LIGHT: the pure black monster needs no rim lights
ZW_MON9F = zw_monster


def zw_monster(name, loc, rot=0.0, size=3.5, style="horns", **kw):
    m = ZW_MON9F(name, loc, rot=rot, size=size, style=style, **kw)
    if style == "shadow":
        ZS_SHADOW.add(m.name)
        ZS_SHADOW.add(name)
    return m


ZW_MON_RIM9F = zw_monster_rim


def zw_monster_rim(t0, t1):
    hid = {}
    for k in list(ZW_MON.keys()):
        if k in ZS_SHADOW:
            hid[k] = ZW_MON.pop(k)
    r = ZW_MON_RIM9F(t0, t1) if ZW_MON else 0
    ZW_MON.update(hid)
    return r


# ---------------------------------------------------------------- THE MORNING: a golden sunrise
def zs_green(c):
    return c[1] > c[0] * 1.12 and c[1] > c[2] * 1.12


def zs_greens_tone(mul):
    """every green surface (lawns, hedges, hills) darker and warmer (mul) or back to its own colour (None); the night's
    own darkening (ZS_DARK materials) is left alone"""
    for m in bpy.data.materials:
        if not m.use_nodes:
            continue
        if mul is None and any(m.name.startswith(k) for k in ZS_DARK):
            continue
        grass_tex = m.name.startswith("zw_grass")
        for nd in m.node_tree.nodes:
            if nd.type == "VALTORGB" and grass_tex:
                continue
            if nd.type == "BSDF_PRINCIPLED" and not nd.inputs["Base Color"].is_linked:
                if "zs_m0" not in m:
                    c = list(nd.inputs["Base Color"].default_value)
                    if mul is None or not zs_green(c):
                        continue
                    m["zs_m0"] = [float(v) for v in c]
                c = list(m["zs_m0"])
                nd.inputs["Base Color"].default_value = (c[0] * mul[0], c[1] * mul[1], c[2] * mul[2], 1.0) if mul else (c[0], c[1], c[2], 1.0)
            if nd.type == "VALTORGB":
                els = nd.color_ramp.elements
                key = "zs_mr0_" + nd.name
                if key not in m:
                    if mul is None or not any(zs_green(list(e.color)) for e in els):
                        continue
                    m[key] = [float(v) for e in els for v in e.color]
                f0 = list(m[key])
                for j, e in enumerate(els):
                    c = f0[4 * j: 4 * j + 4] if 4 * j + 3 < len(f0) else list(e.color)
                    e.color = (c[0] * mul[0], c[1] * mul[1], c[2] * mul[2], 1.0) if mul else (c[0], c[1], c[2], 1.0)


def zs_skies_gold(on):
    """the morning sky (the world gradient + any sky card) golden"""
    gold = (1.0, 0.66, 0.36)
    for w in list(bpy.data.worlds):
        if not w.use_nodes:
            continue
        for nd in w.node_tree.nodes:
            if nd.type != "VALTORGB":
                continue
            if True:
                key = "zs_sk0_" + nd.name
                if key not in w:
                    w[key] = [float(v) for e in nd.color_ramp.elements for v in e.color]
                f0 = list(w[key])
                for j, e in enumerate(nd.color_ramp.elements):
                    c = f0[4 * j: 4 * j + 4] if 4 * j + 3 < len(f0) else list(e.color)
                    e.color = (c[0] * 0.35 + gold[0] * 0.55, c[1] * 0.35 + gold[1] * 0.55, c[2] * 0.35 + gold[2] * 0.55, 1.0) if on else (c[0], c[1], c[2], 1.0)
    for m in bpy.data.materials:
        if not m.use_nodes or "sky" not in m.name.lower():
            continue
        for nd in m.node_tree.nodes:
            if nd.type == "BSDF_PRINCIPLED":
                for key in ("Base Color", "Emission Color", "Emission"):
                    if key in nd.inputs and not nd.inputs[key].is_linked:
                        sk = "zs_sm0_" + key.replace(" ", "_")
                        if sk not in m:
                            m[sk] = [float(v) for v in nd.inputs[key].default_value]
                        c = list(m[sk])
                        nd.inputs[key].default_value = (c[0] * 0.35 + gold[0] * 0.55, c[1] * 0.35 + gold[1] * 0.55, c[2] * 0.35 + gold[2] * 0.55, 1.0) if on else (c[0], c[1], c[2], 1.0)


def zs_sky_dome():
    """the morning sky the camera sees: a big golden dome (emissive, seen from inside, casts no shadow, lights nothing)"""
    if D.objects.get("zs_skydome9f") is not None:
        return
    st_c, st_d, st_r, st_rot = zw_stage(ZS["place"] or "suburb_street")
    M = zw_m("skydome9f", "#f1b26a", 1.0, emit="#f4b770", estr=1.0)
    o = sphere("zs_skydome9f", 420.0, (st_c.x, st_c.y, -30.0), M, (1.0, 1.0, 0.6), seg=32)
    if hasattr(o, "visible_shadow"):
        o.visible_shadow = False
    if hasattr(o, "visible_diffuse"):
        o.visible_diffuse = False
    if hasattr(o, "visible_glossy"):
        o.visible_glossy = False
    if hasattr(o, "visible_volume_scatter"):
        o.visible_volume_scatter = False
    print("ZW_LOOK|9f|sky dome")


def zs_light9f(time):
    if time in ("sunset", "morning"):
        for o in D.objects:
            if o.type == "LIGHT" and o.data.type == "SUN" and not o.name.startswith("zs_lightning"):
                if "zs_e9e" not in o.data:
                    o.data["zs_e9e"] = float(o.data.energy)
                b = o.data["zs_e9e"]
                if o.name.startswith("zw_fill"):
                    o.data.energy = b * 0.25
                elif time == "morning":
                    o.data.energy = b * 0.8
                    o.data.color = (1.0, 0.62, 0.32)
                    o.rotation_euler = (math.radians(80.0), 0.0, math.radians(-35.0))
        w = bpy.context.scene.world
        if w is not None and w.use_nodes and "zs_s9e" in w:
            for nd in w.node_tree.nodes:
                if nd.type == "BACKGROUND" and not nd.inputs["Color"].is_linked:
                    nd.inputs["Strength"].default_value = w["zs_s9e"] * 0.5
        zs_greens_tone((0.45, 0.4, 0.24) if time == "morning" else (0.5, 0.45, 0.28))
        zs_skies_gold(time == "morning")
        if time == "morning":
            zs_try(zs_sky_dome)
        print("ZW_LOOK|9f|light %s (low warm sun, weak fill, darker greens)" % time)
    else:
        zs_greens_tone(None)
        zs_skies_gold(False)


ZS_LIGHT9F = zs_light


def zs_light(time, t0, t1):
    r = ZS_LIGHT9F(time, t0, t1)
    zs_try(zs_light9f, time)
    return r


ZW_LOOK_APPLY9F = zw_look_apply


def zw_look_apply(*a, **k):
    r = ZW_LOOK_APPLY9F(*a, **k)
    if ZS.get("time9e") in ("sunset", "morning"):
        zs_try(zs_light9f, ZS["time9e"])
    return r


# ---------------------------------------------------------------- THE PIZZA BOX: the lid's print faces the camera
def zt_build_pizza_box(r, c=None, col=None):
    """a flat pizza box held up with its LID TO THE FRONT (the person faces -y): the red pizza print faces the camera"""
    n = ZT_N["n"]
    th = math.radians(70.0)

    def P(x, y, z):
        return (x, y * math.cos(th) - z * math.sin(th), y * math.sin(th) + z * math.cos(th) + 0.95)
    R = (70, 0, 0)
    box("zt_pzb%d" % n, (1.9, 1.9, 0.22), P(0, 0, 0.0), zt_m("pizzabox9e", "#eadcc2", 0.85), 0.02, rot=R, parent=r, coll=c)
    Mr = zt_m("pizzaprint9e", "#d2301f", 0.6)
    cyl("zt_pzc%d" % n, 0.74, 0.02, P(0, 0, 0.12), Mr, 28, rot=R, parent=r, coll=c)
    cyl("zt_pzq%d" % n, 0.6, 0.02, P(0, 0, 0.13), zt_m("pizzacheese9e", "#f3c13f", 0.6), 28, rot=R, parent=r, coll=c)
    Mp = zt_m("pizzapep9e", "#a3170c", 0.6)
    for k, (x, y) in enumerate(((0.3, 0.2), (-0.32, 0.25), (0.05, -0.35), (-0.25, -0.2), (0.35, -0.22), (-0.02, 0.42), (0.0, 0.0))):
        cyl("zt_pzp%d_%d" % (n, k), 0.11, 0.02, P(x, y, 0.145), Mp, 12, rot=R, parent=r, coll=c)
    for k, (x, y, w, dd) in enumerate(((0, -0.955, 1.9, 0.02), (0, 0.955, 1.9, 0.02), (-0.955, 0, 0.02, 1.9), (0.955, 0, 0.02, 1.9))):
        box("zt_pzs%d_%d" % (n, k), (w, dd, 0.09), P(x, y, 0.0), Mr, 0.0, rot=R, parent=r, coll=c)
    return r


# ---------------------------------------------------------------- THE WALL: a faint ring all round + the hit, readable
ZS_WALL9F = zs_wall_flash


def zs_wall_flash(center, rad, height, t, hit=None):
    r = ZS_WALL9F(center, rad, height, t, hit=hit)
    try:
        M = zw_m("wallring9f", "#cfeaff", 0.1, emit="#dff2ff", estr=0.35, alpha=0.06)
        hh = max(3.5, min(height, 6.0))
        for k in range(48):
            a = 2 * math.pi * k / 48.0
            box("zs_wallr%d_%d" % (F(t), k), (2 * math.pi * rad / 48.0 + 0.04, 0.04, hh), (rad * math.cos(a), rad * math.sin(a), hh / 2), M, 0.0, rot=(0, 0, math.degrees(a) + 90), parent=r)
    except Exception as e:
        print("ZW_LOOK|9f|wall ring skipped: %s" % str(e)[:120])
    return r


# ---------------------------------------------------------------- THE CAMERAS: sharp close shots, the dad from behind
def zs_cam_hand(t0, t1, ppl, Tt):
    """A HAND + THE THING (or the pocket): the whole hand / arm, the thing (and a giving hand) inside the frame with a
    margin, never an extreme close-up"""
    th = [o for o in Tt if "pts" not in o and not o.name.startswith("zs_")]
    if not th:
        return None
    o = th[0]
    tm = (t0 + t1) / 2.0
    zs_upd(tm)
    holder = ZS_HOLDER.get(o.name) or (ppl[0] if ppl else None)
    obs = [o]
    if holder is not None:
        arm = D.objects.get(holder.name + "_armR")
        if arm is not None:
            obs.append(arm)
        # (round 9h: the holder's head + body too: a medium close, the chalk a hand-sized stick, never a big block)
        for part in ("_head", "_torso"):
            ob = D.objects.get(holder.name + part)
            if ob is not None:
                obs.append(ob)
        pk = ZS_POCKETS.get(holder.name)
        if pk is not None:
            obs.append(pk)
    for (ha, hb, g, k, thg) in ZS_HANDOVERS:
        if ha < t1 and hb > t0 and g is not None:
            ga = D.objects.get(g.name + "_armR")
            if ga is not None:
                obs.append(ga)

    def pts_at(t):
        out = []
        for ob in obs:
            out += [ob.matrix_world @ Vector(cc) for cc in ob.bound_box] if ob.type == "MESH" else (zw_pts([ob]) or [])
        return out
    P = pts_at(tm)
    if not P:
        return None
    cm = Vector((sum(p.x for p in P) / len(P), sum(p.y for p in P) / len(P), sum(p.z for p in P) / len(P)))
    base = zs_street_dir(cm)
    dv = base
    if holder is not None:
        f = zs_fwd(holder, tm)
        if (f + base).length > 0.3:
            dv = (f + base).normalized()
    dirs = [dv, zs_rot(dv, 25), zs_rot(dv, -25), base]
    skip = ((holder.name + "_",) if holder is not None else ()) + ("zt_", "zs_pocket")
    cam = zs_fit(t0, t1, pts_at, dirs, 35, frac=None, zc=cm.z + 0.35 * zw_ps() / 0.55, aimz=cm.z, margin=0.14, push=0.03, d0=1.6 * zw_ps() / 0.55, skip=skip)
    ZW_FRAMED["cut"] = "9f hand (whole hand + %s in frame)" % o.name
    return cam


def zs_cam_behind(t0, t1, ch, ahead):
    """A PERSON FROM BEHIND facing what is ahead: they face it in this shot, the camera behind their back"""
    tm = (t0 + t1) / 2.0
    zs_upd(tm)
    pc = za_here(ch, tm)
    pa = za_here(ahead, tm) if ahead is not None and hasattr(ahead, "root") else pc + zs_fwd(ch, tm) * 8.0
    yaw = za_yaw(Vector((pc.x, pc.y, 0.0)), Vector((pa.x, pa.y, 0.0)))
    ch.pose(t0 - 0.35, rot=yaw)
    ch.pose(t1 + 0.1, rot=yaw)
    zs_upd(tm)
    f = Vector((pa.x - pc.x, pa.y - pc.y, 0.0))
    dist = f.length
    f = f.normalized() if dist > 1e-3 else Vector((0.0, -1.0, 0.0))
    side = Vector((f.y, -f.x, 0.0))
    P = zw_vpts([ch.root]) + (zw_vpts([ahead.root]) if ahead is not None and hasattr(ahead, "root") else [])
    top = max([p.z for p in P] + [3.0])
    ps = zw_ps()
    cam = Cam()
    best = None
    for D_ in (2.2, 3.0, 4.2, 6.0, 8.5, 11.0, 14.0):
        for sx in (0.7, -0.7, 1.4, -1.4):
            loc = Vector((pc.x, pc.y, 0.0)) - f * D_ * ps / 0.55 + side * sx * ps / 0.55 + Vector((0.0, 0.0, 1.5 * ps / 0.55))
            aim = Vector((pc.x, pc.y, 0.0)) + f * (dist * 0.55) + Vector((0.0, 0.0, top * 0.42))
            if zs_in_house(loc):
                continue
            cam.key(t1, tuple(loc), tuple(aim), lens=22)
            zs_upd(tm)
            sp = zw_span(cam.ob, P)
            if sp is None:
                continue
            ok = sp[0] > 0.03 and sp[1] < 0.97 and sp[2] > 0.02 and sp[3] < 0.97
            score = (2 if ok else 0) + (-D_ * 0.05 if ok else D_ * 0.01)
            if best is None or score > best[0]:
                best = (score, loc.copy(), aim.copy())
            if ok:
                break
        if best is not None and best[0] > 1:
            break
    if best is None:
        return None
    s, loc, aim = best
    cam.key(t0, tuple(loc - f * 0.3), tuple(aim), lens=22)
    cam.key(t1, tuple(loc), tuple(aim), lens=22)
    ZW_FRAMED["cut"] = "9f behind (%.2f)" % s
    return cam


def zs_cam_kid_legs(t0, t1, kid, Tt):
    """ONLY THE KID'S LEGS, behind the chalk line: the hips at the top of the frame, the feet low, the line below them"""
    tm = (t0 + t1) / 2.0
    zs_upd(tm)
    pk = za_here(kid, tm)
    vp = zw_vpts([kid.root])
    if not vp:
        return None
    top = max(p.z for p in vp)
    hip = top * 0.45
    feet = Vector((pk.x, pk.y, 0.05))
    hipp = Vector((pk.x, pk.y, hip))
    sy = -1.0 if pk.y > 0 else 1.0
    ring = Tt[0] if Tt and "pts" in Tt[0] else None
    line = zs_line_pts_near(ring, pk.x, pk.y, sy)
    near = [p for p in line if (p.y - pk.y) * sy > 0]
    gap = min([abs(p.y - pk.y) for p in near] + [3.0]) if near else 0.8
    ps = zw_ps()
    cam = Cam()
    ob = cam.ob
    best = None
    for dd in (0.9, 1.3, 1.8, 2.4, 3.0):
        for z in (0.15, 0.3, 0.5):
            for lens in (24, 30, 35):
                for az in (0.3, 0.5, 0.7):
                    loc = Vector((pk.x + 0.15, pk.y + sy * (gap + dd), z * ps / 0.55))
                    ob.location = loc
                    aim(ob, (pk.x, pk.y, hip * az))
                    cam.cd.lens = lens
                    bpy.context.view_layer.update()
                    uh, uf = zw_uv(ob, hipp), zw_uv(ob, feet)
                    if uh is None or uf is None:
                        continue
                    seen = 0
                    for q in line:
                        uv = zw_uv(ob, q)
                        if uv is not None and 0.0 < uv[0] < 1.0 and uf[1] + 0.03 < uv[1] < 0.99:
                            seen += 1
                    score = -abs(uh[1] - 0.04) - abs(uf[1] - 0.72) + (0.8 if seen >= 4 else 0.2 * seen)
                    if best is None or score > best[0]:
                        best = (score, loc.copy(), Vector((pk.x, pk.y, hip * az)), lens)
    if best is None:
        return None
    s, loc, tg, lens = best
    cam.key(t0, tuple(loc + Vector((0.0, sy * 0.12, 0.0))), tuple(tg), lens=lens)
    cam.key(t1, tuple(loc), tuple(tg), lens=lens)
    ZW_FRAMED["cut"] = "9f kid legs behind the line (%.2f)" % s
    return cam


def zs_cam_two(two, t0, t1, close=False, thing=None, frac=None):
    """(stage9e's two-shot, the crowd kids too)"""
    two = [p for p in two if p is not None]
    if len(two) < 2:
        return None
    tm = (t0 + t1) / 2.0
    zs_upd(tm)
    a, b = za_here(two[0], tm), za_here(two[1], tm)
    ax = Vector((b.x - a.x, b.y - a.y, 0.0))
    ax = ax.normalized() if ax.length > 1e-3 else Vector((1.0, 0.0, 0.0))
    c = (a + b) / 2.0
    base = zs_street_dir(c)
    perp = Vector((-ax.y, ax.x, 0.0))
    if perp.dot(base) < 0:
        perp = -perp

    def pts_at(t):
        out = []
        for ch in two:
            out += zw_body_pts(ch) if close else zw_vpts([ch.root])
        if thing is not None:
            out += zw_pts([thing]) or []
        return out
    P = pts_at(tm)
    if not P:
        return None
    top = max(p.z for p in P)
    dirs = [perp, zs_rot(perp, 25), zs_rot(perp, -25), zs_rot(perp, 45), zs_rot(perp, -45), base]
    skip = tuple(p.name + "_" for p in two) + ("zt_",)
    return zs_fit(t0, t1, pts_at, dirs, 32 if close else 26, frac=None if close else frac,
                  zc=top * (0.78 if close else 0.5), margin=0.08 if close else 0.06, d0=4.0 if close else 7.0, skip=skip)


# ---------------------------------------------------------------- THE PART CHECK + the morning's surfaces (for the log)
def zs_part_check(cam, t0, t1, tag):
    """one body part (or a prop) filling more than 60 % of the frame: ZW_GATE|tag|name|bigpart|share"""
    tm = (t0 + t1) / 2.0
    zs_upd(tm)
    cl = Vector(cam.ob.matrix_world.translation)
    worst, wn = 0.0, ""
    for o in D.objects:
        if o.type != "MESH" or o.hide_render:
            continue
        nm = o.name
        if not (nm.startswith("zt_") or any(nm.endswith(s) for s in ("_head", "_torso", "_armL", "_armR", "_legL", "_legR"))):
            continue
        if max(o.scale) < 0.01 or (nm.startswith("zt_") and max(o.dimensions) > 2.5):
            continue
        cs = [o.matrix_world @ Vector(cc) for cc in o.bound_box]
        sp = zw_span(cam.ob, cs)
        if sp is None:
            dmin = min((p - cl).length for p in cs)
            share = 1.0 if dmin < 1.2 else 0.0
        else:
            u0, u1, v0, v1 = max(0.0, sp[0]), min(1.0, sp[1]), max(0.0, sp[2]), min(1.0, sp[3])
            share = max(0.0, u1 - u0) * max(0.0, v1 - v0)
        if share > worst:
            worst, wn = share, nm
    if worst > 0.6:
        print("ZW_GATE|%s|%s|bigpart|%.2f" % (tag, wn, worst))
    return worst


def zs_morning_probe(cam, tag):
    """what the morning camera sees (the log): the surfaces at a few points of the frame"""
    try:
        dg = bpy.context.evaluated_depsgraph_get()
        sc = bpy.context.scene
        for (u, v) in ((0.5, 0.15), (0.5, 0.75), (0.2, 0.9), (0.8, 0.6)):
            d = cam.ob.matrix_world.to_3x3() @ Vector(((u - 0.5) * 0.5625 * 24.0 / cam.cd.lens, (0.5 - v) * 24.0 / cam.cd.lens, -1.0))
            hit, loc, nrm, idx, ob, mw = sc.ray_cast(dg, cam.ob.matrix_world.translation, d.normalized(), distance=500.0)
            mn = ob.active_material.name if hit and ob is not None and ob.active_material is not None else "-"
            print("ZW_LOOK|9f|probe %s %.1f,%.1f %s %s" % (tag, u, v, ob.name if hit and ob is not None else "sky", mn))
    except Exception as e:
        print("ZW_LOOK|9f|probe skipped: %s" % str(e)[:100])


def zs_light_check(t0, t1, tag):
    """TIME IS STATE: a night / storm shot lit like day fails (a strong sun, a big area light that is not a lamp or a window)"""
    if not ZS.get("deep"):
        return
    zs_upd((t0 + t1) / 2.0)
    for o in D.objects:
        if o.type != "LIGHT" or o.hide_render or o.name.startswith(("zw_lamp", "zs_crowdl", "zs_lightning", "zw_porch", "zs_porch")):
            continue
        e = float(o.data.energy)
        if (o.data.type == "SUN" and e > 0.6) or (o.data.type == "AREA" and e > 2500.0):
            print("ZW_GATE|%s|%s|daylight|%.0f" % (tag, o.name, e))


ZC_CUT9F = zc_cut


def zc_cut(t0, t1, kind, people=(), things=(), move="push_in", side=None, hero=None, tag="", frac=None, v=None):
    bpy.context.scene.render.use_motion_blur = False   # sharp (round 9e's close shots were a blur)
    cam = None
    if kind == "lamps":
        cam = zs_try(zs_cam_lamps, t0, t1)
    if cam is None:
        cam = ZC_CUT9F(t0, t1, "street" if kind == "lamps" else kind, people, things, move, side, hero, tag, frac, v)
    if tag and cam is not None:
        zs_try(zs_part_check, cam, t0, t1, tag)
        zs_try(zs_light_check, t0, t1, tag)
        if ZS.get("time9e") == "morning":
            zs_morning_probe(cam, tag)
    return cam
# ===== END OF STAGE 9f ===============================================================================================
