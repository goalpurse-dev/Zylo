// The strict kit check (the owner's rule of 2026-11-04): custom topics Cutaway can't build are refused up front, before
// any charge or wait, on the page and on the server. The topics are real customer topics that failed after launch.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { cantBuildMessage, kitCheck, KIT_BEST, KIT_EXAMPLES } from "../supabase/functions/_shared/cutaway/topics.js";
import { KIT_SYSTEM } from "../supabase/functions/_shared/cutaway/kitCheck.js";
import { quoteTopic } from "../supabase/functions/_shared/cutaway/quote.js";

test("strict kit check: the failed customer topics are refused instantly, with a label", () => {
  const cases = {
    "How four-wheel steering turns a giant car like a compact": "engine and car parts",
    "How a chainsaw clutch stops you from dying": "engine and car parts",
    "How air suspension (bagged cars) works the simple way": "engine and car parts",
    "How a puddle of mud can become a semiconductor factory.": "electronics",
    "How a car engine works": "engine and car parts",
    "gearbox": "engine and car parts",
    "How an elevator works": "machines and vehicles",
    "airplane": "machines and vehicles",
    "cuisiniere": "home appliances",
    "washing machine": "home appliances",
    "how a smartphone battery works": "electronics",
    "fish": "animals",
    "how the heart pumps blood": "the human body",
    "a black hole": "space and the sky",
    "bitcoin": "ideas like money or history",
    "how cars work": "engine and car parts",
  };
  for (const [topic, label] of Object.entries(cases)) {
    const k = kitCheck(topic);
    assert.equal(k.verdict, "no", topic);
    assert.equal(k.missing[0], label, topic);
  }
});

test("strict kit check: the kit's world passes without any Claude call; the rest goes to Haiku", () => {
  for (const t of ["septic tank", "sump pump", "pond", "how does a dry well work", "rain barrel", "A Shelter in the Garden", "how water gets to your house", "a driveway that drains rain away from the cars", "retaining wall"]) assert.equal(kitCheck(t).verdict, "yes", t);
  for (const t of ["nuclear bunker", "ancient bridge", "How to Build a Skyscraper", "lightning rod", "how Elon Musk builds rockets".replace("rockets", "things")]) assert.equal(kitCheck(t).verdict, "unsure", t);
  // premade topics are never refused, even with a vehicle word in them
  assert.equal(kitCheck("car wash").verdict, "yes");
  assert.equal(quoteTopic("Car wash", 30, ["car_wash"]).kind, "premade");
});

test("strict kit check: the message, the hint and the Haiku prompt", () => {
  assert.equal(cantBuildMessage(["engine and car parts"]), "Cutaway can't build engine and car parts yet. It works best for yards, houses, streets, water and pipes.");
  assert.equal(cantBuildMessage([]), "Cutaway can't build this kind of topic yet. It works best for yards, houses, streets, water and pipes.");
  assert.equal(KIT_BEST, "yards, houses, streets, water and pipes");
  assert.deepEqual([...KIT_EXAMPLES], ["septic tank", "sump pump", "pond"]);
  assert.match(KIT_SYSTEM, /ONLY when the topic fits that world/);
  assert.match(KIT_SYSTEM, /When in doubt, answer false/);
  const builder = fs.readFileSync(new URL("../src/components/viral-tools/cutaway-explainer/CutawayBuilder.jsx", import.meta.url), "utf8");
  assert.match(builder, /data-testid="cutaway-works-best"/);
  assert.match(builder, /cantBuildMessage\(shownCantBuild\.missing\)/);
  assert.match(builder, /if \(localNo\) \{ setCantBuild/);
  const api = fs.readFileSync(new URL("../supabase/functions/cutaway-api/index.ts", import.meta.url), "utf8");
  assert.match(api, /new ApiError\("CANT_BUILD", cantBuildMessage\(quote\.missing\)/);
});
