// M2: the automatic planner. Topic -> script -> fact-check (web search) -> scene plan (a new layout, or a saved
// layout's beats mapped onto the new script) -> layout solver -> one repair round. Sonnet 5.5 by default.
// Every step's reply and problems are kept in the trace for reading afterwards.
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { callJSON, MODEL } from "./llm.mjs";
import { catalogText, SETTING_PROPS } from "./catalog.js";
import { FACTS_SCHEMA, layoutFromScene, ROLES, SCENE_REPLY_SCHEMA, SCRIPT_SCHEMA, sceneFromLayout } from "./plan.js";
import { solveLayout } from "./solver.js";
import { chainProblems, linkProblems, VISIBLE } from "./chain.js";
import { homeView, projectBox } from "./director.js";
import { placeLifeProps, placeSign } from "./framing.js";
import { VERBS } from "./verbs.js";
import { classifyTopic, normTopic, PREMADE, premadeByKey } from "../../../../supabase/functions/_shared/cutaway/topics.js";
import { focusOf, union } from "./focus.js";
import { KIND_DOCS } from "./catalog.js";
import { modelMatches, wordsOf } from "./models.js";

const here = path.dirname(fileURLToPath(import.meta.url));
// a saved layout, with its side-story props moved beside the cut (the same rule as a new layout; deterministic)
const template = (k) => { const L = JSON.parse(fs.readFileSync(path.join(here, "layouts", `${k}.template.json`), "utf8")); const P = placeLifeProps(L, homeView(L), projectBox).layout; return placeSign(P, homeView(P), projectBox).layout; };
const roleScript = (L, words) => words; // (kept for symmetry; scripts carry their roles)

// (the most is a limit with a 5% tolerance, WORD_TOLERANCE: the real writer's first narrations ran to 150-182 words for
// 30 s, 2026-10-28; a free trim and a second rewrite come before a refusal). beats: a new plan's most beats (the owner's
// cap of 2026-10-28: 12 for 30 s, scaled for 60 s; 13 beats made the words overrun); sentences: what a script may have
// (the approved premade scripts have up to 13)
export const LENGTH = { 30: { words: [95, 120], sentences: [10, 13], beats: [10, 12] }, 60: { words: [200, 240], sentences: [18, 24], beats: [18, 24] } };
export const WORD_TOLERANCE = 0.05;
export const wordCount = (t) => String(t ?? "").split(/\s+/).filter(Boolean).length;
export const overWords = (n, lengthSec) => n > Math.round(LENGTH[lengthSec].words[1] * (1 + WORD_TOLERANCE));

// the worked examples the script writer sees: the chain structure (the owner's rule of 2026-10-25), written by hand from
// facts verified in earlier runs (research/seamless-niche/CHAIN_EXAMPLES.json)
const CHAIN_EXAMPLES = [
  { topic: "a French drain", roles: ["hook", "problem", "fix1", "problem2", "fix2", "name", "problem3", "fix3", "myth", "mythFact", "finish", "congrats"], text: "If you dig a ditch along your house, you have a drain. | But one inch of rain on a roof dumps over 600 gallons, and the ditch overflows. | So you fill the ditch with gravel to hold the water. | But now the gravel holds that water against the wall, and the wall cracks. | So you lay a pipe full of holes under the gravel, sloping away downhill. | This is a French drain. | But mud washes into the gravel, clogs every hole, and the basement floods anyway. | So you wrap the gravel in fabric that keeps the mud out. | And the French in French drain is not France. | It is Henry French, who wrote the book on drains in 1859. | Add the grass back on top. | Congratulations, you have built a French drain.",
    chain: "problem: rain spills out of the ditch against the wall (size 2) <- the hook | problem2: a crack runs up the wall (size 4) <- fix1, the gravel holding the water | problem3: the basement floods (size 5) <- fix2, the pipe's holes clogging" },
  { topic: "a traffic light", roles: ["hook", "problem", "fix1", "name", "problem2", "fix2", "problem3", "fix3", "myth", "finish", "congrats"], text: "If you hang one red lamp over a crossing, you have a traffic light. | But it never changes, so cars pile up down both roads. | So you add a green lamp and a gray box that switches them. | This is a signal controller. | But the box runs on a clock, so at midnight a lone car sits at an empty red. | So you bury a loop of wire in the road that feels a car's metal. | But now the light flips the instant a car arrives, and the car behind it slams into its back. | So you add a yellow lamp that gives everyone a few seconds to stop. | And many of those sensors are wire loops, not cameras. | Add a crosswalk, a bench, and a mailbox. | Congratulations, you have built a traffic light.",
    chain: "problem: cars queue down both roads (size 2) <- the hook | problem2: one car waits at a red with nobody around (size 3) <- fix1, the box's clock | problem3: the car behind crashes into the stopped car (size 5) <- fix2, the loop flipping the light at once" },
];
// the account's approved scripts (the golden pair), kept for the record; the writer now sees CHAIN_EXAMPLES
const EXAMPLES = [
  { topic: "a French drain", roles: template("french_drain").roles, text: "If you dig a ditch along your house, you have a drain. | But one inch of rain on a small roof dumps over 600 gallons right by your walls. | The ditch floods. | Five feet down, that water pushes over 300 pounds on each square foot, and the wall cracks. | So you fill the ditch with gravel, but the water still sits at the bottom. | So you lay a pipe full of holes under the gravel. | This is a French drain. | Water seeps in through the holes, and the pipe slopes downhill to carry it away. | Wrap the gravel in fabric so mud can't clog it. | And the French in French drain is not France. | It is Henry French, a New England farmer and judge who wrote the book on drains in 1859. | Add the grass back on top. | Congratulations, you have built a French drain." },
  { topic: "a landfill", roles: template("landfill").roles, text: "If you dig a pit and throw your trash in, you have a landfill. | But dirty trash juice leaks straight down into the groundwater you drink. | So you lay a thick clay base, but it is still not enough. | You add a thick black plastic sheet. | This is a landfill liner. | A pipe drains the collected juice into a tank beside the pit. | Sealed this tight, trash barely rots at all once it is buried. | A 1952 newspaper dug up decades later was still readable word for word. | But trapped trash still makes gas, so a pipe carries it out. | That flame is not waste burning, it is gas making electricity nearby. | Add a grass cap, a fence, and a few young trees. | Congratulations, you have built a landfill." },
];

const SCRIPT_SYSTEM = `You write scripts for short cutaway explainer videos: a 3D diorama (a yard with a house, a street, a car wash lot...: the setting that fits the topic), with the ground cut open in section when something goes underground, where a thing is built step by step while one narrator talks. Every sentence must be something a 3D build can show happening: digging, pipes, tanks, fills, water flowing, leaks and cracks, rain, cars, and the parts of the thing itself (doors, springs, rails, motors, wheels, gears, valves, floats, levers, lamps, buttons, a small screen with a number): any machine or structure is built from such parts, and its parts move (slide, swing, roll up, spin, fill, light up). No people doing things, no maps, no ice, no long text on screens, no outer space or the body, and never compare two things that would both need to be drawn in a beat of their own.
WHAT THE SETTINGS REALLY CONTAIN (promise only what is there):
- street: ONE straight road going away from the camera, one crosswalk, one signal on its corner, a sidewalk with shop fronts. Cars drive one way along that road: they arrive, stop, queue nose to tail at the line, wait, drive off, and can bump the car ahead. There is no cross road or second road, no turning, no pedestrians: say "cars pile up at the red", never "on both roads" or "the cross street".
- yard: a house, a lawn, a fence, trees and the ground cut open in section below; rain, water and pipes.
- garage: a garage with one wide opening on a driveway, a car, shelves inside.
- room: a room with a floor (the basement below in section), a wall with a window, an armchair.
- car wash: a lot with a wash bay, a car going through.
The account's formula:

HOOK      "If you [one naive physical action], you have a [thing]."
CHAIN     "But [a visible consequence]." then "So you [add one real part, described physically, no jargon]." repeated: a CHAIN, not a list.
          Every fix causes the next, bigger problem: "So you add X. But now X does Y…". The story escalates: each "But" is a
          bigger, concrete, real-world consequence with visible stakes (cars piling up, a car hit in the junction, water
          flooding the basement, the wall cracking, the creek turning grey), never a dry fact or a number on its own.
          The first problem is the second sentence, right after a short hook (16 words or fewer), and anyone gets it at once.
          Each problem is SHOWN happening on screen, not just said: say what we see.
          LINK RULE (checked by code): every "But…" after the first must name the part the fix before it added (the
          box, the loop, the gravel), or start with "But now". "So you add a box that switches them. But at midnight a
          car waits" fails; "But the box runs on a clock, so at midnight a car waits" or "But now, at midnight, a car
          waits" passes.
NAME      "This is a [real term]." (exactly one sentence with role name; a second one, name2, only in 60 s videos)
MYTH-BUST "And [the thing everyone knows] is not [what they think]. It is [the mechanism]." (when a true one exists)
FINISH    "Add [two or three finishing touches]." then "Congratulations, you have built a [thing]."

Rules:
- Every sentence is something the viewer can SEE happen in the cut-open ground, on the lawn or in the street: dig, fill, pour, lay a pipe, water rising, flowing, seeping, a crack, rain, a tank, a pump, a cap, grass, a fence. Nothing abstract, no people; vehicles only as the kit has them (a car, a dump truck).
- chain: one entry per "But…" sentence: problem (its sentence index), causedBy (the index of the "So you…" fix that caused it; -1 for the first, caused by the hook), shows (what we see happening on screen, a short phrase), stakes (who or what suffers), size (1-10: how big it is; every problem bigger than the one before).
- Numbers are spoken as written: write "1,500", never "1500" or "fifteen hundred"; years as 4 digits ("1952").
- The narration is read aloud, then checked word by word, so write every word one standard way: "cannot", never "can not"; no abbreviations: never "US", "U.S." or "USA" (write "American" or "America"), units in full ("square feet", "pounds", "gallons", never "sq ft", "lb", "gal").
- Three or four surprises, each physical and concrete, ideally with a number ("dumps over 600 gallons", "pushes over 300 pounds on each square foot", "still readable"). One by about a third of the way in, one in the middle, the myth-bust near the end. Each surprise is a claim the fact-checker will search, so give a search query for it.
- Number cards: put 1-3 big numbers on screen as cards ("600 GALLONS", "300 LB", "1859", "37 YEARS"). The card's word must be a word of that sentence, exactly as written (for example the word "600").
- Plain words, sentences of 6-20 words, no run-ons, no lists of more than three, no questions, no "you might think". Present tense. American English, numbers as digits.
- Each sentence gets one role from the list; a role is used once. Order: hook first, congrats last, finish just before it, name after the loop that adds the named part.
- parts: the physical things the video will need to show (for the scene planner), plain nouns.`;

function scriptUser({ topic, lengthSec, roles, facts, keyWords }) {
  const L = LENGTH[lengthSec];
  return `Topic: ${topic}
${finishPropsLine(topic)}
Length: ${lengthSec} s video: ${L.words[0]}-${L.words[1]} words in ${L.sentences[0]}-${L.sentences[1]} sentences.
${roles ? `This topic re-uses a saved scene. Use exactly these roles, in this order, one sentence each: ${roles.join(", ")}.` : `Roles you may use: ${ROLES.join(", ")}.`}
${facts?.length ? `Use only these verified facts for the surprises (with their exact wording and numbers):\n${facts.map((f) => `- ${f}`).join("\n")}` : ""}
${keyWords ? `The saved scene animates on these words; use them in these sentences where it reads naturally:\n${Object.entries(keyWords).map(([r, ws]) => `- ${r}: ${ws.join(", ")}`).join("\n")}` : ""}

Two example scripts in the chain structure, sentence by sentence (| between sentences), with their roles and their chain:
${CHAIN_EXAMPLES.map((e) => `${e.topic} [${e.roles.join(", ")}]:\n${e.text}\nchain: ${e.chain}`).join("\n\n")}`;
}

const RESEARCH_SYSTEM = `You research the surprise claims in a short explainer script with web search. You MUST search for every claim (one or two searches each) before you answer; never answer from memory. For each claim, write what reliable sources say (engineering and government sources, manufacturers' guides, encyclopedias; not forums), with the exact figures and wording they use, and the URL of each source. Then say for each claim: supported as written, supported in a corrected form (give it), or not supported.`;

const FACTS_SYSTEM = `You fact-check the surprise claims in a short explainer script, with web search. For each claim:
- search for it (one or two searches), and read what reliable sources say (engineering and government sources, manufacturers' guides, encyclopedias, well-known references; not forums);
- verdict "keep" if sources support it as written; "reword" if the true version is close (change the wording and the numbers to exactly what the sources support, for example "New England" instead of "Massachusetts", "over 600 gallons" for a rounded figure); "drop" if it is false, unsupported, or a myth;
- list the sources you used (url and title) for keep and reword.
You are given research notes with sources found by web search: judge every claim ONLY from those notes (a claim the notes do not support is dropped), and copy the source URLs from the notes. Then return the whole script again with the claims fixed: reworded sentences changed, and a dropped claim's sentence rewritten without it (keep the role, keep it something visible). Keep every other sentence word for word. Return the number cards again too, fixed to the new wording (a card's word must still be a word of its sentence).`;

