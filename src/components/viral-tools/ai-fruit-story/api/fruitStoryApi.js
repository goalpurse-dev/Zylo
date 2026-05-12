import { supabase } from "../../../../lib/supabaseClient";
import { createImageJobSimple, createVideoJobSimple } from "../../../../lib/jobs";
import { getProviderLink } from "../../../../lib/providers";
import { getFruitStoryStyle } from "../config/fruitStoryStyles";

/* ─── Model key mappings ─── */
export const FRUIT_IMAGE_MODEL_TO_TOOLKEY = {
  "zyvo-v2": "image:fruit-v2",  // GPT Image 2    — 2 credits/image
  "zyvo-v3": "image:fruit-v3",  // GPT Image 2 medium
};

export const FRUIT_VIDEO_MODEL_TO_TOOLKEY = {
  "zyvo-video-v2": "video:wan26flash",
  "zyvo-video-v3": "video:veo31fast",
};

const VIDEO_WITH_SOUND = {
  "zyvo-video-v2": true,
  "zyvo-video-v3": true,
};

export const MAX_FRUIT_VOICEOVER_CHARS = 95;

// Credits per 6-second animated clip by model
// WAN 2.6 Flash: $0.4556/clip × 2 markup / $0.02 per credit = 46
// Veo 3.1 Fast:  $0.90/clip  × 2 markup / $0.02 per credit = 90
export const FRUIT_VIDEO_CREDITS_PER_CLIP = {
  "zyvo-video-v2": 46,
  "zyvo-video-v3": 90,
};
export const MAX_FRUIT_VOICEOVER_LINE_CHARS = 45;
export const MIN_FRUIT_VIDEO_PROMPT_CHARS = 80;
const MAX_RUNWARE_VIDEO_PROMPT_CHARS = 1450;
const MAX_PROVIDER_DIALOGUE_LINES = 3;
const MAX_PROVIDER_DIALOGUE_LINE_CHARS = 45;

// Only check the sections that are truly essential for video generation.
// Sections like "Ending beat:", "Camera:", "Visual clue:" are nice-to-have but
// can be trimmed away by the 1450-char limit — don't block generation over them.
const REQUIRED_VIDEO_PROMPT_SECTIONS = [
  "SPOKEN DIALOGUE",
  "SAY EXACTLY",
  "Speech rules:",
  "Dialogue starts in the first second",
  "Speak English only",
  "Action:",
  "Audio:",
  "No background music",
  "Negative:",
];

export function isFruitVideoPromptReady(value) {
  const text = String(value ?? "").trim();
  if (text.length < MIN_FRUIT_VIDEO_PROMPT_CHARS) return false;
  if (!REQUIRED_VIDEO_PROMPT_SECTIONS.every((section) => text.includes(section))) return false;
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
  "zyvo-v3": {
    "9:16": { width: 1088, height: 1920, size: "1088x1920" },
    "16:9": { width: 1920, height: 1088, size: "1920x1088" },
    "1:1":  { width: 1088, height: 1088, size: "1088x1088" },
  },
};

export function getFruitV2CreditsPerImage(selectedCharacters) {
  const count = Array.isArray(selectedCharacters) ? selectedCharacters.length : 0;
  return count >= 3 ? 3 : 2;
}

export function getFruitImageCreditsPerImage(modelId, selectedCharacters) {
  if (modelId === "zyvo-v2") return getFruitV2CreditsPerImage(selectedCharacters);
  if (modelId === "zyvo-v3") return 8;
  return 2;
}

