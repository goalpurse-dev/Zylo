// Uploads the real Zyvo screen (since 2026-10-18 the tight Long Form picker crop, ui-idea-picker.png from
// importUiCrops.mjs --list) to the PRIVATE content-machine bucket as assets/zyvo-ui-picker.png (ZYVO_SHOT_PATH), where the renderer and the admin preview read it through short signed links.
// Writes one file to storage; nothing else.
//   node scripts/contentMachine/uploadZyvoShot.mjs <screen.png> [path to .env.local]
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(path.join(ROOT, "package.json"));
const [file, envFile = path.join(ROOT, ".env.local")] = process.argv.slice(2);
if (!file) { console.error("usage: uploadZyvoShot.mjs <screen.png> [.env.local]"); process.exit(2); }
require("dotenv").config({ path: envFile, quiet: true });
const url = process.env.VITE_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error(`VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed (read from ${envFile}).`); process.exit(2); }
const { createClient } = require("@supabase/supabase-js");
const db = createClient(url, key, { auth: { persistSession: false } });
const { error } = await db.storage.from("content-machine").upload("assets/zyvo-ui-picker.png", readFileSync(file), { contentType: "image/png", upsert: true });
if (error) { console.error(`upload failed: ${error.message}`); process.exit(1); }
console.log("uploaded content-machine/assets/zyvo-ui-picker.png");
