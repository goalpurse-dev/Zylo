// Blocky Worlds planner: the visual dictionary (owner: PLANNER). Pure, deterministic, Node + browser.
//
// The owner's rule: every line's key nouns and actions are visible in its shot. This file knows
//   1. which words in a line are its key nouns / actions   (extractKeys)
//   2. what on screen counts as showing each one            (covers / describeShot)
//   3. how to show it: a recipe per rule (objects + states, set, poses/exprs, holds, markers, setState)
//   4. the fallback when nothing in the kit fits: a picture card { kind: "card", text, icon } (cardFor)
//
// A key: { label, kind, k (first token), end (last token), neg, rule?, id?, name?, icon?, phrase? }
//   kind: "rule"   a dictionary rule hit (object / action / place / light / marker / body / people)
//         "person" a cast member (id)          "monster"  the monster
//         "name"   a name said aloud that no cast member owns ("Barnaby") -> a name tag with that text
//         "noun"   any other content noun -> held prop if holdable, else a picture card
import { norm, tokens } from "./planText.js";
import { catalogObjects, heldIndex } from "./catalog.js";

// ------------------------------------------------------------------ the object catalog (mirror of page/kit/objects.js)
/** Planner-side mirror of the OBJECTS agent's catalog (CONTRACT addendum) + the coverage kit (lib/catalog.js). */
export const OBJECT_CATALOG = Object.freeze({
  ...catalogObjects(),
  ice_cream_truck: { aliases: ["ice cream truck", "ice cream van", "ice cream", "truck", "van"], states: ["mime"], big: true },
  football_field: { aliases: ["football", "soccer", "team", "stadium", "field", "game", "match", "crowd", "players", "bleachers"], states: [], big: true },
  birthday_party: { aliases: ["birthday", "party", "parties", "cake", "balloons", "presents", "guests"], states: [], big: false },
  bakery: { aliases: ["bakery", "baker", "bread", "shop"], states: ["for_sale"], big: true },
  car: { aliases: ["car", "cars", "alarm", "car alarm", "honk", "horn"], states: ["alarm"], big: false },
  photo_set: { aliases: ["photo", "photos", "picture", "pictures", "camera", "school photo", "portrait", "selfie"], states: [], big: false },
  crib: { aliases: ["crib", "cribs", "cradle", "babies"], states: [], big: false },
  house_front: { aliases: ["house", "houses", "home", "window", "windows", "lights", "roof", "roofs", "rooftop", "rooftops", "chimney", "chimneys", "attic", "attics", "windowsill", "windowsills", "shutters", "front door", "garage", "garages"], states: ["dark", "lit", "open"], big: true },
  stories_book: { aliases: ["story", "stories", "book", "books", "storybook", "tale", "tales"], states: [], big: false },
});

/** Hand props page/kit/props.js makeHeld draws (anything else -> a simple box, so we prefer a card for those). */
const HELD_INDEX = heldIndex();
// the first kit's hand props (kit/props.js makeHeld) by word -> builder
const BASE_HELD = { sock: "sock", socks: "sock", flashlight: "flashlight", torch: "flashlight", candle: "candle", candles: "candle", book: "book", books: "book", phone: "phone",
  bag: "bag", sack: "bag", purse: "bag", key: "key", keys: "key", ball: "ball", balls: "ball", box: "box", boxes: "box", present: "box", presents: "box", gift: "box", gifts: "box",
  package: "box", parcel: "box", bread: "bread", loaf: "bread", loaves: "bread", roll: "bread", rolls: "bread", whistle: "whistle", tissue: "tissues", tissues: "tissues",
  camera: "camera", notebook: "book", diary: "book", journal: "book", string: "string", yarn: "string", thread: "string", note: "paper", notes: "paper", map: "paper", maps: "paper",
  umbrella: "umbrella", glass: "cup", shoebox: "box", shoeboxes: "box", crate: "box", crates: "box", lostandfound: "box", lantern: "lantern", lanterns: "lantern", rope: "rope", ropes: "rope", cup: "cup", cups: "cup", mug: "cup", mugs: "cup", coffee: "cup", tea: "cup" };
export const HOLDABLE = new Set([...Object.keys(BASE_HELD), ...[...HELD_INDEX.keys()].filter((w) => !/ /.test(w))]);
/** The hand-prop builder a word draws (kit/props.js): "boots" and "slipper" are both a shoe. */
export function heldKind(word) {
  const w = String(word ?? "").toLowerCase();
  return BASE_HELD[w] ?? HELD_INDEX.get(w) ?? BASE_HELD[singularOf(w)] ?? HELD_INDEX.get(singularOf(w)) ?? null;
}
/** The catalog object a noun names ("pigeons" -> pigeon, "gate" -> fence), or null. */
export function objectForNoun(word) {
  const w = String(word ?? "").toLowerCase(), s = singularOf(w);
  for (const [name, o] of Object.entries(OBJECT_CATALOG)) if (o.aliases.includes(w) || o.aliases.includes(s)) return name;
  return null;
}
function singularOf(w) { return /ies$/.test(w) ? w.slice(0, -3) + "y" : /(ss|us)$/.test(w) ? w : /(ches|shes|xes|ses)$/.test(w) ? w.slice(0, -2) : /s$/.test(w) ? w.slice(0, -1) : w; }

