"""Blocky Worlds asset library: the CATALOG builder (free, local, no Blender). Scans the kept (CC0) packs unpacked under
reference/blocky-worlds/assets-incoming/_unpacked/ (git-excluded; their files are DATA, nothing in them is run), picks one
model file per asset, measures it (glTF / GLB node transforms, OBJ Y-up -> Blender Z-up), scales it to OUR units (a
character is ~5.2 tall) with the pack's factor, tags it, and writes:
  scripts/blockyWorlds/blenderKit/assets/catalog.json   (committed: the director's and the worlds' view of the library)
  scripts/blockyWorlds/blenderKit/assets/previews/*.jpg (committed: small previews where the pack ships one)
The image build (Dockerfile + build_assets.py) converts exactly these files into /app/zyvo_assets/zyvo_assets.blend.
    python -P catalog.py <_unpacked dir> [--stats]
Adding a pack later: unpack it, check its license, add one PACKS entry (dir, license, evidence, files, factor, tags), run
this, rebuild the image (README "Asset library")."""
import glob
import json
import math
import os
import re
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = sys.argv[1]
STATS = "--stats" in sys.argv

# key, folder, licence, evidence, file glob(s) (relative to the folder), scale factor (pack units -> ours), tags, use
PACKS = [
    ("kcity", "kenney_city-kit-commercial_2.1", "CC0", "License.txt (Kenney, CC0 1.0)", ["Models/GLB format/*.glb"], 13.0, ["city", "building", "downtown"], "buildings, shop fronts, awnings, signs-free details"),
    ("kfood", "kenney_food-kit", "CC0", "License.txt (Kenney, CC0 1.0)", ["Models/GLB format/*.glb"], 3.0, ["food", "kitchen", "shop"], "food on shelves, counters, tables"),
    ("ktown", "kenney_fantasy-town-kit_2.0", "CC0", "License.txt (Kenney, CC0 1.0)", ["Models/GLB format/*.glb"], 7.0, ["town", "village", "prop"], "walls, roofs, fences, lanterns, carts, trees"),
    ("kgrave", "kenney_graveyard-kit_5.0", "CC0", "License.txt (Kenney, CC0 1.0)", ["Models/GLB format/*.glb"], 6.0, ["graveyard", "spooky", "night"], "spooky stories: graves, gates, lanterns, pumpkins"),
    ("ktower", "kenney_tower-defense-kit", "CC0", "License.txt (Kenney, CC0 1.0)", ["Models/GLB format/*.glb"], 6.0, ["terrain", "nature", "tower"], "rocks, trees, crystals, towers"),
    ("kmini", "kenney_mini-characters_2.0", "CC0", "License.txt (Kenney, CC0 1.0)", ["Models/GLB format/*.glb"], 7.2, ["character", "people"], "not used in worlds (the kit's characters are our look); catalogue only"),
    ("kblocky", "kenney_blocky-characters_2.0", "CC0", "License.txt (Kenney, CC0 1.0)", ["Models/GLB format/*.glb"], 1.93, ["character", "people"], "not used in worlds (the kit's characters are our look); catalogue only"),
    ("kroad", "3D_Road_pack", "CC0", "License.txt (Kenney 3D Road Tiles, CC0 1.0)", ["Models/**/*.obj"], 6.0, ["road", "street"], "road tiles, crossings, barriers"),
    ("kmod", "modularBuildings", "CC0", "License.txt (Kenney 3D Modular buildings, CC0 1.0)", ["Models/*.obj"], 9.0, ["building", "modular"], "building blocks"),
    ("kaykit", "KayKit_City_Builder_Bits_1.0_FREE", "CC0", "KayKit_City_Builder_Bits_1.0_FREE/License.txt (Kay Lousberg, CC0 1.0)", ["KayKit_City_Builder_Bits_1.0_FREE/Assets/gltf/*.gltf"], 10.0, ["city", "downtown", "street"], "buildings, cars, street props"),
    ("rland", "LandscapeAsset_v1", "CC0", "license.txt (eracoon, CC0 1.0)", ["obj/*.obj"], 2.25, ["nature", "landscape"], "trees, rocks, bushes"),
    ("rrace", "racing_assets_v1_oga", "CC0", "license.txt (eracoon, CC0 1.0)", ["obj/*.obj"], 4.4, ["road", "racing", "street"], "barriers, cones, signs, tyres"),
    ("rveh", "vehicle_asset_v1", "CC0", "license.txt (eracoon, CC0 1.0)", ["obj/*.obj"], 4.8, ["vehicle", "car", "street"], "cars, vans, buses"),
    ("ngrass", "multi_stylized_grass", "CC0", "readme.txt (Nobiax, CC0 1.0 Universal)", ["*.obj"], 0.04, ["nature", "grass"], "grass tufts"),
    ("nweeds", "tiny_weeds", "CC0", "readme.txt (Nobiax, CC0 1.0 Universal)", ["*/*.obj", "*.obj"], 0.01, ["nature", "weeds"], "weeds"),
    # ---- V2 packs (owner added 2026-11-15; licences read from each pack's own file; factors from a reference model:
    # door ~7, car ~12 long, chair seat ~2.4, pet ~2.6 tall, our character 5.2; scratchpad measure.py). Worlds unchanged.
    ("qdown", "Downtown_City_MegaKitStandard", "CC0", "License_Standard.txt (Quaternius, CC0 1.0 Universal)", ["Exports/glTF (Godot)/*.gltf"], 3.2, ["city", "downtown", "building", "street"], "modular downtown facades, doors, windows, street props (v2)"),
    ("qnature", "Stylized_Nature_MegaKitStandard", "CC0", "License_Standard.txt (Quaternius, CC0 1.0 Universal)", ["glTF/*.gltf"], 3.0, ["nature", "park"], "stylized trees, bushes, rocks, flowers (v2)"),
    ("qhome", "Ultimate_House_Interior_Pack_-_June_2020", "CC0", "License.txt (Quaternius, CC0 1.0 Universal)", ["*/OBJ/*.obj"], 2.0, ["interior", "home", "furniture"], "beds, chairs, couches, kitchen, bathroom (v2)"),
    ("qnat19", "Ultimate_Nature_Pack_-_Jun_2019", "CC0", "License.txt (Quaternius, CC0 1.0 Universal)", ["*/OBJ/*.obj"], 4.0, ["nature", "forest"], "low-poly trees, rocks, plants (v2)"),
    ("qspace", "Ultimate_Space_Kit_-_March_2023", "CC0", "License.txt (Quaternius, CC0 1.0 Universal)", ["*/*/GLTF/*.gltf"], 1.6, ["space", "moon", "sci-fi"], "astronauts, rovers, space houses, items (v2)"),
    ("kbuild", "kenney_building-kit", "CC0", "License.txt (Kenney, CC0 1.0)", ["Models/GLB format/*.glb"], 3.3, ["building", "modular"], "walls, doors, windows, stairs, roofs (v2)"),
    ("kcar", "kenney_car-kit", "CC0", "License.txt (Kenney, CC0 1.0)", ["Models/GLB format/*.glb"], 4.7, ["vehicle", "car", "street"], "sedans, taxis, police, firetruck, trucks, vans (v2)"),
    ("kind", "kenney_city-kit-industrial_2.0", "CC0", "License.txt (Kenney, CC0 1.0)", ["Models/GLB format/*.glb"], 13.0, ["city", "industrial", "building"], "factories, chimneys, tanks (v2)"),
    ("kroads", "kenney_city-kit-roads", "CC0", "License.txt (Kenney, CC0 1.0)", ["Models/GLB format/*.glb"], 13.0, ["road", "street"], "roads, crossings, bridges, street lights, signs (v2)"),
    ("ksub", "kenney_city-kit-suburban_20", "CC0", "License.txt (Kenney, CC0 1.0)", ["Models/GLB format/*.glb"], 13.0, ["suburb", "house", "building"], "suburban houses, fences, trees, driveways (v2)"),
    ("kpets", "kenney_cube-pets_1.0", "CC0", "License.txt (Kenney, CC0 1.0)", ["Models/GLB format/*.glb"], 1.65, ["animal", "pet"], "cube pets: dog, cat, pig, bee, beaver ... (v2)"),
    ("kshop", "kenney_mini-shop_2.1", "CC0", "License.txt (Kenney, CC0 1.0)", ["Models/GLB format/*.glb"], 7.2, ["shop", "store", "interior"], "shelves, registers, fridges (v2)"),
    ("kpirate", "kenney_pirate-kit", "CC0", "License.txt (Kenney, CC0 1.0)", ["Models/GLB format/*.glb"], 2.1, ["pirate", "ship", "sea"], "ships, barrels, chests, docks (v2)"),
    ("kplat", "kenney_platformer-kit", "CC0", "License.txt (Kenney, CC0 1.0)", ["Models/GLB format/*.glb"], 5.7, ["platformer", "game", "prop"], "blocks, coins, flags, trees, platforms (v2)"),
    ("kretro", "kenney_retro-fantasy-kit", "CC0", "License.txt (Kenney, CC0 1.0)", ["Models/GLB format/*.glb"], 9.0, ["castle", "fantasy", "building"], "castle walls, towers, gates, barrels (v2)"),
    ("kstation", "kenney_space-station-kit", "CC0", "License.txt (Kenney, CC0 1.0)", ["Models/GLB format/*.glb"], 4.4, ["space", "interior", "sci-fi"], "station corridors, rooms, chairs, consoles (v2)"),
    ("ktrain", "kenney_train-kit", "CC0", "License.txt (Kenney, CC0 1.0)", ["Models/GLB format/*.glb"], 8.0, ["train", "railway", "vehicle"], "locomotives, carriages, rails, stations (v2)"),
    ("kboat", "kenney_watercraft-pack", "CC0", "License.txt (Kenney, CC0 1.0)", ["Models/GLB format/*.glb"], 3.6, ["boat", "sea", "vehicle"], "boats, buoys, docks (v2)"),
]
# kept by licence but not imported: .blend-only (untrusted files are never opened by our build) and photo-textured
# excluded (owner 2026-11-14): no licence text found, never used: Animals, CWU_player-spaceship, clouds1, modular_village_collection, pinetree0; booksOGA_GPL (GPL)
EXCLUDED = {"Animals": "no licence text", "CWU_player-spaceship": "no licence text", "clouds1": "no licence text", "modular_village_collection": "no licence text", "pinetree0": "no licence text", "booksOGA_GPL": "GPL",
            # v2 (2026-11-15): no licence file in the zip (they look like Quaternius packs, but unclear = excluded)
            "Blocks": "no licence text (v2)", "Characters": "no licence text (v2)", "Cube_World_-_Aug_2023": "no licence text (v2)", "Pixel_Blocks": "no licence text (v2)"}
