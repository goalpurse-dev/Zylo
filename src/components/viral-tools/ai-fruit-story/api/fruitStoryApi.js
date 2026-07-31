import { supabase } from "../../../../lib/supabaseClient";
import { createImageJobSimple, createVideoJobSimple } from "../../../../lib/jobs";
import { getFruitStoryStyle } from "../config/fruitStoryStyles";
import { getAllowedVideoModels as sharedGetAllowedVideoModels, PLAN_LABELS } from "../../../../lib/planGating";

export { PLAN_LABELS };

// supabase-js's functions.invoke() sets error.message to the fixed string
// "Edge Function returned a non-2xx status code" on any non-2xx response —
// the edge function's actual { error: "..." } body only lives on
// error.context (the raw Response), which invoke() never reads for you.
// Without this, every real backend error message gets replaced by that one
// generic phrase.
async function resolveFunctionErrorMessage(error, fallback) {
  const ctx = error?.context;
  if (ctx && typeof ctx.clone === "function") {
    try {
      const body = await ctx.clone().json();
      if (body?.error) return String(body.error);
    } catch {}
    try {
      const text = await ctx.clone().text();
      if (text) return text.slice(0, 500);
    } catch {}
  }
  return error?.message || fallback;
}

/* ─── Model key mappings ─── */
export const FRUIT_IMAGE_MODEL_TO_TOOLKEY = {
  "zyvo-v2": "image:fruit-v2",  // GPT Image 2    — 2 credits/image
};

// Three video tiers, gated by plan — same pattern as Clay Rescue. All three
// now include audio. Video credits below are tuned so the BLENDED per-scene
// margin (1 image @ 2cr/$0.010423 + 1 video clip) lands at ~50%, not just the
// video's own margin — the image's higher margin (~74%) pulls the combined
// number up, so video-only credits sit a bit below a flat 2x cost markup.
export const FRUIT_VIDEO_MODELS = {
  "fruit-v2": {
    id: "fruit-v2",
    label: "V2",
    tag: "Cheapest",
    description: "480p — includes audio",
    toolKey: "video:seedance15pro",
    duration: 5,
    // ⚠️ Cost is an ESTIMATE, not measured — no-sound 480p was $0.0607656/5s
    // (measured). Scaled by this same model's 720p sound/no-sound ratio
    // (5.25/2.5 ≈ 2.1x) to ~$0.1276/5s. 12cr → blended per-scene margin ~50.7%.
    // Please run one real 480p+audio Seedance 1.5 Pro test and report the
    // invoice cost so this can be corrected like the others were.
    credits: 12,
    withSound: true,
    dims: {
      "9:16": { width: 496, height: 864 },
      "16:9": { width: 864, height: 496 },
      "1:1":  { width: 680, height: 680 },
    },
  },
  "fruit-v3": {
    id: "fruit-v3",
    label: "V3",
    tag: "+ Audio",
    description: "720p — includes audio",
    toolKey: "video:viduq3turbo720",
    duration: 5,
    credits: 17,            // measured $0.17875/5s → blended per-scene margin ~50.2%
    withSound: true,
    dims: {
      "9:16": { width: 720, height: 1280 },
      "16:9": { width: 1280, height: 720 },
      "1:1":  { width: 960, height: 960 },
    },
  },
  "fruit-v4": {
    id: "fruit-v4",
    label: "V4",
    tag: "Best quality",
    description: "Full resolution — includes audio",
    toolKey: "video:fruitveo31lite",
    duration: 6,
    credits: 29,            // $0.30/6s clip cost → blended per-scene margin ~49.9%
    withSound: true,
    dims: {
      "9:16": { width: 1080, height: 1920 },
      "16:9": { width: 1920, height: 1080 },
      "1:1":  { width: 1080, height: 1080 },
    },
  },
};
export const DEFAULT_FRUIT_VIDEO_MODEL = "fruit-v2";

// Plan gating — which video models each plan tier can use.
export const FRUIT_VIDEO_MODEL_MIN_PLAN = {
  "fruit-v2": "starter",
  "fruit-v3": "pro",
  "fruit-v4": "generative",
};

export function getAllowedFruitVideoModels(planCode) {
  return sharedGetAllowedVideoModels(planCode, FRUIT_VIDEO_MODEL_MIN_PLAN);
}

export const MAX_FRUIT_VOICEOVER_CHARS = 95;
export const MAX_FRUIT_VOICEOVER_LINE_CHARS = 80;
export const MIN_FRUIT_VIDEO_PROMPT_CHARS = 80;
const MAX_RUNWARE_VIDEO_PROMPT_CHARS = 1450;
const MAX_PROVIDER_DIALOGUE_LINES = 4;
const MAX_PROVIDER_DIALOGUE_LINE_CHARS = 80;

// Only check the sections that are truly essential for video generation.
// Sections like "Ending beat:", "Camera:", "Visual clue:" are nice-to-have but
// can be trimmed away by the 1450-char limit — don't block generation over them.
// "SPOKEN DIALOGUE" header contains "SAY EXACTLY", "ENGLISH WORDS ONLY", and "Dialogue"
// so those checks are satisfied even when speechRules is trimmed by the 1450-char budget.
// "Speech rules:" label itself is omitted — with 4-line alternating dialogue the section
// can be pushed past the budget, and its content is now encoded in the per-speaker rules.
const REQUIRED_VIDEO_PROMPT_SECTIONS = [
  "SPOKEN DIALOGUE",
  "SAY EXACTLY",
  "ENGLISH WORDS ONLY",
  "Action:",
  "no background music",
  "Negative:",
];

export function isFruitVideoPromptReady(value) {
  const text = String(value ?? "").trim();
  const normalized = text.toLowerCase();
  if (text.length < MIN_FRUIT_VIDEO_PROMPT_CHARS) return false;
  if (!REQUIRED_VIDEO_PROMPT_SECTIONS.every((section) => normalized.includes(section.toLowerCase()))) return false;
  if (hasMusicRequest(text)) return false;
  if (hasVagueSlowSceneLanguage(text)) return false;
  if (!hasActionVerb(text)) return false;
  const dialogue = extractPromptDialogueLines(text);
  if (!dialogue.length) return false;
  return dialogue.every((row) => row.line.length <= MAX_PROVIDER_DIALOGUE_LINE_CHARS);
}

/* ─── Per-model, per-aspect dimensions ─── */
const FRUIT_MODEL_DIMS = {
  "zyvo-v2": {
    "9:16": { width: 720,  height: 1280, size: "720x1280"  },
    "16:9": { width: 1280, height: 720,  size: "1280x720"  },
    "1:1":  { width: 720,  height: 720,  size: "720x720"   },
  },
};

export function getFruitV2CreditsPerImage(selectedCharacters) {
  const count = Array.isArray(selectedCharacters) ? selectedCharacters.length : 0;
  return count >= 3 ? 3 : 2;
}

export function getFruitImageCreditsPerImage(modelId, selectedCharacters) {
  return getFruitV2CreditsPerImage(selectedCharacters);
}

const STORY_LENGTH_DURATION_SEC = {
  "15s": 6, "30s": 6, "45s": 6, "60s": 6,
};

const STORY_LENGTH_SCENE_COUNTS = {
  "15s": 3,
  "30s": 5,
  "45s": 7,
  "60s": 10,
};

export function getFruitClipCountForLength(storyLength = "30s") {
  return STORY_LENGTH_SCENE_COUNTS[storyLength] ?? 5;
}

export function getFruitSceneCountForLength(storyLength = "30s") {
  return STORY_LENGTH_SCENE_COUNTS[storyLength] ?? 5;
}

export function buildVideoClipsFromScenes(scenes = []) {
  const readyScenes = [...(scenes ?? [])]
    .filter((scene) => scene?.imageUrl)
    .sort((a, b) => Number(a.sceneNumber ?? 0) - Number(b.sceneNumber ?? 0));

  return readyScenes.map((scene, index) => {
    const sceneNumber = Number(scene.sceneNumber ?? index + 1);
    return {
      clipNumber: index + 1,
      outputLabel: `Video ${index + 1}`,
      displaySceneNumber: sceneNumber,
      startSceneNumber: sceneNumber,
      startImageUrl: scene.imageUrl,
      duration: 6,
      startPrompt: scene.videoPrompt ?? "",
      videoPrompt: scene.videoPrompt ?? "",
      dialogue: normalizeClipDialogue(
        scene.videoDialogue ?? scene.dialogue ?? parseVoiceoverDialogue(scene.videoVoiceover) ?? deriveSingleSceneDialogue(scene),
      ),
      voiceover: normalizeClipVoiceover(
        scene.videoVoiceover ?? dialogueToVoiceover(
          normalizeClipDialogue(scene.videoDialogue ?? scene.dialogue ?? deriveSingleSceneDialogue(scene)),
        ),
      ),
      videoJobId: scene.videoJobId ?? null,
      videoStatus: scene.videoStatus ?? "idle",
      videoProgress: scene.videoProgress ?? 0,
      videoUrl: scene.videoUrl ?? null,
      error: scene.error ?? null,
    };
  });
}

export function normalizeClipVoiceover(value) {
  return String(value ?? "").trim().slice(0, MAX_FRUIT_VOICEOVER_CHARS);
}

export function normalizeVoiceoverLine(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_FRUIT_VOICEOVER_LINE_CHARS);
}

export function normalizeClipDialogue(dialogue = []) {
  return (Array.isArray(dialogue) ? dialogue : [])
    .slice(0, MAX_PROVIDER_DIALOGUE_LINES)
    .map((item, index) => ({
      speaker: readableCharacterName(item?.speaker || item?.name || item?.character || `Fruit ${index + 1}`),
      line: normalizeVoiceoverLine(item?.line || item?.text || ""),
      emotion: item?.emotion || "dramatic",
    }))
    .filter((item) => item.speaker);
}

export function dialogueToVoiceover(dialogue = []) {
  const lines = dialogue
    .slice(0, 2)
    .filter((item) => normalizeVoiceoverLine(item.line))
    .map((item) => `${readableCharacterName(item.speaker)}: "${normalizeVoiceoverLine(item.line)}"`);
  return normalizeClipVoiceover(lines.join("\n"));
}

