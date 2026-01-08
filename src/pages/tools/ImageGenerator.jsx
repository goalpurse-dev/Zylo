// src/pages/tools/ImageGenerator.jsx
import React, { useRef, useState } from "react";
import ImageToolSettingsModal from "../../components/image/ImageToolSettingsModal";
import FlowBrowser from "../../components/video/FlowBrowser";
import CreationOverlay from "../../components/video/CreationOverlay";
import PostRenderSetupImage from "../../components/image/PostRenderSetupImage";
import { createImageJobSimple } from "../../lib/jobs";
import { enhancePrompt } from "../../lib/promptEnhancer";

import {
  Sparkles,
  Upload,
  Image as ImageIcon,
  Wand2,
  Grid2x2,
  Type,
} from "lucide-react";

/* --------------------------- UI helpers --------------------------- */
const ringGradient =
  "ring-1 ring-transparent [background:linear-gradient(white,white)_padding-box,linear-gradient(135deg,#7C3AED,#1677FF)_border-box] border border-transparent";
const pill =
  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition";

/* ------------------------------ TOOLS ----------------------------- */
const TOOLS = [
  { id: "image",     label: "Image Creator",     icon: ImageIcon, hint: "Prompt → still image" },
  { id: "thumbnail", label: "Thumbnail Creator", icon: Type,      hint: "Platform + size + bold subject/text" },
  { id: "logo",      label: "Logo Creator",      icon: Sparkles,  hint: "Brand name, colors, aesthetic" },
  { id: "irl",       label: "IRL → AI Photo",    icon: Wand2,     hint: "Upload a photo, stylize (Pixar, Anime…)" },
  { id: "upscaler",  label: "Upscaler (HD)",     icon: Upload,    hint: "Upload and upscale" },
];

/* ------- default chips for the post panel ----- */
const OUTPUT_OPTIONS = ["Art piece", "Wallpaper", "Poster", "Product render"];
const SIZE_OPTIONS   = ["1024x1024", "1536x1536", "2048x1152 (16:9)", "1080x1920 (9:16)"];
const STYLE_OPTIONS  = ["Cinematic", "Illustration", "Neon/Glitch", "Retro", "Clay 3D"];

/* ---------------- prompt helpers ---------------- */
const NEG = {
  generic:
    "text, letters, watermark, logo, caption, low-res, blurry, jpeg artifacts, extra fingers",
  logo:
    "photo, 3d render, mockup, realistic, gradients on background, noisy background, watermark, small text",
  thumbnail:
    "paragraph text, clutter, watermark, busy background, tiny faces, low contrast",
};

