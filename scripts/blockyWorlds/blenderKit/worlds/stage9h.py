# ===== ROUND 9h (owner 2026-11-23): THE RIGHT DOOR, FACES TO THE LENS, THE MONSTER WHOLE, CLOSE SHOTS NOT TOO CLOSE ===
# Pasted after stage9g.py.
#   THE DOOR    the house's OWN door: the ring "zs_ring<i>" belongs to house "zw_h<i>", its door is "zw_hdoor<i>" on that
#               house's front wall (round 9f took the nearest door to the ring's centre: dad and the kid stood in the road)
#   FACES       a close / medium shot of one person keeps the face to the lens (the head turns at most 35 degrees away)
#   THE MONSTER a low shot of the monster alone: the whole silhouette in frame, its eyes to the lens, nobody else
#   HAND SHOTS  the hand, the thing AND the holder's head + body (a medium close, never an extreme close-up)

ZS_LIBRARY["cam_monster_whole"] = ("camera", "the monster alone, the whole silhouette in frame, its eyes to the lens")
ZS_LIBRARY["face_to_lens"] = ("camera", "a close / medium shot of one person keeps the face to the lens")


def zs_bbox(o):
    """(centre, lo, hi) of an object's mesh in the world (its origin may sit at the town's centre)"""
    P = zw_pts([o])
    if not P:
        c = Vector(o.matrix_world.translation)
        return c, c, c
    lo = Vector((min(q.x for q in P), min(q.y for q in P), min(q.z for q in P)))
    hi = Vector((max(q.x for q in P), max(q.y for q in P), max(q.z for q in P)))
    return (lo + hi) / 2.0, lo, hi


def zs_house_of(ring):
    if ring is None:
        return None
    nm = ring.name.split(".")[0]
    if not nm.startswith("zs_ring"):
        return None
    i = nm[len("zs_ring"):]
    return D.objects.get("zw_h" + i) if i.isdigit() else None


def zs_door_obj(ring):
    """the house's OWN front door (on the front wall of the house whose line this is)"""
    h = zs_house_of(ring)
    if h is not None:
        i = h.name[4:]
        hp, hlo, hhi = zs_bbox(h)
        fy = hlo.y if hp.y > 0 else hhi.y
        cands = [o for o in D.objects if o.name.split(".")[0] == "zw_hdoor" + i]
        if cands:
            o = min(cands, key=lambda o: abs(zs_bbox(o)[0].y - fy) + 0.2 * abs(zs_bbox(o)[0].x - hp.x))
            if not ZS.get("door_said"):
                ZS["door_said"] = 1
                R = zs_ring_pts(ring)
                print("ZW_LOOK|9h|door %s at %.1f,%.1f; house %s %.1f,%.1f..%.1f,%.1f; line %.1f,%.1f..%.1f,%.1f" % (o.name, zs_bbox(o)[0].x, zs_bbox(o)[0].y, h.name, hlo.x, hlo.y, hhi.x, hhi.y, min(q[0] for q in R), min(q[1] for q in R), max(q[0] for q in R), max(q[1] for q in R)))
            return o
    c = Vector(zs_ring_center(ring)) if ring is not None else Vector((0.0, 20.0, 0.0))
    doors = [o for o in D.objects if o.name.startswith("zw_hdoor") and o.name.split(".")[0][8:].isdigit()]
    if not doors:
        return None
    print("ZW_LOOK|9h|door fallback (no house for %s)" % (ring.name if ring is not None else "-"))
    return min(doors, key=lambda o: (Vector((zs_bbox(o)[0].x, zs_bbox(o)[0].y, 0.0)) - Vector((c.x, c.y, 0.0))).length)


def zs_inward(ring, d):
    """the way from the door INTO the house (from its front wall toward the house's centre)"""
    h = zs_house_of(ring)
    if h is not None:
        return 1.0 if zs_bbox(h)[0].y > d.y else -1.0
    return 1.0 if d.y > 0 else -1.0


def zs_door_pt(ring, kind="door"):
    o = zs_door_obj(ring)
    if o is None:
        c = zs_ring_center(ring)
        return (c[0], c[1], 0.0)
    d = zs_bbox(o)[0]
    inward = zs_inward(ring, d)
    if not o.get("zs_open"):
        o.scale = (0.0001, 0.0001, 0.0001)
        o["zs_open"] = 1
    if kind == "door_side":
        return (d.x + 1.6 * zw_ps() / 0.55, d.y - inward * 0.75, 0.0)
    return (d.x, d.y - inward * 0.35, 0.0)


