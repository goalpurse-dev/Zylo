// Blocky Worlds builder: render the check still of one object blueprint or one world spec to a JPEG (Node side).
// One Chrome + one page for the whole prepare stage; stills are rendered one after another (the page reuses its
// modules; each still has its own renderer). Reuses render.mjs's page server and Chrome launch (CHROME_PATH /
// CHROME_ARGS on the GPU worker, SOFTWARE_GL=1 for SwiftShader).
//   const r = await makeStillRenderer({ outDir });  await r.render("object", blueprint) -> { file, jpeg, w, h, ms, problems }
//   await r.close()
//   node lib/builder/still.mjs <spec.json> <object|world> <out.jpg> [--light day|night|warm]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startServer, launchBrowser } from "../../render.mjs";

export async function makeStillRenderer({ outDir = null, size = 768 } = {}) {
  const dir = outDir ?? fs.mkdtempSync(path.join((await import("node:os")).tmpdir(), "bw-still-"));
  fs.mkdirSync(dir, { recursive: true });
  const srv = await startServer(dir), browser = await launchBrowser();
  let page = null, queue = Promise.resolve(), n = 0;
  const errors = [];
  async function open() {
    page = await browser.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 300)); });
    await page.goto(`http://127.0.0.1:${srv.port}/page/still.html`);
    await page.waitForFunction("window.stillReady === true || !!window.stillError", { timeout: 120000, polling: 100 });
    const err = await page.evaluate(() => window.stillError ?? null);
    if (err) throw new Error(`still page failed: ${err}`);
  }
  async function renderOne(kind, spec, { light = "day", name = null } = {}) {
    if (!page) await open();
    const t0 = Date.now();
    errors.length = 0;
    const r = await page.evaluate((req) => window.renderStill(req), { kind, spec, light, size });
    const jpeg = Buffer.from(r.data.slice(r.data.indexOf(",") + 1), "base64");
    const file = path.join(dir, `${name ?? `${kind}-${++n}`}.jpg`);
    fs.writeFileSync(file, jpeg);
    return { file, jpeg, w: r.w, h: r.h, ms: Date.now() - t0, pageMs: r.ms, problems: [...(r.problems ?? []), ...errors] };
  }
  return {
    dir,
    /** render(kind, spec, opts) -> { file, jpeg, w, h, ms, problems }; calls are queued (one page) */
    render(kind, spec, opts = {}) { const p = queue.then(() => renderOne(kind, spec, opts)); queue = p.catch(() => {}); return p; },
    async close() { await browser.close().catch(() => {}); srv.close(); },
  };
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const [specPath, kind, out] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const li = process.argv.indexOf("--light"), light = li > 0 ? process.argv[li + 1] : "day";
  if (!specPath || !kind || !out) { console.error("usage: node lib/builder/still.mjs <spec.json> <object|world> <out.jpg> [--light day|night|warm]"); process.exit(2); }
  const r = await makeStillRenderer({ outDir: path.dirname(path.resolve(out)) });
  try {
    const res = await r.render(kind, JSON.parse(fs.readFileSync(specPath, "utf8")), { light, name: path.basename(out, ".jpg") });
    console.log(`${res.file} ${res.w}x${res.h} in ${res.ms} ms${res.problems.length ? `; problems: ${res.problems.join("; ")}` : ""}`);
  } finally { await r.close(); }
}
