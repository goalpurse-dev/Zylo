// src/pages/ads/AdCreateStep5.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronRight, Info, Loader2, CheckCircle2 } from "lucide-react";
import "../../styles/adstudio.css";

import { startAdGeneration } from "../../lib/adBrain";
import { enhancePrompt } from "../../lib/promptEnhancer";
import { useGenerations } from "../../components/GenerationsDock";

const STEP4_KEY = "ad.create.step4";
const STEP2_KEY = "ad.create.step2";

// clean credit rates
const CREDIT_RATE = {
  "v4-pixverse-v5": 3,
  "v5-veo-3.1-fast": 5,
  default: 3,
};

export default function AdCreateStep5() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { addJob, setIsOpen } = useGenerations();

  const adType = (params.get("adType") || "").toLowerCase();
  const model = params.get("model") || "";
  const mode = params.get("mode") || "";
  const productId = params.get("product_id") || "";

  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState(null);

  // Load Step 4 cached payload
  useEffect(() => {
    const cached = sessionStorage.getItem(STEP4_KEY);
    if (cached) {
      try {
        setPayload(JSON.parse(cached));
      } catch {}
    }
  }, []);

  // Load Step 2 (product info)
  const productStep = useMemo(() => {
    try {
      const raw =
        localStorage.getItem(STEP2_KEY) ||
        sessionStorage.getItem(STEP2_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const bgRemovedUrl =
    productStep?.bg_removed_url ||
    productStep?.removedBgUrl ||
    productStep?.product_bg_removed_url ||
    productStep?.images?.find?.((i) => i?.role === "bg_removed")?.url ||
    null;

  const scenes = Array.isArray(payload?.scenes) ? payload.scenes : [];

  const secondsTotal = scenes.reduce(
    (a, s) => a + Number(s?.seconds || 0),
    0
  );

  const creditRate = CREDIT_RATE[model] ?? CREDIT_RATE.default;
  const estimatedCredits = secondsTotal * creditRate;

  const goBack = () => {
    const q = new URLSearchParams({
      adType,
      model,
      mode,
      product_id: productId,
    });
    navigate(`/ad/create/step-4?${q.toString()}`);
  };

  /* ============================================================
     FINAL GENERATE — THE ONLY PART THAT MATTERS
  ============================================================ */
  const handleGenerate = async () => {
    if (!payload) return;

    if (scenes.length < 2) {
      alert("Add at least 2 scenes.");
      return;
    }
    if (secondsTotal !== 8) {
      alert("Total seconds must be exactly 8.");
      return;
    }

    setLoading(true);
    try {
      // ⭐ ABSOLUTELY CLEAN PAYLOAD TO PASS TO adBrain
      const finalPayload = {
        model,                // v4-pixverse-v5 | v5-veo-3.1-fast
        adType,               // ugc | commercial | talking-head
        mode,
        product_id: productId,

        productCutout: bgRemovedUrl || null,

        voiceMode: payload.voiceMode,

        // avatar must include ID
        avatar: payload.avatar
          ? {
              id: payload.avatar.id,  // ⭐ MISSING BEFORE
              name: payload.avatar.name,
              voice_id: payload.avatar.voice_id,
            }
          : null,

        // bg voice
        bgVoice: payload.bgVoice
          ? {
              id: payload.bgVoice.id,
              label: payload.bgVoice.label,
              voice_id: payload.bgVoice.voice_id,
            }
          : null,

        scenes,
      };

      // store for reload
      sessionStorage.setItem(STEP4_KEY, JSON.stringify(finalPayload));
      localStorage.setItem(STEP4_KEY, JSON.stringify(finalPayload));

      // ⭐ THIS CALL IS CORRECT NOW
      const res = await startAdGeneration({
        enhancePrompt,
        payloadOverride: finalPayload,
      });

      if (res?.jobId) {
        addJob(res.jobId, {
          tool: "ad-studio",
          input: finalPayload,
        });
        setIsOpen(true);
      }
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to generate.");
    } finally {
      setLoading(false);
    }
  };

  if (!payload) {
    return (
      <div className="min-h-screen bg-white">
        <div className="mx-auto w-full max-w-6xl px-6 pt-10">
          <Stepper />
          <h1 className="zy-h1">
            Review & <span className="zy-gradient-text">Generate</span>
          </h1>
          <div className="mt-6 zy-card p-6">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              Nothing to review yet. Go back and finish Step 4.
            </div>
            <div className="mt-4">
              <button onClick={goBack} className="zy-btn-soft">
                Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Determine voice summary
  let voiceSummary = "No voice";
  if (payload.voiceMode === "avatar") {
    voiceSummary = `Avatar voice — ${payload.avatar?.name || "Unknown"}`;
  } else if (payload.voiceMode === "bg") {
    voiceSummary = `Background voice — ${payload.bgVoice?.label || "Unknown"}`;
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto w-full max-w-6xl px-6 pt-10">
        <Stepper active="generate" />
        <h1 className="zy-h1">
          Review & <span className="zy-gradient-text">Generate</span>
        </h1>
        <p className="mt-2 zy-sub">
          Double-check everything before generating your 8-second ad.
        </p>

        {!bgRemovedUrl && (
          <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-indigo-900 text-sm">
            <Info className="h-4 w-4 inline-block mr-2" />
            We'll auto-remove the product background during generation.
          </div>
        )}

        {/* MAIN CONTENT */}
        {/* ... (unchanged UI content for rows, summary, credits, etc.) ... */}

        {/* Actions */}
        <div className="mt-8 flex items-center gap-3">
          <button onClick={goBack} className="zy-btn-soft">Back</button>

          <button
            onClick={handleGenerate}
            disabled={loading || secondsTotal !== 8}
            className={`w-full rounded-xl px-5 py-3 text-white font-semibold transition ${
              loading || secondsTotal !== 8
                ? "cursor-not-allowed bg-indigo-300"
                : "bg-gradient-to-r from-indigo-600 to-violet-600 hover:opacity-95"
            }`}
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating…
              </span>
            ) : (
              <>
                Generate <ChevronRight className="ml-1 h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   COMPONENTS
============================================================ */

function Stepper({ active = "generate" }) {
  return (
    <div className="zy-stepper zy-fadeup">
      <div className="zy-step"><div className="zy-step__dot">1</div><span>Setup</span></div>
      <div className="zy-step__bar zy-step__bar--filled" />
      <div className="zy-step"><div className="zy-step__dot">2</div><span>Customize</span></div>
      <div className="zy-step__bar zy-step__bar--filled" />
      <div className={`zy-step ${active !== "generate" ? "zy-step--active" : ""}`}>
        <div className="zy-step__dot">3</div><span>Advanced</span>
      </div>
      <div className="zy-step__bar zy-step__bar--filled" />
      <div className={`zy-step ${active === "generate" ? "zy-step--active" : ""}`}>
        <div className="zy-step__dot">4</div><span>Generate</span>
      </div>
    </div>
  );
}
