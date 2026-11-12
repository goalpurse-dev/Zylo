// Blocky Worlds: the user's own topic stays the core of the story (2026-11-06). The owner typed "we live inside a giant
// turtle and a big bad wolf with an army of soldiers is hunting it" and got a story about a drumbeat in everyone's wrist.
import test from "node:test";
import assert from "node:assert/strict";
import { topicElements, topicProblems, rankTopicIdeas, ruleMissing, baseWord, TOPIC_PREFIX, topicConflict, droppedDescriptors, statesRelation, resolvesConflict, conflictLines } from "../supabase/functions/_shared/blockyWorlds/topic.js";
import { beatsPrompt, problemSpots } from "../supabase/functions/_shared/blockyWorlds/protocol.js";
import { fixPart, scriptProtocolCheck, writeTopicIdeas } from "../supabase/functions/_shared/blockyWorlds/llm.js";
import { partFixPrompt, scriptPrompt } from "../supabase/functions/_shared/blockyWorlds/script.js";
import { topicPrompt } from "../supabase/functions/_shared/blockyWorlds/ideas.js";
import { EXAMPLE_IDEAS, EXAMPLE_SCRIPT } from "../supabase/functions/_shared/blockyWorlds/examples.js";

const TOPIC = "we live inside a giant turtle and a big bad wolf with an army of soldiers is hunting it";
const L = (part, ...texts) => texts.map((text) => ({ part, text }));
const drift = (problems) => problems.filter((p) => p.startsWith(TOPIC_PREFIX));

// The real drifted script: blocky_worlds_runs 7b4c0d8b ("The Quiet Kid and the Turtle's Drums"), read 2026-11-06.
const drums = {
  title: "The Quiet Kid and the Turtle's Drums",
  lines: [
    ...L("rule", "In this town, everyone inside the giant turtle has a drumbeat ticking in their wrist, except me."),
    ...L("tour", "You see, a wolf and his army hunt our turtle.", "They can't see us in the shell.", "They only listen for ticking wrists.", "Get caught ticking, and they march you off before dawn.", "Mrs. Oddy got carried off mid-yawn last Tuesday.", "Her chair still sits there, waiting.", "Baker Bell wraps his tick in a sock now.", "Just in case.", "The mail carrier tiptoes with a pillow strapped to his wrist."),
    ...L("me", "I'm Nell, the quiet kid with no tick.", "My wrist is silent. Totally bare.", "Everyone says I'm lucky.", "I just feel left out.", "But I hear the boots before anyone else.", "I live in a tiny bunk with Grandpa.", "His wrist ticks like a nervous clock.", "He gave me his wind-up pocket watch once.", "Brass. Heavy. Stopped for years.", "I keep it in a drawer."),
    ...L("until", "Until one night, my water cup shivered.", "Thud. Thud. Thud.", "Far-off boots, marching in the dark.", "Torch beams swept down our street.", "Long shadows slid across the shutters.", "Wolf ears on every helmet.", "Then the boots stopped outside our door.", "Grandpa's wrist glowed. Tick. Tick. Tick.", "A fist pounded the wood. Boom."),
    ...L("discovery", "I squeezed one eye to a crack in the shutter.", "The soldiers had passed Baker Bell's house.", "His sock-wrapped wrist didn't turn a single head.", "Then a drumbeat boomed from the next street.", "Every helmet swiveled at once.", "They didn't want ticking wrists.", "They wanted the loudest tick."),
    ...L("climax", "I yanked open the drawer and grabbed the watch.", "I ran to the tail-gate ledge.", "I cranked Grandpa's watch. Click. Click. Click.", "The tick roared like a thunderstorm.", "Every drum in town answered.", "Torches swung toward me.", "The soldiers marched for the noise.", "Row after row marched off the back door.", "Splash. Splash. Splash."),
    ...L("closer", "At dawn, the street was quiet and empty.", "Baker Bell pulled the sock off his wrist.", "Grandpa's watch ticked softly on mine.", "Everyone here has a tick in their wrist.", "Mine just needed a better watch."),
  ],
  post: { title: "The Quiet Kid and the Turtle's Drums", description: "", hashtags: [] },
};
const drumsCard = { prop: "Grandpa's wind-up pocket watch", closer: "Everyone here has a tick in their wrist. Mine just needed a better watch.", topic: TOPIC };

