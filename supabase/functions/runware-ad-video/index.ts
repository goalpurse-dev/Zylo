// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

/* ============================================================
   SUPABASE + ENV KEYS
============================================================ */
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const RW_KEY = Deno.env.get("RUNWARE_API_KEY")!;
const ELEVEN_KEY = Deno.env.get("ELEVENLABS_KEY")!;

/* ============================================================
   LOGGING + RESPONSE
============================================================ */
function LOG(...args: any[]) {
  console.log("[runware-ad-video]", ...args);
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

/* ============================================================
   MODEL NORMALIZER (AIR tags)
============================================================ */
function normalizeModelTag(tag: string): string {
  if (!tag) throw new Error("Missing model tag");
  if (tag.includes("@")) return tag;
  return `${tag}@1`;
}

/* ============================================================
   RUNWARE API WRAPPER (generic, with valid taskUUID)
============================================================ */
async function runwareTask(payload: any): Promise<any> {
  const taskUUID = crypto.randomUUID();
  const taskType = payload.taskType ?? "videoInference";

  const task: any = {
    taskUUID,
    includeCost: true,
    taskType,
    ...payload,
    model: normalizeModelTag(payload.model),
  };

  // Force sync delivery unless caller overrides
  if (!("deliveryMethod" in task)) {
    task.deliveryMethod = "sync";
  }

  // Default outputType if caller didn't set one
  if (!("outputType" in task)) {
    task.outputType = taskType.startsWith("image") ? ["URL"] : "URL";
  }

  const body = [task];

  LOG("⚡ Runware call:", JSON.stringify(body, null, 2));

  const res = await fetch("https://api.runware.ai/v1/tasks", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RW_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch (err) {
    LOG("❌ Failed to parse Runware JSON:", err);
    throw new Error("Runware JSON parse error");
  }

  LOG("⚡ Runware response:", JSON.stringify(data, null, 2));

  const first = data?.data?.[0];

  const url =
    first?.videoURL ||
    first?.imageURL ||
    first?.audioURL ||
    first?.result?.url ||
    null;

  if (!url) {
    throw new Error("Runware task failed: " + JSON.stringify(data));
  }

  return { url, raw: data };
}

/* ============================================================
   RESOLUTION HELPERS
============================================================ */
function getResolution(aspect: string) {
  switch (aspect) {
    case "16:9":
      return { width: 1920, height: 1080 };
    case "9:16":
    default:
      return { width: 1080, height: 1920 };
  }
}

/* ============================================================
   ELEVENLABS → RAW MP3 BUFFER
============================================================ */
async function elevenRaw(text: string, voiceId: string): Promise<ArrayBuffer> {
  LOG("🎤 ElevenLabs TTS:", voiceId, "|", text);

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": ELEVEN_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        output_format: "mp3_44100_128",
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    LOG("❌ ElevenLabs TTS error:", err);
    throw new Error("ElevenLabs TTS error");
  }

  return await res.arrayBuffer();
}

/* ============================================================
   MERGE SCENE TTS → ONE MP3 & UPLOAD TO SUPABASE
============================================================ */
async function buildSceneTTS(scenes: any[], voiceId: string): Promise<string> {
  const valid = (Array.isArray(scenes) ? scenes : []).filter(
    (s) => s?.text?.trim?.().length > 0,
  );

  if (!valid.length) throw new Error("No TTS scenes");

  LOG("🎤 Generating TTS for", valid.length, "scenes");

  const buffers: ArrayBuffer[] = [];

  for (const s of valid) {
    const b = await elevenRaw(s.text.trim(), voiceId);
    buffers.push(b);
  }

  let total = 0;
  for (const b of buffers) total += b.byteLength;

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const b of buffers) {
    merged.set(new Uint8Array(b), offset);
    offset += b.byteLength;
  }

  const filePath = `tts/${crypto.randomUUID()}.mp3`;

  const { error } = await supabase.storage
    .from("generated")
    .upload(filePath, merged, { contentType: "audio/mpeg" });

  if (error) {
    LOG("❌ Supabase TTS upload error:", error);
    throw error;
  }

  const { data } = await supabase.storage
    .from("generated")
    .getPublicUrl(filePath);

  LOG("🎤 Final TTS URL:", data.publicUrl);

  return data.publicUrl;
}

/* ============================================================
   BACKGROUND REMOVAL (runware:110@1)
============================================================ */
async function removeBackground(url: string): Promise<string> {
  LOG("🖼 RMBG:", url);

  const result = await runwareTask({
    taskType: "imageBackgroundRemoval",
    model: "runware:110@1",
    inputImage: url,
    outputFormat: "PNG",
    outputType: ["URL"],
  });

  return result.url;
}

