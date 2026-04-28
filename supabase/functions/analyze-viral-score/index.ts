// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ═══════════════ ENV ═══════════════ */
const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")  ?? Deno.env.get("PROJECT_URL")!;
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY")!;
const OPENAI_KEY    = Deno.env.get("OPENAI_API_KEY")!;
const OPENAI_CHAT   = "https://api.openai.com/v1/chat/completions";
const OPENAI_AUDIO  = "https://api.openai.com/v1/audio/transcriptions";

/* ═══════════════ CORS ═══════════════ */
const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function ok(data: any)  { return new Response(JSON.stringify({ ok: true,  ...data }), { headers: { ...CORS, "Content-Type": "application/json" } }); }
function err(msg: string, status = 400) { return new Response(JSON.stringify({ ok: false, error: msg }), { status, headers: { ...CORS, "Content-Type": "application/json" } }); }

/* ═══════════════ SYSTEM PROMPT ═══════════════ */
const SYSTEM_PROMPT = `You are a world-class viral content strategist with deep expertise in TikTok, Instagram Reels, and YouTube Shorts. You have analyzed thousands of viral videos and know exactly what makes content succeed or fail in the first 3 seconds.

Your analysis must be brutally specific. Every critique must reference what you actually observe in the frames — describe colors, motion, text on screen, faces, objects, energy level. Generic advice is unacceptable.

SCORING RUBRIC (integer 1–100):
- overall_score:    Holistic virality potential (algorithm signals + engagement + shareability)
- hook_score:       How well the first 1–3 seconds stop the scroll
- retention_score:  How well the video holds attention all the way through
- pacing_score:     Edit rhythm, scene variety, visual momentum
- clarity_score:    How fast the viewer understands the premise
- visual_score:     Quality, variety, and visual interest of the footage
- payoff_score:     How satisfying the conclusion or reveal is
- rewatch_score:    Whether the video rewards loop-watching or repeat viewing

CRITICAL RULES:
1. Reference exactly what you see (frame colors, text overlays, motion blur, cuts, expressions)
2. Use specific timestamps when calling out moments
3. Never use filler phrases like "consider" or "might want to" — state it directly
4. Rewritten hooks must be written for THIS specific video's content — not generic
5. top_fixes must be immediately actionable (specific edits, not vague direction)
6. timeline_notes must reference actual observable moments, not hypothetical ones

Return ONLY valid JSON (no markdown fences, no commentary outside JSON):`;

/* ═══════════════ BUILD ANALYSIS REQUEST ═══════════════ */
function buildMessages(
  frames: Array<{ timestamp: number; base64: string }>,
  duration: number,
  transcript?: string,
): any[] {
  const textParts: any[] = [
    {
      type: "text",
      text: [
        `Analyze these ${frames.length} frames from a ${duration.toFixed(1)}s short-form video.`,
        transcript
          ? `\nAUDIO TRANSCRIPT:\n${transcript}\n`
          : "\n(No audio transcript available — analyze visuals only.)",
        `\nFrame timestamps: ${frames.map((f) => `${f.timestamp}s`).join(", ")}`,
        `\nReturn ONLY this JSON structure:`,
        `{
  "overall_score": <int 1-100>,
  "hook_score": <int 1-100>,
  "retention_score": <int 1-100>,
  "pacing_score": <int 1-100>,
  "clarity_score": <int 1-100>,
  "visual_score": <int 1-100>,
  "payoff_score": <int 1-100>,
  "rewatch_score": <int 1-100>,
  "verdict": "<1-2 specific sentences about THIS video>",
  "biggest_problem": "<specific problem referencing what you see>",
  "biggest_opportunity": "<specific opportunity with exact fix>",
  "top_fixes": ["<specific actionable fix>", ...3-5 total],
  "timeline_notes": [
    { "start": <seconds>, "end": <seconds>, "label": "<short label>", "note": "<1 sentence>" }
    ...2-5 notes
  ],
  "rewritten_hooks": ["<hook 1 for this specific video>", "<hook 2>", "<hook 3>"],
  "improved_caption": "<improved caption for this video>",
  "improved_structure": ["<step 1>", "<step 2>", ...4-6 steps]
}`,
      ].join("\n"),
    },
  ];

  // Attach frames as vision inputs
  for (const frame of frames) {
    textParts.push({
      type: "image_url",
      image_url: {
        url: frame.base64,   // already a data:image/jpeg;base64,... string
        detail: "low",       // low detail = 85 tokens each, sufficient for structure analysis
      },
    });
  }

  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user",   content: textParts },
  ];
}

