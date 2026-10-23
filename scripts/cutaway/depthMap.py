# Depth Anything V2 small (ONNX, CPU) -> a 16-bit grey depth map per wide image (white = near).
import sys, numpy as np, onnxruntime as ort
from PIL import Image
model, out_dir, *images = sys.argv[1:]
sess = ort.InferenceSession(model, providers=["CPUExecutionProvider"])
name = sess.get_inputs()[0].name
mean = np.array([0.485, 0.456, 0.406], np.float32); std = np.array([0.229, 0.224, 0.225], np.float32)
for path in images:
    im = Image.open(path).convert("RGB")
    W, H = im.size
    x = np.asarray(im.resize((518, 924), Image.BICUBIC), np.float32) / 255.0
    x = ((x - mean) / std).transpose(2, 0, 1)[None]
    d = sess.run(None, {name: x})[0].squeeze().astype(np.float32)
    d = (d - d.min()) / (d.max() - d.min() + 1e-6)
    out = Image.fromarray((d * 65535).astype(np.uint16)).resize((W, H), Image.BICUBIC)
    stem = path.replace("\\", "/").split("/")[-1].rsplit(".", 1)[0]
    out.save(f"{out_dir}/depth-{stem}.png")
    Image.fromarray((d * 255).astype(np.uint8)).resize((W // 2, H // 2)).save(f"{out_dir}/depthview-{stem}.png")
    print(stem, d.shape, "ok")