// ------------------------------------------------------------------ picture-card icons (fallback for nouns)
export const ICONS = Object.freeze({
  dog: "🐕", puppy: "🐶", cat: "🐈", kitten: "🐱", bird: "🐦", fish: "🐟", horse: "🐎", cow: "🐄", chicken: "🐔", frog: "🐸",
  spider: "🕷️", bee: "🐝", snake: "🐍", mouse: "🐭", rabbit: "🐇", bear: "🐻", wolf: "🐺",
  rain: "🌧️", storm: "⛈️", snow: "❄️", wind: "🌬️", cloud: "☁️", sun: "☀️", moon: "🌙", star: "⭐", fire: "🔥", water: "💧",
  lava: "🌋", volcano: "🌋", ice: "🧊", flood: "🌊", wave: "🌊", lightning: "⚡", rainbow: "🌈", flower: "🌸", tree: "🌳",
  money: "💰", coin: "🪙", gold: "🪙", dollar: "💵", ticket: "🎟️", gift: "🎁", present: "🎁", trophy: "🏆", medal: "🏅", crown: "👑",
  phone: "📱", clock: "⏰", watch: "⌚", computer: "💻", tv: "📺", television: "📺", radio: "📻", robot: "🤖", rocket: "🚀",
  pizza: "🍕", cake: "🎂", cookie: "🍪", candy: "🍬", apple: "🍎", bread: "🍞", egg: "🥚", milk: "🥛", coffee: "☕", tea: "🍵",
  sandwich: "🥪", burger: "🍔", soup: "🍲", lunch: "🍱", pepper: "🌶️", cheese: "🧀", banana: "🍌", donut: "🍩", popcorn: "🍿",
  sock: "🧦", hat: "🎩", shoe: "👟", boot: "👢", glasses: "👓", umbrella: "☂️", bag: "🎒", backpack: "🎒", box: "📦", key: "🔑",
  letter: "✉️", mail: "📬", note: "📝", homework: "📝", test: "📝", notebook: "📓", pencil: "✏️", book: "📖", map: "🗺️",
  bed: "🛏️", chair: "🪑", couch: "🛋️", sofa: "🛋️", toilet: "🚽", bath: "🛁", mirror: "🪞", door: "🚪", lamp: "💡",
  flashlight: "🔦", candle: "🕯️", bell: "🔔", horn: "📯", whistle: "📯", guitar: "🎸", drum: "🥁", song: "🎵", music: "🎵",
  ball: "⚽", kite: "🪁", string: "🧵", rope: "🪢", ladder: "🪜", tent: "⛺", bike: "🚲", bus: "🚌", train: "🚆", plane: "✈️",
  boat: "⛵", car: "🚗", truck: "🚚", camera: "📷", photo: "📷", shadow: "👤", ghost: "👻", alien: "👽", pumpkin: "🎃",
  wedding: "💒", tissue: "🤧", teeth: "🦷", tooth: "🦷", heart: "❤️", toy: "🧸", teddy: "🧸", doll: "🪆", ring: "💍",
  sword: "🗡️", shield: "🛡️", wand: "🪄", potion: "🧪", magic: "✨", trampoline: "🤸", drain: "🕳️", hole: "🕳️", seatbelt: "🔗",
  furniture: "🛋️", floor: "🟫", wall: "🧱", fence: "🚧", sign: "🪧", game: "🎮", balloon: "🎈", paint: "🎨",
  table: "🍽️", restaurant: "🍽️", parade: "🎺", cloud: "☁️", copy: "👯", vitamin: "💊", stampede: "🐾", season: "🍂",
  monday: "📅", tuesday: "📅", wednesday: "📅", thursday: "📅", friday: "📅", saturday: "📅", sunday: "📅", calendar: "📅",
  route: "🗺️", glitch: "⚠️", payday: "💵", shift: "⏱️", wedding_cake: "🎂", vacuum: "🧹", broom: "🧹", knife: "🔪", fork: "🍴",
  grass: "🌿", dust: "💨", rock: "🪨", stone: "🪨", bone: "🦴", skull: "💀", web: "🕸️", nest: "🪺", feather: "🪶",
});
export const GENERIC_ICON = "✨";

// ------------------------------------------------------------------ word lists
/** Words that are never key nouns: abstract, too general, or grammar. */
export const ABSTRACT = new Set(("time times thing things way purpose life top middle bottom side end help kind lot bit part idea reason " +
  "moment stuff rest same other own real whole last first next point fact case world place day days week weeks year years minute " +
  "minutes hour hours second seconds morning evening afternoon sound noise thought question answer story's job trouble problem rule " +
  "rules nothing something everything anything someone somebody one ones none half while once twice again yet front back left right " +
  "bit piece pieces number numbers kind sort type air lens handle button lid edge corner inside outside lots plenty " +
  "everyone everybody anyone anybody nobody mine yours ours theirs hers " +
  // abstract nouns of the library's rules and twists (coverage, 2026-11-04): ideas, not things to show
  "deal deals law laws rank ranks promise promises joke jokes wish wishes plan plans power powers order orders math sentence spell " +
  "clue clues complaint complaints contract manners honor shame attitude company pace pulse scent escape rescue goodbye goodnight " +
  "month months inch inches mile miles size sizes word words line lines loophole loopholes claim claims trick tricks luck chance " +
  "truth lie lies fib fibs secret's problem's mistake mistakes memory memories dream dreams fear fears habit habits game's turn turns " +
  "rest's version style way's shape shapes count counts total number's level levels score's tax taxes fee fees bill bills price prices " +
  "cost costs fine fines debt reward rewards prize's offering offerings gift's spot spots space room's distance length weight height " +
  "silence's peace quiet's dare dares bet bets vote votes favor favour credit blame credit's duty duties job's chore chores task tasks " +
  "pair pairs row rows pile piles copy copies sunday sundays monday mondays tuesday tuesdays wednesday wednesdays thursday thursdays friday fridays saturday saturdays " +
  "dent dents throws lifts joins pinch pinches weekend weekends winter winters summer summers spring autumn fall's anthem beat beats bank banks stub stubs safe's carries " +
  "lesson lessons test's grade grades class's term terms season's moment's evening's noon midnight's dawn's sundown sunset's " +
  "everything's anything's somebody's nobody's anyone's someone's thank thanks hello sorry yes's no's okay").split(" "));
const STOP = new Set(("the a an and or but so if then than that this these those to of in on at for from with by into onto over under " +
  "up down out off away past through toward towards around about after before behind across until till when while because as is are was " +
  "were be been being am do does did done have has had having can cant could couldnt would wouldnt will wont shall should may might must " +
  "not no never just only even still also too very really all any every each some most more much many few both either neither " +
  "i im id ive ill me my mine myself you youre your yours he hes him his she shes her hers it its itself we were us our ours they " +
  "theyre them their theirs who whom whose which what where how why there here now ever own yes oh hey like").split(" "));
const DETS = new Set("the a an my our his her their your its this that these those every each some any one two three four five six seven eight nine ten no".split(" "));
const ADJ = new Set(("old new big little small tiny huge giant long longer short tall far near loud louder loudest quiet best worst good bad " +
  "real own whole last first secret brass golden silver dark bright red blue green yellow black white pink purple orange grey gray brown " +
  "young younger older oldest baby crumpled cracked lost found weighted favorite favourite only other same entire empty full broken late early " +
  "scary creepy happy sad angry funny weird strange magic magical wooden metal shiny dusty dirty clean wet dry cold hot warm sleepy " +
  "biggest smallest tallest fastest slowest strongest " +
  // the library's describing words (coverage, 2026-11-04)
  "rubber blank burnt squeaky spare single higher lower lumpy stale rusty sticky soft heavy slow stuck torn dead smudgy stubby offkey off-key " +
  "shadowless windup wind-up rolledup upsidedown upside-down squelchy slimy slippery smoky squishy stinky stiff stubborn stuttery fuzzy " +
  "holey hard high low clear exact perfect free faint fine frozen hungry magnificent national royal weak wild deep deeper bigger smaller " +
  "calm clumsy blind dim endless thick thin squawky cloudless crooked lopsided runny frosted hollow boiled stacked tired lonely " +
  "proud polite rude brave shy grumpy cozy fresh rotten sour sweet salty spicy bald fancy plain heavier lighter louder quieter " +
  "wooden glowing floating flying sleeping hidden whole important official only extra enough instead third second fourth twelve " +
  "eleven twenty thirty forty hundred thousand million zero").split(" "));
