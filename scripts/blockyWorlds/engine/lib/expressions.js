// Blocky Worlds EXPRESSIONS (CHARACTERS-V2, 2026-11-09; owner: "Expression per line from the line's emotion, never
// 'neutral' by default"). Pure and deterministic (no I/O, no Math.random), Node + browser.
//
// The face kit (page/kit/facesV2.js) draws FACES (32 named faces: the planner's 13 + mime + 18 richer ones). This module
// picks one per actor per shot:
//   classifyEmotion(text) -> { face, family, score, intensity, hits[] }    a small free word classifier (lexicon +
//                                                                          negation + intensifiers + ! / ?)
//   directorFace(word) -> face | null                                       the director's per-line emotion word, if any
//   faceForActor({ text, part, mood, directorEmotion, plannedExpr, pose, subject }) -> { face, why }
//   exprPass(tl, { production, mood }) -> { set, byWhy }                    sets shot.actors[*].face (never "neutral")
// The planner's a.expr stays as it is (its vocabulary is checked by checkTimeline / checkVisuals); a.face is the richer
// face the page draws (engine: setFace(o, a.face ?? a.expr)). Pose-bound faces (yell, sneeze, shush, sleepy, cry, mime)
// always win: the pose and the face must agree.

/** every face the face kit draws (page/kit/facesV2.js FACES has the same list; dev/charactersV2.test.mjs keeps them in step) */
export const FACE_NAMES = Object.freeze([
  // the planner's vocabulary (plan.mjs EXPRS) + mime
  "neutral", "happy", "sad", "scared", "surprised", "angry", "sleepy", "smirk", "cry", "excited", "shush", "yell", "sneeze", "mime",
  // CHARACTERS-V2
  "calm", "laugh", "proud", "worried", "determined", "embarrassed", "confused", "disgusted", "love", "nervous", "curious",
  "relieved", "grumpy", "awe", "silly", "shocked", "bored", "hopeful",
]);
/** the planner's word for a richer face (so a.face never contradicts a.expr's family) */
export const BASE_OF = Object.freeze({
  calm: "happy", laugh: "happy", proud: "smirk", worried: "scared", determined: "angry", embarrassed: "sad", confused: "surprised",
  disgusted: "angry", love: "happy", nervous: "scared", curious: "surprised", relieved: "happy", grumpy: "angry", awe: "surprised",
  silly: "excited", shocked: "surprised", bored: "sleepy", hopeful: "happy",
});
/** faces bound to a pose / an action: the planner's choice is kept as is */
export const STRONG = new Set(["yell", "sneeze", "shush", "sleepy", "cry", "mime"]);