NOT_IMPORTED = {"chicken": "CC0 (license.txt); .blend only + photo texture: not our look, not opened", "forest-monster": "CC0 (Licenses.txt); .blend only + photo textures: not our look, not opened",
                # v2: CC0 but not 3D models (2D textures / UI / sky images: kept for later, nothing to import here)
                "kenney_pattern-pack-extra": "CC0; 2D patterns", "kenney_retro-textures-fantasy": "CC0; 2D textures", "kenney_skyboxes": "CC0; sky images (a later sky option)", "kenney_ui-pack-space-expansion": "CC0; 2D UI",
                "kenney_blocky-characters_20 / kenney_mini-characters (zips)": "CC0; byte-identical to the packs already in the catalog"}
SKIP = re.compile(r"withoutBase|_LOD|lod\d|collision", re.I)
BRANDS = re.compile(r"coca|cola|pepsi|mcdonald|starbucks|nike|adidas|roblox|lego|disney|ikea|shell|bp_|toyota|ford|bmw|audi|mercedes|ferrari|tesla", re.I)


def q_mat(q):
    x, y, z, w = q
    return [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]


def node_m(n):
    if "matrix" in n:
        m = n["matrix"]
        return [[m[0], m[4], m[8], m[12]], [m[1], m[5], m[9], m[13]], [m[2], m[6], m[10], m[14]], [0, 0, 0, 1]]
    t, r, s = n.get("translation", [0, 0, 0]), n.get("rotation", [0, 0, 0, 1]), n.get("scale", [1, 1, 1])
    R = q_mat(r)
    return [[R[i][0] * s[0], R[i][1] * s[1], R[i][2] * s[2], t[i]] for i in range(3)] + [[0, 0, 0, 1]]


