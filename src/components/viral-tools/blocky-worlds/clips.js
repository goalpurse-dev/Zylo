// The maker's preview clips: moments from our own Blender renders (the In This Town engine, 2026-11: the sneeze plane,
// Milo, the coin tower) where the scene reads in the tall frame (wide / medium shots, faces, signs; never the back of
// a head or a body filling the frame; owner 2026-11-20), cut into public/in-this-town/maker (5.2-6.25 s each; the
// public page and onboarding keep their own loops in public/in-this-town/clips). The renders carry their own burned-in
// captions near the bottom: the Clip player zooms in from the top (CROP) so they stay out of the picture under the
// live captions.
import { useState } from "react";

export const CLIPS = [
  { key: "town", word: "In this town…" },
  { key: "everyone", word: "everyone" },
  { key: "dark", word: "after dark" },
  { key: "except", word: "except me" },
];
export const clipSrc = (key) => `/in-this-town/maker/${key}.mp4`;
export const clipPoster = (key) => `/in-this-town/maker/${key}.webp`;
/** zoom from the top: the bottom ~20 % (the clips' own captions) leaves the frame */
export const CLIP_CROP = "origin-top scale-[1.24]";

export function useReducedMotion() {
  const [still] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  return still;
}
