// node --test tests/inThisTownCraft.test.mjs   (free: THE WRITER'S CRAFT, owner 2026-11-18: the six rule tests, the
// twist rotation per user, the craft rules in the prompts, the free craft checks)
import test from "node:test";
import assert from "node:assert/strict";
import { RULE_TESTS, RULE_MIN, ruleScore, pickTwist, twistBlock, TWIST_FAMILIES, planCraftProblems, craftProblems, CRAFT_PLAN_TEXT, CRAFT_LINES_TEXT } from "../supabase/functions/_shared/blockyWorlds/craft.js";
import { readIdeaScores, ruleBar, topIdeas } from "../supabase/functions/_shared/blockyWorlds/ideaEngine.js";
import { HYBRID_PLAN_SYSTEM, HYBRID_LINES_SYSTEM, hybridPlanSchema, planText, planCard, planNotes } from "../supabase/functions/_shared/blockyWorlds/hybrid.js";
import { SCRIPT_SYSTEM, scriptPrompt } from "../supabase/functions/_shared/blockyWorlds/script.js";
import { isShownNote } from "../supabase/functions/_shared/blockyWorlds/paidGate.js";

test("the six rule tests: 0-2 each, a rule is kept at 9 of 12", () => {
  assert.deepEqual(RULE_TESTS.map((t) => t.id), ["clear_3s", "object", "daily_cost", "can_flip", "comment_bait", "fresh"]);
  assert.equal(RULE_MIN, 9);
  assert.equal(ruleScore({ clear_3s: 2, object: 2, daily_cost: 2, can_flip: 2, comment_bait: 2, fresh: 2 }), 12);
  assert.equal(ruleScore({ clear_3s: 5, object: -1 }), 2, "clamped to 0-2");
});

test("the rule bar: the idea judge scores the rule tests; only 9+ are kept (the best one when none passes)", () => {
  const row = (n, rt) => ({ n, hook: 7, rule: 7, visual: 7, twist: 7, fit: 7, fresh: 7, rt_clear_3s: rt, rt_object: rt, rt_daily_cost: rt, rt_can_flip: rt, rt_comment_bait: rt, rt_fresh: rt - 1 });
  const ideas = [{ hook: "a", rule: "In this town, A." }, { hook: "b", rule: "In this town, B." }, { hook: "c", rule: "In this town, C." }];
  const sc = readIdeaScores({ scores: [row(1, 2), row(2, 1), row(3, 2)] }, 3);
  assert.deepEqual(sc.map((s) => s.ruleScore), [11, 5, 11]);
  const kept = ruleBar(topIdeas(ideas, sc, 3));
  assert.deepEqual(kept.map((x) => x.hook).sort(), ["a", "c"]);
  assert.equal(kept[0].rule.startsWith("In this town"), true, "the rule text is never overwritten by its score");
  const none = ruleBar(topIdeas(ideas, readIdeaScores({ scores: [row(1, 1), row(2, 1), row(3, 1)] }, 3), 3));
  assert.equal(none.length, 1);
});

test("the twist rotation: never a family from the user's last 3, the reveal % away from the last 2", () => {
  const first = pickTwist([], { seed: 3 });
  assert.ok(TWIST_FAMILIES.includes(first.family));
  const hist = [{ twistFamily: "T1", twistPct: 62 }, { twistFamily: "T3", twistPct: 67 }, { twistFamily: "T2", twistPct: 52 }, { twistFamily: "T4", twistPct: 72 }];
  for (let seed = 0; seed < 30; seed++) {
    const p = pickTwist(hist, { seed });
    assert.ok(!["T1", "T3", "T2"].includes(p.family), `seed ${seed}: ${p.family}`);
    assert.equal(p.family, "T6", "the family used longest ago (never used) comes first");
    assert.ok(Math.abs(p.pct - 62) >= 8 && Math.abs(p.pct - 67) >= 8, `seed ${seed}: ${p.pct}`);
    assert.ok(p.pct >= 49 && p.pct <= 78);
  }
  assert.match(twistBlock({ family: "T4", pct: 57 }), /family T4 "Wording loophole".*twistType to T4.*about 57%/s);
});

