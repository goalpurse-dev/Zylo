"""Blocky Worlds recipe picks: score 'addictive pacing' of the 38 reference videos (free, local data only)
and pick the best reference per story type. Writes picks.json + picks.html to an output folder.

usage: python scripts/blockyWorlds/shotlib/pickRecipes.py <outDir>

Study material only: patterns, never stories, characters, names, footage or exact shots.
"""
import json, os, re, sys, statistics, html
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3] / "reference" / "blocky-worlds"
AN = ROOT / "analysis"
VID = ROOT / "videos"
OUT = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
OUT.mkdir(parents=True, exist_ok=True)

# ---- story types (hand classification from full transcripts + story analyses; a video may fit several) ----
TYPES = {
    "creature_town_attack": {
        "title": "Creature town under attack",
        "desc": "A town living on / inside a giant creature, attacked by something bigger.",
        "videos": {
            "7699174768242642190": "town inside a whale, a deep-sea thing drags it down",
            "7701115575648455950": "towns on giant animals; turtle town attacked by a chained wolf city",
            "7702213412994010400": "last town is one submarine; a giant thing follows and eats it",
        },
    },
    "curfew_monster": {
        "title": "Curfew rule + night monster",
        "desc": "A town rule about the night, a monster that enforces it, the kid breaks / bends it.",
        "videos": {
            "7698966230471953677": "chalk lines at night or the collector takes you",
            "7701548589666798880": "home before the streetlights go out",
            "7699870521722211598": "plate on the porch every night for the great beast",
            "7701004539062734088": "nobody whistles after sunset",
            "7703557612477910305": "never look at the moon; giant guardian walks at night",
            "7702135684059909384": "find shelter when the lights go out; staff turn into hunters",
            "7705008879855308065": "back before 8, creatures wake at night",
            "7699347056866905358": "deal with the greeter in the woods; it follows you home (rule + monster, not night-bound)",
            "7701254623180410145": "every kid has a monster under the bed; midnight scratching",
        },
    },
    "everyone_except_me": {
        "title": "Everyone except me",
        "desc": "Everyone in town has a gift / thing; the narrator kid doesn't, and that is what saves the day.",
        "videos": {
            "7699012496337685774": "everyone has wings except me; rain grounds them, I climb",
            "7704661562530811169": "everyone is a ninja except me; powers drained, I still fight",
            "7703171633225256224": "everyone has a bunker except me (zombies)",
            "7703625168987475233": "weather follows mood; I'm the only rain cloud in a heat wave",
            "7703675002629000481": "brightest house gets Santa; ours has one sad bulb",
            "7703678904145317152": "everyone believes in Christmas except me",
            "7704795245535350049": "paid for bad luck; I'm never unlucky",
            "7703647414015511840": "ratings over heads; I have negative stars",
            "7700821616963374350": "random superpower on your worst day; I'm the sidekick nobody sees",
            "7700213927216418061": "embarrassing moment printed on shirts; mine is always blank",
            "7703599856924871956": "number above head; mine is zero (quiet, wholesome)",
            "7703902023787285767": "stars when missed; I have none (quiet, wholesome)",
            "7699660040180960526": "players vs NPCs; I'm an NPC who glitches free",
        },
    },
    "lost_pet_in_town": {
        "title": "Lost pet / lost one in town",
        "desc": "NO true lost-pet video in the 38. Nearest shape: someone you love is lost / taken in town, you search at night and bring them home.",
        "videos": {
            "7701548589666798880": "brother taken by the dark; kid finds where the lost go and frees him",
            "7702135684059909384": "little sister lost after closing time; search the aisles at night",
            "7701254623180410145": "kid and his monster companion (pet-like bond), lost and won back",
            "7701004539062734088": "grandfather lost on the forest path; found by a sound only he knows",
        },
    },
    "giant_reveal": {
        "title": "Hidden giant revealed",
        "desc": "Something huge is hidden in plain sight / in the dark; the reveal of its size is the payoff.",
        "videos": {
            "7702213412994010400": "the dark outside the window is an eye",
            "7701548589666798880": "the streetlights are the monsters",
            "7699870521722211598": "the great beast is mom; the kid grows giant",
            "7698966230471953677": "the collector, taller than the streetlights",
            "7703557612477910305": "a jackal-headed giant between the pyramids",
            "7699174768242642190": "an eye bigger than a house in the blowhole",
            "7701254623180410145": "the bed monster grows to the ceiling",
        },
    },
    "rigged_system": {
        "title": "Rigged system / secret control room (extra type)",
        "desc": "Common in the set: unfair town rule, kid sneaks in, finds the hidden machine / big red button, flips it, twist ending.",
        "videos": {
            "7703332734629924128": "richer = higher house; golden mansion falls next to mine",
            "7703429226372009249": "richer = higher house, part 2: castle in space, reset button",
            "7703800777336212768": "touching the ground costs $10; hidden machine under city hall",
            "7704102508859264289": "gold pill vs black pill on your 16th birthday",
            "7704287984052456737": "pills part 2: lines to the rich city, sister in the control room",
            "7705153517203377441": "poor people become invisible",
            "7703950881158466848": "everyone lives on a train that never stops",
            "7701969278022552850": "everyone lives underground; the surface is fine",
            "7702831782365760801": "it rains something different every day; the control room",
            "7704451325764947222": "mysterious numbers above heads; men in black",
            "7704432418194804001": "enter any book; a black-and-white trapped world",
            "7701393916032978194": "smaller = more magic; the wish twist",
        },
    },
    "absurd_rule_comedy": {
        "title": "Absurd rule comedy (extra type)",
        "desc": "A silly rule shown through rapid gag examples; the kid games the rule; punchline ending.",
        "videos": {
            "7704068720796208406": "everyone has a sniper (paintball) on them",
            "7703800777336212768": "touching the ground costs $10",
            "7704795245535350049": "paid for being unlucky",
            "7703625168987475233": "weather follows your mood",
            "7703675002629000481": "Santa lands on the brightest house",
            "7703647414015511840": "star ratings over heads",
        },
    },
}
# weaker fits rank at 85 % of their pacing score inside that type
SECONDARY = {
    "curfew_monster": {"7699347056866905358", "7701254623180410145", "7705008879855308065"},
    "everyone_except_me": {"7699660040180960526", "7703599856924871956", "7703902023787285767", "7703678904145317152", "7700213927216418061"},
    "lost_pet_in_town": {"7701004539062734088", "7701254623180410145"},
    "giant_reveal": {"7699870521722211598", "7699174768242642190", "7701254623180410145"},
    "creature_town_attack": {"7702213412994010400"},
    "rigged_system": {"7701393916032978194", "7704432418194804001", "7704451325764947222"},
    "absurd_rule_comedy": {"7703675002629000481", "7703647414015511840"},
}
FIT = lambda t, i: 0.85 if i in SECONDARY.get(t, ()) else 1.0
TYPE_ORDER = ["creature_town_attack", "curfew_monster", "everyone_except_me", "lost_pet_in_town", "giant_reveal", "rigged_system", "absurd_rule_comedy"]

