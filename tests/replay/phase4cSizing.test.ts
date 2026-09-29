// deno-lint-ignore-file no-explicit-any
// Phase 4c — real-duration sizing rule for the director. Offline proof on the
// recorded (COST_CAP) run: how many of its code splits came from groupings the
// new rule forbids (chunks adding up to > 6.0 s, or pairing a >= 3.5 s chunk).
import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { buildWordStream, chunkWindows, planWindows, windowUserPrompt, directorSystemPrompt, buildBibleIndex, parseBeatsOutput, normalizeBeat, chunkRangesToWords, autoSplitBeats } from "../../supabase/functions/_shared/stickman/beatDirector.ts";

const read = async (p: string) => JSON.parse(await Deno.readTextFile(new URL(p, import.meta.url)));
const run = await read("../fixtures/stickman/beats/myth-vs-reality.phase4c.json");
const narration = await read("../fixtures/stickman/audio/myth-vs-reality/narration.json");
const stream = buildWordStream(run.segments, narration);
const windows = chunkWindows(stream, planWindows(stream));
const index = buildBibleIndex(run.bible);

Deno.test("the window input gives each chunk's real duration and marks >= 3.5 s chunks 'single'; the rule is in the prompt", () => {
  const p = windowUserPrompt(stream, windows[1], []);
  const lines = p.split("\n").filter((l) => /^C\d+ \[/.test(l));
  for (const l of lines) assert(/s long, \d+w/.test(l), l);
  for (const c of windows[1].chunks) if ((c.endMs - c.startMs) / 1000 >= 3.5) assertStringIncludes(lines.find((l) => l.startsWith(`C${c.index} [`))!, ", single]");
  assertStringIncludes(directorSystemPrompt(index, run.bible, run.callback), "A beat's chunks must add up to 6.0 s or less (hard limit 6.5 s); prefer 1 chunk when a single chunk is 3.5 s or longer");
});

Deno.test("recorded run: the code splits that the new sizing rule would have prevented", () => {
  const mains = run.cassette.entries.map((e: any) => ({ user: e.request.messages[0].content, input: e.response.content.find((x: any) => x.type === "tool_use").input })).filter((e: any) => !e.user.includes("NEEDS CONTRACT") && !e.user.includes("FAILED VALIDATION"));
  let splits = 0, forbidden = 0, beatsSeen = 0;
  mains.forEach((m: any, w: number) => {
    const win = windows[w];
    const beats = chunkRangesToWords(parseBeatsOutput(m.input).beats.map((b: any) => normalizeBeat(b, index)), win).beats;
    beatsSeen += beats.length;
    const byIndex = new Map(win.chunks.map((c) => [c.index, c]));
    for (const b of beats) {
      const cs = Array.from({ length: b.endChunk - b.startChunk + 1 }, (_, k) => byIndex.get(b.startChunk + k)!);
      const total = cs.reduce((s, c) => s + (c.endMs - c.startMs), 0) / 1000;
      if (cs.length > 1 && (total > 6.0 || cs.some((c) => (c.endMs - c.startMs) / 1000 >= 3.5))) forbidden += 1;
    }
    splits += autoSplitBeats(beats, win, stream).splits;
  });
  console.log(`recorded windows 1-3: ${beatsSeen} beats from the model; code split ${splits}; groupings the new rule forbids: ${forbidden}`);
  assert(forbidden > 0 && splits > 0);
  assertEquals(typeof forbidden, "number");
});