// the worked example is the other golden topic when the topic is itself a golden one (a fair remake)
const EXAMPLE_TITLE = { french_drain: "French drain", landfill: "landfill" };
// the hand-built layouts the scene planner can be shown as its worked example (m2/layouts/<key>.template.json)
const EXAMPLE_LAYOUTS = ["landfill", "french_drain", "car_wash", "storm_drain", "vending_machine", "water_well", "atm"];
/**
 * The worked example for a topic: the hand-built layout of the topic itself when there is one (a vending machine sees
 * the vending machine), else one from its setting (a street topic sees the storm drain's street, a car wash the car
 * wash), else the yard: the French drain, or the landfill for a drain. Free: it only changes which layout the prompt
 * shows (a traffic light was planned from the French drain's yard).
 */
export function exampleFor(topic) {
  const t = ` ${normTopic(topic)} `;
  const own = EXAMPLE_LAYOUTS.find((k) => [k.replace(/_/g, " "), ...(premadeByKey(k)?.aliases ?? [])].some((a) => t.includes(` ${a} `)));
  if (own) return own;
  const set = settingHint(topic).match(/the (\w+) setting/)?.[1];
  if (set === "street") return "storm_drain";
  if (set === "carwash") return "car_wash";
  return /drain/i.test(topic) ? "landfill" : "french_drain";
}
// mode "script": the scene for a written script (a given script, a repair); mode "beats": the beats FIRST (the owner's
// rule of 2026-10-27, "visuals first, words second"): the planner decides what visibly happens in each moment, with cue
// words instead of a script, and the writer then writes one sentence per beat about what is on screen
const sceneSystem = (example = "french_drain", mode = "script") => `${mode === "beats" ? `You plan a cutaway explainer video BEFORE its narration exists: its story beats, its 3D scene and its animation, using ONLY the kit described below. For each moment (beat) of the story you decide what visibly happens, with kit parts and verbs, and the camera. A writer then writes exactly one sentence per beat saying what you show, so a beat can only carry what the kit can show. You write a layout: the world change (the cut), the parts with their settings, and the beats: for each beat (by its role), which kit verbs happen on which cue words, and the camera shots; and the story: each beat's idea, the chain of problems, the surprises.

${STORY_RULES}` : `You plan the 3D scene and the animation of a cutaway explainer video, from its script, using ONLY the kit described below. You write a layout: the world change (the cut), the parts with their settings, and the beats: for each sentence (by its role), which kit verbs happen on which of its words, and the camera shots.`}

${catalogText()}

HOW TO PLAN
- Coordinates: the face of the cut is z = 0, facing the camera; things seen in section in the face sit at z near 0 (pipes in the face at z = -0.06, fills from z0 to z1 = 0). The ground surface is y = 0. The camera looks from +z, a little from the right and above.
- Choose the setting first (THE SETTING above): the yard only for things around a house; a street or a park when the topic lives there. Our videos should not all look alike.
- One cut (world.cut) holds the main build. Keep the house off the cut (move it back or aside with world.house). Pipes may run through the soil outside the cut, along the face. When nothing goes underground (a street topic) the cut is just where the build stands: the pipeline makes it a thin slab, and there is no dig.
${mode === "beats" ? `- A part appears ON ITS CUE WORD: an action's w is the one plain word the narration will say at that moment: the thing's name ("pipe", "gravel", "tank", "loop") or the action ("dig", "cracks", "floods"); one word, no punctuation, never "" except to start with the beat. The writer must say every cue word of a beat in its sentence, so pick words a narrator would say. When there is a dig, its cue is "dig" in the hook.` : `- A part appears ON THE WORD THAT NAMES IT: put its verb on that word ("pipe", "gravel", "tank"). When there is a dig, it is on "dig" in the hook.`}
- The explainer layer: arrows show where water or gas moves; a glowing outline traces the named part on the "This is a…" sentence (verb show on the named word, hide on the next sentence); flow dots run in pipes when water flows.
- A myth-bust ("X is not Y") must SHOW the wrong idea first, then take it away: a flag crossed out, a fake lake that drains or fades on "not", then the real mechanism appears on the next sentence. A sentence about something that is not there needs a visible stand-in for it.
- EVERY SENTENCE SHOWS ITS OWN ACTION: the thing the sentence names is on screen and visibly does the sentence's verb. Each beat has shows: {p: the id of the part that does it, does: the visible action in a few words}. Use the part made for the verb: flow for runs / pours / flows (its path goes from where the stuff starts to where it ends, e.g. across the slab into the drain, through the pipe, down into the creek), settle for sinks / floats / separates (sand grains fall to the floor, a dark oil layer rises), creek for a creek, river or stream (it must exist as a part, not a blue box), fills for filling up, pipes growing for laying a pipe. Arrows alone never show an action: they only point at one. A creek or anything else seen in section must lie inside the cut's x range (the solid soil face hides the rest); otherwise it is seen on the surface.
- A CHANGE MUST READ IN ONE STILL FRAME (the checker sees three stills of each sentence). When a sentence says something moves or changes, its beat uses the kit's motion or state for exactly that (drives off: traffic go or car leave; crashes / rear-ends: traffic bump; swings out, tips, slides, falls: a rig swing / slide / track; snaps or breaks in two: a rig snap move; rolls up the tracks: a rig track move on each section; fills or empties: a fill or a counter), never only a light or an arrow. Motions hold partway through their line by themselves, so start them on the line's first cue words, not its last one.
- DAMAGE STAYS: a crash, a break, a crack, a flood or a jam stays in place until a fix removes it ("<move>Back", unbump, drain); never undo it inside its own beat.
- STATE LABEL: every problem beat may carry state: {text, w}: a red label of one to three words in caps (TOO FAST, BROKEN, NO POWER, CRASH!, FLOODED, STUCK, TOO HEAVY) shown from its word w (a word of that sentence) to the line's end. Give one on each problem beat.
- ARROWS BY COLOUR: arrows opts.color: water "#3ad6ff" (cyan), air or wind "#ffffff" (white), heat "#ff8a2a" (orange), force or weight "#ffd23d" (yellow). They point at an action, they never are it.
- BEFORE AND AFTER: a state change (a level, a colour, a material: clear to murky, dry to flooded, white ice to blue water) happens in ONE shot with the camera still: give the beat one shot only, the same as the beat before it where the change is the point.
- METERS: a value that changes (pressure, speed, weight, a count) is a counter (bar: true makes it a gauge whose bar fills and turns red past danger, 0.8 of the top by default: for a good value, a drain rate or a safe level, set danger above 1 so it stays green), its count on the words that say the change; it always reaches its final number. It stands right beside the thing it measures, and the beat's shot names both.
- A CONTROL BOX (a cabinet, a controller) stands next to what it controls, both in one shot, at least 1.2 m tall; when it runs a cycle, the light cycles fast (cycleFast) in the same shot.
${mode === "beats" ? `- SHOW ONLY WHAT THE KIT CAN SHOW: a beat whose idea the kit cannot show gets another idea that it can. The writer describes only what your beats show.` : `- IF THE KIT CANNOT SHOW A SENTENCE: rewrite that sentence so it says what the kit can show, keeping its numbers and facts and its length: sceneJson.rewrites [{role, text}]. The narration is recorded after your plan, so the rewrite is what is said.`}
- Something new every 2-3 s: every sentence has at least one action. Problems are visible (rain, flooding, a crack, a leak) and are fixed by the next part. By "Congratulations" the problem is gone: stop rain, clear the storm, hide arrows and flows, refill or cap the cut, add the finishing touches. The end is calm.
- Camera shots: about one per sentence, a fast move starts just before the sentence (or before the word in shot.word). focus is the ids of the parts to frame (["home"] = the home view). Size a shot by type, the shot vocabulary measured on the hand-built videos: wide (0.9 of the home distance), mid (0.7: most story shots), close (0.42: a crack, a newspaper, a machine's slot), detail (0.2: the holes in a pipe); or by width (how much of the frame width the parts fill: 0.3-0.5 for a prop, 0.6-1.0 for a long trench). Give type or width, not both. box (6 numbers: min x,y,z, max x,y,z) frames a region instead of parts. view: home (default), high (from above, for water on a surface), low (level, for a pipe in section), close (a detail on a wall); they all stay within 20 degrees of the home angle. The "This is a…" sentence's shot is hero: true (with a width). Congrats and finish are home shots.
- THE OPENING: the video opens close on its own hook object, never on the house. The hook beat's first shot (no word) frames the naive thing the hook line names, the thing a viewer already knows (the hole being dug, the machine's slot, the puddle at the wall, the car in the bay, the button), type close or mid. The home view comes later (the problem or how sentence) and at the end.
- THE MAIN SUBJECT: every shot keeps it in view (the cut, or the part you mark main: true when the story is a machine above ground); no shot of open lawn or sky. Side-story props (a flag, a book, a newspaper) stand beside the cut, just behind its back edge and inside the home frame, never out on the lawn. world.worker true only when the topic has a worker (by default there is none).
- Sound: library effects on events (digging, pouring, water rushing, dripping, flame, a pump hum), 3-5 of them; chimes on each number card, on the name sentence, and on "Congratulations"; cards on their number words. A rain bed (audio.rain: [from, to]) only when it rains.
${mode === "beats" ? `- Reply with "why", "story" and "sceneJson". story: title, hero (the named part, as the "This is a…" beat names it: "a landfill liner"), parts (plain nouns), ideas (one per beat, in beat order: {role, idea: what this beat means in the story, in one plain line, as the narrator would put it, e.g. "the box runs on a clock, so at midnight a lone car waits at an empty red"}), chain (one per problem beat: {problem: its role, causedBy: the role of the fix before it that caused it, "hook" for the first; shows: what we see happening; stakes: who or what suffers; size: 1-10, bigger every time}), surprises (3-4: {claim: a concrete checkable claim, ideally with a number; role: the beat that says it; search: a web search query}). A number card's word (audio.cards at.w) is the number as the narrator will say it ("600").
` : ""}- Reply with "why" and "sceneJson": the scene as JSON text with exactly the worked example's shape: {world: {cut: [x0, x1, z0, depth], house, porch, trees, road, rocksAvoid, backdrop?, worker?, moreTrees?}, parts: [{id, kind, params, base?}], beats: [{s, do: [...], shows: {p, does}, shots: [...]}], audio: {cards, sfx, chimes, rain}, rewrites?: [{role, text}]}. A part's base (optional) sets a channel's starting value. Numbers in world units.
- Verbs: an action is {p: part id, v: verb, w: the word in that sentence (as written, without punctuation; "" = the sentence start), o: seconds after the word (0), d: a duration to stretch the verb (0 = default), amp: 1, ch: "" (panels only: the panel channel)}.
- Reuse the worked example's settings when a part plays the same role (trench water, gravel with pebbles, soak pit, fabric, caps).
- In "why", say in two or three sentences what the scene is and how the camera tells it.

THE WORKED EXAMPLE: the ${EXAMPLE_TITLE[example] ?? premadeByKey(example)?.topic ?? example.replace(/_/g, " ")} video's layout, for its script:
${JSON.stringify(sceneFromLayout(template(example)))}${mode === "beats" && approvedScript(example) ? `
Its narration, written afterwards one sentence per beat (role: sentence), to show how cue words become words:
${approvedScript(example).sentences.map((s) => `${s.role}: ${s.text}`).join("\n")}` : ""}`;
const SCENE_SYSTEM = sceneSystem();

// the "Add ..." line names only finishing touches the setting has (catalog.js SETTING_PROPS), so a car wash never gets
// a traffic light or grass
const PROP_WORDS = { shrubs: "bushes", youngTrees: "young trees", fence: "a fence", grass: "a grass cap", canopy: "a canopy", "prop:mailbox": "a mailbox", "prop:planter": "a planter", "prop:bench": "a bench", "prop:trashCan": "a trash can", "prop:bikeRack": "a bike rack", "prop:kiosk": "a pay kiosk", "prop:vacuum": "a vacuum station", "prop:towelRack": "a towel rack", "prop:toolbox": "a toolbox", "prop:pottedPlant": "a potted plant" };
const propWords = (setting) => (SETTING_PROPS[setting] ?? []).map((k) => PROP_WORDS[k] ?? k).join(", ");
export function finishPropsLine(topic) {
  const t = ` ${normTopic(topic)} `;
  const pre = premadeByKey(classifyTopic(topic).premade ?? "") ?? PREMADE.find((p) => p.setting && p.aliases.some((x) => t.includes(` ${x} `)));
  const setting = pre?.setting ?? (INDOOR.test(topic) ? "room" : null);
  if (setting) return `The "Add ..." finishing line may only name things from this setting's list (it can also add a lid or cover to the thing itself): ${propWords(setting)}.`;
  return `The "Add ..." finishing line may only name things the setting it lives in has: a yard: ${propWords("yard")}; a street: ${propWords("street")}; a park: ${propWords("park")}; a garage: ${propWords("garage")}; a room: ${propWords("room")}; it can also add a lid or cover to the thing itself.`;
}

