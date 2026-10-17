// The logo library: downloads each tool's official logo file (from the company's own brand/press page or
// its own site, found 2026-10-18) into the private bucket (logos/<domain>.<ext>) and fills in the source
// page. EVERY file lands as "pending approval": nothing is used until the owner approves it in admin.
//   node scripts/contentMachine/importLogos.mjs <logos.json> [path to .env.local]
// logos.json: [{name, domain, source_url, logo_url | zip_url + zip_member, notes}]
import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { checkLogoFile } from "../../supabase/functions/_shared/contentMachine/apiSlideshows.js";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(path.join(ROOT, "package.json"));
const [listFile, envFile = path.join(ROOT, ".env.local")] = process.argv.slice(2);
if (!listFile) { console.error("usage: importLogos.mjs <logos.json> [.env.local]"); process.exit(2); }
require("dotenv").config({ path: envFile, quiet: true });
const { createClient } = require("@supabase/supabase-js");
const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36" };
const EXT = { "image/png": "png", "image/svg+xml": "svg", "image/webp": "webp", "image/jpeg": "jpg" };

function sniff(bytes) {
  const head = String.fromCharCode(...bytes.slice(0, 12));
  if (bytes[0] === 0x89 && head.slice(1, 4) === "PNG") return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (head.startsWith("RIFF") && head.slice(8, 12) === "WEBP") return "image/webp";
  if (/<svg[\s>]/i.test(new TextDecoder().decode(bytes.slice(0, 4000)))) return "image/svg+xml";
  return null;
}

async function fetchBytes(url) {
  const res = await fetch(url, { headers: UA, redirect: "follow", signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

const list = JSON.parse(readFileSync(listFile, "utf8"));
const { data: rows } = await db.from("cm_logos").select("*");
for (const t of list) {
  const row = rows.find((r) => r.name.toLowerCase() === t.name.toLowerCase());
  if (!row) { console.log(`skip ${t.name}: not in the library`); continue; }
  const patch = { domain: t.domain, source_url: t.source_url, notes: t.notes ?? null, approved: false, approved_at: null, approved_by: null, updated_at: new Date().toISOString() };
  try {
    let bytes = null;
    if (t.logo_url) bytes = await fetchBytes(t.logo_url);
    else if (t.zip_url) {
      const dir = mkdtempSync(path.join(tmpdir(), "cm-logo-"));
      writeFileSync(path.join(dir, "kit.zip"), await fetchBytes(t.zip_url));
      execFileSync("unzip", ["-o", "-q", "kit.zip"], { cwd: dir });
      const found = execFileSync("find", [".", "-name", t.zip_member], { cwd: dir }).toString().split("\n").filter(Boolean)[0];
      if (!found) throw new Error(`${t.zip_member} is not in the zip`);
      bytes = new Uint8Array(readFileSync(path.join(dir, found)));
    }
    if (bytes) {
      const type = sniff(bytes);
      if (!type) throw new Error("not an image file");
      checkLogoFile(bytes, type);
      const dest = `logos/${t.domain}.${EXT[type]}`;
      const up = await db.storage.from("content-machine").upload(dest, bytes, { contentType: type, upsert: true });
      if (up.error) throw new Error(up.error.message);
      Object.assign(patch, { logo_path: dest, content_type: type });
    }
    const { error } = await db.from("cm_logos").update(patch).eq("id", row.id);
    if (error) throw new Error(error.message);
    console.log(`${bytes ? "queued " : "source "} ${t.name.padEnd(11)} ${bytes ? `${patch.content_type} ${bytes.length} B` : "(no file)"} · ${t.source_url}`);
  } catch (e) {
    await db.from("cm_logos").update({ source_url: t.source_url, notes: `${t.notes ?? ""} (download failed: ${e.message})`.trim(), updated_at: new Date().toISOString() }).eq("id", row.id);
    console.log(`FAILED  ${t.name}: ${e.message}`);
  }
}
await db.from("cm_audit_log").insert({ actor_email: "upwardlift6@gmail.com", action: "logo.import", payload: { via: "setup by Claude on the owner's instruction (2026-10-18)", count: list.length, approved: 0 } });
console.log("All logos are pending approval; none is used until approved in admin.");