def zs_window_pt(ring):
    o = zs_door_obj(ring)
    if o is None:
        c = zs_ring_center(ring)
        return (c[0], c[1], 0.0)
    i = o.name.split(".")[0][8:]
    d = zs_bbox(o)[0]
    inward = zs_inward(ring, d)
    wins = [w for w in D.objects if w.name.startswith("zw_hwin%s_" % i) and abs(zs_bbox(w)[0].y - d.y) < 1.5]
    if not wins:
        return (d.x + 3.0, d.y - inward * 1.3, 0.0)
    w = min(wins, key=lambda w: abs(zs_bbox(w)[0].x - d.x))
    p = zs_bbox(w)[0]
    return (p.x, p.y - inward * 1.3, 0.0)


def zs_line_front_pt(ring):
    """just inside the front of the house's line, in front of the house's own door"""
    P = zs_ring_pts(ring)
    if not P:
        return (0.0, 16.0, 0.0)
    o = zs_door_obj(ring)
    h = zs_house_of(ring)
    hy = zs_bbox(h)[0].y if h is not None else (1.0 if sum(p[1] for p in P) > 0 else -1.0)
    # the front edge = the edge on the street side of the house
    fy = min(p[1] for p in P) if hy > 0 else max(p[1] for p in P)
    xs = sorted(p[0] for p in P)
    x = zs_bbox(o)[0].x if o is not None else (xs[0] + xs[-1]) / 2.0
    x = max(xs[0] + 0.5, min(xs[-1] - 0.5, x))
    inward = 1.0 if hy > fy else -1.0
    return (x, fy + inward * 0.8, 0.0)


# ---------------------------------------------------------------- FACES TO THE LENS
def zs_face_lens(ch, cam, t0, t1):
    tm = (t0 + t1) / 2.0
    zs_upd(tm)
    p = za_here(ch, tm)
    cl = Vector(cam.ob.matrix_world.translation)
    want = za_yaw(Vector((p.x, p.y, 0.0)), Vector((cl.x, cl.y, 0.0)))
    rel = ((want - zm_yaw_at(ch, tm) + 180.0) % 360.0) - 180.0
    if abs(rel) > 110.0:
        return
    hy = max(-35.0, min(35.0, rel))
    for t in (t0 - 0.2, tm, t1 + 0.05):
        ch.pose(t, head=(hy, 4, 0))


# ---------------------------------------------------------------- THE MONSTER WHOLE (alone, eyes to the lens)
def zs_cam_monster_whole(t0, t1, m):
    tm = (t0 + t1) / 2.0
    zs_upd(tm)
    pm = za_here(m, tm)
    vp = zw_vpts([m.root])
    if not vp:
        return None
    top = max(p.z for p in vp)
    # from the house side (the people's yards behind the camera), then round it
    base = Vector((0.0, 1.0 if pm.y < 8.0 else -1.0, 0.0))
    dirs = [base, zs_rot(base, 30), zs_rot(base, -30), zs_rot(base, 60), zs_rot(base, -60)]
    cam = zs_fit(t0, t1, lambda t: zw_vpts([m.root]), dirs, 20, frac=None, zc=1.3 * zw_ps() / 0.55, aimz=top * 0.5, margin=0.05, d0=6.0, skip=(m.name + "_",))
    if cam is None:
        return None
    zs_try(zs_face_cam, m, cam, t0, t1)
    ZW_FRAMED["cut"] = "9h the monster whole"
    return cam


ZC_CUT9H = zc_cut


def zc_cut(t0, t1, kind, people=(), things=(), move="push_in", side=None, hero=None, tag="", frac=None, v=None):
    P = [p for p in people if p is not None]
    cam = None
    if kind == "low" and len(P) == 1 and P[0].name in ZW_MON:
        bpy.context.scene.render.use_motion_blur = False
        cam = zs_try(zs_cam_monster_whole, t0, t1, P[0])
        if cam is not None:
            zs_try(zs_solo, cam, t0, t1, P[0])
            if tag:
                zc_measure(cam, t0, t1, P, [o for o in things if o is not None], tag)
                zs_try(zs_part_check, cam, t0, t1, tag)
                zs_try(zs_light_check, t0, t1, tag)
    if cam is None:
        cam = ZC_CUT9H(t0, t1, kind, people, things, move, side, hero, tag, frac, v)
    ppl = [p for p in P if p.name not in ZW_MON]
    if cam is not None and len(ppl) == 1 and kind == "close":
        zs_try(zs_face_lens, ppl[0], cam, t0, t1)
    return cam
# ===== END OF STAGE 9h ===============================================================================================
