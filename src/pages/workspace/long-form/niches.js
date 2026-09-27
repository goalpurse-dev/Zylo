// niches.js — 2026-10-02 "Production Setup redesign" pass, Section 3/4;
// extended 2026-10-02 "Create New Video" UX rework pass (description, image
// path, example topic, category color).
//
// Niche is informational/content context, separate from Visual Style
// (visualStyles.js) — never a forced pair. Ids are stable and machine-
// readable; they inform research/story/Production Bible context ONLY, never
// injected directly into a provider image prompt (that would leak an
// internal taxonomy label into generated artwork).

// Category accent colors (UI-only — never sent to any backend/provider).
// Used as the niche-picker category chips AND as the fallback tile background
// for any niche with no real image yet at /images/niches/<slug>.webp.
export const NICHE_CATEGORY_COLORS = {
  history: { from: "#c2703d", to: "#8a4a2a", label: "warm orange/terracotta" },
  mind_body: { from: "#a78bfa", to: "#6d5bb0", label: "lavender/violet" },
  animals_nature: { from: "#9caf6b", to: "#c9a227", label: "sage/gold" },
  science_universe: { from: "#5b6fd6", to: "#2f8f8a", label: "indigo/teal" },
  money_modern_life: { from: "#5fcf9e", to: "#e08a72", label: "mint/coral" },
};

export const NICHE_GROUPS = [
  {
    id: "history",
    label: "History & The Past",
    niches: [
      { id: "ancient_humans_prehistory", label: "Ancient Humans & Prehistory", description: "How early humans actually lived, survived, and adapted.", exampleTopic: "How did early humans survive their first winters without fire?" },
      { id: "dark_brutal_history", label: "Dark & Brutal History", description: "The harsh, unfiltered realities of the past.", exampleTopic: "What really happened to sailors lost at sea for months?" },
      { id: "daily_life_past_eras", label: "Daily Life in Past Eras", description: "Ordinary routines from extraordinary time periods.", exampleTopic: "What did a normal Tuesday look like in medieval Europe?" },
      { id: "military_logistics_history", label: "Military & Logistics History", description: "How armies actually moved, fed, and supplied themselves.", exampleTopic: "How did Rome feed a marching army of 30,000 soldiers?" },
      { id: "ancient_medicine_science", label: "Ancient Medicine & Science", description: "Early breakthroughs, guesses, and surprisingly good ideas.", exampleTopic: "Did ancient doctors actually perform brain surgery?" },
      { id: "timeline_history", label: "Timeline History", description: "How one thing led to another, decade by decade.", exampleTopic: "How did a single assassination lead to a world war?" },
      { id: "myth_vs_reality", label: "Myth vs Reality", description: "Separating popular legend from what actually happened.", exampleTopic: "Did Vikings really wear horned helmets?" },
    ],
  },
  {
    id: "mind_body",
    label: "Mind & Body",
    niches: [
      { id: "psychology_human_behavior", label: "Psychology & Human Behavior", description: "Why people think and act the way they do.", exampleTopic: "Why does your brain replay embarrassing moments?" },
      { id: "the_body_explained", label: "The Body Explained", description: "How your own body actually works, explained simply.", exampleTopic: "Why do you get goosebumps when you're not cold?" },
      { id: "sleep_health_habits", label: "Sleep, Health & Habits", description: "The science behind rest, routines, and daily choices.", exampleTopic: "What happens to your brain after 72 hours without sleep?" },
      { id: "evolution_quirks", label: "Evolution Quirks", description: "The strange leftovers evolution never bothered to fix.", exampleTopic: "Why do humans still have a tailbone?" },
    ],
  },
  {
    id: "animals_nature",
    label: "Animals & Nature",
    niches: [
      { id: "why_dont_we_eat_x", label: "Why Don't We Eat X?", description: "The real reasons certain foods never made the menu.", exampleTopic: "Why don't humans eat horses in most Western countries?" },
      { id: "animal_behavior_predator_prey", label: "Animal Behavior & Predator/Prey", description: "The strategies animals use to hunt, hide, and survive.", exampleTopic: "How does a gazelle decide when to outrun a cheetah?" },
      { id: "survival_scenarios", label: "Survival Scenarios", description: "What it would actually take to survive extreme situations.", exampleTopic: "Could you survive a night alone in the Arctic?" },
      { id: "extinct_animals", label: "Extinct Animals", description: "Creatures that used to roam the earth — and why they didn't last.", exampleTopic: "Why did the woolly mammoth actually go extinct?" },
    ],
  },
  {
    id: "science_universe",
    label: "Science & Universe",
    niches: [
      { id: "space_cosmic_scale", label: "Space & Cosmic Scale", description: "Putting the sheer size of the universe into perspective.", exampleTopic: "How big is our galaxy compared to the observable universe?" },
      { id: "what_if_hypotheticals", label: "What If? Hypotheticals", description: "Exploring bold, imaginative scenarios with real logic.", exampleTopic: "What if you suddenly inherited a million dollars?" },
      { id: "mysteries_unexplained", label: "Mysteries & Unexplained Phenomena", description: "Real puzzles science hasn't fully solved yet.", exampleTopic: "What's really at the bottom of the deepest part of the ocean?" },
      { id: "everyday_science", label: "Everyday Science", description: "The hidden science behind things you use every day.", exampleTopic: "How does Wi-Fi actually travel through your walls?" },
    ],
  },
  {
    id: "money_modern_life",
    label: "Money & Modern Life",
    niches: [
      { id: "money_psychology_economics", label: "Money Psychology & Economics", description: "Why we spend, save, and value money the way we do.", exampleTopic: "Why does losing $100 hurt more than winning $100 feels good?" },
      { id: "technology_attention_economy", label: "Technology & Attention Economy", description: "How modern tech is built to capture your focus.", exampleTopic: "How do apps actually keep you scrolling for hours?" },
      { id: "how_systems_work", label: "How Systems Work", description: "The hidden machinery behind everyday infrastructure.", exampleTopic: "How does the electrical grid balance supply every second?" },
      { id: "countries_cultures", label: "Countries & Cultures", description: "What makes different places and traditions unique.", exampleTopic: "Why does Japan have vending machines on every corner?" },
      { id: "jobs_careers", label: "Jobs & Careers", description: "What certain jobs are really like day to day.", exampleTopic: "What does an air traffic controller actually do all day?" },
      { id: "you_vs_x", label: "You vs X", description: "Direct, personal comparisons that put things in perspective.", exampleTopic: "How would you fare against a chimpanzee in a fight?" },
    ],
  },
];

