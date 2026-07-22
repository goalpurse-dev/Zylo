// cooking-script-captions/index.ts
// AI watches the actual scene images from the generated video, then writes a
// second-by-second voiceover script grounded in what's literally on screen.
// POST { dish, durationSec, scenes: [{index, imageUrl}], clips: [{index, videoUrl}] }
// Returns { script, segments: [{text, start, end}], words: [{word, start, end}] }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "content-type": "application/json",
};

// 5 clips × 2 scenes each — the image pairs that were animated into clips
const CLIP_PAIRS  = [[0, 1], [2, 3], [4, 5], [6, 7], [8, 9]];
const SCENE_LABELS = [
  "Chef Dish Preview",
  "Ingredients Ready",
  "Prep & Slice",
  "Add to Bowl",
  "Season & Mix",
  "Start Cooking",
  "Cook Through",
  "Finish & Plate",
  "Chef Presents",
  "Matching Dish Close-Up",
];

type SceneCtx = { index?: number; imageUrl?: string | null };
type ClipCtx  = { index?: number; videoUrl?: string | null };
type ClipPrompt = { index: number; prompt: string };
type ClipFrame = { clip?: number; beat?: number; timeSec?: number; imageUrl?: string | null };
type ScriptBeat = { beat: number; text: string };
type ScriptClip = { clip: number; beats: ScriptBeat[] };

const CLIP_COUNT = 5;
const BEATS_PER_CLIP = 3;
const WORDS_PER_SECOND = 2.85;

function cleanBeatText(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/^[\s\-\u2022\d.)]+/, "")
    .trim();
}

function fallbackScriptBeats(dish: string): ScriptClip[] {
  return [
    { clip: 1, beats: [
      { beat: 1, text: `Here's how to make ${dish}.` },
      { beat: 2, text: "Set that finished plate aside." },
      { beat: 3, text: "Get every ingredient measured and ready." },
    ] },
    { clip: 2, beats: [
      { beat: 1, text: "Carefully prep the main ingredients." },
      { beat: 2, text: "Set the knife down safely." },
      { beat: 3, text: "Now transfer everything into the bowl." },
    ] },
    { clip: 3, beats: [
      { beat: 1, text: "Add the seasoning in a steady stream." },
      { beat: 2, text: "Fold until every piece is evenly coated." },
      { beat: 3, text: "Tip the mixture into the cooking vessel." },
    ] },
    { clip: 4, beats: [
      { beat: 1, text: "Cook it through, turning every piece evenly." },
      { beat: 2, text: "Let the surfaces brown naturally." },
      { beat: 3, text: "Plate it and add the final finish." },
    ] },
    { clip: 5, beats: [
      { beat: 1, text: "Bring back that same finished dish." },
      { beat: 2, text: "Set it down gently." },
      { beat: 3, text: "Save this recipe and try it tonight." },
    ] },
  ];
}

function normalizeScriptClips(value: unknown, dish: string): ScriptClip[] {
  if (!Array.isArray(value)) return [];
  const byClip = new Map<number, ScriptClip>();
  for (const rawClip of value) {
    const item = rawClip as { clip?: unknown; beats?: unknown };
    const clip = Number(item?.clip);
    if (!Number.isInteger(clip) || clip < 1 || clip > CLIP_COUNT || !Array.isArray(item.beats)) continue;
    const byBeat = new Map<number, ScriptBeat>();
    for (const rawBeat of item.beats) {
      const beatItem = rawBeat as { beat?: unknown; text?: unknown };
      const beat = Number(beatItem?.beat);
      const text = cleanBeatText(beatItem?.text);
      if (Number.isInteger(beat) && beat >= 1 && beat <= BEATS_PER_CLIP && text) {
        byBeat.set(beat, { beat, text });
      }
    }
    const beats = Array.from({ length: BEATS_PER_CLIP }, (_, index) => byBeat.get(index + 1)).filter(Boolean) as ScriptBeat[];
    if (beats.length === BEATS_PER_CLIP) byClip.set(clip, { clip, beats });
  }

  const clips = Array.from({ length: CLIP_COUNT }, (_, index) => byClip.get(index + 1)).filter(Boolean) as ScriptClip[];
  if (clips.length !== CLIP_COUNT) return [];

  const requiredOpening = `Here's how to make ${dish}.`;
  const firstText = clips[0].beats[0].text;
  if (!firstText.toLocaleLowerCase().startsWith(requiredOpening.toLocaleLowerCase())) {
    clips[0].beats[0].text = requiredOpening;
  }

  const pacingIsSafe = clips.every((clip, clipIndex) => {
    const beatCounts = clip.beats.map(beat => beat.text.split(/\s+/).filter(Boolean).length);
    const clipWords = beatCounts.reduce((sum, count) => sum + count, 0);
    return clipWords >= 14
      && clipWords <= 21
      && beatCounts.every((count, beatIndex) => count >= 3 && count <= (clipIndex === 0 && beatIndex === 0 ? 12 : 9));
  });
  if (!pacingIsSafe) return [];
  return clips;
}