/* ============================================================
   SEEDANCE (v4) — 8s, PRODUCT CUTOUT ONLY (no audio)
============================================================ */
/* ============================================================
   SEEDANCE (v4) — 8s, PRODUCT CUTOUT (no audio)
============================================================ */
async function generateSeedanceVideo(opts: {
  prompt: string;
  duration: number;
  width: number;
  height: number;
  productCutoutUrl: string | null;
}) {
  const { prompt, duration, width, height, productCutoutUrl } = opts;
  LOG("🎬 Seedance v4 generation");

  const basePayload = {
    taskType: "videoInference" as const,
    model: "bytedance:2@2",
    fps: 24,
    outputFormat: "mp4",
    height,
    width, // 1088x1920 for 9:16, or 1920x1088 for 16:9
    numberResults: 1,
    outputQuality: 85,
    duration,
    positivePrompt: prompt,
    providerSettings: {
      bytedance: { cameraFixed: false },
    },
  };

  // ---- build frame image URL in the exact format Runware expects ----
  let frameImageUrl: string | null = null;

  if (productCutoutUrl) {
    try {
      const u = new URL(productCutoutUrl);
      // convert: /image/ws/2/ii/xxx.png → /image/ii/xxx.png
      if (u.hostname === "im.runware.ai" && u.pathname.includes("/image/ws/")) {
        u.pathname = u.pathname.replace("/image/ws/2/", "/image/");
        frameImageUrl = u.toString();
      } else {
        frameImageUrl = productCutoutUrl;
      }
    } catch {
      frameImageUrl = productCutoutUrl;
    }
  }

  // try with frameImages first, using the normalized URL
  if (frameImageUrl) {
    try {
      LOG("🖼 Seedance frameImages input:", frameImageUrl);
      const withFrame = await runwareTask({
        ...basePayload,
        frameImages: [{ inputImage: frameImageUrl }],
      });
      return withFrame.url;
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (msg.includes("failedToTransferImage")) {
        LOG(
          "⚠️ Seedance failed to transfer frameImages image, retrying without product image",
        );
        // fall through to plain call
      } else {
        throw err;
      }
    }
  }

  // fallback: no frameImages at all (still returns a video)
  const plain = await runwareTask(basePayload);
  return plain.url;
}





/* ============================================================
   GOOGLE VEO (v5) — PRODUCT + AVATAR, NO AUDIO
============================================================ */
async function generateVeoVideo(opts: {
  prompt: string;
  duration: number;
  width: number;
  height: number;
  productCutoutUrl: string | null;
  avatarUrl: string | null;
}) {
  const { prompt, duration, width, height, productCutoutUrl, avatarUrl } = opts;

  LOG("🎬 VEO v5 base generation");

  const frameImages: any[] = [];
  if (productCutoutUrl) frameImages.push({ inputImage: productCutoutUrl });
  if (avatarUrl) frameImages.push({ inputImage: avatarUrl });

  const result = await runwareTask({
    taskType: "videoInference",
    model: "google:3@3",
    fps: 24,
    outputFormat: "mp4",
    outputType: "URL",
    height,
    width,
    numberResults: 1,
    outputQuality: 85,
    duration,
    positivePrompt: prompt,
    frameImages,
    providerSettings: {
      google: {
        generateAudio: false,
        enhancePrompt: true,
      },
    },
  });

  return result.url;
}

/* ============================================================
   LIPSYNC (v5 avatar mode ONLY)
============================================================ */
async function lipsyncAvatar(opts: {
  baseVideoUrl: string;
  avatarUrl: string;
  ttsUrl: string;
}) {
  const { baseVideoUrl, avatarUrl, ttsUrl } = opts;
  LOG("👄 Lipsync avatar video");

  const result = await runwareTask({
    taskType: "videoInference",
    model: "pixverse:lipsync@1",
    outputType: "URL",
    outputFormat: "mp4",
    numberResults: 1,
    referenceVideos: [baseVideoUrl],
    frameImages: [{ inputImage: avatarUrl }],
    inputAudios: [ttsUrl],
  });

  return result.url;
}

