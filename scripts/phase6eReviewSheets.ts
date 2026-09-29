// deno-lint-ignore-file no-explicit-any
// Phase 6e ($0, read-only): download every current scene of a project as a
// 480x270 thumbnail and build numbered review sheets (4 x 3 per sheet) plus a
// JSON of each scene's narration / concept / text — for the by-eye review and
// the contact sheet.
//   npx -y deno@2.9.6 run -A --no-check scripts/phase6eReviewSheets.ts <projectId> <outDir>
import { createClient } from "npm:@supabase/supabase-js@2";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";

const env: Record<string, string> = {};
for (const line of (await Deno.readTextFile(".env.local")).split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/); if (m) env[m[1]] = m[2]; }
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const [projectId, outDir] = Deno.args;
await Deno.mkdir(`${outDir}/thumbs`, { recursive: true });
const { data: p } = await admin.from("long_form_projects").select("autopilot").eq("id", projectId).single();
const planId = p.autopilot.scenes.planId;
const { data: beats } = await admin.from("long_form_beats").select("sequence, start_ms, end_ms, narration_text, contract").eq("beat_plan_version_id", planId).order("sequence");
const { data: imgs } = await admin.from("long_form_scene_images").select("beat_sequence, image_url, overlay_text, tier").eq("project_id", projectId).eq("beat_plan_version_id", planId).eq("is_current", true);
const byN = new Map((imgs ?? []).map((i: any) => [i.beat_sequence, i]));
const font = await Deno.readFile("supabase/functions/_shared/fonts/LilitaOne-Regular.ttf");
const scenes: any[] = [];
const list = [...(beats ?? [])];
await Promise.all(Array.from({ length: 8 }, async () => {
  while (list.length) {
    const b: any = list.shift();
    const i: any = byN.get(b.sequence);
    const url = i?.image_url ? `${i.image_url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/")}?width=480&height=270&resize=contain&quality=78` : null;
    const file = `${outDir}/thumbs/${String(b.sequence).padStart(3, "0")}.jpg`;
    if (url) { try { await Deno.stat(file); } catch { const r = await fetch(url); await Deno.writeFile(file, new Uint8Array(await r.arrayBuffer())); } }
    scenes.push({ n: b.sequence, startMs: b.start_ms, endMs: b.end_ms, narration: b.narration_text, concept: b.contract?.visualConcept ?? "", summary: b.contract?.userSummary ?? "", treatment: b.contract?.treatment ?? "", camera: b.contract?.composition?.camera ?? "", subjects: (b.contract?.subjects ?? []).map((s: any) => s.castId), text: b.contract?.textIntent?.text ?? null, overlayText: i?.overlay_text ?? null, file: url ? file : null });
  }
}));
scenes.sort((a, b) => a.n - b.n);
await Deno.writeTextFile(`${outDir}/scenes.json`, JSON.stringify(scenes, null, 1));

// Review sheets: 4 columns x 3 rows, 480x270 each, the scene number drawn in the corner.
const COLS = 4, ROWS = 3, W = 480, H = 270;
let sheet = 0;
for (let s = 0; s < scenes.length; s += COLS * ROWS) {
  const img = new Image(COLS * W, ROWS * H);
  img.fill(0x111111ff);
  for (let k = 0; k < COLS * ROWS && s + k < scenes.length; k++) {
    const sc = scenes[s + k];
    const x = (k % COLS) * W, y = Math.floor(k / COLS) * H;
    if (sc.file) { const t = await Image.decode(await Deno.readFile(sc.file)); t.resize(W - 4, H - 4); img.composite(t, x + 2, y + 2); }
    const label = Image.renderText(font, 34, String(sc.n), 0xffff00ff);
    const bg = new Image(label.width + 12, label.height + 6); bg.fill(0x000000d0);
    img.composite(bg, x + 4, y + 4); img.composite(label, x + 10, y + 7);
  }
  sheet++;
  await Deno.writeFile(`${outDir}/sheet-${String(sheet).padStart(2, "0")}.jpg`, await img.encodeJPEG(82));
}
console.log(JSON.stringify({ scenes: scenes.length, thumbs: scenes.filter((s) => s.file).length, sheets: sheet }));
