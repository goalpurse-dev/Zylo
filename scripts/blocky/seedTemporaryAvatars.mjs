// Temporary avatars: Noob, Vex and Lux from the Nano Banana Pro test pictures
// (test 2), so a first story can be made before the real 24-avatar library
// exists. Free: the pictures are already paid for and on this computer.
//
// Every row is marked temporary = true and its picture is stored under
// generated/blocky/library/temporary/, so they are easy to find:
//   SELECT id, name FROM blocky_characters WHERE temporary;
// The real library replaces them in place (same ids, temporary = false). A row
// a story already uses can't be deleted, only replaced or switched off (active = false).
//
//   node scripts/blocky/seedTemporaryAvatars.mjs            writes the three rows
//   node scripts/blocky/seedTemporaryAvatars.mjs --remove   switches them off (active = false)
import fs from "fs";
import path from "path";
import { ROOT, SUPABASE_URL, admin } from "./lib.mjs";
import { ROSTER, avatarPrompt } from "./roster.mjs";

const IDS = ["noob", "vex", "lux"];
const db = admin();
const fail = (m) => { console.error(m); process.exit(1); };

if (process.argv.includes("--remove")) {
  const { data, error } = await db.from("blocky_characters").update({ active: false }).eq("temporary", true).select("id");
  if (error) fail(error.message);
  console.log(`Switched off ${data.length} temporary avatars: ${data.map((r) => r.id).join(", ")}`);
  process.exit(0);
}

const results = JSON.parse(fs.readFileSync(path.join(ROOT, "data/blocky-tests/test2/results.json"), "utf8")).items;
for (const [i, id] of IDS.entries()) {
  const a = ROSTER.find((x) => x.id === id);
  const shot = results[`pro-${id}`];
  const file = path.join(ROOT, "data/blocky-tests/test2", `pro-${id}.jpg`);
  if (!a || shot?.state !== "success" || !fs.existsSync(file)) fail(`No Pro test picture for ${id}.`);
  const existing = (await db.from("blocky_characters").select("temporary").eq("id", id).maybeSingle()).data;
  if (existing && !existing.temporary) fail(`${id} is already a real library avatar: not overwritten.`);
  const storagePath = `blocky/library/temporary/${id}.jpg`;
  const up = await db.storage.from("generated").upload(storagePath, fs.readFileSync(file), { contentType: "image/jpeg", upsert: true, cacheControl: "3600" });
  if (up.error) fail(`Couldn't store ${id}'s picture: ${up.error.message}`);
  const row = await db.from("blocky_characters").upsert({
    id, name: a.name, tag: a.tag, role: a.role, role_tags: a.tags, voice_style: a.voice, face: a.face, look: a.look, hue: 0,
    ref_image_url: `${SUPABASE_URL}/storage/v1/object/public/generated/${storagePath}`, ref_image_path: storagePath,
    ref_width: 768, ref_height: 1376, ref_model: shot.model, ref_prompt: shot.prompt ?? avatarPrompt(a), ref_cost_usd: shot.cost ?? null,
    active: true, temporary: true, sort_order: i,
  }, { onConflict: "id" });
  if (row.error) fail(`Couldn't write ${id}: ${row.error.message}`);
  console.log(`${a.name}: temporary avatar written (${storagePath})`);
}
const { data } = await db.from("blocky_characters").select("id, name, temporary, active").order("sort_order");
console.log(JSON.stringify(data));