// topics that happen inside a home go in the room setting (its cut below the floor is the basement)
export const INDOOR = /\b(basement|sump|crawl ?space|indoor|inside (a|the|your) (house|home)|water heater|boiler|furnace|radiator|air condition\w*|\bac unit|heat pump|toilet|sink|shower|bathtub|dishwasher|smoke detector|fireplace|chimney|floor heating|underfloor)\b/i;
// the setting a topic belongs in: a premade topic's own (topics.js), else the room for indoor topics
export function settingHint(topic) {
  // a premade topic, or a custom one that names it ("how a traffic light knows your car is there")
  const t = ` ${normTopic(topic)} `;
  const pre = premadeByKey(classifyTopic(topic).premade ?? "") ?? PREMADE.find((p) => p.setting && p.aliases.some((x) => t.includes(` ${x} `)));
  const type = pre?.setting ?? (INDOOR.test(topic) ? "room" : null);
  if (!type) return "";
  return ` This topic belongs in the ${type} setting: use world.backdrop {type: "${type}"}${type === "room" ? " (the cut below its floor is the basement)" : ""}, and set house, worker, moreTrees and road to false. It is about the ${pre?.topic ?? "thing"} itself, as people meet it there.`;
}
/**
 * The saved parts of the kit's library (parts designed for earlier videos that passed every check: the kit grows by
 * itself) that match the text by name or synonym, best first, at most n.
 */
export function libraryMatches(library, text, n = 4) {
  const want = new Set(wordsOf(String(text)).filter((w) => w.length >= 3));
  const score = (e) => [e.name, ...(e.synonyms ?? [])].map((s) => { const ws = wordsOf(String(s)); return ws.length ? ws.filter((w) => want.has(w)).length / ws.length : 0; }).reduce((a, b) => Math.max(a, b), 0);
  return (library ?? []).map((e) => ({ e, s: score(e) })).filter((x) => x.s >= 0.5).sort((a, b) => b.s - a.s).slice(0, n).map((x) => x.e);
}

