# ===== ROUND 9i (owner 2026-11-23): THE STAGE KNOWS WHERE THINGS ARE (named zones, a placement solver, maps) ==========
# Pasted after stage9h.py.
#   ZONES       zs_zones(H): named areas from the REAL geometry (mesh bounds): home_inside, home_doorway, home_window,
#               home_line_edge, home_yard (the home's chalk plot), neighbor_yard, front_lawn, pavement, kerb, road;
#               zs_zone_of(x, y) names the zone of any point
#   PLACEMENT   zs_zone_spot(H, zone, who, t): a free spot in the zone: a body width from everyone else, never inside a
#               wall / prop / furniture, near the zone's anchor (the open door, the window, the line in front of the door);
#               two people sent to the same zone stand side by side
#   THE RULE    zs_rule_check3: each character's zone at the real frames against the allowed zones for the time of day,
#               each exception from its word on; every position logged with its zone (once per shot: the 600-line cap)
#   MAPS        zs_map(H, lines, tag): a high straight-down camera over the stage + every zone outline and every character /
#               pet / car / prop position (start and end of each line) logged in screen coordinates for the drawn map
#   FIXES       a matte chalk stick (no glow on a character), faces to the lens in close / medium shots of a still person,
#               no step back into a wall, the near half of the force wall hidden from the lens (a faint ring), listed
#               people kept inside the frame, the monster's eyes to the lens in its solo shot

ZS_LIBRARY["zones"] = ("set piece", "named zones of a street from its geometry: home inside / doorway / window / line edge / yard, front lawn, pavement, kerb, road")
ZS_LIBRARY["placement"] = ("check", "a free spot in a named zone: a body width from everyone, never inside a wall or a prop (zs_zone_spot)")
ZS_LIBRARY["scene_map"] = ("check", "a top-down map of each scene: the zones, the rule areas, who is where at each line (zs_map)")

ZS_ZONE_ORDER = ("home_doorway", "home_window", "home_inside", "home_line_edge", "home_yard", "neighbor_yard", "front_lawn", "pavement", "kerb", "road")


def zs_rect(x0, y0, x1, y1):
    return [(min(x0, x1), min(y0, y1)), (max(x0, x1), min(y0, y1)), (max(x0, x1), max(y0, y1)), (min(x0, x1), max(y0, y1))]


ZS_CLEAR9I = zs_clear_stage


def zs_clear_stage(place, radius=13.0):
    ZS["zones"] = None
    ZS["obstacles"] = None
    ZS["door_said"] = 0
    return ZS_CLEAR9I(place, radius)


def zs_zones(H):
    Z = ZS.get("zones")
    if Z:
        return Z
    if H is None or H.get("chalk_line#house") is None:
        return {}
    bpy.context.view_layer.update()
    Z = {}
    r = H.get("chalk_line#house") if H is not None else None
    P = zs_ring_pts(r) if r is not None else []
    h = zs_house_of(r)
    side = 1.0
    if h is not None:
        hc, hlo, hhi = zs_bbox(h)
        side = 1.0 if hc.y > 0 else -1.0
        Z["home_inside"] = [zs_rect(hlo.x, hlo.y, hhi.x, hhi.y)]
        door = zs_door_obj(r)
        if door is not None:
            dc = zs_bbox(door)[0]
            inward = zs_inward(r, dc)
            Z["home_doorway"] = [zs_rect(dc.x - 0.8, dc.y - inward * 0.1, dc.x + 0.8, dc.y - inward * 1.0)]
            i = door.name.split(".")[0][8:]
            wins = [w for w in D.objects if w.name.startswith("zw_hwin%s_" % i) and abs(zs_bbox(w)[0].y - dc.y) < 1.5]
            Z["home_window"] = [zs_rect(zs_bbox(w)[0].x - 0.9, dc.y - inward * 0.9, zs_bbox(w)[0].x + 0.9, dc.y - inward * 1.9) for w in wins] or [zs_rect(dc.x + 2.2, dc.y - inward * 0.9, dc.x + 4.0, dc.y - inward * 1.9)]
    if P:
        xs = [p[0] for p in P]
        ys = [p[1] for p in P]
        fy = min(ys) if side > 0 else max(ys)
        Z["home_yard"] = [list(P)]
        Z["home_line_edge"] = [zs_rect(min(xs) + 0.5, fy + side * 0.4, max(xs) - 0.5, fy + side * 1.6)]
        lawn_y0 = side * 10.0
        Z["front_lawn"] = [zs_rect(min(xs) - 30.0, lawn_y0, max(xs) + 30.0, fy)]
    others = [o for o in D.objects if o.type == "EMPTY" and "pts" in o and o.name.startswith("zs_ring") and o is not r]
    hx = (min(p[0] for p in P) + max(p[0] for p in P)) / 2.0 if P else 0.0
    others = sorted(others, key=lambda o: abs(sum(q[0] for q in o["pts"]) / max(1, len(o["pts"])) - hx))[:3]
    Z["neighbor_yard"] = [[tuple(p) for p in o["pts"]] for o in others]
    road = D.objects.get("zw_sroad")
    if road is not None:
        rc, rlo, rhi = zs_bbox(road)
        y0, y1 = rlo.y, rhi.y
    else:
        y0, y1 = -6.0, 6.0
    Z["road"] = [zs_rect(-160.0, y0, 160.0, y1)]
    Z["kerb"] = [zs_rect(-160.0, y1, 160.0, y1 + 1.6), zs_rect(-160.0, y0 - 1.6, 160.0, y0)]
    Z["pavement"] = [zs_rect(-160.0, y1 + 1.6, 160.0, side * 10.0 if side > 0 else y1 + 4.0), zs_rect(-160.0, y0 - 4.0, 160.0, y0 - 1.6)]
    ZS["zones"] = Z
    return Z