const ASPECT_VIDEO_DIMS = {
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
  "1:1":  { width: 1080, height: 1080 },
};

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
    ["Who gave you permission for this?",    "You were never supposed to see that."],
    ["Empty your pockets. Right now.",       "It was an accident. I swear."],
    ["You think I wouldn't find out?",       "I can explain everything."],
    ["This is over. You're done here.",      "Please don't do this to me."],
    ["I trusted you with everything.",       "I made one mistake. Just one."],
  ],
  villain: [
    ["Hello. Did you miss me?",              "You're not real. You can't be."],
    ["Surprise. It was me all along.",       "That's impossible. How?"],
    ["I took everything you had.",           "Give it back. Right now."],
    ["You can't tell us apart, can you?",    "Stay away from my family."],
    ["The game was rigged from the start.",  "You set me up, didn't you?"],
  ],
  twin: [
    ["Hello. I'm your twin.",                "No. You don't exist."],
    ["I've been living your life.",          "Get out of my house. Now."],
    ["He thinks I'm you. He always has.",    "Don't you dare go near him."],
    ["Two of us. One secret.",               "I'm calling the police."],
  ],
  cheater: [
    ["It's nothing. She's just a friend.",   "Show me the phone then."],
    ["Don't open that. It's work stuff.",    "I already read it all."],
    ["You're overreacting, I promise.",      "Her name is in your phone."],
    ["I can explain this, please.",          "Stop. Just stop talking."],
    ["She means nothing to me, I swear.",    "Then why her lipstick on you?"],
  ],
  wife: [
    ["Tell me who she is. Right now.",       "She is nobody. I promise."],
    ["Tell me her name. Right now.",         "You're twisting everything."],
    ["I found all your messages.",           "Those are old. Ancient history."],
    ["Why does she keep calling you?",       "Block her. I'll do it now."],
    ["You smell different. Explain.",        "That's from work, not from her."],
  ],
  mom: [
    ["I raised you better than this.",       "Mom, it's complicated, okay?"],
    ["Who is that girl?",                    "She's just someone I know."],
    ["I heard everything last night.",       "You weren't supposed to hear that."],
    ["That baby has your eyes.",             "Mom please, not right now."],
    ["Don't lie to your mother.",            "I wasn't going to lie, I swear."],
  ],
  kid: [
    ["I saw you kissing her, daddy.",        "Come here. Let me explain."],
    ["Please don't leave us.",               "I'm not going anywhere, I promise."],
    ["Mommy is crying again. Why?",          "Everything is fine. Go to sleep."],
    ["That lady came again today.",          "What lady? Tell me everything."],
    ["I found this in your jacket.",         "Put that down. Right now."],
  ],
  shock: [
    ["Wait... that baby looks like you.",    "That's not what you think it is."],
    ["I found the receipt.",                 "You weren't supposed to find that."],
    ["This photo was in your wallet.",       "I can explain. Please listen."],
    ["She texted you again. Just now.",      "Give me back my phone."],
    ["Your bags are packed by the door.",    "You packed my bags? Seriously?"],
  ],
  default: [
    ["Give me the phone. Right now.",        "You won't like what you see."],
    ["Say her name. I dare you.",            "You already know the answer."],
    ["I'm done. I'm so done with this.",     "Please. Give me one more chance."],
    ["Who is she? Tell me everything.",      "It started as nothing, I swear."],
    ["That note fell out your pocket.",      "That note is old. Very old."],
    ["You lied straight to my face.",        "I was going to tell you today."],
    ["I know what you did last night.",      "You don't know what you saw."],
    ["Don't touch me right now.",            "Just let me explain, please."],
  ],
};

// Scene 1 always needs the strongest hook line — no fruit names anywhere
const SCENE_1_HOOKS = [
  ["Wait. Whose number is this?",          "Don't touch my phone right now."],
  ["I found something in your jacket.",    "Just put it down. Please."],
  ["That perfume. It's not mine. Explain.","You're hearing things."],
  ["Who was at the door just now?",        "Nobody. It was nobody, I swear."],
  ["Your phone has been buzzing all day.", "It's just work. That's all."],
  ["I know what you did last night.",      "You don't know what you saw."],
  ["There's a baby basket on our door.",   "That... that is not mine."],
  ["Say her name. Right now.",             "You don't want to do this."],
];

