// ─────────────────────────────────────────────────────────────────────────────
// scriptPrompt.js
// Full OpenAI prompt system for viral script generation.
//
// USAGE:
//   import { buildOpenAIRequest } from "./scriptPrompt";
//   const body = buildOpenAIRequest(form, stylePreset);
//   const res  = await fetch("https://api.openai.com/v1/chat/completions", {
//     method: "POST",
//     headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY}` },
//     body: JSON.stringify(body),
//   });
//   const { choices } = await res.json();
//   const script = JSON.parse(choices[0].message.content);
// ─────────────────────────────────────────────────────────────────────────────

// ─── Style-specific creative briefs ──────────────────────────────────────────

// ─── Skeleton-specific system prompt ─────────────────────────────────────────

const SKELETON_SYSTEM_PROMPT = `You are a professional prompt engineer specialising in cinematic 3D skeleton character scenes.

Convert the user's idea into exactly:
- 1 main cinematic scene (stored in "hook")
- 5 b-roll prompts (stored in "scenes" array, indices 0-4)

VISUAL CONSISTENCY RULES:
- The skeleton character must stay consistent: clean cinematic 3D render, highly detailed, studio-quality lighting
- Every prompt MUST start with "Place the skeleton character..."
- Include: environment/setting, action/pose, lighting style, camera angle, atmosphere
- Keep prompts short, visual, specific — no fluff, no abstract language

CINEMATIC BOOST (always include at least 2 per prompt):
depth of field, motion blur, volumetric lighting, environmental particles, reflections/shadows

Return valid JSON only. No markdown, no preamble. Start with { end with }.

JSON schema (return exactly this):
{"meta":{"type":"Visual Prompts","platform":"TikTok / Reels","duration":"varies","style":"Cinematic 3D","tone":"Dramatic","audience":"Visual creators","preset":"Viral Skeleton","presetIcon":"💀"},"hook":{"label":"MAIN SCENE","duration":"hero shot","text":"[2-4 word scene title with emoji]","imagePrompt":"Place the skeleton character [full cinematic image prompt — Midjourney/DALL-E 3 quality, 9:16 vertical, subject+action+lighting+camera+atmosphere]","videoPrompt":"Place the skeleton character [full cinematic video prompt — Runway/Kling quality, duration in seconds, camera motion, action, audio direction]"},"alternateHooks":[],"scenes":[{"label":"B-ROLL 1","title":"[2-4 word title with emoji]","duration":"b-roll","text":"[scene description]","imagePrompt":"Place the skeleton character [image prompt]","videoPrompt":"Place the skeleton character [video prompt]"},{"label":"B-ROLL 2","title":"[2-4 word title with emoji]","duration":"b-roll","text":"[scene description]","imagePrompt":"Place the skeleton character [image prompt]","videoPrompt":"Place the skeleton character [video prompt]"},{"label":"B-ROLL 3","title":"[2-4 word title with emoji]","duration":"b-roll","text":"[scene description]","imagePrompt":"Place the skeleton character [image prompt]","videoPrompt":"Place the skeleton character [video prompt]"},{"label":"B-ROLL 4","title":"[2-4 word title with emoji]","duration":"b-roll","text":"[scene description]","imagePrompt":"Place the skeleton character [image prompt]","videoPrompt":"Place the skeleton character [video prompt]"},{"label":"B-ROLL 5","title":"[2-4 word title with emoji]","duration":"b-roll","text":"[scene description]","imagePrompt":"Place the skeleton character [image prompt]","videoPrompt":"Place the skeleton character [video prompt]"}],"cta":null}`;

const SKELETON_LOADING_PHASES = [
  "Analysing your concept…",
  "Building the main scene…",
  "Generating b-roll prompts…",
  "Perfecting cinematic details…",
  "Final render pass…",
];

export { SKELETON_LOADING_PHASES };

// ─── Style-specific creative briefs ──────────────────────────────────────────

