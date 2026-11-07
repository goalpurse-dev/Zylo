// WORLD-LOOK dev probe: the camera vs the town walkway at time t.  node dev/worldlookCam.mjs <timeline.json> <t>
import path from "node:path";
import { startServer, launchBrowser, openPage } from "../render.mjs";
const tlPath = path.resolve(process.argv[2]), t = Number(process.argv[3]);
const srv = await startServer(path.dirname(tlPath)), browser = await launchBrowser();
try {
  const page = await openPage(browser, { port: srv.port, tlName: path.basename(tlPath), W: 432, H: 768 });
  console.log(await page.evaluate((t) => {
    window.renderAt(t); const { scene, camera, THREE } = window.engineDebug; let bt = null;
    scene.traverse((o) => { if (o.name === "backTown:castle" && o.visible !== false) bt = o; });
    const w = bt?.userData.walkway ?? []; bt?.updateMatrixWorld(true);
    const pts = w.filter((_, i) => i % Math.ceil(w.length / 6) === 0).map((p) => bt.localToWorld(new THREE.Vector3(p.x, p.y, p.z)).toArray().map((v) => v.toFixed(1)).join(","));
    return JSON.stringify({ cam: camera.position.toArray().map((v) => v.toFixed(1)), aim: camera.userData.epicAim?.toArray().map((v) => v.toFixed(1)), n: w.length, pts });
  }, t));
} finally { await browser.close(); srv.close(); }