/** Build prompt + post defaults + structured input from a tool sheet */
function prefillFromTool({ tool, values }) {
  switch (tool) {
    /* -------------------- THUMBNAIL -------------------- */
    case "thumbnail": {
      const platform = values.platform || "YouTube";
      const size =
        values.size || (platform === "TikTok" ? "1080x1920 (9:16)" : "1280x720 (16:9)");
      const text = (values.headline || "").trim();
      const subject = (values.subject || values.topic || "").trim();
      const mood = (values.mood || "").trim();

      const parts = [
        `${platform} thumbnail`,
        subject && `featuring ${subject}`,
        text && `large bold headline text: "${text}"`,
        mood && mood,
        "single clear subject, high contrast, cinematic lighting, depth, clean background, center composition, rim light",
        `Avoid: ${NEG.thumbnail}`,
      ].filter(Boolean);

      return {
        prompt: parts.join(", "),
        defaults: { size, style: "Bold text + subject", tier: "zylo-v2" },
        input: {
          tool: "image",
          subject: subject || "thumbnail subject",
          style: "thumbnail",
          extras: [
            text && `big headline "${text}"`,
            mood && `mood: ${mood}`,
            values.destination && `dest: ${values.destination}`,
          ]
            .filter(Boolean)
            .join(", "),
          negative: NEG.thumbnail,
          ref_images: values.refImageUrl ? [values.refImageUrl] : [],
          overlay_text: text || null,
        },
      };
    }

    /* -------------------- IMAGE CREATOR -------------------- */
    case "image": {
      const subject = (values.topic || values.subject || "").trim();
      const size = values.size || "1024x1024";
      const style = values.style || "Cinematic";
      const mood = (values.mood || "").trim();
      const overlayText = (values.overlayText || "").trim();
      const destination = values.destination || "own-use";

      const parts = [
        subject || "clean studio photo of product",
        `${style} style`,
        mood && mood,
        `for: ${destination}`,
        "clean composition, sharp focus, high detail",
        `Avoid: ${NEG.generic}`,
      ].filter(Boolean);

      return {
        prompt: parts.join(", "),
        defaults: { size, style, tier: "zylo-v2" },
        input: {
          tool: "image",
          subject: subject || "product photo",
          style,
          mood: mood || null,
          extras: destination && `destination ${destination}`,
          negative: NEG.generic,
          overlay_text: overlayText || null,
          ref_images: values.refImageUrl ? [values.refImageUrl] : [],
        },
      };
    }

    /* -------------------- LOGO CREATOR -------------------- */
    case "logo": {
      const brandMode = values.brandMode || "no-brand"; // "choose-brand" | "no-brand"
      const brand = (values.brand || "").trim();
      const slogan = (values.slogan || "").trim();
      const colors = (values.colors || "#000000,#1677FF").trim();
      const style = (values.style || "Minimal").trim();
      const theme = (values.theme || "").trim();
      const shape = (values.shape || "").trim();

      const parts = [
        `flat vector ${style.toLowerCase()} logo`,
        brandMode === "choose-brand" && brand && `for "${brand}"`,
        slogan && `optional slogan "${slogan}"`,
        theme && `theme ${theme}`,
        shape && `preferred shape ${shape}`,
        `palette: ${colors}`,
        "negative space, balanced kerning, strong silhouette, scalable iconography, centered on white",
        `Avoid: ${NEG.logo}`,
      ].filter(Boolean);

      return {
        prompt: parts.join(", "),
        defaults: { size: "1024x1024", style: "Minimal", tier: "zylo-v3" },
        input: {
          tool: "image",
          subject: `${brand || "brand"} ${style} logo`,
          extras: [
            theme && `theme ${theme}`,
            shape && `shape ${shape}`,
            `palette ${colors}`,
            slogan && `slogan "${slogan}"`,
          ]
            .filter(Boolean)
            .join(", "),
          negative: NEG.logo,
          brand:
            brandMode === "choose-brand"
              ? { id: values.brandId || null, use_palette: true }
              : null,
          overlay_text: null,
        },
      };
    }

    /* -------------------- IRL → AI PHOTO -------------------- */
    case "irl": {
      const theme = (values.theme || "Pixar-ish").trim();
      const topic = (values.topic || "portrait").trim();
      const ref = values.refImageUrl || "";

      const parts = [
        `${theme} ${topic}`,
        "keep identity, natural skin texture, flattering lighting, shallow depth of field",
        `Avoid: ${NEG.generic}`,
      ];

      return {
        prompt: parts.join(", "),
        defaults: { size: "1024x1024", style: theme, tier: "zylo-v3" },
        input: {
          tool: "image",
          subject: topic,
          style: theme,
          negative: NEG.generic,
          ref_images: ref ? [ref] : [],
        },
      };
    }

    /* -------------------- UPSCALER -------------------- */
    case "upscaler": {
      return {
        prompt: "Upscale image to HD",
        defaults: { size: "Original ×2", style: "Detail-preserving", tier: "zylo-v2" },
        input: {
          tool: "upscaler",
          ref_images: values.refImageUrl ? [values.refImageUrl] : [],
          extras: values.scale || "2x",
        },
      };
    }

    default:
      return {
        prompt: "clean studio photo, sharp focus, high detail",
        defaults: { size: "1024x1024", style: "Cinematic", tier: "zylo-v2" },
        input: { tool: "image", subject: "product photo", negative: NEG.generic },
      };
  }
}