ACTION = {"threat_arrives", "attack", "giant_action", "defence_or_weapon", "town_shakes", "destruction", "giant_reveal",
          "chase_or_escape", "giant_walk", "chain_or_tether"}
EFFECT = {"people_reaction", "aftermath", "destruction", "town_shakes", "chase_or_escape", "twist_or_ending", "defence_or_weapon"}
CONFLICT = {"threat_arrives", "attack", "giant_reveal", "chase_or_escape", "destruction", "town_shakes", "giant_action", "giant_walk"}
TENSE = re.compile(r"tense|fear|scar|danger|dread|ominous|alarm|panic|frantic|menac|threat|terr|urgent|shock", re.I)
BEATS = ["rule", "tour", "me", "until", "discovery", "climax", "closer"]


def load(p):
    with open(p, encoding="utf8") as f:
        return json.load(f)


def metrics(vid):
    d = AN / vid
    meta, tr, sh, ds, st = (load(d / f) for f in ("meta.json", "transcript.json", "shots.json", "descriptions.json", "story-stats.json"))
    shots = [s for s in sh["shots"] if s["dur"] >= 0.1]  # drop 1-frame slivers
    desc = ds["shots"]
    dur = tr["duration"]
    mins = dur / 60
    text = " ".join(s["text"].strip() for s in tr["segments"])
    words = len(text.split())
    # some transcripts have no punctuation: never count fewer sentences than ~1 per 14 words
    sentences = max(1, len([x for x in re.split(r"[.!?]+", text) if len(x.split()) >= 2]), round(words / 14))
    lens = [s["dur"] for s in shots]
    med = statistics.median(lens)
    cv = statistics.pstdev(lens) / statistics.mean(lens)
    inten = [s["move"].get("intensity") for s in shots]
    strong = sum(1 for i in inten if i in ("fast", "whip")) / len(shots)
    energy = sum(1 if i in ("fast", "whip") else 0.4 if i == "medium" else 0 for i in inten) / len(shots)
    ck = meta["stats"]["cutKinds"]
    cuts = sum(ck.values())
    onword = (ck.get("on_word_start", 0) + ck.get("before_word", 0)) / max(1, cuts)
    # descriptions in time order
    rows = []
    for s in sh["shots"]:
        x = desc.get(str(s["n"]))
        if x:
            rows.append((s, x))
    cats = [x.get("libraryCategory") for _, x in rows]
    # hook: first wide establish + first conflict shot
    est = st.get("establish", {})
    firstWide = est.get("firstWideSec")
    firstWide = 30.0 if firstWide is None else firstWide
    fc = next((s["t0"] for s, x in rows if x.get("libraryCategory") in CONFLICT or TENSE.search(str(x.get("emotion", "")))), dur)
    # cause -> effect pairs (action shot followed by an effect shot), per minute
    ce = sum(1 for a, b in zip(cats, cats[1:]) if a in ACTION and b in EFFECT)
    ce += sum(1 for _, x in rows if x.get("libraryCategory") in ACTION and str(x.get("causeEffect", "")).strip()) * 0.25
    # payoff: funny beats + reveals / twists (count runs, not consecutive repeats), per minute
    pay = 0
    prev = None
    for _, x in rows:
        c = x.get("libraryCategory")
        hit = x.get("funnyBeat") or c in ("giant_reveal", "twist_or_ending")
        if hit and prev != c:
            pay += 1
        prev = c if hit else None
    # beat coverage: beats with >=1 shot and >=1 s, and none hogging > 45 % of the video
    pb = st["perBeat"]
    cov = sum(1 for b in BEATS if pb.get(b, {}).get("shots", 0) >= 1 and pb.get(b, {}).get("sec", 0) >= 1)
    hog = max((pb.get(b, {}).get("share", 0) for b in BEATS), default=0)
    beatScore = cov / 7 - max(0, hog - 0.45)
    # recurring wide cadence: median gap in the 4-9 s band, no long hole
    wg = st.get("wides", {}).get("gapSec", {})
    p50 = wg.get("p50", 30) or 30
    mx = st.get("wides", {}).get("maxGapSec", 60) or 60
    wideScore = -(max(0, p50 - 9) + max(0, 4 - p50)) - 0.15 * max(0, mx - 15)
    # escalation: climax shots shorter than the tour/me shots (speeds up toward the end)
    early = [pb[b]["meanShot"] for b in ("tour", "me") if pb.get(b, {}).get("meanShot")]
    late = [pb[b]["meanShot"] for b in ("until", "climax") if pb.get(b, {}).get("meanShot")]
    accel = (statistics.mean(early) - statistics.mean(late)) if early and late else 0
    return {
        "id": vid, "duration": round(dur, 1), "shots": len(shots), "sentences": sentences,
        "firstLine": tr["segments"][0]["text"].strip(),
        "m": {
            "shotsPerSentence": round(len(shots) / sentences, 2),
            "medianShot": round(med, 2),
            "shotCV": round(cv, 2),
            "strongMotion": round(strong, 3),
            "motionEnergy": round(energy, 3),
            "firstWideSec": round(firstWide, 2),
            "firstConflictSec": round(fc, 2),
            "cutOnWord": round(onword, 3),
            "wideGapP50": p50, "wideGapMax": mx, "wideScore": round(wideScore, 2),
            "causeEffectPerMin": round(ce / mins, 2),
            "beatCoverage": cov, "beatHog": hog, "beatScore": round(beatScore, 3),
            "payoffPerMin": round(pay / mins, 2),
            "wordsPerMin": round(words / mins, 1),
            "accel": round(accel, 2),
        },
    }


