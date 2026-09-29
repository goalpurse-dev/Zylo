// Built-in data for the mock backend. Characters are the real library
// (libraryData.js, generated from the fruit_characters seed); ideas, lines and
// media are placeholders until Phase 3 serves them.

import { LIBRARY } from "./libraryData.js";

/** Avatar for characters without artwork: the fruit emoji on a tinted card. */
export function emojiAvatar(emoji, hue) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 150"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hue} 45% 30%)"/><stop offset="1" stop-color="hsl(${hue} 50% 14%)"/></linearGradient></defs><rect width="120" height="150" fill="url(#g)"/><text x="60" y="96" font-size="64" text-anchor="middle">${emoji}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** The real character library (same data as the fruit_characters table). */
export const CHARACTERS = LIBRARY;

export const characterById = (id) => CHARACTERS.find((c) => c.id === id);
export const firstName = (id) => (characterById(id)?.name ?? "Someone").split(" ")[0];

/** Pages of 5 ideas; getIdeas({seed}) walks through them. Library characters only (tested). */
export const IDEA_SETS = [
  [
    { id: "idea-revenge-dinner", title: "The perfect revenge dinner", summary: "She finds the photos, stays calm, and invites his lover to their anniversary dinner.", castIds: ["mia", "marco", "pia"] },
    { id: "idea-door-locked", title: "The door was locked", summary: "The office gossip walks in on the CEO and the intern. The walls are glass.", castIds: ["rick", "bella", "gloria"] },
    { id: "idea-snitches", title: "Snitches get spots", summary: "The kingpin puts a bruised banana on trial, until his own hair starts beeping.", castIds: ["pina", "benny", "coco"] },
    { id: "idea-group-chat", title: "Mom read the group chat", summary: "Olivia finds out what her son's girlfriend really says about her.", castIds: ["olive", "kiki", "benny"] },
    { id: "idea-hr-chat", title: "HR has entered the chat", summary: "Linda reads everyone's private messages out loud at the all-hands meeting.", castIds: ["linda", "rick", "gloria"] },
  ],
  [
    { id: "idea-two-gifts", title: "Two anniversary gifts", summary: "She finds two identical jewelry boxes. Only one has her name on it.", castIds: ["mia", "marco", "pia"] },
    { id: "idea-fake-trip", title: "The fake business trip", summary: "He's supposedly in Tokyo. His car is parked outside her favorite restaurant.", castIds: ["walt", "olive", "pia"] },
    { id: "idea-wrong-delivery", title: "The wrong delivery", summary: "Flowers arrive with a love note addressed to someone else.", castIds: ["kiki", "benny", "bella"] },
    { id: "idea-silent-witness", title: "The silent witness", summary: "Coco hasn't spoken in six years. Today he has one thing to say.", castIds: ["coco", "pina", "benny"] },
    { id: "idea-reply-all", title: "Reply all", summary: "A private love email goes out to all 400 employees.", castIds: ["bella", "rick", "marg"] },
  ],
];

export const ideaById = (id) => IDEA_SETS.flat().find((i) => i.id === id);

/** Line bank for mock scripts. s = which cast member (by position) says it. */
export const LINES = [
  { title: "Caught red-handed", line: "Why is she wearing my necklace?", s: 0 },
  { title: "The lie", line: "It's not what it looks like, I swear.", s: 1 },
  { title: "The receipts", line: "Then explain these forty-two texts.", s: 0 },
  { title: "Plot twist", line: "He told me you two were divorced.", s: 2 },
  { title: "Walk-out", line: "Keep the necklace. You'll need the money.", s: 0 },
  { title: "Cliffhanger", line: "Wait. Who sent you those photos?", s: 1 },
  { title: "Cold open", line: "Sit down. We need to talk.", s: 2 },
  { title: "Denial", line: "I have never seen her before in my life.", s: 1 },
  { title: "The photo", line: "Then why are you in all her pictures?", s: 0 },
  { title: "Confession", line: "Okay. Maybe once. Or eleven times.", s: 1 },
  { title: "The ally", line: "I think we both deserve better.", s: 2 },
  { title: "The exit", line: "Enjoy dinner. I already paid for it.", s: 0 },
];

/** Scene settings for the painted mock pictures. */
export const LOCATIONS = [
  { name: "restaurant", top: "#3b1d0e", mid: "#6b3515", bottom: "#2a140a", glow: "#ffb35c" },
  { name: "apartment", top: "#0e1633", mid: "#1e2c5c", bottom: "#0b1024", glow: "#6f8bff" },
  { name: "office", top: "#0c2a2c", mid: "#15484a", bottom: "#082021", glow: "#58e1d0" },
  { name: "street", top: "#1d0c2e", mid: "#3b1860", bottom: "#140820", glow: "#d078ff" },
];

/** Episode templates for mock series plans. {a} {b} {c} = cast first names. */
export const EPISODE_TEMPLATES = [
  { title: "The door was locked", summary: "{c} walks in on {a} and {b}.", cliffhanger: "\"Your wife is in the elevator.\"" },
  { title: "Hide the intern", summary: "{a} panics and hides {b} in the supply closet.", cliffhanger: "A single leaf on his collar." },
  { title: "It's garnish!", summary: "{a} blames the salad. Nobody believes him.", cliffhanger: "HR calls an all-staff meeting." },
  { title: "Reply all", summary: "A love note goes out to 400 people.", cliffhanger: "Two words from the wife: \"See me.\"" },
  { title: "The board meeting", summary: "A vote to fire {a}.", cliffhanger: "{b}: \"I have a vote too.\"" },
  { title: "The locket", summary: "{b}'s secret slips out.", cliffhanger: "A photo of the founder he pushed out." },
  { title: "The founder's daughter", summary: "{b} reveals why she really came.", cliffhanger: "Someone behind the plant hits record." },
  { title: "Blackmail", summary: "{c} wants a corner office and a raise.", cliffhanger: "\"Get in. We need to talk.\"" },
  { title: "The alliance", summary: "Two old enemies team up.", cliffhanger: "\"I've been recording too.\"" },
  { title: "Season finale", summary: "Everything comes out at the gala.", cliffhanger: "A new CEO answers the phone." },
];

/** Sample media for mock clips and final videos. */
export const SAMPLE_CLIPS = ["/library/aifruit.mp4", "/library/aifruit2.mp4"];
export const SAMPLE_FINAL = "/viral-builder/ai-fruit/result.mp4";
