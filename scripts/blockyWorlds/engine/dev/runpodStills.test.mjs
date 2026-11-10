// The RunPod still roles (runpod/stillsRole.mjs via worker.mjs runJob), the laptop client (dev/runpodStills.mjs) and the
// builder's RunPod renderer (runpod/stillRendererRunpod.mjs), all with fakes: no Chrome, no GPU, no network. Free.
//   node --test dev/runpodStills.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { resolvePicks, stillsTimeline, fileNames, objectStillsJob, deliver, INLINE_MAX, pageQuery } from "../runpod/stillsRole.mjs";
import { runJob } from "../runpod/worker.mjs";
import { splitPicks, parsePicks, timelineStills, readObjectItems } from "./runpodStills.mjs";
import { makeStillRenderer } from "../runpod/stillRendererRunpod.mjs";
import { billed, estimate, RATE } from "../runpod/client.mjs";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "bw-rps-test-"));
const TL = { width: 1080, height: 1920, fps: 24, duration: 10, captions: [{ t: 0, text: "hi" }], shots: [{ start: 0, end: 2 }, { start: 2, end: 6 }, { start: 6, end: 10 }] };
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);

test("picks: all = every shot's middle, shots by id, times clamped; labels unique in the file names", () => {
  assert.deepEqual(resolvePicks(TL, "all").map((p) => [p.label, p.t, p.shot]), [["s00", 1, 0], ["s01", 4, 1], ["s02", 8, 2]]);
  assert.deepEqual(parsePicks(TL, { shots: "2,0" }).map((p) => p.t), [8, 1]);
  assert.deepEqual(parsePicks(TL, { times: "0.5, 3,99" }).map((p) => p.t), [0.5, 3, 9.99]);
  assert.throws(() => resolvePicks(TL, [{ shot: 7 }]), /no shot 7/);
  assert.throws(() => resolvePicks(TL, []), /no picks/);
  assert.deepEqual(fileNames([{ label: "a" }, { label: "a" }, { label: "b" }]), ["000_a.jpg", "001_a_2.jpg", "002_b.jpg"]);
});

test("pickedTimeline: only the picked shots, back to back; times and shot numbers map both ways", async () => {
  const { pickedTimeline } = await import("../runpod/stillsRole.mjs");
  const list = resolvePicks(TL, [{ shot: 2 }, { t: 0.5 }, { t: 7 }]);
  const s = pickedTimeline(TL, list);
  assert.equal(s.tl.shots.length, 2); assert.equal(s.tl.duration, 6);
  assert.deepEqual(list.map((p) => s.at(p)), [4, 0.5, 3]);
  assert.equal(s.shotOf(1), 2); assert.equal(s.shotOf(0), 0);
});

test("the stills timeline: w x h (even), captions dropped unless asked, the original untouched", () => {
  const c = stillsTimeline(TL, { w: 541, h: 960 });
  assert.equal(c.width, 542); assert.equal(c.height, 960); assert.deepEqual(c.captions, []);
  assert.equal(TL.captions.length, 1);
  assert.equal(stillsTimeline(TL, { captions: true }).captions.length, 1);
});

test("splitPicks: a small list stays in one job (one page load); a big one goes to at most 3, in order", () => {
  const p = (n) => Array.from({ length: n }, (_, i) => ({ t: i }));
  assert.equal(splitPicks(p(12)).length, 1);
  const g = splitPicks(p(100));
  assert.equal(g.length, 3); assert.equal(g.flat().length, 100);
  assert.deepEqual(g.flat().map((x) => x.t), p(100).map((x) => x.t));
});

const fakeStill = ({ outDir }) => {
  let n = 0;
  return {
    ready: async () => null,
    async render(kind, spec, opts) {
      if (spec.boom) throw new Error("boom");
      const file = path.join(outDir, `${opts.name ?? `${kind}-${++n}`}.jpg`); fs.writeFileSync(file, JPEG);
      return { file, jpeg: JPEG, w: kind === "world" ? 432 : opts.size ?? 768, h: 768, mean: 120, flat: spec.flat ? 0.95 : 0.3, detail: 9, bad: !!spec.flat, problems: [] };
    },
    close: async () => {},
  };
};

