// Phase 5a — upload the rendered MP4 + proxy to private storage and print 7-day signed URLs.
import { admin, root, PROJECT_ID } from "./lib/v2Runner.ts";
const BUCKET = "script-cassettes", PREFIX = `long-form/phase5a/${PROJECT_ID}`;
const out: Record<string, string> = {};
for (const f of ["myth-vs-reality-v2.mp4", "myth-vs-reality-v2-proxy-640x360.mp4", "myth-vs-reality.edl.json"]) {
  const bytes = await Deno.readFile(new URL(`docs/phase5/${f}`, root));
  const type = f.endsWith(".mp4") ? "video/mp4" : "application/json";
  const up = await admin.storage.from(BUCKET).upload(`${PREFIX}/${f}`, bytes, { contentType: type, upsert: true });
  if (up.error) { out[f] = `UPLOAD FAILED (${(bytes.length / 1e6).toFixed(1)} MB): ${up.error.message}`; continue; }
  const s = await admin.storage.from(BUCKET).createSignedUrl(`${PREFIX}/${f}`, 7 * 24 * 3600);
  out[f] = s.error ? `SIGN FAILED: ${s.error.message}` : s.data!.signedUrl;
}
await Deno.writeTextFile(new URL("docs/phase5/links.json", root), JSON.stringify({ createdAt: new Date().toISOString(), expiresInDays: 7, ...out }, null, 1));
console.log(JSON.stringify(out, null, 1));
