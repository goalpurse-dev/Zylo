// deno-lint-ignore-file no-explicit-any
// Phase 6f ($0): queue a PARALLEL render of the Myth vs Reality TEST project
// for LOCAL workers only (no Fly machine is started): the same compile as
// long-form-render (centre flatness, EDL v2, masters, chunk split), a parent
// job in 'waiting' + N chunk jobs. Start the local workers right after (the
// cron watchdog would otherwise dispatch Fly machines for queued jobs >150 s).
//   npx -y deno@2.9.6 run -A --no-check scripts/queueLocalParallelRender.ts [chunks=4]
import { createClient } from "npm:@supabase/supabase-js@2";
import { encodeHex } from "jsr:@std/encoding@1/hex";
import { compileEdit, musicVolumeExpr } from "../supabase/functions/_shared/stickman/editRender.ts";
import { fillCenterFlatness } from "../supabase/functions/_shared/stickman/flatness.ts";
import { chunkPieces } from "../supabase/functions/_shared/stickman/renderChunks.ts";
import { flattenWords } from "../src/lib/stickmanEdit.js";

const TEST_PROJECT = "f6ee3eb2-726b-4faa-9d25-1ed957eb46ae";
const N = Number(Deno.args[0] ?? 4);
const env: Record<string, string> = {};
for (const line of (await Deno.readTextFile(".env.local")).split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/); if (m) env[m[1]] = m[2]; }
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: live } = await admin.from("long_form_render_jobs").select("id").eq("project_id", TEST_PROJECT).in("status", ["queued", "rendering", "waiting"]);
if (live?.length) throw new Error("a render is already live for the test project");
const { data: edit } = await admin.from("long_form_edits").select("version, doc").eq("project_id", TEST_PROJECT).order("version", { ascending: false }).limit(1).single();
const doc = edit.doc;
const { data: narr } = await admin.from("long_form_narration_audio_versions").select("narration").eq("id", doc.audio.narrationId).single();
await fillCenterFlatness(doc.clips);
const edl: any = compileEdit(doc, flattenWords(narr.narration));
edl.width = 1920; edl.height = 1080; edl.resolution = "1080p";
const ids = [...new Set(edl.clips.map((c: any) => c.sceneId).filter(Boolean))];
const { data: scenes } = await admin.from("long_form_scene_images").select("id, master_url").in("id", ids);
const masterOf = new Map((scenes ?? []).map((s: any) => [s.id, s.master_url ?? null]));
for (const c of edl.clips) { const m = c.sceneId ? masterOf.get(c.sceneId) : null; if (m) c.masterImage = m; }
if (edl.music) edl.musicVolumeExpr = musicVolumeExpr(edl.music);
const sha = encodeHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(edl)))));
const ranges = chunkPieces(edl.pieces, N);
const { data: parent, error } = await admin.from("long_form_render_jobs").insert({ project_id: TEST_PROJECT, status: "waiting", edl, edl_sha256: sha, inputs_prefix: `${TEST_PROJECT}/edit-v${edit.version}`, edit_version: edit.version, resolution: "1080p", stage: "queued", chunk_count: ranges.length, dispatched_at: new Date().toISOString() }).select("id").single();
if (error) throw error;
const { error: ce } = await admin.from("long_form_render_jobs").insert(ranges.map(([from, to], i) => ({ project_id: TEST_PROJECT, parent_job_id: parent.id, chunk_index: i, chunk_count: ranges.length, piece_from: from, piece_to: to, status: "queued", edl, edl_sha256: sha, inputs_prefix: `${TEST_PROJECT}/${parent.id}/chunk-${i}`, edit_version: edit.version, resolution: "1080p", stage: "queued", dispatched_at: new Date().toISOString() })));
if (ce) throw ce;
const frames = ranges.map(([a, b]) => edl.pieces.slice(a, b).reduce((s: number, p: any) => s + p.frames, 0));
console.log(JSON.stringify({ parent: parent.id, editVersion: edit.version, pieces: edl.pieces.length, totalFrames: edl.totalFrames, chunks: ranges, chunkFrames: frames, transitions: edl.pieces.filter((p: any) => p.kind === "xfade").map((p: any) => p.transition) }));