# metric -> (weight, direction or sweet spot, label)
WEIGHTS = [
    ("shotsPerSentence", 12, +1, "cuts per sentence"),
    ("medianShot", 10, -1, "short median shot"),
    ("shotCV", 4, ("band", 0.45, 0.8), "rhythm variety (CV 0.45-0.8)"),
    ("motionEnergy", 10, +1, "camera motion energy"),
    ("firstWideSec", 5, -1, "first wide fast"),
    ("firstConflictSec", 10, -1, "first conflict fast"),
    ("cutOnWord", 10, +1, "cuts on word starts"),
    ("wideScore", 5, +1, "recurring wide cadence"),
    ("causeEffectPerMin", 10, +1, "cause->effect pairs/min"),
    ("beatScore", 7, +1, "7-beat coverage"),
    ("payoffPerMin", 10, +1, "payoffs (funny/reveal/twist)/min"),
    ("wordsPerMin", 4, +1, "narration speed"),
    ("accel", 3, +1, "speeds up toward climax"),
]


def rank_scores(all_):
    n = len(all_)
    for key, w, dirn, _ in WEIGHTS:
        vals = []
        for v in all_:
            x = v["m"][key]
            if isinstance(dirn, tuple):
                lo, hi = dirn[1], dirn[2]
                x = -(max(0, lo - x) + max(0, x - hi))
            elif dirn < 0:
                x = -x
            vals.append(x)
        order = sorted(vals)
        for v, x in zip(all_, vals):
            # percentile rank, ties share the mean rank
            lo = order.index(x)
            hi = n - 1 - order[::-1].index(x)
            v.setdefault("r", {})[key] = round(((lo + hi) / 2) / (n - 1), 3)
    tw = sum(w for _, w, _, _ in WEIGHTS)
    for v in all_:
        v["parts"] = {k: round(v["r"][k] * w * 100 / tw, 1) for k, w, _, _ in WEIGHTS}
        v["score"] = round(sum(v["parts"].values()), 1)