test("role objectStills through runJob: inline JPEGs, a failed item reported (never thrown), the flat one flagged", async () => {
  const r = await runJob({ role: "objectStills", objectStills: { items: [{ spec: { parts: [1] }, label: "red barn" }, { spec: { boom: 1 } }, { kind: "world", spec: { flat: 1 }, view: { yaw: 90 } }] } },
    { post: async () => {}, build: null, gpuCheck: async () => "fake NVIDIA", makeRenderer: fakeStill });
  assert.equal(r.ok, true, r.error);
  assert.equal(r.role, "objectStills"); assert.equal(r.renderer, "fake NVIDIA");
  assert.equal(r.stills.length, 3);
  assert.equal(r.stills[0].label, "red_barn"); assert.equal(Buffer.from(r.stills[0].b64, "base64").compare(JPEG), 0);
  assert.match(r.stills[1].error, /boom/); assert.equal(r.stills[1].b64, undefined);
  assert.equal(r.stills[2].bad, true); assert.deepEqual(r.stills[2].view, { yaw: 90 });
});

test("uploads: each JPEG to its signed URL (file:// in tests) + the manifest; no b64 then", async () => {
  const d = tmp(), dst = tmp();
  try {
    const u = (n) => pathToFileURL(path.join(dst, n)).href;
    const r = await objectStillsJob({ objectStills: { items: [{ spec: { parts: [1] }, label: "a" }], out: { uploads: { "000_a.jpg": u("a.jpg") }, manifest: u("m.json") } } }, d,
      { gpuCheck: async () => "x", put: (await import("../runpod/worker.mjs")).put, makeRenderer: fakeStill });
    assert.equal(r.stills[0].uploaded, true); assert.equal(r.stills[0].b64, undefined);
    assert.ok(fs.existsSync(path.join(dst, "a.jpg")));
    assert.equal(JSON.parse(fs.readFileSync(path.join(dst, "m.json"), "utf8")).stills[0].file, "000_a.jpg");
  } finally { fs.rmSync(d, { recursive: true, force: true }); fs.rmSync(dst, { recursive: true, force: true }); }
});