def zs_zone_of(x, y, H=None):
    Z = zs_zones(H)
    for name in ZS_ZONE_ORDER:
        for poly in Z.get(name, []):
            if poly and zs_point_in((x, y), poly):
                return name
    return "elsewhere"


def zs_zone_anchor(H, zone, Z):
    r = H.get("chalk_line#house")
    door = zs_door_obj(r)
    dc = zs_bbox(door)[0] if door is not None else Vector((0.0, 16.0, 0.0))
    polys = Z.get(zone) or [[(dc.x, dc.y)]]
    if zone in ("home_line_edge", "front_lawn", "pavement", "kerb", "road", "home_yard"):
        # in front of the house's door (the stage)
        best = None
        for poly in polys:
            xs = [p[0] for p in poly]
            ys = [p[1] for p in poly]
            c = Vector((max(min(xs), min(max(xs), dc.x)), (min(ys) + max(ys)) / 2.0, 0.0))
            if best is None or abs(c.y - dc.y) < abs(best.y - dc.y):
                best = c
        if zone == "home_yard":
            return Vector((dc.x, dc.y - zs_inward(r, dc) * 3.0, 0.0))
        return best
    poly = min(polys, key=lambda q: abs(sum(p[0] for p in q) / len(q) - dc.x))
    return Vector((sum(p[0] for p in poly) / len(poly), sum(p[1] for p in poly) / len(poly), 0.0))


def zs_obstacles():
    O = ZS.get("obstacles")
    if O is not None:
        return O
    bpy.context.view_layer.update()
    st_c, st_d, st_r, st_rot = zw_stage(ZS["place"] or "suburb_street")
    O = []
    for o in D.objects:
        if o.type != "MESH" or o.hide_render or max(o.scale) < 0.01:
            continue
        nm = o.name
        if nm.startswith(("zs_ring", "zs_circ", "zs_fresh", "zs_pocket", "zs_wall", "zs_skydome", "zw_sroad", "zw_lawn", "zw_grass", "zs_rain")):
            continue
        if any(nm.endswith(s) for s in ("_head", "_torso", "_armL", "_armR", "_legL", "_legR")):
            continue
        c, lo, hi = zs_bbox(o)
        if (Vector((c.x, c.y, 0.0)) - Vector((st_c.x, st_c.y, 0.0))).length > 45.0:
            continue
        if hi.z < 0.35 or lo.z > 1.6 or (hi.x - lo.x) > 14.0 or (hi.y - lo.y) > 14.0:
            continue
        O.append((lo.x, lo.y, hi.x, hi.y))
    ZS["obstacles"] = O
    return O