def pick_stills(vid, n=4):
    d = AN / vid
    sh = load(d / "shots.json")["shots"]
    ds = load(d / "descriptions.json")["shots"]
    st = load(d / "story-stats.json")
    beats = {b["beat"]: b for b in st["beats"]}
    dur = sh[-1]["t1"]

    def beat_of(t):
        for b in BEATS:
            if b in beats and beats[b]["t0"] - 0.05 <= t < beats[b]["t1"] + 0.05:
                return b
        return "closer" if t > dur * 0.8 else None

    rows = []
    for s in sh:
        x = ds.get(str(s["n"]))
        if x and s["dur"] >= 0.4:
            rows.append({"n": s["n"], "t": (s["t0"] + s["t1"]) / 2, "dur": s["dur"], "beat": beat_of((s["t0"] + s["t1"]) / 2),
                         "cat": x.get("libraryCategory"), "dist": x.get("distance"), "label": x.get("libraryLabel", ""),
                         "inten": s["move"].get("intensity"), "who": x.get("who"),
                         "img": f"frames/s{s['n']:03d}_mid.jpg"})

    def best(pred, key, used):
        c = [r for r in rows if pred(r) and r["n"] not in used]
        return max(c, key=key) if c else None

    used = set()
    picks = []
    # 1 opening establish: wide/establishing in the first 15 %
    a = best(lambda r: r["t"] < dur * 0.15, lambda r: (r["cat"] == "establishing") * 3 + (r["dist"] in ("wide", "extreme_wide")) * 2 - r["t"] / 10, used)
    # 2 mid-story action: until/discovery, action category, strongest motion
    INT = {"whip": 3, "fast": 2, "medium": 1}
    b = best(lambda r: r["beat"] in ("until", "discovery") or dur * 0.35 < r["t"] < dur * 0.65,
             lambda r: (r["cat"] in ACTION) * 3 + INT.get(r["inten"], 0) + (r["who"] == "people_and_creature"), used | ({a["n"]} if a else set()))
    used |= {x["n"] for x in (a, b) if x}
    # 3 climax: climax beat, reveal/attack/giant categories, wide preferred
    c = best(lambda r: r["beat"] == "climax" or dur * 0.65 < r["t"] < dur * 0.88,
             lambda r: (r["cat"] in ("giant_reveal", "giant_action", "attack", "destruction", "town_shakes", "defence_or_weapon")) * 3 + (r["dist"] in ("wide", "extreme_wide")) + INT.get(r["inten"], 0) * 0.5, used)
    if c:
        used.add(c["n"])
    # 4 ending: closer beat, twist/aftermath, late
    e = best(lambda r: r["beat"] == "closer" or r["t"] > dur * 0.88,
             lambda r: (r["cat"] in ("twist_or_ending", "aftermath")) * 3 + r["t"] / dur, used)
    out = []
    for tag, r in zip(["opening establish", "mid-story action", "climax", "ending"], [a, b, c, e]):
        if r:
            out.append({"tag": tag, "shot": r["n"], "t": round(r["t"], 1), "label": r["label"], "cat": r["cat"],
                        "src": (AN / vid / r["img"]).as_uri()})
    return out[:n]


