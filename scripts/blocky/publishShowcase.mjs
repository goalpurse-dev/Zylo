// Puts the showcase videos (and their poster pictures) into Blocky's own storage folder, where the page
// reads them (src/components/viral-tools/blocky-stories/constants.js#SHOWCASE). $0: an upload, no provider.
// The folder holds <id>.mp4 and <id>.jpg for every showcase id, already cut and encoded small
// (540x960, one caption track; never a clip that carries the video model's own subtitles).
//   node scripts/blocky/publishShowcase.mjs <folder>
import fs from "fs";
import path from "path";
import { SUPABASE_URL, admin } from "./lib.mjs";

const IDS = ["no-hats-allowed", "the-fake-admin"];   // the same ids as SHOWCASE
const [dir] = process.argv.slice(2);
if (!dir) { console.error("Usage: node scripts/blocky/publishShowcase.mjs <folder>"); process.exit(1); }
const files = IDS.flatMap((id) => [[`${id}.mp4`, "video/mp4"], [`${id}.jpg`, "image/jpeg"]]);
const missing = files.filter(([name]) => !fs.existsSync(path.join(dir, name)));
if (missing.length) { console.error(`Missing in ${dir}: ${missing.map(([n]) => n).join(", ")}`); process.exit(1); }

const db = admin();
for (const [name, contentType] of files) {
  const body = fs.readFileSync(path.join(dir, name));
  const storagePath = `blocky/showcase/${name}`;
  const up = await db.storage.from("generated").upload(storagePath, body, { contentType, upsert: true, cacheControl: "86400" });
  if (up.error) { console.error(`${name}: ${up.error.message}`); process.exit(1); }
  const url = `${SUPABASE_URL}/storage/v1/object/public/generated/${storagePath}`;
  const head = await fetch(url, { method: "HEAD" });
  console.log(`${head.ok ? "ok  " : "FAIL"} ${name}  ${(body.length / 1e6).toFixed(2)} MB  ${url}`);
  if (!head.ok) process.exit(1);
}