def mul(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]


def gltf_json(p):
    b = open(p, "rb").read()
    if p.lower().endswith(".glb"):
        ln = struct.unpack("<I", b[12:16])[0]
        return json.loads(b[20:20 + ln])
    return json.loads(b.decode("utf-8"))


def gltf_bbox(p):
    j = gltf_json(p)
    lo, hi = [1e9] * 3, [-1e9] * 3
    scene = j.get("scenes", [{}])[j.get("scene", 0)] if j.get("scenes") else {"nodes": list(range(len(j.get("nodes", []))))}

    def walk(ni, M):
        n = j["nodes"][ni]
        W = mul(M, node_m(n))
        if "mesh" in n:
            for prim in j["meshes"][n["mesh"]]["primitives"]:
                a = j["accessors"][prim["attributes"]["POSITION"]]
                if "min" not in a:
                    continue
                for cx in (a["min"][0], a["max"][0]):
                    for cy in (a["min"][1], a["max"][1]):
                        for cz in (a["min"][2], a["max"][2]):
                            v = [sum(W[i][k] * c for k, c in enumerate((cx, cy, cz, 1))) for i in range(3)]
                            # glTF Y-up -> Blender Z-up: (x, -z, y)
                            b3 = (v[0], -v[2], v[1])
                            for i in range(3):
                                lo[i], hi[i] = min(lo[i], b3[i]), max(hi[i], b3[i])
        for c in n.get("children", []):
            walk(c, W)
    I = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]
    for ni in scene.get("nodes", []):
        walk(ni, I)
    return lo, hi


