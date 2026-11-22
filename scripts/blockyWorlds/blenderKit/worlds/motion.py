# ===== ZYVO MOTION LIBRARY (scripts/blockyWorlds/blenderKit/worlds/motion.py, owner 2026-11-22 round 4) ==============
# Pasted after worlds.py + actions.py + acts.py (+ pieces.py). Real, smooth movement on the kit's rig (root -> hip ->
# torso / neck -> head, shoulder + hip pivots, legs 2 units long):
#   - every action BLENDS: it first keys the pose the character is in at its start (zm_hold), then moves from there
#     (BEZIER), never a snap from one pose to the next
#   - WALK / RUN with the steps matched to the ground (cycles a second = speed / (4 x leg x sin swing): no sliding), the
#     arms swinging opposite to the legs, a body bob on the passing step, a head-led turn into the walk
#   - IDLE LIFE on every character in every shot (the after-build hook): breathing, blinks, small head / weight drift
# The older helpers the compiler calls (zw_walk_to, zw_run_away, zw_follow) are redefined here on top of these, so
# every card moves this way.

ZM_LEG = 2.0
ZM_PARTS = ("armL", "armR", "legL", "legR", "head", "torso")


def zm_s(ch):
    s = ch.root.scale[2]
    return s if s > 0 else 1.0


def zm_hold(ch, t, parts=ZM_PARTS, root=True):
    """key the pose the character is IN at t (evaluated): the next action blends from here"""
    sc = bpy.context.scene
    f = F(t)
    sc.frame_set(f)
    for part in parts:
        ch.piv(part).keyframe_insert("rotation_euler", frame=f)
    ch.hip.keyframe_insert("location", index=2, frame=f)
    if root:
        ch.root.keyframe_insert("location", frame=f)
        ch.root.keyframe_insert("rotation_euler", index=2, frame=f)
    return ch


def zm_yaw_at(ch, t):
    bpy.context.scene.frame_set(F(t))
    return math.degrees(ch.root.rotation_euler[2])


def zm_turn(ch, t, yaw, dur=0.45):
    """TURN: the head leads (it looks first), the body follows, a small step in place; returns when the body faces yaw"""
    cur = zm_yaw_at(ch, t)
    delta = ((yaw - cur + 180.0) % 360.0) - 180.0
    if abs(delta) < 5.0:
        return t
    zm_hold(ch, t)
    hy = max(-55.0, min(55.0, delta * 0.7))
    ch.pose(t + dur * 0.3, head=(hy, 0, 0), legL=(8, 0), legR=(-6, 0))
    ch.pose(t + dur, rot=cur + delta, legL=(0, 0), legR=(0, 0))
    ch.pose(t + dur + 0.15, head=(0, 0, 0))
    return t + dur * 0.85


def zm_walk(ch, t0, t1, to, run=False, face=True, arms=True, turn=True):
    """WALK / RUN to a point: head-led turn into the way, steps matched to the ground, arms opposite to the legs, a bob on
    the passing step, a settle into standing at the end"""
    p0 = za_here(ch, t0)
    p1 = Vector(za_pos(to, tuple(p0)))
    p0.z, p1.z = 0.0, 0.0
    d = p1 - p0
    if d.length < 0.2:
        return ch
    yaw = math.degrees(math.atan2(d.x, -d.y))
    tt = zm_turn(ch, t0, yaw, dur=0.3 if run else 0.42) if (face and turn) else t0
    if face and not turn:
        ch.pose(t0, rot=yaw)
    if t1 - tt < 0.25:
        tt = max(t0, t1 - 0.25)
    v = d.length / (t1 - tt)
    L = ZM_LEG * zm_s(ch)
    swing = 40.0 if run else 24.0
    rate = v / (4.0 * L * math.sin(math.radians(swing)))
    if rate > 2.3:
        rate = 2.3
        swing = math.degrees(math.asin(min(0.95, v / (4.0 * L * rate))))
    elif rate < 0.6:
        rate = 0.6
        swing = max(6.0, math.degrees(math.asin(min(0.95, v / (4.0 * L * rate)))))
    arm = swing * (1.3 if run else 1.05)
    zm_hold(ch, tt)
    ch.pose(tt, loc=tuple(p0), interp="LINEAR")
    ch.pose(t1, loc=tuple(p1), interp="LINEAR")
    if run:
        ch.pose(tt + 0.15, torso=(0, 10, 0))
    step = 1.0 / (rate * 2.0)
    bob = (0.2 if run else 0.1)
    t, k = tt + step * 0.5, 0
    while t <= t1 - step * 0.35:
        sg = 1 if k % 2 == 0 else -1
        kw = dict(legL=(swing * sg, 0), legR=(-swing * sg, 0), hipz=0.0)
        if arms:
            kw.update(armL=(-arm * sg, 5), armR=(arm * sg, 5))
        ch.pose(t, **kw)
        if t + step * 0.5 < t1:
            ch.pose(t + step * 0.5, hipz=bob, legL=(0, 0), legR=(0, 0))
        t += step
        k += 1
    end = dict(legL=(0, 0), legR=(0, 0), hipz=0.0)
    if arms:
        end.update(armL=(0, 4), armR=(0, 4))
    ch.pose(t1 + 0.18, **end)
    if run:
        ch.pose(t1 + 0.25, torso=(0, 0, 0))
    return ch


