// deno-lint-ignore-file no-explicit-any
// Phase 6f — Publish: the YouTube text rules (chapters from the rendered edit,
// tags <= 500 chars, real-URL sources only, the credit line) and the render's
// resolution / thumbnail constants.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { buildChapters, limitTags, realSources, composeDescription, fmtChapter, cleanTitle, CREDIT_LINE } from "../../src/lib/publishText.js";

Deno.test("chapters: first at 0:00, >= 3, each >= 10 s (short ones give way), none when fewer than 3", () => {
  const clips = [0, 4000, 20000, 25000, 60000, 64000, 120000].map((ms, i) => ({ beatSequence: i + 1, startMs: ms }));
  const sec = { 1: "open", 2: "open", 3: "a", 4: "b", 5: "c", 6: "c", 7: "end" }; // "a" lasts 5 s -> gives way to "b"
  const titles = { open: "Cold open", a: "Too short", b: "The spears", c: "The hunt", end: "Why it matters" };
  const ch = buildChapters(clips, sec, titles, 180000);
  assertEquals(ch.map((c: any) => [fmtChapter(c.ms), c.title]), [["0:00", "Cold open"], ["0:25", "The spears"], ["1:00", "The hunt"], ["2:00", "Why it matters"]]);
  assert(ch.every((c: any, i: number) => (i + 1 < ch.length ? ch[i + 1].ms : 180000) - c.ms >= 10000));
  assertEquals(buildChapters(clips.slice(0, 3), sec, titles, 30000), []);
  assertEquals(fmtChapter(3725000), "1:02:05");
});

Deno.test("tags <= 500 chars, deduped; sources are real URLs only (max 8); titles <= 70; description = hook, chapters, sources, credit", () => {
  const tags = limitTags(["viking helmets", "Viking Helmets", "horns", ...Array.from({ length: 80 }, (_, i) => `a long search tag number ${i}`)]);
  assert(tags.join(",").length <= 500 && tags.length > 10);
  assertEquals(tags.filter((t) => t.toLowerCase() === "viking helmets").length, 1);
  const src = realSources([{ url: "https://www.nature.com/articles/x" }, { url: null }, { url: "preferred source (research-lite)" }, { url: "https://www.nature.com/articles/x" }, ...Array.from({ length: 12 }, (_, i) => ({ url: `https://example.org/${i}` }))]);
  assertEquals(src.length, 8);
  assertEquals(src[0].url, "https://www.nature.com/articles/x");
  assertEquals(cleanTitle("x".repeat(90)).length, 60);
  const d = composeDescription({ hook: "Line one.\nLine two.", chapters: [{ ms: 0, title: "Open" }, { ms: 30000, title: "Middle" }, { ms: 90000, title: "End" }], sources: [{ title: "Nature", url: "https://nature.com/a" }], includeCredit: true });
  assertEquals(d, `Line one.\nLine two.\n\n0:00 Open\n0:30 Middle\n1:30 End\n\nSources:\n• Nature — https://nature.com/a\n\n${CREDIT_LINE}`);
  assert(!composeDescription({ hook: "x", includeCredit: false }).includes("tryzyvo"));
});

import { chunkPieces } from "../../supabase/functions/_shared/stickman/renderChunks.ts";
import { zoomWouldWhiteOut, transitionWindows, withEnds } from "../../src/lib/stickmanEdit.js";
import { chapterHook, LECTURE_TITLE, LAME_HOOK } from "../../src/lib/publishText.js";
import { claimSourceList } from "../../supabase/functions/_shared/stickman/claimSources.ts";

Deno.test("parallel render: contiguous chunks with about the same frames, covering every piece once", () => {
  const pieces = Array.from({ length: 145 }, (_, i) => ({ frames: 60 + (i % 7) * 20 }));
  const r = chunkPieces(pieces, 4);
  assertEquals(r.length, 4);
  assertEquals(r[0][0], 0); assertEquals(r[3][1], 145);
  for (let i = 1; i < r.length; i++) assertEquals(r[i][0], r[i - 1][1]);
  const f = r.map(([a, b]) => pieces.slice(a, b).reduce((s, p) => s + p.frames, 0)), avg = f.reduce((a, b) => a + b) / 4;
  assert(f.every((x) => Math.abs(x - avg) / avg < 0.05), JSON.stringify(f));
  assertEquals(chunkPieces([{ frames: 10 }], 4), [[0, 1]]);
});

