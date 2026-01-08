import { supabase } from "./supabaseClient";

/** Types this helper accepts */
export type PromptKind = "image" | "video";

/** Heuristic: does the user ask for on-screen text? */
function wantsOnscreenText(t: string): boolean {
  const s = t.toLowerCase();
  return /\b(text|title|titles|caption|captions|subtitle|subtitles|on[-\s]?screen|overlay|logo|watermark)\b/.test(s);
}

/** Tiny utility to keep punctuation tidy */
const tidy = (s: string) =>
  s.replace(/\s+/g, " ").replace(/\s+([.,;:!?)])/g, "$1").trim();

/** Local fallback polish for IMAGE prompts */
function localPolishImage(t: string): string {
  const tag = "clean composition, sharp focus, high detail, cinematic lighting";
  const already = /\bsharp focus\b|\bhigh detail\b/i.test(t);
  return tidy(already ? t : `${t}, ${tag}`);
}

/** Local fallback polish for VIDEO prompts */
function localPolishVideo(raw: string): string {
  const textOK = wantsOnscreenText(raw);
  const negatives = textOK
    ? "no watermark, no logos (unless specified), avoid flicker, avoid severe motion blur"
    : "no on-screen text, no subtitles, no captions, no watermarks, no logos, avoid flicker, avoid severe motion blur";

  // Short, model-friendly shape that Runware handles well
  const blocks = [
    raw.trim(),
    "cinematic lighting, high detail, natural colors",
    "smooth motion, temporal consistency, stable faces and limbs",
    "clear subject framing, readable action, minimal camera shake",
    `avoid: ${negatives}`,
  ];

  return tidy(blocks.filter(Boolean).join(", "));
}

/**
 * Prompt enhancer for both Image and Video.
 * - Calls your edge function `prompt-enhancer` if available
 * - Passes `kind: 'image' | 'video'`
 * - Falls back to a strong local polish per kind
 *
 * Backwards compatible: calling with just `raw` still works and assumes "image".
 */
export async function enhancePrompt(raw: string, kind: PromptKind = "image"): Promise<string> {
  const text = (raw ?? "").toString().trim();
  if (!text) return "";

  const local = kind === "video" ? localPolishVideo : localPolishImage;

  try {
    // If functions API isn’t available, use local fallback
    if (!supabase?.functions?.invoke) return local(text);

    const { data, error } = await supabase.functions.invoke("prompt-enhancer", {
      body: { prompt: text, kind }, // pass the kind to your function
    });

    // If the function errors or doesn’t yet support 'video', fall back locally
    if (error || !data?.prompt) return local(text);

    const improved = (data.prompt ?? "").toString().trim();
    // If user did NOT want text, reinforce the constraint once more (just in case)
    if (kind === "video" && !wantsOnscreenText(text)) {
      const hasNoText = /\bno on[-\s]?screen text\b|\bno subtitles\b|\bno captions\b/i.test(improved);
      return hasNoText ? improved : tidy(`${improved}, avoid: no on-screen text, no subtitles, no captions`);
    }
    return improved || text;
  } catch {
    return local(text);
  }
}