# the compiler's helpers, now on the motion library (no sliding feet, a turn first)
def zw_walk_to(ch, t0, t1, to, face_to=None):
    p0 = za_here(ch, t0)
    p1 = Vector(za_pos(to, tuple(p0)))
    if hasattr(to, "root") or hasattr(to, "matrix_world"):
        d = p1 - p0
        d.z = 0
        p1 = p0 + d * ((d.length - 1.5) / d.length) if d.length > 1.6 else p0.copy()
    zm_walk(ch, t0, t1, (p1.x, p1.y, 0.0))
    if face_to is not None:
        zm_turn(ch, t1 + 0.02, za_yaw(p1, za_pos(face_to)), dur=0.35)
    return ch


def zw_run_away(ch, t0, t1, frm, dist=10.0):
    p0 = za_here(ch, t0)
    f = Vector(za_pos(frm, tuple(p0 + Vector((0, 1, 0)))))
    d = p0 - f
    d.z = 0
    d = d.normalized() if d.length > 1e-3 else Vector((0, -1, 0))
    zm_walk(ch, t0, t1, tuple(p0 + d * dist), run=True)
    return ch


def zw_follow(a, b, t0, t1, gap=3.0):
    pa = za_here(a, t0)
    pb0, pb1 = za_here(b, t0), za_here(b, t1)
    d = pb1 - pb0
    d.z = 0
    if d.length < 0.3:
        d = pb0 - pa
        d.z = 0
    d = d.normalized() if d.length > 1e-3 else Vector((0, 1, 0))
    to = pb1 - d * gap
    zm_walk(a, t0, t1, (to.x, to.y, 0.0))
    return a


def zm_look_around(ch, t0, t1):
    """LOOK AROUND: the head sweeps left, right, back (the body turns a little with it)"""
    zm_hold(ch, t0, ("head", "torso"), root=False)
    d = max(0.6, t1 - t0)
    ch.pose(t0 + d * 0.3, head=(48, -4, 0), torso=(10, 0, 0))
    ch.pose(t0 + d * 0.65, head=(-48, -4, 0), torso=(-10, 0, 0))
    ch.pose(t1, head=(0, 0, 0), torso=(0, 0, 0))
    return ch


def zm_sit(ch, t, seat=None, dur=0.5):
    zm_hold(ch, t)
    zw_sit(ch, t + dur, seat=seat)
    return ch


def zm_stand_up(ch, t, dur=0.55):
    """STAND UP from sitting: lean forward, push up"""
    zm_hold(ch, t)
    ch.pose(t + dur * 0.45, torso=(0, 22, 0), hipz=-0.5, legL=(55, 3), legR=(55, -3))
    ch.pose(t + dur, torso=(0, 0, 0), hipz=0.0, legL=(0, 0), legR=(0, 0), armL=(0, 4), armR=(0, 4))
    return ch


def zm_lie(ch, t, dur=0.8):
    """LIE DOWN on the back (the body tips back, raised so it lies ON the ground)"""
    zm_hold(ch, t)
    r = ch.root
    sc = bpy.context.scene
    sc.frame_set(F(t))
    z0 = r.location.z
    r.keyframe_insert("rotation_euler", index=0, frame=F(t))
    ch.pose(t + dur * 0.4, hipz=-0.8, legL=(60, 4), legR=(60, -4), torso=(0, 18, 0))
    r.rotation_euler[0] = math.radians(-90)
    r.keyframe_insert("rotation_euler", index=0, frame=F(t + dur))
    r.location.z = z0 + 0.55 * zm_s(ch)
    r.keyframe_insert("location", index=2, frame=F(t + dur))
    ch.pose(t + dur, hipz=0.0, legL=(0, 0), legR=(0, 0), torso=(0, 0, 0), armL=(10, 12), armR=(10, 12))
    return ch


