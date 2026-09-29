// deno-lint-ignore-file no-explicit-any
// stickman/textPlacement.ts — the ONE way a scene's on-screen text becomes an
// editable layer (render worker, the free text edit, batch re-texting): the
// style from the text contract (or from the words), one cheap look at the
// picture for faces (+ the CALLOUT's object), then the code-drawn layer at
// 1920x1080. A spot that would cover a face is never used: `blocked` says the
// scene keeps no text.
import { overlayText, scaleLayer, autoStyle, type OverlayLayer, type TextStyle } from "./textOverlay.ts";
import { placementLook } from "./headlines.ts";

export type PlacedText = { layer: OverlayLayer | null; blocked: boolean; style: TextStyle; costUsd: number; look: { faces: number[][]; target: number[] | null } | null };

export async function placeTextLayer(opts: { bytes: Uint8Array; imageUrl: string; text: string; intent?: any; font: Uint8Array; openaiKey?: string; look?: boolean }): Promise<PlacedText> {
  const text = String(opts.text ?? "").trim();
  const intent = opts.intent ?? {};
  // The contract's style only applies to its own words (a user edit is re-styled from its words).
  const sameWords = intent.text && String(intent.text).trim().toUpperCase() === text.toUpperCase();
  const style: TextStyle = sameWords && intent.style ? intent.style : autoStyle(text);
  // Faces come from the free code finder (inside overlayText); the paid look
  // (~$0.0005) is only for a CALLOUT's object — a vision model's face boxes
  // were unreliable (f90160bc: 0 found on scenes where the text covered a head).
  const look = opts.openaiKey && opts.look !== false && style === "CALLOUT" && intent.callout ? await placementLook(opts.openaiKey, opts.imageUrl, intent.callout) : null;
  const o = await overlayText(opts.bytes, text, { font: opts.font, style, targetFrac: look?.target ?? null });
  const layer = scaleLayer(o.layer, 1920 / Math.max(1, o.frame.width));
  return { layer: o.blocked ? null : layer, blocked: !!o.blocked, style: (o.layer.style ?? "HEADLINE") as TextStyle, costUsd: look?.costUsd ?? 0, look: look ? { faces: look.faces, target: look.target } : null };
}