Deno.test("zoom punch never dives into blank white (f6ee3eb2 120.3 s) -> whip; a good zoom stays", () => {
  assert(zoomWouldWhiteOut({ centerWhite: 0.71, centerFlat: 0.7 }, { frameWhite: 0.67 }));
  assert(!zoomWouldWhiteOut({ centerWhite: 0.7, centerFlat: 0.7 }, { frameWhite: 0.11 }));
  assert(zoomWouldWhiteOut({ centerFlat: 0.85 }, { frameWhite: 0 }));
  const clips = [{ id: "a", startMs: 0, centerWhite: 0.71, centerFlat: 0.7 }, { id: "b", startMs: 4000, frameWhite: 0.67 }, { id: "c", startMs: 8000 }];
  const doc: any = { audio: { durationMs: 12000 }, clips, transitions: { b: "zoom", c: "zoom" } };
  assertEquals(transitionWindows(doc, withEnds(doc)).map((w: any) => w.kind), ["whip", "zoom"]);
});

Deno.test("YouTube text: one title <= 60 (no | joins), no lecture titles, 2-5 word chapter hooks, no lame hook", () => {
  assertEquals(cleanTitle("Did Vikings Wear Horned Helmets? | Who Put Horns on Vikings?"), "Did Vikings Wear Horned Helmets?");
  assert(cleanTitle("A very long title that keeps going and going well beyond the sixty char limit").length <= 60);
  assert(LECTURE_TITLE.test("Viking Helmets Explained: Myth, Evidence, Caveat") && !LECTURE_TITLE.test("Who Put Horns on Vikings?"));
  assertEquals(chapterHook("Final image", "The ending"), "The Ending");
  assertEquals(chapterHook("Who Added the Horns?", "x"), "Who Added the Horns?");
  assertEquals(chapterHook("A", "Cold open"), "What It Means");
  assert(LAME_HOOK.test("Find out whether real Vikings wore horns") && !LAME_HOOK.test("No Viking grave ever held a horned helmet."));
});

Deno.test("sources: claim -> fact -> research sources, verdict URLs first, unique, max 8, never invented", () => {
  const research: any = { fact_graph: { facts: [{ id: "f1", sourceIds: ["src_a", "src_b"] }, { id: "f2", sourceIds: ["src_a"] }] }, intermediate: { v1SourcesFull: [{ id: "src_a", url: "https://a.org/x", title: "A" }, { id: "src_b", url: "https://b.org/y", title: "B" }, { id: "src_c", url: "not a url" }] } };
  const doc = { claims: [{ id: "c1", sourceFactId: "f1" }, { id: "c2", sourceFactId: "f2" }, { id: "c3", sourceFactId: null }], claimVerification: [{ claimId: "c3", url: "https://c.org/z", sourceName: "C", sources: [{ url: "https://c.org/z", title: "C" }] }, { claimId: "c1", url: null, sourceName: "preferred source (research-lite)" }] };
  assertEquals(claimSourceList(doc, research).map((s) => s.url), ["https://a.org/x", "https://b.org/y", "https://c.org/z"]);
});

import { titleCase, stripInstructionEchoes, tagsInVideo } from "../../src/lib/publishText.js";
Deno.test("publish UX: Title Case chapters, no instruction echoes, tags only from the video, description toggles", () => {
  assertEquals(titleCase("Night By the Fire"), "Night by the Fire");
  assertEquals(titleCase("what the spear really says"), "What the Spear Really Says");
  assertEquals(titleCase("the 300,000-year-old DNA test"), "The 300,000-year-old DNA Test");
  assertEquals(stripInstructionEchoes('First para.\n\nEnd with "🎬 Made with tryzyvo.com — turn any idea"\n\nThird.'), "First para.\n\nThird.");
  const corpus = "Archaeologists at Schöningen found spears. Archaeologist Ian Hodder put it plainly. Early hunters ran prey down.";
  assertEquals(tagsInVideo(["Schöningen spears", "Ian Hodder archaeology", "Louis Binford", "archaeology", "#Archaeology", "#HumanEvolution", "persistence hunting"], corpus), ["Schöningen spears", "Ian Hodder archaeology", "archaeology", "#Archaeology"]);
  const meta = { hook: "Intro.", chapters: [{ ms: 0, title: "A B" }, { ms: 30000, title: "C D" }, { ms: 60000, title: "E F" }], sources: [{ url: "https://nature.com/x" }], includeCredit: true, disclaimer: "D.", hashtags: ["#One", "#Two", "#Three"] };
  const on = composeDescription(meta), off = composeDescription({ ...meta, includeChapters: false, includeSources: false, includeCredit: false });
  assert(on.includes("0:30 C D") && on.includes("Sources:") && on.includes(CREDIT_LINE) && on.trim().endsWith("#One #Two #Three"));
  assert(!off.includes("0:30") && !off.includes("Sources:") && !off.includes("tryzyvo") && off.includes("D.") && off.includes("#One"));
});
