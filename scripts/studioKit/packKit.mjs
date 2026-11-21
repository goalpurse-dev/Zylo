// Builds the free Zyvo Studio Kit's download: kits/zyvo-roblox-story -> dist-kit/zyvo-roblox-story-<version>.zip, the
// folder "zyvo-roblox-story/" at its root (unzipped into ~/.claude/skills it is the skill, started with /zyvo-roblox-story;
// renamed from roblox-story in 1.4.0, another creator's skill has that folder name). Free and local: no upload.
// Phase 3 uploads the zip to the private zyvo-studio bucket at KIT.path (supabase/functions/_shared/zyvoMcp/config.js),
// which POST /account/kit signs for signed-in users.
//   node scripts/studioKit/packKit.mjs            build it, print the file list and size
// Our internal test notes (TEST_*.md) and caches never go in.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { KIT } from "../../supabase/functions/_shared/zyvoMcp/config.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = path.join(ROOT, "kits", KIT.skill);
const OUT = path.join(ROOT, "dist-kit", path.basename(KIT.path));
const SKIP = [/^TEST_.*\.md$/i, /^\./, /__pycache__/, /\.pyc$/, /^node_modules$/, /\.log$/];

function walk(dir, rel = "") {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (SKIP.some((r) => r.test(e.name))) continue;
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walk(path.join(dir, e.name), r));
    else if (e.isFile()) out.push(r);
  }
  return out;
}

/** a plain zip (deflate, UTF-8 names); shell scripts keep their executable bit */
export function zip(entries) {
  const locals = [], centrals = [];
  let offset = 0;
  const dos = (d) => ({ time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() });
  const { time, date } = dos(new Date());
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, "utf8"), body = zlib.deflateRawSync(data, { level: 9 }), crc = zlib.crc32(data) >>> 0;
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(0x0800, 6); head.writeUInt16LE(8, 8);
    head.writeUInt16LE(time, 10); head.writeUInt16LE(date, 12); head.writeUInt32LE(crc, 14); head.writeUInt32LE(body.length, 18);
    head.writeUInt32LE(data.length, 22); head.writeUInt16LE(nameBuf.length, 26); head.writeUInt16LE(0, 28);
    locals.push(head, nameBuf, body);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE((3 << 8) | 20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8); cen.writeUInt16LE(8, 10);
    cen.writeUInt16LE(time, 12); cen.writeUInt16LE(date, 14); cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(body.length, 20); cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(nameBuf.length, 28); cen.writeUInt32LE(((/\.sh$/.test(name) ? 0o100755 : 0o100644) << 16) >>> 0, 38); cen.writeUInt32LE(offset, 42);
    centrals.push(cen, nameBuf);
    offset += head.length + nameBuf.length + body.length;
  }
  const cdir = Buffer.concat(centrals), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cdir.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cdir, end]);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = walk(SRC);
  // shell scripts with Unix line ends (Git Bash and macOS both run them)
  const entries = files.map((f) => {
    let data = fs.readFileSync(path.join(SRC, f));
    if (/\.sh$/.test(f)) data = Buffer.from(data.toString("utf8").replace(/\r\n/g, "\n"), "utf8");
    return { name: `${KIT.skill}/${f}`, data };
  });
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const buf = zip(entries);
  fs.writeFileSync(OUT, buf);
  for (const e of entries) console.log(`  ${e.name} (${e.data.length} B)`);
  console.log(`${entries.length} files -> ${path.relative(ROOT, OUT)} (${(buf.length / 1024).toFixed(1)} KB), version ${KIT.version}`);
}