def obj_bbox(p):
    lo, hi = [1e9] * 3, [-1e9] * 3
    with open(p, encoding="utf-8", errors="replace") as f:
        for line in f:
            if line.startswith("v "):
                x, y, z = (float(t) for t in line.split()[1:4])
                b3 = (x, -z, y)
                for i in range(3):
                    lo[i], hi[i] = min(lo[i], b3[i]), max(hi[i], b3[i])
    return lo, hi


WORD_TAGS = [
    (r"car|truck|van|bus|taxi|police|ambulance|vehicle|firetruck|sedan|hatchback|suv|coupe", ["vehicle", "car"]),
    (r"tree|pine|palm|bush|hedge|plant|flower|grass|weed|leaf|cactus", ["nature", "plant"]),
    (r"rock|stone|crystal|cliff|boulder", ["nature", "rock"]),
    (r"building|house|shop|store|skyscraper|tower|wall|roof|door|window|awning|balcony|chimney|stairs", ["building"]),
    (r"bench|lamp|light|sign|hydrant|bin|trash|dumpster|mailbox|fence|barrier|cone|bollard|traffic|parking|post|pole|planter|fountain|statue", ["street", "prop"]),
    (r"apple|banana|bread|cake|pizza|burger|cheese|egg|fish|meat|carrot|tomato|soda|bottle|can|cup|mug|plate|bowl|pan|pot|knife|fork|spoon|donut|cookie|pie|sandwich|fries|sushi|taco|icecream|ice-cream|candy|chocolate|milk|juice|coffee|tea|wine|lemon|orange|pear|grape|melon|watermelon|strawberry|cherry|pumpkin|corn|mushroom|onion|potato|pepper|avocado|advocado|bacon|sausage|hotdog|waffle|pancake|muffin|cupcake", ["food"]),
    (r"grave|tomb|coffin|skull|bone|ghost|crypt|zombie|cross", ["spooky"]),
    (r"cart|barrel|crate|box|sack|chest|table|chair|stool|shelf|counter|fridge|oven|stove|sink|cabinet", ["furniture", "prop"]),
    (r"road|street|crossing|intersection|bridge|tile|curb|pavement|sidewalk", ["road"]),
    (r"character|person|male|female|human|zombie|skeleton|vampire|knight|guard", ["character"]),
]


