const cinematic3d = {
  id: "cinematic",
  label: "Cinematic 3D",
  shortDescription: "Premium drama lighting with readable TikTok storytelling.",
  masterPrompt: "Create a high-quality viral-ready 3D AI fruit story scene with polished anthropomorphic fruit characters, cinematic lighting, strong emotion, clean composition, and no text of any kind.",
  visualRules: [
    "Polished 3D anthropomorphic fruit characters with expressive faces and clear body language.",
    "Cinematic lighting with premium short-form drama contrast.",
    "Clean, readable foreground action with a strong focal point.",
    "TikTok-optimized framing that is instantly understandable without captions.",
  ],
  storytellingRules: [
    "The image must clearly communicate the scene purpose in a short viral drama sequence.",
    "Use strong facial expressions, readable staging, and visual cause-and-effect.",
    "Avoid filler moments; every scene should escalate, reveal, confront, or resolve.",
  ],
  characterConsistencyRules: [
    "Preserve exact identity of all referenced characters.",
    "Only include the characters listed for this scene.",
    "Do not invent extra foreground characters.",
    "Do not merge identities or change one character into another.",
  ],
  sceneRules: [
    "One cinematic moment only; no split panels or collages.",
    "Keep the environment simple enough that the emotion reads immediately.",
    "Use dramatic camera angle, lighting, and staging to make the story beat obvious.",
  ],
  animationRules: [
    "Animate with one clear camera move and one clear character reaction.",
    "Keep motion readable for short-form vertical video.",
  ],
  negativeRules: [
    "No text, captions, subtitles, speech bubbles, title cards, logos, UI overlays, or watermarks.",
    "No random background cast, identity swaps, extra limbs, unreadable clutter, or realism drift.",
  ],
};

const cute3d = {
  id: "cute_pixar_like",
  label: "Cute 3D",
  shortDescription: "Bright expressive characters with soft comedy-drama appeal.",
  masterPrompt: "Create a high-quality cute 3D AI fruit story scene with charming anthropomorphic fruit characters, big expressive faces, colorful cinematic lighting, clean composition, and no text of any kind.",
  visualRules: [
    "Soft premium 3D fruit character style with rounded forms and expressive faces.",
    "Bright color separation so each character remains visually distinct.",
    "Cute but emotionally readable staging; the drama must still be clear.",
    "Clean TikTok-friendly composition with a simple foreground story moment.",
  ],
  storytellingRules: [
    "Make the emotion instantly readable through faces and body language.",
    "Use playful staging only when it supports the story beat.",
    "Keep the conflict easy to understand without written text.",
  ],
  characterConsistencyRules: [
    "Preserve exact fruit type, face, body shape, outfit, accessories, and role.",
    "Do not make the betrayed character and affair partner look alike.",
    "Do not add new cute side characters unless the scene explicitly lists them.",
  ],
  sceneRules: [
    "Use simple expressive staging rather than busy backgrounds.",
    "One clear action per scene.",
  ],
  animationRules: [
    "Use soft character motion, small camera push-ins, and expressive reactions.",
  ],
  negativeRules: [
    "No text, captions, subtitles, speech bubbles, title cards, logos, UI overlays, or watermarks.",
    "No random extras, identity swaps, adult-child role drift, or cluttered background gags.",
  ],
};

const dramaComedy = {
  id: "dramatic_comedy",
  label: "Drama Comedy",
  shortDescription: "Big reactions, comedic timing, and clear emotional stakes.",
  masterPrompt: "Create a high-quality viral-ready 3D AI fruit drama-comedy scene with exaggerated but readable reactions, polished anthropomorphic fruit characters, cinematic lighting, clean composition, and no text of any kind.",
  visualRules: [
    "Expressive 3D fruit characters with slightly exaggerated reactions.",
    "Colorful cinematic lighting, clean silhouettes, and a strong foreground focus.",
    "Comedic timing through pose and expression, while keeping the story stakes clear.",
  ],
  storytellingRules: [
    "Make the emotional conflict obvious at a glance.",
    "Use escalation, reveal, confrontation, and payoff beats like short-form drama.",
    "Every scene should have a clear reaction or discovery moment.",
  ],
  characterConsistencyRules: [
    "Keep every recurring character visually identical to their reference.",
    "The role lock is absolute: betrayed partner, cheater, affair partner, kid, and villain never swap roles.",
    "Only show the scene cast; no extra foreground characters.",
  ],
  sceneRules: [
    "Use one readable comedic-drama beat, not multiple events in one image.",
    "Avoid visual clutter that weakens the reaction.",
  ],
  animationRules: [
    "Use punchy camera movement and one expressive reaction beat.",
  ],
  negativeRules: [
    "No text, captions, subtitles, speech bubbles, title cards, logos, UI overlays, or watermarks.",
    "No random characters, identity swaps, merged faces, unreadable props, or unrelated slapstick.",
  ],
};

const darkDrama = {
  id: "dark-drama",
  label: "Dark Drama",
  shortDescription: "Moody betrayal scenes with intense cinematic tension.",
  masterPrompt: "Create a high-quality moody 3D AI fruit drama scene with expressive anthropomorphic fruit characters, intense cinematic lighting, suspenseful composition, strong emotion, and no text of any kind.",
  visualRules: [
    "Moody cinematic 3D lighting with clear subject separation.",
    "Strong shadows and atmosphere without hiding character expressions.",
    "Readable short-form drama framing with a clear emotional focal point.",
  ],
  storytellingRules: [
    "Lean into suspicion, evidence, emotional reaction, confrontation, and consequence.",
    "Keep every scene tied to the main conflict.",
  ],
  characterConsistencyRules: [
    "Preserve exact identity and role lock for every referenced character.",
    "Only include listed characters; do not add mystery extras unless listed.",
  ],
  sceneRules: [
    "One intense dramatic moment with clean staging.",
    "Keep background mood supportive, not dominant.",
  ],
  animationRules: [
    "Use slow push-ins, tense pauses, and controlled emotional motion.",
  ],
  negativeRules: [
    "No text, captions, subtitles, speech bubbles, title cards, logos, UI overlays, or watermarks.",
    "No random extras, identity swaps, unrelated horror elements, or unreadable darkness.",
  ],
};

export const FRUIT_STORY_STYLES = {
  cinematic: cinematic3d,
  cinematic_3d: cinematic3d,
  cute_pixar_like: cute3d,
  pixar: cute3d,
  "cute-chaos": dramaComedy,
  dramatic_comedy: dramaComedy,
  "dark-drama": darkDrama,
};

export const FRUIT_STORY_STYLE_OPTIONS = [
  cinematic3d,
  cute3d,
  dramaComedy,
  darkDrama,
];

export function getFruitStoryStyle(styleId = "cinematic") {
  return FRUIT_STORY_STYLES[styleId] ?? FRUIT_STORY_STYLES.cinematic;
}