export const NEG_RE = /^(never|nobody|no|not|cant|dont|doesnt|didnt|wont|isnt|wasnt|arent|werent|couldnt|neither|nor|without|none)$/;
const VERBISH = /^(is|are|was|were|has|had|have|says|said|goes|went|gets|got|makes|made|takes|took|knows|knew|meant|means|needs|needed|owns|plays|hears|heard|sees|saw|keeps|kept|comes|came|turned|started|stopped|learned|remembered|creaked|unfolded|flicked|flew|shaped|looking|walks|walked)$/;

// ------------------------------------------------------------------ the rules
// Each rule: { id, re (on the cleaned line: lowercase words, "'s" dropped, single spaces), label, kind, ...recipe, show, also }
//   recipe: object {name, states: {state: re}}, set, setIf (re -> set), point (the object is the line's subject), guests,
//           pose, expr, hold, marker {kind, text}, setState {windows: {state: re}}, light, icon (card fallback)
//   show:   what on screen covers the key (any one is enough): objects, poses, exprs, holds, sets, light, setState,
//           marker ("tag" | "icon" | "any"), insertWords, monster, people (min people on screen), body (a person or the monster)
//   also:   words this rule's visual also shows when they're in the same line (not separate keys)
const W = (s) => new RegExp(`\\b(?:${s})\\b`);
export const RULES = [
  // ---------------- objects
  { id: "ice_cream_truck", kind: "object", label: "ice cream truck", re: W("ice ?cream(?: truck| van| man)?s?|icecream(?: truck| van)?s?"),
    object: { name: "ice_cream_truck", states: { mime: /\b(mime|silent|silence|quiet)\b/ } }, set: "street", point: true, icon: "🍦",
    show: { objects: ["ice_cream_truck"] }, also: ["song", "songs", "music", "jingle", "tune", "mime", "plays", "play", "truck", "van"] },
  { id: "football_field", kind: "object", label: "football team", re: W("football(?: team| field| game| match)?|soccer(?: team| field| game| match)?|stadium|touchdowns?|goal ?posts?|bleachers|(?:track |basketball |baseball |sports )?teams?"),
    object: { name: "football_field" }, set: "street", point: true, icon: "🏈",
    show: { objects: ["football_field"] }, also: ["cheer", "cheers", "cheered", "cheering", "crowd", "fans", "players", "game", "games", "match", "score", "scored", "goal", "goals", "won", "win", "heard"] },
  { id: "birthday_party", kind: "object", label: "birthday party", re: W("birthday(?: part(?:y|ies)| cakes?)?|part(?:y|ies)|birthday cakes?|balloons?"),
    object: { name: "birthday_party" }, set: "street", point: true, guests: true, icon: "🎂",
    show: { objects: ["birthday_party"] }, also: ["cake", "cakes", "balloons", "presents", "candles", "guests", "birthday", "parties", "party"] },
  { id: "bakery", kind: "object", label: "bakery", re: W("baker(?:y|ies|s)?|bread shop|bakeshop"),
    object: { name: "bakery", states: { for_sale: /\b(for sale|closed|shut down|boarded up)\b/ } }, set: "street", point: true, icon: "🥖",
    show: { objects: ["bakery"] }, also: ["sale", "closed", "bread", "shop"] },
  { id: "car_alarm", kind: "object", label: "car alarm", re: W("car alarms?|alarms?|honk(?:s|ed|ing)?|car horns?"),
    object: { name: "car", states: { alarm: /./ } }, set: "street", icon: "🚨", show: { objects: ["car"], objectState: "alarm" }, also: ["car", "beep", "beeping"] },
  { id: "car", kind: "object", label: "car", re: W("cars?"), object: { name: "car" }, set: "street", point: true, icon: "🚗", show: { objects: ["car"] } },
  { id: "photo_set", kind: "object", label: "photo", re: W("(?:school |class |yearbook |family )?(?:photos?|pictures?|photographs?|portraits?|selfies?|picture day|photographers?)"),
    object: { name: "photo_set" }, setIf: [[/\b(school|class|yearbook|picture day)\b/, "school"]], point: true, icon: "📷",
    show: { objects: ["photo_set"], holds: ["camera"] }, also: ["camera", "cameras", "smile", "cheese"] },
  { id: "crib", kind: "object", label: "crib", re: W("cribs?|cradles?"), object: { name: "crib" }, set: "bedroom", icon: "🛏️",
    show: { objects: ["crib"] } },
  { id: "babies", kind: "object", label: "babies", re: W("babies|every baby|each baby|all the babies|newborns?|nursery"),
    object: { name: "crib" }, set: "bedroom", babies: true, icon: "👶",
    show: { objects: ["crib"], roles: ["baby"] } },
  { id: "windows", kind: "object", label: "windows", re: W("windows?|lights (?:flicked|came|went|turned|switched)|lights? (?:on|off)|every light|porch lights?|lights"),
    object: { name: "house_front", states: { open: /\b(open|opened|flew open|swung open|threw open)\b/, dark: /\b(dark|went out|off|black|blacked out)\b/, lit: /\b(lights?|lit|on|glow\w*|bright)\b/ } },
    setState: true, set: "street", point: true, icon: "🪟",
    show: { objects: ["house_front"], setState: true }, also: ["dark", "open", "lit", "flicked", "house", "houses", "every house", "home", "homes"] },
  { id: "stories", kind: "object", label: "stories", re: W("(?:bedtime |old |fairy )?(?:stories|story|storybooks?|tales?|legends?|fairy ?tales?)"),
    object: { name: "stories_book" }, set: "bedroom", reader: true, icon: "📖",
    show: { objects: ["stories_book"], holds: ["book"] }, also: ["book", "books", "read", "reading", "remembered"] },
  { id: "book", kind: "object", label: "book", re: W("books?|read(?:ing)?|diary|journal"), object: { name: "stories_book" }, icon: "📖",
    hold: "book", show: { objects: ["stories_book"], holds: ["book", "notebook"] } },
  { id: "whistle", kind: "hold", label: "whistle", re: W("(?:brass |old |tin )?whistles?"), hold: "whistle", icon: "📯",
    show: { holds: ["whistle"], poses: ["blow"] }, also: ["brass"] },
  { id: "sign", kind: "insert", label: "sign", re: W("signs?(?! language)|notes?|letters?|posters?|notices?|newspapers?"), icon: "🪧", hold: "letter",
    show: { insertKinds: ["sign", "note", "card"], holds: ["sign", "note", "letter", "paper", "envelope", "clipboard", "label", "poster", "newspaper"] } },
  { id: "tower", kind: "place", label: "water tower", re: W("(?<!(?:hat|pillow|cushion|sock|book|block|pancake|box|cheese|plate|chair) )(?:water |clock |bell )?towers?|catwalk"), icon: "🗼",
    show: { monsterSpot: "tower", sets: ["street", "woods"] } },
  { id: "ladder", kind: "place", label: "ladder", re: W("(?:the )?ladders?|rungs?"), icon: "🪜", object: { name: "ladder" },
    show: { monsterSpot: "tower", holds: ["ladder"], objects: ["ladder"] } },

  // ---------------- actions (poses / expressions)
  { id: "sign_language", kind: "action", label: "sign language", re: W("sign language|signing|signs? to"), pose: "wave", expr: "shush", icon: "🤟",
    show: { poses: ["wave", "talk"], exprs: ["shush"] } },
  { id: "sneeze", kind: "action", label: "sneeze", re: W("sneez\\w*|achoo|ah-?choo"), pose: "sneeze", expr: "sneeze", icon: "🤧",
    show: { poses: ["sneeze"], exprs: ["sneeze"] } },
  { id: "blow", kind: "action", label: "blew", re: W("blew|blow|blows|blowing"), pose: "blow", hold: "whistle", icon: "📯",
    show: { poses: ["blow"] } },
  { id: "yell", kind: "action", label: "yell", re: W("scream\\w*|yell\\w*|shout\\w*|holler\\w*|roar\\w*|loud|louder|loudest|out loud|too loud|voices?|top of (?:her|his|my|their|our|your) lungs|lungs|burp\\w*|belch\\w*|howl\\w*|honk\\w*|bellow\\w*"),
    pose: "yell", expr: "yell", icon: "📢",
    show: { poses: ["yell", "blow"], exprs: ["yell"], holds: ["whistle", "horn"], objects: ["car"] } },
  { id: "whisper", kind: "action", label: "whisper", re: W("whisper\\w*|quiet\\w*|shh+|hush\\w*|secrets?|silen\\w*|mime"), expr: "shush", icon: "🤫",
    show: { exprs: ["shush"], insertWords: ["WHISPER", "SHH", "QUIET", "SECRET", "HUSH", "???"], marker: "tag" } },
  { id: "talk", kind: "action", label: "talk", re: W("talk\\w*|say|said|says|speak\\w*|spoke|told|tell\\w*"), pose: "talk", icon: "💬",
    show: { poses: ["talk", "yell", "wave"], exprs: ["shush", "yell"], insertWords: ["TALKING", "TALK"] } },
  { id: "cheer", kind: "action", label: "cheer", re: W("cheer\\w*|celebrat\\w*|hooray|danc\\w*|party|clap\\w*|applau\\w*|parades?|festivals?|contests?|competitions?"), pose: "cheer", expr: "excited", icon: "🎉",
    show: { poses: ["cheer"], exprs: ["excited", "happy"] } },
  { id: "run", kind: "action", label: "ran", re: W("ran|run|runs|running|raced|sprinted|fled|rushed|chased|bolted"), pose: "run", icon: "🏃",
    show: { poses: ["run", "walk"], monsterMove: true } },
  { id: "walk", kind: "action", label: "walk", re: W("walk\\w*|climb\\w*|crept|tiptoe\\w*|marched|stepped|wander\\w*|stomp\\w*|clomp\\w*|squeak\\w*|footsteps?|steppers?|sneak\\w*|stroll\\w*|hik\\w*"), pose: "walk", icon: "🚶",
    show: { poses: ["walk", "run"], monsterMove: true } },
  { id: "cry", kind: "action", label: "cry", re: W("cried|cry|cries|crying|tears|sobbed|sob\\w*"), expr: "cry", icon: "😢", show: { exprs: ["cry", "sad"] } },
  { id: "sleep", kind: "action", label: "sleep", re: W("slept|asleep|sleep\\w*|nap\\w*|bedtime|snor\\w*|dream\\w*|tuck\\w*|yawn\\w*"), pose: "sleep", expr: "sleepy", icon: "😴", show: { poses: ["sleep"], exprs: ["sleepy"] } },
  { id: "grab", kind: "action", label: "grab", re: W("grabbed|grabs|grab|held|holds|carried|carries|hugged|hugs|hug|hugging|picked up|lifted|taped|tapes|ties|tied|tie|hands? (?:it|them|him|her)|handed"), pose: "carry", icon: "✋",
    show: { poses: ["carry", "blow"], anyHold: true } },
  { id: "wave", kind: "action", label: "wave", re: W("wav(?:ed|es|e|ing)"), pose: "wave", icon: "👋", show: { poses: ["wave"] } },
  { id: "point", kind: "action", label: "point", re: W("point(?:ed|s|ing)"), pose: "point", icon: "👉", show: { poses: ["point"] } },
  { id: "scared", kind: "action", label: "scared", re: W("scared|afraid|terrified|froze|trembl\\w*|shaking|shook|shake|shakes|hid|hide|hiding|panick\\w*|rumbl\\w*|quak\\w*|wobbl\\w*|shiver\\w*|gasp\\w*"), pose: "scared", expr: "scared", icon: "😱",
    show: { poses: ["scared"], exprs: ["scared", "surprised"] } },
  { id: "laugh", kind: "action", label: "laugh", re: W("laugh\\w*|smil\\w*|grin\\w*|giggl\\w*"), expr: "happy", icon: "😄", show: { exprs: ["happy", "excited", "smirk"] } },
  { id: "sit", kind: "action", label: "sit", re: W("sat|sit|sits|sitting"), pose: "sit", icon: "🪑", show: { poses: ["sit"] } },
  { id: "look_up", kind: "action", label: "look up", re: W("look(?:ed|s)? up|star(?:ed|ing) up"), pose: "look_up", icon: "👀", show: { poses: ["look_up"] } },
  { id: "jump", kind: "action", label: "jump", re: W("jump\\w*|hopp\\w*|leap\\w*|bounc\\w*"), pose: "cheer", icon: "🤸", show: { poses: ["cheer", "run"] } },
  { id: "sing", kind: "action", label: "song", re: W("sang|sing|sings|singing|songs?|music|hum\\w*"), pose: "talk", expr: "happy", marker: { kind: "icon", text: "♪" }, icon: "🎵",
    show: { markerText: ["♪"], objects: ["ice_cream_truck", "birthday_party"] } },

  // ---------------- markers
  { id: "times", kind: "marker", label: "times", re: W("(?:two|three|four|five|six|ten|hundred|\\d+) times"), marker: { kind: "icon", text: "x3" }, icon: "✖️",
    show: { marker: "icon" } },
  { id: "names", kind: "marker", label: "names", re: W("names?|named|call (?:her|him|me|it|them|us)|called (?:her|him|me|it|them|us)"), marker: { kind: "tag" }, icon: "🏷️",
    show: { marker: "tag" } },

  // ---------------- places (sets)
  { id: "school", kind: "place", label: "school", re: W("school|schools|class(?:room)?s?|teachers?|hallways?|halls|lockers?|cafeteria|lunchroom|gym|recess|principal|homework|detention|chalkboards?|blackboards?|library|stage|lessons?"), set: "school", icon: "🏫",
    show: { sets: ["school"] } },
  { id: "woods", kind: "place", label: "hill", re: W("woods|woods edge|forest|trees?|treeline|hills?|hilltops?|creek|caves?|cavern|river|lake|ponds?|mountains?|trails?|cliffs?|cliff ?tops?|canyons?|valley|meadows?|field|fields|orchard|swamp|beach|shore|island|wilderness|campfires?|camp|campsite|tents?|park|bushes|bush|nests?"), set: "woods", icon: "⛰️",
    show: { sets: ["woods"], objects: ["stump", "barn", "windmill", "haystack", "mushroom", "rock"] }, stand: "stump" },
  { id: "bedroom", kind: "place", label: "bedroom", re: W("bedrooms?|beds?|room|closet|kitchen|upstairs|bathroom"), set: "bedroom", icon: "🛏️",
    show: { sets: ["bedroom"], objects: ["couch", "drawer", "fridge", "stove", "crib"] }, stand: "couch" },
  { id: "door", kind: "place", label: "door", re: W("(?:back |front )?doors?|doorways?"), set: "street", icon: "🚪", show: { sets: ["street", "bedroom", "school"], spots: ["door"] } },
  { id: "street", kind: "place", label: "street", re: W("streets?|town|towns|roads?|sidewalks?|porch(?:es)?|yards?|backyards?|outside|houses?|homes?|neighbou?rhood|square|town square|lawns?|driveways?|city|village|downtown|plaza|market|alleys?|stores?|shops?|garages?|blocks|doorsteps?|crosswalks?|avenue"), set: "street", icon: "🏘️",
    show: { sets: ["street"], objects: ["house_front", "bakery", "ice_cream_truck", "car", "fountain", "mailbox"] }, stand: "house_front" },
  // ---------------- light
  { id: "night", kind: "light", label: "night", re: W("night|nights|tonight|midnight|moon\\w*|dark"), light: "night", icon: "🌙",
    show: { light: ["night"], setStateWindows: ["dark"] } },
  { id: "day", kind: "light", label: "morning", re: W("morning|mornings|noon|daytime|sunny|afternoon|lunchtime|sunshine|sun"), light: "day", icon: "☀️", show: { light: ["day", "warm"] } },
  { id: "dusk", kind: "light", label: "sunset", re: W("dawn|dawns|sunrise|sunset|sunsets|sundown|dusk|evening|evenings|twilight"), light: "warm", icon: "🌅", show: { light: ["warm", "day", "night"] } },
  // the ground under everyone: any real shot of a set shows it ("on the floor", "the cave floor")
  { id: "floor", kind: "place", label: "floor", re: W("floors?|ground|grounds|carpet|rug|rugs|tiles?|doormat|doormats|mats?|curbs?|pavement|dirt|mud|puddles?|grass|lawn|paths?|aisles?|corridors?|stripes?|circles?|squares? on the|ceilings?|cellars?|basements?"), icon: "🟫",
    show: { sets: ["street", "bedroom", "school", "woods"] } },
  { id: "sky", kind: "place", label: "sky", re: W("sky|skies|air|horizon"), icon: "🌌", show: { sets: ["street", "woods"] } },
  // ---------------- people + bodies
  { id: "people", kind: "people", label: "people", re: W("kids?|children|man|men|woman|women|girls?|boys?|friends?|best friend|neighbou?rs?|everyone|everybody|anyone|anyone's|anybody|people|nobody|townsfolk|family|grown-?ups?|parents?|guests?|crowd|whole town|mayor|teachers?|coach|principal|sheriff|officers?|police|doctors?|nurses?|mailman|mail carrier|postman|neighbor|stranger|lady|guy|grandparents?|adults?|twins?|cousins?|uncle|aunt|" +
    "families|janitors?|cooks?|chefs?|lunch lad(?:y|ies)|captains?|judges?|barbers?|paperboys?|kings?|queens?|lords?|ladies|knights?|servants?|guards?|" +
    "jesters?|carriers?|farmers?|miners?|drivers?|sailors?|pirates?|students?|classmates?|whistlers?|sleepers?|owners?|helpers?|movers?|workers?|" +
    "babysitters?|kids'|townspeople|villagers?|citizens?|residents?|elders?|grandkids?|siblings?|sisters|brothers|bosses|boss|princes?|princess(?:es)?|wizards?|witch(?:es)?|"
    + "baker|bakers|clowns?|mimes?|tourists?|visitors?|strangers|everyone else|the rest of us|rest of us|nobody else|anyone else|" +
    "kid|crew|club|band|choir|audience|line of kids"),
    icon: "👥", show: { people: 1 } },
  { id: "body", kind: "body", label: "body", re: W("mouths?|faces?|heads?|hands?|arms?|legs?|eyes?|ears?|feet|foot|breath|pockets?|nose|teeth|fingers?|hair|shadows?|claws?|fur|lips|heartbeats?|tummy|belly|bellies|stomach|toes?|knees?|elbows?|wrists?|shoulders?|backs|necks?|chins?|cheeks?|eyebrows?|whiskers|tongues?|throat|spine"),
    icon: "👤", show: { body: true } },
];
const RULE_BY_ID = Object.fromEntries(RULES.map((r) => [r.id, r]));
export const ruleById = (id) => RULE_BY_ID[id];

