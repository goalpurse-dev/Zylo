// Offline replay of the render worker's duration + cut checks for one parallel
// render, from the DB alone ($0): the parent's EDL and each chunk's recorded
// segment frame counts. Prints where the timeline drifts.
//   node --env-file=.env.local scripts/renderChecksReplay.mjs <parentJobId>
import { createClient } from "@supabase/supabase-js";

const [JOB] = process.argv.slice(2);
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: job } = await admin.from("long_form_render_jobs").select("id, edl, chunk_count, status, error_code").eq("id", JOB).single();
const { data: chunks } = await admin.from("long_form_render_jobs").select("chunk_index, piece_from, piece_to, status, checks").eq("parent_job_id", JOB).order("chunk_index");
const edl = job.edl;
const v2 = edl.version === 2 || !!edl.pieces;
const units = v2 && edl.pieces ? edl.pieces.map((p, k) => ({ ...p, index: k, startFrame: p.fromFrame })) : edl.clips;
const segFrames = chunks.flatMap((c) => c.checks?.segFrames ?? []);
const frameMs = 1000 / edl.fps;
let acc = 0;
const rows = units.map((u, i) => { const at = acc; acc += segFrames[i] ?? NaN; return { i, startFrame: u.startFrame, at, err: at - u.startFrame, want: (u.toFrame ?? u.endFrame) - u.startFrame, got: segFrames[i], kind: u.kind }; });
const bad = rows.filter((r) => r.want !== r.got);
console.log(JSON.stringify({
  job: { status: job.status, error: job.error_code, chunks: chunks.map((c) => `${c.chunk_index}:${c.piece_from}-${c.piece_to}:${c.status}:${c.checks?.segFrames?.length}`) },
  units: units.length, segFramesRecorded: segFrames.length, totalFrames: edl.totalFrames, sumSegFrames: acc, audioMs: edl.audio?.durationMs,
  duration: { diffFramesVsAudio: Number(((edl.totalFrames * frameMs - edl.audio?.durationMs) / frameMs).toFixed(2)) },
  cuts: { maxErrFrames: Math.max(...rows.map((r) => Math.abs(r.err))), firstDrift: rows.find((r) => Math.abs(r.err) > 1) ?? null },
  segmentsWithWrongLength: bad.slice(0, 12), wrongCount: bad.length,
}, null, 1));
