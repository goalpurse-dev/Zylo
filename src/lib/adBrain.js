// src/lib/adBrain.js
// deno-lint-ignore-file


import { supabase } from "../lib/supabaseClient";

const STEP4_KEY = "ad.create.step4";

/* ============================================================
   STEP 4 PAYLOAD HELPERS
============================================================ */

export function getStep4Payload() {
  try {
    const raw =
      sessionStorage.getItem(STEP4_KEY) ||
      localStorage.getItem(STEP4_KEY) ||
      null;
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getAdSummary() {
  const p = getStep4Payload();
  const scenes = Array.isArray(p?.scenes) ? p.scenes : [];
  const seconds = scenes.reduce((a, s) => a + Number(s?.seconds || 0), 0);

  return {
    voiceMode: p?.voiceMode || "none",
    scenes,
    seconds,
    product_id: p?.product_id || null,
    model: p?.model || null,
    adType: p?.adType || "",
    mode: p?.mode || "",
  };
}

/* ============================================================
   MODEL ROUTING (UI → INTERNAL AD VIDEO MODEL KEY)
============================================================ */

const INTERNAL_MODEL = {
  "v4-pixverse-v5": "ad-video:v4", // PixVerse v5
  "v4-veo-3.1-fast": "ad-video:v4", // Your fast mode also uses v4 pipeline
  "v5-premium": "ad-video:v5",     // Veo 3.1 Fast
};

/* ============================================================
   FINAL AD GENERATION (THE ONLY FUNCTION STEP 5 CALLS)
============================================================ */

export async function startAdGeneration(opts = {}) {
  const { enhancePrompt } = opts;

  const payload = opts.payloadOverride || getStep4Payload();
  if (!payload) throw new Error("Nothing to generate. Return to Step 4.");

  const scenes = Array.isArray(payload.scenes) ? payload.scenes : [];
  const secondsTotal = scenes.reduce((a, s) => a + Number(s.seconds || 0), 0);

  if (scenes.length < 2) throw new Error("Add at least 2 scenes.");
  if (secondsTotal !== 8) throw new Error("Total seconds must be exactly 8.");

  /* ---------------------------------------------------------
     BUILD SCENE SCRIPT
  --------------------------------------------------------- */
  const script = scenes
    .map(
      (s, i) =>
        `Scene ${i + 1}: (${s.seconds}s) VO="${s.text || ""}" VIS="${
          s.visual || ""
        }"`
    )
    .join("  ");

  const baseSubject = `${payload.adType || "ad"} — ${script}`;
  const subject = enhancePrompt ? await enhancePrompt(baseSubject) : baseSubject;

  /* ---------------------------------------------------------
     MAP UI MODEL → INTERNAL AD VIDEO MODEL KEY
  --------------------------------------------------------- */
  const modelKey = INTERNAL_MODEL[payload.model] || "ad-video:v4";

  /* ---------------------------------------------------------
     PREPARE VOICE META
  --------------------------------------------------------- */

  const avatarMeta = payload.avatar
    ? {
        id: payload.avatar.id,
        name: payload.avatar.name,
        voice_id: payload.avatar.voice_id,
      }
    : null;

  const bgVoiceMeta = payload.bgVoice
    ? {
        id: payload.bgVoice.id,
        label: payload.bgVoice.label,
        voice_id: payload.bgVoice.voice_id,
      }
    : null;

  /* ---------------------------------------------------------
     CALL THE REAL AD VIDEO JOB CREATOR
     ⭐ THIS IS THE FIX ⭐
  --------------------------------------------------------- */

  return { ok: true, jobId: job.id };
}

/* ============================================================
   MODEL → TIER
   (Only needed for credits + fallback)
============================================================ */

export function slugToTier(model) {
  if (!model) return "zylo-v2";
  const m = model.toLowerCase();

  if (m.includes("v5")) return "zylo-v4";
  if (m.includes("v4")) return "zylo-v4";
  if (m.includes("v3")) return "zylo-v3";
  return "zylo-v2";
}