// ---------------------------------------------------------------------------------------------------------------- lexicon
// [regex over the lower-cased line, face, weight]. Families: joy, fear, anger, sad, surprise, calm, other.
const W = (s) => new RegExp(`\\b(?:${s})\\b`, "g");
const LEX = [
  // joy
  [W("laugh\\w*|giggl\\w*|chuckl\\w*|hilarious|funny|lol|haha\\w*|joke\\w*"), "laugh", 3],
  [W("happy|happier|happiest|glad|smil\\w*|grin\\w*|joy\\w*|cheerful|delight\\w*|pleased|fun|yay|nice|lovely|great|wonderful|best"), "happy", 2],
  [W("excit\\w*|thrill\\w*|amazing|awesome|incredible|hooray|woo+|yes+|won|win|wins|winning|party|celebrat\\w*|can't wait|cannot wait"), "excited", 3],
  [W("proud|pride|did it|nailed it|champion|hero|brave|bravest|medal|trophy|first place"), "proud", 3],
  [W("love[sd]?|loving|adore\\w*|crush|sweetheart|hug\\w*|kiss\\w*|cute|cuddl\\w*|darling|heart"), "love", 2],
  [W("relie\\w*|phew|finally|safe now|at last|thank goodness|made it home|all right after all"), "relieved", 3],
  [W("hope\\w*|wish\\w*|maybe one day|someday|dream\\w*"), "hopeful", 2],
  [W("silly|goofy|wacky|prank\\w*|tickl\\w*|bonk\\w*|wiggl\\w*|boing"), "silly", 3],
  // fear
  [W("scared|afraid|terrif\\w*|fright\\w*|horror|horrif\\w*|scream\\w*|monster|creep\\w*|spooky|haunt\\w*|panic\\w*|run for|ran for"), "scared", 3],
  [W("nervous|anxious|shaky|gulp\\w*|jitter\\w*|sweat\\w*|uh oh|uh-oh|oops|trembl\\w*|shiver\\w*"), "nervous", 3],
  [W("worr\\w*|uneasy|trouble|danger\\w*|careful|warn\\w*|lost|missing|vanish\\w*|disappear\\w*|strange|weird|wrong"), "worried", 2],
  // anger
  [W("furious|rage|angr\\w*|mad|fum\\w*|hate[sd]?|stomp\\w*|glar\\w*|growl\\w*|enough|how dare"), "angry", 3],
  [W("grumpy|grumbl\\w*|cranky|annoy\\w*|grouch\\w*|sulk\\w*|huff\\w*|ugh|frown\\w*|complain\\w*"), "grumpy", 3],
  [W("determin\\w*|must|will not|won't stop|never give up|fight\\w*|ready|focus\\w*|plan\\w*|mission|quest|charge[ds]?|train\\w*"), "determined", 2],
  [W("gross|yuck|ew+|stink\\w*|smell\\w*|disgust\\w*|slime|slimy|rotten|mould\\w*|mold\\w*|icky|eww"), "disgusted", 3],
  // sad
  [W("sad|sadly|unhappy|lonely|alone|miss(?:ed|es)?|sorry|gone|lost it|broken|broke|goodbye|farewell|gloomy|tears?|sigh\\w*|nobody came"), "sad", 2],
  [W("cri(?:ed|es)|cry\\w*|sob\\w*|weep\\w*|wept|bawl\\w*"), "cry", 3],
  [W("embarrass\\w*|blush\\w*|awkward|ashamed|shy|oops|whoops"), "embarrassed", 3],
  [W("bored|boring|dull|nothing ever|same old|yawn\\w*|meh|waited and waited"), "bored", 3],
  // surprise
  [W("surpris\\w*|wow|whoa|suddenly|gasp\\w*|unexpected|out of nowhere"), "surprised", 2],
  [W("shock\\w*|stunned|froze|frozen|could not believe|couldn't believe|no way|jaw dropped"), "shocked", 3],
  [W("wonder\\w*|magic\\w*|beautiful|glow\\w*|sparkl\\w*|majestic|stars|rainbow|breathtaking"), "awe", 2],
  [W("giant|huge|enormous|gigantic|towering"), "awe", 1],
  [W("confus\\w*|puzzl\\w*|strange|huh|hmm+|why|how come|didn't understand|did not understand|weird|backwards|upside down"), "confused", 2],
  [W("curious|wonder(?:ed|ing)? (?:what|why|if|how)|peek\\w*|explor\\w*|discover\\w*|found|find|look(?:ed|ing)? (?:for|at|inside)|secret|mystery|clue\\w*"), "curious", 2],
  [W("smirk\\w*|sneak\\w*|sly|trick\\w*|plot\\w*|scheme\\w*|clever|wink\\w*"), "smirk", 3],
  // calm
  [W("calm|quiet|peace\\w*|gentle|soft\\w*|relax\\w*|cozy|cosy|warm|sunny|morning"), "calm", 1],
  [W("sleep\\w*|asleep|tired|nap\\w*|snor\\w*|drowsy|bedtime"), "sleepy", 3],
  [W("whisper\\w*|shh+|hush\\w*|silent|silence"), "shush", 3],
];
const FAMILY = {
  happy: "joy", laugh: "joy", excited: "joy", proud: "joy", love: "joy", relieved: "joy", hopeful: "joy", silly: "joy", calm: "calm", smirk: "joy",
  scared: "fear", nervous: "fear", worried: "fear", shocked: "surprise", surprised: "surprise", awe: "surprise", confused: "surprise", curious: "surprise",
  angry: "anger", grumpy: "anger", determined: "anger", disgusted: "anger", sad: "sad", cry: "sad", embarrassed: "sad", bored: "sad", sleepy: "calm", shush: "calm",
};
// a stronger / milder face of the same family (intensity: "!" "very" "so" -> up; "a bit" "slightly" -> down)
const UP = { happy: "excited", calm: "happy", worried: "scared", nervous: "scared", scared: "shocked", grumpy: "angry", sad: "cry", surprised: "shocked", curious: "surprised", hopeful: "excited" };
const DOWN = { excited: "happy", angry: "grumpy", scared: "worried", shocked: "surprised", cry: "sad", laugh: "happy" };
// a negated feeling ("not scared", "never happy")
const NOT = { happy: "sad", excited: "bored", laugh: "grumpy", love: "grumpy", scared: "determined", nervous: "calm", worried: "calm", angry: "calm", grumpy: "happy", sad: "happy", cry: "relieved", bored: "excited", surprised: "bored", awe: "bored", proud: "embarrassed", hopeful: "worried", calm: "worried", curious: "bored" };
const NEG_RE = /\b(not|never|no|nobody|nothing|didn't|did not|don't|do not|wasn't|was not|isn't|is not|won't|can't|cannot|couldn't|stopped being)\s+(?:\w+\s+)?$/;
const INTENS_RE = /\b(very|so|really|super|totally|extremely|incredibly|absolutely|completely)\s+$/;
const SOFT_RE = /\b(a bit|a little|slightly|kind of|kinda|sort of|somewhat)\s+$/;

/** the line's emotion from its words: { face, family, score, intensity, hits } (face null when no word matched) */
export function classifyEmotion(text = "") {
  const t = ` ${String(text ?? "").toLowerCase().replace(/[’`]/g, "'").replace(/[^a-z0-9'!?\s-]/g, " ").replace(/\s+/g, " ")} `;
  const score = new Map(), hits = [];
  let intensity = 0;
  for (const [re, face, w] of LEX) {
    re.lastIndex = 0;
    for (const m of t.matchAll(re)) {
      const before = t.slice(Math.max(0, m.index - 28), m.index);
      let f = face, k = w;
      if (NEG_RE.test(before)) { f = NOT[face] ?? face; k = w * 0.9; }
      else if (INTENS_RE.test(before)) { f = UP[face] ?? face; k = w + 1; }
      else if (SOFT_RE.test(before)) { f = DOWN[face] ?? face; }
      score.set(f, (score.get(f) ?? 0) + k);
      hits.push(`${m[0].trim()}>${f}`);
    }
  }
  const bangs = (t.match(/!/g) ?? []).length, asks = (t.match(/\?/g) ?? []).length;
  intensity = Math.min(3, bangs) - (/\.\.\./.test(String(text)) ? 1 : 0);
  if (asks && !score.size) score.set("curious", 1);
  if (asks && score.has("surprised")) score.set("confused", (score.get("confused") ?? 0) + 1);
  if (!score.size) return { face: null, family: null, score: 0, intensity, hits };
  // best score; ties go to the stronger family (fear > anger > sad > surprise > joy > calm), then to the first hit
  const order = ["fear", "anger", "sad", "surprise", "joy", "calm"];
  const ranked = [...score.entries()].sort((a, b) => b[1] - a[1] || order.indexOf(FAMILY[a[0]]) - order.indexOf(FAMILY[b[0]]));
  let [face, s] = ranked[0];
  if (intensity >= 2 && UP[face] && !STRONG.has(face)) face = UP[face];
  return { face, family: FAMILY[face] ?? "other", score: s, intensity, hits };
}

// the director's per-line emotion word (production.lines[i].emotion / mood / feeling, if the director gives one)
const DIRECTOR_WORDS = {
  joy: "happy", joyful: "happy", happy: "happy", glad: "happy", content: "calm", calm: "calm", peaceful: "calm", neutral: "calm",
  excited: "excited", thrilled: "excited", ecstatic: "excited", elated: "excited", amused: "laugh", funny: "laugh", playful: "silly", silly: "silly",
  proud: "proud", triumphant: "proud", victorious: "proud", confident: "proud", loving: "love", love: "love", tender: "love", warm: "love",
  relieved: "relieved", hopeful: "hopeful", wistful: "hopeful", scared: "scared", afraid: "scared", fear: "scared", fearful: "scared", terrified: "shocked",
  horror: "scared", tense: "nervous", nervous: "nervous", anxious: "nervous", worried: "worried", uneasy: "worried", suspense: "worried", ominous: "worried",
  angry: "angry", furious: "angry", mad: "angry", annoyed: "grumpy", grumpy: "grumpy", frustrated: "grumpy", determined: "determined", resolute: "determined",
  brave: "determined", heroic: "determined", disgusted: "disgusted", sad: "sad", sorrow: "sad", melancholy: "sad", lonely: "sad", grief: "cry", crying: "cry",
  embarrassed: "embarrassed", shy: "embarrassed", ashamed: "embarrassed", bored: "bored", tired: "sleepy", sleepy: "sleepy",
  surprised: "surprised", shocked: "shocked", stunned: "shocked", amazed: "awe", awe: "awe", awed: "awe", wonder: "awe", curious: "curious", intrigued: "curious",
  mysterious: "curious", confused: "confused", puzzled: "confused", sly: "smirk", smug: "smirk", mischievous: "smirk",
};
export function directorFace(word) {
  if (!word) return null;
  const w = String(word).toLowerCase().trim();
  if (FACE_NAMES.includes(w) && w !== "neutral") return w;
  for (const tok of w.split(/[^a-z]+/)) if (DIRECTOR_WORDS[tok]) return DIRECTOR_WORDS[tok];
  return null;
}

// a face for a line that names no feeling: by the story's part (and the mood), never "neutral"
const PART_FACE = { hook: "curious", rule: "curious", tour: "happy", me: "proud", until: "worried", twist: "shocked", discovery: "surprised", climax: "determined", closer: "relieved" };
// a bystander's face next to the subject's (they react to it)
const REACT = { angry: "worried", grumpy: "nervous", determined: "proud", disgusted: "disgusted", sad: "worried", cry: "sad", embarrassed: "laugh", bored: "bored",
  scared: "scared", nervous: "worried", worried: "worried", shocked: "shocked", surprised: "surprised", awe: "awe", confused: "curious", curious: "curious",
  laugh: "laugh", happy: "happy", excited: "happy", proud: "happy", love: "happy", relieved: "happy", hopeful: "hopeful", silly: "laugh", smirk: "confused", calm: "calm" };
// the planner's pose says a lot (a cheering person is not "calm")
const POSE_FACE = { cheer: "excited", dance: "happy", scared: "scared", hide: "nervous", fall: "shocked", fight: "determined", push: "determined", climb: "determined",
  kick: "determined", throw: "determined", dig: "determined", build: "determined", hug: "love", eat: "happy", jump: "excited", fly: "excited", swim: "happy",
  look_up: "awe", point: "surprised", sleep: "sleepy", yell: "yell", sneeze: "sneeze", ride: "excited", drive: "happy", wave: "happy" };
const FIT = { // faces a pose can wear (a pose face wins over a word face that would read wrong on that body)
  cheer: /^(excited|happy|laugh|proud|relieved|silly|awe|love)$/, scared: /^(scared|nervous|worried|shocked|cry)$/, hide: /^(scared|nervous|worried|smirk|silly)$/,
  sleep: /^(sleepy)$/, fight: /^(angry|determined|grumpy|scared)$/, hug: /^(love|happy|cry|relieved|sad|laugh)$/,
};

/**
 * one actor's face. Priority: a pose-bound planner face (yell, sneeze, shush, sleepy, cry, mime) > the pose's own face
 * when the words' face would not fit that body > the director's per-line emotion > the line's words > the pose > the
 * planner's non-neutral expr > the story part (+ mood). Bystanders (subject false) react to the subject's face.
 * -> { face, why }
 */
export function faceForActor({ text = "", part = null, mood = null, directorEmotion = null, plannedExpr = null, pose = null, subject = true, lineFace = null } = {}) {
  if (plannedExpr && STRONG.has(plannedExpr)) return { face: plannedExpr, why: "pose-bound" };
  const poseFace = POSE_FACE[pose] ?? null;
  if (poseFace && STRONG.has(poseFace)) return { face: poseFace, why: "pose" };
  const fromDir = directorFace(directorEmotion);
  const fromWords = lineFace ?? classifyEmotion(text).face;
  let face = fromDir ?? fromWords, why = fromDir ? "director" : fromWords ? "words" : null;
  if (face && !subject) { face = REACT[face] ?? face; why = `${why}-reaction`; }
  if (face && FIT[pose] && !FIT[pose].test(face)) { face = poseFace; why = "pose-fit"; }
  if (!face && poseFace) { face = poseFace; why = "pose"; }
  if (!face && plannedExpr && plannedExpr !== "neutral" && FACE_NAMES.includes(plannedExpr)) { face = plannedExpr; why = "planner"; }
  if (!face) {
    const light = mood === "funny" || mood === "wholesome" || mood === "cozy";
    face = PART_FACE[part] ?? (light ? "happy" : "calm");
    if (mood === "horror" && (part === "tour" || part === "rule")) face = "worried";
    why = "part";
  }
  if (face === "neutral") { face = "calm"; why = `${why}+calm`; }
  return { face, why };
}

/** the line's subject actor id: the first actor whose id / name is in the words, "me" for a first-person line, else the focus */
function subjectId(shot, cast) {
  const t = ` ${String(shot.text ?? "").toLowerCase()} `;
  const ids = (shot.actors ?? []).map((a) => a.id);
  for (const id of ids) {
    const nm = String(cast?.[id]?.name ?? "").toLowerCase().replace(/^(mr|mrs|ms|miss|dr)\.?\s+/, "");
    if ((nm && nm.length > 1 && t.includes(` ${nm}`)) || t.includes(` ${id.replace(/_/g, " ")} `)) return id;
  }
  if (/\b(i|me|my|i'm|we|us)\b/.test(t) && ids.includes("me")) return "me";
  return ids.includes(shot.focus) ? shot.focus : ids[0] ?? null;
}

/**
 * The faces pass (after planning; re-runnable): every actor of every shot gets a.face from its line's emotion (the
 * director's per-line emotion word, else the words), the subject the line's own face and the others a reaction, never
 * "neutral". Lines spanning several shots share their classification. -> { set, byWhy: { why: n } }
 */
export function exprPass(tl, { production = null, mood = null } = {}) {
  const P = production ?? tl?.production ?? null;
  const dirLines = new Map((P?.lines ?? []).map((l) => [l.line, l.emotion ?? l.mood ?? l.feeling ?? null]));
  const m = mood ?? tl?.mood ?? tl?.idea?.mood ?? null;
  const memo = new Map();
  let set = 0;
  const byWhy = {};
  for (const s of tl?.shots ?? []) {
    if (!(s.actors ?? []).length) continue;
    const key = s.line ?? s.text;
    if (!memo.has(key)) memo.set(key, classifyEmotion(s.lineText ?? s.text ?? "").face);
    const sub = subjectId(s, tl.cast);
    for (const a of s.actors) {
      const r = faceForActor({ text: s.text, part: s.part, mood: m, directorEmotion: dirLines.get(s.line), plannedExpr: a.expr, pose: a.pose, subject: a.id === sub || s.actors.length === 1, lineFace: memo.get(key) });
      a.face = r.face; set++;
      byWhy[r.why] = (byWhy[r.why] ?? 0) + 1;
    }
  }
  return { set, byWhy };
}
