// Blocky Worlds: the 19 reference videos' premises and twists (ANALYSIS.md §3), in one line each. The writer is told
// never to reuse them, and the judge scores originality 1 when an idea copies a premise AND its twist (at most 2 when it
// copies the premise only). Never quoted to the writer as examples (2026-11-04: quoting them made the writer copy them).
export const REFERENCE_PREMISES = Object.freeze([
  "a chalk line around each house; anything outside after dark belongs to a monster / twist: draw the line around the monster",
  "everyone is born with wings except me / twist: rain grounds the fliers and the one without wings climbs down to rescue",
  "a town inside a whale / twist: the whale's sneeze fires a harpoon at the sea monster",
  "a creature grants wishes and takes the first thing that greets you at home / twist: it greets you first, so it takes itself",
  "NPCs in a game world with one line each / twist: a glitched NPC uses the admin's ban hammer",
  "every porch leaves a plate for the great beast / twist: mom is the beast and the kid becomes one too",
  "your worst moment is printed on your shirt / twist: the kid with a blank shirt learns to live",
  "a superpower on the worst day of your life / twist: the sidekick's unknown power turns off every light",
  "whistle after dark and something whistles back with your family's voices / twist: answer with knocks it can't copy",
  "every kid has a monster under the bed / twist: the monster was the protector all along",
  "the smaller you are, the stronger your magic / twist: the wish makes the narrator the tiniest and most powerful",
  "be home before the streetlights go out / twist: the streetlights are the monsters and freeze in a flashlight beam",
  "everyone lives underground and the surface is said to be deadly / twist: the surface is fine, a cover-up",
  "everyone lives inside an endless supermarket with night-shift monsters / twist: a monster wears dad's clothes",
  "the last humans live on a submarine that must keep moving / twist: the thing behind them eats the sub",
  "a number over your head counts who chose you / twist: it counts choices made when there were other options",
  "everyone's weather follows their mood / twist: the grumpy kid's rain ends the town's drought",
  "Santa lands on the brightest house / twist: in a blackout the one sad light guides him",
  "a star appears over you when someone misses you / twist: the friend who moved away misses you",
]);

export const REFERENCE_RULE = `NEVER REUSE THESE (19 viral videos this template learned from). An idea must not copy any of these premises, and must never copy a premise together with its twist:\n${REFERENCE_PREMISES.map((p) => `- ${p}`).join("\n")}`;
