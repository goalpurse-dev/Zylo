// WORLD-LOOK dev probe: what got built on each creature (back towns: houses, landmarks, towers, walkway; the giant's kind)
//   node dev/worldlookProbe.mjs <timeline.json>
import path from "node:path";
import { startServer, launchBrowser, openPage } from "../render.mjs";

const tlPath = path.resolve(process.argv[2]);
const srv = await startServer(path.dirname(tlPath)), browser = await launchBrowser();
try {
  const page = await openPage(browser, { port: srv.port, tlName: path.basename(tlPath), W: 432, H: 768 });
  const r = await page.evaluate(() => {
    const out = [];
    window.engineDebug.scene.traverse((o) => {
      if (o.name?.startsWith?.("backTown:")) {
        const p = o.userData.plan, g = o.parent?.parent?.parent;
        let host = o; while (host.parent && !/^giant:/.test(host.name)) host = host.parent;
        out.push({ town: o.name, host: host.name, plan: host.userData?.plan, houses: p.houses.length, landmarks: p.landmarks.map((l) => l.name), towers: p.towers.length, wall: !!p.wall, walkway: o.userData.walkway?.length ?? 0, region: Object.fromEntries(Object.entries(p.region ?? {}).map(([k, v]) => [k, Math.round(v)])) });
        void g;
      }
    });
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
} finally { await browser.close(); srv.close(); }
