// deno-lint-ignore-file no-explicit-any
// Text upgrade — apply the new on-screen text to an existing project's scenes
// (text layers only, NO image re-render; asked for f90160bc). The new headline
// pass tops the scenes up to the project's density; every text scene (old and
// new) gets its style (HEADLINE / BIG_STAT / QUESTION / CALLOUT) and is placed
// clear of faces after one low-detail look. Hard cap $0.02. The old layers are
// backed up first (restore: --restore <backup.json>).
//   npx -y deno@2.9.6 run -A --no-check scripts/textUpgradeApply.ts <projectId> <outDir> [--write]
import { createClient } from "npm:@supabase/supabase-js@2";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import { pickHeadlines, acceptHeadlines, applyTextPass, textStyleOf, categoryOf, HEADLINE_MODEL } from "../supabase/functions/_shared/stickman/headlines.ts";
import { placeTextLayer } from "../supabase/functions/_shared/stickman/textPlacement.ts";
import { loadOverlayFont, drawLayer } from "../supabase/functions/_shared/stickman/textOverlay.ts";

const CAP = 0.02;
const env: Record<string, string> = {};
for (const line of (await Deno.readTextFile(".env.local")).split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/); if (m) env[m[1]] = m[2]; }
const URL_ = env.SUPABASE_URL, OPENAI = env.OPENAI_API_KEY;
const admin = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const [PROJECT, outDir] = Deno.args;
const WRITE = Deno.args.includes("--write");
await Deno.mkdir(`${outDir}/preview`, { recursive: true });
const statePath = `${outDir}/state.json`;
let st: any = {};
try { st = JSON.parse(await Deno.readTextFile(statePath)); } catch { st = {}; }
const save = () => Deno.writeTextFile(statePath, JSON.stringify(st, null, 1));
const spent = () => (st.pass?.costUsd ?? 0) + Object.values(st.placed ?? {}).reduce((a: number, p: any) => a + (p.costUsd ?? 0), 0);
const ledger = (stage: string, units: any, usd: number) => admin.from("long_form_cost_ledger").insert({ project_id: PROJECT, stage, provider: "openai", model: HEADLINE_MODEL, units: { ...units, purpose: "text upgrade (layers only)" }, usd, estimated: false, source_table: "text_upgrade" });

const { data: p, error } = await admin.from("long_form_projects").select("autopilot, on_screen_text_density").eq("id", PROJECT).single();
if (error) throw error;
const planId = p.autopilot.scenes.planId;
const density = p.on_screen_text_density ?? "balanced";
const { data: scenes } = await admin.from("long_form_scene_images").select("id, beat_sequence, image_url, overlay, overlay_text, qa").eq("project_id", PROJECT).eq("beat_plan_version_id", planId).eq("is_current", true).order("beat_sequence");
const { data: rows } = await admin.from("long_form_beats").select("sequence, start_ms, narration_text, contract").eq("beat_plan_version_id", planId).order("sequence");
const sceneOf = new Map(scenes!.map((s: any) => [s.beat_sequence, s]));
// Words the MODEL drew into the picture (the director's text on V3 with no overlay layer) count as picture words.
const PICTURE_WORDS: Record<number, string> = Object.fromEntries((rows ?? []).filter((b: any) => b.contract?.textIntent?.text && !sceneOf.get(b.sequence)?.overlay_text).map((b: any) => [b.sequence, b.contract.textIntent.text]));
const beats = (rows ?? []).map((b: any) => {
  const s = sceneOf.get(b.sequence);
  const textIntent = s?.overlay_text ? { mode: "SHORT_TEXT", text: s.overlay_text, kind: "HEADLINE" } : PICTURE_WORDS[b.sequence] ? { mode: "SHORT_TEXT", text: PICTURE_WORDS[b.sequence], kind: "IN_SCENE" } : { mode: "NO_TEXT", text: null };
  return { sequence: b.sequence, startMs: b.start_ms, narrationText: b.narration_text, contract: { ...b.contract, textIntent } };
});
const before = scenes!.filter((s: any) => s.overlay_text).length;

if (Deno.args.includes("--restore")) {
  const bk = JSON.parse(await Deno.readTextFile(Deno.args[Deno.args.indexOf("--restore") + 1]));
  for (const s of bk.scenes) await admin.from("long_form_scene_images").update({ overlay: s.overlay, overlay_text: s.overlay_text }).eq("id", s.id);
  for (const b of bk.beats) await admin.from("long_form_beats").update({ contract: b.contract }).eq("beat_plan_version_id", planId).eq("sequence", b.sequence);
  console.log(`restored ${bk.scenes.length} scenes, ${bk.beats.length} beats`);
  Deno.exit(0);
}

// --reaccept: re-run the (free, code) acceptance on the saved candidates after an offline rule fix.
if (Deno.args.includes("--reaccept") && st.pass?.picks) {
  const acc = acceptHeadlines(beats, st.pass.picks, density);
  st.pass = { ...st.pass, target: acc.target, accepted: acc.accepted, rejected: acc.rejected };
  st.placed = {};
  await save();
}
// ---- 1. the headline pass (one call per ~40 beats) ----
if (!st.pass) {
  const picked = await pickHeadlines(OPENAI, beats, density);
  await ledger("beats_text", picked.usage, picked.costUsd);
  const acc = acceptHeadlines(beats, picked.picks, density);
  st.pass = { density, costUsd: picked.costUsd, usage: picked.usage, candidates: picked.picks.length, picks: picked.picks, target: acc.target, accepted: acc.accepted, rejected: acc.rejected };
  await save();
}
console.log(`pass: ${st.pass.candidates} candidates -> ${st.pass.accepted.length} new (target ${st.pass.target}), $${st.pass.costUsd.toFixed(4)}`);