const STYLE_BRIEFS = {
  mrbeast: `STYLE: MrBeast. Insane premise, escalating stakes, specific numbers ($47,231 not "a lot"), short punchy sentences, every scene raises energy. End on cliffhanger. Vocabulary: "insane","crazy","actually". Fast pacing.`,
  tiktok: `STYLE: TikTok Viral. Hook in first 2 words. Pattern interrupt every 8-12s. Value front-loaded. Sound-off friendly. No "So today I'm going to...". Casual, edgy, relatable. Breakneck pacing.`,
  finance: `STYLE: Finance Educator. Open with alarming stat. Specific numbers + real examples. Break complex ideas with vivid analogies. One actionable insight. Concrete next step in CTA. Authoritative but accessible.`,
  storytelling: `STYLE: Story Arc. 3-act: setup → conflict → transformation. Specific sensory details over vague emotion ("staring at my bank at 2am, savings at $0"). Dark night before breakthrough. Callbacks. Ending reframes opening.`,
  comedy: `STYLE: Comedy Skit. Rule of threes (subvert on 3rd). Punchline is the last word. Relatable situations exaggerated to extreme. Callbacks. Build → build → hit. Fast setup, sudden punchline.`,
  product: `STYLE: Product Drop. Lead with transformation (after-state first). Specific social proof. Before/after contrast. Address main objection mid-script. Real urgency. CTA feels like a favor to them.`,
  tutorial: `STYLE: Tutorial Pro. State end result in sentence 1. Numbered steps. "Here's what most people get wrong". Anticipate next question. Micro-wins per step. One clear next action at end.`,
  custom: `STYLE: Custom. Use your full viral scriptwriting expertise — hook engineering, retention mechanics, psychological triggers, platform-native patterns. Optimise for the given platform and audience.`,
};

// ─── Master system prompt ────────────────────────────────────────────────────

const MASTER_SYSTEM_PROMPT = `You are an elite viral scriptwriter. Rules:
1. Hook grips in the FIRST TWO WORDS — no filler, no "In this video...".
2. Every word earns its place. Emotion before information.
3. Platform context is law — TikTok ≠ YouTube Long.
4. Image prompts: Midjourney v6/DALL-E 3 quality — subject, action, lighting, mood, camera angle, 9:16 vertical.
5. Video prompts: Runway/Kling quality — duration in seconds, camera motion, subject action, audio direction.
6. CTA must feel earned, not tacked on.
Return valid JSON only. No markdown, no preamble. Start with { end with }.`;

// ─── JSON output schema (injected as the final part of the system prompt) ────

const JSON_SCHEMA = `JSON schema (return exactly this, no extra keys):
{"meta":{"type":"","platform":"","duration":"","style":"","tone":"","audience":"","preset":"","presetIcon":""},"hook":{"label":"HOOK","duration":"0–3s","text":"opening lines — grabs in first 2 words, pure speech","imagePrompt":"cinematic 9:16 Midjourney/DALL-E 3 prompt","videoPrompt":"Runway/Kling: Xs, camera motion, subject, audio"},"alternateHooks":["different angle hook 2","different angle hook 3"],"scenes":[{"label":"SCENE 1","title":"2-4 word title","duration":"e.g. 3s–18s","text":"pure spoken script, no stage directions","imagePrompt":"cinematic 9:16 prompt","videoPrompt":"Runway/Kling prompt"}],"cta":{"label":"CALL TO ACTION","duration":"last 3–5s","text":"earned CTA","imagePrompt":"end card prompt","videoPrompt":"end card video direction"}}

SCENE COUNT: hit exact number if specified; "auto" = best for duration; min 2 scenes always; short scenes = punchy 1-3 sentences; long scenes = rich content.`;

// ─── Builders ────────────────────────────────────────────────────────────────

export function buildSystemPrompt(stylePreset) {
  if (stylePreset?.id === "skeleton") return SKELETON_SYSTEM_PROMPT;
  const styleId = stylePreset?.id || "custom";
  const styleBrief = STYLE_BRIEFS[styleId] || STYLE_BRIEFS.custom;
  return `${MASTER_SYSTEM_PROMPT}\n\n${styleBrief}\n\n${JSON_SCHEMA}`;
}

