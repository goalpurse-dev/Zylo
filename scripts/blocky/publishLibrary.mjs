// Puts the approved avatar library live (owner, 2026-10-08: "put all 52 avatars live in the library table as
// they are now (no redos). Replace the 3 old temporary ones."). For every avatar of the roster: the picture
// the library run picked (data/blocky-tests/library/results.json) is stored under generated/blocky/library/
// and its row in blocky_characters is written (same ids; temporary = false). Free: no model is called.
//   node scripts/blocky/publishLibrary.mjs            prints what would be written
//   node scripts/blocky/publishLibrary.mjs --write    writes the pictures and the rows
import fs from "fs";
import path from "path";
import { ROOT, SUPABASE_URL, admin } from "./lib.mjs";
import { ROSTER, avatarPrompt } from "./roster.mjs";

const dir = path.join(ROOT, "data/blocky-tests/library");
const r = JSON.parse(fs.readFileSync(path.join(dir, "results.json"), "utf8"));
const db = admin();
const fail = (m) => { console.error(m); process.exit(1); };
const write = process.argv.includes("--write");

const rows = ROSTER.map((a, i) => {
  const picked = r.avatars[a.id]?.picked;
  const item = picked ? r.items[picked] : null;
  if (!item?.file || !fs.existsSync(path.join(dir, item.file))) fail(`${a.id}: no picked picture`);
  const storagePath = `blocky/library/${a.id}.jpg`;
  return {
    file: path.join(dir, item.file), storagePath,
    row: {
      id: a.id, name: a.name, tag: a.tag, role: a.role, role_tags: a.tags, voice_style: a.voice, face: a.face, look: a.look, hue: 0,
      ref_image_url: `${SUPABASE_URL}/storage/v1/object/public/generated/${storagePath}`, ref_image_path: storagePath,
      ref_width: 768, ref_height: 1376, ref_model: item.model,
      // The first eight's first-wording pictures were replaced; one avatar kept its first-wording Pro picture.
      ref_prompt: avatarPrompt(a, { wording: /-(b|t)-/.test(picked) ? "b" : "a" }), ref_cost_usd: item.cost ?? null,
      active: true, temporary: false, sort_order: i,
    },
  };
});
if (!write) {
  console.log(`${rows.length} avatars would be written (${rows.filter((x) => x.row.ref_model === "google:4@2").length} on Nano Banana Pro, the rest on Nano Banana 2 Lite). Add --write.`);
  process.exit(0);
}
for (const x of rows) {
  const up = await db.storage.from("generated").upload(x.storagePath, fs.readFileSync(x.file), { contentType: "image/jpeg", upsert: true, cacheControl: "3600" });
  if (up.error) fail(`Couldn't store ${x.row.id}'s picture: ${up.error.message}`);
  const res = await db.from("blocky_characters").upsert(x.row, { onConflict: "id" });
  if (res.error) fail(`Couldn't write ${x.row.id}: ${res.error.message}`);
}
// An avatar that is no longer in the roster is switched off, never deleted (a story may use it).
const { data: all } = await db.from("blocky_characters").select("id, temporary, active").order("sort_order");
const gone = all.filter((c) => c.active && !ROSTER.some((a) => a.id === c.id)).map((c) => c.id);
if (gone.length) await db.from("blocky_characters").update({ active: false }).in("id", gone);
console.log(`Written: ${rows.length}. In the table now: ${all.length} rows, ${all.filter((c) => c.temporary).length} temporary, ${all.filter((c) => c.active).length - gone.length} active.${gone.length ? ` Switched off: ${gone.join(", ")}.` : ""}`);
