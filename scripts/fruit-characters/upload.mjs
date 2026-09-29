// Uploads the approved character references to Supabase Storage and writes
// data/fruit-characters/library.json (the seed source for fruit_characters).
//   node scripts/fruit-characters/upload.mjs [--dry]
//
// Path: public-assets/fruit-characters/<collection>/<id>-a<attempt>.jpg
// The attempt number makes every URL immutable (a new image gets a new path),
// so objects are cached for a year and never overwritten (x-upsert: false).
// Prompt and seed come from the ledger row of the approved attempt: what was
// sent, not what the template would build today.
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
createRequire(path.join(ROOT, "package.json"))("dotenv").config({ path: path.join(ROOT, ".env.local"), quiet: true });
const DRY = process.argv.includes("--dry");
const BUCKET = "public-assets";
const REFS = path.join(ROOT, "data/fruit-characters/refs");
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: KEY } = process.env;

const lib = JSON.parse(fs.readFileSync(path.join(ROOT, "data/fruit-characters/characters.json"), "utf8"));
const ledger = JSON.parse(fs.readFileSync(path.join(REFS, "ledger.json"), "utf8"));

const out = [];
for (const [i, c] of lib.characters.entries()) {
  const row = ledger.filter((r) => r.ok && r.id === c.id).at(-1);
  if (!row) throw new Error(`no approved image for ${c.id}`);
  const objectPath = `fruit-characters/${c.collection}/${c.id}-a${row.attempt}.jpg`;
  if (!DRY) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${objectPath}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, apikey: KEY, "Content-Type": "image/jpeg", "Cache-Control": "max-age=31536000, immutable", "x-upsert": "false" },
      body: fs.readFileSync(path.join(REFS, `${c.id}.jpg`)),
    });
    // 409 = already uploaded by an earlier run (same immutable path): fine.
    if (!res.ok && res.status !== 409 && !(res.status === 400 && /exists/i.test(await res.clone().text()))) {
      throw new Error(`${c.id}: upload failed ${res.status} ${await res.text()}`);
    }
  }
  out.push({
    id: c.id, name: c.name, collection: c.collection, fruit: c.fruit, emoji: c.emoji, hue: c.hue,
    gender: c.gender, age: c.age, ageText: c.ageText, tag: c.tag, role: c.role,
    storyTypes: c.storyTypes, settings: c.settings ?? [], voiceStyle: c.voiceStyle,
    face: c.face, build: c.build, outfit: c.outfit,
    refImagePath: `${BUCKET}/${objectPath}`,
    refImageUrl: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${objectPath}`,
    refModel: row.model, refSeed: row.seed, refPrompt: row.prompt, refCostUsd: row.cost,
    refWidth: row.width, refHeight: row.height, sortOrder: i + 1,
  });
  process.stdout.write(".");
}
fs.writeFileSync(path.join(ROOT, "data/fruit-characters/library.json"), JSON.stringify(out, null, 1));
console.log(`\n${out.length} characters${DRY ? " (dry run, nothing uploaded)" : " uploaded"}`);