RAW_FMT = {"shotsPerSentence": "{} /sent", "medianShot": "{} s", "shotCV": "CV {}", "motionEnergy": "{}", "firstWideSec": "{} s",
           "firstConflictSec": "{} s", "cutOnWord": "{}", "wideScore": "p50 gap {wideGapP50}s, max {wideGapMax}s",
           "causeEffectPerMin": "{} /min", "beatScore": "{beatCoverage}/7 beats", "payoffPerMin": "{} /min", "wordsPerMin": "{} wpm", "accel": "{} s"}


def render_html(out, by):
    E = html.escape
    tw = sum(w for _, w, _, _ in WEIGHTS)

    def vsrc(i):
        rel = load(AN / i / "meta.json").get("source", {}).get("rel") or f"snaptik_{i}_v3.mp4"
        return (VID / rel).as_uri()

    def breakdown(v):
        rows = []
        for k, w, _, label in WEIGHTS:
            mx = w * 100 / tw
            part = v["parts"][k]
            fmt = RAW_FMT.get(k, "{}")
            raw = fmt.format(v["m"][k], **v["m"]) if "{}" in fmt else fmt.format(**v["m"])
            rows.append(f'<div class="br"><span class="bl">{E(label)}</span><span class="bar"><i style="width:{part / mx * 100:.0f}%"></i></span>'
                        f'<span class="bv">{part:.1f}/{mx:.0f}</span><span class="raw">{E(raw)}</span></div>')
        return "".join(rows)

    secs = []
    for idx, t in enumerate(TYPE_ORDER):
        T = out["types"][t]
        v = by[T["pick"]]
        stills = "".join(f'<figure><img src="{s["src"]}" loading="lazy"><figcaption><b>{E(s["tag"])}</b> · shot {s["shot"]} · {s["t"]}s<br>{E(s["label"])}</figcaption></figure>' for s in T["pickStills"])
        alts = ""
        for a in T["alts"]:
            av = by[a["id"]]
            ast = "".join(f'<img src="{s["src"]}" title="{E(s["tag"])}: {E(s["label"])}">' for s in a["stills"])
            also = ", ".join(x for x in av["types"] if x != t)
            alts += (f'<div class="alt" data-src="{vsrc(a["id"])}">{ast}<div class="at"><div class="aid">{a["id"]}</div>'
                     f'<div class="as">{a["score"]}</div><div>{E(a["why"])}</div><div class="dim">{av["duration"]} s · {av["shots"]} shots'
                     f'{" · also: " + E(also) if also else ""}</div><div class="swap">swap to this: say "swap {t} to {a["id"]}"</div>'
                     f'<button>play this one</button></div></div>')
        also = ", ".join(x for x in v["types"] if x != t)
        secs.append(f'''<section id="s{idx}">
<header><div class="k">{idx + 1} / {len(TYPE_ORDER)} · {E(t)}</div><h1>{E(T["title"])}</h1><p class="desc">{E(T["desc"])}</p></header>
<div class="main">
 <div class="stills">{stills}</div>
 <div class="side">
  <video controls preload="metadata" src="{vsrc(T["pick"])}"></video>
  <div class="vid">{T["pick"]}{" · also fits: " + E(also) if also else ""}</div>
 </div>
 <div class="info">
  <div class="score">{v["score"]}<small>/100 pacing</small></div>
  <div class="facts">{v["duration"]} s · {v["shots"]} shots · median shot {v["m"]["medianShot"]} s</div>
  <p class="why">{E(T["pickWhy"])}</p>
  <p class="first">“{E(v["firstLine"])}”</p>
  <div class="bd">{breakdown(v)}</div>
 </div>
</div>
<h2>Alternatives</h2><div class="alts">{alts}</div>
</section>''')
    # final screen: all 38 ranked
    trs = "".join(f'<tr><td>{i}</td><td>{v["id"]}</td><td class="n">{v["score"]}</td><td class="n">{v["duration"]}</td><td class="n">{v["shots"]}</td>'
                  f'<td>{E(", ".join(v["types"]))}</td><td>{E(v["firstLine"][:90])}</td></tr>' for i, v in enumerate(out["videos"], 1))
    wt = "".join(f'<tr><td>{E(l)}</td><td class="n">{w}</td><td>{E(str(d))}</td></tr>' for k, w, d, l in WEIGHTS)
    secs.append(f'''<section id="s{len(TYPE_ORDER)}"><header><div class="k">all 38</div><h1>Pacing ranking + weights</h1>
<p class="desc">Each metric is turned into a percentile rank across the 38 videos (0 = worst, 1 = best), times its weight; total 100. Sweet-spot metrics score distance from the band. No view counts are stored locally, so views are not in the score.</p></header>
<div class="tables"><table><tr><th>#</th><th>video</th><th>score</th><th>s</th><th>shots</th><th>types</th><th>first line</th></tr>{trs}</table>
<table><tr><th>metric</th><th>weight</th><th>better when</th></tr>{wt}</table></div></section>''')
    nav = "".join(f'<a href="#s{i}" data-i="{i}">{E(t)}</a>' for i, t in enumerate(TYPE_ORDER + ["all 38"]))
    return f'''<!doctype html><html><head><meta charset="utf-8"><title>Blocky Worlds Recipe Picks</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{{--bg:#0d0f14;--card:#171a22;--ink:#e9ecf2;--dim:#8a93a6;--acc:#ffb547;--bar:#2a2f3c}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--ink);font:16px/1.4 system-ui,Segoe UI,sans-serif}}
nav{{position:sticky;top:0;z-index:5;display:flex;gap:6px;flex-wrap:wrap;padding:10px 16px;background:#0d0f14ee;border-bottom:1px solid #222}}
nav a{{color:var(--dim);text-decoration:none;padding:4px 10px;border-radius:14px;font-size:14px}}nav a.on{{background:var(--acc);color:#111}}
nav .hint{{margin-left:auto;color:var(--dim);font-size:13px}}
section{{display:none;padding:18px 24px 40px}}section.on{{display:block}}
.k{{color:var(--acc);font-size:14px;letter-spacing:.05em;text-transform:uppercase}}h1{{margin:4px 0;font-size:34px}}.desc{{color:var(--dim);margin:0 0 14px;max-width:1100px}}
.main{{display:grid;grid-template-columns:minmax(0,4fr) minmax(220px,1.1fr) minmax(300px,1.6fr);gap:18px;align-items:start}}
.stills{{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}}
figure{{margin:0;background:var(--card);border-radius:10px;overflow:hidden}}figure img{{width:100%;aspect-ratio:9/16;object-fit:cover;display:block}}
figcaption{{padding:6px 8px;font-size:13px;color:var(--dim)}}figcaption b{{color:var(--ink)}}
video{{width:100%;aspect-ratio:9/16;background:#000;border-radius:10px}}.vid{{font-size:12px;color:var(--dim);margin-top:4px;word-break:break-all}}
.info{{background:var(--card);border-radius:12px;padding:14px}}.score{{font-size:52px;font-weight:700;color:var(--acc);line-height:1}}.score small{{font-size:15px;color:var(--dim);margin-left:6px}}
.facts{{color:var(--dim);margin:6px 0}}.why{{margin:8px 0;font-size:17px}}.first{{font-style:italic;color:#c9d1e0;margin:8px 0 12px}}
.br{{display:grid;grid-template-columns:150px 1fr 58px 120px;gap:6px;align-items:center;font-size:12.5px;margin:3px 0}}.bl{{color:var(--dim)}}
.bar{{height:8px;background:var(--bar);border-radius:4px;overflow:hidden}}.bar i{{display:block;height:100%;background:var(--acc)}}.bv{{text-align:right}}.raw{{color:var(--dim)}}
h2{{margin:22px 0 8px;font-size:20px}}.alts{{display:grid;grid-template-columns:1fr 1fr;gap:14px}}
.alt{{display:flex;gap:8px;background:var(--card);border-radius:12px;padding:10px}}.alt img{{width:100px;aspect-ratio:9/16;object-fit:cover;border-radius:6px}}
.at{{font-size:14px;display:flex;flex-direction:column;gap:3px}}.aid{{color:var(--dim);font-size:12px}}.as{{font-size:26px;font-weight:700;color:var(--acc)}}
.dim{{color:var(--dim);font-size:13px}}.swap{{color:#9fd3ff;font-size:13px}}button{{align-self:start;background:#2a2f3c;color:var(--ink);border:0;border-radius:6px;padding:5px 10px;cursor:pointer}}
.tables{{display:grid;grid-template-columns:3fr 1fr;gap:20px}}table{{border-collapse:collapse;font-size:13px;width:100%}}td,th{{padding:4px 6px;border-bottom:1px solid #222;text-align:left}}.n{{text-align:right}}
@media (max-width:1100px){{.main{{grid-template-columns:1fr}}.alts,.tables{{grid-template-columns:1fr}}}}
</style></head><body>
<nav>{nav}<span class="hint">← → to move · study only: patterns, never stories</span></nav>
{"".join(secs)}
<script>
const S=[...document.querySelectorAll('section')],A=[...document.querySelectorAll('nav a')];let cur=0;
function go(i){{cur=(i+S.length)%S.length;S.forEach((s,j)=>s.classList.toggle('on',j===cur));A.forEach((a,j)=>a.classList.toggle('on',j===cur));
document.querySelectorAll('video').forEach(v=>v.pause());history.replaceState(null,'','#s'+cur);scrollTo(0,0)}}
A.forEach((a,j)=>a.onclick=e=>{{e.preventDefault();go(j)}});
addEventListener('keydown',e=>{{if(e.key==='ArrowRight')go(cur+1);if(e.key==='ArrowLeft')go(cur-1)}});
document.querySelectorAll('.alt button').forEach(b=>b.onclick=()=>{{const v=b.closest('section').querySelector('video');v.src=b.closest('.alt').dataset.src;v.play()}});
go(parseInt((location.hash.match(/\\d+/)||[0])[0])||0);
</script></body></html>'''