function pickViralLine(name, scene, index) {
  const sceneNum = Number(scene?.sceneNumber ?? 1);

  // Scene 1 always uses a dedicated viral hook — no generic fallback
  if (sceneNum === 1) {
    const row = SCENE_1_HOOKS[0]; // first hook is the strongest
    return row[index === 0 ? 0 : 1];
  }

  const text = `${name ?? ""} ${scene?.beatType ?? ""} ${scene?.emotionDirection ?? ""} ${scene?.storyPurpose ?? ""} ${scene?.title ?? ""}`.toLowerCase();
  let pool;
  if (/(boss|gangster|mafia|kingpin|brokkolib|broccoli)/.test(text))       pool = VIRAL_LINE_POOLS.boss;
  else if (/(villain|antagonist|gangster pineapple)/.test(text))           pool = VIRAL_LINE_POOLS.villain;
  else if (/(twin|double|copy|doppelganger)/.test(text))                   pool = VIRAL_LINE_POOLS.twin;
  else if (/(cheater|mistress|affair|guilty|hot peach|hotpeach|secret)/.test(text)) pool = VIRAL_LINE_POOLS.cheater;
  else if (/(mom|mother|wife|orange mom|strawberry mom|betrayed|heartbreak)/.test(text)) pool = VIRAL_LINE_POOLS.wife;
  else if (/(grandma|aunt|mama|matriarch)/.test(text))                     pool = VIRAL_LINE_POOLS.mom;
  else if (/(kid|baby|son|daughter|child|lemon|apple son)/.test(text))     pool = VIRAL_LINE_POOLS.kid;
  else if (/(shock|twist|reveal|discovery|confrontation)/.test(text))      pool = VIRAL_LINE_POOLS.shock;
  else                                                                       pool = VIRAL_LINE_POOLS.default;

  // Pick a row based on scene number for variety, not random (deterministic = consistent rerenders)
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

function getSceneCharacterNames(scene, form = {}) {
  const selected = Array.isArray(form.selectedCharacters) ? form.selectedCharacters : [];
  const ids = [
    ...(Array.isArray(scene?.characterIdsInScene) ? scene.characterIdsInScene : []),
    ...(Array.isArray(scene?.charactersInScene) ? scene.charactersInScene : []),
  ].filter(Boolean);
  const uniqueIds = [...new Set(ids.map((id) => String(id ?? "").trim()).filter(Boolean))];

  if (uniqueIds.length === 0 && selected.length > 0) {
    return selected.slice(0, 2).map((char) => ({
      id: char.id ?? char.characterId ?? char.slug ?? char.name,
      name: readableCharacterName(char.name ?? char.label ?? char.id ?? char.characterId),
      role: char.role ?? char.id ?? "",
    }));
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
    return {
      id,
      name: readableCharacterName(match?.name ?? match?.label ?? match?.id ?? id),
      role: match?.role ?? match?.id ?? id,
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
  const withoutAllowedNoMusic = normalizeWhitespace(value)
    .toLowerCase()
    .replace(/no background music/g, "")
    .replace(/without background music/g, "");
  return /(background music|random music|cinematic music|emotional music|soundtrack|score|dramatic music bed|bg music|dramatic music)/i.test(withoutAllowedNoMusic);
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
  if (words.length < 2 || words.length > 7) {
    line = (words.length >= 2 ? words.slice(0, 7).join(" ") : fallback);
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
  const maxLines = speakerCount <= 1 ? 1 : speakerCount === 2 ? 2 : MAX_PROVIDER_DIALOGUE_LINES;

  const rawRows = base.slice(0, maxLines).map((row, index) => ({
    speaker: sanitizeSpeakerName(row.speaker || characters[index]?.name || `Fruit ${index + 1}`),
    line: sanitizeDialogueLine(row.line, scene, index),
  }));

  // Remove duplicate consecutive speakers and ensure each speaker appears only once
  const seenSpeakers = new Set();
  const rows = rawRows.filter((row) => {
    if (seenSpeakers.has(row.speaker)) return false;
    seenSpeakers.add(row.speaker);
    return true;
  });

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
  return dialogue.map((row) => `${row.speaker}: "${row.line}"`).join("\n");
}

function ensureImmediateAction(value, scene, max = 190) {
  const visualClue = deriveVisualClue(scene);
  const fallback = `Character storms forward, points at ${visualClue}, and freezes in shock.`;
  const action = cleanSectionText(value, fallback, max);
  if (hasActionVerb(action) && !hasVagueSlowSceneLanguage(action)) return action;
  return cleanSectionText(`${fallback} ${action}`, fallback, max);
}

function pickSoundEffect(scene, visualClue, action) {
  const text = `${scene?.title ?? ""} ${scene?.beatType ?? ""} ${scene?.storyPurpose ?? ""} ${scene?.actionDirection ?? ""} ${visualClue ?? ""} ${action ?? ""}`.toLowerCase();
  if (/(phone|text|message|call|dm|screen)/.test(text)) return "phone buzz";
  if (/(door|slam|leave|walk away)/.test(text)) return "door slam";
  if (/(baby|kid|crib|basket|cry)/.test(text)) return "baby cry";
  if (/(suitcase|packed|bags)/.test(text)) return "suitcase drop";
  if (/(note|paper|letter|receipt)/.test(text)) return "paper rustle";
  if (/(rain|street)/.test(text)) return "rain ambience";
  if (/(crowd|public|restaurant|office)/.test(text)) return "crowd gasp";
  return "gasp";
}

function deriveAmbience(scene) {
  const text = `${scene?.backgroundDetail ?? ""} ${scene?.environment ?? ""}`.toLowerCase();
  if (/(kitchen|dining)/.test(text)) return "Light kitchen ambience only.";
  if (/(street|rain|outside)/.test(text)) return "Light street ambience only.";
  if (/(office|work)/.test(text)) return "Light office ambience only.";
  if (/(restaurant|cafe)/.test(text)) return "Light restaurant ambience only.";
  return "Light room ambience only.";
}

function buildStrictFruitVideoPrompt({ scenePrompt = "", scene = {}, form = {}, max = null } = {}) {
  const isProviderPrompt = Boolean(max);
  const sceneNumber = Number(scene?.sceneNumber ?? 1);
  const pacingRole = getScenePacingRole(scene, form);
  const dialogue = getProviderDialogue({ scenePrompt, scene, form });
  const visualClue = cleanSectionText(scene.visualClue || deriveVisualClue(scene), "one clear physical clue from the image", isProviderPrompt ? 90 : 110);
  const action = ensureImmediateAction(
    scene.action || scene.videoAction || scene.actionDirection || scene.storyPurpose || scene.scenePurpose || scene.title,
    scene,
    isProviderPrompt ? 145 : 190,
  );
  const emotion = cleanSectionText(
    scene.emotion || scene.emotionDirection || scene.emotionalBeat,
    "glossy eyes, clenched jaw, trembling fingers, and a shocked freeze",
    isProviderPrompt ? 110 : 145,
  );
  const camera = cleanSectionText(
    scene.cameraDirection,
    "Vertical 9:16 tight close-up, fast push-in, whip-pan, snap zoom, reaction close-up.",
    isProviderPrompt ? 110 : 135,
  );
  const endingBeat = cleanSectionText(scene.endingBeat || deriveEndingBeat(scene), "end on a shocked freeze-frame before the next secret drops", isProviderPrompt ? 100 : 125);
  const soundEffect = pickSoundEffect(scene, visualClue, action);
  const ambience = deriveAmbience(scene);
  const opening = isProviderPrompt
    ? "Create a 6-second vertical 9:16 cinematic 3D fruit drama video from the input image. Preserve exact character designs."
    : "Create a 6-second vertical 9:16 cinematic 3D fruit drama video from the input image, preserving the exact character designs.";
  const pacingLine = isProviderPrompt
    ? `Scene ${sceneNumber}: ${pacingRole}. Fast viral TikTok pacing. Start late, show the problem instantly, end early.`
    : `Scene ${sceneNumber}: ${pacingRole}. Fast viral TikTok pacing. Start late, show the problem instantly, end early.`;
  const speechRules = isProviderPrompt
    ? "Speak English only. CRITICAL: Do NOT speak French, Spanish, Finnish, Portuguese, or any other language — ENGLISH ONLY. Dialogue starts in the first second. No silent intro, no waiting, no pause. Mouth sync every word. Say EXACTLY the quoted lines. Do not add, skip, translate, or use subtitles."
    : "Speak English only. CRITICAL: Do NOT speak French, Spanish, Finnish, Portuguese, or any other language under any circumstances — ENGLISH ONLY. Dialogue starts in the first second. No silent intro. No waiting. Characters speak immediately and clearly. Mouth movement must match every spoken word. Say exactly the quoted English lines. Do not add words, skip words, translate, paraphrase, or use subtitles.";
  const movement = isProviderPrompt
    ? "Fast gestures, mouth synced to dialogue, sharp eye reactions, head turns, urgent body language. No passive standing."
    : "Fast expressive gestures, mouth synced to dialogue, sharp eye reactions, head turns, urgent body language. No passive standing.";
  // Required sections come FIRST so they survive the 1450-char trim.
  // Optional sections (Emotion, Visual clue, Ending beat, Camera) fill the rest.
  const audioLine = `Clear mouth-synced dialogue only. No background music. Optional single sound effect: ${soundEffect}. ${ambience}`;
  const negativeLine = "No captions, no subtitles, no text overlays, no logos, no watermarks, no extra characters, no identity changes, no background music, no non-English speech.";

  const prompt = [
    opening,
    pacingLine,
    "",
    "SPOKEN DIALOGUE - SAY EXACTLY:",
    formatDialogueBlock(dialogue),
    "",
    "Speech rules:",
    speechRules,
    "",
    "Action:",
    action,
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
    "Camera:",
    camera,
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
  const negative = "\nNegative: No captions, no subtitles, no text overlays, no logos, no watermarks, no extra characters, no identity changes, no background music, no non-English speech.";
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

function shouldUsePreviousSceneRef(prevScene, currentScene) {
  if (!prevScene || !currentScene) return false;
  if (!currentScene.continuityFromPrevious) return false;
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
    "PRESERVE EXACTLY: fruit type, face, body shape, outfit, accessories, color palette, and overall identity.\n" +
    "This identity is LOCKED for the entire story - never confuse this character with any other."
  );
}

function buildSceneRefSlots({ scene, form, castBible = [], previousSceneImageUrl = null, prevScene = null }) {
  const selectedCharacters = form.selectedCharacters ?? [];
  const wantedIds = normalizeSceneCharacterIds(scene);
  const refSlots = [];
  const seenUrls = new Set();

  const addCharacterSlot = ({ wantedId, castEntry, selected, matchedBy = "cast" }) => {
    const finalUrl = toPublicAssetUrl(getSelectedImage(selected));
    console.log("[AI FRUIT refs] character lookup", {
      sceneNumber: scene.sceneNumber,
      sceneCharacterId: wantedId,
      castEntry,
      sourceCharacterId: castEntry?.sourceCharacterId,
      selectedFound: !!selected,
      selectedImage: getSelectedImage(selected),
      finalUrl,
    });

    if (!selected || !finalUrl || seenUrls.has(finalUrl)) return false;
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
    console.error("[AI FRUIT] BLOCKED SCENE: missing character refs", {
      sceneNumber: scene.sceneNumber,
      sceneTitle: scene.title,
      characterIdsInScene: scene.characterIdsInScene,
      charactersInScene: scene.charactersInScene,
      castBible,
      selectedCharacters,
    });
    throw new Error(`Missing character references for scene ${scene.sceneNumber}`);
  }

  if (previousSceneImageUrl && shouldUsePreviousSceneRef(prevScene, scene)) {
    const slot = REF_LABELS[refSlots.length] ?? String(refSlots.length + 1);
    refSlots.push({
      slot,
      type: "continuity",
      url: previousSceneImageUrl,
      promptText:
        `Reference Image ${slot} = Previous scene continuity reference.\n` +
        "Use this image ONLY for: room layout, background environment, lighting style, camera angle, and scene atmosphere continuity.\n" +
        "Do NOT use this continuity reference to add previous-scene characters into this scene.\n" +
        "Do NOT copy characters from this reference that are not in the current scene cast.\n" +
        "If this scene takes place in a new location, create the new environment fresh - do NOT inherit the previous background.",
    });
  }

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
    "- Polished 3D anthropomorphic fruit characters with expressive faces\n" +
    "- Cinematic lighting, dramatic storytelling, and clean composition\n" +
    "- TikTok-optimized vertical framing when requested\n" +
    "- Preserve exact identity of all referenced characters\n" +
    "- Only include the characters listed for this scene\n" +
    "- Do not invent extra characters, merge identities, or change one character into another\n" +
    "- Clean, TikTok-ready framing — scroll-stopping premium quality\n" +
    "- NO realism drift, NO random character redesigns\n" +
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
      "Do NOT add random background characters or extras."
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
      "- Keep all recurring characters visually identical to their reference images."
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

  /* ── 7. Absolute no-text rule ── */
  parts.push(
    "ABSOLUTE RULE — NO TEXT OF ANY KIND:\n" +
    "NO text, NO captions, NO subtitles, NO speech bubbles, NO dialogue boxes,\n" +
    "NO signs with readable words, NO watermarks, NO logos, NO UI overlays,\n" +
    "NO title cards, NO typography, NO letters or numbers anywhere in this image."
  );

  return parts.join("\n\n");
}

/* ─── planFruitStory ─── */
export async function planFruitStory(payload) {
  const { data, error } = await supabase.functions.invoke("fruit-story-planner", {
    body: payload,
  });

  if (error) throw new Error(error.message || "Story planning failed");
  if (!data?.ok) throw new Error(data?.error || "Story planning failed");

  return data; // { title, hook, storySummary, storyDNA, cast[], scenes[] }
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
  const quality = imageToolKey === "zyvo-v3" ? "medium" : "low";

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
    console.error("[AI FRUIT] BLOCKED SCENE: missing character refs", {
      sceneNumber: scene.sceneNumber,
      sceneTitle: scene.title,
      characterIdsInScene: scene.characterIdsInScene,
      charactersInScene: scene.charactersInScene,
      castBible,
      selectedCharacters: form.selectedCharacters ?? [],
    });
    throw new Error(`Missing character references for scene ${scene.sceneNumber}`);
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

  const isFruitImageModel = toolKey === "image:fruit-v2" || toolKey === "image:fruit-v3";
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

  const job = await createImageJobSimple({
    subject:      masterPrompt,
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

/* ─── animateScene ─── */
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

export async function animateScene({ scene, form, videoToolKey }) {
  if (!scene.imageUrl) {
    throw new Error(`Scene ${scene.sceneNumber} has no image yet — generate images first`);
  }

  const toolKey     = FRUIT_VIDEO_MODEL_TO_TOOLKEY[videoToolKey] ?? "video:klingpro";
  const withSound   = VIDEO_WITH_SOUND[videoToolKey] ?? false;
  const aspect      = form.sceneAspect ?? "9:16";
  const dims        = ASPECT_VIDEO_DIMS[aspect] ?? ASPECT_VIDEO_DIMS["9:16"];
  const durationSec = scene.durationSeconds ?? STORY_LENGTH_DURATION_SEC[form.storyLength] ?? 5;
  const prompt      = buildRunwareVideoPrompt(scene.videoPrompt, scene, form);

  const link          = getProviderLink(toolKey);
  const creditsPerSec = withSound
    ? (link?.soundCreditsPerSecond ?? link?.baseCreditsPerSecond ?? 11)
    : (link?.baseCreditsPerSecond ?? 11);
  const calculatedCredits = Math.ceil(creditsPerSec * durationSec);

  const job = await createVideoJobSimple({
    subject:           prompt,
    toolKey,
    width:             dims.width,
    height:            dims.height,
    durationSec,
    initImageUrls:     [scene.imageUrl],
    calculatedCredits,
    project_id:        form.project_id ?? null,
    withSound,
  });

  return job;
}

export async function animateClip({ clip, startScene, endScene, form, videoToolKey }) {
  const initImageUrls = [clip?.startImageUrl || startScene?.imageUrl].filter(Boolean);

  if (!clip?.startImageUrl || initImageUrls.length === 0) {
    throw new Error(`Clip ${clip?.clipNumber ?? ""} is missing a scene image`);
  }

  const toolKey     = FRUIT_VIDEO_MODEL_TO_TOOLKEY[videoToolKey] ?? "video:wan26flash";
  const withSound   = VIDEO_WITH_SOUND[videoToolKey] ?? true;
  const aspect      = form.sceneAspect ?? "9:16";
  const dims        = ASPECT_VIDEO_DIMS[aspect] ?? ASPECT_VIDEO_DIMS["9:16"];
  const durationSec = 6;
  const fullPrompt  = buildFruitVideoPrompt({ clip, startScene, endScene, form });
  const prompt      = buildRunwareVideoPrompt(fullPrompt, startScene, form);

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
    calculatedCredits: 0,
    skipCreditCheck:   true,
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