function sceneUser({ topic, title, sentences, hero, parts, lastOpening, chain = null, library = [] }) {
  // what the kit already has for this topic, before a part is designed: saved parts, then CC0 models
  const text = `${topic} ${hero ?? ""} ${(parts ?? []).join(" ")}`;
  const saved = libraryMatches(library, text), models = modelMatches(text, 12);
  return `Topic: ${topic} ("${title}").${settingHint(topic)} The named part: ${hero}. Things it needs to show: ${parts.join(", ")}.${lastOpening ? `\nThe previous video opened on ${lastOpening.what} (a ${lastOpening.kind}, ${lastOpening.type} shot) in the ${lastOpening.setting} setting: open this one on a different kind of object${lastOpening.setting === "yard" ? ", and in another setting if the topic allows" : ""}.` : ""}${saved.length ? `
SAVED PARTS (designed for earlier videos and checked; reuse one as a rig part: copy its recipe, change only id, pos, rotY and scale):
${saved.map((e) => `- ${e.name} (${(e.synonyms ?? []).join(", ")}): ${JSON.stringify(e.recipe)}`).join("\n")}` : ""}${models.length ? `
CC0 MODELS that may fit (use one as a model shape inside a rig when it is the thing, sized in metres; it cannot move by itself, so put moving pieces in their own nodes):
${models.map((m) => `- ${m.file}`).join("\n")}` : ""}
The script, one sentence per line, as "role: text":
${sentences.map((s) => `${s.role}: ${s.text}`).join("\n")}${chain?.length ? `
Each problem must be SHOWN happening on screen (its beat's shows does it), as the writer meant:
${chain.map((c) => `- ${sentences[c.problem]?.role ?? c.problem}: ${c.shows} (stakes: ${c.stakes})`).join("\n")}` : ""}`;
}

// how a layout opens: its setting, and the hook's first shot (the part it frames, its kind, its size)
export function openingOf(L) {
  const W = L.world ?? {}, setting = W.backdrop?.type ?? (W.house === false ? "plain" : "yard");
  const hook = (L.beats ?? []).find((b) => b.s === "hook"), sh = hook && [hook.shot, ...(hook.shots ?? [])].filter(Boolean).find((s) => !s.at?.w) ;
  if (!sh || sh.focus === "home" || (Array.isArray(sh.focus) && sh.focus.includes("home"))) return { setting, kind: "home", type: "home", what: "the home view" };
  const id = [].concat(sh.focus ?? [])[0], part = L.parts.find((p) => p.id === id);
  return { setting, kind: sh.box ? "region" : part?.kind ?? "region", type: sh.type ?? (sh.width ? `width ${sh.width}` : "mid"), what: id ?? "a region" };
}
// verbs that build something over time: at the first frame they are already under way (a third done), not finished;
// the dig itself is the exception (below)
const PROCESS = /^(dig|grow|fill|pour|rise|wipe|flow|seep|soak|build|stack)/;
export const OPEN_AT = 0.3;
/**
 * The hook object on screen at 0.3 s: the part the hook's first shot frames gets its first action moved to the start of
 * the video, so it is already there (a car parked in the bay, a machine standing) or already under way (the cut a
 * third dug). Returns { layout, moved: { part, verb } | null }.
 */
export function fixOpening(L) {
  const hook = (L.beats ?? []).find((b) => b.s === "hook");
  const sh = hook && [hook.shot, ...(hook.shots ?? [])].filter(Boolean).find((s) => !s.at?.w);
  if (!sh || sh.focus === "home") return { layout: L, moved: null };
  const cut = L.world?.cut, parts = new Map(L.parts.map((p) => [p.id, p]));
  // the part it frames: the first focus part, or for a region the part (with an action) that overlaps it most
  let id = [].concat(sh.focus ?? []).find((x) => parts.has(x));
  if (!id && sh.box) {
    const ov = (a, b) => Math.max(0, Math.min(a.max[0], b.max[0]) - Math.max(a.min[0], b.min[0])) * Math.max(0, Math.min(a.max[1], b.max[1]) - Math.max(a.min[1], b.min[1]));
    // only a part the hook sentence itself acts on (never a later highlight such as the "This is a…" outline)
    const acted = new Set((hook.do ?? []).map((a) => a.p));
    id = L.parts.filter((p) => acted.has(p.id)).map((p) => ({ id: p.id, o: (() => { try { const b = focusOf(p, cut); return b ? ov(b, sh.box) : 0; } catch { return 0; } })() })).sort((a, b) => b.o - a.o)[0]?.id;
    if (!id && parts.has("dig")) id = "dig";
  }
  if (!id) return { layout: L, moved: null };
  // its first action anywhere in the video (the one that makes it appear)
  const next = JSON.parse(JSON.stringify(L));
  for (const b of next.beats ?? []) for (const a of b.do ?? []) {
    if (a.p !== id) continue;
    const part = parts.get(id), list = VERBS[part.kind]?.[a.v] ?? (part.kind === "panels" ? [{ a: 0.02, b: 0.45 }] : null);
    if (!list) return { layout: L, moved: null };
    // a dig is shown mostly done (the hole open, its clumps landed): a third done is mid-burst, a cloud of dirt close up
    const r = list[0], len = r.b == null ? 0 : (a.d != null ? Number(a.d) : r.b - r.a), P = a.v === "dig" ? 0.8 : PROCESS.test(a.v) ? 0.35 : 1;
    // already on screen by 0.3 s: nothing to do (its sentence starts the video and its cue starts early enough)
    const start = OPEN_AT - (r.b == null ? 0.05 : P * len);
    // move it to the hook's start; it may begin before the first frame (then the video opens with it under way)
    const moved = { part: id, verb: a.v, from: b.s + (a.w ? `:${a.w}` : "") };
    const beat = next.beats.find((x) => x.s === "hook"), act = { ...a, o: +(start - r.a).toFixed(3) }; delete act.w;
    if (part.kind === "dig") { const first = [beat.shot, ...(beat.shots ?? [])].filter(Boolean).find((s) => !s.at?.w); if (first && (first.type === "close" || first.type === "detail" || (first.width ?? 0) > 0.8)) { delete first.width; first.type = "mid"; } }
    b.do.splice(b.do.indexOf(a), 1);
    beat.do = [act, ...(beat.do ?? [])];
    return { layout: next, moved };
  }
  return { layout: L, moved: null };
}

/** the opening rules: close on the hook object, and not the way the previous video opened */
export function openingProblems(L, last) {
  const o = openingOf(L), out = [];
  if (o.kind === "home") out.push("the hook opens on the home view: its first shot (no word) must frame the hook object close (type close or mid)");
  else if (last && o.kind === last.kind && o.setting === last.setting) out.push(`the video opens like the previous one (a ${o.kind} in the ${o.setting} setting): open on another kind of object${o.setting === "yard" ? " or in another setting" : ""}`);
  return out;
}

// the words a saved layout's beats, shots and sounds trigger on, by sentence role
export function anchorWords(L) {
  const out = {}; const add = (s, w) => { if (s && w) (out[s] ??= new Set()).add(w); };
  for (const b of L.beats ?? []) { for (const a of b.do ?? []) add(b.s, a.w); for (const sh of [b.shot, ...(b.shots ?? [])]) if (sh?.at) add(sh.at.s, sh.at.w); }
  for (const c of [...(L.audio?.cards ?? []), ...(L.audio?.sfx ?? [])]) add(c.at?.s, c.at?.w);
  for (const c of L.audio?.chimes ?? []) add(c.s, c.w);
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v]]));
}
const clean = (w) => String(w ?? "").toLowerCase().replace(/[^a-z0-9']/g, "");
// every anchor of a saved layout whose word is not in its sentence of the new script
export function missingWords(L, sentences) {
  const has = (s, w) => (sentences.find((x) => x.role === s)?.text ?? "").split(/\s+/).some((x) => clean(x) === clean(w));
  const out = [];
  (L.beats ?? []).forEach((b, bi) => {
    (b.do ?? []).forEach((a, ai) => { if (a.w && !has(b.s, a.w)) out.push({ s: b.s, w: a.w, what: `${a.v} ${a.p}`, path: ["beats", bi, "do", ai, "w"] }); });
    [b.shot, ...(b.shots ?? [])].forEach((sh, si) => { if (sh?.at?.w && !has(sh.at.s, sh.at.w)) out.push({ s: sh.at.s, w: sh.at.w, what: "the camera moves to the next shot", path: si === 0 ? ["beats", bi, "shot", "at", "w"] : ["beats", bi, "shots", si - 1, "at", "w"] }); });
  });
  for (const k of ["cards", "sfx"]) (L.audio?.[k] ?? []).forEach((c, i) => { if (c.at?.w && !has(c.at.s, c.at.w)) out.push({ s: c.at.s, w: c.at.w, what: k === "cards" ? `the number card ${c.text}` : `the sound ${c.lib}`, path: ["audio", k, i, "at", "w"] }); });
  (L.audio?.chimes ?? []).forEach((c, i) => { if (c.w && !has(c.s, c.w)) out.push({ s: c.s, w: c.w, what: "a chime", path: ["audio", "chimes", i, "w"] }); });
  return out;
}
export function applyWords(L, missing, words) {
  const next = JSON.parse(JSON.stringify(L));
  missing.forEach((m, i) => { const w = words.find((x) => x.index === i)?.word; if (!w) return; let o = next; for (const k of m.path.slice(0, -1)) o = o[k]; o[m.path.at(-1)] = w.replace(/[^\w',-]/g, ""); });
  return next;
}
// a line's inner sentence breaks joined: "It sucks. It spins." -> "It sucks; it spins." (an abbreviation like "Mr."
// before a capital is joined too, which reads the same)
// a word after "US" that is not a noun it describes ("the US uses", "in the US and"): there it is "America"
const NOT_NOUN = /^(is|are|was|were|has|have|had|and|or|but|to|in|on|at|for|with|by|from|of|alone|uses|makes|gets|still|now|today|each|every|a|an|the)$/;
/**
 * The narration in the one standard form the voice reads and the voice check compares (the owner's rule of
 * 2026-10-27, after "can not" and "US" failed the production Landfill's voice check): "cannot", no "US" ("American",
 * or "America"), units in full, long numbers with commas. Free; the writer is told the same.
 */
export function speakable(text) {
  return String(text)
    .replace(/\b([Cc])an not\b/g, "$1annot")
    .replace(/\b([Tt]he\s+)?(U\.S\.A\.|U\.S\.|USA|US)(?!\w)(\s+([A-Za-z]+))?/g, (m, the, us, sp, next) => (next && !NOT_NOUN.test(next) ? `${the ?? ""}American${sp}` : `America${sp ?? ""}`))
    // "3 a.m.": its full stops split the line in two wherever sentences are found by their full stop (the real traffic
    // light run of 2026-10-28 failed its plan on it): "3 AM" (a full stop kept only when it ended the text)
    .replace(/\b([ap])\.\s?m\.?(?=\s|[,;!?]|$)/gi, (m, x, off, str) => `${x.toUpperCase()}M${m.endsWith(".") && !str.slice(off + m.length).trim() ? "." : ""}`)
    .replace(/\bsq\.?\s?ft\b\.?/gi, "square feet")
    .replace(/(\d)\s*lbs?\b\.?/g, "$1 pounds").replace(/(\d)\s*ft\b\.?/g, "$1 feet").replace(/(\d)\s*gal\b\.?/g, "$1 gallons").replace(/(\d)\s*mph\b/gi, "$1 miles per hour")
    .replace(/(?<![\d.,])\d{5,}(?![\d.,]\d)/g, (n) => Number(n).toLocaleString("en-US"));
}

export function oneSentence(text) {
  // the next word is lowercased only when it is a common sentence start (names keep their capital)
  const START = /^(It|Its|It's|This|That|These|Those|The|A|An|And|But|So|Then|There|They|We|You|Your|He|She|Now|Each|Every|No|Not|Just|Even|Most|Some|All)$/;
  return speakable(String(text).trim()).replace(/([.!?])(["”']?)\s+([\w']+)/g, (m, p, close, next) => `${p === "?" ? "," : ";"}${close} ${START.test(next) ? next.toLowerCase() : next}`);
}
// anchors whose words are missing: they fall back to the start of their sentence (a negative offset is dropped)
export function dropWords(L, missing) {
  const next = JSON.parse(JSON.stringify(L));
  for (const m of missing) { let o = next; for (const k of m.path.slice(0, -1)) o = o[k]; delete o.w; if (o.o < 0) delete o.o; }
  return next;
}
const WORDS_SCHEMA = { type: "object", additionalProperties: false, required: ["words"], properties: { words: { type: "array", items: { type: "object", additionalProperties: false, required: ["index", "word"], properties: { index: { type: "integer" }, word: { type: "string" } } } } } };

/**
 * A planner's sentence rewrites (the kit can't show the original), taken only when they keep the sentence's numbers
 * and roughly its length. Returns { script, taken: [roles], refused: [reasons] }.
 */
export function applyRewrites(script, rewrites = []) {
  const nums = (t) => (String(t).match(/\d[\d,.]*/g) ?? []).map((x) => x.replace(/[,.]$/, ""));
  const words = (t) => String(t).split(/\s+/).filter(Boolean).length;
  let sentences = script.sentences.slice(); const taken = [], refused = [];
  for (const r of rewrites) {
    const i = sentences.findIndex((s) => s.role === r.role); if (i < 0) { refused.push(`${r.role}: no such sentence`); continue; }
    const old = sentences[i].text, lost = nums(old).filter((n) => !nums(r.text).includes(n));
    if (lost.length) { refused.push(`${r.role}: drops ${lost.join(", ")}`); continue; }
    if (Math.abs(words(r.text) - words(old)) > Math.max(4, words(old) * 0.4)) { refused.push(`${r.role}: length ${words(old)} -> ${words(r.text)} words`); continue; }
    sentences[i] = { ...sentences[i], text: oneSentence(r.text) }; taken.push(r.role);
  }
  return { script: { ...script, sentences }, taken, refused };
}

/** a scene patch applied to a whole scene (a repair's reply): beats replaced by sentence, parts by id, world keys */
export function mergeScene(scene, patch) {
  if (!patch || patch._bad || (!patch.beats && !patch.parts && !patch.world)) return patch?.world?.cut ? patch : scene; // a whole layout is still accepted
  const out = JSON.parse(JSON.stringify(scene));
  for (const b of patch.beats ?? []) { const i = out.beats.findIndex((x) => x.s === b.s); if (i >= 0) out.beats[i] = b; else out.beats.push(b); }
  for (const p of patch.parts ?? []) { const i = out.parts.findIndex((x) => x.id === p.id); if (i >= 0) out.parts[i] = p; else out.parts.push(p); }
  if (patch.world) out.world = { ...out.world, ...patch.world };
  if (patch.audio) for (const k of ["cards", "sfx", "chimes", "rain"]) if (patch.audio[k]) out.audio[k] = patch.audio[k];
  return out;
}
/**
 * The free trim (before a paid rewrite): filler words out of the longest lines first, until the narration is within the
 * limit. Never a cue word, a number, or a line's opening words (the formula: "If you", "But", "So you", "This is",
 * "And", "Add", "Congratulations"). Returns { script, cut: [the words taken out] }.
 */
const FILLER = ["just", "really", "very", "actually", "simply", "basically", "then", "also", "quickly", "slowly", "finally", "suddenly", "even", "still", "right", "all", "completely", "totally", "literally"];
export function trimNarration(script, { max, cues = {} } = {}) {
  const S = script.sentences.map((s) => ({ ...s })), cut = [];
  const total = () => S.reduce((k, s) => k + wordCount(s.text), 0);
  const keep = (s) => new Set([...(cues[s.role] ?? []).map(tok)]);
  for (const f of FILLER) {
    while (total() > max) {
      // the longest line holding this filler word after its first two words
      const cand = S.map((s, i) => ({ s, i, ws: s.text.split(/\s+/) })).filter(({ s, ws }) => ws.slice(2).some((w) => tok(w) === f && !keep(s).has(f))).sort((a, b) => b.ws.length - a.ws.length)[0];
      if (!cand) break;
      const j = cand.ws.findIndex((w, k) => k >= 2 && tok(w) === f);
      const w = cand.ws[j], tail = /[,.!?;:]$/.test(w) ? w.slice(-1) : "";
      cand.ws.splice(j, 1);
      if (tail && j > 0 && !/[,.!?;:]$/.test(cand.ws[j - 1])) cand.ws[j - 1] += tail;
      S[cand.i].text = cand.ws.join(" ").replace(/\s+,/g, ",").replace(/,\s*\./g, ".").replace(/\band and\b/g, "and");
      cut.push(`${S[cand.i].role}: ${f}`);
    }
  }
  // "and then" / ", and" repeats: "so you ... and so" -> keep one
  for (const s of S) if (total() > max && /\band so\b/i.test(s.text.split(/\s+/).slice(2).join(" "))) { s.text = s.text.replace(/(\S+\s+\S+\s.*?)\band so\b/i, "$1and"); cut.push(`${s.role}: so`); }
  return { script: { ...script, sentences: S }, cut };
}
const parseScene = (d) => { try { return JSON.parse(d.sceneJson); } catch (e) { return { _bad: e.message }; } };

export const KIT_CANNOT = [
  [/\b(both|two|all|four|every|each|other)\s+(roads|streets|directions|ways)\b|\bcross[- ]?(road|street|traffic)\b|\bside street\b/i, "the street has ONE road going away from the camera: say what happens on that road (cars queue at the red, one car waits)"],
  [/\bturns?\s+(left|right)\b|\bu-turns?\b/i, "cars only drive straight along the road: no turning"],
  [/\bpedestrians?\b|\bpeople (walk|cross)\b|\bchildren\b|\bkids\b/i, "the kit has no people: show the thing, not people using it"],
];
const checkScript = (s, lengthSec, roles) => {
  const P = [], L = LENGTH[lengthSec];
  const n = s.sentences.reduce((k, x) => k + x.text.split(/\s+/).filter(Boolean).length, 0);
  if (n < L.words[0] - 8 || overWords(n, lengthSec)) P.push(`${n} words (want ${L.words[0]}-${L.words[1]})`);
  const rs = s.sentences.map((x) => x.role);
  if (new Set(rs).size !== rs.length) P.push("a role is used twice");
  if (rs[0] !== "hook" || rs.at(-1) !== "congrats") P.push("the script must open with hook and end with congrats");
  if (!rs.includes("name")) P.push("no name sentence");
  if (roles && rs.join() !== roles.join()) P.push(`the roles must be exactly ${roles.join(", ")}`);
  for (const c of s.cards ?? []) { const t = s.sentences[c.sentence]?.text ?? ""; if (!t.split(/\s+/).some((w) => w.replace(/[^\w']/g, "") === c.word.replace(/[^\w']/g, ""))) P.push(`card "${c.text}": the word "${c.word}" is not in sentence ${c.sentence}`); }
  for (const x of s.sentences) if (!/[.!]$/.test(x.text.trim())) P.push(`sentence "${x.text.slice(0, 30)}…" must end with a full stop`);
  // promises the kit cannot keep (free, before the scene is paid for): both paid traffic light scripts said "cars pile
  // up down both roads" and the street has one road, so the preview check failed it twice
  for (const x of s.sentences) for (const [re, why] of KIT_CANNOT) if (re.test(x.text)) P.push(`"${x.text.slice(0, 50)}…": ${why}`);
  // the story chain: strict for a new layout; a saved layout's fixed roles (made before the rule) get it as guidance
  P.push(...chainProblems(s, { strict: !roles, lengthSec }));
  return P;
};

// ---------- visuals first, words second (the owner's rule of 2026-10-27) ----------
// The production Landfill of 2026-10-27 failed the preview check on problem, fix1 and problem2: its fresh script said
// "the plastic traps gas, and the pile bulges and cracks" over a scene that shows a gas pipe. The words were written
// first and the pictures could not follow. Now the beats come first (a premade topic: the approved layout's; a custom
// one: the planner's beat plan, checked free), and the writer writes one sentence per beat about what is on screen.

// the approved videos' scripts, sentence by sentence (layouts/approved_scripts.json, shipped in the worker image)
let APPROVED = null;
export function approvedScript(key) {
  if (!APPROVED) { try { APPROVED = JSON.parse(fs.readFileSync(path.join(here, "layouts", "approved_scripts.json"), "utf8")); } catch { APPROVED = {}; } }
  return APPROVED[key]?.sentences ? APPROVED[key] : null;
}

// the story rules the beat plan follows (the writer's formula, as beats)
const STORY_RULES = `THE STORY (the account's formula; you plan it as beats, one sentence each later):
- hook: "If you [one naive physical action], you have a [thing]." The video opens on that action.
- the chain: problem ("But [a visible consequence]") then fix ("So you [add one real part]"), repeated. Every fix causes the next, bigger problem ("So you add X. But now X does Y"): a CHAIN, not a list. Each problem is a concrete consequence you SEE happen (cars piling up at the red, water flooding the basement, the wall cracking, the creek turning grey), with visible stakes, never a dry fact. The first problem is the second beat.
- name: "This is a [real term]." (once; a second, name2, only in 60 s videos); how/fact beats show the mechanism working.
- myth: "And [what everyone thinks] is not [what it is]." Show the wrong idea first, then take it away; mythFact shows the real one.
- finish: "Add [two or three finishing touches]." then congrats: "Congratulations, you have built a [thing]." The end is calm.
- Surprises: three or four concrete, checkable claims, ideally with a number; they are fact-checked before the words are written.
- Roles: hook first, congrats last, finish just before it; problem roles are problem, problem2, problem3 (flood and stakes may deepen a problem); fix roles are fix1..fix5. One beat per role.
WHAT THE SETTINGS REALLY CONTAIN (plan only what is there):
- street: ONE straight road going away from the camera, one crosswalk, one signal on its corner, a sidewalk with shop fronts. Cars drive one way along that road: they arrive, stop, queue nose to tail at the line, wait, drive off, and can bump the car ahead. No cross road or second road, no turning, no pedestrians.
- yard: a house, a lawn, a fence, trees and the ground cut open in section below; rain, water and pipes.
- garage: a garage with one wide opening on a driveway, a car, shelves inside.
- room: a room with a floor (the basement below in section), a wall with a window, an armchair.
- car wash: a lot with a wash bay, a car going through.
No people doing things, no maps, no long text on screens, no outer space or the body.`;

const WORDS_SYSTEM = `You write the narration of a short vertical cutaway explainer video whose pictures are ALREADY planned and built: a 3D diorama where a thing is built step by step while one narrator talks. You get its beats in order. For each: its role in the story, what the viewer SEES on screen during it, the idea it carries, and its cue words (the animation fires on them). Write exactly one sentence per beat, in that order.
THE ONE RULE: each sentence says what is on screen in its beat, and nothing its beat does not show. Where the idea and the picture disagree, follow the picture.
Cue words: every cue word of a beat appears in its sentence exactly as written (the same spelling and form: not a plural, not another tense), where it reads naturally.
The account's formula (keep it):
HOOK      "If you [one naive physical action], you have a [thing]." (16 words or fewer)
CHAIN     "But [the visible consequence]." then "So you [add the part]." Every "But…" after the first names the part the fix before it added, or starts with "But now" (checked by code).
NAME      "This is a [real term]."
MYTH-BUST "And [the thing everyone knows] is not [what they think]." then what it really is.
FINISH    "Add [the finishing touches shown]." then "Congratulations, you have built a [thing]."
Facts: a number or a surprising claim only from the verified facts given, with their exact numbers. No other numbers.
Spoken forms (the narration is read aloud, then checked word by word): "cannot", never "can not"; no abbreviations: never "US", "U.S." or "USA" (write "American" or "America"), units in full ("square feet", "pounds", "gallons"); numbers as digits with a comma for thousands ("1,500"), years as 4 digits ("1952"), times as "3 AM" (never "a.m.").
Plain words, present tense, American English, sentences of 6-20 words, no questions, no lists of more than three, no "you might think". Each sentence ends with a full stop.`;
const NARRATION_SCHEMA = { type: "object", additionalProperties: false, required: ["title", "sentences"], properties: { title: { type: "string" }, sentences: { type: "array", items: { type: "object", additionalProperties: false, required: ["role", "text"], properties: { role: { type: "string" }, text: { type: "string" } } } } } };

const prettyId = (id) => String(id).replace(/([a-z])([A-Z0-9])/g, "$1 $2").toLowerCase();
/** what a beat of a layout shows, in plain words (what the writer is told the viewer sees) */
export function beatBrief(L, role) {
  const b = (L.beats ?? []).find((x) => x.s === role);
  if (!b) return "the finished build, calm";
  const acts = (b.do ?? []).map((a) => `${prettyId(a.p)} ${a.v}${a.w ? ` (on "${a.w}")` : ""}`);
  return [b.shows?.does, acts.length ? `actions: ${acts.join("; ")}` : null].filter(Boolean).join(". ") || "the finished build, calm";
}
function wordsUser({ topic, lengthSec, beats, facts = [] }) {
  const L = LENGTH[lengthSec];
  return `Topic: ${topic}
Length: ${lengthSec} s: ${L.words[0]}-${L.words[1]} words in all, one sentence per beat (${beats.length} sentences).
Word budget: aim for ${Math.round((L.words[0] + L.words[1]) / 2)} words in all, about ${Math.round((L.words[0] + L.words[1]) / 2 / beats.length)} words a sentence (the hook up to 16; the name line and congrats short, so the others may run a little longer). Count before you answer: over ${L.words[1]} words is too long.
${facts.length ? `Verified facts (the only numbers and claims you may use, word for word where you use them):\n${facts.map((f) => `- ${f}`).join("\n")}\n` : "No verified facts: use no numbers.\n"}
The beats, in order:
${beats.map((b, i) => `${i + 1}. ${b.role}
   on screen: ${b.sees}${b.idea ? `\n   idea: ${b.idea}` : ""}
   cue words: ${b.cues.length ? b.cues.map((w) => `"${w}"`).join(", ") : "(none)"}${b.fact ? `\n   its fact: ${b.fact}` : ""}${b.approved ? `\n   the approved sentence for this beat (it matches the picture): "${b.approved}". Say the same thing in fresh words, or keep it if it is already the best way to say it.` : ""}`).join("\n")}`;
}

const tok = (w) => String(w ?? "").toLowerCase().replace(/[^a-z0-9']/g, "").replace(/'s$/, "");
const numbersIn = (t) => (String(t).match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((x) => x.replace(/,/g, "").replace(/\.$/, ""));
/**
 * One written sentence against its beat (free): its cue words, its numbers (only allowed ones; the must-haves kept),
 * what the kit cannot show, its length and its full stop. Returns the problems.
 */
export function sentenceProblems(text, { cues = [], allowed = null, must = [], words = null } = {}) {
  const P = [], toks = String(text).split(/\s+/).map(tok);
  for (const c of cues) if (c && !toks.includes(tok(c))) P.push(`cue word "${c}" is missing`);
  const nums = numbersIn(text);
  if (allowed) for (const n of nums) if (!allowed.includes(n) && !(Number(n) <= 12 && !/\./.test(n))) P.push(`the number ${n} is not in the verified facts`);
  for (const n of must) if (!nums.includes(n)) P.push(`the number ${n} is missing`);
  for (const [re, why] of KIT_CANNOT) if (re.test(text)) P.push(why);
  const n = toks.filter(Boolean).length;
  // (a line's own length is a tolerance only: the whole narration's count is the limit; a line far out still fails)
  if (n < 3 || n > 34) P.push(`${n} words`);
  if (words && (n > words * 2 + 4 || n < words * 0.4)) P.push(`${n} words where the beat had ${words}`);
  if (!/[.!]$/.test(String(text).trim())) P.push("no full stop");
  return P;
}

/**
 * A premade topic: the approved layout's beats and their approved sentences; the writer says each in fresh words around
 * the same cue words. A sentence that fails its free checks keeps its approved wording (and so does the whole script
 * if the whole fails). Returns { script, changedRoles, costUsd } or null (no approved script: the old path).
 */
async function planPremade({ step, topic, lengthSec, saved, key, trace }) {
  const A = approvedScript(key);
  if (!A || A.sentences.map((s) => s.role).join() !== (saved.roles ?? []).join()) return null;
  const cues = anchorWords(saved);
  const beats = A.sentences.map((s) => ({ role: s.role, approved: s.text, sees: beatBrief(saved, s.role), cues: cues[s.role] ?? [] }));
  const facts = (saved.facts ?? []).filter((f) => f.verdict !== "drop").map((f) => f.claim);
  let fresh = null;
  try { fresh = (await step("words", { system: WORDS_SYSTEM, user: wordsUser({ topic, lengthSec, beats, facts }), schema: NARRATION_SCHEMA, effort: "medium", maxTokens: 8000 })).data; }
  catch (e) { if (e.code === "REPLAY_PENDING" || /credit balance|insufficient/i.test(e.message)) throw e; trace.push({ label: "words failed: the approved script is used", error: String(e.message).slice(0, 200) }); }
  const kept = [];
  let sentences = A.sentences.map((s) => {
    const cand = fresh?.sentences?.find((x) => x.role === s.role)?.text;
    if (!cand) { kept.push({ role: s.role, why: "no fresh sentence" }); return { ...s }; }
    const text = oneSentence(cand);
    const p = sentenceProblems(text, { cues: cues[s.role] ?? [], allowed: numbersIn(s.text), must: numbersIn(s.text), words: s.text.split(/\s+/).length });
    if (p.length) { kept.push({ role: s.role, why: p.join("; ") }); return { ...s }; }
    return { role: s.role, text };
  });
  // the whole: its chain (a "But" that no longer names its fix gets "now", free) and no new problem the approved has not
  sentences = linkProblems({ sentences }).script.sentences;
  // (compared by kind: a problem quotes its sentence, and the fresh sentence is worded differently)
  const kind = (p) => p.replace(/"[^"]*"/g, '""').replace(/\d+/g, "#");
  const own = new Set(checkScript({ sentences: A.sentences }, lengthSec, A.sentences.map((s) => s.role)).map(kind));
  const wholeProblems = () => checkScript({ sentences }, lengthSec, A.sentences.map((s) => s.role)).filter((p) => !own.has(kind(p)));
  let fresh2 = wholeProblems();
  // a problem that names its sentence ("problem "But now the soapy…" is not…"): that sentence goes back to its approved
  // wording, not the whole script
  for (const p of fresh2.filter((x) => !/words \(want/.test(x))) {
    const frag = p.match(/"([^"]{12,}?)(?:…)?"/)?.[1]?.replace(/…$/, "");
    const i = frag ? sentences.findIndex((s) => s.text.startsWith(frag)) : -1;
    if (i >= 0 && sentences[i].text !== A.sentences[i].text) { kept.push({ role: sentences[i].role, why: p }); sentences[i] = { ...A.sentences[i] }; }
  }
  fresh2 = wholeProblems();
  // too long or short as a whole: the sentences that grew (or shrank) most go back to their approved wording, one at a
  // time, until it fits (the rest keep their fresh words)
  if (fresh2.length && fresh2.every((p) => /words \(want/.test(p))) {
    const n = (t) => t.split(/\s+/).filter(Boolean).length, long = fresh2.some((p) => Number(p.match(/^(\d+)/)?.[1]) > LENGTH[lengthSec].words[1]);
    const order = sentences.map((s, i) => ({ i, d: (n(s.text) - n(A.sentences[i].text)) * (long ? 1 : -1) })).filter((x) => x.d > 0).sort((p, q) => q.d - p.d);
    for (const { i } of order) { kept.push({ role: sentences[i].role, why: "the whole was too long or short" }); sentences[i] = { ...A.sentences[i] }; fresh2 = wholeProblems(); if (!fresh2.length) break; }
  }
  if (fresh2.length) { trace.push({ label: "the fresh script as a whole failed: the approved script is used", problems: fresh2 }); sentences = A.sentences.map((s) => ({ ...s })); }
  if (kept.length) trace.push({ label: "approved wording kept", sentences: kept });
  const changedRoles = sentences.filter((s, i) => s.text !== A.sentences[i].text).map((s) => s.role);
  return { script: { title: A.title, hero: A.hero, sentences, cards: A.cards ?? [], parts: A.parts ?? [], facts: saved.facts ?? [] }, changedRoles };
}

// the beat plan's reply: the scene (as JSON text) and the story
const BEATS_REPLY_SCHEMA = { type: "object", additionalProperties: false, required: ["why", "story", "sceneJson"], properties: {
  why: { type: "string" }, sceneJson: { type: "string" },
  story: { type: "object", additionalProperties: false, required: ["title", "hero", "parts", "ideas", "chain", "surprises"], properties: {
    title: { type: "string" }, hero: { type: "string" }, parts: { type: "array", items: { type: "string" } },
    ideas: { type: "array", items: { type: "object", additionalProperties: false, required: ["role", "idea"], properties: { role: { type: "string" }, idea: { type: "string" } } } },
    chain: { type: "array", items: { type: "object", additionalProperties: false, required: ["problem", "causedBy", "shows", "stakes", "size"], properties: { problem: { type: "string" }, causedBy: { type: "string" }, shows: { type: "string" }, stakes: { type: "string" }, size: { type: "integer" } } } },
    surprises: { type: "array", items: { type: "object", additionalProperties: false, required: ["claim", "role", "search"], properties: { claim: { type: "string" }, role: { type: "string" }, search: { type: "string" } } } },
  } } } };
const CLAIMS_SCHEMA = { type: "object", additionalProperties: false, required: ["checks"], properties: { checks: { type: "array", items: { type: "object", additionalProperties: false, required: ["index", "verdict", "claim", "why", "sources"], properties: { index: { type: "integer" }, verdict: { type: "string", enum: ["keep", "reword", "drop"] }, claim: { type: "string" }, why: { type: "string" }, sources: { type: "array", items: { type: "object", additionalProperties: false, required: ["url", "title"], properties: { url: { type: "string" }, title: { type: "string" } } } } } } } } };
const CLAIMS_SYSTEM = `You fact-check the surprise claims planned for a short explainer video, before its narration is written. For each claim: verdict "keep" if the research notes support it as written; "reword" if the true version is close (give the claim with exactly the wording and numbers the sources support, e.g. "over 600 gallons" for a rounded figure, "New England" instead of a wrong state); "drop" if it is false, unsupported or a myth. Judge ONLY from the research notes (a claim they do not support is dropped) and copy the source URLs from them (url and title) for keep and reword.`;

const ROLE_OPEN = (role) => (/^problem/.test(role) ? "But " : /^fix/.test(role) ? "So you " : role === "name" || role === "name2" ? "This is " : role === "hook" ? "If you " : "");
/** stand-in sentences for a beat plan (its idea and its cue words), so the free checks run before the words exist */
export function draftSentences(L, ideas) {
  const cues = anchorWords(L);
  return (L.beats ?? []).map((b) => {
    const idea = speakable(String(ideas[b.s] ?? b.shows?.does ?? b.s)).replace(/[.!?]+\s*$/, ""), have = new Set(idea.split(/\s+/).map(tok));
    const extra = (cues[b.s] ?? []).filter((w) => !have.has(tok(w)));
    return { role: b.s, text: `${ROLE_OPEN(b.s)}${idea}${extra.length ? ` ${extra.join(" ")}` : ""}.`.replace(/^(But|So you) (but|so you)\b/i, "$1") };
  });
}
/** the beat plan's story (free): roles in order, the chain of problems (caused by the fix before, bigger each time), the surprises */
/** the beat plan's story bookkeeping, fixed for free (it is derived from the beats; the checks then judge the story) */
export function fixStory(story0, scene) {
  const story = JSON.parse(JSON.stringify(story0 ?? {})), beats = scene?.beats ?? [], roles = beats.map((b) => b.s);
  const ideas = new Map((story.ideas ?? []).map((x) => [x.role, x.idea]));
  story.ideas = roles.map((r) => ({ role: r, idea: String(ideas.get(r) ?? "").trim() || String(beats.find((b) => b.s === r)?.shows?.does ?? "").trim() || r }));
  const probs = roles.filter((r) => /^problem/.test(r)), byP = new Map((story.chain ?? []).map((c) => [c.problem, c]));
  let last = 0;
  story.chain = probs.map((r, k) => {
    const c = { ...(byP.get(r) ?? { problem: r }) }, i = roles.indexOf(r);
    c.causedBy = k === 0 ? "hook" : roles.slice(0, i).filter((x) => /^fix/.test(x)).at(-1) ?? c.causedBy ?? "hook";
    if (String(c.shows ?? "").split(/\s+/).filter(Boolean).length < 3) c.shows = String(beats.find((b) => b.s === r)?.shows?.does ?? ideas.get(r) ?? r);
    if (String(c.stakes ?? "").split(/\s+/).filter(Boolean).length < 2) c.stakes = c.stakes || "the build fails";
    c.size = Math.max(Number(c.size) || 0, last + 1); last = c.size;
    return c;
  });
  story.surprises = (story.surprises ?? []).filter((s) => roles.includes(s.role));
  for (const b of beats) for (const a of b.do ?? []) if (a.w && !/^[A-Za-z0-9'-]+$/.test(a.w)) { const m = String(a.w).match(/[A-Za-z0-9'-]+/); if (m) a.w = m[0]; else delete a.w; }
  return story;
}
export function beatPlanProblems(L, story, lengthSec) {
  const P = [], roles = (L.beats ?? []).map((b) => b.s), R = LENGTH[lengthSec];
  if (roles[0] !== "hook" || roles.at(-1) !== "congrats") P.push("the beats must start with hook and end with congrats");
  if (!roles.includes("name")) P.push('no "name" beat (This is a…)');
  if (new Set(roles).size !== roles.length) P.push("a role is used twice");
  for (const r of roles) if (!ROLES.includes(r)) P.push(`role "${r}" is not one of ${ROLES.join(", ")}`);
  if (roles.length < R.beats[0] || roles.length > R.beats[1]) P.push(`${roles.length} beats (want ${R.beats[0]}-${R.beats[1]})`);
  const ideas = new Map((story?.ideas ?? []).map((x) => [x.role, x.idea]));
  for (const r of roles) if (!String(ideas.get(r) ?? "").trim()) P.push(`beat ${r}: no idea`);
  const probs = roles.filter((r) => /^problem/.test(r)), need = lengthSec >= 60 ? 3 : 2;
  if (probs.length < need) P.push(`the story needs at least ${need} problem beats; it has ${probs.length}`);
  if (probs.length && roles.indexOf(probs[0]) !== 1) P.push("the first problem must be the second beat, right after the hook");
  const chain = new Map((story?.chain ?? []).map((c) => [c.problem, c]));
  let last = -Infinity;
  for (const [k, r] of probs.entries()) {
    const c = chain.get(r); if (!c) { P.push(`chain: no entry for ${r}`); continue; }
    const i = roles.indexOf(r), before = roles.slice(0, i).filter((x) => /^fix/.test(x)).at(-1);
    if (k === 0 ? c.causedBy !== "hook" : c.causedBy !== before) P.push(`chain: ${r} must be caused by ${k === 0 ? "the hook" : before ?? "a fix before it"} (it says ${c.causedBy})`);
    if (String(c.shows ?? "").split(/\s+/).filter(Boolean).length < 3) P.push(`chain: ${r} must say what is seen happening`);
    if (!(Number(c.size) > last)) P.push(`chain: ${r} must be bigger than the problem before it`); last = Number(c.size);
  }
  for (const s of story?.surprises ?? []) if (!roles.includes(s.role)) P.push(`surprise "${String(s.claim).slice(0, 40)}…": no beat ${s.role}`);
  for (const r of roles) for (const [re, why] of KIT_CANNOT) if (re.test(ideas.get(r) ?? "")) P.push(`beat ${r}: ${why}`);
  for (const b of L.beats ?? []) for (const a of b.do ?? []) if (a.w && !/^[A-Za-z0-9'-]+$/.test(a.w)) P.push(`beat ${b.s}: cue word "${a.w}" must be one plain word`);
  return P;
}
/** a cue word written in another form ("pipe" said as "pipes"): the anchors move to the word as written (free) */
export function retargetCues(L, sentences) {
  const next = JSON.parse(JSON.stringify(L)), moved = [];
  const stemOf = (w) => tok(w).replace(/(ings?|ed|es|s|d)$/, "");
  const fix = (s, w) => {
    const t = sentences.find((x) => x.role === s)?.text ?? "", toks = t.split(/\s+/).map((x) => x.replace(/[^\w'-]/g, ""));
    if (!w || toks.some((x) => tok(x) === tok(w))) return w;
    const hit = toks.find((x) => x && stemOf(x) === stemOf(w));
    if (hit) { moved.push(`${s}: "${w}" -> "${hit}"`); return hit; }
    return w;
  };
  for (const b of next.beats ?? []) { for (const a of b.do ?? []) if (a.w) a.w = fix(b.s, a.w); for (const sh of [b.shot, ...(b.shots ?? [])]) if (sh?.at?.w) sh.at.w = fix(sh.at.s ?? b.s, sh.at.w); }
  for (const k of ["cards", "sfx"]) for (const c of next.audio?.[k] ?? []) if (c.at?.w) c.at.w = fix(c.at.s, c.at.w);
  for (const c of next.audio?.chimes ?? []) if (c.w) c.w = fix(c.s, c.w);
  return { layout: next, moved };
}

/**
 * A custom topic, visuals first: 1. the beat plan (scene + story, checked free; one repair), 2. the fact-check of its
 * claims, 3. the words, one sentence per beat (checked free; one repair; a cue word still missing then fires at its
 * sentence's start). Returns what planTopic returns.
 */
async function planCustom({ step, topic, lengthSec, example, lastOpening, library, trace }) {
  const key = topic.toLowerCase().replace(/^(a|an|the)\s+/, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
  const SYS = sceneSystem(example, "beats"), R = LENGTH[lengthSec];
  const text = `${topic}`;
  const saved = libraryMatches(library, text), models = modelMatches(text, 12);
  const user = `Topic: ${topic}.${settingHint(topic)}
Length: ${lengthSec} s: ${R.beats[0]}-${R.beats[1]} beats (the narration will be ${R.words[0]}-${R.words[1]} words). Roles: ${ROLES.join(", ")}.
${finishPropsLine(topic)}${lastOpening ? `\nThe previous video opened on ${lastOpening.what} (a ${lastOpening.kind}, ${lastOpening.type} shot) in the ${lastOpening.setting} setting: open this one on a different kind of object${lastOpening.setting === "yard" ? ", and in another setting if the topic allows" : ""}.` : ""}${saved.length ? `
SAVED PARTS (designed for earlier videos and checked; reuse one as a rig part: copy its recipe, change only id, pos, rotY and scale):
${saved.map((e) => `- ${e.name} (${(e.synonyms ?? []).join(", ")}): ${JSON.stringify(e.recipe)}`).join("\n")}` : ""}${models.length ? `
CC0 MODELS that may fit (use one as a model shape inside a rig when it is the thing, sized in metres; it cannot move by itself, so put moving pieces in their own nodes):
${models.map((m) => `- ${m.file}`).join("\n")}` : ""}`;
  const plan = (r) => {
    const scene = parseScene(r.data), story = fixStory(r.data.story ?? {}, scene);
    const roles = (scene.beats ?? []).map((b) => b.s);
    const conv = layoutFromScene(scene, { key, title: story.title || topic, roles });
    const ideas = Object.fromEntries((story.ideas ?? []).map((x) => [x.role, x.idea]));
    const draft = draftSentences(conv.layout, ideas);
    const solved = solveLayout(conv.layout, draft);
    const problems = [...conv.problems, ...beatPlanProblems(conv.layout, story, lengthSec), ...solved.problems];
    return { scene, story, conv, ideas, draft, problems, warnings: [...solved.warnings, ...openingProblems(conv.layout, lastOpening).map((p) => `${p} (fixed after the plan: the hook shot is moved)`)], why: r.data.why };
  };
  // 1. the beat plan
  let r = await step("beats plan", { system: SYS, user, schema: BEATS_REPLY_SCHEMA, effort: "high", maxTokens: 64000 });
  let B = plan(r);
  trace.push({ label: "beat plan checks", problems: B.problems, warnings: B.warnings, opening: openingOf(B.conv.layout) });
  if (B.problems.length) {
    r = await step("beats repair", { system: SYS, user: `${user}\n\nYour beat plan below has problems the free checks found. Fix every one and return the whole plan again (change only what the problems need).\nProblems:\n- ${B.problems.join("\n- ")}\n${B.warnings.length ? `Warnings (fix them if you can):\n- ${B.warnings.join("\n- ")}\n` : ""}\nYour story:\n${JSON.stringify(B.story)}\nYour layout (sceneJson):\n${r.data.sceneJson}`, schema: BEATS_REPLY_SCHEMA, effort: "high", maxTokens: 64000 });
    const B2 = plan(r);
    // a repeat opening after the repair is a warning: the video still goes on
    const opening = openingProblems(B2.conv.layout, lastOpening);
    B = { ...B2, problems: B2.problems.filter((p) => !opening.includes(p)), warnings: [...B2.warnings, ...opening] };
    trace.push({ label: "beat plan checks (repair)", problems: B.problems, warnings: B.warnings });
  }
  // (hold: a custom plan's motions hold at 70% of travel through their line and its problem lines carry a red state
  // label; compile.mjs. Premade keeps its approved timing)
  let layout = { ...B.conv.layout, why: B.why, hold: true };
  const roles = layout.beats.map((b) => b.s);
  if (B.problems.length) return { script: { title: B.story.title || topic, hero: B.story.hero, sentences: B.draft, chain: [], facts: [], cards: [] }, layout, problems: B.problems, warnings: B.warnings };

  // 2. the facts: the planned claims, researched and checked before any word is written
  const claims = (B.story.surprises ?? []).filter((s) => roles.includes(s.role));
  let checks = [];
  if (claims.length) {
    const list = `Claims (index: claim | suggested search):\n${claims.map((c, i) => `${i}: ${c.claim} | ${c.search}`).join("\n")}`;
    let rs = await step("fact research", { system: RESEARCH_SYSTEM, user: `Topic: ${topic}\n${list}`, schema: null, search: Math.min(10, 2 * claims.length + 2), effort: "medium", maxTokens: 24000 });
    if (rs.searches < claims.length) rs = await step("fact research (again)", { system: RESEARCH_SYSTEM, user: `Topic: ${topic}\n${list}\n\nSearch the web for EACH claim now; an answer without searches is refused.`, schema: null, search: Math.min(10, 2 * claims.length + 2), effort: "medium", maxTokens: 24000 });
    if (rs.searches < 1) throw new Error("fact-check: no web search was made; the facts are not verified");
    const fc = await step("fact-check", { system: CLAIMS_SYSTEM, user: `Topic: ${topic}\n${list}\n\nResearch notes (from ${rs.searches} web searches):\n${rs.data.text}\n\nSources found:\n${rs.data.sources.map((s) => `- ${s.title} ${s.url}`).join("\n")}`, schema: CLAIMS_SCHEMA, effort: "medium", maxTokens: 16000 });
    checks = (fc.data.checks ?? []).map((c) => ({ ...c, role: claims[c.index]?.role, planned: claims[c.index]?.claim }));
  }
  // a number card follows its claim: a reworded number moves with it, a dropped claim's card goes (free)
  const kept = checks.filter((c) => c.verdict !== "drop" && c.role);
  const verifiedNums = kept.flatMap((c) => numbersIn(c.claim));
  for (const c of checks.filter((x) => x.role)) {
    const was = numbersIn(c.planned), now = c.verdict === "drop" ? [] : numbersIn(c.claim);
    layout.audio.cards = (layout.audio.cards ?? []).flatMap((card) => {
      if (card.at?.s !== c.role) return [card];
      const i = was.indexOf(String(card.at.w ?? "").replace(/,/g, ""));
      if (i < 0) return [card];
      if (!now[i]) return [];
      return [{ ...card, at: { ...card.at, w: Number(now[i]).toLocaleString("en-US") }, text: card.text.replace(/[\d,.]+/, Number(now[i]).toLocaleString("en-US")) }];
    });
    // cue words that were a dropped or changed number fire at the sentence's start instead
    for (const b of layout.beats) if (b.s === c.role) for (const a of b.do ?? []) if (/^\d/.test(a.w ?? "") && !now.includes(String(a.w).replace(/,/g, ""))) delete a.w;
    // a meter showing that number follows it too (the free aquarium run: the check made 88 degrees 86, its gauge still
    // climbed to 88)
    for (const p of layout.parts.filter((q) => q.kind === "counter")) for (const k of ["from", "to"]) {
      const i = was.indexOf(String(p.params?.[k] ?? "")); if (i >= 0 && now[i] != null && now[i] !== was[i]) p.params[k] = Number(now[i]);
    }
  }
  // a card whose number no verified fact of its beat says (the recorded garage door plan carded "100" while its checked
  // fact said 150 to 250 pounds): it takes its beat's verified number, or goes (free)
  layout.audio.cards = (layout.audio.cards ?? []).flatMap((card) => {
    const w = String(card.at?.w ?? "").replace(/,/g, "");
    if (!/^\d/.test(w)) return [card];
    const nums = kept.filter((c) => c.role === card.at?.s).flatMap((c) => numbersIn(c.claim));
    if (nums.includes(w)) return [card];
    const used = new Set((layout.audio.cards ?? []).filter((x) => x !== card && x.at?.s === card.at?.s).map((x) => String(x.at?.w ?? "").replace(/,/g, "")));
    const n = nums.find((x) => !used.has(x));
    return n ? [{ ...card, at: { ...card.at, w: Number(n).toLocaleString("en-US") }, text: card.text.replace(/[\d,.]+/, Number(n).toLocaleString("en-US")) }] : [];
  });
  for (const b of layout.beats) for (const a of b.do ?? []) if (/^\d/.test(a.w ?? "") && !kept.some((c) => c.role === b.s && numbersIn(c.claim).includes(String(a.w).replace(/,/g, "")))) delete a.w;
  // the chime that rings with a card, a sound or a shot on a number: it follows the card's verified number, or starts
  // with its sentence (the garage door's and the pool's chimes still pointed at their old numbers)
  const verifiedIn = (role, w) => kept.some((c) => c.role === role && numbersIn(c.claim).includes(String(w).replace(/,/g, "")));
  const cardNum = (role) => (layout.audio.cards ?? []).find((c) => c.at?.s === role && /^\d/.test(String(c.at?.w ?? "")))?.at.w;
  for (const c of layout.audio.chimes ?? []) if (/^\d/.test(String(c.w ?? "")) && !verifiedIn(c.s, c.w)) { const n = cardNum(c.s); if (n) c.w = n; else delete c.w; }
  for (const c of layout.audio.sfx ?? []) if (/^\d/.test(String(c.at?.w ?? "")) && !verifiedIn(c.at.s, c.at.w)) { const n = cardNum(c.at.s); if (n) c.at.w = n; else delete c.at.w; }
  for (const b of layout.beats) for (const sh of [b.shot, ...(b.shots ?? [])]) if (sh?.at && /^\d/.test(String(sh.at.w ?? "")) && !verifiedIn(sh.at.s ?? b.s, sh.at.w)) delete sh.at.w;
  trace.push({ label: "facts", kept: kept.length, dropped: checks.length - kept.length, cards: (layout.audio.cards ?? []).map((c) => c.text) });

  // 3. the words, one sentence per beat
  const cuesOf = () => anchorWords(layout);
  const factOf = (role) => kept.filter((c) => c.role === role).map((c) => c.claim).join("; ");
  const beats = roles.map((role) => ({ role, sees: beatBrief(layout, role), idea: B.ideas[role], cues: cuesOf()[role] ?? [], fact: factOf(role) }));
  const toScript = (data) => {
    // (by role; a writer that returned one sentence per beat under other role names is read in order: free)
    const byOrder = (data.sentences ?? []).length === roles.length;
    const sentences = roles.map((role, i) => ({ role, text: oneSentence(data.sentences?.find((x) => x.role === role)?.text ?? (byOrder ? data.sentences[i]?.text : "") ?? "") }));
    const chain = (B.story.chain ?? []).map((c) => ({ problem: roles.indexOf(c.problem), causedBy: c.causedBy === "hook" ? -1 : roles.indexOf(c.causedBy), shows: c.shows, stakes: c.stakes, size: c.size })).filter((c) => c.problem >= 0);
    const linked = linkProblems({ sentences, chain }).script.sentences;
    const cards = (layout.audio.cards ?? []).map((c) => ({ text: c.text, sentence: roles.indexOf(c.at.s), word: String(c.at.w ?? "") }));
    return { title: data.title || B.story.title || topic, hero: B.story.hero, sentences: linked.map((s) => ({ ...s, text: /[.!]$/.test(s.text.trim()) ? s.text : `${s.text.trim()}.` })), chain, cards, parts: B.story.parts ?? [], surprises: claims, facts: checks };
  };
  const wordsCheck = (script) => {
    const rt = retargetCues(layout, script.sentences); layout = rt.layout;
    const cues = cuesOf(), P = [];
    for (const s of script.sentences) for (const p of sentenceProblems(s.text, { cues: cues[s.role] ?? [], allowed: verifiedNums })) P.push(`${s.role}: ${p}`);
    P.push(...checkScript({ ...script, cards: [] }, lengthSec, roles));
    return { P, moved: rt.moved };
  };
  let w = await step("words", { system: WORDS_SYSTEM, user: wordsUser({ topic, lengthSec, beats, facts: kept.map((c) => c.claim) }), schema: NARRATION_SCHEMA, effort: "medium", maxTokens: 8000 });
  // the free trim first: a narration a few words over its limit loses filler words, never its cues, numbers or openings
  const maxW = Math.round(LENGTH[lengthSec].words[1] * (1 + WORD_TOLERANCE));
  const trimmed = (sc) => { const n = sc.sentences.reduce((k, s) => k + wordCount(s.text), 0); if (n <= maxW) return sc; const t = trimNarration(sc, { max: maxW, cues: cuesOf() }); if (t.cut.length) trace.push({ label: "words trim (free)", from: n, to: t.script.sentences.reduce((k, s) => k + wordCount(s.text), 0), cut: t.cut }); return t.script; };
  let script = trimmed(toScript(w.data)), wc = wordsCheck(script);
  trace.push({ label: "words checks", problems: wc.P, moved: wc.moved });
  for (let round = 1; round <= 2 && wc.P.length; round++) {
    w = await step(round === 1 ? "words repair" : "words repair 2", { system: WORDS_SYSTEM, user: `${wordsUser({ topic, lengthSec, beats: roles.map((role) => ({ ...beats.find((b) => b.role === role), cues: cuesOf()[role] ?? [] })), facts: kept.map((c) => c.claim) })}\n\nYour narration below has problems the free checks found. Fix every one and return the whole narration again.\nProblems:\n- ${wc.P.join("\n- ")}\n\nYour narration:\n${script.sentences.map((s) => `${s.role}: ${s.text}`).join("\n")}`, schema: NARRATION_SCHEMA, effort: "medium", maxTokens: 8000 });
    script = trimmed(toScript(w.data)); wc = wordsCheck(script);
    trace.push({ label: `words checks (repair ${round})`, problems: wc.P, moved: wc.moved });
  }
  // a cue word still missing: its actions fire at the start of its sentence (free; the picture still shows them)
  const miss = missingWords(layout, script.sentences), warnings = [...B.warnings];
  if (miss.length) { layout = dropWords(layout, miss); warnings.push(...miss.map((m) => `${m.s}: "${m.w}" is not in the sentence, so ${m.what} starts with it`)); }
  // a problem line whose WORDING still misses the visible-consequence list after the repair, while its beat's picture
  // shows a visible problem: a warning (the picture is planned first and the preview check judges it; the real traffic
  // light run of 2026-10-28 was refused, after $0.38, for "the timer holds red for one lone car")
  const shown = (p) => {
    const m = /^problem "(.{1,50})…" is not something you can see happen/.exec(p); if (!m) return false;
    const s = script.sentences.find((x) => x.text.startsWith(m[1]));
    const b = s && layout.beats.find((x) => x.s === s.role);
    return !!b && VISIBLE.test(`${b.shows?.does ?? ""} ${(B.story.chain ?? []).find((c) => c.problem === s.role)?.shows ?? ""}`);
  };
  for (const p of wc.P.filter(shown)) warnings.push(`${p} (its picture shows it: left to the preview check)`);
  // (the layout itself is solved by planTopic, after the opening fix)
  return { script, layout, problems: wc.P.filter((p) => !/cue word .* is missing/.test(p) && !shown(p)), warnings, solve: true };
}

/**
 * The preview check's other repair: the words. A flagged sentence is rewritten to say what its frame really shows
 * (what the checker saw), keeping its role, its cue words where they still fit, and its numbers. Usually cheaper and
 * surer than changing the picture. Returns { script, changed: [roles], problems, costUsd }.
 */
export async function rewordBeats({ apiKey, topic, script, layout, failing, log, cacheDir, model = MODEL.default }) {
  const file = cacheDir && path.join(cacheDir, `reword_${failing.map((f) => f.role).join("_")}.json`);
  const cues = anchorWords(layout);
  const user = `Topic: ${topic}\nThe narration, one sentence per beat (role: sentence):\n${script.sentences.map((s) => `${s.role}: ${s.text}`).join("\n")}\n\nThe preview frames of these beats do not show what their sentences say. Rewrite ONLY these sentences so each says what its frame really shows (what the checker saw), keeps its role in the story (a "But…" stays a visible problem, a "So you…" a fix), keeps its numbers, and uses its cue words where they still fit:\n${failing.map((f) => `- ${f.role}: "${script.sentences.find((s) => s.role === f.role)?.text}"\n  the checker saw: ${f.seen}\n  what was wrong: ${f.problem}\n  on screen in this beat: ${beatBrief(layout, f.role)}\n  cue words: ${(cues[f.role] ?? []).join(", ") || "(none)"}`).join("\n")}\n\nReturn the title and only the rewritten sentences.`;
  let r;
  if (file && fs.existsSync(file)) r = JSON.parse(fs.readFileSync(file, "utf8"));
  else { r = await callJSON({ apiKey, model, log, label: "words repair (preview)", system: WORDS_SYSTEM, user, schema: NARRATION_SCHEMA, effort: "medium", maxTokens: 6000 }); if (file) { fs.mkdirSync(cacheDir, { recursive: true }); fs.writeFileSync(file, JSON.stringify(r, null, 1)); } }
  const changed = [], problems = [];
  const sentences = script.sentences.map((s) => {
    const f = failing.find((x) => x.role === s.role), cand = f && r.data.sentences?.find((x) => x.role === s.role)?.text;
    if (!cand) return s;
    const text = oneSentence(cand), p = sentenceProblems(text, { allowed: numbersIn(s.text).concat(numbersIn((script.facts ?? []).map((c) => c.claim).join(" "))), must: numbersIn(s.text) });
    if (p.length) { problems.push(`${s.role}: ${p.join("; ")}`); return s; }
    // (the same words back are no change: it paid for a new voice take and a check of the same pictures; free garage
    // door run, 2026-10-28)
    if (text.trim() === s.text.trim()) return s;
    changed.push(s.role); return { ...s, text };
  });
  return { script: { ...script, sentences: linkProblems({ sentences, chain: script.chain ?? [] }).script.sentences }, changed, problems, costUsd: r.costUsd ?? 0 };
}

/**
 * The whole planner. topic, lengthSec (30 | 60); reuse: a saved layout key (its roles, its scene) or null for a
 * new layout. Returns { script, facts, layout, problems, warnings, costUsd, trace }.
 */
export async function planTopic({ apiKey, topic, lengthSec = 30, reuse = null, log, script: given = null, lastOpening = null, defer = null, model = MODEL.default, onStep = () => {}, cacheDir = null, example = exampleFor(topic), library = [] }) {
  const SCENE = sceneSystem(example);
  const trace = [];
  let cost = 0, n = 0;
  // every paid step is saved (cacheDir/step_<n>_<label>.json) and re-used on a re-run: nothing is paid for twice
  const step = async (label, args) => {
    onStep({ step: label });
    const file = cacheDir && path.join(cacheDir, `step_${++n}_${label.replace(/[^a-z0-9]+/gi, "_")}.json`);
    if (file && fs.existsSync(file)) { const r = JSON.parse(fs.readFileSync(file, "utf8")); trace.push({ label, cached: true, data: r.data }); return r; }
    // a batch pre-build: the scene plan's request is handed back instead of sent (its answer is written to this file)
    if (defer && label === "scene plan") { defer.push({ file, label, model, ...args }); throw Object.assign(new Error("deferred to a batch"), { deferred: true }); }
    const r = await callJSON({ apiKey, model, log, label, ...args });
    if (file) { fs.mkdirSync(cacheDir, { recursive: true }); fs.writeFileSync(file, JSON.stringify(r, null, 1)); }
    cost += r.costUsd; trace.push({ label, costUsd: r.costUsd, searches: r.searches, data: r.data }); return r;
  };
  const saved = reuse ? template(reuse) : null;
  const savedFacts = saved?.facts?.filter((f) => f.verdict !== "drop") ?? [];
  const keyWords = saved ? anchorWords(saved) : null;

  // visuals first (the owner's rule of 2026-10-27): a premade topic writes fresh words around its approved beats; a
  // custom topic plans its beats, checks its facts, then writes its words. (A given script, the golden remake's tool,
  // still plans its scene from the script below.)
  if (!given && saved) {
    const pp = await planPremade({ step, topic, lengthSec, saved, key: reuse, trace });
    if (pp) {
      const layout = { ...saved, title: pp.script.title || saved.title };
      const solved = solveLayout(layout, pp.script.sentences);
      return { script: pp.script, layout, problems: solved.problems, warnings: solved.warnings, costUsd: +cost.toFixed(4), trace, changedRoles: pp.changedRoles, approved: saved.approved !== false, approvedScript: approvedScript(reuse) };
    }
  }
  if (!given && !saved) {
    const pc = await planCustom({ step, topic, lengthSec, example, lastOpening, library, trace });
    let layout = pc.layout;
    if (pc.solve) { const op = fixOpening(layout); if (op.moved) { layout = op.layout; trace.push({ label: "opening", ...op.moved }); } }
    const solved = pc.solve ? solveLayout(layout, pc.script.sentences) : { problems: [], warnings: [] };
    return { script: pc.script, layout, problems: [...pc.problems, ...solved.problems], warnings: [...pc.warnings, ...solved.warnings], costUsd: +cost.toFixed(4), trace, changedRoles: null, approved: false };
  }

  // 1. the script (or a given one: the golden set re-uses the approved scripts)
  let script = given;
  if (!script) {
    let r = await step("script", { system: SCRIPT_SYSTEM, user: scriptUser({ topic, lengthSec, roles: saved?.roles, facts: savedFacts.map((f) => f.claim), keyWords }), schema: SCRIPT_SCHEMA, effort: "high", maxTokens: 16000 });
    // a "But…" that doesn't name the fix the writer's chain says caused it gets "now" (free): no paid repair for a word
    const relink = (sc) => { const { script: s2, linked } = linkProblems(sc); if (linked.length) trace.push({ label: "chain linked with \"now\" (free)", sentences: linked }); return s2; };
    script = relink(r.data);
    let P = checkScript(script, lengthSec, saved?.roles);
    if (P.length) { r = await step("script repair", { system: SCRIPT_SYSTEM, user: `${scriptUser({ topic, lengthSec, roles: saved?.roles })}\n\nYour last script had these problems; fix them and return the whole script:\n- ${P.join("\n- ")}\n\nYour last script:\n${JSON.stringify(script)}`, schema: SCRIPT_SCHEMA, effort: "high", maxTokens: 16000 }); script = relink(r.data); P = checkScript(script, lengthSec, saved?.roles); }
    trace.push({ label: "script check", problems: P });
    // a new topic whose problems still don't chain and escalate after the repair is refused (the owner's rule): it stops
    // here as a plan that didn't pass (refunded), before the fact-check, the scene and the voice are paid for. The script
    // goes into the error, so the owner's Details show what was refused.
    const chainLeft = saved ? [] : chainProblems(script, { strict: true, lengthSec });
    if (chainLeft.length) throw Object.assign(new Error(`the script's story does not chain: ${chainLeft.join("; ")}\n\nThe script:\n${(script.sentences ?? []).map((x, i) => `${i + 1}. ${x.text}`).join("\n")}`), { code: "PLAN_FAILED", retryable: false });

    // 2. the fact-check, with web search (a second script round if fewer than 2 surprises survive). A saved layout
    //    keeps the facts it was checked with (the plan: a repeat topic needs no new fact-check).
    if (savedFacts.length) { script = { ...script, facts: saved.facts }; trace.push({ label: "fact-check skipped: the saved layout's verified facts", facts: savedFacts.length }); }
    else {
    const claims = `Surprise claims (index: claim | suggested search):\n${script.surprises.map((c, i) => `${i}: ${c.claim} | ${c.search}`).join("\n")}`;
    let rs = await step("fact research", { system: RESEARCH_SYSTEM, user: `Topic: ${topic}\n${claims}`, schema: null, search: Math.min(10, 2 * script.surprises.length + 2), effort: "medium", maxTokens: 24000 });
    if (rs.searches < script.surprises.length) rs = await step("fact research (again)", { system: RESEARCH_SYSTEM, user: `Topic: ${topic}\n${claims}\n\nSearch the web for EACH claim now; an answer without searches is refused.`, schema: null, search: Math.min(10, 2 * script.surprises.length + 2), effort: "medium", maxTokens: 24000 });
    if (rs.searches < 1) throw new Error("fact-check: no web search was made; the facts are not verified");
    const notes = `${rs.data.text}\n\nSources found:\n${rs.data.sources.map((s) => `- ${s.title} ${s.url}`).join("\n")}`;
    const fc = await step("fact-check", { system: FACTS_SYSTEM, user: `Topic: ${topic}\nScript (index: role: text):\n${script.sentences.map((s, i) => `${i}: ${s.role}: ${s.text}`).join("\n")}\n\n${claims}\n\nCards: ${JSON.stringify(script.cards)}\n\nResearch notes (from ${rs.searches} web searches):\n${notes}`, schema: FACTS_SCHEMA, effort: "medium", maxTokens: 16000 });
    trace.push({ label: "fact research searches", searches: rs.searches, sources: rs.data.sources.length });
    const kept = fc.data.checks.filter((c) => c.verdict !== "drop");
    script = { ...script, sentences: fc.data.sentences, cards: fc.data.cards, facts: fc.data.checks };
    if (kept.length < 2) {
      const r2 = await step("script (verified facts)", { system: SCRIPT_SYSTEM, user: scriptUser({ topic, lengthSec, roles: saved?.roles, facts: kept.map((c) => c.claim) }), schema: SCRIPT_SCHEMA, maxTokens: 16000 });
      script = { ...r2.data, facts: fc.data.checks };
    }
    }
    const P2 = checkScript(script, lengthSec, saved?.roles);
    if (P2.length) trace.push({ label: "script check after facts", problems: P2 });
  }

  // one sentence per role: the voice is split into sentences at . ! ?, so a line holding two would shift every later
  // role by one. An inner break becomes a semicolon (a question mark a comma).
  script = { ...script, sentences: script.sentences.map((s) => ({ ...s, text: oneSentence(s.text) })) };

  // 3. the scene: a saved layout's beats, or a new layout planned from the kit
  // the sentences of a saved layout whose words moved (re-anchored): only their preview frames need a new look
  let layout, problems = [], warnings = [], changedRoles = null;
  if (saved) {
    layout = { ...saved, title: script.title || saved.title };
    ({ problems, warnings } = solveLayout(layout, script.sentences));
    if (problems.length) {
      // the saved beats' words are not all in the new sentences: one small call re-picks only those words
      const missing = missingWords(saved, script.sentences);
      changedRoles = [...new Set(missing.map((m) => m.s))];
      if (missing.length) {
        const r = await step("re-anchor words", { system: "You re-anchor an animation to a new narration. For each item, pick the one word of the given sentence (copy it exactly, without punctuation) on which that action should happen: the word that names the thing or the action. Reply with every item.", user: `Items (index: sentence role: sentence | the action | the old word):\n${missing.map((m, i) => `${i}: ${m.s}: ${script.sentences.find((x) => x.role === m.s)?.text} | ${m.what} | ${m.w}`).join("\n")}`, schema: WORDS_SCHEMA, effort: "low", maxTokens: 4000 });
        layout = applyWords(layout, missing, r.data.words);
      }
      ({ problems, warnings } = solveLayout(layout, script.sentences));
    }
  } else {
    const key = topic.toLowerCase().replace(/^(a|an|the)\s+/, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
    const user = sceneUser({ topic, title: script.title, sentences: script.sentences, hero: script.hero, parts: script.parts ?? [], lastOpening, chain: script.chain ?? null, library });
    let r = await step("scene plan", { system: SCENE, user, schema: SCENE_REPLY_SCHEMA, effort: "high", maxTokens: 64000 });
    let conv = layoutFromScene(parseScene(r.data), { key, title: script.title, roles: script.sentences.map((s) => s.role) });
    const rw1 = applyRewrites(script, conv.rewrites); script = rw1.script; if (rw1.taken.length || rw1.refused.length) trace.push({ label: "rewrites", taken: rw1.taken, refused: rw1.refused });
    ({ problems, warnings } = solveLayout(conv.layout, script.sentences));
    problems.unshift(...conv.problems, ...openingProblems(conv.layout, lastOpening));
    trace.push({ label: "solver 1", problems, warnings, opening: openingOf(conv.layout) });
    if (problems.length) {
      r = await step("scene repair", { system: SCENE, user: `${user}\n\nYour layout below has problems the layout solver found. Fix every one and return the whole layout again (change only what the problems need).\nProblems:\n- ${problems.join("\n- ")}\n${warnings.length ? `Warnings (fix them if you can):\n- ${warnings.join("\n- ")}\n` : ""}\nYour layout (sceneJson):\n${r.data.sceneJson}`, schema: SCENE_REPLY_SCHEMA, effort: "high", maxTokens: 64000 });
      conv = layoutFromScene(parseScene(r.data), { key, title: script.title, roles: script.sentences.map((s) => s.role) });
      const rw2 = applyRewrites(script, conv.rewrites); script = rw2.script; if (rw2.taken.length || rw2.refused.length) trace.push({ label: "rewrites (repair)", taken: rw2.taken, refused: rw2.refused });
      ({ problems, warnings } = solveLayout(conv.layout, script.sentences));
      problems.unshift(...conv.problems);
      // words still not in their sentences after the repair: those actions start with their sentence instead (free)
      if (problems.some((x) => /^anchor word not found/.test(x))) {
        const miss = missingWords(conv.layout, script.sentences);
        conv = { ...conv, layout: dropWords(conv.layout, miss) };
        ({ problems, warnings } = solveLayout(conv.layout, script.sentences));
        problems.unshift(...conv.problems);
        warnings.push(...miss.map((m) => `${m.s}: "${m.w}" is not in the sentence, so ${m.what} starts with it`));
      }
      // a repeat opening after the repair is a warning: the video still goes on
      warnings.push(...openingProblems(conv.layout, lastOpening));
      trace.push({ label: "solver 2", problems, warnings, opening: openingOf(conv.layout) });
    }
    layout = { ...conv.layout, why: r.data.why };
  }
  // the hook object on screen in the first frame (free, in code)
  const op = fixOpening(layout);
  if (op.moved) { layout = op.layout; ({ problems, warnings } = (() => { const r = solveLayout(layout, script.sentences); return { problems: [...problems.filter((x) => !/^anchor word not found/.test(x)), ...r.problems.filter((x) => !problems.includes(x))], warnings: [...warnings, ...r.warnings.filter((x) => !warnings.includes(x))] }; })()); trace.push({ label: "opening", ...op.moved }); }
  if (saved && changedRoles == null) changedRoles = [];
  return { script, layout, problems, warnings, costUsd: +cost.toFixed(4), trace, changedRoles, approved: saved ? saved.approved !== false : false };
}

export { SCRIPT_SYSTEM, SCENE_SYSTEM, FACTS_SYSTEM, checkScript, KIND_DOCS, roleScript };

/**
 * One repair round after the preview frames: the failing beats and what the vision check saw go back to the scene
 * planner, which returns the layout with only those beats (and the parts they use) changed. A saved layout keeps
 * its world and parts: only beats and shots may change.
 */
export async function repairLayout({ apiKey, topic, script, layout, problems, log, cacheDir, model = MODEL.default, saved = false, example = exampleFor(topic) }) {
  // (keyed by the problems' text and the layout: two rounds with the same count and length reused one answer, so the
  // second repair re-rendered the first; free aquarium run, 2026-10-28)
  const file = cacheDir && path.join(cacheDir, `repair_${crypto.createHash("sha1").update(problems.join("|")).update(JSON.stringify(layout.beats ?? [])).digest("hex").slice(0, 16)}.json`);
  let r;
  if (file && fs.existsSync(file)) r = JSON.parse(fs.readFileSync(file, "utf8"));
  else {
    r = await callJSON({ apiKey, model, log, label: "preview repair", system: sceneSystem(example), schema: SCENE_REPLY_SCHEMA, effort: "high", maxTokens: 64000,
      user: `${sceneUser({ topic, title: script.title, sentences: script.sentences, hero: script.hero, parts: script.parts ?? [] })}\n\nThe layout below was rendered, and preview frames of these beats failed the check (what the checker saw, and what to change):\n- ${problems.join("\n- ")}\n\nFix only those beats${saved ? " (beats and shots only: the world and the parts must stay exactly as they are)" : " (their parts' settings, their verbs, their shots)"}. Keep everything else exactly as it is. Return ONLY what changes, as sceneJson = {\"beats\": [each beat you change, whole, with its s], \"parts\": [each part you change or add, whole, with its id], \"world\": {only the world keys you change}}; leave out everything that stays the same.\n\nThe layout (sceneJson):\n${JSON.stringify(sceneFromLayout(layout))}` });
    if (file) { fs.mkdirSync(cacheDir, { recursive: true }); fs.writeFileSync(file, JSON.stringify(r, null, 1)); }
  }
  // the reply is a patch: changed beats (by sentence), changed or new parts (by id), changed world keys
  const conv = layoutFromScene(mergeScene(sceneFromLayout(layout), parseScene(r.data)), { key: layout.key, title: layout.title, roles: layout.roles });
  // (the hold and the state labels survive a repair: the rebuilt layout dropped them, and the free basement and pond
  // runs' final videos had neither)
  let next = { ...conv.layout, why: layout.why, ...(layout.hold ? { hold: true } : {}) };
  if (saved) next = { ...next, world: layout.world, parts: layout.parts, camera: layout.camera };
  else if (layout.camera) next.camera = layout.camera;
  if (layout.world?.sat != null) next.world = { ...next.world, sat: layout.world.sat };
  const solved = solveLayout(next, script.sentences);
  return { layout: next, problems: [...conv.problems, ...solved.problems], warnings: solved.warnings, costUsd: r.costUsd ?? 0 };
}
