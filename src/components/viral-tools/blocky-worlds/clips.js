// The page clips: our own Blender renders (the In This Town engine, 2026-11: Milo, the coin tower, the plane; the
// same 6 s loops as the public page, public/in-this-town/clips), the caption word each card shows, and the less-motion
// switch the animated parts share. The loops carry their own burned-in captions near the bottom: the Clip player zooms
// in from the top (CROP) so they stay out of the picture under the live captions. (The old board-look clips in
// public/blocky-worlds/clips are no longer shown.)
import { useState } from "react";

export const CLIPS = [
  { key: "milo-a", word: "In this town…" },
  { key: "tower-b", word: "everyone" },
  { key: "plane-a", word: "after dark" },
  { key: "milo-c", word: "except me" },
];
export const clipSrc = (key) => `/in-this-town/clips/${key}.mp4`;
export const clipPoster = (key) => `/in-this-town/clips/${key}.webp`;
/** zoom from the top: the bottom ~20 % (the clips' own captions) leaves the frame */
export const CLIP_CROP = "origin-top scale-[1.24]";

export function useReducedMotion() {
  const [still] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  return still;
}
