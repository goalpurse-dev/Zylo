// deno-lint-ignore-file no-explicit-any
// Phase 5b — queue ONE server render of Myth vs Reality.
// Builds the image-version registry (every V2 render round), the EDL from the
// NEWEST approved version of each beat (id + sha256 logged per clip), runs the
// blocking integrity check, uploads the job's inputs (images, text-layer PNGs,
// narration) to the private renders bucket, inserts the render_jobs row and
// moves the project to images_ready. The worker takes it from there.
import { admin, root, PROJECT_ID } from "./lib/v2Runner.ts";
import { encodeHex } from "jsr:@std/encoding@1/hex";
import { buildEdl, validateEdl, checkImageIntegrity, newestApproved, type ImageVersion } from "../supabase/functions/_shared/stickman/edl.ts";
import { renderLayerPng, scaleLayer } from "../supabase/functions/_shared/stickman/textOverlay.ts";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
// MASTER=1 (Phase 5d): also attach each beat's full-res source + a 2560x1440
// text layer, so the worker renders the 1440p YouTube master.
const MASTER = Deno.env.get("MASTER") === "1";
const masterSrc = MASTER ? JSON.parse(await Deno.readTextFile(new URL("docs/phase5/master-src/state.json", root))).beats : {};

const read = async (p: string) => JSON.parse(await Deno.readTextFile(new URL(p, root)));
const sha = async (bytes: Uint8Array) => encodeHex(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)));
const BUCKET = "long-form-renders";
const plan = await read("tests/fixtures/stickman/beats/myth-vs-reality.phase5b.json");
const full = await read("docs/phase4/fullset/state.json");
const fix = await read("docs/phase4/fix4d/state.json");
const AUDIO = "tests/fixtures/stickman/audio/myth-vs-reality/audio.mp3";

// ---- image versions: one per beat per render round (createdAt = the round's order) ----
const rounds: [string, string, Record<string, any>][] = [
  ["4c", "2026-09-27T10:00:00Z", full.beats], ["4d", "2026-09-27T12:00:00Z", fix.beats ?? {}],
  ["5a", "2026-09-27T15:00:00Z", fix.round2?.beats ?? {}], ["5b", "2026-09-27T19:00:00Z", fix.round3?.beats ?? {}],
];
const versions: ImageVersion[] = [];
for (const [round, createdAt, beats] of rounds) for (const [seq, r] of Object.entries(beats)) {
  if (!r?.files?.base) continue;
  versions.push({ beatSequence: Number(seq), versionId: `v2-${round}-${seq}`, path: r.files.base, sha256: await sha(await Deno.readFile(new URL(r.files.base, root))), approved: !r.failed, createdAt });
}
const overlayOf = (seq: number, versionId: string) => {
  const round = versionId.split("-")[1];
  const r = rounds.find(([k]) => k === round)![2][seq];
  return r?.overlay ?? null;
};
await Deno.writeTextFile(new URL("docs/phase5/image-versions.json", root), JSON.stringify(versions, null, 1));

// ---- EDL from the newest approved version of every beat ----
const audioBytes = await Deno.readFile(new URL(AUDIO, root));
const audioMs = 523416;
const edl = buildEdl({
  beats: plan.beats,
  audio: { path: AUDIO, durationMs: audioMs },
  imageFor: (seq) => { const v = newestApproved(versions, seq)!; return { image: v.path, overlay: overlayOf(seq, v.versionId), imageVersionId: v.versionId, imageSha256: v.sha256 }; },
});
const structural = validateEdl(edl), integrity = checkImageIntegrity(edl, versions);
// Proof the check blocks: pointing one clip at a superseded version must fail.
const superseded = versions.find((v) => v.beatSequence === 24 && v.versionId !== newestApproved(versions, 24)!.versionId)!;
const probe = checkImageIntegrity({ ...edl, clips: edl.clips.map((c) => (c.beatSequence === 24 ? { ...c, imageVersionId: superseded.versionId, imageSha256: superseded.sha256 } : c)) }, versions);
if (structural.length || integrity.length || probe.length !== 1) throw new Error(`EDL blocked: ${[...structural, ...integrity].join("; ")} (superseded probe: ${probe.join("; ")})`);
const mix: Record<string, number> = {};
for (const c of edl.clips) mix[c.motion.kind] = (mix[c.motion.kind] ?? 0) + 1;
const byRound: Record<string, number> = {};
for (const c of edl.clips) { const r = c.imageVersionId!.split("-")[1]; byRound[r] = (byRound[r] ?? 0) + 1; }
console.log(`EDL ${edl.clips.length} clips, ${edl.totalFrames} frames, motion ${JSON.stringify(mix)}, images by round ${JSON.stringify(byRound)}, integrity ok (superseded probe blocked: "${probe[0]}")`);

