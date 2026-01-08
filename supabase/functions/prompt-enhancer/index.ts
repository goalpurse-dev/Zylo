// src/lib/promptEnhancer.ts
import { supabase } from "./supabaseClient";

/** Single-purpose enhancer for Text→Image. Always returns a string. */
export async function enhancePrompt(raw: string): Promise<string> {
  const text = (raw ?? "").toString().trim();
  if (!text) return "";

  // Small local fallback so it still does *something* without the function
  const localPolish = (t: string) =>
    t.includes("sharp focus") || t.includes("high detail")
      ? t
      : `${t}, clean composition, sharp focus, high detail, cinematic lighting`;

  try {
    if (!supabase?.functions?.invoke) return localPolish(text);

    const { data, error } = await supabase.functions.invoke("prompt-enhancer", {
      body: { prompt: text, kind: "image" }, // we only use image now
    });

    if (error) return localPolish(text);

    const improved = (data?.prompt ?? "").toString().trim();
    return improved || text;
  } catch {
    return localPolish(text);
  }
}