// ---- 2. every text scene: style + a face-clear spot (one low-detail look each) ----
const planned = applyTextPass(beats, st.pass.accepted);
const textBeats = planned.filter((b: any) => b.contract.textIntent?.mode === "SHORT_TEXT" && b.contract.textIntent.kind === "HEADLINE" && b.contract.textIntent.text);
const font = await loadOverlayFont();
const LOOK_WORST = 0.0012;
st.placed ??= {};
for (const b of textBeats) {
  if (st.placed[b.sequence]) continue;
  const s = sceneOf.get(b.sequence);
  const path = new URL(s.image_url).pathname.split("/public/generated/")[1];
  const tr = (w: number) => `${URL_}/storage/v1/render/image/public/generated/${path}?width=${w}&height=${Math.round((w * 9) / 16)}&resize=contain&format=origin`;
  const lookUrl = tr(768);
  const warm = await fetch(lookUrl); await warm.body?.cancel();
  const bytes = new Uint8Array(await (await fetch(tr(1376))).arrayBuffer());
  const intent = { ...b.contract.textIntent, style: b.contract.textIntent.style ?? textStyleOf(b.contract.textIntent.text) };
  const canLook = spent() + LOOK_WORST <= CAP;
  const r = await placeTextLayer({ bytes, imageUrl: lookUrl, text: intent.text, intent, font, openaiKey: OPENAI, look: canLook });
  if (r.costUsd) await ledger("qa", { calls: 1, beat: b.sequence, look: "text placement" }, r.costUsd);
  st.placed[b.sequence] = { text: intent.text.toUpperCase(), wanted: intent.style, style: r.style, blocked: r.blocked, looked: canLook, costUsd: r.costUsd, layer: r.layer, faces: r.look?.faces?.length ?? null, callout: intent.callout ?? null, isNew: st.pass.accepted.some((a: any) => a.sequence === b.sequence), category: categoryOf(intent.text, intent.category) };
  await save();
  // A 960 px preview with the layer, for review.
  if (r.layer) {
    const img = await Image.decode(new Uint8Array(await (await fetch(`${URL_}/storage/v1/render/image/public/generated/${path}?width=1920&height=1080&resize=contain&format=origin`)).arrayBuffer()));
    drawLayer(img, r.layer, font);
    img.resize(960, Image.RESIZE_AUTO);
    await Deno.writeFile(`${outDir}/preview/${String(b.sequence).padStart(3, "0")}.jpg`, await img.encodeJPEG(82));
  }
  console.log(`${b.sequence} ${st.placed[b.sequence].isNew ? "NEW" : "old"} ${r.style}${r.blocked ? " BLOCKED" : ""} "${intent.text}" faces ${r.look?.faces?.length ?? "-"} $${r.costUsd.toFixed(5)} (total $${spent().toFixed(4)})`);
}

// ---- 3. write (text layers + the plan's text contract), with a backup ----
const placed = Object.entries(st.placed).map(([k, v]: any) => ({ sequence: Number(k), ...v }));
const shown = placed.filter((x) => x.layer);
const mix = shown.reduce((m: any, x) => ((m[x.style] = (m[x.style] ?? 0) + 1), m), {});
console.log(JSON.stringify({ before, after: shown.length, of: scenes!.length, mix, blocked: placed.filter((x) => x.blocked).map((x) => x.sequence), spent: Number(spent().toFixed(4)) }));
if (WRITE && !st.written) {
  const touched = placed.map((x) => x.sequence);
  await Deno.writeTextFile(`${outDir}/backup.json`, JSON.stringify({ project: PROJECT, planId, at: new Date().toISOString(), scenes: scenes!.filter((s: any) => touched.includes(s.beat_sequence)).map((s: any) => ({ id: s.id, beat_sequence: s.beat_sequence, overlay: s.overlay, overlay_text: s.overlay_text })), beats: (rows ?? []).filter((b: any) => touched.includes(b.sequence)).map((b: any) => ({ sequence: b.sequence, contract: b.contract })) }));
  for (const x of placed) {
    const s = sceneOf.get(x.sequence);
    await admin.from("long_form_scene_images").update({ overlay: x.layer, overlay_text: x.layer ? x.text : null }).eq("id", s.id);
    const b = planned.find((y: any) => y.sequence === x.sequence);
    const row = rows!.find((y: any) => y.sequence === x.sequence);
    await admin.from("long_form_beats").update({ contract: { ...row.contract, textIntent: x.layer ? { ...b.contract.textIntent, style: x.style } : { mode: "NO_TEXT", text: null } } }).eq("beat_plan_version_id", planId).eq("sequence", x.sequence);
  }
  st.written = new Date().toISOString();
  await save();
  console.log(`written: ${placed.length} scenes (backup ${outDir}/backup.json)`);
}