// A faithful script, hand-written: the turtle, the wolf, his army and the hunt drive every part.
const faithful = {
  title: "The Wolf Who Hunts Our Turtle",
  lines: [
    ...L("rule", "In this town, we live inside a giant turtle, and the big bad wolf's army is hunting it."),
    ...L("tour", "You see, if the soldiers hear the turtle's heartbeat, they find us.", "So the whole turtle tiptoes.", "Mr. Fern wears pillow shoes to the bakery.", "The turtle sneezed once and the wolf's soldiers marched for a week.", "School is whispered inside the shell."),
    ...L("me", "I'm Pip, the loudest kid inside the turtle.", "Everyone shushes me.", "Grandma gave me her old tin whistle.", "She said, \"Only when the wolf comes.\""),
    ...L("until", "Until one night, the turtle stopped walking.", "Boots thudded on the shell.", "The wolf's army was climbing up.", "Then the wolf himself knocked on the shell."),
    ...L("discovery", "I peeked through a crack in the shell.", "The soldiers weren't hunting the turtle.", "They were hunting its heartbeat, so the wolf could eat the noise.", "And the soldiers hated loud whistles."),
    ...L("climax", "I climbed to the top of the turtle.", "I blew the tin whistle as hard as I could.", "The wolf's soldiers covered their ears.", "The whole army ran for the hills.", "The wolf tripped over his own tail and rolled after them."),
    ...L("closer", "Now the turtle walks wherever it likes.", "We live inside a giant turtle, and I'm allowed to be loud."),
  ],
  post: { title: "The Wolf Who Hunts Our Turtle", description: "", hashtags: [] },
};

test("topic: the key elements of the owner's topic, with the setting, plurals, -ing and synonyms", () => {
  const els = topicElements(TOPIC);
  assert.deepEqual(els.map((e) => e.key), ["turtle", "wolf", "army", "hunt"]);
  assert.deepEqual(els.find((e) => e.key === "army").words, ["army", "soldiers"]);
  assert.equal(els.find((e) => e.setting).key, "turtle");
  for (const [w, b] of [["wolves", "wolf"], ["hunting", "hunt"], ["hunted", "hunt"], ["turtles", "turtle"], ["running", "run"], ["Soldiers'", "soldier"]]) assert.equal(baseWord(w), b, w);
  // "troops" and "the wolf's" mention the army and the wolf
  assert.deepEqual(ruleMissing(els, "In this town, the wolf's troops hunt our turtle."), []);
  assert.deepEqual(topicElements("my cat"), [{ key: "cat", words: ["cat"], setting: false, label: '"cat"' }]);
});

test("topic: the real drifted script (wrist drumbeats) fails with clear reasons", () => {
  const problems = topicProblems(TOPIC, drums);
  assert.match(problems.join("\n"), /first line never mentions "wolf", "army\/soldiers" or "hunting"/);
  assert.match(problems.join("\n"), /"turtle" and "hunting" never show up after the opening/);
  assert.match(problems.join("\n"), /only 5 of 50 lines are about it/);
  // and it joins the protocol checks of a written script with the topic on its card
  assert.ok(drift(scriptProtocolCheck(drums, 90, drumsCard).problems).length >= 3);
});

test("topic: the earlier real draft (a 'shell-sticker' rule) fails on its first line", () => {
  const sticker = { lines: [...L("rule", "In this town, everyone inside our giant turtle has a shell-sticker, except me.", "Mine says ZERO."), ...faithful.lines.slice(1)] };
  assert.match(topicProblems(TOPIC, sticker).join(), /first line never mentions "wolf", "army\/soldiers" or "hunting"/);
});

test("topic: a faithful turtle/wolf script passes the topic check", () => {
  assert.deepEqual(topicProblems(TOPIC, faithful), []);
  assert.deepEqual(drift(scriptProtocolCheck(faithful, 30, { prop: "Grandma's tin whistle", closer: "We live inside a giant turtle.", topic: TOPIC }).problems), []);
});