def zm_hold_thing(ch, kind, piv, loc, size, rot=(0, 0, 0)):
    """a thing in a hand / in front of the chest, parented so it moves with the body"""
    ob = zw_thing(kind, (0, 0, 0), size=size)
    if ob is None:
        return None
    ob.parent = piv
    ob.location = loc
    ob.rotation_euler = tuple(math.radians(a) for a in rot)
    return ob


def zm_read(ch, t0, t1, book=None):
    """READ A BOOK: both hands hold it in front of the chest, the head looks down, a page turn halfway"""
    zm_hold(ch, t0, root=False)
    if book is None:
        book = zm_hold_thing(ch, "book", ch.hip, (0.0, -1.35, 1.55), 0.8, rot=(-55, 0, 0))
    d = max(0.8, t1 - t0)
    ch.pose(t0 + 0.4, armL=(68, -26), armR=(68, -26), head=(0, 22, 0))
    ch.pose(t0 + d * 0.5, armR=(82, -8), head=(6, 20, 0))
    ch.pose(t0 + d * 0.62, armR=(68, -26), head=(0, 22, 0))
    return book


def zm_phone(ch, t0, t1, phone=None):
    """LOOK AT A PHONE: one hand holds it at chest height, the head bends down to it, the thumb taps"""
    zm_hold(ch, t0, root=False)
    if phone is None:
        phone = zm_hold_thing(ch, "phone", ch.shR, (0.0, -0.45, -1.55), 0.55, rot=(70, 0, 0))
    ch.pose(t0 + 0.35, armR=(82, -22), armL=(20, 8), head=(-8, 26, 0))
    ch.wiggle(t0 + 0.5, t1, part="armR", amp=(3, 2), rate=3.0, base=(82, -22))
    return phone


def zm_ball(name="zm_ball", loc=(0, 0, 0), size=0.9):
    ob = zw_thing("ball", loc, size=size)
    return ob


def zm_fly(ob, t0, t1, a, b, h=2.5):
    """a thing flies from a to b on an arc (t0 -> t1)"""
    a, b = Vector(a), Vector(b)
    for k in range(5):
        u = k / 4.0
        p = a.lerp(b, u)
        p.z += 4.0 * h * u * (1 - u)
        ob.location = p
        ob.keyframe_insert("location", frame=F(t0 + (t1 - t0) * u))
    return ob


def zm_front(ch, t, dist=1.0, z=0.0):
    p = za_here(ch, t)
    a = math.radians(zm_yaw_at(ch, t))
    return Vector((p.x + math.sin(a) * dist, p.y - math.cos(a) * dist, z))


def zm_kick(ch, t, ball, to):
    """KICK: the leg swings back, then through the ball; the ball flies"""
    zm_hold(ch, t - 0.3, root=False)
    ch.pose(t - 0.15, legR=(-35, 0), armL=(30, 10), armR=(-25, 10), torso=(0, -6, 0))
    ch.pose(t, legR=(70, 0), armL=(-20, 10), armR=(30, 10), torso=(0, 8, 0))
    ch.pose(t + 0.4, legR=(0, 0), armL=(0, 4), armR=(0, 4), torso=(0, 0, 0))
    if ball is not None:
        a = zm_front(ch, t, 1.1, 0.45)
        ball.location = a
        ball.keyframe_insert("location", frame=F(t) - 1)
        zm_fly(ball, t, t + 0.8, a, to, h=1.6)
    return ch


def zm_throw_ball(ch, t, ball, to, dur=0.7):
    """THROW: wind up, the arm comes over; the ball leaves the hand and arcs to `to`"""
    zm_hold(ch, t - 0.35, root=False)
    ch.pose(t - 0.2, armR=(165, -12), torso=(0, -8, 0))
    ch.pose(t + 0.05, armR=(55, -6), torso=(0, 10, 0))
    ch.pose(t + 0.4, armR=(0, 4), torso=(0, 0, 0))
    if ball is not None:
        a = zm_front(ch, t, 0.8, 4.2 * zm_s(ch))
        zm_fly(ball, t, t + dur, a, to, h=1.4)
    return ch


def zm_catch(ch, t, dur=0.35):
    """CATCH: both arms come forward to meet the ball at t, then hug it in"""
    zm_hold(ch, t - dur, root=False)
    ch.pose(t - 0.05, armL=(80, -12), armR=(80, -12), torso=(0, 6, 0))
    ch.pose(t + 0.3, armL=(62, -20), armR=(62, -20), torso=(0, 0, 0))
    return ch