def tags_of(name, base):
    t = set(base)
    for rx, tg in WORD_TAGS:
        if re.search(rx, name, re.I):
            t.update(tg)
    return sorted(t)


def main():
    out, stats = [], {}
    os.makedirs(os.path.join(HERE, "previews"), exist_ok=True)
    try:
        from PIL import Image
    except ImportError:
        Image = None
    seen_ids = set()
    for key, folder, lic, ev, globs, factor, base, use in PACKS:
        root = os.path.join(SRC, folder)
        files = []
        for g in globs:
            files += [f for f in glob.glob(os.path.join(root, g), recursive=True) if not SKIP.search(os.path.basename(f))]
        files = sorted(set(files))
        for f in files:
            name = os.path.splitext(os.path.basename(f))[0]
            if BRANDS.search(name):
                continue
            lo, hi = gltf_bbox(f) if f.lower().endswith((".glb", ".gltf")) else obj_bbox(f)
            if lo[0] > hi[0]:
                continue
            size = [round((hi[i] - lo[i]) * factor, 3) for i in range(3)]
            aid = "%s_%s" % (key, re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_"))
            if aid in seen_ids:
                continue
            seen_ids.add(aid)
            prev = None
            pv = os.path.join(root, "Previews", name + ".png")
            if Image and os.path.exists(pv):
                im = Image.open(pv).convert("RGBA")
                bg = Image.new("RGBA", im.size, (236, 240, 246, 255))
                bg.alpha_composite(im)
                bg.convert("RGB").resize((96, 96)).save(os.path.join(HERE, "previews", aid + ".jpg"), quality=72)
                prev = "previews/%s.jpg" % aid
            out.append({"id": aid, "name": name, "pack": key, "license": lic, "tags": tags_of(name, base), "size": size,
                        "file": os.path.relpath(f, SRC).replace("\\", "/"), "preview": prev})
            stats.setdefault(key, []).append((name, size))
    cat = {"version": 1, "units": "one character = 5.2 tall; origin = bottom centre; z up",
           "packs": [{"key": k, "folder": fo, "license": li, "evidence": ev, "factor": fa, "tags": ba, "use": us, "assets": len(stats.get(k, []))} for k, fo, li, ev, _, fa, ba, us in PACKS],
           "not_imported": NOT_IMPORTED, "excluded": EXCLUDED, "assets": out}
    with open(os.path.join(HERE, "catalog.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(cat, f, indent=0, separators=(",", ":"))
    print("catalog: %d assets, %d previews" % (len(out), sum(1 for a in out if a["preview"])))
    for k, v in stats.items():
        hs = sorted(s[2] for _, s in v)
        print("%-8s %4d  height median %.2f  max %.2f" % (k, len(v), hs[len(hs) // 2], hs[-1]))
        if STATS:
            for nm, s in v[:: max(1, len(v) // 12)]:
                print("     %-34s %s" % (nm, s))


main()