export function buildUserMessage(form, stylePreset) {
  if (stylePreset?.id === "skeleton") {
    return `Convert this idea into cinematic 3D skeleton character prompts:\n\n"${form.idea}"\n\nGenerate 1 main scene + 5 b-roll prompts. Make them elite-level cinematic.`;
  }
  const d = stylePreset?.defaults || {};
  const effectiveType     = form.type     || d.type     || "Full Script";
  const effectivePlatform = form.platform || d.platform || "TikTok";
  const effectiveStyle    = form.style    || d.style    || "Curiosity Gap";
  const effectiveTone     = (form.tone && form.tone !== "custom" ? form.tone : form.customTone) || d.tone || "Engaging";
  const effectiveAudience = form.audience || d.audience || "General audience";
  const effectiveCta      =
    !form.cta || form.cta === "🤖 Auto-generate best CTA"
      ? null
      : form.cta === "custom"
      ? form.customCta
      : form.cta;

  const sceneCount = form.sceneCount;
  const sceneInstruction = (!sceneCount || sceneCount === "auto")
    ? "Auto — choose the optimal scene count for this duration and format"
    : `EXACTLY ${sceneCount} scenes — no more, no less`;

  // Compute approximate per-scene duration to guide content density
  const durationStr = form.length || "60 seconds";
  const durationSecs = (() => {
    const parts = durationStr.match(/(\d+)\s*(min|m|second|s)/gi) || [];
    let total = 0;
    parts.forEach(p => {
      const n = parseInt(p); const u = p.replace(/\d+\s*/,"").toLowerCase();
      total += u.startsWith("m") ? n*60 : n;
    });
    return total || 60;
  })();
  const hookSec = durationSecs <= 20 ? 2 : 3;
  const ctaSec  = durationSecs <= 20 ? 2 : durationSecs <= 60 ? 3 : 5;
  const bodySec = Math.max(0, durationSecs - hookSec - ctaSec);
  const numScenes = (!sceneCount || sceneCount === "auto") ? Math.max(2, Math.round(bodySec / 15)) : parseInt(sceneCount);
  const perScene  = numScenes > 0 ? Math.round(bodySec / numScenes) : bodySec;
  const perSceneStr = perScene < 60 ? `~${perScene}s` : `~${Math.round(perScene/60)}m ${perScene%60>0?perScene%60+"s":""}`.trim();

  return `Generate a ${effectiveType} with these specifications:

IDEA / TOPIC:
"${form.idea}"
${form.niche ? `\nCREATOR NICHE: ${form.niche}` : ""}
PLATFORM: ${effectivePlatform}
VIDEO DURATION: ${durationStr}
SCENE COUNT: ${sceneInstruction}
PER-SCENE DURATION: ${perSceneStr} each — write content proportional to this time
VIRAL BLUEPRINT: ${effectiveStyle}
TONE OF VOICE: ${effectiveTone}
TARGET AUDIENCE: ${effectiveAudience}
CALL TO ACTION: ${effectiveCta || "Auto-generate the highest-converting CTA for this platform and audience"}
STYLE PRESET: ${stylePreset?.name || "Custom"} ${stylePreset?.icon || ""}

EXECUTION NOTES:
- Match the pacing, vocabulary, and native content patterns of ${effectivePlatform} exactly
- The hook must stop a ${effectiveAudience} viewer mid-scroll in under 2 seconds
- If scene count is specified, hit it exactly — scale content density to per-scene duration
- For short scenes (under 10s): 1–3 punchy sentences. For long scenes (30s+): rich developed content.
- IMAGE PROMPTS: Midjourney v6 / DALL-E 3 quality. Include: subject, action, lighting, mood, camera angle, lens, color grade, style. Always vertical 9:16. No text overlays. Be specific enough to generate directly.
- VIDEO PROMPTS: Runway Gen-3 / Kling quality. Include: duration in seconds, camera motion (push-in / zoom / dolly / pan / static), subject action, audio direction (genre/mood/silence), transition style.
- Alternate hooks must each use a completely different angle — no overlap in approach`;
}

/**
 * Build the complete OpenAI API request body.
 * Pass directly to fetch() as the JSON body.
 */
export function buildOpenAIRequest(form, stylePreset) {
  return {
    model: "gpt-4o-mini",
    temperature: 0.82,
    max_tokens: 2000,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: buildSystemPrompt(stylePreset),
      },
      {
        role: "user",
        content: buildUserMessage(form, stylePreset),
      },
    ],
  };
}

/**
 * Ready-to-use async function.
 * Call this in generateScript.js once you have an OpenAI API key.
 *
 * @param {object} form       - The form data from ScriptChat
 * @param {object} stylePreset - The selected style preset from scriptTemplates.js
 * @param {string} apiKey     - Your OpenAI API key (or pull from import.meta.env.VITE_OPENAI_KEY)
 * @returns {Promise<object>} - Parsed script JSON matching ScriptResult's expected shape
 */
export async function generateScriptWithOpenAI(form, stylePreset, apiKey) {
  const body = buildOpenAIRequest(form, stylePreset);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error("OpenAI returned empty content");

  const script = JSON.parse(raw);

  // Ensure presetIcon is populated from the stylePreset if missing
  if (!script.meta.presetIcon && stylePreset?.icon) {
    script.meta.presetIcon = stylePreset.icon;
  }

  return script;
}