// ------------------------------------------------------------------ tokens
/** Clean tokens of a text: [{ raw, c (clean word, "'s" dropped), poss, end (sentence end after it), comma }]. */
export function cleanTokens(text) {
  return tokens(text).map((raw) => {
    const r = raw.replace(/[’‘]/g, "'");
    const poss = /'s[,.!?;:"']*$/i.test(r) && !/^(it|that|he|she|there|here|what|who|let|name)'s/i.test(r);
    const c = norm(r.replace(/'s([,.!?;:"']*)$/i, "$1")) || norm(r);
    return { raw, c, poss, end: /[.!?]["']?$/.test(r), comma: /[,;:]["']?$/.test(r) };
  });
}

/** Runs a regex over the cleaned text and maps every match to token ranges [k, end]. */
function matchTokens(re, toks) {
  const s = toks.map((t) => t.c).join(" ");
  const starts = []; let pos = 0;
  toks.forEach((t) => { starts.push(pos); pos += t.c.length + 1; });
  const at = (i) => { let k = 0; while (k + 1 < starts.length && starts[k + 1] <= i) k++; return k; };
  const out = [];
  for (const m of s.matchAll(new RegExp(re.source, "g"))) {
    if (!m[0]) continue;
    out.push({ k: at(m.index), end: at(m.index + m[0].length - 1), text: m[0] });
  }
  return out;
}

