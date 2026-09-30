// Results page for hands-on test #2 follow-ups: clip timing, picture check,
// series bible + plates + continuity, and the new final screen extras.
//   node scripts/fruit-story/pageRound6.mjs <outFile> <assetsDir>
// assetsDir holds the downloaded pictures, frames, UI shots and the final mp4
// (published next to the page as dinner-final.mp4).
import fs from "fs";
import path from "path";
import { renderResultsPage } from "./resultsPage.mjs";
import { ROOT } from "./lib.mjs";

const [outFile, dir] = process.argv.slice(2);
const a = (f) => path.join(dir, f);
const read = (f) => JSON.parse(fs.readFileSync(`${ROOT}/data/fruit-phase3/${f}`, "utf8"));
const B = read("3k-results-B.json");
const recheck = read("3k-recheck.json");
const fin = read("3k-results.json").final;
const bible = B.series.bible;
const ep = B.episode;
const names = { kai: "Kai Coconut", maya: "Maya Mango", piper: "Piper Pine" };
const usd = (n) => `$${n.toFixed(4)}`;

const html = await renderResultsPage({
  title: "Fruit Test 2 Fixes",
  intro: "Follow-ups from your second hands-on test (series episode 1, \"Caught at Dinner\"). Everything is committed locally; nothing is pushed. FRUIT_PAID_CALLS is still on for your testing. Stage 3k spent <b>$0.3058</b>; Phase 3 is at <b>$3.8720 of $4.00</b> (the 30 s story, $1.78, is outside it).",
  stats: [
    { value: "≤ 20 s", label: "wait for a finished clip to be picked up (was up to 60 s: nothing arrived by webhook, the checker ran once a minute)", tone: "good" },
    { value: "6 at once", label: "clips and pictures in flight per story (was 3: clips 4–6 waited 55–102 s for a free slot)", tone: "good" },
    { value: "≈ $0.001", label: "per picture check (gpt-5-mini vision, logged), about 7 s per picture" },
    { value: "$0.07", label: "spent on 2 needless redraws before the check knew Kai is a GREEN coconut (fixed)", tone: "warn" },
  ],
  sections: [
    {
      heading: "1. Why clips were slow (read from the job rows, $0)",
      text: "Each clip goes through 4 steps: queued → sent to Runware (ours) → Runware renders → we pick up the result → stored (ours). The times below come from <code>fruit_jobs</code> (created, submitted, provider done, finished). Runware's render time is theirs; the rest is ours.",
      layout: "list",
      cards: [
        {
          title: "Caught at Dinner (your test): 3 clips, 3 min 50 s from send to pickup",
          tone: "warn",
          body: [
            "<b>Ours, sending</b>: 6–11 s after the click (19:30:05 → 19:30:12–16).",
            "<b>Runware + pickup</b>: 230 s for all three. No webhook arrived; all three were picked up together at 19:34:03–06 by the checker, which ran <b>once a minute</b>, so up to 60 s of that was waiting on us.",
            "<b>Ours, storing</b>: 1–2 s.",
          ],
        },
        {
          title: "The Surprise Wedding Switch and Ken Reads Everything: 6 clips, a second wave",
          tone: "warn",
          body: [
            "Only 3 clips could run at once. In the wedding story clips 4–6 sat queued for <b>100–102 s</b> until the first three finished (Ken: <b>55–57 s</b>).",
            "Runware took 93–110 s per clip for the wedding and 48–63 s for Ken, so the second wave nearly doubled the wait.",
          ],
        },
        {
          title: "Caught At The Bar (after the fixes, pictures): the webhook works for pictures",
          tone: "good",
          body: [
            "Sent in 2 s, back by <b>webhook</b> in 6–20 s, then 6–8 s for the new picture check and storing.",
            "Every result now records how it arrived (<code>_via</code>: webhook or poll), so your next test will show whether clip webhooks arrive at all.",
          ],
        },
        {
          title: "What changed",
          body: [
            "<b>6 clips and 6 pictures in flight per story</b> (was 3): a 6-scene story renders in one wave.",
            "<b>The checker runs every 20 s</b> (pg_cron, was every minute) and asks Runware directly.",
            "<b>After 4 min</b> without an answer it asks Runware about the task; if Runware lost it, the clip is <b>sent again once</b>. After 12 min it stops and <b>refunds</b>: “The video service didn't finish this in time, so we stopped it and refunded your credits. Tap Retry: it usually works on the next try.” (engine tests cover resend-once and refund.)",
            "<b>The screen never looks frozen</b>: each scene shows a running timer, after 2 min “Taking a bit longer than usual, hang tight…”, and each clip shows “Just finished” the moment it lands.",
          ],
        },
      ],
    },
    {
      heading: "2. Picture check",
      text: "After each scene picture is stored, gpt-5-mini looks at it with the exact fruit looks from the character library and answers: is every character there, does each have their fruit head, how many figures, how many human heads. A failed picture is redrawn <b>once at our cost</b>; if the redraw also fails, the scene shows a warning and a <b>free regenerate (once)</b>. Every background character is now named with their fruit head in the picture prompt. A check that can't run never blocks the story.",
      cards: [
        {
          image: a("A1.jpg"), tone: "bad",
          title: "Caught: Caught at Dinner, scene 1 (Piper drawn human)",
          meta: [["First check", "Piper Pine is drawn without their pineapple head; 1 human head · $0.0013"], ["With library looks", `${recheck[0].problems.join("; ")} · ${usd(recheck[0].costUsd)}`]],
          note: "Your video was made before the check existed, so this one went through (and became its cover: now covers skip flagged pictures).",
        },
        {
          image: a("kai-check.jpg"), tone: "good",
          title: "False alarm, fixed: Kai is a green young coconut",
          body: [
            "Told only “coconut”, the check expected a brown coconut and failed Kai 3 times (“green fruit head instead of a coconut”). Two of those were redrawn at our cost: <b>$0.07 wasted</b>.",
            "Now the check and the picture prompts read each look from the library (<code>fruitLooks.js</code>, kept in sync by a test): “a green young coconut head”, “a pineapple head with a crown of green leaves (part of the fruit, not hair)”.",
            "Re-checked with the fix: Kai passes in all 5 pictures shown (library pose on the left), Piper's human head is still caught.",
          ],
        },
        {
          title: "All checks this round",
          body: recheck.map((r) => `<b>${r.story}, scene ${r.idx + 1}</b>: ${r.ok ? "passes" : r.problems.join("; ")} <i>(was ${r.before === "none" ? "not checked" : r.before}; ${usd(r.costUsd)})</i>`),
          meta: [["Check cost", "$0.0008–0.0015 per picture"], ["Time", "about 7 s per picture"], ["Logged", "fruit_ai_calls, purpose picture_check"]],
        },
      ],
    },
    {
      heading: "3. Series bible: “Two Timing Tide”",
      text: "The series planner now writes a bible that every episode receives: fixed places, a role, a signature prop and a catchphrase per character, and clues planted in one episode and paid off in a later one. Casting and places follow the outfits (Kai the lifeguard gets a beach bar and a lifeguard tower). The first time an episode uses a place, an empty set of it is drawn at our cost (about $0.035) and passed to every picture after the character pictures.",
      layout: "list",
      cards: [
        {
          title: `${B.series.title}: ${B.series.logline}`,
          body: [
            ...bible.characters.map((c) => `<b>${names[c.id]}</b>: ${c.role} · prop: ${c.prop} · says “${c.catchphrase}”`),
            ...bible.locations.map((l) => `<b>Place ${l.id}</b>: ${l.description}${l.id === "s1" ? " <i>(empty set drawn for episode 1)</i>" : " <i>(drawn when first used)</i>"}`),
            ...bible.setups.map((s) => `<b>Clue</b> planted in ep ${s.plantedIn}, paid off in ep ${s.paidOffIn}: ${s.clue}`),
          ],
          prompt: bible.text,
        },
      ],
    },
    {
      heading: "Episode 1 with the bible: “Caught At The Bar” (pictures only)",
      cards: [
        { image: a("plate-s1.jpg"), title: "Empty set of place s1 (the beach bar)", meta: [["Cost", "$0.0336, ours"], ["Stored", "series/…/plate-s1-9x16.jpg, reused by every episode"]] },
        { image: a("B1.jpg"), title: `Scene 1: “${ep.scenes[0].line}”`, meta: [["Check", "passed"], ["References", "Maya, Kai, then the empty bar"]] },
        { image: a("B2.jpg"), title: `Scene 2: “${ep.scenes[1].line}”`, meta: [["Check", "Kai false alarm, redrawn once at our cost, then passed"], ["References", "Piper, Maya, Kai, then the empty bar"]] },
        {
          title: "Roles in this story, and where it ends (sent to episode 2's planner)",
          body: [
            ...Object.entries(ep.castRoles).map(([id, r]) => `<b>${names[id]}</b>: ${r} <i>(shown on the cast chips instead of library tags)</i>`),
            ...ep.endState.characters.map((c) => `<b>${names[c.id]}</b> ends ${c.where}, ${c.feeling}`),
            `<b>Props in play</b>: ${ep.endState.props.join(", ")}`,
          ],
        },
        { image: a("ui-desktop-bible.jpg"), title: "Series page: the bible, read-only, under the episode plan" },
      ],
    },
    {
      heading: "4. The new final screen: “Caught at Dinner”, re-rendered",
      text: "Part 1 for the first 1.5 s and the end card for the last 2 s are burned in by the Fly worker. They're on by default for episodes, off for single videos, and can be switched on the final screen. The cover is the most dramatic scene with “EPISODE N” and the title in a fixed layout (ffmpeg, never AI text), downloadable at 1080×1920. The post text comes from the small model, free for the user.",
      cards: [
        { video: "dinner-final.mp4", title: "Final video (12.5 s): Part 1 and end card", meta: [["Fly render", "cached word timings, about $0.001"]] },
        { image: a("f-part.jpg"), title: "0.7 s: “Part 1”" },
        { image: a("f-end.jpg"), title: "Last 2 s: “Part 2: The Blabbing Sister / Follow for more”" },
        { image: a("dinner-cover2.jpg"), title: "Cover (1080×1920)", note: "This cover used scene 1, the picture the check flagged. New finals skip flagged pictures for the cover (committed and deployed)." },
        {
          title: "Post text (upload package)",
          body: [
            `<b>Title</b>: ${fin.package.title}`,
            `<b>Caption</b>: ${fin.package.caption}`,
            `<b>Pinned comment</b>: ${fin.package.pinnedComment}`,
            `<b>Hashtags</b>: ${fin.package.hashtags.join(" ")}`,
          ],
          meta: [["Cost", "$0.0019, logged (upload_package), saved with the story"], ["Rule", "the title must be a new hook, never the video title"]],
        },
        { image: a("ui-desktop-final.jpg"), title: "Final screen (desktop): cover download and Post it with copy buttons" },
        { image: a("ui-phone-final.jpg"), title: "Final screen (phone)" },
      ],
    },
  ],
  decisions: [
    "<b>Ready for your next hands-on test</b> on the local dev server. Episodes now have a <b>Watch</b> button on the series page for any made episode.",
    "<b>Budget</b>: $0.13 left of the $4.00. The next paid check will need a new budget line from you.",
    "<b>Clip webhooks</b>: none arrived in your test. Clips now record whether they came by webhook or by the 20-second checker. If your next test still shows only “poll”, I'll look at Runware's webhook settings for video (reading only, $0).",
    "<b>Caught at Dinner's cover</b> still shows the flagged picture. Re-rendering it costs about $0.001. Say the word if you want it redone.",
  ],
});
fs.writeFileSync(outFile, html);
console.log("written", outFile, (html.length / 1024).toFixed(0) + " KB");
