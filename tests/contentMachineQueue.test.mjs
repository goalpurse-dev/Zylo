// Content Machine: the Queue holds every unposted slideshow from ANY day, the All tab every slideshow ever made
// (owner, 2026-10-23: slideshows "disappeared" when the day changed).
import test from "node:test";
import assert from "node:assert/strict";
import { apiFor, depsFor, drain, fakeProviders, fakeWorld, startRun } from "./helpers/contentMachineFakes.mjs";
import { dayLabel, groupByDay, queueView } from "../src/pages/admin/contentMachine/queueView.js";
import { ideaState } from "../supabase/functions/_shared/contentMachine/ideaState.js";

const NOW = new Date("2026-10-23T09:00:00Z");   // 12:00 in Helsinki

/** Dry-run slideshows made 3 days ago, yesterday and today (nothing is spent). */
async function threeDays() {
  const world = fakeWorld();
  const made = {};
  for (const [name, at] of [["threeDaysAgo", "2026-10-20T08:00:00Z"], ["yesterday", "2026-10-22T08:00:00Z"], ["today", "2026-10-23T07:00:00Z"]]) {
    world.clock.now = new Date(at);
    const run = await startRun(world, { dry: true, count: 1 });
    await drain(world, depsFor(world, fakeProviders(world)));
    made[name] = world.ideas.find((i) => i.run_id === run.id);
    // drain() moves the clock while it waits; the slideshow keeps the day it was made.
    made[name].created_at = at;
    made[name].title = `Slideshow made ${name}`;
  }
  world.clock.now = NOW;
  return { world, made };
}

test("the Queue keeps unposted slideshows from yesterday and 3 days ago, grouped by day, counts over all days", async () => {
  const { world, made } = await threeDays();
  const { call } = apiFor(world);
  for (const i of Object.values(made)) { assert.equal(i.status, "done", `${i.title}: finished`); assert.equal(i.dry_run, true); }
  const r = await call({ action: "ideas", queue: true, account: "creator", limit: 200 });
  assert.equal(r.ok, true, r.message);
  assert.deepEqual(r.data.ideas.map((i) => i.id), [made.today.id, made.yesterday.id, made.threeDaysAgo.id], "every day, newest first");
  const { shown, counts } = queueView(r.data.ideas, "");
  assert.equal(shown.length, 3);
  assert.equal(counts[""], 3);
  assert.equal(counts.ready, 3);
  const days = groupByDay(shown, NOW, "Europe/Helsinki");
  assert.deepEqual(days.map((d) => [d.label, d.ideas.length]), [["Today", 1], ["Yesterday", 1], ["Oct 20", 1]]);
  assert.ok(r.data.ideas.every((i) => ideaState(i) === "not_posted"));

  // Posted leaves the Queue; Rejected is hidden by default but counted and pickable.
  const posted = await call({ action: "markPosted", ideaId: made.threeDaysAgo.id, platform: "tiktok", postUrl: "https://www.tiktok.com/@zyvo/photo/1", postedAt: "2026-10-21T10:00" });
  assert.equal(posted.ok, true, posted.message);
  await call({ action: "setIdeaStatus", id: made.yesterday.id, status: "rejected" });
  const q2 = (await call({ action: "ideas", queue: true, account: "creator" })).data.ideas;
  assert.ok(!q2.some((i) => i.id === made.threeDaysAgo.id), "posted is not in the Queue");
  const v2 = queueView(q2, "");
  assert.deepEqual(v2.shown.map((i) => i.id), [made.today.id], "rejected is hidden by default");
  assert.equal(v2.counts.rejected, 1);
  assert.deepEqual(queueView(q2, "rejected").shown.map((i) => i.id), [made.yesterday.id]);
});