test("inline has a size cap", async () => {
  const d = tmp();
  try {
    fs.writeFileSync(path.join(d, "x.jpg"), "x");
    await assert.rejects(deliver({ stills: [{ file: "x.jpg", bytes: INLINE_MAX + 1 }] }, d, null, async () => {}), /out\.uploads/);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test("a stale worker refuses a stills job before any work", async () => {
  const r = await runJob({ role: "stills", minBuild: "20991231T000000-aaaaaaaaaaaa" }, { post: async () => {}, build: "20261108T000000-bbbbbbbbbbbb", gpuCheck: async () => { throw new Error("must not run"); } });
  assert.equal(r.code, "STALE_WORKER");
});

test("role stills without a timeline: BAD_JOB", async () => {
  const r = await runJob({ role: "stills", stills: { picks: "all" } }, { post: async () => {}, build: null, gpuCheck: async () => "x" });
  assert.equal(r.ok, false); assert.equal(r.code, "BAD_JOB");
});

// ---- the RunPod renderer (builder hook) with a fake RunPod client
function fakeRp(script) {
  const sent = [];
  return {
    sent,
    async submit(input) { sent.push(input); return `job${sent.length}`; },
    async wait(id) { const k = Number(id.slice(3)) - 1; return script(sent[k], k); },
  };
}
const okOutput = (input) => ({ status: "COMPLETED", executionTime: 9000, delayTime: 3000, output: { ok: true, stills: input.job.objectStills.items.map((it) => ({ label: it.label, w: 768, h: 768, b64: JPEG.toString("base64"), mean: 100, flat: 0.2, detail: 8, bad: false, problems: [], ms: 900 })) } });

test("stillRendererRunpod: calls close together go to ONE job; files written; spend counted", async () => {
  const d = tmp();
  try {
    const rp = fakeRp(okOutput);
    const r = await makeStillRenderer({ outDir: d, client: rp, minBuild: "B1", log: () => {} });
    const [a, b] = await Promise.all([r.render("object", { parts: [1] }, { name: "object-lamp-1" }), r.render("world", { set: 1 }, { name: "world-x-1", light: "night" })]);
    assert.equal(rp.sent.length, 1);
    const job = rp.sent[0].job;
    assert.equal(job.role, "objectStills"); assert.equal(job.minBuild, "B1"); assert.equal(job.objectStills.items[1].light, "night");
    assert.ok(fs.existsSync(a.file) && fs.existsSync(b.file)); assert.equal(a.jpeg.compare(JPEG), 0);
    assert.equal(r.spent.jobs, 1); assert.equal(r.spent.seconds, 12); assert.equal(r.spent.usd, +(12 * RATE).toFixed(5));
    assert.ok(fs.readFileSync(path.join(d, "spend.jsonl"), "utf8").includes("objectStills"));
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test("stillRendererRunpod: NO_GPU is sent once more; a real failure rejects every still of the batch", async () => {
  const d = tmp();
  try {
    const rp = fakeRp((input, k) => (k === 0 ? { status: "COMPLETED", output: { ok: false, code: "NO_GPU", error: "MIG" } } : okOutput(input)));
    const r = await makeStillRenderer({ outDir: d, client: rp, minBuild: null, log: () => {} });
    const s = await r.render("object", { parts: [1] });
    assert.equal(rp.sent.length, 2); assert.ok(s.file);
    const rp2 = fakeRp(() => ({ status: "COMPLETED", output: { ok: false, code: "BAD_JOB", error: "no items" } }));
    const r2 = await makeStillRenderer({ outDir: d, client: rp2, minBuild: null, log: () => {} });
    await assert.rejects(r2.render("object", { parts: [1] }), /BAD_JOB/);
    assert.equal(rp2.sent.length, 1);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test("timelineStills: one signed URL per still, downloads, the test folder always deleted", async () => {
  const d = tmp(), store = { files: new Map(), cleaned: 0 };
  const st = {
    put: async (n, b) => { store.files.set(n, b); }, signGet: async (n) => `get:${n}`, signPut: async (n) => `put:${n}`,
    get: async (n) => (store.files.has(n) ? Buffer.from(store.files.get(n)) : null), cleanup: async () => { store.cleaned++; return store.files.size; },
  };
  try {
    const rp = fakeRp((input) => {
      const s = input.job.stills;
      assert.equal(s.timelineUrl, "get:timeline.json");
      const names = Object.keys(s.out.uploads);
      for (const n of names) store.files.set(s.out.uploads[n].slice(4), JPEG);
      return { status: "COMPLETED", executionTime: 20000, delayTime: 1000, output: { ok: true, loadMs: 8000, renderer: "NVIDIA", timing: {}, stills: s.picks.map((p, i) => ({ label: p.label, file: names[i], t: p.t, shot: p.shot, bad: false })) } };
    });
    const picks = resolvePicks(TL, "all");
    const r = await timelineStills({ tl: TL, picks, out: d, rp, store: st, log: () => {} });
    assert.equal(r.stills.length, 3); assert.ok(r.stills.every((s) => s.local && fs.existsSync(s.local)));
    assert.equal(store.cleaned, 1); assert.equal(r.seconds, 21);
    const failing = fakeRp(() => ({ status: "FAILED", error: "x" }));
    await assert.rejects(timelineStills({ tl: TL, picks, out: d, rp: failing, store: st, log: () => {} }), /failed/);
    assert.equal(store.cleaned, 2);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test("object specs file: a bare blueprint list is read as objects; billed + estimate", () => {
  const d = tmp();
  try {
    fs.writeFileSync(path.join(d, "s.json"), JSON.stringify([{ name: "lamp", parts: [] }, { kind: "world", spec: { a: 1 }, label: "w" }]));
    const items = readObjectItems(path.join(d, "s.json"));
    assert.equal(items[0].kind, "object"); assert.equal(items[0].label, "lamp"); assert.equal(items[1].kind, "world");
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
  assert.deepEqual(billed({ executionTime: 1000, delayTime: 500 }), { seconds: 1.5, usd: +(1.5 * RATE).toFixed(5) });
  assert.ok(estimate({ jobs: 1, stills: 3 }).usd < 0.01);
});

test("the builder: renderer 'runpod' is wired (index.js names the RunPod module)", () => {
  const src = fs.readFileSync(new URL("../lib/builder/index.js", import.meta.url), "utf8");
  assert.match(src, /renderer === "runpod"/); assert.match(src, /runpod\/stillRendererRunpod\.mjs/);
});

test("pageQuery: a stills job's page query keeps plain key=value flags only (nolut=1 for the colour re-fit)", () => {
  assert.equal(pageQuery("nolut=1"), "nolut=1");
  assert.equal(pageQuery("nolut=1&noao&x=<b>&y=a b"), "nolut=1&noao");
  assert.equal(pageQuery(null), "");
});
