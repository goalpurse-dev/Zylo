# ===== ROUND 9g (owner 2026-11-23): THE RULE CHECK ON THE REAL FRAMES + WHO IS WHERE UNTIL THE STORY SAYS ============
# Pasted after stage9f.py.
#   THE CHECK   zs_rule_check2: the positions the characters REALLY have in the rendered frames (the start, the middle
#               and the end of every shot), against every house's line (a washed line still marks the yard: "inside the
#               line" until the story sends someone out) and every closed line; an exception counts only FROM the word
#               of the script line that causes it (allowed = {name: time}); every position is written to the log
#   THE WINDOW  mark "window": in the front yard in front of the house's front window
#   SOLO        a shot that lists one character shows only that character (the camera turns round it until the others
#               are out of the frame: ref 29, the monster alone in the street)
#   HAND SHOT   follows the hand when the holder runs (ref 33: the chalk out of the pocket at the kerb)

ZS_LIBRARY["rule_check_frames"] = ("check", "the town rule on the real frames: start / middle / end of every shot, each exception from its word on (zs_rule_check2)")
ZS_LIBRARY["window_mark"] = ("set piece", "in the front yard in front of the house's window (mark window)")
ZS_LIBRARY["cam_solo"] = ("camera", "a shot of one character shows only that one (the camera turns until the others are out of frame)")


def zs_window_pt(ring):
    """in the front yard, in front of the house's front window nearest its door"""
    o = zs_door_obj(ring)
    if o is None:
        c = zs_ring_center(ring)
        return (c[0], c[1], 0.0)
    i = o.name[8:]
    d = Vector(o.matrix_world.translation)
    wins = [w for w in D.objects if w.name.startswith("zw_hwin%s_" % i)]
    inward = 1.0 if d.y > 0 else -1.0
    if not wins:
        return (d.x + 3.0, d.y - inward * 1.3, 0.0)
    w = min(wins, key=lambda w: abs(w.matrix_world.translation.x - d.x))
    p = w.matrix_world.translation
    return (p.x, p.y - inward * 1.3, 0.0)


def zs_line_areas():
    """the areas that count as 'inside a line': every closed line now on the ground + every house's own line (a washed
    house line still marks its yard)"""
    out = zs_closed_lines()
    for o in D.objects:
        if o.type == "EMPTY" and "pts" in o and o.name.startswith("zs_ring"):
            P = [tuple(p) for p in o["pts"]]
            if P not in out:
                out.append(P)
    return out


def zs_rule_check2(H, allowed, times, tag):
    """THE RULE ON THE REAL FRAMES: at each time, every person / pet / car stands inside a line unless their exception
    has started (allowed[name] = the time of its word); every position goes to the log"""
    n = 0
    seen = set()
    for t in times:
        bpy.context.scene.frame_set(F(t))
        bpy.context.view_layer.update()
        areas = zs_line_areas()
        for k, v in H.items():
            if v is None or k.startswith("crowd") or k.startswith("chalk") or k == "monster":
                continue
            kind = k.split("#")[0]
            if hasattr(v, "root"):
                if not zs_visible(v):
                    continue
                p = v.root.matrix_world.translation
                pts = [(p.x, p.y)]
            elif kind in ("dog", "car"):
                if v.scale[2] < 0.01:
                    continue
                vp = zw_vpts([v]) or zw_pts([v])
                if not vp:
                    continue
                xs, ys = [q.x for q in vp], [q.y for q in vp]
                pts = [(min(xs), min(ys)), (max(xs), min(ys)), (max(xs), max(ys)), (min(xs), max(ys))]
                p = Vector(((min(xs) + max(xs)) / 2.0, (min(ys) + max(ys)) / 2.0, 0.0))
            else:
                continue
            inside = zs_inside_any(pts, areas)
            ok_out = k in allowed and t >= allowed[k] - 0.01
            if hasattr(v, "root"):
                print("ZW_GATE|%s|%s|pos|%.1f,%.1f|%s|t=%.2f" % (tag, k, p.x, p.y, "in" if inside else ("out-allowed" if ok_out else "OUT"), t))
            if not inside and not ok_out and k not in seen:
                print("ZW_GATE|%s|%s|rule_break|outside its line at %.2f (%.1f, %.1f)" % (tag, k, t, p.x, p.y))
                seen.add(k)
                n += 1
    print("ZW_FRAMED|%s|rule|%d break(s) on %d frames" % (tag, n, len(times)))
    return n


