// Phase 0 of the any-topic plan (the owner's go of 2026-11-04): topic categories stay refused until each passes its
// proof and is opened (cutaway_settings.categories); the owner tests every one; an open category closes itself again.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { CATEGORIES, kitCheck, openCategories } from "../supabase/functions/_shared/cutaway/topics.js";
import { kitCheckRequest, KIT_SYSTEM } from "../supabase/functions/_shared/cutaway/kitCheck.js";
import { quoteTopic } from "../supabase/functions/_shared/cutaway/quote.js";

test("categories: each refused topic names its category, and opening it lets the topic through", () => {
  const cases = { "How a stove works": "appliances", "washing machine": "appliances", "How four-wheel steering turns a giant car like a compact": "cars",
    "How a chainsaw clutch stops you from dying": "machines", "How an elevator works": "machines", "airplane": "vehicles",
    "How a puddle of mud can become a semiconductor factory.": "electronics", "How a stent opens a clogged heart artery": "body", "fish": "animals" };
  for (const [topic, key] of Object.entries(cases)) {
    const shut = kitCheck(topic);
    assert.equal(shut.verdict, "no", topic);
    assert.equal(shut.category, key, topic);
    assert.equal(kitCheck(topic, { open: [key] }).verdict, "yes", `${topic} opens with ${key}`);
    assert.equal(quoteTopic(topic, 30, [], [key]).check.verdict, "yes", `${topic}: the page's quote opens too`);
  }
  // a topic in two categories needs both open (a fridge's chip: appliances and electronics)
  assert.equal(kitCheck("the chip in a smart fridge", { open: ["appliances"] }).verdict, "no");
  assert.equal(kitCheck("the chip in a smart fridge", { open: ["appliances", "electronics"] }).verdict, "yes");
  // an engine in a machine or a vehicle belongs to that machine or vehicle, not to cars
  assert.equal(kitCheck("How a jet engine works").category, "vehicles");
  assert.equal(kitCheck("How a lawnmower engine starts").category, "machines");
  assert.equal(kitCheck("How a car engine works").category, "cars");
});

test("categories: the kit's own world is 'home' and needs no switch; unknown topics still go to Haiku", () => {
  assert.deepEqual([kitCheck("septic tank").verdict, kitCheck("septic tank").category], ["yes", "home"]);
  assert.deepEqual([kitCheck("a driveway that drains rain away from the cars").verdict, kitCheck("a driveway that drains rain away from the cars").category], ["yes", "home"]);
  assert.equal(kitCheck("Roof").verdict, "yes");
  assert.equal(kitCheck("Traffic light").verdict, "yes");
  assert.equal(kitCheck("nuclear bunker").verdict, "unsure");
  assert.equal(kitCheck("toilet").verdict, "unsure");
});

test("categories: only an explicit 'open' opens one (fails closed)", () => {
  assert.deepEqual(openCategories(null), []);
  assert.deepEqual(openCategories({ appliances: "open", cars: "beta", machines: "refused", nope: "open" }), ["appliances"]);
  assert.equal(CATEGORIES.length, 9);
});

test("categories: Haiku hears which categories are open, and only those", () => {
  assert.equal(kitCheckRequest("a stove").system, KIT_SYSTEM);
  const s = kitCheckRequest("a stove", ["appliances"]).system;
  assert.match(s, /ALSO BUILDABLE NOW[^\n]*home appliances/);
  assert.doesNotMatch(s, /ALSO BUILDABLE NOW[^\n]*cars and their parts/);
});

test("categories: the server reads them (owner sees all), the page asks for them, the watchdog closes a failing one", () => {
  const api = fs.readFileSync(new URL("../supabase/functions/cutaway-api/index.ts", import.meta.url), "utf8");
  assert.match(api, /async function openFor\(owner: boolean\)/);
  assert.match(api, /if \(owner\) return CATEGORIES\.map/);
  assert.match(api, /serverQuote\(who\.user\.id, topic, lengthSec, \{ log: [^}]*open: await openFor\(Boolean\(who\.owner\)\) \}\)/);
  assert.match(api, /openCategories: open,/);
  const dog = fs.readFileSync(new URL("../supabase/functions/cutaway-watchdog/index.ts", import.meta.url), "utf8");
  assert.match(dog, /runs\.length >= 3 && rate > 0\.3/);
  assert.match(dog, /\[key\]: "refused"/);
  const page = fs.readFileSync(new URL("../src/components/viral-tools/cutaway-explainer/CutawayBuilder.jsx", import.meta.url), "utf8");
  assert.match(page, /quoteTopic\(topic, lengthSec, approved \?\? \[\], openCategories\)/);
  const sql = fs.readFileSync(new URL("../supabase/migrations/20261203100000_cutaway_topic_categories.sql", import.meta.url), "utf8");
  assert.match(sql, /ADD COLUMN IF NOT EXISTS categories jsonb NOT NULL DEFAULT '\{\}'::jsonb/);
});