function parseVoiceoverDialogue(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const rows = raw
    .split(/\n+/)
    .map((line) => {
      const match = line.match(/^\s*([^:]{1,40})\s*:\s*["“”']?(.*?)["“”']?\s*$/);
      if (!match) return null;
      return {
        speaker: readableCharacterName(match[1]),
        line: normalizeVoiceoverLine(match[2]),
        emotion: "dramatic",
      };
    })
    .filter(Boolean);

  return rows.length ? rows : null;
}

const FRUIT_CHARACTER_DISPLAY_NAMES = {
  ananasgirl: "Ananas Girl",
  appleson: "Apple Son",
  banana: "Banana",
  bossmango: "Boss Mango",
  brokkoliboss: "Brokkoli Boss",
  brockolliboss: "Brokkoli Boss",
  gangsterpineapple: "Gangster Pineapple",
  hotpeach: "Hot Peach",
  lemonkid: "Lemon Kid",
  orangekid: "Orange Kid",
  orangemom: "Orange Mom",
  strawberrymom: "Strawberry Mom",
};

function readableCharacterName(value) {
  const raw = typeof value === "object" && value !== null
    ? (value.name || value.label || value.characterId || value.id || "Fruit")
    : value;
  const text = String(raw ?? "Fruit").trim();
  const compact = text.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (FRUIT_CHARACTER_DISPLAY_NAMES[compact]) return FRUIT_CHARACTER_DISPLAY_NAMES[compact];

  return text
    .replace(/^(wife|husband|mother|kid|son|mistress|friend|boss|villain|hero|partner|ex|baby)_/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function deriveClipDialogue(startScene, endScene) {
  const cast = [
    ...(startScene?.charactersInScene ?? startScene?.characterIdsInScene ?? []),
    ...(endScene?.charactersInScene ?? endScene?.characterIdsInScene ?? []),
  ];
  const speakers = [...new Set(cast.map(readableCharacterName).filter(Boolean))];
  const first = speakers[0] ?? "Fruit";
  const second = speakers[1] ?? first;
  return [
    {
      speaker: first,
      line: buildShortViralLine(first, startScene, 0),
      emotion: startScene?.emotionDirection || "shocked",
    },
    {
      speaker: second,
      line: buildShortViralLine(second, endScene ?? startScene, 1),
      emotion: endScene?.emotionDirection || "dramatic",
    },
  ];
}

function deriveSingleSceneDialogue(scene) {
  const cast = scene?.charactersInScene ?? scene?.characterIdsInScene ?? [];
  const speakers = [...new Set(cast.map(readableCharacterName).filter(Boolean))];
  if (speakers.length === 0) return [];
  const first = speakers[0];
  const second = speakers[1] ?? null;
  const firstLine = buildShortViralLine(first, scene, 0);
  const secondLine = second ? buildShortViralLine(second, scene, 1) : null;

  return [
    {
      speaker: first,
      line: firstLine,
      emotion: scene?.emotionDirection || "dramatic",
    },
    ...(second ? [{
      speaker: second,
      line: secondLine,
      emotion: scene?.emotionDirection || "tense",
    }] : []),
  ];
}

// Legacy pools kept only as emergency fallback — GPT generates dialogue now.
// DO NOT add fruit-type names here: the video model renders that fruit character
// from scratch when it reads the name, ignoring the reference image.
const VIRAL_LINE_POOLS = {
  boss: [
    ["Who gave you permission to do that?",    "You were never supposed to find out."],
    ["Empty your pockets right now.",           "It was a mistake, I swear to you."],
    ["You really thought I wouldn't find out?", "I can explain all of this, please."],
    ["This is over. You are completely done.",  "Please don't do this to me now."],
    ["I trusted you with absolutely everything.","I made one mistake. Only one time."],
  ],
  villain: [
    ["Hello there. Did you miss me?",           "You are not real. You cannot be here."],
    ["Surprise — it was me the whole time.",    "That is impossible. How did you do it?"],
    ["I took everything that was yours.",        "Give it all back right now."],
    ["You cannot tell us apart, can you?",       "Stay away from my family. I mean it."],
    ["The game was rigged from the very start.", "You set me up this whole time, didn't you?"],
  ],
  twin: [
    ["Hello. I am your twin sister.",            "No. You do not exist. This is not real."],
    ["I have been living your entire life.",      "Get out of my house right now."],
    ["He thinks I am you. He always has.",       "Do not you dare go anywhere near him."],
    ["There are two of us. One big secret.",     "I am calling the police immediately."],
  ],
  cheater: [
    ["She is nothing to me, just a friend.",     "Then show me your phone right now."],
    ["Do not open that. It is just work stuff.", "I already read every single message."],
    ["You are overreacting, I promise you that.","Her name is saved in your phone."],
    ["I can explain all of this to you.",        "Stop talking. I do not want to hear it."],
    ["She means absolutely nothing to me.",      "Then why is her lipstick on your shirt?"],
  ],
  wife: [
    ["Tell me exactly who she is right now.",    "She is nobody. I promise you that."],
    ["Tell me her name. I want to hear it.",     "You are twisting everything around."],
    ["I found every single message you sent.",   "Those messages are old. Ancient history."],
    ["Why does she keep calling your phone?",    "I will block her right now, I promise."],
    ["You smell completely different. Explain.", "That smell is from work, not from her."],
  ],
  mom: [
    ["I raised you better than this behavior.",  "Mom, it is complicated, okay? Please."],
    ["Who exactly is that girl you are with?",   "She is just someone I happen to know."],
    ["I heard everything you said last night.",   "You were not supposed to hear any of that."],
    ["That baby has your eyes. I can see it.",   "Mom please, not right now. Not today."],
    ["Do not stand there and lie to me.",        "I was not going to lie, I swear it."],
  ],
  kid: [
    ["Daddy, I saw you kissing that lady.",       "Come here right now. Let me explain this."],
    ["Please please please do not leave us.",     "I am not going anywhere, I promise you."],
    ["Mommy is crying again. Why is she crying?","Everything is fine sweetheart. Go to sleep."],
    ["That same lady came back again today.",     "What lady? Tell me everything you saw."],
    ["I found something inside your jacket.",     "Put that down right now. Do not touch it."],
  ],
  shock: [
    ["Wait — that baby looks exactly like you.", "That is not what you are thinking it is."],
    ["I found the receipt inside your bag.",      "You were never supposed to find that."],
    ["I found this photo inside your wallet.",    "I can explain this. Please just listen."],
    ["She just texted you again right now.",      "Give me back my phone immediately."],
    ["Your bags are already packed by the door.", "You packed my bags? Are you serious?"],
  ],
  default: [
    ["Give me your phone right now.",            "You are not going to like what you see."],
    ["Say her name out loud. I dare you.",       "You already know the answer to that."],
    ["I am done. I am completely done with this.","Please. Give me just one more chance."],
    ["Who is she? Tell me absolutely everything.","It started as nothing at all, I swear."],
    ["That note just fell out of your pocket.",  "That note is very old. Very very old."],
    ["You lied directly to my face.",            "I was going to tell you everything today."],
    ["I know exactly what you did last night.",  "You do not know what you actually saw."],
    ["Do not touch me right now. Back away.",    "Just let me explain everything, please."],
  ],
};

// ── Beat-type specific dialogue pools (checked BEFORE character-role pools) ──
// These ensure preset stories get contextually correct dialogue.
const BEAT_LINE_POOLS = {
  // Baby story beats
  baby_reveal: [
    ["The test is positive. We are going to have a baby.", "Oh my god. This is actually real."],
    ["We are going to have a baby together.",               "I cannot believe this is really happening."],
    ["I am going to be a mom. For real.",                   "And I am going to be a father."],
  ],
  baby_hint: [
    ["Why have you been so tired and sick lately?",  "I have just been feeling really different."],
    ["Something is definitely different about you.", "Maybe something has changed. Something big."],
    ["Are you feeling okay? Please tell me.",        "I do not know how to say this yet."],
  ],
  baby_clue: [
    ["What is this? Is this a pregnancy test?",      "Please just do not freak out right now."],
    ["I found something in our bathroom just now.",  "Just please listen before you say anything."],
    ["Tell me right now what is going on.",          "I was going to tell you tonight, I promise."],
  ],
  reaction: [
    ["Are you absolutely one hundred percent sure?", "I have never been more sure of anything."],
    ["This changes absolutely everything for us.",   "It changes everything. And that is good."],
    ["I am actually going to be a parent.",          "We both are. Starting right now together."],
  ],
  bonding: [
    ["Look at those tiny little hands right there.", "She already has your eyes. I can see it."],
    ["I love you so incredibly much right now.",     "I love you both more than everything."],
    ["We actually did this. We made this happen.",   "We really did this one together, didn't we."],
  ],
  preparation: [
    ["Is the nursery even close to ready yet?",      "Almost ready. Almost perfect for our baby."],
    ["We still have so much left to figure out.",    "We will figure it all out together somehow."],
    ["Are we actually ready to be parents?",         "We were born ready for this moment."],
  ],
  // Twin story beats
  double_spotted: [
    ["I just saw you standing across the street.",   "That is impossible. I am standing right here."],
    ["You were somehow in two places at once.",      "No. That absolutely cannot be right at all."],
    ["Someone with your exact face was over there.", "You must be confused. That person was me."],
  ],
  twin_reveal: [
    ["Hello there. I am the other one.",             "This cannot be real. This cannot be happening."],
    ["We look exactly the same, do we not.",         "Who are you? Tell me who you are right now."],
    ["Did you miss your other half all this time?",  "How long exactly have you been hiding here."],
  ],
  // Cheats-back beats
  glow_up: [
    ["You look completely and totally different.",    "I finally look exactly like myself now."],
    ["What in the world happened to you?",            "I stopped sitting around waiting for you."],
    ["You look absolutely incredible right now.",     "I know exactly how I look. I worked for it."],
  ],
  betrayal: [
    ["I know absolutely everything now. All of it.", "Just let me explain this to you please."],
    ["I saw every single message. Every one.",       "It was all one big mistake. All of it."],
    ["I trusted you with everything I had.",         "I know that. And I broke all of it."],
  ],
  walk_away: [
    ["I am done with this. We are completely over.", "Please do not do this to us right now."],
    ["Do not follow me. Do not ever call me.",       "I am so incredibly sorry. I am so sorry."],
    ["Goodbye. And I really mean it this time.",     "Wait. Just wait one second. Please wait."],
  ],
  // Kicked-out beats
  conflict: [
    ["Get out of here. I mean every word of it.",   "Please. Just listen to me one more time."],
    ["You have to leave this house right now.",      "Where exactly am I supposed to go now?"],
    ["I want you completely gone by tonight.",       "This is my home too. You cannot do this."],
  ],
  kicked_out: [
    ["I have absolutely nowhere to go right now.",   "I am so sorry. I am truly deeply sorry."],
    ["You kicked me out with nothing at all.",       "You made your choice. Now you own it."],
    ["Is this really truly what you want from me?", "Honestly I do not know what I want anymore."],
  ],
  determination: [
    ["Just watch exactly what I do from here.",     "You have already completely moved on anyway."],
    ["I do not need you in my life anymore.",        "You do not mean that. You know you don't."],
    ["This is only just the beginning for me.",      "Good. You deserve every single good thing."],
  ],
};

// Scene 1 hooks by preset type
const SCENE_1_HOOKS_BY_PRESET = {
  baby:          ["I have something really important to tell you tonight.", "You are scaring me. What is going on?"],
  "baby":        ["I have something really important to tell you tonight.", "You are scaring me. What is going on?"],
  cheating:      ["Wait — whose number is this in your phone?",            "Do not touch my phone right now."],
  "cheats-back": ["I know exactly what you did to me.",                    "You do not know everything that happened."],
  "secret-twin": ["Something is very seriously wrong here.",               "Everything is completely fine. Just trust me."],
  "kicked-out":  ["This situation cannot keep going on like this.",        "What exactly do you mean by that?"],
  custom:        ["We need to have a serious talk right now.",              "Is everything okay with you? What happened?"],
};

const SCENE_1_HOOK_DEFAULT = ["Wait — whose number is this in your phone?", "Do not touch my phone right now."];

function pickViralLine(name, scene, index) {
  const sceneNum  = Number(scene?.sceneNumber ?? 1);
  const beatType  = String(scene?.beatType ?? "").toLowerCase();
  const storyPreset = String(scene?.storyPreset ?? scene?.preset ?? "").toLowerCase();

  // Scene 1: use preset-specific hook
  if (sceneNum === 1) {
    const row = SCENE_1_HOOKS_BY_PRESET[storyPreset] ?? SCENE_1_HOOK_DEFAULT;
    return row[index === 0 ? 0 : 1];
  }

  // Beat-type pool takes priority over character-role pool
  if (BEAT_LINE_POOLS[beatType]) {
    const pool = BEAT_LINE_POOLS[beatType];
    const row  = pool[sceneNum % pool.length];
    return row[index === 0 ? 0 : 1];
  }

  // Fall back to character-role pools for cheating/drama scenes
  const text = `${name ?? ""} ${beatType} ${scene?.emotionDirection ?? ""} ${scene?.storyPurpose ?? ""} ${scene?.title ?? ""}`.toLowerCase();
  let pool;
  if (/(boss|gangster|mafia|kingpin|brokkolib|broccoli)/.test(text))       pool = VIRAL_LINE_POOLS.boss;
  else if (/(villain|antagonist|gangster pineapple)/.test(text))           pool = VIRAL_LINE_POOLS.villain;
  else if (/(twin|double|copy|doppelganger)/.test(text))                   pool = VIRAL_LINE_POOLS.twin;
  else if (/(cheater|mistress|affair|guilty|hot peach|hotpeach)/.test(text)) pool = VIRAL_LINE_POOLS.cheater;
  else if (/(mom|mother|wife|orange mom|strawberry mom|betrayed|heartbreak)/.test(text)) pool = VIRAL_LINE_POOLS.wife;
  else if (/(grandma|aunt|mama|matriarch)/.test(text))                     pool = VIRAL_LINE_POOLS.mom;
  else if (/(kid|baby|son|daughter|child)/.test(text))                     pool = VIRAL_LINE_POOLS.kid;
  else if (/(shock|twist|reveal|discovery|confrontation)/.test(text))      pool = VIRAL_LINE_POOLS.shock;
  else                                                                       pool = VIRAL_LINE_POOLS.default;

  const row = pool[sceneNum % pool.length];
  return row[index === 0 ? 0 : 1];
}

function buildShortViralLine(name, scene, index = 0) {
  return pickViralLine(name, scene, index);
}

function getScenePacingRole(scene, form = {}) {
  const sceneNumber = Number(scene?.sceneNumber ?? 1);
  const sceneCount = Number(form.sceneCount ?? 5);
  if (sceneCount <= 3) {
    return ["Instant hook", "Discovery / confrontation", "Twist / cliffhanger"][sceneNumber - 1] ?? "Twist / cliffhanger";
  }
  if (sceneCount <= 5) {
    return ["Instant hook", "Suspicious clue", "Discovery", "Confrontation / twist", "Final shock / cliffhanger"][sceneNumber - 1] ?? "Final shock / cliffhanger";
  }
  return [
    "Instant hook",
    "Suspicious clue",
    "Discovery",
    "Confrontation",
    "Twist",
    "Chaos / escalation",
    "Emotional peak",
    "Last-second proof",
    "Explosive reaction",
    "Final shock / cliffhanger",
  ][sceneNumber - 1] ?? "Final shock / cliffhanger";
}

function deriveVisualClue(scene) {
  const text = `${scene?.title ?? ""} ${scene?.beatType ?? ""} ${scene?.storyPurpose ?? ""} ${scene?.actionDirection ?? ""}`.toLowerCase();
  if (/(phone|text|message|call|dm|screen)/.test(text)) return "a glowing phone with a suspicious unread message";
  if (/(baby|kid|basket|crib|cry)/.test(text)) return "a baby item or basket that changes the whole story";
  if (/(suitcase|kicked|leave|walk away|door)/.test(text)) return "a dropped suitcase by the open door";
  if (/(photo|picture|camera|security|proof)/.test(text)) return "a photo or security footage frame that proves the secret";
  if (/(flower|gift|receipt|lipstick)/.test(text)) return "a suspicious gift, receipt, or mark that exposes the lie";
  if (/(twin|double|copy)/.test(text)) return "a reflected double or hidden matching character reveal";
  return "one clear physical clue from the image that proves the drama";
}

function deriveEndingBeat(scene) {
  const text = `${scene?.beatType ?? ""} ${scene?.title ?? ""} ${scene?.storyPurpose ?? ""}`.toLowerCase();
  if (/(final|payoff|cliff|shock)/.test(text)) return "end on a tight freeze-frame of the most shocked face as the next secret is about to drop";
  if (/(baby|kid)/.test(text)) return "end as the baby item is revealed and everyone freezes";
  if (/(phone|message|text)/.test(text)) return "end as a second notification hits and both characters gasp";
  if (/(door|kicked|walk)/.test(text)) return "end as the door opens or the suitcase drops mid-argument";
  if (/(twin|twist)/.test(text)) return "end as the hidden character steps forward into frame";
  return "end with a sudden gasp, sharp turn, or freeze-frame that makes the viewer want the next clip";
}

function inferFruitVoiceStyle(nameOrId, roleText = "") {
  const text = `${nameOrId ?? ""} ${roleText ?? ""}`.toLowerCase();
  if (/(boss|gangster|villain|mafia|kingpin|threat|evil)/.test(text)) {
    return "deep, confident, slightly threatening voice with controlled dramatic pauses";
  }
  if (/(mom|mother|wife|aunt|grandma)/.test(text)) {
    return "warm, emotional, dramatic voice with a shaky betrayed edge";
  }
  if (/(kid|baby|son|daughter|child)/.test(text)) {
    return "cute, innocent, slightly higher-pitched voice with anxious timing";
  }
  if (/(cheater|mistress|secret|guilty|affair|hot peach|hotpeach)/.test(text)) {
    return "nervous, defensive voice that tries to sound innocent but cracks under pressure";
  }
  if (/(betrayed|cry|sad|heartbroken|shocked)/.test(text)) {
    return "shaky, emotional voice with wounded dramatic delivery";
  }
  if (/(twin|antagonist|rival|smug)/.test(text)) {
    return "mysterious, smug voice with teasing villain energy";
  }
  if (/(rich|business|ceo|luxury|polished)/.test(text)) {
    return "polished, arrogant voice with expensive confidence";
  }
  return "expressive fruit-character voice with clear TikTok-drama emotion";
}

function toCharacterProfile(castEntry) {
  if (!castEntry) return null;
  return {
    fruitType:          castEntry.fruitType ?? "",
    genderPresentation: castEntry.genderPresentation ?? "",
    agePresentation:    castEntry.agePresentation ?? "",
    personality:        castEntry.personality ?? "",
    narrativeRole:      castEntry.narrativeRole ?? "",
    narrativeFunction:  castEntry.narrativeFunction ?? "",
    emotionalArc:       castEntry.emotionalArc ?? "",
  };
}

function getSceneCharacterNames(scene, form = {}) {
  const selected = Array.isArray(form.selectedCharacters) ? form.selectedCharacters : [];
  const castBible = Array.isArray(form.castBible) ? form.castBible : [];
  const ids = [
    ...(Array.isArray(scene?.characterIdsInScene) ? scene.characterIdsInScene : []),
    ...(Array.isArray(scene?.charactersInScene) ? scene.charactersInScene : []),
  ].filter(Boolean);
  const uniqueIds = [...new Set(ids.map((id) => String(id ?? "").trim()).filter(Boolean))];

  if (uniqueIds.length === 0 && selected.length > 0) {
    return selected.slice(0, 2).map((char) => {
      const castEntry = getCastEntryById(castBible, char.id ?? char.characterId ?? char.slug)
        ?? findCastEntryByLabel(castBible, char.name ?? char.label);
      return {
        id: char.id ?? char.characterId ?? char.slug ?? char.name,
        name: readableCharacterName(char.name ?? char.label ?? char.id ?? char.characterId),
        role: castEntry?.narrativeRole ?? char.role ?? char.id ?? "",
        profile: toCharacterProfile(castEntry),
      };
    });
  }

  return uniqueIds.map((id) => {
    const wanted = normalizeText(id);
    const match = selected.find((char) =>
      normalizeText(char?.id) === wanted ||
      normalizeText(char?.characterId) === wanted ||
      normalizeText(char?.slug) === wanted ||
      normalizeText(char?.name) === wanted ||
      normalizeText(char?.label) === wanted ||
      normalizeText(deriveCharLabel(char)) === wanted ||
      normalizeText(deriveCastId(char)) === wanted
    );
    const castEntry = getCastEntryById(castBible, id)
      ?? findCastEntryByLabel(castBible, id)
      ?? (match ? (getCastEntryById(castBible, match.id) ?? findCastEntryByLabel(castBible, match.name ?? match.label)) : null);
    return {
      id,
      name: readableCharacterName(match?.name ?? match?.label ?? castEntry?.displayName ?? castEntry?.referenceLabel ?? match?.id ?? id),
      role: castEntry?.narrativeRole ?? match?.role ?? match?.id ?? id,
      profile: toCharacterProfile(castEntry),
    };
  });
}

function buildSceneDialogueLines(scene, form) {
  // 1. Use GPT-generated videoDialogue first (from planner)
  const fromGpt = normalizeClipDialogue(scene?.videoDialogue ?? []);
  if (fromGpt.length) return fromGpt;

  // 2. Try to extract dialogue from GPT's videoPrompt text
  const fromPrompt = scene?.videoPrompt
    ? normalizeClipDialogue(extractPromptDialogueLines(scene.videoPrompt).map((r) => ({
        speaker: r.speaker,
        line: r.line,
      })))
    : [];
  if (fromPrompt.length) return fromPrompt;

  // 3. Last resort: derive a single contextual line from scene metadata
  //    (no hardcoded pools — just a generic dramatic line)
  const characters = getSceneCharacterNames(scene, form);
  const first = characters[0]?.name ?? "Character";
  const second = characters[1]?.name ?? null;
  const beatText = `${scene?.beatType ?? ""} ${scene?.emotionDirection ?? ""}`.toLowerCase();

  const line0 = beatText.includes("hook")        ? "Wait. What is this?"
              : beatText.includes("discovery")    ? "I found everything."
              : beatText.includes("confrontation")? "Tell me the truth now."
              : beatText.includes("payoff")       ? "I am done with you."
              : "Say it. Right now.";
  const line1 = beatText.includes("cheater") || beatText.includes("guilty")
              ? "I can explain, please."
              : "You don't understand this.";

  return normalizeClipDialogue([
    { speaker: first, line: line0 },
    ...(second ? [{ speaker: second, line: line1 }] : []),
  ]);
}

function normalizeWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizePromptQuotes(value) {
  return String(value ?? "")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'");
}

function hasMusicRequest(value) {
  // Strip all "no X music / no X scores" negations before checking for music keywords
  const cleaned = normalizeWhitespace(value)
    .toLowerCase()
    .replace(/no\s+\w+\s+music/g, "")          // "no background music", "no dramatic music"
    .replace(/without\s+\w+\s+music/g, "")
    .replace(/no\s+music\s+of\s+any\s+kind/g, "")
    .replace(/no\s+music/g, "")
    .replace(/no\s+\w+\s+scores?/g, "")        // "no dramatic scores", "no film scores"
    .replace(/no\s+scores?/g, "")
    .replace(/no\s+soundtrack/g, "")
    .replace(/no\s+musical\s+\w+/g, "")
    .replace(/no\s+\w+\s+soundtrack/g, "");
  return /(background music|random music|cinematic music|emotional music|soundtrack|score|dramatic music bed|bg music|dramatic music)/i.test(cleaned);
}

function hasVagueSlowSceneLanguage(value) {
  const withoutAllowedNegations = normalizeWhitespace(value)
    .replace(/no passive standing/gi, "")
    .replace(/no silent staring/gi, "")
    .replace(/no slow establishing shot/gi, "")
    .replace(/no mood-setting/gi, "");
  return /(beautiful scene|calm mood|calm scene|peaceful mood|slow establishing shot|slowly establishes|characters are standing|they look around|mood-setting|passive standing|silent staring)/i.test(withoutAllowedNegations);
}

function hasActionVerb(value) {
  return /(slam|grab|point|storm|freeze|drop|burst|reveal|open|reach|back away|turn|run|cry|gasp|hide|pull|throw|pack|ring|buzz|shake|clench|step|walk|push|whip-pan|snap zoom)/i.test(value);
}

function extractPromptDialogueLines(value) {
  const rows = [];
  const text = normalizePromptQuotes(value);
  for (const line of text.split(/\n+/)) {
    const match = line.match(/^\s*([A-Za-z0-9 _-]{2,42})\s*:\s*"([^"]{1,140})"/);
    if (!match) continue;
    const speaker = match[1].trim();
    if (/^(action|emotion|camera|audio|negative|movement|visual clue|ending beat|speech rules)$/i.test(speaker)) continue;
    rows.push({ speaker, line: match[2].trim() });
    if (rows.length >= MAX_PROVIDER_DIALOGUE_LINES) break;
  }
  return rows;
}

function looksNonEnglishDialogue(value) {
  if (/[^\x00-\x7F]/.test(value)) return true;
  // Spanish, Finnish, French, Portuguese, German, Italian common words
  return /\b(hola|quien|dame|telefono|por favor|gracias|ella|usted|porque|miksi|sina|mina|kiitos|anteeksi|bonjour|merci|oui|non|voila|mon|ma|moi|toi|lui|elle|nous|vous|ils|comment|pourquoi|quoi|mais|alors|donc|encore|jamais|toujours|parce|avec|sans|comme|mais|obrigado|ciao|bitte|danke|nein|ja|warum|bitte)\b/i.test(value);
}

function cleanSectionText(value, fallback, max = 180) {
  const cleaned = normalizeWhitespace(value || fallback)
    .replace(/background music|random music|cinematic music|emotional music|soundtrack|score|dramatic music bed|bg music|dramatic music/gi, "")
    // Strip UPPERCASE_UNDERSCORE cast reference IDs (e.g. CHEATER_MANGO_BOSS_MANGO) — they bloat the prompt
    .replace(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+){2,}\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const safe = cleaned || fallback;
  if (safe.length <= max) return safe;
  return safe.slice(0, max).replace(/\s+\S*$/, "").trim();
}

// Strip narrative role + fruit type prefixes from planner compound IDs like
// "cheater_mango_boss_mango" → "bossmango" → "Boss Mango"
const ROLE_PREFIX_RE = /^(victim|cheater|affair_partner|affair|kid|boss|villain|friend|sibling|parent|protagonist|antagonist|supporting)_/i;
const FRUIT_PREFIX_RE = /^(mango|peach|orange|banana|apple|lemon|strawberry|pineapple|ananas|broccoli|brokkoli|coconut|cherry|grape|watermelon)_/i;

function stripCompoundId(value) {
  return String(value ?? "")
    .replace(ROLE_PREFIX_RE, "")
    .replace(FRUIT_PREFIX_RE, "");
}

function sanitizeSpeakerName(value, fallback = "Fruit Character") {
  const stripped = stripCompoundId(value);
  return readableCharacterName(stripped || value || fallback)
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    // Keep speaker names short — long names bloat the prompt and confuse the model
    .slice(0, 16) || "CHARACTER";
}

// Fruit type names in dialogue cause the video model to generate that fruit character
// from scratch instead of using the reference image. Strip them as addresses.
const FRUIT_ADDRESS_RE = /,\s*(mango|peach|orange|banana|apple|lemon|strawberry|pineapple|ananas|broccoli|cherry|melon)\b\.?/gi;

function sanitizeDialogueLine(value, scene, index = 0) {
  const fallback = buildShortViralLine("", scene, index);
  const raw = normalizeWhitespace(normalizePromptQuotes(value)).replace(/^["']|["']$/g, "");
  let line = looksNonEnglishDialogue(raw) ? fallback : raw
    .replace(/[^\x20-\x7E]/g, "")
    // Remove fruit-type addresses ("you fool, pineapple" → "you fool")
    .replace(FRUIT_ADDRESS_RE, "")
    .trim();
  const words = line.split(/\s+/).filter(Boolean);
  // Max 10 words — natural sentence length for clear spoken dialogue
  if (words.length < 2 || words.length > 10) {
    line = (words.length >= 2 ? words.slice(0, 10).join(" ") : fallback);
  }
  if (line.length > MAX_PROVIDER_DIALOGUE_LINE_CHARS) {
    line = line.slice(0, MAX_PROVIDER_DIALOGUE_LINE_CHARS).replace(/\s+\S*$/, "").trim();
  }
  return line || fallback;
}

function getProviderDialogue({ scenePrompt = "", scene = {}, form = {} }) {
  const characters = getSceneCharacterNames(scene, form);
  const parsed = extractPromptDialogueLines(scenePrompt || scene.videoPromptProvider || scene.videoPrompt);
  const base = parsed.length
    ? parsed
    : buildSceneDialogueLines(scene, form).map((row) => ({ speaker: row.speaker, line: row.line }));

  const speakerCount = Math.max(
    1,
    new Set([
      ...characters.map((char) => sanitizeSpeakerName(char.name || char.id)),
      ...base.map((row) => sanitizeSpeakerName(row.speaker)),
    ]).size,
  );
  const maxLines = speakerCount <= 1 ? 1 : MAX_PROVIDER_DIALOGUE_LINES;

  const rawRows = base.slice(0, maxLines).map((row, index) => ({
    speaker: sanitizeSpeakerName(row.speaker || characters[index]?.name || `Fruit ${index + 1}`),
    line: sanitizeDialogueLine(row.line, scene, index),
  }));

  // Block consecutive same-speaker runs (A,A,B → drop duplicate A) but allow
  // alternating A,B,A,B so the dialogue reads as a real back-and-forth exchange.
  const rows = [];
  for (const row of rawRows) {
    if (rows.length === 0 || row.speaker !== rows[rows.length - 1].speaker) {
      rows.push(row);
    }
  }
  const seenSpeakers = new Set(rows.map((r) => r.speaker));

  // If deduplication left only one row but we have 2+ characters, add the second character's line
  if (rows.length === 1 && characters.length >= 2) {
    const secondName = sanitizeSpeakerName(characters.find(
      (c) => sanitizeSpeakerName(c.name || c.id) !== rows[0].speaker
    )?.name || characters[1]?.name || "Fruit 2");
    if (!seenSpeakers.has(secondName)) {
      rows.push({
        speaker: secondName,
        line: sanitizeDialogueLine("", scene, 1),
      });
    }
  }

  if (rows.length) return rows;
  return [{
    speaker: sanitizeSpeakerName(characters[0]?.name || "Fruit Character"),
    line: sanitizeDialogueLine("", scene, 0),
  }];
}

function formatDialogueBlock(dialogue) {
  return dialogue.map((row) => `${row.speaker.toUpperCase()}: "${row.line}"`).join("\n");
}

function ensureImmediateAction(value, scene, max = 190) {
  const visualClue = deriveVisualClue(scene);
  // Use in-place reactions only — no "storms forward" or directional movement
  // that causes the model to create a new scene instead of animating the reference
  const fallback = `Character reacts with shock, eyes wide, pointing at ${visualClue} in disbelief. Stays in place.`;
  const action = cleanSectionText(value, fallback, max);
  // Strip directional movement verbs that cause scene changes
  const safe = action
    .replace(/\bstorms?\s+(forward|in|out|away)\b/gi, "reacts")
    .replace(/\bwalks?\s+(away|out|off)\b/gi, "steps back")
    .replace(/\bruns?\b/gi, "reacts")
    .replace(/\bslams?\s+door\b/gi, "reacts to the door");
  if (hasActionVerb(safe) && !hasVagueSlowSceneLanguage(safe)) return cleanSectionText(safe, fallback, max);
  return cleanSectionText(fallback, fallback, max);
}

function pickSoundEffect(scene, visualClue, action) {
  const text = `${scene?.title ?? ""} ${scene?.beatType ?? ""} ${scene?.storyPurpose ?? ""} ${scene?.actionDirection ?? ""} ${visualClue ?? ""} ${action ?? ""}`.toLowerCase();
  if (/(phone|text|message|call|dm|screen)/.test(text)) return "phone buzz";
  if (/(door|slam|leave|walk away)/.test(text)) return "phone buzz"; // no door slam — causes scene change
  if (/(baby|kid|crib|basket|cry)/.test(text)) return "soft cry";
  if (/(suitcase|packed|bags)/.test(text)) return "phone buzz";
  if (/(note|paper|letter|receipt)/.test(text)) return "paper rustle";
  if (/(rain|street)/.test(text)) return "rain ambience";
  if (/(crowd|public|restaurant|office)/.test(text)) return "room ambience";
  return "room ambience"; // removed "gasp" — causes the model to add gasp sounds
}

function deriveAmbience(scene) {
  const text = `${scene?.backgroundDetail ?? ""} ${scene?.environment ?? ""}`.toLowerCase();
  if (/(kitchen|dining)/.test(text)) return "Light kitchen ambience only.";
  if (/(street|rain|outside)/.test(text)) return "Light street ambience only.";
  if (/(office|work)/.test(text)) return "Light office ambience only.";
  if (/(restaurant|cafe)/.test(text)) return "Light restaurant ambience only.";
  return "Light room ambience only.";
}

// One compact line per visible character — fruit type, gender/age presentation,
// personality, story role, and emotional arc — so the video model actually knows
// WHO it's animating, not just what they're saying. Mirrors the "Main Characters"
// block from the manual ChatGPT workflow this pipeline is modeled on.
function formatCharacterProfileLine(char, max) {
  const p = char?.profile;
  if (!p) return null;
  const name = sanitizeSpeakerName(char.name || char.id);
  const idBits = [p.fruitType && `${p.fruitType} fruit character`, p.genderPresentation, p.agePresentation]
    .filter(Boolean)
    .join(", ");
  const roleLabel = p.narrativeRole ? p.narrativeRole.replace(/_/g, " ") : "";
  const line = [
    idBits ? `${name} (${idBits})` : name,
    p.personality ? `Personality: ${p.personality}.` : "",
    roleLabel ? `Role: ${roleLabel}.` : "",
    p.emotionalArc ? `Arc: ${p.emotionalArc}.` : "",
  ].filter(Boolean).join(" ");
  return line ? cleanSectionText(line, name, max) : null;
}

function buildCharacterProfileBlock(characters, max) {
  const lines = characters.slice(0, 2)
    .map((char) => formatCharacterProfileLine(char, max))
    .filter(Boolean);
  return lines.length ? lines.join("\n") : null;
}

function buildPerCharacterEmotionBlock(characters, scene, max) {
  const emotionBase = (scene?.emotionDirection || scene?.emotionalBeat || "").toLowerCase();
  if (!characters.length) {
    return cleanSectionText(
      scene?.emotion || scene?.emotionDirection || scene?.emotionalBeat,
      "glossy eyes, clenched jaw, trembling fingers, and a shocked freeze",
      max,
    );
  }
  const lines = characters.slice(0, 3).map((char, idx) => {
    const name = sanitizeSpeakerName(char.name || char.id);
    const roleText = `${char.role || char.id || ""}`.toLowerCase();
    if (idx === 0) {
      if (/(wife|mom|betrayed|hurt|heartbroken|victim)/.test(roleText) || emotionBase.includes("betray") || emotionBase.includes("heartbreak")) {
        return `${name}: betrayed and furious — jaw tight, eyes locked, hands shaking`;
      }
      if (/(husband|cheater|guilty|caught)/.test(roleText) || emotionBase.includes("guilt")) {
        return `${name}: terrified and defensive — frozen still, eyes darting, hands raised`;
      }
      if (emotionBase.includes("shock") || emotionBase.includes("reveal")) {
        return `${name}: in shock — eyes wide, mouth open, stepping back`;
      }
      return `${name}: overwhelmed — ${emotionBase || "intense emotional reaction"}, body frozen`;
    }
    if (idx === 1) {
      if (/(mistress|affair|third|secret)/.test(roleText)) {
        return `${name}: panicked — forced smile, hand reaching to hide evidence`;
      }
      if (/(kid|child|baby|son|daughter)/.test(roleText)) {
        return `${name}: confused — wide innocent eyes, not understanding`;
      }
      return `${name}: stunned — caught completely off guard, stepping back`;
    }
    return `${name}: shocked bystander — staring in disbelief`;
  });
  const result = lines.join(". ");
  return result.length <= max ? result : result.slice(0, max).replace(/\s+\S*$/, "").trim() || lines[0];
}

function buildStrictFruitVideoPrompt({ scenePrompt = "", scene = {}, form = {}, max = null, overrideDialogue = null } = {}) {
  const isProviderPrompt = Boolean(max);
  const sceneNumber = Number(scene?.sceneNumber ?? 1);
  const totalScenes = Number(form?.sceneCount ?? 5);
  const pacingRole = getScenePacingRole(scene, form);

  // When vision-generated dialogue is provided, sanitize + deduplicate it;
  // otherwise fall back to the text-based getProviderDialogue.
  let dialogue;
  if (Array.isArray(overrideDialogue) && overrideDialogue.length > 0) {
    const rows = [];
    for (const row of overrideDialogue) {
      const speaker = sanitizeSpeakerName(String(row.speaker ?? ""));
      const line = String(row.line ?? "").trim();
      if (!speaker || !line) continue;
      if (rows.length === 0 || speaker !== rows[rows.length - 1].speaker) {
        rows.push({ speaker, line });
      }
    }
    dialogue = rows.length > 0 ? rows : getProviderDialogue({ scenePrompt, scene, form });
  } else {
    dialogue = getProviderDialogue({ scenePrompt, scene, form });
  }
  const characters = getSceneCharacterNames(scene, form);
  const visualClue = cleanSectionText(scene.visualClue || deriveVisualClue(scene), "one clear physical clue from the image", isProviderPrompt ? 90 : 110);
  const action = ensureImmediateAction(
    scene.action || scene.videoAction || scene.actionDirection || scene.storyPurpose || scene.scenePurpose || scene.title,
    scene,
    isProviderPrompt ? 145 : 190,
  );
  const emotion = buildPerCharacterEmotionBlock(
    characters,
    scene,
    isProviderPrompt ? 110 : 145,
  );
  const camera = cleanSectionText(
    scene.cameraDirection,
    "Vertical 9:16 tight close-up, fast push-in, whip-pan, snap zoom, reaction close-up.",
    isProviderPrompt ? 110 : 135,
  );
  const endingBeat = cleanSectionText(scene.endingBeat || deriveEndingBeat(scene), "end on a shocked freeze-frame before the next secret drops", isProviderPrompt ? 100 : 125);

  // Per-character voice directions — each character speaks with their own distinct style
  const voiceLines = characters.slice(0, 2)
    .map((char) => `${sanitizeSpeakerName(char.name || char.id)}: ${inferFruitVoiceStyle(char.name || char.id, char.role)}.`)
    .join("\n");

  // Scene-aware movement derived from emotion, action data, and character roles
  const emotionHint = cleanSectionText(scene.emotionDirection || scene.emotionalBeat, "", 55);
  const movementFallback = isProviderPrompt
    ? "Reactive in-place animation: intense facial close-ups, expressive eye movement, lip sync, micro-expressions, small defensive or reaching hand gestures. No character leaves or enters frame."
    : "Expressive in-place animation: lip sync, eye reactions, subtle head turns, micro-expressions, small gestures. Characters stay in location.";
  const charMovements = characters.slice(0, 2).map((char) => {
    const name = sanitizeSpeakerName(char.name || char.id);
    const roleText = `${char.role || char.id || ""}`.toLowerCase();
    if (/(wife|mom|betrayed|victim)/.test(roleText)) return `${name}: turns to face partner directly, jaw clenched, points accusingly, eyes locked on them`;
    if (/(husband|cheater|guilty)/.test(roleText)) return `${name}: turns toward partner, raises hands defensively, eyes darting guiltily`;
    if (/(mistress|third|secret)/.test(roleText)) return `${name}: shrinks back, avoids eye contact, reaches to grab phone or bag`;
    if (/(kid|child|baby)/.test(roleText)) return `${name}: looks between the adults, head tilted, innocent confused gesture`;
    return `${name}: turns to face the other character, reacts with ${emotionHint || "shock"}, direct eye contact`;
  });
  const movementSource = charMovements.length >= 2
    ? charMovements.join(". ") + ". Characters face each other directly throughout — no exits."
    : (emotionHint
      ? `Character reacts with ${emotionHint} — expressive face, clear lip sync, strong eye contact toward the other person. No exits.`
      : null);
  const movement = cleanSectionText(
    movementSource,
    movementFallback,
    isProviderPrompt ? 145 : 190,
  );

  // Style descriptor based on the chosen story style
  const storyStyle = getFruitStoryStyle(form.style || form.visualStyle || form.storyStyle);
  const styleLine = storyStyle?.id === "dark-drama"
    ? "Dark cinematic 3D, intense emotional acting, moody atmospheric lighting, controlled dramatic motion, realistic micro-expressions."
    : storyStyle?.id === "cute_pixar_like"
    ? "Cute stylized 3D, warm expressive acting, bright rounded character forms, smooth cheerful motion, big emotive eyes."
    : storyStyle?.id === "dramatic_comedy"
    ? "Stylized 3D comedy-drama, punchy exaggerated reactions, clean expressive motion, strong comedic timing."
    : "Cinematic stylized 3D, highly detailed, expressive character acting, smooth natural motion, realistic micro-expressions.";

  // The reference image IS the scene — animate it, don't create a new one
  const opening = isProviderPrompt
    ? "IMAGE-TO-VIDEO: Animate the EXACT reference image provided. FIRST FRAME = reference image. Keep the IDENTICAL background, room, furniture, and lighting. Characters may turn to face each other directly and hold eye contact. Add expressive facial reactions, clear lip-sync dialogue, and natural conversational gestures. Do NOT move characters out of frame. Do NOT add new environments or locations."
    : "IMAGE-TO-VIDEO: Animate this exact reference image. First frame must match the reference. Keep the same background, room, and lighting. Characters turn toward each other, hold direct eye contact, and speak with clear natural lip-sync. Do not change the scene or add new locations.";
  const sceneTitleNote = scene.title ? ` — "${scene.title}"` : "";
  const storyArcNote = `Scene ${sceneNumber} of ${totalScenes}`;
  const pacingLine = isProviderPrompt
    ? `${storyArcNote}${sceneTitleNote}: ${pacingRole}. Dramatic emotional moment. Characters react and speak — no location change.`
    : `${storyArcNote}${sceneTitleNote}: ${pacingRole}. Emotional dramatic reaction. Characters stay in the same location as the reference image.`;
  // Build per-speaker mouth-control rule from the actual dialogue speakers.
  // Put "ENGLISH WORDS ONLY" first so it survives the 1450-char budget trim.
  const dialogueSpeakers = [...new Set(dialogue.map((r) => r.speaker.toUpperCase()))].slice(0, 2);
  const speechRules = dialogueSpeakers.length >= 2
    ? `ENGLISH WORDS ONLY. ${dialogueSpeakers[0]} lines: ONLY ${dialogueSpeakers[0]} speaks — ${dialogueSpeakers[1]} mouth COMPLETELY CLOSED. ${dialogueSpeakers[1]} lines: ONLY ${dialogueSpeakers[1]} speaks — ${dialogueSpeakers[0]} mouth COMPLETELY CLOSED. Clear full pronunciation. No mumbling.`
    : "ENGLISH WORDS ONLY. Speaker's mouth moves — silent character mouth COMPLETELY CLOSED. Clear full pronunciation. No mumbling.";
  // Required sections come FIRST so they survive the 1450-char trim.
  const audioLine = `Clear English dialogue only — fully pronounced, audible, and intelligible. No background music. Natural room ambience only. No gasps, no mumbling, no muttering, no gibberish, no unintelligible sounds, no foreign words, no singing.`;
  const identityLock = isProviderPrompt
    ? "CHARACTER LOCK: Use ONLY the characters from the reference image. Same fruit type, same face, same hair, same outfit. No redesigns, no new characters, no location change."
    : "CHARACTER LOCK: Animate ONLY the characters shown in the reference image. Same fruit type, same face, same hair, same outfit, same background. No redesigns, no new characters.";
  const negativeLine = isProviderPrompt
    ? "No captions, no subtitles, no text overlays, no watermarks, no new characters, no identity changes, no location change, no background music, no gasps, no sighs, no mumbling, no muttering, no gibberish, no non-English words, no Spanish, no French, no Arabic, no Mandarin, no random foreign syllables, no improvised speech, no unintelligible sounds, no singing, no characters avoiding eye contact."
    : "No captions, no subtitles, no text overlays, no watermarks, no new characters, no identity changes, no location change, no background music, no gasps, no mumbling, no muttering, no gibberish, no non-English words, no Spanish, no French, no Arabic, no random foreign syllables, no improvised speech, no unintelligible sounds, no singing.";

  const storyContextLine = scene.storyPurpose || scene.scenePurpose
    ? cleanSectionText(scene.storyPurpose || scene.scenePurpose, "", isProviderPrompt ? 80 : 100)
    : null;
  const characterProfileBlock = buildCharacterProfileBlock(characters, isProviderPrompt ? 130 : 170);

  const prompt = [
    opening,
    pacingLine,
    identityLock,
    ...(characterProfileBlock ? ["Cast:", characterProfileBlock] : []),
    ...(storyContextLine ? [`Story beat: ${storyContextLine}`] : []),
    "",
    "SPOKEN DIALOGUE - SAY EXACTLY THESE ENGLISH WORDS ONLY:",
    formatDialogueBlock(dialogue),
    "",
    "Action:",
    action,
    "",
    "Speech rules:",
    speechRules,
    "",
    "Audio:",
    audioLine,
    "",
    // Optional sections below — may be trimmed if prompt is too long
    "Emotion:",
    emotion,
    "",
    "Visual clue:",
    visualClue,
    "",
    "Movement:",
    movement,
    "",
    ...(voiceLines ? ["Voice:", voiceLines, ""] : []),
    "Camera:",
    camera,
    "",
    "Style:",
    styleLine,
    "",
    "Ending beat:",
    endingBeat,
    "",
    "Negative:",
    negativeLine,
  ].join("\n");

  return max ? trimProviderPrompt(prompt, max) : prompt;
}

function trimProviderPrompt(prompt, max) {
  if (prompt.length <= max) return prompt;
  const negative = "\nNegative: No captions, no subtitles, no text overlays, no watermarks, no extra characters, no identity changes, no background music, no mumbling, no gibberish, no non-English words, no Spanish, no French, no Arabic, no random foreign syllables, no improvised speech.";
  const budget = max - negative.length;
  // Slice raw string — do NOT use normalizeWhitespace here because it strips newlines
  // which breaks dialogue parsing in extractPromptDialogueLines (it splits on \n)
  const trimmed = prompt.slice(0, budget).replace(/[\s]+$/, "").replace(/\nNegative:[\s\S]*$/, "");
  return (trimmed + negative).slice(0, max);
}

export function buildRunwareVideoPrompt(scenePrompt, scene = {}, form = {}, max = MAX_RUNWARE_VIDEO_PROMPT_CHARS) {
  return buildStrictFruitVideoPrompt({ scenePrompt, scene, form, max });
}

export function buildSceneVideoPrompt({ scene, form = {} }) {
  return buildStrictFruitVideoPrompt({ scene, form, max: MAX_RUNWARE_VIDEO_PROMPT_CHARS });
}

export function buildSceneVideoPromptWithDialogue({ scene, form = {}, dialogue }) {
  return buildStrictFruitVideoPrompt({ scene, form, max: MAX_RUNWARE_VIDEO_PROMPT_CHARS, overrideDialogue: dialogue ?? null });
}

export async function generateVisionVideoPrompts({ scenes, form }) {
  const { data, error } = await supabase.functions.invoke("fruit-story-video-prompts", {
    body: {
      scenes: scenes.map((s) => ({
        sceneNumber:         s.sceneNumber,
        imageUrl:            s.imageUrl,
        title:               s.title,
        storyPurpose:        s.storyPurpose,
        beatType:            s.beatType,
        emotionDirection:    s.emotionDirection,
        characterIdsInScene: s.characterIdsInScene ?? s.charactersInScene ?? [],
      })),
      form: {
        castBible:   form.castBible ?? [],
        storyPreset: form.storyPreset ?? "",
      },
    },
  });
  if (error) throw new Error(await resolveFunctionErrorMessage(error, "Vision prompt failed"));
  if (!data?.ok) throw new Error(data?.error ?? "Vision prompt failed");
  return data; // { ok, scenes: [{sceneNumber, dialogue, imageObservations}] }
}

export function buildFruitVideoPrompt({ clip, startScene, endScene, form }) {
  if (String(clip?.videoPrompt ?? "").trim()) {
    return String(clip.videoPrompt).trim();
  }

  if (String(startScene?.videoPrompt ?? "").trim()) {
    return String(startScene.videoPrompt).trim();
  }

  return buildSceneVideoPrompt({ scene: startScene, form });
}

const PUBLIC_APP_ORIGIN =
  import.meta.env.VITE_PUBLIC_APP_ORIGIN ||
  import.meta.env.VITE_SITE_URL ||
  "https://tryzyvo.com";

/* ─── Character label helpers ─── */
// Mirrors makeLabel() in fruit-story-planner so labels match exactly.

const CLIENT_ROLE_MAP = {
  orangemom:         "WIFE",
  orangekid:         "KID",
  lemonkid:          "KID",
  strawberrymom:     "MOTHER",
  banana:            "HUSBAND",
  appleson:          "SON",
  hotpeach:          "MISTRESS",
  ananasgirl:        "FRIEND",
  bossmango:         "BOSS",
  brokkoliboss:      "BOSS",
  gangsterpineapple: "VILLAIN",
};

function deriveCharLabel(char) {
  const role = CLIENT_ROLE_MAP[char.id] ??
    (char.role ?? char.id ?? "CHARACTER")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 20);

  const safeName = (char.name ?? char.id ?? "CHAR")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "_")
    .replace(/_+/g, "_");

  return `${role}_${safeName}`;
}

/** snake_case cast ID — matches makeCastId() in the planner. */
function deriveCastId(char) {
  return deriveCharLabel(char).toLowerCase().replace(/_+/g, "_");
}

/* ─── Reference image assembly ─────────────────────────────────────────────
 *
 * Builds the ordered list of reference image URLs for a scene:
 *   slot 0..N-1 = scene characters (by cast ID or label)
 *   slot N      = previous-scene continuity image (if applicable)
 *
 * Returns { refs, charSlots, hasContinuityRef }
 * - refs:            ordered HTTPS URLs sent to Runware
 * - charSlots:       selectedCharacter objects in slot order (for prompt labels)
 * - hasContinuityRef boolean
 * ───────────────────────────────────────────────────────────────────────── */
function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function findCastEntryForCharacter(char, castBible = []) {
  const charId = normalizeText(char.id);
  const charName = normalizeText(char.name);
  const label = deriveCharLabel(char);
  const castId = deriveCastId(char);

  return (castBible ?? []).find((entry) => {
    const sourceId = normalizeText(entry.sourceCharacterId ?? entry.sourceId);
    const displayName = normalizeText(entry.displayName);
    return (
      entry.id === castId ||
      entry.referenceLabel === label ||
      sourceId === charId ||
      (charName && displayName === charName)
    );
  }) ?? null;
}

function getSlotCharacter(slot) {
  return slot?.char ?? slot;
}

function getSlotCastEntry(slot, castBible = []) {
  if (slot?.castEntry) return slot.castEntry;
  return findCastEntryForCharacter(getSlotCharacter(slot), castBible);
}

function getSlotReferenceLabel(slot, castBible = []) {
  return getSlotCastEntry(slot, castBible)?.referenceLabel ?? deriveCharLabel(getSlotCharacter(slot));
}

function toPublicAssetUrl(url) {
  if (!url) return null;

  const raw = String(url).trim();
  if (!raw) return null;

  if (raw.startsWith("https://")) return raw;

  if (raw.startsWith("http://localhost") || raw.startsWith("http://127.0.0.1")) {
    const parsed = new URL(raw);
    return `${PUBLIC_APP_ORIGIN}${parsed.pathname}`;
  }

  if (raw.startsWith("/")) {
    return `${PUBLIC_APP_ORIGIN}${raw}`;
  }

  return raw;
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeSceneCharacterIds(scene) {
  return [
    ...asArray(scene.characterIdsInScene),
    ...asArray(scene.charactersInScene),
    ...asArray(scene.sceneCast),
    ...asArray(scene.cast),
  ]
    .map((value) => {
      if (typeof value === "string") return normalizeText(value);
      return normalizeText(value?.id ?? value?.characterId ?? value?.slug ?? value?.label ?? value?.name);
    })
    .filter(Boolean)
    .filter((value, index, arr) => arr.indexOf(value) === index);
}

function getCastEntries(castBible = []) {
  return Array.isArray(castBible) ? castBible : Object.values(castBible ?? {});
}

function getCastEntryById(castBible = [], id) {
  const wanted = normalizeText(id);
  if (!wanted) return null;
  if (!Array.isArray(castBible) && castBible?.[wanted]) return castBible[wanted];
  return getCastEntries(castBible).find((entry) => normalizeText(entry?.id) === wanted) ?? null;
}

function getSelectedImage(selected) {
  return (
    selected?.publicRefUrl ||
    selected?.generationRefUrl ||
    selected?.referenceUrl ||
    selected?.imageUrl ||
    selected?.image ||
    selected?.src ||
    selected?.previewUrl ||
    selected?.url ||
    selected?.thumbnail ||
    selected?.assetUrl ||
    ""
  );
}

function isAppHostedFruitCharacterAsset(url) {
  return String(url || "").includes("tryzyvo.com/viral-builder/ai-fruit/characters");
}

function isRawImageReferenceUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return false;

  try {
    const parsed = new URL(raw);
    const path = parsed.pathname.toLowerCase();
    return (
      path.includes("/storage/v1/object/public/") ||
      /\.(png|jpe?g|webp)(?:$|\?)/i.test(path)
    );
  } catch {
    return false;
  }
}

function findSelectedBySourceId(selectedCharacters = [], sourceCharacterId) {
  const wanted = normalizeText(sourceCharacterId);
  if (!wanted) return null;
  return selectedCharacters.find((char) =>
    normalizeText(char?.id) === wanted ||
    normalizeText(char?.characterId) === wanted ||
    normalizeText(char?.slug) === wanted
  ) ?? null;
}

function findCastEntryByLabel(castBible = [], wantedId) {
  const wanted = normalizeText(wantedId);
  if (!wanted) return null;
  return getCastEntries(castBible).find((entry) =>
    normalizeText(entry?.referenceLabel) === wanted ||
    normalizeText(entry?.label) === wanted ||
    normalizeText(entry?.name) === wanted ||
    normalizeText(entry?.displayName) === wanted
  ) ?? null;
}

function findSelectedByLabel(selectedCharacters = [], wantedId) {
  const wanted = normalizeText(wantedId);
  if (!wanted) return null;
  return selectedCharacters.find((char) =>
    normalizeText(char?.label) === wanted ||
    normalizeText(char?.name) === wanted ||
    normalizeText(deriveCharLabel(char)) === wanted
  ) ?? null;
}

function findSelectedForCastEntry(selectedCharacters = [], castEntry) {
  const bySourceId = findSelectedBySourceId(
    selectedCharacters,
    castEntry?.sourceCharacterId ?? castEntry?.sourceId,
  );
  if (bySourceId) return bySourceId;

  const wantedNames = [
    castEntry?.name,
    castEntry?.label,
    castEntry?.displayName,
    castEntry?.referenceLabel,
  ].map(normalizeText).filter(Boolean);

  return selectedCharacters.find((selected) => {
    const selectedNames = [
      selected?.name,
      selected?.label,
      deriveCharLabel(selected),
    ].map(normalizeText).filter(Boolean);
    return wantedNames.some((wanted) => selectedNames.includes(wanted));
  }) ?? null;
}

/* ─── shouldUsePreviousSceneRef ──────────────────────────────────────────────
 * Returns true only when the previous scene's image should be included as an
 * environment/lighting continuity reference.  Checks:
 *   1. Planner opted in   (scene.continuityFromPrevious === true)
 *   2. Environment groups match between the two scenes
 * ───────────────────────────────────────────────────────────────────────── */
const ENV_GROUPS = [
  ["bedroom", "room"],
  ["kitchen", "dining"],
  ["office", "workplace", "desk", "work"],
  ["restaurant", "cafe", "diner"],
  ["living-room", "lounge", "living"],
  ["street", "sidewalk", "alley"],
  ["park", "garden"],
  ["hotel", "lobby", "corridor", "hallway"],
  ["hospital", "clinic"],
  ["school", "classroom"],
  ["car", "vehicle", "taxi"],
];

function envMatch(a, b) {
  if (!a || !b) return false;
  const al = a.toLowerCase().trim();
  const bl = b.toLowerCase().trim();
  if (al === bl) return true;
  return ENV_GROUPS.some((g) =>
    g.some((k) => al.includes(k)) && g.some((k) => bl.includes(k)),
  );
}

// Beat types that intentionally use a different location — previous scene image
// would anchor the model to the wrong environment and cause visual cloning.
const DISTINCT_LOCATION_BEATS = new Set([
  "affair_scene", "investigation", "glow_up", "comeback", "walk_away",
  "twin_reveal", "double_spotted", "suspicious_behavior",
]);

function shouldUsePreviousSceneRef(prevScene, currentScene) {
  if (!prevScene || !currentScene) return false;
  if (!currentScene.continuityFromPrevious) return false;
  // Never use previous-scene ref for beats that happen in a different location
  if (DISTINCT_LOCATION_BEATS.has(currentScene.beatType)) return false;
  return envMatch(prevScene.environment, currentScene.environment);
}

const REF_LABELS = ["A", "B", "C", "D", "E"];

function buildCharacterPromptText({ slot, selected, castEntry, label }) {
  const roleDesc = castEntry?.narrativeRole
    ? `the ${castEntry.narrativeRole} in this story`
    : (selected.role ?? "a character in this story");

  const fruitNote = castEntry?.fruitType
    ? `Fruit type: ${castEntry.fruitType}.`
    : "";
  const appearanceNote = castEntry?.appearance
    ? `Appearance: ${castEntry.appearance}.`
    : "";
  const visualIdentityNote = castEntry?.visualIdentity
    ? `Visual identity: ${castEntry.visualIdentity}.`
    : "";
  const clothingNote = castEntry?.clothing
    ? `Clothing: ${castEntry.clothing}.`
    : "";

  return (
    `Reference Image ${slot} = ${label}.\n` +
    `This character is ${roleDesc}.\n` +
    `${fruitNote} ${appearanceNote} ${visualIdentityNote} ${clothingNote}\n`.trim() + "\n" +
    "PRESERVE EXACTLY FROM THIS REFERENCE: fruit type, face, body shape, outfit, accessories, color palette, and overall identity.\n" +
    "This identity is LOCKED for the entire story - never confuse this character with any other.\n" +
    "DO NOT COPY FROM THIS REFERENCE: pose, body position, arm/hand placement, facial expression, camera angle, or background. " +
    "This reference is a neutral identity photo, not this scene's action — the pose, expression, framing and environment for THIS image come entirely from the scene description below, not from this reference."
  );
}

function buildSceneRefSlots({ scene, form, castBible = [], previousSceneImageUrl = null, prevScene = null }) {
  const selectedCharacters = form.selectedCharacters ?? [];
  const wantedIds = normalizeSceneCharacterIds(scene);
  const refSlots = [];
  const seenUrls = new Set();

  const addCharacterSlot = ({ wantedId, castEntry, selected, matchedBy = "cast" }) => {
    // Primary source now: the character's own generated portrait (see
    // generateCharacterPortrait) — one solo reference image per cast member,
    // made BEFORE any scene runs. `selected` (a manually-picked character
    // with its own image) is legacy/optional and only used if present.
    const finalUrl = toPublicAssetUrl(getSelectedImage(selected)) || castEntry?.portraitUrl || null;
    console.log("[AI FRUIT refs] character lookup", {
      sceneNumber: scene.sceneNumber,
      sceneCharacterId: wantedId,
      castEntry,
      sourceCharacterId: castEntry?.sourceCharacterId,
      selectedFound: !!selected,
      portraitUrl: castEntry?.portraitUrl ?? null,
      finalUrl,
    });

    if (!finalUrl || seenUrls.has(finalUrl)) return false;
    if (matchedBy !== "cast") {
      console.warn("[AI FRUIT refs] fallback character ref match used", {
        sceneNumber: scene.sceneNumber,
        wantedId,
        matchedCharacterId: selected.id ?? selected.characterId ?? selected.slug ?? null,
        matchedBy,
      });
    }

    const slot = REF_LABELS[refSlots.length] ?? String(refSlots.length + 1);
    const label = castEntry?.referenceLabel ?? castEntry?.label ?? deriveCharLabel(selected);
    refSlots.push({
      slot,
      type: "character",
      characterId: castEntry?.id ?? wantedId,
      sourceCharacterId: castEntry?.sourceCharacterId ?? castEntry?.sourceId ?? selected.id ?? selected.characterId ?? selected.slug ?? null,
      label,
      url: finalUrl,
      char: selected,
      castEntry: castEntry ?? null,
      promptText: buildCharacterPromptText({ slot, selected, castEntry, label }),
    });
    seenUrls.add(finalUrl);
    return true;
  };

  console.log("[AI FRUIT refs] buildSceneRefSlots", {
    sceneNumber: scene.sceneNumber,
    characterIdsInScene: scene.characterIdsInScene,
    charactersInScene: scene.charactersInScene,
    sceneCast: scene.sceneCast,
    cast: scene.cast,
    normalizedIds: wantedIds,
    castBibleSize: getCastEntries(castBible).length,
    selectedCharCount: selectedCharacters.length,
  });

  for (const id of wantedIds) {
    const castEntry = getCastEntryById(castBible, id);
    const selected = findSelectedForCastEntry(selectedCharacters, castEntry);
    addCharacterSlot({ wantedId: id, castEntry, selected, matchedBy: "cast" });
  }

  if (refSlots.length === 0) {
    for (const id of wantedIds) {
      const castEntry = findCastEntryByLabel(castBible, id);
      const selected = findSelectedForCastEntry(selectedCharacters, castEntry)
        ?? findSelectedByLabel(selectedCharacters, id);
      if (addCharacterSlot({ wantedId: id, castEntry, selected, matchedBy: "label" })) break;
    }
  }

  if (refSlots.length === 0 && wantedIds.length <= 1 && selectedCharacters.length === 1) {
    addCharacterSlot({
      wantedId: wantedIds[0] ?? "single-character-scene",
      castEntry: null,
      selected: selectedCharacters[0],
      matchedBy: "single-character-fallback",
    });
  }

  const characterRefs = refSlots.filter((slot) => slot.type === "character");
  if (!characterRefs.length) {
    // Expected now for a fully AI-invented (synthetic) cast — those
    // characters have no reference image by design. The planner already
    // bakes their full visual description into scene.imagePrompt as text
    // (see the planner's "[AI-GENERATED, no ref image]" instruction), so
    // the scene can still generate — just without an image anchor.
    console.warn("[AI FRUIT] no image-backed character refs for scene — proceeding text-only", {
      sceneNumber: scene.sceneNumber,
      sceneTitle: scene.title,
      characterIdsInScene: scene.characterIdsInScene,
      charactersInScene: scene.charactersInScene,
      selectedCharCount: selectedCharacters.length,
    });
  }

  // Previous-scene-image continuity reference intentionally removed. GPT
  // Image 2's reference handling is edit-style — it anchors to the whole
  // input composition, not just "background/lighting" the way the prompt
  // text asked for. Passing in a scene that already has both characters in
  // a specific dramatic pose was very likely why every subsequent scene in
  // a single-location story kept reproducing that same pose almost
  // verbatim, compounding on top of the character-portrait reference.
  // Environment continuity between scenes now relies entirely on the
  // text-only backgroundDetail/environment fields the planner already
  // writes per scene (see SCENE BEAT CONTEXT in buildMasterImagePrompt),
  // not on handing the model a finished frame to copy from.
  void previousSceneImageUrl;
  void prevScene;

  const referenceImages = refSlots.map((slot) => slot.url);
  console.log("[AI FRUIT refs] FINAL REF SLOTS", {
    sceneNumber: scene.sceneNumber,
    refSlots: refSlots.map((r) => ({
      slot: r.slot,
      type: r.type,
      characterId: r.characterId,
      label: r.label,
      url: r.url,
    })),
    referenceImages,
  });

  return { refSlots, referenceImages };
}
/* ─── Master image prompt builder ────────────────────────────────────────────
 *
 * Assembles the final prompt from structured blocks:
 *   [1] Global Zyvo style declaration
 *   [2] Character reference rules — role-locked, identity-locked per cast entry
 *   [3] Scene cast enforcement — only listed characters may appear
 *   [4] Continuity ref instructions (environment/lighting only, not characters)
 *   [5] Scene description from AI planner
 *   [6] Absolute no-text rule
 *
 * Reference labels (A, B, C…) match slot order in buildSceneRefSlots.
 * ───────────────────────────────────────────────────────────────────────── */
function formatRuleList(title, rules = []) {
  if (!rules.length) return "";
  return `${title}:\n${rules.map((rule) => `- ${rule}`).join("\n")}`;
}

function buildMasterImagePrompt({
  scene,
  refSlots,
  castBible = [],
  styleId = "cinematic",
}) {
  const parts = [];
  const style = getFruitStoryStyle(styleId);
  const charSlots = refSlots.filter((slot) => slot.type === "character");
  const continuitySlots = refSlots.filter((slot) => slot.type === "continuity");
  const hasContinuityRef = continuitySlots.length > 0;

  /* ── 1. Global Zyvo style ── */
  parts.push(
    "CRITICAL CHARACTER REQUIREMENT — READ FIRST:\n" +
    "ALL characters in this image MUST be TALL ADULT anthropomorphic fruit-human characters.\n" +
    "FULL ADULT body proportions — NOT children, NOT babies, NOT toddlers, NOT small figures.\n" +
    "Characters must have: adult height, adult face structure with mature features, adult clothing,\n" +
    "human-like adult arms/legs/hands, and adult emotional expressions.\n" +
    "If the reference image shows a character with adult proportions, replicate those adult proportions exactly.\n" +
    "Do NOT shrink characters into baby or child size. Do NOT give them baby faces or child heads.\n\n" +
    `${style.masterPrompt}\n\n` +
    `SELECTED STYLE: ${style.label}\n` +
    [
      formatRuleList("VISUAL RULES", style.visualRules),
      formatRuleList("TIKTOK STORYTELLING RULES", style.storytellingRules),
      formatRuleList("CHARACTER CONSISTENCY RULES", style.characterConsistencyRules),
      formatRuleList("SCENE COMPOSITION RULES", style.sceneRules),
      formatRuleList("NEGATIVE RULES", style.negativeRules),
    ].filter(Boolean).join("\n\n") + "\n\n" +
    "GLOBAL ROLE LOCK:\n" +
    "- Preserve exact identity of all referenced characters.\n" +
    "- Only include the characters listed for this scene.\n" +
    "- Do not invent extra foreground characters.\n" +
    "- Do not merge identities.\n" +
    "- Do not change one character into another.\n" +
    "- If continuity reference is provided, use it only for environment, camera, lighting, and mood continuity, not for adding previous scene characters.\n\n" +
    "STYLE RULE:\n" +
    "Always use the Zyvo 3D AI fruit story visual style:\n" +
    "- Polished 3D anthropomorphic ADULT fruit characters with expressive adult faces\n" +
    "- Cinematic lighting, dramatic storytelling, and clean composition\n" +
    "- TikTok-optimized vertical framing when requested\n" +
    "- Preserve exact identity of all referenced characters\n" +
    "- Only include the characters listed for this scene\n" +
    "- Do not invent extra characters, merge identities, or change one character into another\n" +
    "- Clean, TikTok-ready framing — scroll-stopping premium quality\n" +
    "- NO realism drift, NO random character redesigns, NO child or baby proportions\n" +
    "- NO text, captions, subtitles, speech bubbles, logos, or watermarks"
  );

  /* ── 2. Character reference rules — identity + role locked ── */
  const castLine = charSlots.map((slot) =>
    `${slot.slot}=${getSlotReferenceLabel(slot, castBible)}`,
  ).join(", ");
  const referencePromptText = refSlots
    .map((slot) => slot.promptText)
    .filter(Boolean)
    .join("\n\n");

  if (referencePromptText) {
    parts.push(
      "REFERENCE RULES:\n" +
      referencePromptText + "\n\n" +
      `SCENE CAST - ONLY these characters may visually appear: ${castLine}.\n` +
      "Any character NOT in the scene cast above must be completely absent from this image.\n" +
      "Do NOT add random background characters or extras.\n\n" +
      "⚠ CRITICAL — REFERENCE IMAGES ARE FOR IDENTITY ONLY: the character reference images are neutral identity photos, " +
      "each one from a DIFFERENT, unrelated moment. Do NOT reproduce their pose, framing, camera angle, or background in this image. " +
      "Every scene in this story must look visually DISTINCT from every other scene — different pose, different body position, " +
      "different camera angle, different framing — driven entirely by THIS scene's specific action and camera direction below, " +
      "never by what the reference image happens to show."
    );
  }

  const allowedLabels = charSlots.map((slot) => getSlotReferenceLabel(slot, castBible));
  const sceneIds = new Set(normalizeSceneCharacterIds(scene));
  const forbiddenLabels = getCastEntries(castBible)
    .filter((c) => c?.id && !sceneIds.has(c.id))
    .map((c) => c.referenceLabel)
    .filter(Boolean);

  if (allowedLabels.length > 0) {
    parts.push(
      "STRICT SCENE RULES:\n" +
      `- Show ONLY these characters: ${allowedLabels.join(", ")}.\n` +
      `- Do NOT show: ${forbiddenLabels.length ? forbiddenLabels.join(", ") : "any other recurring character"}.\n` +
      "- No extra background main characters not in the scene cast.\n" +
      "- Do not merge identities or change one character into another.\n" +
      "- Keep each recurring character's FACE, FRUIT TYPE, and OUTFIT identical to their reference image — but their pose, " +
      "expression, and body position in THIS image must match THIS scene's action, not the reference image's pose."
    );
  }

  /* ── 5. Scene beat metadata from planner ── */
  // Use the structured scene fields from Fruit Movie Maker AI output to enrich
  // the prompt with specific story beat context — emotion, action, framing, background.
  const beatMeta = [];
  if (scene.beatType)         beatMeta.push(`Beat type: ${scene.beatType.toUpperCase()}`);
  if (scene.storyPurpose || scene.scenePurpose) beatMeta.push(`Story purpose: ${scene.storyPurpose ?? scene.scenePurpose}`);
  if (scene.emotionDirection) beatMeta.push(`Required emotion: ${scene.emotionDirection}`);
  if (scene.actionDirection)  beatMeta.push(`Required action: ${scene.actionDirection}`);
  if (scene.cameraDirection)  beatMeta.push(`Camera/framing: ${scene.cameraDirection}`);
  if (scene.backgroundDetail) beatMeta.push(`Background: ${scene.backgroundDetail}`);

  if (beatMeta.length > 0) {
    parts.push("SCENE BEAT CONTEXT:\n" + beatMeta.join("\n"));
  }

  /* ── 6. Scene image prompt from planner ── */
  if (scene.imagePrompt) {
    parts.push("SCENE DESCRIPTION:\n" + scene.imagePrompt);
  }

  /* ── 7. Adult character + continuity final enforcement ── */
  parts.push(
    "FINAL ENFORCEMENT:\n" +
    "- Characters MUST be TALL ADULT fruit-human characters — full adult height and adult body proportions.\n" +
    "- No child-sized characters, no baby proportions, no toddler features.\n" +
    "- Character CLOTHING and FRUIT TYPE must stay identical to their reference images — this is locked.\n" +
    "- Character POSE, EXPRESSION, and BODY LANGUAGE must match THIS scene's Required emotion and Required action — NOT the reference image's default pose.\n" +
    "- The BACKGROUND and ENVIRONMENT must reflect the scene's story beat and location (see SCENE BEAT CONTEXT above) — each scene should look visually DISTINCT.\n" +
    "- Characters positioned in this scene must face and interact with each other naturally.\n" +
    "- Reference images are for APPEARANCE ONLY (face, outfit, fruit type, body shape). Do not copy their pose or background."
  );

  /* ── 8. Absolute no-text rule ── */
  parts.push(
    "ABSOLUTE RULE — NO TEXT OF ANY KIND:\n" +
    "NO text, NO captions, NO subtitles, NO speech bubbles, NO dialogue boxes,\n" +
    "NO signs with readable words, NO watermarks, NO logos, NO UI overlays,\n" +
    "NO title cards, NO typography, NO letters or numbers anywhere in this image."
  );

  return parts.join("\n\n");
}

/* ─── generateFruitStoryIdeas ───
   Step 1 of the real creator workflow — 15 one-line viral idea options,
   generated fresh each call. Purely ideation, no story/character/scene
   generation happens here; the user picks one (or edits it) before
   continuing to planFruitStory. ── */
export async function generateFruitStoryIdeas() {
  const { data, error } = await supabase.functions.invoke("fruit-story-ideas", {
    body: {},
  });

  if (error) throw new Error(await resolveFunctionErrorMessage(error, "Idea generation failed"));
  if (!data?.ok) throw new Error(data?.error || "Idea generation failed");

  return data.ideas; // string[]
}

/* ─── planFruitStory ─── */
export async function planFruitStory(payload) {
  const { data, error } = await supabase.functions.invoke("fruit-story-planner", {
    body: payload,
  });

  if (error) throw new Error(await resolveFunctionErrorMessage(error, "Story planning failed"));
  if (!data?.ok) throw new Error(data?.error || "Story planning failed");

  return data; // { title, hook, storySummary, storyDNA, cast[], scenes[] }
}

/* ─── Character portraits ───────────────────────────────────────────────
   Mirrors the manual creator workflow: before any scene image is generated,
   each cast member gets ONE solo reference portrait built from their locked
   visual identity (fruit type, appearance, clothing, etc — all already
   returned by the planner). Every scene image is then generated WITH that
   character's portrait as an image reference, instead of relying on text
   description alone. ──────────────────────────────────────────────────── */
function buildCharacterPortraitPrompt(member) {
  const name = member.displayName || member.name || "the character";
  const fruit = member.fruitType || "fruit";
  const genderNoun =
    member.genderPresentation === "feminine-presenting" ? "woman"
    : member.genderPresentation === "masculine-presenting" ? "man"
    : "person";

  // Deliberately NEUTRAL pose/expression — this portrait becomes the image
  // reference for every scene the character appears in. A dramatic pose or
  // emotion baked in here (e.g. "arms crossed, pointing accusingly") gets
  // copied into every scene by the image model regardless of that scene's
  // actual action, which is what caused different scenes to render as
  // near-duplicates of each other. Identity (face/fruit/outfit) must be
  // locked; pose/expression must come from each scene's own direction.
  return sanitizeImagePromptForGPT([
    `Place ${name} alone against a simple plain neutral studio background, centered, nothing else in frame.`,
    `${name} is an anthropomorphic fruit-human ${genderNoun} with a realistic ${fruit} as their head, glossy detailed fruit skin, while the rest of the body has natural adult human proportions.`,
    member.visualIdentity ? `Locked visual identity: ${member.visualIdentity}.` : "",
    member.appearance ? `Appearance: ${member.appearance}.` : "",
    member.clothing ? `Wearing: ${member.clothing}. This exact outfit, these exact colors and proportions must stay identical in every future scene.` : "",
    "Neutral relaxed standing pose, arms loosely at sides, calm neutral facial expression — this is an identity reference photo, not a dramatic story moment.",
    "Frame as a three-quarter mid-shot at eye level, soft even studio lighting, shallow depth of field.",
    "Feature-film-quality stylized 3D animation, hyper-detailed materials, realistic fabric, expressive facial rigging, polished cinematic rendering, fruit head only with a fully human-shaped body.",
    "No text, no letters, no captions, no watermark, no logo, no other characters in frame.",
  ].filter(Boolean).join(" "));
}

export async function generateCharacterPortrait({ member, form }) {
  const imageToolKey = form.sceneImageModel ?? "zyvo-v2";
  const toolKey = FRUIT_IMAGE_MODEL_TO_TOOLKEY[imageToolKey] ?? "image:fruit-v2";
  const aspect  = form.sceneAspect ?? "9:16";
  const dimMap  = FRUIT_MODEL_DIMS[imageToolKey] ?? FRUIT_MODEL_DIMS["zyvo-v2"];
  const dims    = dimMap[aspect] ?? dimMap["9:16"];
  const creditsPerImage = getFruitImageCreditsPerImage(imageToolKey, []);
  const isFruitImageModel = toolKey === "image:fruit-v2";

  const job = await createImageJobSimple({
    subject:      buildCharacterPortraitPrompt(member),
    toolKey,
    size:         dims.size,
    width:        dims.width,
    height:       dims.height,
    project_id:   form.project_id ?? null,
    refImages:    [],
    expectedRefSlotCount: 0,
    chargeCreditsOverride: creditsPerImage,
    providerHint: {
      engine:   "runware",
      mode:     "t2i",
      edgeFn:   "/functions/v1/runware-image",
      airTag:   "openai:gpt-image@2",
      settings: isFruitImageModel
        ? { quality: "low", fruitModel: imageToolKey, skipResponse: true, deliveryMethod: "async", outputQuality: 85 }
        : {},
    },
  });

  return job;
}

/* ─── generateSceneImage ─── */
export async function generateSceneImage({
  scene,
  form,
  imageToolKey,
  previousSceneImageUrl = null,
  prevScene             = null,   // the previous scene object (for continuity env check)
  castBible             = [],
  generationRunId       = null,
}) {
  const toolKey  = FRUIT_IMAGE_MODEL_TO_TOOLKEY[imageToolKey] ?? "image:fruit-v2";
  const aspect   = form.sceneAspect ?? "9:16";
  const dimMap   = FRUIT_MODEL_DIMS[imageToolKey] ?? FRUIT_MODEL_DIMS["zyvo-v2"];
  const dims     = dimMap[aspect] ?? dimMap["9:16"];
  const creditsPerImage = getFruitImageCreditsPerImage(imageToolKey, form.selectedCharacters);
  const quality = "low";

  const { refSlots, referenceImages } = buildSceneRefSlots({
    scene,
    form,
    castBible,
    previousSceneImageUrl,
    prevScene,
  });

  const masterPrompt = buildMasterImagePrompt({
    scene,
    refSlots,
    castBible,
    styleId: form.style ?? form.styleId ?? "cinematic",
  });

  const characterRefSlots = refSlots.filter((slot) => slot.type === "character");
  if (characterRefSlots.length === 0) {
    // Expected for a fully AI-invented (synthetic) cast — see the matching
    // note in buildSceneRefSlots. masterPrompt already carries the full
    // text description of each synthetic character from scene.imagePrompt.
    console.warn("[AI FRUIT] generating scene text-only (no image-backed character refs)", {
      sceneNumber: scene.sceneNumber,
      sceneTitle: scene.title,
      characterIdsInScene: scene.characterIdsInScene,
      charactersInScene: scene.charactersInScene,
    });
  }

  const promptMentions = {
    A: masterPrompt.includes("Reference Image A"),
    B: masterPrompt.includes("Reference Image B"),
    C: masterPrompt.includes("Reference Image C"),
  };
  console.log("[AI FRUIT] FINAL REF CHECK", {
    sceneNumber: scene.sceneNumber,
    refSlots: refSlots.map((r) => ({
      slot: r.slot,
      type: r.type,
      label: r.label,
      characterId: r.characterId,
      url: r.url,
    })),
    referenceImages,
    promptMentions,
  });

  const promptRefCount = REF_LABELS.filter((letter) =>
    masterPrompt.includes(`Reference Image ${letter}`),
  ).length;

  if (promptRefCount !== referenceImages.length) {
    console.error("[AI FRUIT] REF COUNT MISMATCH", {
      promptRefCount,
      payloadRefCount: referenceImages.length,
      refSlots,
      referenceImages,
    });
    throw new Error("Reference prompt/payload mismatch");
  }

  if (referenceImages.some((url) => url.includes("localhost") || url.includes("127.0.0.1"))) {
    console.error("[AI FRUIT refs] BLOCKED localhost ref", referenceImages);
    throw new Error("AI Fruit reference images must be public URLs, not localhost.");
  }

  const appHostedCharacterRefs = characterRefSlots.filter((slot) =>
    isAppHostedFruitCharacterAsset(slot.url),
  );
  if (appHostedCharacterRefs.length) {
    console.error("[AI FRUIT refs] BLOCKED app asset character ref", {
      sceneNumber: scene.sceneNumber,
      refs: appHostedCharacterRefs,
    });
    throw new Error("AI Fruit character references must use Supabase publicRefUrl, not app asset URL.");
  }

  const invalidCharacterRefs = characterRefSlots.filter((slot) => !isRawImageReferenceUrl(slot.url));
  if (invalidCharacterRefs.length) {
    console.error("[AI FRUIT refs] BLOCKED invalid character ref URL", {
      sceneNumber: scene.sceneNumber,
      refs: invalidCharacterRefs,
    });
    throw new Error("AI Fruit character references must use direct raw image URLs.");
  }

  const isFruitImageModel = toolKey === "image:fruit-v2";
  const providerHintSettings = isFruitImageModel
    ? {
        quality,
        fruitModel: imageToolKey,
        skipResponse: true,
        deliveryMethod: "async",
        outputQuality: 85,
      }
    : {};

  console.log("[fruit generateSceneImage] refs going into createImageJobSimple", {
    sceneNumber:          scene.sceneNumber,
    characterIdsInScene:  scene.characterIdsInScene,
    model:                imageToolKey,
    creditsPerImage,
    refCount:             referenceImages.length,
    refUrls:              referenceImages.map((u) => u.slice(0, 80)),
  });

  console.log("[AI FRUIT] create scene image job", {
    runId: generationRunId,
    sceneNumber: scene.sceneNumber,
    title: scene.title,
    model: imageToolKey,
    creditsPerImage,
    refCount: referenceImages.length,
  });

  // Sanitize for GPT Image 2 safety filter before sending
  const safePrompt = sanitizeImagePromptForGPT(masterPrompt);

  const job = await createImageJobSimple({
    subject:      safePrompt,
    toolKey,
    size:         dims.size,
    width:        dims.width,
    height:       dims.height,
    project_id:   form.project_id ?? null,
    refImages:    referenceImages,
    expectedRefSlotCount: refSlots.length,
    chargeCreditsOverride: creditsPerImage,
    providerHint: {
      engine:   "runware",
      mode:     "t2i",
      edgeFn:   "/functions/v1/runware-image",
      airTag:   "openai:gpt-image@2",
      settings: providerHintSettings,
    },
  });

  return job;
}

export async function regenerateSceneImage({
  scene,
  form,
  imageToolKey,
  customPrompt,
  previousSceneImageUrl = null,
  prevScene = null,
  castBible = [],
}) {
  return generateSceneImage({
    scene: {
      ...scene,
      imagePrompt: customPrompt ?? scene.imagePrompt ?? "",
    },
    form,
    imageToolKey,
    previousSceneImageUrl,
    prevScene,
    castBible,
  });
}

// GPT Image 2 safety filter — replaces words that trigger safety_violations=[sexual].
// "Hot Peach" + affair/drama context is the main trigger. Remove ALL sexual-adjacent words.
function sanitizeImagePromptForGPT(prompt) {
  return prompt
    // Character names with sexual connotation
    .replace(/\bhot\s+peach\b/gi,          "peach character")
    .replace(/\bhotpeach\b/gi,             "peach character")
    .replace(/\bhot\b(?=\s+\w*character)/gi, "")

    // Story / relationship words that trigger filters
    .replace(/\bcheating\b/gi,             "hiding a secret")
    .replace(/\bcheated?\b/gi,             "made a discovery")
    .replace(/\bcheater\b/gi,              "character")
    .replace(/\bcheats?\b/gi,              "hides something")
    .replace(/\baffair\b/gi,               "secret")
    .replace(/\baffair[_\s]partner\b/gi,   "character")
    .replace(/\bmistress\b/gi,             "character")
    .replace(/\binfidelity\b/gi,           "secret")
    .replace(/\blover\b/gi,                "character")
    .replace(/\bbetrayal\b/gi,             "revelation")
    .replace(/\bbetrayed\b/gi,             "shocked")
    .replace(/\bbetrays?\b/gi,             "reveals")

    // Body / appearance words that can trigger sexual filter
    .replace(/\bseductive\b/gi,            "stylish")
    .replace(/\bseductively\b/gi,          "confidently")
    .replace(/\bsensual\b/gi,              "elegant")
    .replace(/\bsensually\b/gi,            "gracefully")
    .replace(/\bflirtatious\b/gi,          "confident")
    .replace(/\bflirting\b/gi,             "smiling")
    .replace(/\bintimate\b/gi,             "close")
    .replace(/\bintimately\b/gi,           "closely")
    .replace(/\btight\s+dress\b/gi,        "elegant dress")
    .replace(/\bform[- ]fitting\b/gi,      "elegant")
    .replace(/\bskin[- ]tight\b/gi,        "fitted")
    .replace(/\bcleavage\b/gi,             "outfit")
    .replace(/\bbody\b/gi,                 "figure")
    .replace(/\bcurves?\b/gi,              "silhouette")

    // Action words near romantic/physical context
    .replace(/\bkissing\b/gi,              "standing close together")
    .replace(/\bembracing\b/gi,            "standing together")
    .replace(/\bcuddle\b/gi,               "sit close together")
    .replace(/\blipstick\s*mark\b/gi,      "mysterious mark")
    .replace(/\blipstick\b/gi,             "makeup")

    // Emotion/drama words that in combination can trigger flags
    .replace(/\bpassionate(ly)?\b/gi,      "emotional")
    .replace(/\bdesire\b/gi,               "longing")
    .replace(/\blust\b/gi,                 "emotion")
    .replace(/\btempt(ing|ation)?\b/gi,    "persuade")
    .replace(/\bseduce[sd]?\b/gi,          "convince")

    // Baby story: prevent "baby fruit character" from generating an infant
    // Keep "pregnancy test" and "two lines" intact (they are safe and specific)
    .replace(/\bbaby\s+fruit\s+character\b/gi, "tiny item")
    .replace(/\binfant\s+character\b/gi,        "tiny prop")
    .replace(/\btiny\s+baby\s+fruit\b/gi,       "small item")

    // Clean up any double spaces
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Veo 3.1 has strict content policy — replaces words that trigger invalidProviderContent.
// Keeps the story structure intact while removing the specific words Veo rejects.
function sanitizePromptForVeo(prompt) {
  return prompt
    .replace(/\bcheating\b/gi,      "hiding a secret")
    .replace(/\bcheated?\b/gi,      "discovered the truth")
    .replace(/\bcheater\b/gi,       "character")
    .replace(/\bcheats?\b/gi,       "reveals")
    .replace(/\baffair\b/gi,        "secret")
    .replace(/\bbetrayal\b/gi,      "revelation")
    .replace(/\bbetrayed\b/gi,      "shocked")
    .replace(/\bbetrays?\b/gi,      "reveals")
    .replace(/\bmistress\b/gi,      "mystery person")
    .replace(/\baffair.partner\b/gi,"character")
    .replace(/\bhot peach\b/gi,     "character")
    .replace(/\bhotpeach\b/gi,      "character")
    .replace(/\binfidelity\b/gi,    "secret")
    .replace(/\bconfront(ation)?\b/gi, "reveal")
    .replace(/\brage\b/gi,          "shock")
    .replace(/\bfurious\b/gi,       "stunned")
    .replace(/\bfury\b/gi,          "disbelief");
}

export async function animateClip({ clip, startScene, endScene, form, videoModel }) {
  const initImageUrls = [clip?.startImageUrl || startScene?.imageUrl].filter(Boolean);

  if (!clip?.startImageUrl || initImageUrls.length === 0) {
    throw new Error(`Clip ${clip?.clipNumber ?? ""} is missing a scene image`);
  }

  const model       = FRUIT_VIDEO_MODELS[videoModel] ?? FRUIT_VIDEO_MODELS[DEFAULT_FRUIT_VIDEO_MODEL];
  const toolKey     = model.toolKey;
  const isVeo       = toolKey === "video:fruitveo31lite";
  const withSound   = model.withSound;
  const aspect      = form.sceneAspect ?? "9:16";
  const dims        = model.dims[aspect] ?? model.dims["9:16"];
  const durationSec = model.duration;
  const fullPrompt  = buildFruitVideoPrompt({ clip, startScene, endScene, form });
  const rawPrompt   = buildRunwareVideoPrompt(fullPrompt, startScene, form);
  const prompt      = isVeo ? sanitizePromptForVeo(rawPrompt) : rawPrompt;

  console.log("[AI FRUIT] create animation clip job", {
    clipNumber: clip.clipNumber,
    startSceneNumber: clip.startSceneNumber,
    toolKey,
    withSound,
    durationSec,
    referenceImages: initImageUrls,
  });

  return createVideoJobSimple({
    subject:           prompt,
    toolKey,
    width:             dims.width,
    height:            dims.height,
    durationSec,
    initImageUrls,
    calculatedCredits: model.credits,
    project_id:        form.project_id ?? null,
    withSound,
  });
}

/* ════════════════════════════════════════════════════════════════════
   GENERATION PERSISTENCE — fruit_story_generations table
   Users can save, restore, and continue their AI Fruit Story sessions.
   Column note: "cast" is a reserved SQL word, stored as "cast_data".
════════════════════════════════════════════════════════════════════ */

const SCENE_COUNT_TO_LENGTH = { 3: "15s", 5: "30s", 7: "45s", 10: "60s" };

/** Map scene count back to a storyLength id for form restoration. */
export function sceneCountToLength(count) {
  return SCENE_COUNT_TO_LENGTH[count] ?? "30s";
}

export async function createFruitStoryGeneration({
  title, storyAngle, storyIdea, sceneCount, sceneAspect,
  imageModel, animationModel, castData, plannerOutput, scenes,
}) {
  const { data: userData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !userData?.user) throw new Error("Must be signed in");

  const { data, error } = await supabase
    .from("fruit_story_generations")
    .insert({
      user_id:         userData.user.id,
      title:           title ?? null,
      story_angle:     storyAngle ?? null,
      story_idea:      storyIdea ?? null,
      scene_count:     sceneCount ?? 5,
      scene_aspect:    sceneAspect ?? "9:16",
      image_model:     imageModel ?? "zyvo-v2",
      animation_model: animationModel ?? null,
      status:          "generating_images",
      cast_data:       castData ?? [],
      planner_output:  plannerOutput ?? {},
      scenes:          scenes ?? [],
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id;
}

export async function updateFruitStoryGeneration(id, patch) {
  if (!id) return;
  const { error } = await supabase
    .from("fruit_story_generations")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) console.error("[fruitStoryApi] update generation failed:", error.message);
}

export async function updateGenerationScenes(id, scenes, status) {
  if (!id) return;
  const patch = { scenes, updated_at: new Date().toISOString() };
  if (status) patch.status = status;
  const { error } = await supabase
    .from("fruit_story_generations")
    .update(patch)
    .eq("id", id);

  if (error) console.error("[fruitStoryApi] updateGenerationScenes failed:", error.message);
}

export async function listFruitStoryGenerations(limit = 20) {
  const { data, error } = await supabase
    .from("fruit_story_generations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getFruitStoryGeneration(id) {
  const { data, error } = await supabase
    .from("fruit_story_generations")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteFruitStoryGeneration(id) {
  const { error } = await supabase
    .from("fruit_story_generations")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
}
