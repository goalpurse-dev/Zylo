// The light of a video (step B of the batch-2 look study, the owner's go of 2026-11-05): the competitors light each
// topic for its story (a storm sky behind the tornado house, an orange fire line for the wildfire, glowing lava, dusk,
// night with lit windows); ours was the same flat noon every time. A mood overrides the page's look settings (real.js
// LOOK: sky gradient, sun [colour, intensity, position], rim light, hemisphere light, environment light, bloom, fog).
// noon is the old look with less flat environment light, so shadows read.
export const MOODS = Object.freeze({
  noon: { env: 0.75, sun: ["#fff1dc", 3.1, [16, 26, 14]] },
  storm: { bgHdri: false, sky: ["#3f4a58", "#8e98a3"], sun: ["#d6deea", 0.8, [10, 30, 20]], env: 0.3, hemi: 0.35, hemiCols: ["#a4afbd", "#3d3a36"], exposure: 0.78, sat: 0.72, bloom: 0, fog: ["#8e98a3", 55, 240] },
  dusk: { exposure: 0.95, bgHdri: false, sky: ["#ff9e6b", "#ffd9a8"], sun: ["#ffc685", 3.2, [24, 13, 8]], rim: ["#7fb2ff", 1.6, [-18, 12, -24]], env: 0.55, hemi: 0.55, hemiCols: ["#ffd6b0", "#4b3a6e"], bloom: 0.25, fog: ["#ffd9a8", 70, 300] },
  night: { bgHdri: false, sky: ["#0b1430", "#2a3860"], sun: ["#a9bcff", 0.45, [-12, 30, 10]], rim: ["#ffcf8a", 0.35, [14, 8, 18]], env: 0.09, hemi: 0.22, hemiCols: ["#3a4a7a", "#1a1612"], exposure: 0.85, sat: 0.7, bloom: 0.6, fog: ["#1b2440", 80, 300] },
  fire: { exposure: 0.88, bgHdri: false, sky: ["#3a1a12", "#e0743a"], sun: ["#ff8a3a", 3.0, [20, 10, 6]], rim: ["#ff4a10", 2.0, [-14, 6, -20]], env: 0.22, hemi: 0.42, hemiCols: ["#ffb380", "#2a1410"], bloom: 0.5, fog: ["#c0582b", 60, 250] },
});

// the mood a topic asks for, from its own words (the layout's title and key; free, no planner call). Indoor settings
// keep noon: their light comes through the room
const RULES = [
  ["storm", /\b(tornado|hurricane|storm|typhoon|cyclone|tsunami|flood(s|ing|ed)?|lightning|blizzard)\b/],
  ["fire", /\b(fire|wildfire|lava|volcano|volcanic|furnace|forge|inferno|eruption)\b/],
  ["night", /\b(night|midnight|nighttime|3 ?am|dark|streetlight|street light|prison|escape|alcatraz)\b/],
  ["dusk", /\b(nuclear|fallout|bunker|apocalypse|doomsday|zombie|shelter|end of the world)\b/],
];
export function moodFor(layout) {
  if (layout?.world?.mood && MOODS[layout.world.mood]) return layout.world.mood;
  if (layout?.world?.backdrop) return "noon";
  const text = `${layout?.title ?? ""} ${String(layout?.key ?? "").replace(/_/g, " ")}`.toLowerCase();
  return (RULES.find(([, re]) => re.test(text)) ?? ["noon"])[0];
}
