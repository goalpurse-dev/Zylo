// voiceCatalog.js — the curated Stickman narration voice library (Phase 6b).
//
// Data only. Every voice is usable by our ElevenLabs key today (checked with
// GET /v1/voices on 2026-09-28): 23 premade voices (no voice slot, covered by
// the plan's commercial licence) + 10 Voice Library voices already saved to
// the account (Voice Library voices don't use custom-voice slots; their owner
// can stop sharing with a notice period — up to 2 years — during which saved
// voices keep working). Non-English and personal cloned voices are left out.
//
// sampleUrl: one fixed ~15 s sample per voice, generated ONCE with the same
// neutral explainer line and the same settings as real narration
// (scripts/generateVoiceSamples.mjs), served as a static file. Each sample's
// alignment also measured the voice's pace (src/lib/voiceSamplePace.ts).
//
// tones: calm | energetic | storyteller | documentary | playful
// niches: niche ids or niche GROUP ids (src/pages/workspace/long-form/niches.js)

export const VOICE_TONES = [
  { id: "calm", label: "Calm" },
  { id: "energetic", label: "Energetic" },
  { id: "storyteller", label: "Storyteller" },
  { id: "documentary", label: "Documentary" },
  { id: "playful", label: "Playful" },
];

export const VOICE_SAMPLE_TEXT =
  "Every day, your brain makes thousands of tiny decisions without asking you first. Some are brilliant shortcuts. Others are old habits from a very different world. Let's take a closer look at how it really works, one step at a time.";

export const DEFAULT_VOICE_MODEL = "eleven_flash_v2_5";

const v = (voiceId, name, gender, accent, age, tones, tags, niches, category = "premade") => ({
  voiceId,
  name,
  gender,
  accent,
  age,
  tones,
  tags,
  niches,
  category,
  voiceModel: DEFAULT_VOICE_MODEL,
  sampleUrl: `/voices/samples/${voiceId}.mp3`,
});

