// Blocky Worlds: the PATTERN BANK (owner 2026-11-14). STYLE ONLY, learned from the 38 reference videos in
// reference/blocky-worlds/videos (transcribed locally with Whisper; the transcripts stay out of git). It names the
// SHAPES that made them work (hooks, rules, examples, twists, endings) in our own words; it never carries a reference's
// lines, names or plots. The writers and the idea engine read it as style notes (patternNotes(kind)); the md summary is
// docs/blocky-worlds-pattern-bank.md.
import { storyShapeBlock } from "./storyShape.js";

export const PATTERN_BANK = Object.freeze({
  source: { videos: 38, seconds: [66, 195], wordsPerSecond: 4.4, note: "style only: no line, name or plot of a reference is used" },
  hooks: [
    { id: "rule_fact", what: "line 1 states the impossible rule as plain fact (\"In this town, ...\"), one clause, no build-up", why: "a viewer knows the whole premise in 2 seconds" },
    { id: "except_me", what: "line 2 puts the narrator outside the rule (everyone has it, except me / I'm the only one who ...)", why: "instant underdog and a reason to keep watching" },
    { id: "loss_first", what: "open on what the rule already took from the narrator, then promise the answer (\"last night I found out where they go\")", why: "personal stakes before the world is explained" },
    { id: "mid_crisis", what: "open in the middle of the biggest moment, then rewind (\"and now every X was moving toward me\")", why: "the payoff is promised before the setup" },
    { id: "hard_number", what: "a concrete number in the first lines (a price, a count, a time, a rating)", why: "numbers make an absurd rule feel real and countable" },
  ],
  rules: [
    { id: "you_see_examples", what: "\"You see,\" then 2-4 rapid everyday examples of the rule hitting ordinary people and jobs (a delivery driver, a mail carrier, grandparents, a teacher)", why: "the rule becomes a lived-in world in 10 seconds; every example is one clear image" },
    { id: "neighbor_cost", what: "named neighbors each pay a small, specific, funny price for the rule (one sentence each)", why: "comedy and proof that the rule has teeth" },
    { id: "one_rule_line", what: "one short line that says the rule out loud: \"There's only one rule. Never ...\"", why: "a chant the viewer remembers and expects to be broken" },
    { id: "visible_meter", what: "the rule is visible: a number, line, light, meter or mark on people or things", why: "it can be filmed and read at phone size" },
    { id: "status_ladder", what: "the rule sorts people into a ladder (higher / richer / luckier / louder), the narrator at the bottom", why: "built-in conflict and a clear target for the twist" },
  ],
  examples: [
    { id: "sound_words", what: "sound words and tiny counters land the jokes (a ding and a minus price, a bonk, a whoosh)", why: "rhythm; the edit cuts on them" },
    { id: "plant_object", what: "a small everyday object is planted early (a piece of chalk, a flashlight, a key, a button) and decides the ending", why: "the payoff feels earned, not lucky" },
    { id: "short_shout", what: "short shouted lines and one-word reactions in the escalation", why: "keeps the pace near 4.4 words a second" },
  ],
  twists: [
    { id: "purpose_reversed", what: "the rule's real purpose is the opposite of what everyone believed (the danger was protection, the cage kept something out)", why: "rewrites everything the viewer saw" },
    { id: "trusted_betrays", what: "the kind adult who protected the narrator was feeding the system all along", why: "a gut-punch for dark twist videos" },
    { id: "lack_wins", what: "the narrator's missing power or tiny resource is exactly what saves everyone", why: "the underdog promise of the hook pays off" },
    { id: "rule_turned", what: "the rule turns on the person at the top of the ladder (the richest one becomes its victim)", why: "justice as a punchline" },
    { id: "replacement", what: "someone is quietly replaced (a copy wears a familiar person's clothes)", why: "a chill in the last seconds" },
    { id: "new_rule_sting", what: "the fix triggers a new, worse rule in the last line", why: "a laugh and a loop" },
  ],
  endings: [
    { id: "callback_button", what: "the last line repeats the rule's or the hook's words with a new meaning", why: "a satisfying click and a rewatch" },
    { id: "open_question", what: "a last image or question that reopens the mystery (a new mark appears, something is right behind)", why: "comments and rewatches" },
    { id: "comic_reversal", what: "a small character takes over the threat in the last line", why: "ends on a laugh" },
    { id: "heart_reframe", what: "one quiet line reframes the rule as being about people, not the thing", why: "the warm version of the twist" },
    { id: "consequence_image", what: "the final image shows the consequence of the last line", why: "the story ends on screen, not in words" },
  ],
  pacing: [
    "line 1 within 2 seconds, the world explained by about 15-25%, the pivot (\"But\" / \"Until one night\") right after",
    "most lines 5-9 words; about 4.4 words a second; a cut every ~1.1 s",
    "the last line under 12 words",
  ],
});

/** the style notes a prompt carries ("plan" | "lines" | "ideas"): shapes only, never copy */
export function patternNotes(kind = "plan") {
  const B = PATTERN_BANK;
  const pick = (xs) => xs.map((x) => `- ${x.what} (${x.why})`).join("\n");
  const head = "STYLE NOTES FROM 38 POPULAR VIDEOS OF THIS FORMAT (shapes only: never copy any line, name or plot; our story stays original):";
  if (kind === "ideas") return `${head}\nRULES THAT WORK:\n${pick(B.rules)}\nTWISTS THAT WORK:\n${pick(B.twists)}`;
  // THE STORY SHAPE (storyShape.js, owner 2026-11-15) leads the plan and the lines notes of every writer
  if (kind === "lines") return `${storyShapeBlock()}\n\n${head}\nHOOKS:\n${pick(B.hooks)}\nEXAMPLES:\n${pick(B.examples)}\nENDINGS:\n${pick(B.endings)}\nPACE:\n${B.pacing.map((p) => `- ${p}`).join("\n")}`;
  return `${storyShapeBlock()}\n\n${head}\nHOOKS:\n${pick(B.hooks)}\nRULES:\n${pick(B.rules)}\nTWISTS:\n${pick(B.twists)}\nENDINGS:\n${pick(B.endings)}`;
}
