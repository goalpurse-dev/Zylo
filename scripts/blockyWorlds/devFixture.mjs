// Blocky Worlds: copy the judged library's live ideas into the local test mode (src/.../dev/libraryFixture.json), so
// localhost shows real, varied ideas instead of the mock's word-list filler. A database read: free, no AI call.
// The file is only imported by dev/devApi.js, which a production build never contains.
// Usage: node scripts/blockyWorlds/devFixture.mjs --env-file .env.local
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2), opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : null; };
const E = Object.fromEntries(readFileSync(opt("env-file") ?? ".env.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Z_][A-Z0-9_]*=/.test(l)).map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }));
const admin = createClient(E.SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data, error } = await admin.from("blocky_worlds_library").select("id, score, idea").eq("status", "live").order("score", { ascending: false });
if (error) throw new Error(error.message);
const out = data.map((r) => ({ id: r.id, score: r.score, idea: r.idea }));
writeFileSync(new URL("../../src/components/viral-tools/blocky-worlds/dev/libraryFixture.json", import.meta.url), JSON.stringify(out, null, 1) + "\n");
console.log(`${out.length} live ideas written`);
