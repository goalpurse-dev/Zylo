// The page clips (public/blocky-worlds/clips, rendered from the locked look by scripts/blockyWorlds/look/clips.mjs),
// the caption word each card shows, and the less-motion switch the animated parts share.
import { useState } from "react";

export const CLIPS = [
  { key: "street", word: "In this town…" },
  { key: "folk", word: "everyone" },
  { key: "night", word: "after dark" },
  { key: "above", word: "except me" },
];
export const clipSrc = (key) => `/blocky-worlds/clips/${key}.mp4`;
export const clipPoster = (key) => `/blocky-worlds/clips/${key}.jpg`;

export function useReducedMotion() {
  const [still] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  return still;
}