// ---- upload inputs, then the job ----
const jobId = crypto.randomUUID();
const prefix = `${PROJECT_ID}/${jobId}/inputs`;
const upload = async (name: string, bytes: Uint8Array, contentType: string) => {
  const { error } = await admin.storage.from(BUCKET).upload(`${prefix}/${name}`, bytes, { contentType, upsert: true });
  if (error) throw new Error(`upload ${name}: ${error.message}`);
  return `${prefix}/${name}`;
};
const narrationPath = await upload("narration.mp3", audioBytes, "audio/mpeg");
const clips = [...edl.clips];
let n = 0;
await Promise.all(Array.from({ length: 8 }, async () => {
  while (clips.length) {
    const c = clips.shift()!;
    const k = String(c.index).padStart(3, "0");
    c.image = await upload(`img-${k}.jpg`, await Deno.readFile(new URL(c.image, root)), "image/jpeg");
    c.overlayImage = c.overlay ? await upload(`ovl-${k}.png`, await renderLayerPng(c.overlay, edl.width, edl.height), "image/png") : null;
    if (MASTER) {
      const m = masterSrc[c.beatSequence];
      if (!m || m.versionId !== c.imageVersionId) throw new Error(`beat ${c.beatSequence}: master source is not the clip's image version (${m?.versionId} vs ${c.imageVersionId})`);
      const bytes = await Deno.readFile(new URL(m.file, root));
      const img = await Image.decode(bytes);
      const ext = m.file.endsWith(".png") ? "png" : "jpg";
      c.masterImage = await upload(`full-${k}.${ext}`, bytes, ext === "png" ? "image/png" : "image/jpeg");
      c.masterSize = { width: img.width, height: img.height };
      (c as any).masterSha256 = await sha(bytes);
      c.overlayImageMaster = c.overlay ? await upload(`ovlm-${k}.png`, await renderLayerPng(scaleLayer(c.overlay, 2560 / 1920), 2560, 1440), "image/png") : null;
    }
    n++;
  }
}));
edl.audio = { ...edl.audio, path: narrationPath, sha256: await sha(audioBytes) } as any;
const edlJson = JSON.stringify(edl);
await Deno.writeTextFile(new URL(`docs/phase5/myth-vs-reality.server${MASTER ? ".master" : ""}.edl.json`, root), JSON.stringify(edl, null, 1));
const { error } = await admin.from("long_form_render_jobs").insert({ id: jobId, project_id: PROJECT_ID, status: "queued", edl, edl_sha256: await sha(new TextEncoder().encode(edlJson)), inputs_prefix: prefix, segments_total: edl.clips.length });
if (error) throw new Error(`job insert: ${error.message}`);
await admin.from("long_form_projects").update({ status: "images_ready", status_reason: null, current_render_job_id: jobId }).eq("id", PROJECT_ID);
console.log(`queued job ${jobId}: ${n} images + ${edl.clips.filter((c) => c.overlayImage).length} text layers + narration uploaded to ${BUCKET}/${prefix}`);
