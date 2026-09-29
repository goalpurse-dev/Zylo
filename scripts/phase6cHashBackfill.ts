// deno-lint-ignore-file no-explicit-any
// Phase 6c-polish ($0): store each current scene image's difference hash
// (qa.dhash) for projects drawn before the worker computed it, then report
// the true near-duplicates. Uses a 256 px transform thumbnail.
//   npx -y deno@2.9.6 run -A --no-check scripts/phase6cHashBackfill.ts <projectId> [...]
import { createClient } from "npm:@supabase/supabase-js@2";
import { imageDHash, duplicateScenes, hashDistance } from "../supabase/functions/_shared/stickman/imageChecks.ts";

const env: Record<string, string> = {};
for (const line of (await Deno.readTextFile(".env.local")).split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/); if (m) env[m[1]] = m[2]; }
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const thumb = (url: string) => url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/") + "?width=256&quality=80";

for (const projectId of Deno.args) {
  const { data: rows } = await admin.from("long_form_scene_images").select("id, beat_sequence, image_url, qa").eq("project_id", projectId).eq("is_current", true).eq("status", "ready");
  const list = rows ?? [];
  let done = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (list.length) {
      const r: any = list.shift();
      if (r.qa?.dhash) { done++; continue; }
      const res = await fetch(thumb(r.image_url));
      if (!res.ok) { console.log("fetch failed", r.beat_sequence, res.status); continue; }
      const hash = await imageDHash(new Uint8Array(await res.arrayBuffer()));
      await admin.from("long_form_scene_images").update({ qa: { ...(r.qa ?? {}), dhash: hash } }).eq("id", r.id);
      done++;
    }
  }));
  const { data: hashed } = await admin.from("long_form_scene_images").select("beat_sequence, qa").eq("project_id", projectId).eq("is_current", true);
  const hs = (hashed ?? []).map((h: any) => ({ n: h.beat_sequence, hash: h.qa?.dhash }));
  const dups = duplicateScenes(hs);
  const pairs = [...dups].map((n) => { const me = hs.find((h) => h.n === n)!; const other = hs.filter((h) => h.n < n && h.hash).sort((a, b) => hashDistance(a.hash!, me.hash!) - hashDistance(b.hash!, me.hash!))[0]; return `${n}~${other?.n}(${hashDistance(other!.hash!, me.hash!)})`; });
  const near = [4, 5, 6, 8].map((b) => `${b}bits:${duplicateScenes(hs, b).size}`);
  console.log(JSON.stringify({ projectId, hashed: done, duplicates: dups.size, pairs, atOtherThresholds: near }));
}
