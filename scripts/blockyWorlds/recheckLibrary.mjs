// Blocky Worlds: re-apply the accept line to ideas the judge already scored (after the line changes). No call, free:
// each idea's stored scores are re-checked with library.js scoreVerdict. One live idea per rule (opener key): the best.
// Usage: node scripts/blockyWorlds/recheckLibrary.mjs --env-file .env.local [--batch <id>] [--apply]
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { ACCEPT, scoreVerdict } from "../../supabase/functions/_shared/blockyWorlds/library.js";

const args = process.argv.slice(2), opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : null; };
const E = Object.fromEntries(readFileSync(opt("env-file") ?? ".env.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Z_][A-Z0-9_]*=/.test(l)).map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }));
const admin = createClient(E.SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

let q = admin.from("blocky_worlds_library").select("id, opener_key, score, status, judge, source, batch_id").in("status", ["live", "rejected"]);
if (opt("batch")) q = q.eq("batch_id", opt("batch"));
const { data: rows, error } = await q;
if (error) throw new Error(error.message);
const decided = rows.map((r) => {
  const unsafe = /not safe/.test(r.judge?.reason ?? "");
  const v = scoreVerdict({ scores: r.judge?.scores ?? {}, safe: !unsafe });
  return { ...r, want: v.accepted ? "live" : "rejected", newReason: v.reason };
});
// one live idea per rule: the highest score wins
const best = new Map();
for (const r of decided.filter((x) => x.want === "live")) if (!best.has(r.opener_key) || best.get(r.opener_key).score < r.score) best.set(r.opener_key, r);
for (const r of decided) if (r.want === "live" && best.get(r.opener_key) !== r) { r.want = "rejected"; r.newReason = "a better version of this rule is live"; }
const changes = decided.filter((r) => r.want !== r.status);
console.log(`accept line ${ACCEPT.minScore}: ${decided.filter((r) => r.want === "live").length} live, ${decided.filter((r) => r.want === "rejected").length} rejected; ${changes.length} change(s)`);
for (const r of changes) console.log(`  [${r.score}] ${r.status} -> ${r.want}`);
if (args.includes("--apply")) {
  for (const r of changes.filter((x) => x.want === "rejected")) await admin.from("blocky_worlds_library").update({ status: "rejected", judge: { ...r.judge, accepted: false, reason: r.newReason }, updated_at: new Date().toISOString() }).eq("id", r.id);
  for (const r of changes.filter((x) => x.want === "live")) {
    const { error: e } = await admin.from("blocky_worlds_library").update({ status: "live", judge: { ...r.judge, accepted: true, reason: null }, updated_at: new Date().toISOString() }).eq("id", r.id);
    if (e) console.log(`  could not set live: ${e.message}`);
  }
  if (opt("batch")) {
    const { count: acc } = await admin.from("blocky_worlds_library").select("id", { count: "exact", head: true }).eq("batch_id", opt("batch")).eq("status", "live");
    const { count: rej } = await admin.from("blocky_worlds_library").select("id", { count: "exact", head: true }).eq("batch_id", opt("batch")).eq("status", "rejected");
    await admin.from("blocky_worlds_idea_batches").update({ accepted: acc, rejected: rej }).eq("id", opt("batch"));
    console.log(`batch now: ${acc} accepted, ${rej} rejected`);
  }
}