test("topic: a climax without the threat fails and is placed on the climax", () => {
  const calm = { lines: faithful.lines.map((l) => (l.part === "climax" ? { ...l, text: "I blew the whistle and everyone went home." } : l)) };
  const problems = topicProblems(TOPIC, calm);
  assert.match(problems.join(), /the climax never involves "wolf", "army\/soldiers" or "hunting"/);
  const spot = problemSpots(calm, problems).find((s) => /climax never involves/.test(s.problem));
  assert.equal(spot.part, "climax");
  assert.equal(spot.fix, "part");
});

test("topic: library drafts and pasted scripts are never topic-checked", () => {
  // the same drifted script with a library card (no topic): no drift problem
  assert.deepEqual(drift(scriptProtocolCheck(drums, 90, { ...drumsCard, topic: undefined }).problems), []);
  assert.deepEqual(drift(scriptProtocolCheck(EXAMPLE_SCRIPT, 90, EXAMPLE_IDEAS[0]).problems), []);
  assert.deepEqual(topicProblems("", drums), []);
});

test("topic: spots: the first line is fixed in place, drifting across the story needs a rewrite", () => {
  const spots = problemSpots(drums, topicProblems(TOPIC, drums));
  // the first line, the elements after the opening, the share, and the hunt that never happens after the opening
  assert.deepEqual(spots.map((s) => [s.part, s.fix]), [["rule", "part"], [null, "rewrite"], [null, "rewrite"], [null, "rewrite"]]);
  assert.deepEqual(spots[0].lines, [0]);
});

// 2026-11-07, the second real drift (Sonnet, paid test run "turtle"): every noun is there, so the old check passed it, but
// "giant", "big bad" and the hunt are gone: the wolf is fed a sandwich every night and the army ends up washing dishes.
const sandwich = {
  title: "The Wolf's Army Washes Our Dishes",
  lines: [
    ...L("rule", "In this town, we live inside a turtle and feed the hunting wolf every night."),
    ...L("tour", "You see, the turtle keeps our whole town safe.", "But miss the nightly sandwich.", "The wolf's army bites the shell.", "Grandpa Tuk eats only lukewarm peas.", "Nobody hunts a man that boring.", "Mrs. Bell fed the wolf's cousin three times this week.", "He's still hungry.", "The mailman's been fed so often he delivers by hopping."),
    ...L("me", "I'm Bo, the class clown.", "I forget the sandwich every single night.", "I have one lunchbox and zero plans.", "My little sister Pea waits for me inside the turtle.", "She says I'm her hero.", "In my lunchbox sits one soggy peanut butter sandwich."),
    ...L("until", "Until one night, I forgot the sandwich again.", "Sniff. Sniff.", "Soldiers pressed their noses to the shell.", "Then one soldier took a bite.", "Crunch.", "A hole the size of a block opened in the wall.", "Then the whole army swarmed the shell.", "The town square rattled.", "Houses wobbled.", "Pea grabbed my sleeve.", "Everybody looked at me."),
    ...L("discovery", "I ran to the old wall by the square.", "There's a dusty plaque nobody reads.", "It showed carved figures around a long table.", "The wolf sat right in the middle.", "Whoever sits at the table is safe.", "Feeding the wolf was never a bribe.", "It was an invitation."),
    ...L("climax", "I walked out to the wolf.", "My knees were jelly.", "Evening, sir.", "I held out my soggy sandwich.", "Dinner's ready.", "Bring the whole army.", "The wolf sniffed the sandwich.", "It was horrible.", "He ate it anyway.", "Soldiers sat down with napkins.", "By the rule they couldn't hunt anyone at the table.", "So they stayed.", "Then they washed every dish.", "Mrs. Bell handed out sponges."),
    ...L("closer", "The town's safe.", "The army does dishes now.", "In this town, we live inside a turtle and nobody here skips dinner twice."),
  ],
  post: { title: "We live inside a turtle and a wolf is hunting it", description: "", hashtags: [] },
};
const sandwichCard = { prop: "a soggy peanut butter sandwich", closer: "In this town we live inside a turtle, and nobody here skips dinner twice.", topic: TOPIC };
// The same story told faithfully: still funny, the same sandwich, but the giant turtle is hunted and the hunt ends.
const sandwichFaithful = {
  title: "The Sandwich That Saved Our Turtle",
  lines: [
    ...L("rule", "In this town, we live inside a giant turtle, and a big bad wolf's army is hunting it."),
    ...L("tour", "You see, the turtle walks all night so the soldiers can't find it.", "Stop walking, and the wolf's army catches up.", "Grandpa Tuk sleeps standing up, just in case.", "Mrs. Bell bakes bread on the turtle's back.", "The wolf's soldiers sniff for it every morning.", "The mailman delivers by hopping across the shell.", "Nobody stands still here."),
    ...L("me", "I'm Bo, the class clown.", "I never stop snacking.", "I always carry one soggy peanut butter sandwich.", "My little sister Pea says it smells like feet.", "She says I'm her hero anyway."),
    ...L("until", "Until one night, the giant turtle fell asleep.", "It stopped walking.", "Sniff. Sniff.", "The wolf's soldiers were hunting us again.", "Boots thudded closer across the hills.", "Then the whole army climbed onto the shell.", "Torches. Helmets. Teeth.", "The big bad wolf himself knocked on the shell.", "Pea grabbed my sleeve."),
    ...L("discovery", "I peeked through a crack in the shell.", "The soldiers weren't sniffing for the turtle.", "They were sniffing for food.", "The wolf was hunting the turtle because it smelled like Mrs. Bell's bread.", "And nothing smells stronger than my sandwich."),
    ...L("climax", "I climbed to the top of the shell.", "I held up my soggy peanut butter sandwich.", "Every single soldier froze.", "Every nose turned.", "I threw it as far as I could.", "It flew off the cliff into the river.", "The whole army chased after it.", "Splash. Splash. Splash.", "The big bad wolf tripped over his own tail and rolled after them.", "The giant turtle woke up and walked away."),
    ...L("closer", "Now nobody hunts our turtle.", "In this town, we live inside a giant turtle, and I'm the kid with the sandwich."),
  ],
  post: { title: "The Sandwich That Saved Our Turtle", description: "", hashtags: [] },
};