def main():
    ids = sorted(p.name for p in AN.iterdir() if p.is_dir() and p.name.isdigit())
    all_ = [metrics(v) for v in ids]
    rank_scores(all_)
    by = {v["id"]: v for v in all_}
    # types per video
    for v in all_:
        v["types"] = [t for t in TYPE_ORDER if v["id"] in TYPES[t]["videos"]]
    # picks: per type ranked by score; distinct top picks where possible (types with fewer candidates choose first)
    taken = set()
    result = {}
    for t in sorted(TYPE_ORDER, key=lambda t: len(TYPES[t]["videos"])):
        cands = sorted(TYPES[t]["videos"], key=lambda i: -by[i]["score"] * FIT(t, i))
        top = next((i for i in cands if i not in taken), cands[0])
        taken.add(top)
        alts = [i for i in cands if i != top][:2]
        result[t] = {"pick": top, "alts": alts, "ranked": [(i, by[i]["score"], FIT(t, i)) for i in cands]}
    out = {"weights": [{"metric": k, "weight": w, "label": l, "direction": d if not isinstance(d, tuple) else list(d)} for k, w, d, l in WEIGHTS],
           "videos": sorted(all_, key=lambda v: -v["score"]), "types": {}, "viewCounts": "not in meta.json (no views stored locally)"}
    for t in TYPE_ORDER:
        r = result[t]
        out["types"][t] = {**{k: TYPES[t][k] for k in ("title", "desc")}, "pick": r["pick"], "pickWhy": TYPES[t]["videos"][r["pick"]],
                           "pickStills": pick_stills(r["pick"]),
                           "alts": [{"id": i, "why": TYPES[t]["videos"][i], "score": by[i]["score"], "stills": [s for s in pick_stills(i) if s["tag"] in ("opening establish", "climax")]} for i in r["alts"]],
                           "ranked": r["ranked"]}
    (OUT / "picks.json").write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf8")
    (OUT / "picks.html").write_text(render_html(out, by), encoding="utf8")
    print("score table (rank, id, score, dur, shots, types):")
    for i, v in enumerate(out["videos"], 1):
        print(i, v["id"], v["score"], v["duration"], v["shots"], ",".join(v["types"]), {k: v["m"][k] for k in ("shotsPerSentence", "medianShot", "motionEnergy", "firstConflictSec", "cutOnWord", "causeEffectPerMin", "payoffPerMin")})
    for t in TYPE_ORDER:
        print(t, result[t]["ranked"])


if __name__ == "__main__":
    main()