function buildBeatAlignedTimings(scriptClips: ScriptClip[], durationSec: number, captionSize = 4) {
  const clipDuration = durationSec / CLIP_COUNT;
  const beatDuration = clipDuration / BEATS_PER_CLIP;
  const words: { word: string; start: number; end: number; clip: number; beat: number }[] = [];
  const segments: { text: string; start: number; end: number }[] = [];
  const clipSegments: { clip: number; text: string; start: number; end: number }[] = [];
  const beatSegments: { clip: number; beat: number; text: string; start: number; end: number }[] = [];

  scriptClips.forEach((scriptClip, clipIndex) => {
    const clipStart = clipIndex * clipDuration;
    const clipEnd = (clipIndex + 1) * clipDuration;
    const clipText = scriptClip.beats.map(item => item.text).join(" ");
    clipSegments.push({ clip: clipIndex + 1, text: clipText, start: clipStart, end: clipEnd });

    scriptClip.beats.forEach((scriptBeat, beatIndex) => {
      const tokens = scriptBeat.text.split(/\s+/).filter(Boolean);
      const beatStart = clipStart + beatIndex * beatDuration;
      const beatEnd = clipStart + (beatIndex + 1) * beatDuration;
      const spokenStart = beatStart + 0.06;
      const spokenEnd = beatEnd - 0.06;
      const secondsPerWord = (spokenEnd - spokenStart) / Math.max(tokens.length, 1);
      const beatWords = tokens.map((word, wordIndex) => ({
        word,
        start: Number((spokenStart + wordIndex * secondsPerWord).toFixed(2)),
        end: Number((spokenStart + (wordIndex + 1) * secondsPerWord).toFixed(2)),
        clip: clipIndex + 1,
        beat: beatIndex + 1,
      }));
      words.push(...beatWords);
      beatSegments.push({
        clip: clipIndex + 1,
        beat: beatIndex + 1,
        text: scriptBeat.text,
        start: Number(beatStart.toFixed(2)),
        end: Number(beatEnd.toFixed(2)),
      });

      // Caption cards never cross a visual beat boundary.
      for (let i = 0; i < beatWords.length; i += captionSize) {
        const chunk = beatWords.slice(i, i + captionSize);
        segments.push({
          text: chunk.map(item => item.word).join(" "),
          start: chunk[0].start,
          end: chunk[chunk.length - 1].end,
        });
      }
    });
  });

  return { words, segments, clipSegments, beatSegments };
}

