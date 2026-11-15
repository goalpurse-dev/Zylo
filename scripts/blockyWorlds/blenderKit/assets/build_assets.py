"""Blocky Worlds asset library: the IMAGE-BUILD converter (runs once inside `docker build`, in Blender, as our own
trusted script; never in a render job). Imports every catalog asset (glTF / GLB / OBJ only: no foreign .blend, no
scripts), scales it to our units with its pack's factor, puts it in its own collection "za_<id>" whose instance offset
is the asset's bottom centre, gives every material the PASTEL pass (a little more saturation and brightness), merges
duplicate textures, packs them, and saves ONE library file. Shot code links collections from it (worlds.py zw_asset).
    blender -b --factory-startup --python build_assets.py -- <src dir> <catalog.json> <out .blend>"""
import json
import os
import sys

import bpy
from mathutils import Matrix, Vector

src, cat_file, out = sys.argv[sys.argv.index("--") + 1:][:3]
cat = json.load(open(cat_file, encoding="utf-8"))
factor = {p["key"]: p["factor"] for p in cat["packs"]}
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
ok, failed = 0, []


def pastel(mat):
    """saturation x1.12, value x1.06 between the base colour's source and the BSDF (textures and flat colours alike)"""
    if not mat or not mat.use_nodes or mat.get("zw_pastel"):
        return
    nt = mat.node_tree
    for b in [n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"]:
        inp = b.inputs["Base Color"]
        hs = nt.nodes.new("ShaderNodeHueSaturation")
        hs.inputs["Saturation"].default_value = 1.12
        hs.inputs["Value"].default_value = 1.06
        if inp.is_linked:
            nt.links.new(inp.links[0].from_socket, hs.inputs["Color"])
        else:
            hs.inputs["Color"].default_value = inp.default_value[:]
        nt.links.new(hs.outputs["Color"], inp)
    mat["zw_pastel"] = 1


for a in cat["assets"]:
    f = os.path.join(src, a["file"])
    before = set(bpy.data.objects)
    try:
        if f.lower().endswith((".glb", ".gltf")):
            bpy.ops.import_scene.gltf(filepath=f)
        elif f.lower().endswith(".obj"):
            bpy.ops.wm.obj_import(filepath=f)
        else:
            raise ValueError("format")
    except Exception as e:  # noqa: BLE001 (a broken file is listed, never fatal)
        failed.append((a["id"], str(e)[:120]))
        continue
    new = [o for o in bpy.data.objects if o not in before]
    if not new:
        failed.append((a["id"], "no objects"))
        continue
    s = factor[a["pack"]]
    S = Matrix.Scale(s, 4)
    for o in new:
        if o.parent is None:
            o.matrix_world = S @ o.matrix_world
    bpy.context.view_layer.update()
    lo, hi = Vector((1e9,) * 3), Vector((-1e9,) * 3)
    for o in new:
        if o.type != "MESH":
            continue
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            lo = Vector([min(p, q) for p, q in zip(lo, w)])
            hi = Vector([max(p, q) for p, q in zip(hi, w)])
    coll = bpy.data.collections.new("za_" + a["id"])
    coll.instance_offset = ((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z) if lo.x < 1e8 else (0, 0, 0)
    coll["zw_size"] = [round(v, 3) for v in (hi - lo)] if lo.x < 1e8 else [0, 0, 0]
    coll["zw_license"] = a["license"]
    for o in new:
        for c in list(o.users_collection):
            c.objects.unlink(o)
        coll.objects.link(o)
        for slot in getattr(o, "material_slots", []):
            pastel(slot.material)
    coll.use_fake_user = True
    ok += 1

# one copy of every texture (Kenney ships one colour map per pack; each import loaded its own)
first = {}
for im in list(bpy.data.images):
    key = os.path.normcase(bpy.path.abspath(im.filepath)) if im.filepath else None
    if not key:
        continue
    if key in first:
        im.user_remap(first[key])
        bpy.data.images.remove(im)
    else:
        first[key] = im
bpy.ops.file.pack_all()
for t in list(bpy.data.texts):
    bpy.data.texts.remove(t)
os.makedirs(os.path.dirname(out), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=out, compress=True)
print("ZYVO ASSETS: %d imported, %d failed -> %s (%.1f MB)" % (ok, len(failed), out, os.path.getsize(out) / 1e6))
for fid, why in failed[:40]:
    print("  failed", fid, why)
if ok < 0.9 * len(cat["assets"]):
    sys.exit(1)