def zm_play_catch(a, b, t0, t1, ball=None):
    """two characters throwing a ball to each other"""
    ball = ball if ball is not None else zm_ball("zm_pc", zm_front(a, t0, 0.8, 3.6))
    t, k = t0 + 0.3, 0
    while t + 0.75 <= t1:
        thr, cat = (a, b) if k % 2 == 0 else (b, a)
        to = zm_front(cat, t + 0.7, 0.8, 3.6 * zm_s(cat))
        zm_throw_ball(thr, t, ball, to)
        zm_catch(cat, t + 0.7)
        t += 1.15
        k += 1
    return ball


def zm_wave(ch, t0, t1):
    zm_hold(ch, t0, ("armR", "armL", "head"), root=False)
    ch.pose(t0 + 0.3, armR=(165, 25), armL=(5, 6), head=(0, -6, 0))
    ch.wiggle(t0 + 0.35, max(t0 + 0.6, t1 - 0.25), part="armR", amp=(6, 22), rate=3.2, base=(165, 25))
    ch.pose(t1 + 0.1, armR=(0, 4))
    return ch


def zm_talk(ch, t0, t1):
    """TALK WITH THE HANDS: open-hand gestures every ~0.7 s, small nods"""
    zm_hold(ch, t0, ("armL", "armR", "head"), root=False)
    t, k = t0 + 0.2, 0
    while t < t1 - 0.2:
        if k % 3 == 0:
            ch.pose(t, armR=(48, 26), armL=(14, 8), head=(6, -4, 0))
        elif k % 3 == 1:
            ch.pose(t, armL=(48, 26), armR=(14, 8), head=(-6, 2, 0))
        else:
            ch.pose(t, armL=(40, 30), armR=(40, 30), head=(0, -6, 0))
        t += 0.7
        k += 1
    ch.pose(t1 + 0.1, armL=(0, 4), armR=(0, 4), head=(0, 0, 0))
    return ch


def zm_nod(ch, t, n=2):
    zm_hold(ch, t, ("head",), root=False)
    story.acting.nod(ch, t + 0.05, n, 12, 5.0)
    return ch


def zm_shake_head(ch, t, n=3):
    zm_hold(ch, t, ("head",), root=False)
    story.acting.shake(ch, t + 0.05, n, 18, 6.0)
    return ch


def zm_pick_up(ch, t, thing):
    """PICK UP: crouch and reach down, the thing comes into the hands, stand up holding it"""
    zm_hold(ch, t, root=False)
    ch.pose(t + 0.35, hipz=-0.75, torso=(0, 32, 0), armL=(70, -10), armR=(70, -10), legL=(30, 0), legR=(30, 0))
    if thing is not None:
        zw_grab(ch, t + 0.45, thing)
    ch.pose(t + 0.85, hipz=0.0, torso=(0, 0, 0), armL=(72, -16), armR=(72, -16), legL=(0, 0), legR=(0, 0))
    return ch


def zm_carry(ch, t0, t1, to, thing):
    """CARRY: pick it up, walk with it held in both arms (no arm swing)"""
    zm_pick_up(ch, t0, thing)
    zm_walk(ch, t0 + 0.9, t1, to, arms=False)
    ch.pose(t0 + 0.9, armL=(72, -16), armR=(72, -16))
    ch.pose(t1, armL=(72, -16), armR=(72, -16))
    return ch


def zm_door(ch, t, door, open_=True, angle=80.0):
    """OPEN / CLOSE A DOOR (a pieces.py zp_door): the hand reaches the handle, the door swings"""
    zm_hold(ch, t, ("armR", "torso"), root=False)
    ch.pose(t + 0.25, armR=(88, -4), torso=(0, 8, 0))
    if door is not None:
        zp_door_open(door, t + 0.3, t + 0.9, angle if open_ else -angle)
    ch.pose(t + 0.95, armR=(0, 4), torso=(0, 0, 0))
    return ch


def zm_jump(ch, t):
    zm_hold(ch, t, ("armL", "armR"), root=False)
    ch.pose(t + 0.12, armL=(150, 20), armR=(150, 20))
    ch.jump(t + 0.15)
    ch.pose(t + 0.8, armL=(0, 4), armR=(0, 4))
    return ch


def zm_fall(ch, t):
    zm_hold(ch, t)
    zw_fall(ch, t + 0.05)
    return ch