test("the craft rules are in the planner, the line writer and the idea-card writer", () => {
  assert.ok(HYBRID_PLAN_SYSTEM.includes(CRAFT_PLAN_TEXT));
  assert.ok(HYBRID_LINES_SYSTEM.includes(CRAFT_LINES_TEXT));
  assert.ok(SCRIPT_SYSTEM.includes(CRAFT_LINES_TEXT));
  for (const k of ["rule_scores", "twist", "motif", "logic", "ending"]) assert.ok(hybridPlanSchema().required.includes(k), k);
  assert.match(scriptPrompt({ idea: { opener: "In this town, x." }, lengthSec: 90, twist: { family: "T2", pct: 67 } }), /THIS VIDEO'S TWIST/);
  assert.doesNotMatch(scriptPrompt({ idea: { opener: "In this town, x." }, lengthSec: 90 }), /THIS VIDEO'S TWIST/);
});

const PLAN = {
  title: "T", premise: "p", opener: "In this town, your nose shows your mood.", hook: "My nose just turned into a trunk!", ally: { name: "Gran", line: "Noses lie, kid" }, beats: [{ beat: "rule", intent: "x", shows: "y", lines: ["a"] }],
  twistType: "T2", rule_scores: { clear_3s: 2, object: 2, daily_cost: 1, can_flip: 2, comment_bait: 1, fresh: 1 },
  twist: { reveal: "the noses show what others feel", reveal_pct: 64, reveal_beat: "adults", clues: [{ beat: "neighbours", clue: "Mr Toll's snout for his wife", in_joke: true }, { beat: "ally", clue: "Gran's line", in_joke: false }] },
  motif: { thing: "the honk", uses: ["a joke", "a warning", "the answer"] }, logic: [{ question: "why not cover it?", answer: "tape melts" }, { question: "q2", answer: "a2" }, { question: "q3", answer: "a3" }],
  ending: { consequence: "the town honks", image: "a row of noses", cost: "the hero keeps the trunk" },
};

test("the plan's craft: notes for a low rule score, a twist outside 49-78%, too few clues; the plan text carries it all", () => {
  assert.deepEqual(planCraftProblems(PLAN), []);
  const bad = { ...PLAN, rule_scores: { clear_3s: 1 }, twist: { ...PLAN.twist, reveal_pct: 90, clues: [{ beat: "ally", clue: "x", in_joke: false }] }, motif: { thing: "honk", uses: ["a"] } };
  const p = planCraftProblems(bad);
  assert.ok(p.some((x) => /scores 1 of 12/.test(x)) && p.some((x) => /planned at 90%/.test(x)) && p.some((x) => /1 clue/.test(x)) && p.some((x) => /used 1 time/.test(x)), p.join(" | "));
  assert.ok(planNotes(bad).some((x) => /scores 1 of 12/.test(x)));
  const text = planText(PLAN);
  assert.match(text, /THE TWIST REVEAL \(at about 64% of the runtime/);
  assert.match(text, /\(inside a joke\)/);
  assert.match(text, /THE MOTIF .*the honk/s);
  assert.match(text, /THE LOGIC .*tape melts/s);
  const card = planCard(PLAN, "noses");
  assert.deepEqual(card.craft, { twistFamily: "T2", twistPct: 64 });
  assert.equal(card.motif.thing, "the honk");
});

test("the craft checks on the lines: advisory notes, never shown to the user", () => {
  const good = { lines: [
    { text: "My nose just honked at 7:02!" }, { text: "You see, in this town, noses show moods." }, { text: "Mr Toll has a pig snout." }, { text: "Gran says, \"Noses lie, kid.\"" },
    { text: "Then came the honk again." }, { text: "Three hundred noses turned." }, { text: "I grabbed the tape." }, { text: "It cost me my nose." }, { text: "Honk." },
  ] };
  const p = craftProblems(good, 20, { plan: { motif: { thing: "honk" } } });
  assert.deepEqual(p, [], p.join(" | "));
  const bad = { lines: [
    { text: "Everybody around here lives a very ordinary sort of life most days of the week." }, { text: "Things are calm and quiet and nothing much happens for a very long time here." },
    { text: "You see, in this town, people sometimes change in very strange and surprising ways over time." }, { text: "Then one day something odd happened to all of the people who lived on our street." },
    { text: "\"I think this is the strangest thing that has ever happened to anyone in this whole entire town,\" said a man." }, { text: "In the end it worked out because the noses were really feelings all along." },
  ] };
  const q = craftProblems(bad, 30, { plan: { motif: { thing: "the honk" } } });
  for (const re of [/rule is clear only at/, /No "me" \/ "my" line/, /motif "the honk" comes 0/, /not in the final line/, /Sentences run/, /6 words or fewer/, /quoted line\(s\) run over 10 words/, /explains the twist/]) assert.ok(q.some((x) => re.test(x)), `${re}: ${q.join(" | ")}`);
  assert.ok(q.every((x) => !isShownNote(x)), "craft notes are for us (Details), not the user's page");
  // 3 concrete numbers / times / names per 100 s: a 100 s script with none is flagged
  const flat = { lines: Array.from({ length: 60 }, (_, i) => ({ text: i === 1 ? "You see, in this town, my shoes talk." : "the shoes talk all day long." })) };
  assert.ok(craftProblems(flat, 90).some((x) => /Only 0 concrete number/.test(x)), craftProblems(flat, 90).join(" | "));
});