test("topic: the real 'sandwich' drift (nouns kept, premise lost) now FAILS: descriptors, the hunt, the climax", () => {
  const problems = topicProblems(TOPIC, sandwich);
  const all = problems.join("\n");
  assert.match(all, /the first line never says that "wolf" or "army\/soldiers" is "hunting" the "turtle"/); // "the hunting wolf" is an adjective
  assert.match(all, /drops "giant" \(turtle\) and "big bad" \(wolf\)/);
  assert.match(all, /the "hunting" never happens after the opening/); // "Nobody hunts", "they couldn't hunt" don't count
  assert.match(all, /the climax never ends the "hunting".*not turn into a truce or a gag/s);
  assert.equal(problems.length, 3);
  assert.equal(drift(scriptProtocolCheck(sandwich, 90, sandwichCard).problems).length, 3);
  const spots = problemSpots(sandwich, problems);
  assert.deepEqual(spots.map((s) => [s.part, s.fix]), [["rule", "part"], [null, "rewrite"], ["climax", "part"]]);
});

test("topic: the same story told faithfully (funny, the hunt kept and ended) passes every check", () => {
  assert.deepEqual(topicProblems(TOPIC, sandwichFaithful), []);
  const words = sandwichFaithful.lines.reduce((a, l) => a + l.text.split(/\s+/).length, 0);
  const len = [60, 70, 80, 90].find((s) => words <= Math.round((s * 212) / 60) && words >= Math.round((s * 212) / 60 * 0.9));
  assert.ok(len, `${words} words fit a length`);
  assert.deepEqual(scriptProtocolCheck(sandwichFaithful, len, { ...sandwichCard, closer: "In this town, we live inside a giant turtle, and I'm the kid with the sandwich." }).problems, []);
});

test("topic: descriptors and the conflict are read from the topic", () => {
  const els = topicElements(TOPIC);
  assert.deepEqual(els.find((e) => e.key === "turtle").descriptors, [["giant"]]);
  assert.deepEqual(els.find((e) => e.key === "wolf").descriptors, [["big", "bad"]]);
  const c = topicConflict(els);
  assert.equal(c.relation.key, "hunt");
  assert.deepEqual(c.agents.map((e) => e.key), ["wolf", "army"]);
  assert.equal(c.target.key, "turtle");
  // "huge" keeps "giant", "big, bad" keeps "big bad"
  assert.deepEqual(droppedDescriptors(els, "a huge turtle and a big, bad wolf"), []);
  // active vs. adjective vs. negated
  assert.equal(statesRelation(c, "In this town, the wolf's army hunts our turtle.", { withAgent: true }), true);
  assert.equal(statesRelation(c, "We feed the hunting wolf.", { withAgent: true }), false);
  assert.equal(statesRelation(c, "They couldn't hunt anyone at the table."), false);
  assert.equal(resolvesConflict(c, "The wolf never hunted our turtle again."), true);
  assert.equal(resolvesConflict(c, "Soldiers sat down with napkins. So they stayed."), false);
  // a topic with no conflict verb gets none of these checks (the real dog topic)
  assert.equal(topicConflict(topicElements("my dog got lost the day of the town's bell festival")), null);
});

