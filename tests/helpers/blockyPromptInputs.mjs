// The fixed inputs behind tests/fixtures/blockyPromptSnapshot.json: every text
// Blocky Stories sends to a model, built for these inputs, must be exactly the
// recorded one. The snapshot was recorded on 2026-10-06 from the wording the
// look tests were run with, before Blocky moved to its own engine
// (supabase/functions/_shared/blocky/), so it is the proof that the move
// changed no prompt.
import { ROSTER } from "../../scripts/blocky/roster.mjs";

export const avatar = (id) => ROSTER.find((a) => a.id === id);
export const CAST_IDS = ["vex", "noob", "taz", "lux"];

export const locations = [
  { id: "loc1", description: "A trading plaza with plain market stalls, stacked plain crates and a round fountain built from blocks", timeOfDay: "midday", lighting: "bright even daylight" },
  { id: "loc2", description: "An admin room with a long console desk, a glass wall and a row of plain block doors", timeOfDay: "night", lighting: "cold blue light from the console", plateUrl: "https://example.test/plate-s1-9x16.jpg" },
];
export const story = { id: "st1", aspect: "9:16", quality: "v2", locations, outfits: {} };
export const solo = { id: "s1", speakerId: "vex", presentIds: ["vex"], locationId: "loc1", action: "points one block arm straight ahead", emotion: "icy calm", shot: "close-up", line: "Break this server rule and you're banned. Forever." };
export const duo = { id: "s2", speakerId: "noob", presentIds: ["noob", "vex"], locationId: "loc1", action: "Noob holds up a small glowing gold cube", emotion: "panicked", shot: "medium close-up", placement: "Noob stands by the fountain; Vex stands behind, by a stall.", line: "I only wanted my coins back, I swear." };
export const trio = { id: "s3", speakerId: "lux", presentIds: ["lux", "noob", "taz"], locationId: "loc2", action: "taps the glass with one block arm", emotion: "smug", shot: "chest-up", placement: "Lux stands outside the glass wall looking in; Noob and Taz are inside the admin room.", line: "Funny, the admin told me the same thing about you." };
const words = (n, w) => Array.from({ length: n }, () => w).join(" ");
export const long = { ...trio, id: "s4", placement: `${words(30, "placement")}.`, action: words(12, "action") };
export const longStory = { ...story, locations: [{ ...locations[1], description: words(30, "location"), timeOfDay: "late afternoon", lighting: words(15, "light") }] };

export const writerInputs = {
  idea: { source: "idea", castIds: ["vex", "noob", "taz"], lengthSec: 30, quality: "v2", idea: { title: "The Admin Who Wasn't", summary: "A new player is banned by an admin nobody has seen before. Then the real admin logs in." } },
  prompt: { source: "prompt", castIds: ["noob", "lux"], lengthSec: 20, quality: "v4", prompt: "Noob trades a starter pet for Lux's rarest item, and the pet turns out to be the server's owner." },
  script: { source: "script", castIds: ["vex", "noob"], lengthSec: 15, quality: "v2", script: [{ speakerId: "vex", line: "Who gave you admin?" }, { speakerId: "noob", line: "You did. Yesterday. You just don't remember." }] },
  episode: {
    source: "episode", castIds: ["vex", "noob", "lux"], lengthSec: 30, quality: "v3",
    series: {
      title: "The Second Admin", logline: "A server has two admins, and only one of them is real.", bible: "Vex is the admin everyone fears. Noob is the new player who sees too much. Lux owns every rare item and wants the server too.",
      previous: [{ number: 1, title: "The Ban", summary: "Noob is banned for a rule nobody has heard of.", cliffhanger: "The ban message is signed by a second admin." }],
      episode: { number: 2, title: "Rejoined", summary: "Noob rejoins on a new account and walks into the admin room.", cliffhanger: "Vex says it never banned anyone." },
      locations: [{ id: "s1", description: "An admin room with a long console desk, a glass wall and a row of plain block doors" }],
      characters: [{ id: "vex", role: "the admin everyone fears", prop: "the ban hammer", catchphrase: "Rules are rules." }],
      setups: { plant: ["a second top hat on the console desk"], payOff: ["the unsigned ban message"] },
      lastEnd: { characters: [{ id: "noob", where: "at the spawn pad", feeling: "stunned" }], props: ["the ban message"] },
    },
  },
};
/** A twist plan as twists.js#validateTwistPlan returns it (the writer is handed this, locked). */
export const twistPlan = {
  premise: "What happens if a new player is banned by an admin nobody has seen before.", seenAs: "", emotion: "satisfaction",
  roles: { vex: "the fake admin, a player", noob: "the new player, the real owner", taz: "a player watching" }, assumed: "Vex is an admin and Noob is about to be banned.",
  stakes: "Noob's place on the server",
  patternId: "quiet_power", twist: "Noob owns the server and has been letting the fake commands work.", mechanic: "owner_power", clue: "Noob turns a small gold key over in one hand while saying sorry.", clueScene: 2,
  payoff: "Noob holds the gold key up and Vex, floating, drops.", revealScene: 5, consequence: "Vex is kicked from the server he pretended to run.", winnerId: "noob", finalLine: "Cute commands. Want to see real ones?", title: "The Admin Who Wasn't",
};
export const seriesInput = { concept: "A fake admin takes over an obby server.", castIds: ["vex", "noob", "zip"], opener: "Banned in front of everyone", tone: "tense and funny", episodeCount: 5 };
export const reviewPlan = {
  title: "The Admin Who Wasn't", roles: { vex: "the fake admin" }, outfits: {}, locations,
  scenes: [{ speakerId: "vex", presentIds: ["vex", "noob"], locationId: "loc1", line: solo.line }, { speakerId: "noob", presentIds: ["noob", "vex"], locationId: "loc1", line: duo.line }],
};
export const checkExpected = [{ name: "Vex", look: avatar("vex").look }, { name: "Noob", look: avatar("noob").look }];
export const checkAnswer = {
  characters: [{ name: "Vex", visible: true, isBlockyAvatar: false }], mainFigures: 3, backgroundFigures: 0, humanFigures: 1, brickToyLook: true, realisticFace: true,
  duplicates: ["Vex"], readableText: "ADMIN", logos: true, speakerHeadPercent: 14, speakerShownTo: "feet", notes: "",
};
export const uploadInput = { title: "The Admin Who Wasn't", lines: [{ speaker: "Vex", line: solo.line }], roles: { Vex: "the fake admin" }, episode: { number: 2, seriesTitle: "The Second Admin", nextNumber: 3, nextTitle: "The Real One" } };
export const uploadAnswer = {
  title: "He Banned the Wrong Player and the Server Froze #robloxstory",
  description: "An admin prank goes wrong on an obby server when the new player turns out to be someone else. Was the ban fair? #robloxstory #adminprank #obby",
  tags: "roblox story, admin prank, obby, fake admin, server rules, blocky animation",
  pinnedComment: "Was Vex right to ban them, or was it abuse?",
  caption: "The admin picked the wrong player to ban.",
  hashtags: ["#RobloxStory", "adminprank", "#obby"],
};
export const unsafeTexts = { user: "Noob gets banned in Brookhaven for no reason.", writer: "I only wanted my Robux back." };