def zm_hide_peek(ch, t0, t1, cover):
    """HIDE AND PEEK: get behind the cover, crouch, lean out to look, back in, out again"""
    p = Vector(za_pos(cover, tuple(za_here(ch, t0))))
    d = max(1.2, t1 - t0)
    zm_walk(ch, t0, t0 + d * 0.35, (p.x, p.y + 1.6, 0.0), run=True)
    tc = t0 + d * 0.4
    ch.pose(tc, hipz=-0.7, legL=(40, 4), legR=(40, -4), torso=(0, 18, 0), armL=(30, 10), armR=(30, 10))
    ch.pose(tc + d * 0.15, torso=(0, 10, 22), head=(30, 0, 10))
    ch.pose(tc + d * 0.3, torso=(0, 18, 0), head=(0, 0, 0))
    ch.pose(tc + d * 0.45, torso=(0, 10, 22), head=(30, 0, 10))
    return ch


def zm_shiver(ch, t0, t1):
    """SCARED SHAKING: hands up near the face, the body trembles"""
    zm_hold(ch, t0, root=False)
    ch.pose(t0 + 0.2, armL=(118, -22), armR=(118, -22), head=(0, 8, 0))
    t, k = t0 + 0.25, 0
    while t < t1:
        ch.pose(t, torso=(0, 4, 2.5 if k % 2 else -2.5))
        t += 0.06
        k += 1
    return ch


def zm_cheer(ch, t):
    zm_hold(ch, t, root=False)
    ch.act(t + 0.15, "cheer")
    ch.jump(t + 0.2)
    return ch


def zm_cry(ch, t0, t1):
    """CRY: hands to the face, head down, the shoulders bob"""
    zm_hold(ch, t0, root=False)
    ch.pose(t0 + 0.3, armL=(140, -25), armR=(140, -25), head=(0, 16, 0))
    t, k = t0 + 0.4, 0
    while t < t1:
        ch.pose(t, torso=(0, 8 if k % 2 else 3, 0))
        t += 0.32
        k += 1
    return ch


def zm_hug(a, b, t0, t1):
    zm_hold(a, t0, root=False)
    zm_hold(b, t0, root=False)
    return zw_hug(a, b, t0 + 0.1, t1)


# ---------------------------------------------------------------- IDLE LIFE (the after-build hook, every character)
def zm_blink_dots(ch, t0, t1, seed=0):
    """blinks on OUR dot faces: the eye dots squash for 3 frames every 2-4 s"""
    rnd = random.Random(seed + len(ch.name))
    eyes = [o for o in (ch.zp_faces if hasattr(ch, "zp_faces") else []) if "_eye" in o.name]
    if not eyes:
        return 0
    t = t0 + rnd.uniform(0.3, 1.5)
    n = 0
    while t < t1:
        for o in eyes:
            z = o.scale[2]
            o.keyframe_insert("scale", index=2, frame=F(t))
            o.scale[2] = z * 0.12
            o.keyframe_insert("scale", index=2, frame=F(t) + 2)
            o.scale[2] = z
            o.keyframe_insert("scale", index=2, frame=F(t) + 4)
        t += rnd.uniform(2.0, 4.0)
        n += 1
    return n


def zm_alive(ch, t0, t1, seed=0):
    """NOBODY FROZEN: breathing (the chest rises every ~1.8 s), small head and weight drift (noise), blinks"""
    try:
        ch.idle(0.9)
    except Exception:
        pass
    tor = ch.torso
    rnd = random.Random(seed + len(ch.name) * 7)
    t = t0 - rnd.uniform(0.0, 0.9)
    while t < t1 + 0.5:
        tor.scale[2] = 1.0
        tor.keyframe_insert("scale", index=2, frame=F(t))
        tor.scale[2] = 1.03
        tor.keyframe_insert("scale", index=2, frame=F(t + 0.9))
        t += 1.8
    tor.scale[2] = 1.0
    if ch.name in ZW_DOTCHARS:
        zm_blink_dots(ch, t0, t1, seed)
    else:
        try:
            ch.blink(t0, t1, every=(2.0, 4.0))
        except Exception:
            pass
    return ch


def zm_alive_all(S):
    """the hook: every visible character of the shot (not the monsters) is alive"""
    n = 0
    for nm, ch in zw_cast():
        if nm in ZW_MON:
            continue
        zm_alive(ch, S["t0"], S["t1"], seed=n)
        n += 1
    return n
# ===== END OF THE MOTION LIBRARY =====================================================================================