def zs_zone_spot(H, zone, who=None, t=None):
    """A FREE SPOT in the zone: a body width from everyone else, not in a wall / prop, nearest the zone's anchor"""
    Z = zs_zones(H)
    polys = Z.get(zone)
    if not polys:
        print("ZW_LOOK|9i|zone %s unknown: the yard" % zone)
        polys = Z.get("home_yard") or [zs_rect(-2, 15, 2, 19)]
    if t is not None:
        zs_upd(t)
    others = []
    for k, ch in H.items():
        if ch is None or not hasattr(ch, "root") or k == who or k == "monster" or not zs_visible(ch):
            continue
        p = ch.root.matrix_world.translation
        others.append((p.x, p.y))
    anchor = zs_zone_anchor(H, zone, Z)
    O = [] if zone in ("home_doorway", "home_window") else zs_obstacles()   # (clear by definition: the door frame blocked every spot)
    rb = 0.5 * zw_ps() / 0.55
    best = None
    for poly in polys:
        xs = [p[0] for p in poly]
        ys = [p[1] for p in poly]
        x0, x1 = max(min(xs), anchor.x - 8.0), min(max(xs), anchor.x + 8.0)
        y0, y1 = max(min(ys), anchor.y - 8.0), min(max(ys), anchor.y + 8.0)
        nx, ny = max(1, int((x1 - x0) / 0.5)), max(1, int((y1 - y0) / 0.5))
        for a in range(nx + 1):
            for b in range(ny + 1):
                x, y = x0 + (x1 - x0) * a / nx, y0 + (y1 - y0) * b / ny
                if not zs_point_in((x, y), poly):
                    continue
                if zone != "home_inside" and zs_zone_of(x, y, H) not in (zone, "home_yard") and zone not in ("home_yard",):
                    continue
                if any((x - ox) ** 2 + (y - oy) ** 2 < (2.2 * rb) ** 2 for ox, oy in others):
                    continue
                if any(lx - rb < x < hx + rb and ly - rb < y < hy + rb for lx, ly, hx, hy in O):
                    continue
                d = (x - anchor.x) ** 2 + (y - anchor.y) ** 2
                if best is None or d < best[0]:
                    best = (d, x, y)
    if best is None:
        print("ZW_LOOK|9i|no free spot in %s for %s: the anchor" % (zone, who))
        return (anchor.x, anchor.y, 0.0)
    return (best[1], best[2], 0.0)


