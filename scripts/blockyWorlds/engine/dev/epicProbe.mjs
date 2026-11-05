// EPIC agent dev probe: renders frames of a timeline into a float target and lists non-finite (NaN / Inf) or
// over-range pixels with the object under them (a NaN pixel turns into a black rectangle after the bloom).
//   node dev/epicProbe.mjs <timeline.json> t1,t2,...
import path from "node:path";
import { startServer, launchBrowser, openPage } from "../render.mjs";

const [tlPath, times] = process.argv.slice(2);
const srv = await startServer(path.dirname(path.resolve(tlPath))), browser = await launchBrowser();
try {
  const page = await openPage(browser, { port: srv.port, tlName: path.basename(tlPath) });
  for (const t of times.split(",").map(Number)) {
    const r = await page.evaluate((t) => {
      window.renderAt(t);
      const { THREE, scene, camera, renderer } = window.engineDebug;
      const W = 1080, H = 1920, rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.FloatType });
      const old = renderer.getRenderTarget(); renderer.setRenderTarget(rt); renderer.render(scene, camera); renderer.setRenderTarget(old);
      const px = new Float32Array(W * H * 4); renderer.readRenderTargetPixels(rt, 0, 0, W, H, px);
      const bad = [];
      let max = 0;
      for (let i = 0; i < W * H; i++) { const v = [px[i * 4], px[i * 4 + 1], px[i * 4 + 2]]; const m = Math.max(...v); if (m > max) max = m; if (v.some((x) => !Number.isFinite(x) || x < -1e-4) || m > 60000) bad.push(i); }
      const hits = [];
      const rc = new THREE.Raycaster();
      for (const i of bad.slice(0, 6)) {
        const x = i % W, y = Math.floor(i / W);
        rc.setFromCamera(new THREE.Vector2((x + 0.5) / W * 2 - 1, (y + 0.5) / H * 2 - 1), camera);
        const vis = (o) => { for (let n = o; n; n = n.parent) if (!n.visible) return false; return true; }; const h = rc.intersectObjects(scene.children, true).find((o) => vis(o.object));
        let n = h?.object, chain = [];
        while (n && chain.length < 5) { chain.push(n.name || n.type); n = n.parent; }
        hits.push({ x, y, inst: h?.instanceId, pt: h?.point?.toArray().map((v) => v.toFixed(2)).join(","), value: [...px.slice(i * 4, i * 4 + 3)].map(String), object: chain.join(" < "), material: h?.object?.material?.type, col: h?.object?.material?.color?.getHexString?.(), map: !!h?.object?.material?.map, verts: h?.object?.geometry?.attributes?.position?.count, nanNormals: (() => { const a = h?.object?.geometry?.attributes?.normal; if (!a) return -1; let c = 0; for (let k = 0; k < a.count; k++) { const l = Math.hypot(a.getX(k), a.getY(k), a.getZ(k)); if (!(l > 0.01)) c++; } return c; })(), face: h?.face?.normal?.toArray?.().map((v) => v.toFixed(2)).join(","), dist: h?.distance?.toFixed(2) });
      }
      rt.dispose();
      return { bad: bad.length, max, hits };
    }, t);
    console.log(`t=${t}: ${r.bad} bad pixels, max ${r.max.toFixed(1)}`, JSON.stringify(r.hits, null, 1));
  }
} finally { await browser.close(); srv.close(); }