test("topic: the prompts make the premise's conflict the spine (ideas, beats, script)", () => {
  const spine = /THE CONFLICT IS THE SPINE \(who: the big bad wolf and army \| does: hunting \| to whom: the giant turtle\)/;
  assert.match(topicPrompt({ topic: TOPIC }).text, spine);
  assert.match(beatsPrompt({ ...EXAMPLE_IDEAS[0], topic: TOPIC }, 90), spine);
  assert.match(scriptPrompt({ idea: { ...EXAMPLE_IDEAS[0], topic: TOPIC }, lengthSec: 90 }), spine);
  assert.match(conflictLines(TOPIC).join("\n"), /never turn the threat into a friend, a guest or a gag/);
  assert.ok(!beatsPrompt(EXAMPLE_IDEAS[0], 90).includes("SPINE"));
});

test("topic: ideas are ranked by fidelity; a gimmick opener is dropped while a faithful one exists", () => {
  const base = { premise: "A turtle town hides from the wolf.", price: "", twist: "", closer: "", examples: [] };
  const gimmick = { ...base, opener: "In this town, everyone inside the giant turtle has a drumbeat ticking in their wrist, except me." };
  const ok = { ...base, opener: "In this town, we live inside a giant turtle, and the wolf's army is hunting it." };
  const half = { ...base, opener: "In this town, the wolf hunts our giant turtle every night." };
  assert.deepEqual(rankTopicIdeas(TOPIC, [gimmick, half, ok]), [ok, half]);
  // nothing faithful: everything kept, best first
  assert.equal(rankTopicIdeas(TOPIC, [gimmick]).length, 1);
});

test("topic: the prompts carry the user's own idea as the core", () => {
  const { text } = topicPrompt({ topic: TOPIC });
  assert.ok(text.includes(`"${TOPIC}"`) && /THIS IDEA IS THE STORY/.test(text) && text.includes('"army/soldiers"') && /Never swap it for a new invented gimmick/.test(text));
  const sp = scriptPrompt({ idea: { ...EXAMPLE_IDEAS[0], topic: TOPIC }, lengthSec: 90 });
  assert.ok(sp.startsWith("THE USER'S OWN IDEA") && sp.includes(TOPIC));
  assert.ok(!scriptPrompt({ idea: EXAMPLE_IDEAS[0], lengthSec: 90 }).includes("THE USER'S OWN IDEA"));
  assert.ok(partFixPrompt({ script: drums, indexes: [0], reasons: ["x"], card: drumsCard }).includes(TOPIC));
});

test("topic: topic ideas keep the user's words on the card (free mock)", async () => {
  const { ideas } = await writeTopicIdeas({ provider: "mock", topic: TOPIC });
  assert.ok(ideas.length > 0 && ideas.every((i) => i.topic === TOPIC));
});

test("topic: Fix it on the first line brings the idea back (free mock)", async () => {
  const script = { title: "t", lines: [...L("rule", "In this town, everyone inside the turtle has a sticker."), ...faithful.lines.slice(1)], post: { title: "t" } };
  const problems = topicProblems(TOPIC, script);
  const reasons = problemSpots(script, problems).filter((s) => s.part === "rule").map((s) => s.problem);
  assert.equal(reasons.length, 1);
  const fix = await fixPart({ provider: "mock", script, indexes: [0], reasons, card: { prop: "Grandma's tin whistle", closer: "We live inside a giant turtle.", topic: TOPIC }, lengthSec: 30 });
  assert.match(fix.script.lines[0].text, /^In this town, we live inside a giant turtle/);
  assert.deepEqual(drift(fix.check.problems), []);
});