function isMissingRpc(error: { code?: string; message?: string } | null | undefined) {
  const code = String(error?.code ?? "");
  const message = String(error?.message ?? "");
  return code === "42883" || code === "PGRST202" || /could not find the function|does not exist/i.test(message);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST")   return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: CORS });

  let body: { generationId?: string; dish?: string; durationSec?: number; scenes?: SceneCtx[]; clips?: ClipCtx[]; clipPrompts?: ClipPrompt[]; clipFrames?: ClipFrame[] } = {};
  try { body = await req.json(); } catch {}

  const generationId = String(body.generationId ?? "").trim();
  if (!generationId) return new Response(JSON.stringify({ error: "Missing generationId" }), { status: 400, headers: CORS });
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: req.headers.get("authorization") ?? "" } },
    auth: { persistSession: false },
  });
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { error: reserveError } = await supabase.rpc("reserve_cooking_service_request", {
    p_generation_id: generationId,
    p_kind: "script",
  });
  let reservationMade = !reserveError;
  if (reserveError && isMissingRpc(reserveError)) {
    // Safe rolling-deploy fallback: RLS still proves that the signed-in user
    // owns this creation while the request-counter migration catches up.
    const { data: ownedGeneration, error: ownershipError } = await supabase
      .from("cooking_matic_generations")
      .select("id")
      .eq("id", generationId)
      .maybeSingle();
    if (ownershipError || !ownedGeneration) {
      return new Response(JSON.stringify({ error: "Creation access denied" }), { status: 403, headers: CORS });
    }
    reservationMade = false;
    console.warn("[cooking-captions] service request RPC missing; continuing after RLS ownership check");
  } else if (reserveError) {
    const limited = String(reserveError.message ?? "").includes("SERVICE_LIMIT_REACHED");
    return new Response(JSON.stringify({ error: limited ? "Script regeneration limit reached for this creation" : "Creation access denied" }), { status: limited ? 429 : 403, headers: CORS });
  }

  const dish        = String(body.dish ?? "crispy chicken").slice(0, 80);
  // Cooking Matic always renders five six-second clips. Keeping this fixed is
  // important: a script requested while the last clip is still loading must
  // not collapse all five lines into a partial duration.
  const durationSec = 30;
  const targetWords = Math.round(durationSec * WORDS_PER_SECOND);
  const scenes      = Array.isArray(body.scenes) ? body.scenes : [];
  const clipPrompts = Array.isArray(body.clipPrompts) ? body.clipPrompts : [];
  const clipFrames = (Array.isArray(body.clipFrames) ? body.clipFrames : [])
    .filter(frame => {
      const clip = Number(frame?.clip);
      const beat = Number(frame?.beat);
      return clip >= 1 && clip <= CLIP_COUNT
        && beat >= 1 && beat <= BEATS_PER_CLIP
        && typeof frame?.imageUrl === "string"
        && frame.imageUrl.startsWith("data:image/");
    })
    .sort((a, b) => Number(a.clip) - Number(b.clip) || Number(a.beat) - Number(b.beat))
    .slice(0, CLIP_COUNT * BEATS_PER_CLIP);

  // Collect image URLs in scene order — only include frames that exist
  const imagesByIndex = new Map<number, string>();
  for (const s of scenes) {
    const idx = Number(s.index ?? -1);
    if (idx >= 0 && s.imageUrl) imagesByIndex.set(idx, s.imageUrl);
  }
  const hasRenderedFrames = clipFrames.length === CLIP_COUNT * BEATS_PER_CLIP;
  const hasImages = hasRenderedFrames || imagesByIndex.size > 0;

  // Build the vision message content — text brief + one image per scene
  type ContentPart =
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail: "low" } };

  const userContent: ContentPart[] = [];

  // Opening instructions
  userContent.push({
    type: "text",
    text: [
      `You are a viral chef teaching viewers how to make "${dish}" at home.`,
      `The video is ${durationSec} seconds — five 6-second clips played back-to-back.`,
      hasRenderedFrames
        ? `Below are ${clipFrames.length} frames sampled from the actual rendered videos at the midpoint of their two-second speech beats.`
        : hasImages
        ? `Below are the ${imagesByIndex.size} scene frames in order. Each pair of frames = one 6-second clip.`
        : `Write based on the dish name and clip descriptions below.`,
      ``,
      `CLIP TIMELINE:`,
      ...CLIP_PAIRS.map(([a, b], i) =>
        `• Clip ${i + 1} (${i * 6}s–${(i + 1) * 6}s): ${SCENE_LABELS[a] ?? "shot"} → ${SCENE_LABELS[b] ?? "shot"}`
      ),
      ``,
      `TASK: Write exactly five clip scripts. Split every clip into exactly three spoken beats matching 0-2s, 2-4s and 4-6s, totaling about ${targetWords} words. It must sound like a chef actively teaching the viewer, not an announcer describing food footage.`,
      `RULES:`,
      `• Every beat is spoken only inside its own two-second window; use 4-7 concise spoken words per beat (the opening dish phrase may be longer)`,
      `• Each clip must contain 16-20 spoken words total so narration continues naturally across the full six-second window`,
      `• A beat may ONLY mention the action visible during that exact part of the clip. Never announce an action before it begins`,
      `• Clip 1 is the finished-dish hook followed by the ingredient setup`,
      `• Clip 2 must teach the visible prep and the transfer into the bowl; do not claim mixing or cooking yet`,
      `• Clip 3 must teach the visible seasoning/mixing and transfer into the cooking vessel`,
      `• Clip 4 must teach the visible cooking and finish/assembly; mention toppings only if they are visible`,
      `• Clip 5 is the matching finished-dish payoff and may end with one short save/follow CTA`,
      `• Visual timing overrides general recipe knowledge. If an oven, pan, grill, bowl, ingredient or action is not visible in that clip, do not mention it in that clip`,
      `CHEF TUTORIAL STYLE: Clip 1 beat 1 must begin exactly with "Here's how to make ${dish}." Then give direct instructions in exact on-screen order.`,
      `Use practical words such as first, then, add, mix, cook and finish with. Include a useful time or temperature only when standard for ${dish}.`,
      `Never narrate the camera, colors, steam, beauty shot, chef pose, presentation or transitions. Never jump between frying, baking, grilling and wok cooking.`,
      `Do not use empty hype such as "flavor explosion," "golden perfection," "watch it sizzle," or adjective-only fragments. Use complete conversational sentences.`,
      `Only the last short sentence may be a CTA, for example: "Save this recipe and try it tonight."`,
      `Return JSON only. Every clip object must contain clip 1-5 and exactly three beat objects numbered 1-3 in chronological order.`,
      ...(clipPrompts.length > 0 ? [
        ``,
        `TIMED ACTION SOURCE OF TRUTH (the prompt's 0-2s, 2-4s and 4-6s actions map directly to beats 1, 2 and 3; do not narrate camera direction):`,
        ...clipPrompts.slice(0, 5).map(cp =>
          `Clip ${cp.index + 1}: ${String(cp.prompt).slice(0, 1500)}`
        ),
      ] : []),
    ].join("\n"),
  });

  // Actual 1s/3s/5s samples win over planned scene endpoints. This grounds
  // every phrase in the motion the provider really rendered, including any
  // harmless variation from the requested animation.
  if (hasImages) {
    if (hasRenderedFrames) {
      for (const frame of clipFrames) {
        userContent.push({
          type: "text",
          text: `ACTUAL RENDER — clip ${frame.clip}, beat ${frame.beat}, about ${Number(frame.timeSec).toFixed(1)}s into clip:`,
        });
        userContent.push({ type: "image_url", image_url: { url: String(frame.imageUrl), detail: "low" } });
      }
    } else {
      for (let sceneIdx = 0; sceneIdx < 10; sceneIdx++) {
        const url = imagesByIndex.get(sceneIdx);
        if (!url) continue;
        const clipNum = Math.floor(sceneIdx / 2) + 1;
        const position = sceneIdx % 2 === 0 ? "opening frame" : "closing frame";
        userContent.push({ type: "text", text: `Clip ${clipNum} ${position} — ${SCENE_LABELS[sceneIdx]}:` });
        userContent.push({ type: "image_url", image_url: { url, detail: "low" } });
      }
    }
    userContent.push({ type: "text", text: "Return the five clips with three precisely timed speech beats per clip now:" });
  }

  const makeScriptResponse = (scriptClips: ScriptClip[], fallback = false) => {
    const script = scriptClips
      .map(clip => clip.beats.map(beat => beat.text).join(" "))
      .join("\n");
    const timing = buildBeatAlignedTimings(scriptClips, durationSec);
    return new Response(JSON.stringify({
      script,
      ...timing,
      timingVersion: 3,
      timingSource: "cooking-clip-beat-plan",
      fallback,
    }), { status: 200, headers: CORS });
  };

  const releaseReservation = async () => {
    if (!reservationMade) return;
    await admin.rpc("release_cooking_service_request", { p_generation_id: generationId, p_kind: "script" });
  };

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
      // gpt-4o for vision (sees the actual frames) — falls back gracefully if no images
      model: hasImages ? "gpt-4o" : "gpt-4o-mini",
      messages: [{ role: "user", content: hasImages ? userContent : userContent[0].text }],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "clip_aligned_cooking_voiceover",
          strict: true,
          schema: {
            type: "object",
            properties: {
              clips: {
                type: "array",
                minItems: 5,
                maxItems: 5,
                items: {
                  type: "object",
                  properties: {
                    clip: { type: "integer" },
                    beats: {
                      type: "array",
                      minItems: 3,
                      maxItems: 3,
                      items: {
                        type: "object",
                        properties: {
                          beat: { type: "integer" },
                          text: { type: "string" },
                        },
                        required: ["beat", "text"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["clip", "beats"],
                  additionalProperties: false,
                },
              },
            },
            required: ["clips"],
            additionalProperties: false,
          },
        },
      },
      max_tokens: 650,
      temperature: 0.35,
      }),
    });
  } catch (error) {
    await releaseReservation();
    console.error("[cooking-captions] OpenAI request failed:", error);
    return makeScriptResponse(fallbackScriptBeats(dish), true);
  }

  if (!res.ok) {
    await releaseReservation();
    const text = await res.text().catch(() => "");
    console.error("[cooking-captions] OpenAI error:", res.status, text.slice(0, 300));
    return makeScriptResponse(fallbackScriptBeats(dish), true);
  }

  const json = await res.json();
  const content = String(json.choices?.[0]?.message?.content ?? "").trim();
  let scriptClips: ScriptClip[] = [];
  try {
    const parsed = JSON.parse(content);
    scriptClips = normalizeScriptClips(parsed?.clips, dish);
  } catch (error) {
    console.error("[cooking-captions] invalid structured response:", error, content.slice(0, 300));
  }

  if (scriptClips.length !== CLIP_COUNT) {
    await releaseReservation();
    console.error("[cooking-captions] incomplete clip/beat response:", content.slice(0, 300));
    return makeScriptResponse(fallbackScriptBeats(dish), true);
  }

  return makeScriptResponse(scriptClips);
});
