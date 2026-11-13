# Blender kit engine: which GPU does Blender's EEVEE really draw on? Runs inside Blender (after boot.py):
#   blender -b --factory-startup [--gpu-backend vulkan] -P boot.py -P gpucheck.py -- <out.png>
# Renders the factory scene with the kit's EEVEE settings (ray tracing on) at 270x480, then prints one line
#   GPUCHECK {"vendor": ..., "renderer": ..., "backend": ..., "renderS": ...}
# The worker refuses a software renderer (llvmpipe / lavapipe / swiftshader) as NO_GPU.
import json
import sys
import time

import bpy

out = sys.argv[sys.argv.index("--") + 1]
sc = bpy.context.scene
sc.render.engine = "BLENDER_EEVEE"
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = 270, 480, 100
sc.eevee.taa_render_samples = 8
sc.eevee.use_raytracing = True
sc.render.filepath = out
t = time.time()
bpy.ops.render.render(write_still=True)
info = {"renderS": round(time.time() - t, 2), "blender": bpy.app.version_string}
try:
    import gpu
    for k in ("vendor", "renderer", "version", "backend_type", "device_type"):
        try:
            info[k] = str(getattr(gpu.platform, k + "_get")())
        except Exception as e:  # noqa: BLE001
            info[k] = "error: " + str(e)[:120]
except Exception as e:  # noqa: BLE001
    info["gpu_module"] = "error: " + str(e)[:120]
print("GPUCHECK " + json.dumps(info), flush=True)