# ---------------------------------------------------------------- THE RULE AS ZONES, on the real frames
def zs_rule_check3(H, allowed, zones_ok, times, tag):
    n = 0
    seen = set()
    zones_ok = set(zones_ok or [])
    for t in times:
        zs_upd(t)
        for k, v in H.items():
            if v is None or k.startswith("crowd") or k.startswith("chalk") or k == "monster":
                continue
            kind = k.split("#")[0]
            if hasattr(v, "root"):
                if not zs_visible(v):
                    continue
                p = v.root.matrix_world.translation
            elif kind in ("dog", "car"):
                if v.scale[2] < 0.01:
                    continue
                p = zs_bbox(v)[0]
            else:
                continue
            z = zs_zone_of(p.x, p.y, H)
            if not hasattr(v, "root"):
                # a pet / a car: inside its own closed chalk line (the dog's circle, the car's box), not a person's zone
                vp = zw_vpts([v]) or zw_pts([v])
                xs, ys = [q.x for q in vp], [q.y for q in vp]
                inside = bool(vp) and zs_inside_any([(min(xs), min(ys)), (max(xs), min(ys)), (max(xs), max(ys)), (min(xs), max(ys))], zs_closed_lines())
                ok = (not zones_ok) or inside or (k in allowed and t >= allowed[k] - 0.01)
            else:
                ok = (not zones_ok) or z in zones_ok or (k in allowed and t >= allowed[k] - 0.01)
            if hasattr(v, "root") and t == times[len(times) // 2]:
                print("ZW_GATE|%s|%s|pos|%.1f,%.1f|%s|%s" % (tag, k, p.x, p.y, z, "ok" if ok else "OUT"))
            if not ok and k not in seen:
                print("ZW_GATE|%s|%s|rule_break|in %s at %.2f (%.1f, %.1f)" % (tag, k, z, t, p.x, p.y))
                seen.add(k)
                n += 1
    return n


# ---------------------------------------------------------------- THE SCENE MAP
def zs_map(H, lines, tag):
    """a high straight-down camera over the stage; every zone outline and every position (the start + end of each line)
    logged in the frame's coordinates (u, v) for the map drawn on top"""
    Z = zs_zones(H)
    r = H.get("chalk_line#house")
    P = zs_ring_pts(r) if r is not None else [(-10.0, -8.0), (10.0, 30.0)]
    xs = [p[0] for p in P]
    ys = [p[1] for p in P] + [-7.0]
    cx, cy = (min(xs) + max(xs)) / 2.0, (min(ys) + max(ys)) / 2.0
    ext = max(max(ys) - min(ys) + 6.0, (max(xs) - min(xs) + 10.0) * 16.0 / 9.0)
    lens = 50.0
    hh = ext / 2.0 / (12.0 / lens) + 2.0
    cam = Cam()
    t0 = lines[0][1] if lines else 0.0
    t1 = lines[-1][2] if lines else 1.0
    for t in (t0, t1):
        cam.key(t, (cx, cy, hh), (cx, cy + 0.02 * hh, 0.0), lens=lens)
    zs_upd(t0)

    def uv(x, y):
        q = zw_uv(cam.ob, Vector((x, y, 0.05)))
        return "%.3f,%.3f" % (q[0], q[1]) if q is not None else "-"
    for name in ZS_ZONE_ORDER:
        for k, poly in enumerate(Z.get(name, [])):
            if poly:
                print("ZW_GATE|%s|zone|%s|%s" % (tag, name, ";".join(uv(p[0], p[1]) for p in poly)))
    for (n, a, b) in lines:
        for tt, se in ((a + 0.05, "s"), (b - 0.05, "e")):
            zs_upd(tt)
            for k, v in H.items():
                if v is None or k.startswith("chalk_line") or k.startswith("crowd"):
                    continue
                if hasattr(v, "root"):
                    if not zs_visible(v):
                        continue
                    p = v.root.matrix_world.translation
                elif hasattr(v, "matrix_world"):
                    if se == "e" or n != lines[0][0] or max(v.scale) < 0.01:
                        continue
                    p = zs_bbox(v)[0]
                else:
                    continue
                print("ZW_GATE|%s|pos|%s|%d%s|%s|%s" % (tag, k, n, se, uv(p.x, p.y), zs_zone_of(p.x, p.y, H)))
    return cam


# ---------------------------------------------------------------- FIXES
def zt_build_chalk(r, c=None, col=None):
    """a short MATTE chalk stick (round 9h: a glowing stick bloomed into a ball of light on the kid at night)"""
    cyl("zt_chalk%d" % ZT_N["n"], 0.11, 0.8, (0, 0, 0.4), zw_m("chalkstick9i", "#f8f8f4", 0.9), 10, parent=r, coll=c)
    return r


ZS_BODY_FEEL9I = zs_body_feel


def zs_body_feel(ch, feel, t0, t1, look=None):
    """(no step back into a wall: a person by the house / a window / a door stays put)"""
    p = za_here(ch, t0)
    O = zs_obstacles()
    near = any(lx - 1.2 < p.x < hx + 1.2 and ly - 1.2 < p.y < hy + 1.2 for lx, ly, hx, hy in O)
    if near or zs_zone_of(p.x, p.y, None) in ("home_doorway", "home_window", "home_inside"):
        look = None
    r = ZS_BODY_FEEL9I(ch, feel, t0, t1, look)
    # upright (the shaking was a lean): the torso straight at the end of each shake
    return r


def zs_face_lens(ch, cam, t0, t1):
    """a close / medium shot of a person standing still: the body turns to the lens (three-quarter at most), the head
    straight; a moving person keeps their way"""
    tm = (t0 + t1) / 2.0
    if max((za_here(ch, t) - za_here(ch, tm)).length for t in (t0, t1)) > 0.3:
        return
    zs_upd(tm)
    p = za_here(ch, tm)
    cl = Vector(cam.ob.matrix_world.translation)
    want = za_yaw(Vector((p.x, p.y, 0.0)), Vector((cl.x, cl.y, 0.0)))
    cur = zm_yaw_at(ch, tm)
    rel = ((want - cur + 180.0) % 360.0) - 180.0
    yaw = want - math.copysign(min(20.0, abs(rel)), rel)
    for t in (t0 - 0.25, t1 + 0.05):
        ch.pose(t, rot=yaw, head=(0, 4, 0))
    ZW_FRAMED["face"] = "%s turned to the lens" % ch.name


def zs_hide_near_wall(cam, t0, t1):
    """the force wall's panels between the lens and the circle's centre are hidden (only the far side shows: a faint ring)"""
    tm = (t0 + t1) / 2.0
    zs_upd(tm)
    cl = Vector(cam.ob.matrix_world.translation)
    n = 0
    for root in [o for o in D.objects if o.type == "EMPTY" and o.name.startswith("zs_wall")]:
        c = Vector(root.matrix_world.translation)
        dc = (Vector((c.x, c.y, 0.0)) - Vector((cl.x, cl.y, 0.0))).length
        for o in root.children:
            q = o.matrix_world.translation
            if (Vector((q.x, q.y, 0.0)) - Vector((cl.x, cl.y, 0.0))).length < dc:
                o.scale = (0.0001, 0.0001, 0.0001)
                n += 1
    return n


def zs_keep_in(cam, t0, t1, people):
    """the listed people stay inside the frame: the camera steps back along its view until they do (at most 3 times)"""
    tm = (t0 + t1) / 2.0
    for it in range(3):
        zs_upd(tm)
        pts = []
        for ch in people:
            pts += zw_vpts([ch.root])
        sp = zw_span(cam.ob, pts) if pts else None
        if sp is not None and sp[0] > 0.02 and sp[1] < 0.98 and sp[2] > 0.02 and sp[3] < 0.98:
            return cam
        for t in (t0, t1):
            zs_upd(t)
            mw = cam.ob.matrix_world
            loc = Vector(mw.translation)
            fwd = mw.to_3x3() @ Vector((0.0, 0.0, -1.0))
            aim_ = loc + fwd * 6.0
            cam.key(t, tuple(aim_ + (loc - aim_) * 1.3), tuple(aim_), lens=cam.cd.lens)
    return cam


ZS_CAM_MON_WHOLE9I = zs_cam_monster_whole


def zs_cam_monster_whole(t0, t1, m):
    """(the camera in FRONT of the monster first: both eyes)"""
    tm = (t0 + t1) / 2.0
    zs_upd(tm)
    pm = za_here(m, tm)
    vp = zw_vpts([m.root])
    if not vp:
        return ZS_CAM_MON_WHOLE9I(t0, t1, m)
    top = max(p.z for p in vp)
    f = zs_fwd(m, tm)
    dirs = [f, zs_rot(f, 25), zs_rot(f, -25), zs_rot(f, 50), zs_rot(f, -50)]
    cam = zs_fit(t0, t1, lambda t: zw_vpts([m.root]), dirs, 20, frac=None, zc=1.3 * zw_ps() / 0.55, aimz=top * 0.5, margin=0.05, d0=6.0, skip=(m.name + "_",))
    if cam is None:
        return ZS_CAM_MON_WHOLE9I(t0, t1, m)
    zs_try(zs_face_cam, m, cam, t0, t1)
    return cam


ZC_CUT9I = zc_cut


def zc_cut(t0, t1, kind, people=(), things=(), move="push_in", side=None, hero=None, tag="", frac=None, v=None):
    cam = ZC_CUT9I(t0, t1, kind, people, things, move, side, hero, tag, frac, v)
    if cam is None:
        return cam
    P = [p for p in people if p is not None]
    ppl = [p for p in P if p.name not in ZW_MON]
    zs_try(zs_hide_near_wall, cam, t0, t1)
    if len(ppl) == 1 and kind == "medium":
        zs_try(zs_face_lens, ppl[0], cam, t0, t1)
    if ppl and kind in ("low", "wide", "two") and any(p.name in ZW_MON for p in P):
        zs_try(zs_keep_in, cam, t0, t1, ppl)
    return cam
# the scene-start placement: someone already in their home's yard (its line washed or not) stays put (round 9i maps: the
# kid in the doorway after the storm was moved into the dog's circle)
ZS_RULE_PLACE9I = zs_rule_place


def zs_rule_place(H, names, t):
    zs_upd(t)
    keep = []
    for k in names:
        ch = H.get(k)
        if ch is None or not hasattr(ch, "root"):
            continue
        p = ch.root.matrix_world.translation
        if zs_zone_of(p.x, p.y, H).startswith("home_") or zs_inside_any([(p.x, p.y)], zs_line_areas()):
            continue
        keep.append(k)
    return ZS_RULE_PLACE9I(H, keep, t) if keep else 0
# ===== END OF STAGE 9i ===============================================================================================