const singular = (w) => /ies$/.test(w) ? w.slice(0, -3) + "y" : /(ss|us)$/.test(w) ? w : /(ches|shes|xes|ses)$/.test(w) ? w.slice(0, -2) : /s$/.test(w) ? w.slice(0, -1) : w;
export const iconFor = (word) => ICONS[word] ?? ICONS[singular(word)] ?? GENERIC_ICON;

/**
 * The world the dictionary reads names against:
 *   { people: Map(id -> { name, role, baby }), alias: { sister: "bean", baby: "bean" }, narrator, monster: { key, lairWords },
 *     looseNames: Set(lowercase), prop }
 */
const FAMILY = { mom: "mom", mum: "mom", mommy: "mom", mother: "mom", dad: "dad", daddy: "dad", father: "dad", grandma: "grandma", granny: "grandma", nana: "grandma", grandpa: "grandpa", grandad: "grandpa", grandfather: "grandpa", grandmother: "grandma", brother: "brother", sister: "sister" };
const TITLES = /^(mr|mrs|ms|miss|dr|coach|aunt|uncle|officer|principal|sheriff|mayor|baker|farmer|postman|mailman|captain|lady|lord|king|queen|sir|dame|fisher|cook|chef|nurse|judge|professor|prince|princess|old|big|little|young|sergeant|doctor|mister|madam|janitor|teacher|count|duke|baron|grandma|grandpa|granny|nana)$/;