export const VOICE_CATALOG = [
  // ── Premade (ElevenLabs default voices) ─────────────────────────────
  v("TxGEqnHWrfWFTfGW9XjX", "Josh", "male", "american", "young", ["calm", "documentary"], ["Clear", "Calm", "Narrator"], ["science_universe", "history", "psychology_human_behavior"]),
  v("JBFqnCBsd6RMkjVDRZzb", "George", "male", "british", "middle-aged", ["storyteller", "documentary"], ["Warm", "Captivating", "Storyteller"], ["history", "daily_life_past_eras", "myth_vs_reality", "ancient_humans_prehistory"]),
  v("onwK4e9ZLuTAKqWW03F9", "Daniel", "male", "british", "middle-aged", ["documentary", "calm"], ["Steady", "Broadcaster", "Authoritative"], ["history", "military_logistics_history", "timeline_history", "how_systems_work"]),
  v("nPczCjzI2devNBz1zQrb", "Brian", "male", "american", "middle-aged", ["storyteller", "calm"], ["Deep", "Resonant", "Comforting"], ["space_cosmic_scale", "mysteries_unexplained", "ancient_humans_prehistory"]),
  v("pqHfZKP75CvOlQylNhV4", "Bill", "male", "american", "old", ["storyteller", "calm"], ["Wise", "Mature", "Balanced"], ["timeline_history", "extinct_animals", "ancient_humans_prehistory"]),
  v("Xb7hH8MSUJpSbSDYk0k2", "Alice", "female", "british", "middle-aged", ["documentary", "calm"], ["Clear", "Engaging", "Educator"], ["the_body_explained", "everyday_science", "science_universe"]),
  v("XrExE9yKIg1WjnnlVkGX", "Matilda", "female", "american", "middle-aged", ["documentary"], ["Knowledgeable", "Professional", "Upbeat"], ["money_psychology_economics", "psychology_human_behavior", "how_systems_work"]),
  v("hpp4J3VqNfWAUOO0d1Us", "Bella", "female", "american", "middle-aged", ["documentary", "calm"], ["Professional", "Bright", "Warm"], ["the_body_explained", "sleep_health_habits", "mind_body"]),
  v("EXAVITQu4vr4xnSDxMaL", "Sarah", "female", "american", "young", ["calm", "documentary"], ["Mature", "Reassuring", "Confident"], ["mind_body", "psychology_human_behavior", "sleep_health_habits"]),
  v("SAz9YHcvj6GT2YYXdXww", "River", "neutral", "american", "middle-aged", ["calm", "documentary"], ["Relaxed", "Neutral", "Informative"], ["science_universe", "how_systems_work", "everyday_science"]),
  v("cjVigY5qzO86Huf0OWal", "Eric", "male", "american", "middle-aged", ["calm", "documentary"], ["Smooth", "Trustworthy"], ["money_modern_life", "how_systems_work", "technology_attention_economy"]),
  v("pFZP5JQG7iQjIQuC4Bku", "Lily", "female", "british", "middle-aged", ["storyteller", "calm"], ["Velvety", "Expressive", "Actress"], ["daily_life_past_eras", "myth_vs_reality", "countries_cultures"]),
  v("N2lVS1w4EtoT3dr4eOWO", "Callum", "male", "american", "middle-aged", ["storyteller", "playful"], ["Husky", "Mischievous"], ["mysteries_unexplained", "what_if_hypotheticals", "myth_vs_reality"]),
  v("SOYHLrjzK2X1ezoPC6cr", "Harry", "male", "american", "young", ["energetic", "storyteller"], ["Fierce", "Intense", "Warrior"], ["military_logistics_history", "dark_brutal_history", "survival_scenarios"]),
  v("pNInz6obpgDQGcFmaJgB", "Adam", "male", "american", "middle-aged", ["documentary", "energetic"], ["Dominant", "Firm"], ["dark_brutal_history", "survival_scenarios", "animal_behavior_predator_prey"]),
  v("IKne3meq5aSn9XLyUdCD", "Charlie", "male", "australian", "young", ["energetic"], ["Deep", "Confident", "Energetic"], ["survival_scenarios", "animals_nature", "animal_behavior_predator_prey"]),
  v("TX3LPaxmHKxFdv7VOQHJ", "Liam", "male", "american", "young", ["energetic", "playful"], ["Energetic", "Warm", "Creator"], ["technology_attention_economy", "you_vs_x", "what_if_hypotheticals"]),
  v("CwhRBWXzGAHq8TQ4Fs17", "Roger", "male", "american", "middle-aged", ["calm", "playful"], ["Laid-back", "Casual", "Conversational"], ["money_modern_life", "you_vs_x", "jobs_careers"]),
  v("bIHbv24MWmeRgasZH58o", "Will", "male", "american", "young", ["calm", "playful"], ["Relaxed", "Optimistic"], ["sleep_health_habits", "jobs_careers", "everyday_science"]),
  v("iP95p4xoKVk53GoZ742B", "Chris", "male", "american", "middle-aged", ["playful", "calm"], ["Charming", "Down-to-earth"], ["jobs_careers", "countries_cultures", "why_dont_we_eat_x"]),
  v("cgSgspJ2msm6clMCkdW9", "Jessica", "female", "american", "young", ["playful", "energetic"], ["Playful", "Bright", "Warm"], ["why_dont_we_eat_x", "animals_nature", "evolution_quirks"]),
  v("FGY2WhTYpPnrIDTdsKH5", "Laura", "female", "american", "young", ["playful", "energetic"], ["Quirky", "Enthusiastic"], ["what_if_hypotheticals", "you_vs_x", "evolution_quirks"]),
  v("21m00Tcm4TlvDq8ikWAM", "Rachel", "female", "american", "young", ["calm", "storyteller"], ["Warm", "Measured"], ["mind_body", "animals_nature", "daily_life_past_eras"]),
  v("ErXwobaYiN019PkySvjV", "Antoni", "male", "american", "young", ["storyteller", "documentary"], ["Well-rounded", "Confident"], ["money_modern_life", "timeline_history"]),
  // ── Voice Library (saved to our account; no voice slots used) ────────
  v("S9GPGBaMND8XWwwzxQXp", "Charles", "male", "american", "young", ["energetic", "documentary"], ["Fun", "Informative", "Confident"], ["everyday_science", "technology_attention_economy", "how_systems_work"], "library"),
  v("ScZQf6C8aVzMf60NZQVk", "Jordan", "male", "american", "young", ["playful", "energetic"], ["Casual", "YouTube", "Faceless"], ["you_vs_x", "what_if_hypotheticals", "money_psychology_economics"], "library"),
  v("yj30vwTGJxSHezdAGsv9", "Jessa", "female", "american", "young", ["calm", "documentary"], ["Authentic", "Friendly", "Grounded"], ["psychology_human_behavior", "mind_body", "money_modern_life"], "library"),
  v("p28fY1cl6tovhD2M4WEH", "B. Patrone", "male", "american", "middle-aged", ["calm"], ["Peaceful", "Meditative"], ["sleep_health_habits", "space_cosmic_scale"], "library"),
  v("dtSEyYGNJqjrtBArPCVZ", "Titan", "male", "american", "young", ["energetic", "storyteller"], ["Intense", "Dramatic"], ["dark_brutal_history", "military_logistics_history", "survival_scenarios"], "library"),
  v("FSZ4QLofSALZxepAyq63", "Liam · Creator", "male", "american", "young", ["energetic"], ["Energetic", "Confident", "Social"], ["technology_attention_economy", "you_vs_x"], "library"),
  v("uShMnNluVYEPk3ah7RIY", "Alec", "male", "american", "young", ["energetic", "playful"], ["Fun", "Informative"], ["everyday_science", "why_dont_we_eat_x", "technology_attention_economy"], "library"),
  v("yl2ZDV1MzN4HbQJbMihG", "Alex", "male", "american", "young", ["energetic"], ["Upbeat", "Energetic", "Clear"], ["you_vs_x", "what_if_hypotheticals"], "library"),
  v("TsHrPyMlNFuIYnbODF01", "Alien Master", "male", "new zealand", "middle-aged", ["storyteller"], ["Ominous", "Deep", "Dark"], ["mysteries_unexplained", "dark_brutal_history"], "library"),
];

export const findVoice = (voiceId) => VOICE_CATALOG.find((x) => x.voiceId === voiceId) ?? null;

// "Recommended for this niche": the niche itself or its group is listed.
export function isRecommendedForNiche(voice, niche) {
  if (!voice || !niche) return false;
  return voice.niches.includes(niche.id) || voice.niches.includes(niche.groupId);
}

export function filterVoices({ gender = "all", tone = "all", accent = "all", query = "" } = {}) {
  const q = query.trim().toLowerCase();
  return VOICE_CATALOG.filter((x) =>
    (gender === "all" || x.gender === gender) &&
    (tone === "all" || x.tones.includes(tone)) &&
    (accent === "all" || x.accent === accent) &&
    (!q || `${x.name} ${x.tags.join(" ")} ${x.accent} ${x.gender} ${x.tones.join(" ")}`.toLowerCase().includes(q)));
}

export const voiceLabel = (voiceId) => findVoice(voiceId)?.name ?? "Custom voice";