/* ============================================================
   MAIN PROCESS (per job)
============================================================ */
async function processAdVideo(jobId: string) {
  LOG("🚀 Start job:", jobId);

  const { data: job, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (error) throw error;
  if (!job) throw new Error("Job not found");

  const input = job.input || {};
  const ad = input.ad || {};
  const provider = job.settings?.provider_hint;

  if (!provider) throw new Error("Missing provider_hint");

  const { airTag } = provider;

  const aspect = input.aspect ?? "9:16";
  const { width, height } = getResolution(aspect);
  const duration = 8;

  const prompt: string =
    input.subject ||
    "A clean, modern product video showcasing the item in an appealing way.";

  // "none" | "bg" | "avatar"
  let voiceMode: "none" | "bg" | "avatar" = ad.voiceMode ?? "none";

  // v4 (Seedance) cannot do avatar lipsync → downgrade avatar → bg
  if (airTag.startsWith("bytedance") && voiceMode === "avatar") {
    LOG("ℹ️ Seedance does not support avatar lipsync, using BG voice instead");
    voiceMode = "bg";
  }

  /* -------------------- PRODUCT CUTOUT -------------------- */
  let productCutout: string | null = null;

  if (input.product?.id) {
    const { data: prod, error: prodErr } = await supabase
      .from("brand_products")
      .select("id, image_url, thumb, meta")
      .eq("id", input.product.id)
      .maybeSingle();

    if (prodErr) {
      LOG("🖼 Brand product fetch error:", prodErr);
    } else if (prod) {
      let originalUrl: string | null =
        prod.image_url ||
        prod.thumb ||
        (typeof prod.meta === "object" &&
          (prod.meta as any)?.images?.[0]?.path) ||
        null;

      if (originalUrl) {
        try {
          productCutout = await removeBackground(originalUrl);
          LOG("🖼 Product cutout URL:", productCutout);
        } catch (e) {
          LOG("🖼 RMBG error:", e);
        }
      } else {
        LOG("🖼 No usable image_url/thumb for brand_product", prod.id);
      }
    }
  }

  /* -------------------- AVATAR (v5 only) -------------------- */
  let avatarUrl: string | null = null;
  let avatarVoice: string | null = null;

  if (voiceMode === "avatar" && input.avatar_meta?.id) {
    const { data: av } = await supabase
      .from("avatars")
      .select("image_url, voice_id")
      .eq("id", input.avatar_meta.id)
      .maybeSingle();

    avatarUrl = av?.image_url ?? null;
    avatarVoice = av?.voice_id ?? null;
  }

  /* -------------------- TTS (if any) -------------------- */
  let ttsUrl: string | null = null;

  if (voiceMode !== "none") {
    const scenes = Array.isArray(ad.scenes) ? ad.scenes : [];
    const selectedVoice =
      voiceMode === "avatar" && avatarVoice
        ? avatarVoice
        : ad.bgVoice?.voice_id || "EXAVITQu4vr4xnSDxMaL";

    ttsUrl = await buildSceneTTS(scenes, selectedVoice);
  }

  /* -------------------- BASE VIDEO (NO MUX) -------------------- */
  let finalVideoUrl: string;

  if (airTag.startsWith("bytedance")) {
    // v4: Seedance — always silent video; TTS is separate download
    const baseVideoUrl = await generateSeedanceVideo({
      prompt,
      duration,
      width: 1088,
      height,
      productCutoutUrl: productCutout,
    });

    finalVideoUrl = baseVideoUrl;
  } else if (airTag.startsWith("google")) {
    // v5: VEO base video
    const avatarImage = voiceMode === "avatar" ? avatarUrl : null;

    const baseVideo = await generateVeoVideo({
      prompt,
      duration,
      width,
      height,
      productCutoutUrl: productCutout,
      avatarUrl: avatarImage,
    });

    if (voiceMode === "avatar") {
      if (!avatarUrl) throw new Error("Avatar image missing for avatar mode");
      if (!ttsUrl) throw new Error("Missing TTS audio for avatar mode");

      finalVideoUrl = await lipsyncAvatar({
        baseVideoUrl: baseVideo,
        avatarUrl,
        ttsUrl,
      });
    } else {
      // bg or none → silent base video; TTS still available as separate mp3
      finalVideoUrl = baseVideo;
    }
  } else {
    throw new Error("Unsupported airTag: " + airTag);
  }

  /* -------------------- ENRICH INPUT WITH TTS + VOICE MODE -------------------- */
  const enrichedAd = {
    ...ad,
    ttsUrl,
    voiceMode,
  };

  const newInput = {
    ...input,
    ad: enrichedAd,
  };

  /* -------------------- SAVE JOB -------------------- */
    const nextSettings = {
    ...(job.settings || {}),
    tts_url: ttsUrl,            // null if no voice
    voice_mode: voiceMode,
    air_tag: airTag,
  };

  const { error: upErr } = await supabase
    .from("jobs")
    .update({
      status: "succeeded",
      result_url: finalVideoUrl,
      settings: nextSettings,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (upErr) {
    LOG("❌ DB update error:", upErr);
    throw upErr;
  }

  LOG("✅ Job finished:", finalVideoUrl);
  return finalVideoUrl;
}

/* ============================================================
   HTTP ENTRYPOINT
============================================================ */
serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") return json("ok");
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const body = await req.json().catch(() => null);
    LOG("Incoming body:", body);

    if (!body?.jobId) throw new Error("Missing jobId");

    const result = await processAdVideo(body.jobId);
    return json({ ok: true, result });
  } catch (err: any) {
    LOG("❌ Handler error:", err);
    return json({ ok: false, error: err?.message || String(err) }, 500);
  }
});