# ---------------------------------------------------------------- SOLO: one character listed = only that one in frame
def zs_others_in_frame(cam, subject, tm):
    zs_upd(tm)
    out = []
    for nm, ch in zw_cast():
        if ch is subject or ch.name == subject.name or not zs_visible(ch):
            continue
        p = za_here(ch, tm)
        top = max([q.z for q in zw_pts([ch.head])] + [p.z + 1.5]) if hasattr(ch, "head") else p.z + 1.5
        for q in (Vector((p.x, p.y, 0.3)), Vector((p.x, p.y, top))):
            uv = zw_uv(cam.ob, q)
            if uv is not None and -0.02 < uv[0] < 1.02 and -0.02 < uv[1] < 1.02:
                out.append(ch.name)
                break
    return out


def zs_solo(cam, t0, t1, subject):
    """turn the camera round the subject (both keys) until nobody else is in the frame"""
    tm = (t0 + t1) / 2.0
    if not zs_others_in_frame(cam, subject, tm):
        return cam
    c = za_here(subject, tm)
    keys = []
    for t in (t0, t1):
        zs_upd(t)
        mw = cam.ob.matrix_world
        loc = Vector(mw.translation)
        fwd = mw.to_3x3() @ Vector((0.0, 0.0, -1.0))
        dist = max(1.0, (Vector((c.x, c.y, loc.z)) - loc).length)
        keys.append((t, loc, loc + fwd * dist))
    for deg in (40.0, -40.0, 80.0, -80.0, 120.0, -120.0, 180.0):
        a = math.radians(deg)
        for (t, loc, aim_) in keys:
            def rot(q):
                v = q - Vector((c.x, c.y, q.z))
                return Vector((c.x + v.x * math.cos(a) - v.y * math.sin(a), c.y + v.x * math.sin(a) + v.y * math.cos(a), q.z))
            cam.key(t, tuple(rot(loc)), tuple(rot(aim_)), lens=cam.cd.lens)
        nl = Vector(cam.ob.matrix_world.translation)
        if not zs_others_in_frame(cam, subject, tm) and not zs_in_house(nl):
            ZW_FRAMED["solo"] = "turned %d deg: only %s in frame" % (deg, subject.name)
            return cam
    for (t, loc, aim_) in keys:
        cam.key(t, tuple(loc), tuple(aim_), lens=cam.cd.lens)
    return cam


# ---------------------------------------------------------------- THE HAND SHOT follows a running hand
ZS_CAM_HAND9G = zs_cam_hand


def zs_cam_hand(t0, t1, ppl, Tt):
    cam = ZS_CAM_HAND9G(t0, t1, ppl, Tt)
    th = [o for o in Tt if "pts" not in o and not o.name.startswith("zs_")]
    if cam is None or not th:
        return cam
    holder = ZS_HOLDER.get(th[0].name) or (ppl[0] if ppl else None)
    if holder is None:
        return cam
    tm = (t0 + t1) / 2.0
    pm = za_here(holder, tm)
    if max((za_here(holder, t) - pm).length for t in (t0, t1)) < 0.3:
        return cam
    zs_upd(tm)
    mw = cam.ob.matrix_world
    loc = Vector(mw.translation)
    aim_ = loc + (mw.to_3x3() @ Vector((0.0, 0.0, -1.0))) * 2.0
    for t in (t0, tm, t1):
        dp = za_here(holder, t) - pm
        dp.z = 0.0
        cam.key(t, tuple(loc + dp), tuple(aim_ + dp), lens=cam.cd.lens)
    ZW_FRAMED["cut"] = "9g hand, following the holder"
    return cam


ZC_CUT9G = zc_cut


def zc_cut(t0, t1, kind, people=(), things=(), move="push_in", side=None, hero=None, tag="", frac=None, v=None):
    cam = ZC_CUT9G(t0, t1, kind, people, things, move, side, hero, tag, frac, v)
    P = [p for p in people if p is not None]
    if cam is not None and len(P) == 1 and P[0].name in ZW_MON and kind in ("low", "close", "medium", "wide"):
        zs_try(zs_solo, cam, t0, t1, P[0])
    return cam
# ===== END OF STAGE 9g ===============================================================================================
