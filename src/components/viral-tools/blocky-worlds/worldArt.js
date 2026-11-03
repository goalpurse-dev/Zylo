// The little world art on an idea card: an emoji for the idea's main thing (the first keyword found in its title, then
// its first line), one for its setting, and the mood's colours. Pure lookups, no images to load.

// order matters: the more specific words first ("snowglobe" before "snow")
const THINGS = [
  ["dragon", "🐉"], ["yeti", "🦍"], ["pigeon", "🐦"], ["bird", "🐦"], ["owl", "🦉"], ["crow", "🐦‍⬛"], ["cat", "🐈"], ["dog", "🐕"],
  ["fish", "🐟"], ["whale", "🐋"], ["shark", "🦈"], ["octopus", "🐙"], ["frog", "🐸"], ["mole", "🦔"], ["moth", "🦋"], ["bee", "🐝"],
  ["spider", "🕷️"], ["snail", "🐌"], ["mouse", "🐭"], ["rat", "🐀"], ["goat", "🐐"], ["cow", "🐄"], ["chicken", "🐔"], ["duck", "🦆"],
  ["horse", "🐎"], ["pig", "🐖"], ["sheep", "🐑"], ["bear", "🐻"], ["fox", "🦊"], ["wolf", "🐺"], ["bat", "🦇"], ["worm", "🪱"],
  ["ghost", "👻"], ["monster", "👾"], ["beast", "👹"], ["robot", "🤖"], ["alien", "👽"], ["witch", "🧙"], ["wizard", "🧙"],
  ["mannequin", "🧍"], ["shadow", "👤"], ["scarecrow", "🎃"], ["pumpkin", "🎃"], ["statue", "🗿"], ["gnome", "🧌"], ["clown", "🤡"],
  ["snowglobe", "🔮"], ["flag", "🚩"], ["bale", "🌾"], ["hay", "🌾"], ["truck", "🚚"], ["mailbox", "📬"], ["mop", "🧹"], ["broom", "🧹"], ["snowball", "⚪"], ["fireflies", "✨"], ["firefly", "✨"], ["grounded", "🚫"], ["dug", "⛏️"], ["dig", "⛏️"], ["snowman", "⛄"], ["snow", "❄️"], ["ice", "🧊"], ["rain", "🌧️"], ["cloud", "☁️"], ["storm", "⛈️"], ["fog", "🌫️"],
  ["wind", "🌬️"], ["sun", "☀️"], ["moon", "🌙"], ["star", "⭐"], ["rainbow", "🌈"], ["lava", "🌋"], ["volcano", "🌋"], ["fire", "🔥"],
  ["candle", "🕯️"], ["lantern", "🏮"], ["lamp", "💡"], ["light", "💡"], ["flashlight", "🔦"], ["glow", "✨"], ["mushroom", "🍄"],
  ["bell", "🔔"], ["clock", "⏰"], ["piano", "🎹"], ["drum", "🥁"], ["whistle", "😗"], ["song", "🎵"], ["sing", "🎤"], ["music", "🎵"],
  ["sneeze", "🤧"], ["burp", "😮‍💨"], ["laugh", "😂"], ["smile", "😁"], ["cry", "😢"], ["tear", "😢"], ["yawn", "🥱"], ["sleep", "😴"],
  ["dream", "💭"], ["whisper", "🤫"], ["quiet", "🤫"], ["silent", "🤫"], ["loud", "📢"], ["shout", "📢"], ["voice", "🗣️"], ["name", "📛"],
  ["secret", "🤐"], ["lie", "🤥"], ["wish", "🌠"], ["magic", "🪄"], ["spell", "🪄"], ["price", "🏷️"], ["coin", "🪙"], ["money", "💰"],
  ["soup", "🍲"], ["pie", "🥧"], ["bread", "🍞"], ["loaf", "🍞"], ["bagel", "🥯"], ["pancake", "🥞"], ["toast", "🍞"], ["cake", "🎂"],
  ["cookie", "🍪"], ["candy", "🍬"], ["cocoa", "☕"], ["tea", "🫖"], ["milk", "🥛"], ["cheese", "🧀"], ["egg", "🥚"], ["apple", "🍎"],
  ["pizza", "🍕"], ["ice cream", "🍦"], ["lunch", "🍱"], ["dinner", "🍽️"], ["fridge", "🧊"], ["garbage", "🗑️"], ["trash", "🗑️"],
  ["sock", "🧦"], ["shoe", "👟"], ["boot", "🥾"], ["hat", "🎩"], ["helmet", "⛑️"], ["shirt", "👕"], ["glasses", "👓"], ["umbrella", "☂️"],
  ["mirror", "🪞"], ["photo", "📸"], ["camera", "📷"], ["phone", "📱"], ["tv", "📺"], ["book", "📖"], ["homework", "📝"], ["letter", "✉️"],
  ["mail", "📬"], ["chalk", "🖍️"], ["crayon", "🖍️"], ["eraser", "🧽"], ["pencil", "✏️"], ["paint", "🎨"], ["map", "🗺️"], ["key", "🗝️"],
  ["door", "🚪"], ["window", "🪟"], ["chair", "🪑"], ["bed", "🛏️"], ["bath", "🛁"], ["toilet", "🚽"], ["stair", "🪜"], ["ladder", "🪜"],
  ["balloon", "🎈"], ["kite", "🪁"], ["toy", "🧸"], ["teddy", "🧸"], ["doll", "🪆"], ["ball", "⚽"], ["game", "🎲"], ["dice", "🎲"],
  ["bus", "🚌"], ["car", "🚗"], ["bike", "🚲"], ["bicycle", "🚲"], ["train", "🚂"], ["tractor", "🚜"], ["boat", "⛵"], ["submarine", "🌊"],
  ["rocket", "🚀"], ["plane", "✈️"], ["wing", "🪽"], ["feather", "🪶"], ["crown", "👑"], ["king", "👑"], ["queen", "👑"], ["sword", "🗡️"],
  ["shield", "🛡️"], ["castle", "🏰"], ["tower", "🗼"], ["bridge", "🌉"], ["fountain", "⛲"], ["store", "🏬"], ["shop", "🏪"],
  ["school", "🏫"], ["teacher", "🧑‍🏫"], ["library", "📚"], ["hospital", "🏥"], ["farm", "🌾"], ["corn", "🌽"], ["tree", "🌳"], ["forest", "🌲"],
  ["wood", "🌲"], ["stump", "🪵"], ["hedge", "🌿"], ["flower", "🌻"], ["garden", "🌷"], ["seed", "🌱"], ["rock", "🪨"], ["cave", "🕳️"],
  ["tunnel", "🕳️"], ["hole", "🕳️"], ["cliff", "🏔️"], ["mountain", "🏔️"], ["canyon", "🏜️"], ["sand", "🏖️"], ["beach", "🏖️"], ["sea", "🌊"],
  ["ocean", "🌊"], ["river", "🏞️"], ["pool", "🏊"], ["water", "💧"], ["bubble", "🫧"], ["gravity", "🪐"], ["float", "🎈"], ["shadow", "👤"],
  ["height", "📏"], ["tall", "📏"], ["tiny", "🔬"], ["small", "🐜"], ["number", "🔢"], ["birthday", "🎂"], ["holiday", "🎄"], ["santa", "🎅"],
  ["detention", "⏳"], ["bully", "😤"], ["brother", "👦"], ["sister", "👧"], ["grandma", "👵"], ["grandpa", "👴"], ["baby", "👶"], ["mom", "👩"],
];
const SETTINGS = [
  ["suburb", "🏘️", "Suburb"], ["house", "🏠", "House"], ["school", "🏫", "School"], ["woods", "🌲", "Woods"], ["square", "⛲", "Town square"],
  ["farm", "🌾", "Farm"], ["canyon", "🏜️", "Canyon town"], ["castle", "🏰", "Castle"], ["underground", "🕳️", "Underground"],
  ["underwater", "🌊", "Underwater"], ["inside something giant", "🫧", "Inside a giant"], ["snowy", "❄️", "Snowy town"],
];
const MOOD_FALLBACK = { horror: "🌑", wholesome: "💛", funny: "🤪", epic: "⚔️" };