export const ALL_NICHES = NICHE_GROUPS.flatMap((g) => g.niches.map((n) => ({ ...n, groupId: g.id, groupLabel: g.label })));

export function findNiche(nicheId) {
  return ALL_NICHES.find((n) => n.id === nicheId) ?? null;
}

// Static product asset — see the deliverable report for the full expected
// slug list. No image at this path yet for any niche; the UI falls back to
// a category-colored tile (NICHE_CATEGORY_COLORS) until one is dropped in.
export function nicheImagePath(nicheId) {
  return `/images/niches/${nicheId}.webp`;
}

const GENERIC_EXAMPLE_TOPIC = "What's something most people get wrong about this topic?";
export function exampleTopicForNiche(nicheId) {
  return findNiche(nicheId)?.exampleTopic ?? GENERIC_EXAMPLE_TOPIC;
}

// Ranking-only metadata (Section 3: "Recommendations should be metadata/
// ranking only. Never restrict the user from selecting another style.") —
// ordered lists of visualStyles.js style ids, most-recommended first. Every
// niche not explicitly listed falls back to DEFAULT_RECOMMENDED_STYLE_ORDER.
export const RECOMMENDED_STYLES_BY_NICHE = {
  ancient_humans_prehistory: ["classic_flat_stickman", "vintage_parchment_ink", "paper_cutout"],
  dark_brutal_history: ["classic_flat_stickman", "vintage_parchment_ink", "silhouette_accent"],
  daily_life_past_eras: ["classic_flat_stickman", "vintage_parchment_ink", "paper_cutout"],
  military_logistics_history: ["blueprint_schematic", "classic_flat_stickman", "vintage_parchment_ink"],
  ancient_medicine_science: ["classic_flat_stickman", "vintage_parchment_ink", "whiteboard_marker"],
  timeline_history: ["classic_flat_stickman", "paper_cutout", "vintage_parchment_ink"],
  myth_vs_reality: ["classic_flat_stickman", "vintage_parchment_ink", "comic_doodle"],

  psychology_human_behavior: ["classic_flat_stickman", "whiteboard_marker", "bold_flat_vector"],
  the_body_explained: ["classic_flat_stickman", "whiteboard_marker", "blueprint_schematic"],
  sleep_health_habits: ["classic_flat_stickman", "whiteboard_marker", "bold_flat_vector"],
  evolution_quirks: ["classic_flat_stickman", "bold_flat_vector", "whiteboard_marker"],

  why_dont_we_eat_x: ["classic_flat_stickman", "comic_doodle", "bold_flat_vector"],
  animal_behavior_predator_prey: ["classic_flat_stickman", "silhouette_accent", "paper_cutout"],
  survival_scenarios: ["classic_flat_stickman", "silhouette_accent", "paper_cutout"],
  extinct_animals: ["classic_flat_stickman", "paper_cutout", "silhouette_accent"],

  space_cosmic_scale: ["blueprint_schematic", "classic_flat_stickman", "bold_flat_vector"],
  what_if_hypotheticals: ["classic_flat_stickman", "bold_flat_vector", "comic_doodle"],
  mysteries_unexplained: ["classic_flat_stickman", "silhouette_accent", "chalkboard"],
  everyday_science: ["whiteboard_marker", "classic_flat_stickman", "blueprint_schematic"],

  money_psychology_economics: ["whiteboard_marker", "classic_flat_stickman", "bold_flat_vector"],
  technology_attention_economy: ["blueprint_schematic", "whiteboard_marker", "classic_flat_stickman"],
  how_systems_work: ["blueprint_schematic", "whiteboard_marker", "classic_flat_stickman"],
  countries_cultures: ["classic_flat_stickman", "paper_cutout", "bold_flat_vector"],
  jobs_careers: ["classic_flat_stickman", "whiteboard_marker", "comic_doodle"],
  you_vs_x: ["classic_flat_stickman", "comic_doodle", "bold_flat_vector"],
};
export const DEFAULT_RECOMMENDED_STYLE_ORDER = ["classic_flat_stickman", "whiteboard_marker", "bold_flat_vector"];

export function recommendedStylesForNiche(nicheId) {
  return RECOMMENDED_STYLES_BY_NICHE[nicheId] ?? DEFAULT_RECOMMENDED_STYLE_ORDER;
}