/**
 * The key nouns / actions of a text. `opts.neg` marks negated actions ("nobody talks", "never heard a cheer").
 * Returns keys in token order. Deterministic.
 */
export function extractKeys(text, vw, opts = {}) {
  const toks = cleanTokens(text);
  const used = new Array(toks.length).fill(false);
  const keys = [];
  const free = (k, e) => { for (let i = k; i <= e; i++) if (used[i]) return false; return true; };
  const take = (k, e) => { for (let i = k; i <= e; i++) used[i] = true; };
  const negAt = (k) => {
    for (let i = k - 1; i >= Math.max(0, k - 4); i--) { if (toks[i].end) break; if (NEG_RE.test(toks[i].c)) return true; }
    return false;
  };

  // 0. "In this town / world," is the frame of the rule, not a place to show
  toks.forEach((t, k) => { if (k <= 1 && t.c === "this" && /^(town|world|city|place)$/.test(toks[k + 1]?.c ?? "") && toks[k - 1]?.c === "in") take(k - 1, k + 1); });
  const ruleOwned = new Array(toks.length).fill(false);

  // 1. people, the monster, names (before rules: "Bean" is a person, never a noun)
  toks.forEach((t, k) => {
    if (used[k]) return;
    const c = t.c;
    if ((TITLES.test(c) || FAMILY[c]) && toks[k + 1] && vw.people.has(toks[k + 1].c)) { keys.push({ kind: "person", id: toks[k + 1].c, label: vw.people.get(toks[k + 1].c).name, k, end: k + 1, poss: toks[k + 1].poss }); take(k, k + 1); return; }
    if (vw.monster) {
      // the whole name ("the Detention Dragon"), else its head / creature word ("the dragon"), "monster", "creature"
      const ws = vw.monster.words ?? [vw.monster.key];
      if (ws.length > 1 && ws.every((w, i) => toks[k + i]?.c === w)) { keys.push({ kind: "monster", label: vw.monster.name ?? c, k, end: k + ws.length - 1 }); take(k, k + ws.length - 1); return; }
      if ((vw.monster.keys ?? [vw.monster.key]).some((m) => c.startsWith(m)) || c === "monster" || c === "creature") { keys.push({ kind: "monster", label: vw.monster.name ?? c, k, end: k }); take(k, k); return; }
    }
    if (c === norm(vw.narrator) && k > 0 && /^(im|i am|called|named)$/.test(toks[k - 1].c)) { keys.push({ kind: "name", label: vw.narrator, name: vw.narrator, on: "me", k: k - 1, end: k }); take(k, k); return; }
    if (c === norm(vw.narrator) && c !== "me") { keys.push({ kind: "person", id: "me", label: vw.narrator, k, end: k, poss: t.poss }); take(k, k); return; }
    if (vw.people.has(c) && c !== "me") { keys.push({ kind: "person", id: c, label: vw.people.get(c).name, k, end: k, poss: t.poss }); take(k, k); return; }
    if (FAMILY[c]) {
      if ((c === "sister" || c === "brother") && toks[k - 1]?.c === "baby") { const id = vw.alias.baby ?? vw.alias[c] ?? "baby"; keys.push({ kind: "person", id, label: `baby ${c}`, k: k - 1, end: k, poss: t.poss }); take(k - 1, k); return; }
      const id = vw.alias[FAMILY[c]] ?? FAMILY[c];
      keys.push({ kind: "person", id, label: c, k, end: k, poss: t.poss }); take(k, k); return;
    }
    if (c === "baby" && toks[k + 1]?.c !== "sister" && toks[k + 1]?.c !== "brother" && !/^(every|each|all|the)$/.test(toks[k - 1]?.c ?? "") && vw.alias.baby) { keys.push({ kind: "person", id: vw.alias.baby, label: "baby", k, end: k }); take(k, k); return; }
    if (vw.looseNames.has(c)) { keys.push({ kind: "name", label: t.raw.replace(/[^A-Za-z']/g, ""), name: t.raw.replace(/[^A-Za-z']/g, ""), k, end: k }); take(k, k); }
  });
  // the monster's lair words ("water tower") are the tower rule's

  // 2. the rules, in order; each match consumes its tokens, `also` words in the text are consumed with it
  const hits = [];
  for (const rule of RULES) {
    for (const m of matchTokens(rule.re, toks)) {
      if (!free(m.k, m.end)) continue;
      if (rule.id === "sign" && /^(language)$/.test(toks[m.end + 1]?.c ?? "")) continue;
      take(m.k, m.end);
      if (rule.kind !== "action" && rule.kind !== "marker") for (let i = m.k; i <= m.end; i++) ruleOwned[i] = true;   // a thing, not a verb
      const key = { kind: "rule", rule: rule.id, label: rule.label, k: m.k, end: m.end, text: m.text, neg: rule.kind === "action" || rule.kind === "object" ? negAt(m.k) : false };
      if (m.k > 0 && toks[m.k - 1].poss) key.phrase = `${toks[m.k - 1].raw.replace(/[^A-Za-z']/g, "").replace(/'s$/i, "")}'s ${m.text}`;
      if (rule.id === "names") key.plural = /names/.test(m.text);
      if (rule.id === "times") key.count = m.text.split(" ")[0];
      hits.push(key);
      keys.push(key);
      for (const w of rule.also ?? []) toks.forEach((t, i) => { if (!used[i] && t.c === w) used[i] = true; });
    }
  }
  // a negated yell ("nobody talks out loud") is shown by the hush, not a scream; a negated talk the same
  for (const key of hits) if (key.neg && (key.rule === "yell" || key.rule === "talk" || key.rule === "cheer")) key.label = `no ${key.label}`;

  // 3. other content nouns: after a determiner / possessive (skipping adjectives), or any known icon noun
  toks.forEach((t, k) => {
    if (used[k]) return;
    const c = t.c;
    if (STOP.has(c) || ABSTRACT.has(c) || VERBISH.test(c) || c.length < 3 || /^\d+$/.test(c)) return;
    // "a roll of tape", "a slice of toast": the thing is what comes after "of"
    if (/^(roll|rolls|slice|slices|piece|pieces|pair|pairs|bit|bits|stack|stacks|pile|piles|scrap|scraps|chunk|chunks|bunch|lot|lots|handful|crumb|crumbs|sort|kind)$/.test(c) && toks[k + 1]?.c === "of" && !t.end && !t.comma) return;
    const icon = ICONS[c] ?? ICONS[singular(c)];
    let afterDet = false, start = k;
    for (let i = k - 1; i >= 0 && i >= k - 4; i--) {
      const p = toks[i];
      if (p.end || p.comma) break;
      // "that"/"this" are determiners only before a known thing ("that whistle"), else relative ("a shadow that quits")
      if ((DETS.has(p.c) && (icon || !/^(that|this|these|those)$/.test(p.c))) || p.poss) { afterDet = true; break; }
      // modifiers: adjectives; before a known thing also a singular noun / unknown adjective ("kite string", "late bus")
      // (a thing a rule already showed can be a modifier too: "a giant hollow cliff-top bell")
      const mod = ADJ.has(p.c) || /est$/.test(p.c) || (icon && k - i <= 2 && !/s$/.test(p.c) && !STOP.has(p.c) && !VERBISH.test(p.c) && !NEG_RE.test(p.c) && (!used[i] || ruleOwned[i]));
      if (!mod) break;
      start = i;
    }
    // a known thing without a determiner counts where a noun stands: a sentence's first word ("Dogs here wear...") or
    // after a preposition ("by trampoline") or a having verb ("beds have seatbelts"), never after a noun ("the kids
    // fish back": a verb)
    const prev = toks[start - 1];
    const nounSlot = !prev || prev.end || prev.comma || /^(in|on|at|by|with|of|from|to|into|like|for|about|than|under|over|and|or)$/.test(prev.c) ||
      /^(have|has|had|wear|wears|wore|need|needs|love|loves|hate|hates|eat|eats|ate|own|owns|keep|keeps|kept|hold|holds|held|sell|sells|buy|buys|bought|make|makes|made|got|get|gets|found|find|finds|carry|carries|bring|brings|brought|fear|fears|feed|feeds|cost|costs|lose|lost|steal|stole|chase|chased|chases)$/.test(prev.c);
    if (!afterDet && !(icon && nounSlot)) return;
    if (ADJ.has(c) || /(ly|est)$/.test(c) || (!icon && /(ed|ing)$/.test(c) && c.length > 5)) return;
    // the noun is the last of a run ("school bus": bus); a word right before a noun (or a rule's thing: "night-shift baker")
    // is its modifier
    const nx = toks[k + 1];
    if (!t.end && !t.comma && nx && (ruleOwned[k + 1] || (!used[k + 1] && !STOP.has(nx.c) && !VERBISH.test(nx.c) && !ABSTRACT.has(nx.c) && (ICONS[nx.c] || ICONS[singular(nx.c)])))) return;
    const owner = k > 0 && toks[k - 1].poss ? toks[k - 1].raw.replace(/[^A-Za-z']/g, "").replace(/'s$/i, "") : null;
    keys.push({ kind: "noun", label: c, noun: singular(c), k, end: k, icon: icon ?? GENERIC_ICON, phrase: owner ? `${owner}'s ${c}` : c, neg: negAt(k) });
    take(k, k);
  });
  keys.sort((a, b) => a.k - b.k);
  // a possessive owner is soft when what they own is shown by itself ("Grandpa's whistle" in the kid's hand); it must
  // be on screen when the thing is part of them ("Dad's shadow", "Grandma's teeth")
  keys.forEach((key, i) => {
    if (key.kind !== "person" || !key.poss) return;
    const nx = keys.slice(i + 1).find((x) => x.k > key.end);
    const r = nx?.kind === "rule" ? RULE_BY_ID[nx.rule] : null;
    key.soft = !!(r && r.kind === "hold") || (nx?.kind === "noun" && HOLDABLE.has(nx.noun));
  });
  return keys;
}

// ------------------------------------------------------------------ coverage
const objName = (o) => (typeof o === "string" ? o : o?.name);
const up = (s) => String(s ?? "").toUpperCase();
const wordIn = (needle, hay) => {
  const n = up(needle).replace(/[^A-Z0-9]/g, "");
  if (!n) return up(hay).includes(String(needle));
  const h = up(hay).replace(/[^A-Z0-9 ]/g, " ");
  return h.split(/\s+/).some((w) => w && (w === n || singular(w.toLowerCase()) === singular(n.toLowerCase())));
};
const shotMarkers = (s) => [...(s.markers ?? []), ...(s.marker && !(s.markers ?? []).some((m) => m === s.marker || (m.on === s.marker.on && m.text === s.marker.text)) ? [s.marker] : [])];

/** Does this one shot show the key? `cast` = timeline.cast (for roles). */
export function covers(key, s, cast = {}) {
  const actors = s.actors ?? [];
  const objs = (s.objects ?? []).map(objName);
  const people = actors.length + (objs.includes("football_field") || objs.includes("birthday_party") ? 3 : 0);
  const insertText = s.insert?.text ?? "";
  const marks = shotMarkers(s);
  const textual = (w) => wordIn(w, insertText) || marks.some((m) => wordIn(w, m.text));
  if (key.kind === "person") return actors.some((a) => a.id === key.id || a.hold === key.id) || textual(key.label);
  if (key.kind === "monster") return !!s.monsterState || textual(key.label);
  if (key.kind === "name") return marks.some((m) => wordIn(key.name, m.text)) || textual(key.name);
  if (key.kind === "noun") {
    if (actors.some((a) => a.hold && singular(a.hold) === key.noun)) return true;
    const hk = heldKind(key.noun) ?? heldKind(key.label);
    if (hk && actors.some((a) => a.hold && heldKind(a.hold) === hk)) return true;
    if (hk && (s.objects ?? []).some((o) => objName(o) === "item" && o.state === hk)) return true;
    if (objs.some((o) => OBJECT_CATALOG[o]?.aliases.some((al) => al === key.label || al === key.noun))) return true;
    return textual(key.noun) || textual(key.label);
  }
  const r = RULE_BY_ID[key.rule];
  if (!r) return false;
  const sh = r.show ?? {};
  if (key.neg) {
    // a negated action / object: shown by the hush or a sad face, or the object's own silent crowd
    if (actors.some((a) => ["shush", "sad", "neutral", "scared"].includes(a.expr))) return true;
    if (objs.some((o) => (sh.objects ?? []).includes(o))) return true;
    if (r.kind === "action" && objs.includes("football_field")) return true;
    return textual(key.label.replace(/^no /, ""));
  }
  if (sh.objects && objs.some((o) => sh.objects.includes(o))) {
    if (!sh.objectState) return true;
    if ((s.objects ?? []).some((o) => objName(o) === sh.objects[0] && o.state === sh.objectState)) return true;
  }
  if (sh.poses && actors.some((a) => sh.poses.includes(a.pose))) return true;
  if (sh.exprs && actors.some((a) => sh.exprs.includes(a.expr))) return true;
  if (sh.holds && actors.some((a) => a.hold && (sh.holds.includes(a.hold) || (heldKind(a.hold) && sh.holds.some((h) => heldKind(h) === heldKind(a.hold)))))) return true;
  if (sh.anyHold && actors.some((a) => a.hold)) return true;
  if (sh.sets && sh.sets.includes(s.set) && !(r.kind === "place" && s.camera === "insert")) {
    if (r.id !== "tower" || s.monsterState || s.camera === "wide") return true;
  }
  if (sh.spots && actors.some((a) => sh.spots.includes(a.spot))) return true;
  if (sh.light && sh.light.includes(s.light) && s.camera !== "insert") return true;
  if (sh.setState && s.setState?.windows) return true;
  if (sh.setStateWindows && sh.setStateWindows.includes(s.setState?.windows)) return true;
  if (sh.monsterSpot && s.monsterState?.spot === sh.monsterSpot) return true;
  if (sh.monsterMove && s.monsterState && !actors.some((a) => a.pose === "run" || a.pose === "walk")) return true;
  if (sh.monsterMove && actors.some((a) => a.pose === "run" || a.pose === "walk")) return true;
  if (sh.marker && marks.some((m) => sh.marker === "any" || m.kind === sh.marker)) return true;
  if (sh.markerText && marks.some((m) => sh.markerText.includes(m.text))) return true;
  if (sh.insertKinds && s.insert && sh.insertKinds.includes(s.insert.kind)) return true;
  if (sh.insertWords && sh.insertWords.some((w) => up(insertText).includes(w))) return true;
  if (sh.roles && actors.some((a) => sh.roles.includes(cast[a.id]?.role) || cast[a.hold]?.role === "baby")) return true;
  if (sh.people && people >= sh.people) return true;
  if (sh.body && (actors.length || s.monsterState)) return true;
  return textual(key.label) || textual(String(key.text ?? "").split(" ").at(-1));
}

/** A short "what the shot shows" line for the report. */
export function describeShot(s, cast = {}) {
  if (s.camera === "insert" && s.insert) return `${s.insert.kind.toUpperCase()} "${s.insert.text}"${s.insert.icon ? ` ${s.insert.icon}` : ""}`;
  const bits = [];
  for (const o of s.objects ?? []) bits.push(`${o.name}${o.state ? `(${o.state})` : ""}`);
  if (s.setState?.windows) bits.push(`windows ${s.setState.windows}`);
  for (const a of s.actors ?? []) {
    const who = cast[a.id]?.name ?? a.id;
    const role = cast[a.id]?.role === "baby" ? " (baby)" : "";
    const hold = a.hold ? ` +${cast[a.hold]?.name ?? a.hold}` : "";
    bits.push(`${who}${role} ${a.pose}${hold}/${a.expr}`);
  }
  if (s.monsterState) bits.push(`Listener ${s.monsterState.state}@${s.monsterState.spot}`.replace("Listener", "monster"));
  for (const m of shotMarkers(s)) bits.push(`${m.kind} "${m.text}"${m.on && m.on !== "all" ? ` on ${cast[m.on]?.name ?? m.on}` : ""}`);
  if (s.insert) bits.push(`${s.insert.kind} "${s.insert.text}"`);
  const focus = s.focus && !["group", "object"].includes(s.focus) ? ` [on ${s.focus === "monster" ? "monster" : cast[s.focus]?.name ?? s.focus}]` : "";
  return `${s.set}/${s.light} ${s.camera}${focus}: ${bits.join(", ") || "(empty)"}`;
}

/** The picture card for a key nobody can show otherwise. */
export function cardFor(key) {
  const r = key.rule ? RULE_BY_ID[key.rule] : null;
  const text = (key.phrase ?? (key.kind === "rule" ? key.text : null) ?? key.label ?? "").replace(/^no /, "").toUpperCase().split(/\s+/).slice(0, 4).join(" ");
  return { kind: "card", text, icon: key.icon ?? r?.icon ?? iconFor(key.noun ?? key.label) };
}

/** Which keys of a line are the line's "ideas" for splitting: [{ k, set }] by place (rules with a set). */
export function anchorsOf(text) {
  const toks = cleanTokens(text);
  const out = [];
  for (const r of RULES) {
    if (!r.set || r.kind === "action") continue;
    for (const m of matchTokens(r.re, toks)) {
      const set = r.setIf?.find(([re]) => re.test(m.text))?.[1] ?? r.set;
      out.push({ k: m.k, set, rule: r.id });
    }
  }
  return out.sort((a, b) => a.k - b.k);
}