export default function ImageGenerator() {
  const [tool, setTool] = useState("image");
  const [prompt, setPrompt] = useState("");

  const [drawer, setDrawer] = useState({ open: false, title: "", kind: "image", defaults: {} });
  const [showTemplates, setShowTemplates] = useState(false);

  const [phase, setPhase] = useState("compose"); // "compose" | "creating" | "post"
  const [enhancing, setEnhancing] = useState(false);

  // post panel defaults (updated when a tool sheet is submitted)
  const [postDefaults, setPostDefaults] = useState({
    output: OUTPUT_OPTIONS[0],
    size: SIZE_OPTIONS[0],
    style: STYLE_OPTIONS[0],
    tier: "zylo-v2",
  });

  // store the structured truth from the sheet so the worker sees it
  const lastToolInputRef = useRef(null);

  function openTool(kind) {
    setTool(kind);
    const byKind = {
      image: "Image Generator",
      thumbnail: "Thumbnail Creator",
      logo: "Logo Creator",
      irl: "IRL → AI Photo",
      upscaler: "Upscaler (HD boost)",
    };
    setDrawer({ open: true, title: byKind[kind] || "Image Generator", kind, defaults: {} });
  }

  // receive the sheet values, build prompt/defaults/input, open post panel
  function handleProceed({ tool: t, values }) {
    const { prompt: composed, defaults, input } = prefillFromTool({ tool: t, values });

    setPrompt(composed);
    setPostDefaults((d) => ({ ...d, ...defaults })); // ← size/style/tier preselected
    lastToolInputRef.current = input;                // ← pass through later

    setDrawer((d) => ({ ...d, open: false }));
    setPhase("post");
  }

  async function handlePrimaryGenerateClick() {
    try {
      setEnhancing(true);
      const base = prompt?.trim() || "clean studio photo of product";

      // ✅ NEW: enhancer returns a string (no object destructuring)
      const improved = await enhancePrompt(base);

      if (improved && typeof improved === "string") setPrompt(improved);
    } catch (e) {
      console.warn("prompt enhance failed:", e);
    } finally {
      setEnhancing(false);
      setPhase("creating");
    }
  }

  // Called by the post panel
  async function handleGenerateFromPost({ output, size, style, tier }) {
    const structured =
      lastToolInputRef.current || { tool: "image", subject: (prompt || "simple subject").trim() };

    const job = await createImageJobSimple({
      ...structured, // subject/style/mood/extras/negative/ref_images/overlay_text…
      style: structured.style || style,
      tier,
      size,
    });

    setPhase("compose");
    return job; // panel will navigate to /jobs/:id
  }

  const ToolPill = ({ id, label, icon: Icon }) => (
    <button
      onClick={() => openTool(id)}
      className={`${pill} bg-white text-blue-600 border border-blue-200 hover:bg-blue-50`}
      title={TOOLS.find((t) => t.id === id)?.hint}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );

  return (
    <main className="mx-auto max-w-5xl px-6 sm:px-8 py-10">
      <div className="mb-3 text-xs text-black/60">Studios / AI Image Generator</div>

      <section className={`relative rounded-2xl bg-white ${ringGradient} p-4 sm:p-5 shadow-sm`}>
        <div className="mb-3">
          <div className="inline-flex items-center gap-2">
            <span className="rounded-full bg-black/5 px-3 py-1.5 text-xs font-semibold text-black/70">
              v4.0 (Zylo Gen-4)
            </span>
            <span className="text-xs text-black/40">No watermark on paid • Brand Kit ready</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="rounded-xl border border-black/10 bg-white">
            <textarea
              rows={5}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={`Describe your ${tool} idea in any language…`}
              className="w-full resize-none rounded-xl p-4 sm:p-5 text-[15px] outline-none"
            />
            <div className="flex items-center justify-between px-4 pb-4 sm:px-5">
              <button
                className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold !text-blue-600 hover:bg-blue-50"
                title="Attach/choose an AI Twin (coming soon)"
                onClick={() => setPrompt((p) => p || "Create a clean, modern brand look for: ")}
              >
                <Sparkles className="h-4 w-4 text-purple-600" />
                AI twins
              </button>

              <button
                onClick={handlePrimaryGenerateClick}
                disabled={enhancing}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-60"
              >
                <ImageIcon className="h-4 w-4" />
                {enhancing ? "Polishing prompt…" : "Generate my image"}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5">
            {TOOLS.map((t) => (
              <ToolPill key={t.id} id={t.id} label={t.label} icon={t.icon} />
            ))}
            <button
              onClick={() => setShowTemplates(true)}
              className={`${pill} bg-white text-blue-600 border border-blue-200 hover:bg-blue-50`}
              title="Browse ready-made image templates"
            >
              <Grid2x2 className="h-4 w-4" />
              Templates
            </button>
          </div>
        </div>
      </section>

      {/* Centered tool modal */}
      <ImageToolSettingsModal
        open={drawer.open}
        kind={drawer.kind}                 // <-- CRUCIAL: tells the modal which tool to render
        defaults={{ topic: prompt, ...drawer.defaults }}
        onClose={() => setDrawer(d => ({ ...d, open: false }))}
        onProceed={({ tool: t, values }) => handleProceed({ tool: t, values })}
      />

      <FlowBrowser
        open={showTemplates}
        onClose={() => setShowTemplates(false)}
        onPick={(item) => {
          const themeParam = {
            "pixar-style": "pixar",
            "claymation-style": "claymation",
            "lego-style": "lego",
            "anime-style": "anime",
            "lowpoly-style": "lowpoly",
            "neon-glitch-style": "neon",
            "noir-style": "noir",
          }[item?.id];

          if (themeParam) {
            window.location.href = `/image-generator?tool=irl&theme=${encodeURIComponent(
              themeParam
            )}&openDrawer=1`;
            return;
          }
          if (item?.id === "thumbnail-creator") {
            window.location.href = `/image-generator?tool=thumbnail&openDrawer=1`;
            return;
          }
          if (item?.id === "logo-creator") {
            window.location.href = `/image-generator?tool=logo&openDrawer=1`;
            return;
          }
          setShowTemplates(false);
        }}
      />

      {phase === "creating" && <CreationOverlay onDone={() => setPhase("post")} />}

      <PostRenderSetupImage
        open={phase === "post"}
        onBack={() => setPhase("compose")}
        onGenerate={handleGenerateFromPost}
        outputOptions={OUTPUT_OPTIONS}
        sizeOptions={SIZE_OPTIONS}
        styleOptions={STYLE_OPTIONS}
        defaults={postDefaults} // ← comes from the sheet
      />
    </main>
  );
}
