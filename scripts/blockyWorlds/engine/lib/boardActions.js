// Blocky Worlds STORYBOARD ACTIONS (owner 2026-11-11: "ACTIONS MUST BE ANIMATED, NOT JUST FACES"): the one list of
// animated actions, keyed by verb + object, shared by the page (page/simple/board.js animates every key here; it
// throws on a key it does not implement) and the planner's hard check (lib/storyboard.js checkActions: every action
// verb of a line = one of these keys, animated in one of the line's shots).
//   BOARD_ACTIONS  key -> what the viewer SEES (the page's animation)
//   VERBS          [regex on the line's narration (quotes dropped), the keys that show it]
//   actsOfEngineShot(shot) -> the keys an ordinary engine shot animates (its poses, the eye's state, a face-off)

export const BOARD_ACTIONS = Object.freeze({
  "lights_on:windows": "the town's windows and lamps switch on one by one",
  "peek:curtains": "a person inside pulls the curtain aside and peeks out",
  "lurk:monster": "the Peeker sways at the end of the street",
  "press:eye": "the giant eye pushes against a window pane",
  "glow:windows": "the window(s) turn bright white",
  "stare:ceiling": "a person lies awake in bed, eyes open",
  "bulge:curtains": "the cloth pile puffs and spills out of every window",
  "poke_out:cat": "a cat's head pushes out of the curtain pile and looks round",
  "stack:bricks": "bricks drop one by one into a wall in front of the window",
  "tremble:curtains": "thin curtains flutter in front of a nervous face",
  "wave": "a person waves",
  "peek:sock": "the kid's eye to the hole of the sock on the window",
  "stare:cat": "the kid and the cat stare at each other, nose to nose",
  "catch:peeking": "the grandpa steps into the doorway behind the peeking kid",
  "talk": "a person talks (mouth, hands)",
  "rip:curtains": "the wind tears the curtains off the windows",
  "fly:curtains": "curtains flap up into the sky like kites",
  "grab:boards": "a person lifts boards and a hammer",
  "nail:boards": "the hammer swings, the boards go up one by one",
  "smear:batter": "a person slaps batter blobs onto the glass",
  "lick:glass": "a huge tongue sweeps the glass, the batter vanishes",
  "huddle:blanket": "people huddle under one blanket, eyes shut",
  "herd": "a person waves the others together",
  "sneeze": "a person sneezes (head back, then snaps forward)",
  "blow_off:blanket": "the blanket flies off the huddle",
  "look_up": "people tip their heads back and look up",
  "turn:monster": "the Peeker turns toward a house",
  "pull:sock": "the kid pulls the sock off the window",
  "blink:eye": "the giant eyelid closes and opens",
  "back_away:monster": "the Peeker steps back into the dark",
  "dark:windows": "the glowing windows go dark one by one",
  "sleep": "a person sleeps, eyes shut",
  "cover:eyes": "people behind their windows peek through their fingers",
  "walk": "a person walks",
  "stare": "two faces lock eyes",
  "twitch:eye": "the giant eyelid twitches",
});

// [regex on the narration, the keys that show it]: physical action verbs only (states like "has" and thoughts like
// "remembered" are not actions); speech in quotes is not narration
export const VERBS = Object.freeze([
  [/\blook(s)? out\b/i, ["peek:curtains", "peek:sock"]],
  [/\bfinds?\b/i, ["lurk:monster", "turn:monster"]],
  [/\bpress(es|ed)?\b/i, ["press:eye"]],
  [/\bglow(s|ed)\b/i, ["glow:windows"]],
  [/(?<!town (finally )?)\b(sleeps|slept)\b/i, ["stare:ceiling", "sleep"]],
  [/\btown (finally )?slept\b/i, ["dark:windows", "sleep"]], // a town asleep: its lights go out, nobody out
  [/\bbulging\b/i, ["bulge:curtains"]],
  [/\blost (her|his|my) cat\b/i, ["poke_out:cat"]],
  [/\bripped\b/i, ["rip:curtains"]],
  [/\bflew\b/i, ["fly:curtains", "blow_off:blanket"]],
  [/\bgrabbed\b/i, ["grab:boards"]],
  [/\bnailed\b/i, ["nail:boards"]],
  [/\bfilled\b/i, ["press:eye"]],
  [/\bslapped\b/i, ["smear:batter"]],
  [/\blicked\b/i, ["lick:glass"]],
  [/\bherded\b/i, ["herd"]],
  [/\bsneezed\b/i, ["sneeze"]],
  [/\blooked (straight )?up\b/i, ["look_up"]],
  [/\bturned\b/i, ["turn:monster"]],
  [/\bpulled\b/i, ["pull:sock"]],
  [/\bblinked\b/i, ["blink:eye"]],
  [/\bbacked away\b/i, ["back_away:monster"]],
  [/\bwent dark\b/i, ["dark:windows"]],
  [/\bcaught me peeking\b/i, ["catch:peeking"]],
  [/\bstaring contest\b/i, ["stare:cat", "stare"]],
  [/\bwalked\b/i, ["walk"]],
  [/\blooked right at\b/i, ["stare"]],
  [/\bstared\b/i, ["stare"]],
  [/\bpeeked\b/i, ["cover:eyes", "peek:curtains"]],
  [/\btwitched\b/i, ["twitch:eye"]],
  [/\b(said|says)\b/i, ["talk"]],
]);

/** the action verbs of a line: [{ verb, keys }] (quoted speech dropped) */
export function verbsOf(text) {
  const said = String(text ?? "").replace(/"[^"]*"/g, " ");
  const out = [];
  for (const [re, keys] of VERBS) { const m = said.match(re); if (m) out.push({ verb: m[0], keys }); }
  return out;
}

/** the keys an ordinary (non-storyboard) engine shot animates */
export function actsOfEngineShot(s) {
  const out = new Set();
  const eye = s.monsterState?.eye;
  if (eye === "twitch") out.add("twitch:eye");
  if (eye === "blink") out.add("blink:eye");
  if (eye === "press") out.add("press:eye");
  if (s.faceoff || eye === "stare" || eye === "squint") out.add("stare");
  for (const a of s.actors ?? []) for (const p of [a.pose, ...(a.poses ?? []).map((x) => x.pose)]) {
    if (["walk", "run"].includes(p)) out.add("walk");
    if (["sneeze", "look_up", "talk", "wave", "sleep"].includes(p)) out.add(p);
  }
  return [...out];
}
