// cooking-script-captions/index.ts
// AI watches the actual scene images from the generated video, then writes a
// second-by-second voiceover script grounded in what's literally on screen.
// POST { dish, durationSec, scenes: [{index, imageUrl}], clips: [{index, videoUrl}] }
// Returns { script, segments: [{text, start, end}], words: [{word, start, end}] }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY")!;

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "content-type": "application/json",
};

// 5 clips × 2 scenes each — the image pairs that were animated into clips
const CLIP_PAIRS  = [[0, 1], [2, 3], [4, 5], [6, 7], [8, 9]];
const SCENE_LABELS = [
  "Final Dish Reveal",  // 0
  "Raw Ingredient",     // 1
  "Prep & Season",      // 2
  "Coating Action",     // 3
  "Into the Oil",       // 4
  "Overhead Fry",       // 5
  "Wok Toss",           // 6
  "Beauty Plate",       // 7
  "Chef Presents",      // 8
  "Hero Close-Up",      // 9
];

type SceneCtx = { index?: number; imageUrl?: string | null };
type ClipCtx  = { index?: number; videoUrl?: string | null };
type ClipPrompt = { index: number; prompt: string };

// ~190 WPM — matches the fast-paced TTS delivery
const WORDS_PER_SECOND = 3.2;

function estimateWordTimings(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.map((word, i) => ({
    word,
    start: parseFloat((i / WORDS_PER_SECOND).toFixed(2)),
    end:   parseFloat(((i + 1) / WORDS_PER_SECOND).toFixed(2)),
  }));
}

function buildSegments(words: { word: string; start: number; end: number }[], size = 5) {
  const out: { text: string; start: number; end: number }[] = [];
  for (let i = 0; i < words.length; i += size) {
    const chunk = words.slice(i, i + size);
    out.push({ text: chunk.map(w => w.word).join(" "), start: chunk[0].start, end: chunk[chunk.length - 1].end });
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST")   return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: CORS });

  let body: { dish?: string; durationSec?: number; scenes?: SceneCtx[]; clips?: ClipCtx[]; clipPrompts?: ClipPrompt[] } = {};
  try { body = await req.json(); } catch {}

  const dish        = String(body.dish ?? "crispy chicken").slice(0, 80);
  const durationSec = Number(body.durationSec ?? 30);
  const targetWords = Math.round(durationSec * WORDS_PER_SECOND);
  const scenes      = Array.isArray(body.scenes) ? body.scenes : [];
  const clipPrompts = Array.isArray(body.clipPrompts) ? body.clipPrompts : [];

  // Collect image URLs in scene order — only include frames that exist
  const imagesByIndex = new Map<number, string>();
  for (const s of scenes) {
    const idx = Number(s.index ?? -1);
    if (idx >= 0 && s.imageUrl) imagesByIndex.set(idx, s.imageUrl);
  }
  const hasImages = imagesByIndex.size > 0;

  // Build the vision message content — text brief + one image per scene
  type ContentPart =
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail: "low" } };

  const userContent: ContentPart[] = [];

  // Opening instructions
  userContent.push({
    type: "text",
    text: [
      `You are writing a viral TikTok cooking voiceover for "${dish}".`,
      `The video is ${durationSec} seconds — five 6-second clips played back-to-back.`,
      hasImages
        ? `Below are the ${imagesByIndex.size} scene frames in order. Each pair of frames = one 6-second clip.`
        : `Write based on the dish name and clip descriptions below.`,
      ``,
      `CLIP TIMELINE:`,
      ...CLIP_PAIRS.map(([a, b], i) =>
        `• Clip ${i + 1} (${i * 6}s–${(i + 1) * 6}s): ${SCENE_LABELS[a] ?? "shot"} → ${SCENE_LABELS[b] ?? "shot"}`
      ),
      ``,
      `TASK: Write a single continuous voiceover script (~${targetWords} words).`,
      `RULES:`,
      `• Hook on the very first word — no slow openers, no "Tonight we're making"`,
      `• One punchy line or two short fragments per clip, timed to what you see`,
      `• Describe the ACTUAL visuals on screen — name the real colors, textures, actions`,
      `• Fast-paced fragments over full sentences. Sensory words: sizzle, crispy, golden, steam`,
      `• End with a sharp CTA: "Save this." / "Follow for more." / "Make it tonight."`,
      `• Output ONLY the voiceover text — no labels, no clip numbers, no quotes`,
      ...(clipPrompts.length > 0 ? [
        ``,
        `VIDEO DIRECTION (what the camera/animation does in each clip):`,
        ...clipPrompts.slice(0, 5).map(cp =>
          `Clip ${cp.index + 1}: ${String(cp.prompt).slice(0, 300)}`
        ),
      ] : []),
    ].join("\n"),
  });

  // Inject scene images if available — "low" detail keeps token cost low (~85 tokens each)
  if (hasImages) {
    for (let sceneIdx = 0; sceneIdx < 10; sceneIdx++) {
      const url = imagesByIndex.get(sceneIdx);
      if (!url) continue;
      const clipNum = Math.floor(sceneIdx / 2) + 1;
      const position = sceneIdx % 2 === 0 ? "opening frame" : "closing frame";
      userContent.push({ type: "text", text: `Clip ${clipNum} ${position} — ${SCENE_LABELS[sceneIdx]}:` });
      userContent.push({ type: "image_url", image_url: { url, detail: "low" } });
    }
    userContent.push({ type: "text", text: "Write the voiceover now:" });
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      // gpt-4o for vision (sees the actual frames) — falls back gracefully if no images
      model: hasImages ? "gpt-4o" : "gpt-4o-mini",
      messages: [{ role: "user", content: hasImages ? userContent : userContent[0].text }],
      max_tokens: 250,
      temperature: 0.8,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[cooking-captions] OpenAI error:", res.status, text.slice(0, 300));
    return new Response(JSON.stringify({ error: "Script generation failed" }), { status: 502, headers: CORS });
  }

  const json   = await res.json();
  const script = String(json.choices?.[0]?.message?.content ?? "").trim();

  if (!script) {
    return new Response(JSON.stringify({ error: "Empty script returned" }), { status: 500, headers: CORS });
  }

  const words    = estimateWordTimings(script);
  const segments = buildSegments(words, 5);

  return new Response(JSON.stringify({ script, words, segments }), { status: 200, headers: CORS });
});