/* ═══════════════ OPTIONAL TRANSCRIPT ═══════════════ */
async function tryTranscribe(sb: any, videoPath: string): Promise<string | null> {
  try {
    // Get a signed URL so we can download the video
    const { data: signed, error } = await sb.storage
      .from("viral-score-videos")
      .createSignedUrl(videoPath, 120);

    if (error || !signed?.signedUrl) return null;

    const videoRes = await fetch(signed.signedUrl);
    if (!videoRes.ok) return null;

    const blob = await videoRes.blob();

    // Whisper supports mp4, mov, webm — max 25 MB
    if (blob.size > 24 * 1024 * 1024) return null;

    const form = new FormData();
    form.append("file", blob, "video.mp4");
    form.append("model", "whisper-1");
    form.append("response_format", "text");

    const res = await fetch(OPENAI_AUDIO, {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}` },
      body: form,
    });

    if (!res.ok) return null;
    const text = await res.text();
    return text?.trim() || null;
  } catch {
    return null;
  }
}

/* ═══════════════ MAIN HANDLER ═══════════════ */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (req.method !== "POST") return err("Method not allowed", 405);

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  /* ── Auth ── */
  const authHeader = req.headers.get("Authorization") ?? "";
  const { data: { user }, error: authErr } = await sb.auth.getUser(
    authHeader.replace("Bearer ", ""),
  );
  if (authErr || !user) return err("Unauthorized", 401);

  /* ── Parse body ── */
  let body: any;
  try { body = await req.json(); } catch { return err("Invalid JSON body"); }

  const { reportId, frames, duration } = body as {
    reportId: string;
    frames: Array<{ timestamp: number; base64: string }>;
    duration: number;
  };

  if (!reportId) return err("reportId is required");
  if (!Array.isArray(frames) || frames.length === 0) return err("frames are required");

  /* ── Verify ownership ── */
  const { data: report, error: fetchErr } = await sb
    .from("viral_score_reports")
    .select("id, user_id, video_path, status")
    .eq("id", reportId)
    .single();

  if (fetchErr || !report)         return err("Report not found", 404);
  if (report.user_id !== user.id)  return err("Forbidden", 403);
  if (report.status === "completed") return ok({ message: "Already completed" });

  /* ── Mark processing ── */
  await sb.from("viral_score_reports").update({
    status: "processing",
    updated_at: new Date().toISOString(),
  }).eq("id", reportId);

  /* ── Optional transcript ── */
  let transcript: string | null = null;
  try {
    transcript = await tryTranscribe(sb, report.video_path);
  } catch { /* non-fatal */ }

  /* ── Build + call GPT-4o ── */
  const messages = buildMessages(frames, duration ?? 30, transcript ?? undefined);

  let aiJson: any;
  try {
    const aiRes = await fetch(OPENAI_CHAT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages,
        max_tokens: 2000,
        temperature: 0.25,
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      throw new Error(`OpenAI ${aiRes.status}: ${errText.slice(0, 300)}`);
    }

    const aiData = await aiRes.json();
    const raw = aiData.choices?.[0]?.message?.content ?? "";
    aiJson = JSON.parse(raw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sb.from("viral_score_reports").update({
      status: "failed",
      error_message: msg,
      updated_at: new Date().toISOString(),
    }).eq("id", reportId);
    return err(`AI analysis failed: ${msg}`, 500);
  }

  /* ── Save results ── */
  const patch = {
    status:              "completed",
    updated_at:          new Date().toISOString(),
    transcript:          transcript ?? null,
    analysis_version:    "v1",
    overall_score:       aiJson.overall_score       ?? null,
    hook_score:          aiJson.hook_score          ?? null,
    retention_score:     aiJson.retention_score     ?? null,
    pacing_score:        aiJson.pacing_score        ?? null,
    clarity_score:       aiJson.clarity_score       ?? null,
    visual_score:        aiJson.visual_score        ?? null,
    payoff_score:        aiJson.payoff_score        ?? null,
    rewatch_score:       aiJson.rewatch_score       ?? null,
    verdict:             aiJson.verdict             ?? null,
    biggest_problem:     aiJson.biggest_problem     ?? null,
    biggest_opportunity: aiJson.biggest_opportunity ?? null,
    top_fixes:           aiJson.top_fixes           ?? [],
    timeline_notes:      aiJson.timeline_notes      ?? [],
    rewritten_hooks:     aiJson.rewritten_hooks     ?? [],
    improved_caption:    aiJson.improved_caption    ?? null,
    improved_structure:  aiJson.improved_structure  ?? [],
    full_report:         aiJson,
  };

  const { error: saveErr } = await sb
    .from("viral_score_reports")
    .update(patch)
    .eq("id", reportId);

  if (saveErr) {
    await sb.from("viral_score_reports").update({
      status: "failed",
      error_message: saveErr.message,
      updated_at: new Date().toISOString(),
    }).eq("id", reportId);
    return err("Failed to save results", 500);
  }

  return ok({ reportId });
});
