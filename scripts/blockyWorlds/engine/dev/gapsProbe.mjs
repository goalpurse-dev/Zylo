// GAPS agent: probe a timeline in the real engine page: render at t, then evaluate an expression with the scene.
//   node dev/gapsProbe.mjs <timeline.json> <t> "<js expression using scene, THREE>"
import path from "node:path";
import { startServer, launchBrowser, openPage, readTimeline } from "../render.mjs";

const [tlPath, t, expr] = process.argv.slice(2);
const tl = readTimeline(tlPath);
const srv = await startServer(path.dirname(path.resolve(tlPath))), browser = await launchBrowser();
try {
  const page = await openPage(browser, { port: srv.port, tlName: path.basename(tlPath), W: tl.width, H: tl.height });
  page.on("console", (m) => console.log("page:", m.text()));
  const r = await page.evaluate((t, expr) => { window.renderAt(Number(t)); const { scene, THREE } = window.engineDebug; return JSON.stringify((0, eval)(`(scene, THREE) => (${expr})`)(scene, THREE)); }, t, expr);
  console.log(r);
} finally { await browser.close().catch(() => {}); srv.close(); }