test("the All tab: every slideshow with its status (Posted + where and when, Not posted, Rejected), filters, Undo posted", async () => {
  const { world, made } = await threeDays();
  const { call } = apiFor(world);
  await call({ action: "markPosted", ideaId: made.threeDaysAgo.id, platform: "tiktok", postUrl: "https://www.tiktok.com/@zyvo/photo/1", postedAt: "2026-10-21T10:00" });
  await call({ action: "markPosted", ideaId: made.threeDaysAgo.id, platform: "instagram", postUrl: "https://www.instagram.com/p/abc", postedAt: "2026-10-21T11:00" });
  await call({ action: "setIdeaStatus", id: made.yesterday.id, status: "rejected" });

  const all = (await call({ action: "ideas", limit: 60 })).data;
  const by = Object.fromEntries(all.ideas.map((i) => [i.id, i]));
  assert.equal(all.ideas.length, 3, "nothing hidden");
  assert.equal(ideaState(by[made.threeDaysAgo.id]), "posted");
  assert.deepEqual(by[made.threeDaysAgo.id].posts.map((p) => p.platform), ["tiktok", "instagram"], "the platforms, first post first");
  assert.equal(by[made.threeDaysAgo.id].posts[0].posted_at, "2026-10-21T07:00:00.000Z");
  assert.equal(ideaState(by[made.yesterday.id]), "rejected");
  assert.equal(ideaState(by[made.today.id]), "not_posted");

  const ids = async (body) => (await call({ action: "ideas", limit: 60, ...body })).data.ideas.map((i) => i.id);
  assert.deepEqual(await ids({ state: "posted" }), [made.threeDaysAgo.id]);
  assert.deepEqual(await ids({ state: "not_posted" }), [made.today.id]);
  assert.deepEqual(await ids({ state: "rejected" }), [made.yesterday.id]);
  assert.deepEqual(await ids({ state: "flagged" }), []);
  assert.deepEqual(await ids({ from: "2026-10-20", to: "2026-10-21" }), [made.threeDaysAgo.id], "date range");
  assert.deepEqual(await ids({ q: "made YESTERDAY" }), [made.yesterday.id], "title search, any case");
  assert.deepEqual(await ids({ q: "Slideshow made" }), all.ideas.map((i) => i.id));
  assert.deepEqual(await ids({ state: "nonsense" }), all.ideas.map((i) => i.id), "an unknown status filter is ignored");

  // Paging: "Show older" asks for the ones made before the oldest it has.
  const page = (await call({ action: "ideas", limit: 2 })).data;
  assert.equal(page.more, true);
  assert.deepEqual(await ids({ limit: 2, before: page.oldest }), [made.threeDaysAgo.id]);

  // Undo posted: back to Not posted and into the Queue; its posts are gone.
  const undo = await call({ action: "unmarkPosted", ideaId: made.threeDaysAgo.id });
  assert.equal(undo.ok, true, undo.message);
  assert.deepEqual(undo.data.removed.sort(), ["instagram", "tiktok"]);
  assert.equal(world.posts.filter((p) => p.idea_id === made.threeDaysAgo.id).length, 0);
  const back = (await call({ action: "ideas", queue: true, account: "creator" })).data.ideas.find((i) => i.id === made.threeDaysAgo.id);
  assert.equal(ideaState(back), "not_posted");
  assert.ok(world.audit.some((a) => a.action === "post.unmark"));
  assert.equal((await call({ action: "unmarkPosted", ideaId: made.today.id })).ok, false, "only a posted slideshow");
});

test("day headers: Today, Yesterday, then the date (Helsinki days, the year only when it isn't this year)", () => {
  const now = new Date("2026-10-23T21:30:00Z");   // already Oct 24, 00:30 in Helsinki
  assert.equal(dayLabel("2026-10-24", now), "Today");
  assert.equal(dayLabel("2026-10-23", now), "Yesterday");
  assert.equal(dayLabel("2026-10-21", now), "Oct 21");
  assert.equal(dayLabel("2025-12-30", now), "Dec 30, 2025");
  const g = groupByDay([{ id: "a", created_at: "2026-10-23T21:10:00Z" }, { id: "b", created_at: "2026-10-23T20:50:00Z" }], now);
  assert.deepEqual(g.map((d) => d.label), ["Today", "Yesterday"], "split at Helsinki midnight, not UTC");
});