/** The mood's tile gradient, glow and pill colours (Tailwind classes, written out so the build keeps them). */
export const MOOD_STYLE = {
  horror: { tile: "from-indigo-950 via-violet-900 to-fuchsia-900", glow: "bg-violet-500/25", pill: "bg-violet-400/15 text-violet-200" },
  wholesome: { tile: "from-rose-400 via-pink-400 to-amber-300", glow: "bg-pink-400/20", pill: "bg-pink-400/15 text-pink-200" },
  funny: { tile: "from-yellow-300 via-lime-300 to-emerald-300", glow: "bg-yellow-300/20", pill: "bg-yellow-300/15 text-yellow-200" },
  epic: { tile: "from-orange-500 via-red-500 to-rose-600", glow: "bg-orange-500/20", pill: "bg-orange-400/15 text-orange-200" },
};

const words = (s) => ` ${String(s ?? "").toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ")} `;
/** The emoji for the idea's main thing (title first, then the first line; plurals count), or null. */
export function thingEmoji(idea) {
  for (const text of [words(idea.title), words(idea.opener?.replace(/^in this (world|town),/i, ""))]) {
    for (const [k, e] of THINGS) if (new RegExp(` ${k}(s|es|y|ing)? `).test(text)) return e;
  }
  return null;
}
/** Everything the card draws: { emoji, place: { emoji, label } | null, mood style }. */
export function worldArt(idea) {
  const setting = String(idea.setting ?? "").toLowerCase();
  const s = SETTINGS.find(([k]) => setting.includes(k));
  return {
    emoji: thingEmoji(idea) ?? MOOD_FALLBACK[idea.mood] ?? "✨",
    place: s ? { emoji: s[1], label: s[2] } : null,
    style: MOOD_STYLE[idea.mood] ?? MOOD_STYLE.funny,
  };
}
