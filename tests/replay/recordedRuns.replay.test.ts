// deno-lint-ignore-file no-explicit-any
// Replays every RECORDED paid run (fixtures produced by
// scripts/phase1FinalSnapshotRun.mjs from a run made with
// LONG_FORM_SCRIPT_RECORD_CASSETTES=true) through the current local code,
// offline. Unchanged code must reproduce the recorded outcome exactly; after
// a fix, the same cassette shows what the fix changes — for free.
import { assertEquals } from "jsr:@std/assert@1";
import { seedDb, runPipeline, playCassette } from "./harness.ts";

const dir = new URL("../fixtures/stickman/replay/", import.meta.url);
const recorded: any[] = [];
for await (const f of Deno.readDir(dir)) {
  if (!f.name.endsWith(".json")) continue;
  const fixture = JSON.parse(await Deno.readTextFile(new URL(f.name, dir)));
  if (fixture.cassettes?.length) recorded.push(fixture);
}

export function flattenCassettes(fixture: any) {
  const files = [...fixture.cassettes].sort((a, b) => String(a.recordedAt).localeCompare(String(b.recordedAt)));
  let seq = 0;
  return files.flatMap((file: any) => file.entries.map((e: any) => ({ ...e, seq: seq++ })));
}

for (const fixture of recorded) {
  Deno.test(`recorded run "${fixture.name}" replays offline to its recorded outcome`, async () => {
    const player = playCassette(flattenCassettes(fixture));
    const { db, scriptId } = seedDb({ project: fixture.project, storyPlanVersion: fixture.storyPlanVersion, researchVersion: fixture.researchVersion, profile: fixture.profile });
    try {
      const { row, stages } = await runPipeline(db, scriptId);
      console.log(`${fixture.name}: ${stages.join(" > ")} -> ${row.status} (critic ${row.critic_result?.overallScore}, words ${row.script_document?.actualWords})`);
      assertEquals(row.status, fixture.script.status);
      assertEquals(row.critic_result?.overallScore ?? null, fixture.script.critic_result?.overallScore ?? null);
      assertEquals(row.script_document?.actualWords ?? null, fixture.script.script_document?.actualWords ?? null);
    } finally {
      player.restore();
    }
  });
}

if (!recorded.length) {
  Deno.test("recorded runs: none recorded yet", () => {});
}
