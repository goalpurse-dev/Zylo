// Built-in data for the Phase 2 mock backend. Placeholder content only —
// Phase 3 serves the real character library, ideas and scripts.

const IMG = "/viral-builder/ai-fruit/characters";

/** Avatar for characters without artwork: the fruit emoji on a tinted card. */
export function emojiAvatar(emoji, hue) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 150"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hue} 45% 30%)"/><stop offset="1" stop-color="hsl(${hue} 50% 14%)"/></linearGradient></defs><rect width="120" height="150" fill="url(#g)"/><text x="60" y="96" font-size="64" text-anchor="middle">${emoji}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const char = (id, name, fruit, emoji, tag, role, gender, voiceStyle, hue, image) => ({
  id, name, fruit, emoji, tag, role, gender, voiceStyle, hue,
  refImageUrl: image ? `${IMG}/${image}` : emojiAvatar(emoji, hue),
});

/** @type {import("../fruitStoryV2Api").Character[]} */
export const CHARACTERS = [
  char("mia",    "Mia Mango",      "mango",      "🥭", "Wife",         "Calm, patient schemer",      "female", "calm, low, deliberate", 38),
  char("marco",  "Marco Mango",    "mango",      "🥭", "Husband",      "Charming, smooth liar",      "male",   "smooth, confident",     22, "bossmango.png"),
  char("pia",    "Pia Peach",      "peach",      "🍑", "Rival",        "Glamorous other woman",      "female", "sweet, teasing",        12, "hotpeach.webp"),
  char("rick",   "Rick Crisp",     "apple",      "🍎", "Boss",         "Loud CEO, bad liar",         "male",   "loud, blustering",      0),
  char("bella",  "Bella Berry",    "strawberry", "🍓", "Intern",       "Sweet intern with secrets",  "female", "bright, nervous",       345),
  char("marg",   "Margaret Crisp", "green apple","🍏", "Wife",         "Icy co-founder",             "female", "cold, precise",         95),
  char("gloria", "Gloria Grape",   "grape",      "🍇", "Receptionist", "Office gossip, 19 years",    "female", "fast, gleeful",         275),
  char("linda",  "Linda Lemon",    "lemon",      "🍋", "HR",           "Sour HR director",           "female", "clipped, formal",       55),
  char("benny",  "Benny Banana",   "banana",     "🍌", "Boyfriend",    "Nervous over-explainer",     "male",   "fast, shaky",           48, "banana.png"),
  char("pina",   "Big Pina",       "pineapple",  "🍍", "Kingpin",      "Cellblock kingpin",          "male",   "deep, slow, menacing",  42, "gangsterpineapple.png"),
  char("coco",   "Coco",           "coconut",    "🥥", "Enforcer",     "Silent enforcer",            "male",   "rare, gravelly",        25),
  char("olive",  "Olivia Orange",  "orange",     "🍊", "Mom",          "Protective mom",             "female", "warm, firm",            28, "orangemom.png"),
  char("kiki",   "Kiki Kiwi",      "kiwi",       "🥝", "Friend",       "Loyal best friend",          "female", "upbeat, loyal",         88),
  char("walt",   "Walt Melon",     "watermelon", "🍉", "Husband",      "Rich, clueless husband",     "male",   "cheerful, oblivious",   140),
  char("ana",    "Ana Pineapple",  "pineapple",  "🍍", "Influencer",   "Lives for the drama",        "female", "bubbly, dramatic",      45, "ananasgirl.png"),
  char("sally",  "Sally Strawberry","strawberry","🍓", "Mother-in-law","Never leaves, never forgets","female", "sweet, passive-aggressive", 350, "strawberrymom.png"),
  char("andy",   "Andy Apple",     "apple",      "🍎", "Son",          "Spoiled only child",         "male",   "whiny, entitled",       5, "appleson.png"),
  char("leo",    "Leo Lemon",      "lemon",      "🍋", "Kid",          "Says the quiet part loud",   "male",   "blunt, loud",           58, "lemonkid.webp"),
  char("ollie",  "Ollie Orange",   "orange",     "🍊", "Kid",          "Tiny detective",             "male",   "curious, squeaky",      30, "orangekid.webp"),
  char("brock",  "Brock Broccoli", "broccoli",   "🥦", "Landlord",     "Raises rent every scene",    "male",   "gruff, greedy",         120, "brockolliboss.png"),
];

export const characterById = (id) => CHARACTERS.find((c) => c.id === id);
export const firstName = (id) => (characterById(id)?.name ?? "Someone").split(" ")[0];

/** Two pages of 5 ideas; getIdeas({seed}) walks through them. Library characters only. */
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
