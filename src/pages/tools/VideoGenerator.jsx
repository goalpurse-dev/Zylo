// src/pages/tools/VideoGenerator.jsx
import ToolSettingsDrawer from "../../components/video/ToolSettingsDrawer";
import QuickFlowModal from "../../components/video/QuickFlowModal";
import FlowBrowser from "../../components/video/FlowBrowser";
import CreationOverlay from "../../components/video/CreationOverlay";
import PostRenderSetup from "../../components/video/PostRenderSetup";

import disneyThumb from "../../assets/thumbs/disney.jpg";
import animeThumb from "../../assets/thumbs/anime.jpg";
import clayThumb from "../../assets/thumbs/clay.jpg";
import lowpolyThumb from "../../assets/thumbs/lowpoly.jpg";
import neonThumb from "../../assets/thumbs/neon.jpg";
import noirThumb from "../../assets/thumbs/noir.jpg";
import legoThumb from "../../assets/thumbs/lego.jpg";
import { enhancePrompt } from "../../lib/promptEnhancer"; // ADDED
import { launchJob } from "../../lib/jobLauncher";

import React, { useMemo, useState, useEffect } from "react";
import {
  Sparkles,
  Play,
  Video,
  Clapperboard,
  Megaphone,
  UserRound,
  Wand2,
  ChevronDown,
  Grid2x2,
} from "lucide-react";

// Brand gradient helpers
const ringGradient =
  "ring-1 ring-transparent [background:linear-gradient(white,white)_padding-box,linear-gradient(135deg,#7C3AED,#1677FF)_border-box] border border-transparent";
const pill =
  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition";

const MODELS = [
  { id: "v4.0", label: "v4.0 (Zylo Gen-4)" },
  { id: "v3.5", label: "v3.5 Turbo" },
  { id: "v3.0", label: "v3.0 Stable" },
];

// ADDED: map model dropdown → pricing tier for worker
const MODEL_TO_TIER = {
  "v3.0": "zylo-v2",
  "v3.5": "zylo-v3",
  "v4.0": "zylo-v4",
};

const TOOLS = [
  {
    id: "cartoon",
    label: "3D Cartoon Creator",
    icon: Clapperboard,
    hint:
      "Stylize real clips into anime/comic/Pixar-ish with motion-aware anti-flicker.",
    prompt:
      "Turn this into a stylized 3D cartoon (clean outlines, bold colors, anti-flicker) about: ",
  },
  {
    id: "avatar",
    label: "Talking Avatar",
    icon: UserRound,
    hint:
      "Presenter-style video from a script or audio with auto-captions & brand overlays.",
    prompt:
      "Presenter (talking avatar) explains topic clearly, with friendly tone and punchy hook: ",
  },
  {
    id: "ugc",
    label: "UGC / Ad Creator",
    icon: Megaphone,
    hint:
      "UGC-style ad with beat-synced edits, captions, and platform-safe zones.",
    prompt:
      "UGC-style short ad with beat-synced cuts, fast hook, social proof and CTA about: ",
  },
  {
    id: "viral",
    label: "Viral Short",
    icon: Video,
    hint:
      "Fast-paced vertical short with captions, zoom cuts, and sound effects.",
    prompt:
      "Very fast-paced 9:16 short with strong hook, kinetic captions & zoom cuts about: ",
  },
];

// Map query param -> drawer theme label
const THEME_FROM_PARAM = {
  pixar: "Pixar-ish",
  lego: "Lego",
  claymation: "Claymation",
  anime: "Anime",
  lowpoly: "Low-poly",
  neon: "Neon/Glitch",
  noir: "Noir",
};

const STYLE_OPTIONS_BY_TOOL = {
  cartoon: [
    "Pixar-ish",
    "Anime / Manga",
    "Claymation",
    "LEGO",
    "Low-poly 3D",
    "Neon / Glitch",
    "Noir",
  ],
  avatar: [
    "Studio Presenter",
    "Newsroom",
    "Vlog Casual",
    "Tech Review",
  ],
  ugc: [
    "Testimonial",
    "Unboxing",
    "Reaction",
    "How-to / Tips",
  ],
  viral: [
    "Kinetic Captions",
    "Meme Cut",
    "Fast Zooms",
    "Emoji Punchy",
  ],
};

const DURATION_OPTIONS_BY_TOOL = {
  cartoon: [8, 15, 30, 45, 60],
  avatar: [15, 30, 60, 90],
  ugc: [8, 15, 30],
  viral: [7, 12, 20, 30],
};

const PLATFORM_OPTIONS_BY_TOOL = {
  cartoon: ["TikTok", "Instagram", "YouTube"],
  avatar: ["YouTube", "LinkedIn", "TikTok"],
  ugc: ["TikTok", "Instagram", "YouTube"],
  viral: ["TikTok", "Instagram", "YouTube Shorts"],
};

export default function VideoGenerator() {
  const [model, setModel] = useState(MODELS[0].id);
  const [tool, setTool] = useState(TOOLS[0].id);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  // phase: compose -> creating (1s overlay) -> post (final setup) -> compose/progress
  const [phase, setPhase] = useState("compose");
  const [postOptions, setPostOptions] = useState(null);

  // Drawer state (opens when a tool is selected)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTitle, setDrawerTitle] = useState("3D Cartoon Creator");
  const [drawerDefaults, setDrawerDefaults] = useState({});

  // Templates (FlowBrowser) + quick modal
  const [showFlows, setShowFlows] = useState(false);
  const [quickFlow, setQuickFlow] = useState({
    open: false,
    title: "",
    defaults: {},
  });

  // Preselect via ?tool=cartoon|avatar|ugc|viral and optional theme
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tool");
    const theme = params.get("theme");
    const openDrawer = params.get("openDrawer");

    if (t && TOOLS.some((x) => x.id === t)) {
      setTool(t);
      const preset = TOOLS.find((x) => x.id === t)?.prompt ?? "";
      if (!prompt) setPrompt(preset);
    }

    if (openDrawer === "1") {
      const themeLabel = THEME_FROM_PARAM[theme] ?? null;
      const title =
        t === "cartoon" || !t ? "3D Cartoon Creator" : "Short animated video";
      setDrawerTitle(title);
      setDrawerDefaults({ theme: themeLabel });
      setDrawerOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentModel = useMemo(
    () => MODELS.find((m) => m.id === model),
    [model]
  );
  const currentTool = useMemo(() => TOOLS.find((t) => t.id === tool), [tool]);

  function startFakeGeneration() {
    const safePrompt =
      prompt.trim() ||
      `${currentTool?.prompt || "Create a short video about: "}AI demo topic`;
    if (!prompt.trim()) setPrompt(safePrompt);

    setIsGenerating(true);
    setProgress(0);
    const timer = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(timer);
          return 100;
        }
        return p + Math.ceil(Math.random() * 8);
      });
    }, 120);
  }

  // Click on a tool => select it and open the drawer
  function openToolDrawer(id) {
    setTool(id);
    const t = TOOLS.find((x) => x.id === id);
    setDrawerTitle(t?.label || "3D Cartoon Creator");
    const preset = t?.prompt ?? "";
    if (!prompt || prompt.startsWith(currentTool?.prompt || "")) {
      setPrompt(preset);
    }
    setDrawerDefaults({ theme: null });
    setDrawerOpen(true);
  }

  // === Templates (FlowBrowser) handling ===
  function handlePickFlow(item) {
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
      window.location.href =
        `/tools/video-generator?tool=cartoon&theme=${encodeURIComponent(
          themeParam
        )}&openDrawer=1`;
      return;
    }

    if (["viral-short", "prompt-to-video", "top10-video"].includes(item?.id)) {
      setQuickFlow({ open: true, title: item.title, defaults: {} });
      return;
    }

    if (item?.route) {
      window.location.href = item.route;
    } else {
      setShowFlows(false);
    }
  }

  // When user clicks "Proceed" inside the animated drawer
  async function handleDrawerProceed({ tool: toolFromDrawer, topic, settings }) { // ADDED async
    const lines = [];
    if (settings?.theme) lines.push(`Theme: ${settings.theme}`);
    if (settings?.bgMusic) lines.push(`Background music: ${settings.bgMusic}`);
    if (settings?.language) lines.push(`Language: ${settings.language}`);
    if (settings?.subtitles && settings.subtitles !== "None")
      lines.push(`Subtitles: ${settings.subtitles}`);
    if (settings?.watermark)
      lines.push(`Watermark: "${settings.watermark}"`);

    const composed = `${toolFromDrawer}: ${topic || ""}\n\nSettings:\n${lines
      .map((l) => `- ${l}`)
      .join("\n")}`;

    // ADDED: enhance before proceeding
    try {
      const { prompt: improved } =
        (await enhancePrompt({ prompt: composed, kind: "video" })) || {};
      setPrompt((improved || composed).trim());
    } catch {
      setPrompt(composed.trim());
    }

    setDrawerOpen(false);
    setPhase("creating");
  }

  // When user clicks "Proceed" inside the QuickFlowModal (non-animated)
  async function handleQuickProceed({ title, topic, settings }) { // ADDED async
    const lines = [];
    if (settings?.bgMusic) lines.push(`Make the background music ${settings.bgMusic}`);
    if (settings?.language) lines.push(`Language ${settings.language}`);
    if (settings?.subtitles && settings.subtitles !== "None")
      lines.push(`Subtitles ${settings.subtitles}`);
    if (settings?.watermark)
      lines.push(`Watermark "${settings.watermark}"`);

    const base =
      `${title}: ${topic || ""}` +
      (lines.length ? `\n\nSettings:\n${lines.map((l) => `- ${l}`).join("\n")}` : "");

    // ADDED: enhance before proceeding
    try {
      const { prompt: improved } =
        (await enhancePrompt({ prompt: base, kind: "video" })) || {};
      setPrompt((improved || base).trim());
    } catch {
      setPrompt(base.trim());
    }

    setQuickFlow({ open: false, title: "", defaults: {} });
    setPhase("creating");
  }

  // Primary CTA from prompt card -> use overlay+post panel too
  async function handlePrimaryGenerateClick() { // ADDED async + enhance
    try {
      const base = prompt?.trim() || "Short, dynamic vertical video about a trending topic";
      const { prompt: improved } =
        (await enhancePrompt({ prompt: base, kind: "video" })) || {};
      if (improved) setPrompt(improved);
    } catch (e) {
      console.warn("prompt enhance failed:", e);
    }
    setPhase("creating");
  }

  // === Real job creation (panel will call this) ===
  async function handleGenerateFromPost({ duration, platform, style, tier, price, resolution }) { // ADDED tier, price, resolution
    const resolvedTier = tier || MODEL_TO_TIER[model] || "zylo-v2"; // ADDED
    const res = resolution || "720p"; // ADDED default bucket for pricing

    const input = {
      source: "video-generator",
      tool,
      model,
      prompt,
      options: { duration, platform, style, resolution: res }, // ADDED resolution
      ui: { theme: drawerDefaults?.theme ?? null },
      created_at_ms: Date.now(),
    };

    const settings = {
      tool,
      model,
      theme: drawerDefaults?.theme ?? null,
      tier: resolvedTier, // ADDED
      price: price ?? null, // ADDED (panel-computed or null → worker may compute)
      resolution: res, // ADDED
      durationSec: duration, // ADDED (helpful to worker)
    };

    const shortPrompt = prompt ? prompt.slice(0, 140) : null;

    const job = await launchJob({
      type: "video",
      input,
      settings,
      prompt: shortPrompt,
      project_id: null,
    });

    setPhase("compose");
    setIsGenerating(false);

    return job;
  }

  // simple pill button
  const ToolPill = ({ id, label, icon: Icon, active, onClick }) => (
    <button
      onClick={onClick}
      className={`${pill} ${
        active
          ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-sm"
          : "bg-white text-blue-600 border border-blue-200 hover:bg-blue-50"
      }`}
      title={TOOLS.find((t) => t.id === id)?.hint}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );

  return (
    <main className="mx-auto max-w-5xl px-6 sm:px-8 py-10">
      <div className="mb-3 text-xs text-black/60">Studios / AI Video Generator</div>

      {/* Prompt card */}
      <section className={`relative rounded-2xl bg-white ${ringGradient} p-4 sm:p-5 shadow-sm`}>
        {/* model dropdown */}
        <div className="mb-3">
          <div className="inline-flex items-center gap-2">
            <div className="relative">
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="appearance-none pr-7 rounded-full bg-black/5 text-black/70 text-xs font-semibold px-3 py-1.5 focus:outline-none"
                title="Model"
              >
                {MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-black/40" />
            </div>

            <span className="text-xs text-black/40">
              No watermark on paid • Beat-synced edits • Brand Kit ready
            </span>
          </div>
        </div>

        {/* prompt + CTA */}
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="rounded-xl border border-black/10 bg-white">
            <textarea
              rows={5}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Give me a topic, your point of view and instructions in any language…"
              className="w-full resize-none rounded-xl p-4 sm:p-5 text-[15px] outline-none"
            />
            <div className="flex items-center justify-between px-4 pb-4 sm:px-5">
              <button
                className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold !text-blue-600 hover:bg-blue-50"
                title="Attach/choose an AI Twin (coming soon)"
              >
                <Sparkles className="h-4 w-4 text-purple-600" />
                AI twins
              </button>

              <button
                onClick={handlePrimaryGenerateClick}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95"
              >
                <Play className="h-4 w-4" />
                Generate my video
              </button>
            </div>
          </div>

          {/* tool chips */}
          <div className="flex flex-wrap gap-2.5">
            {TOOLS.map((t) => (
              <ToolPill
                key={t.id}
                id={t.id}
                label={t.label}
                icon={t.icon}
                active={t.id === tool}
                onClick={() => openToolDrawer(t.id)}
              />
            ))}

            {/* Use my script */}
            <button
              className={`${pill} bg-white text-black/70 border border-black/10 hover:bg-black/5`}
              title="Use my script (paste a complete script)"
              onClick={() => setPrompt("Use this script verbatim:\n\n")}
            >
              <Wand2 className="h-4 w-4" />
              Use my script
            </button>

            {/* Templates (Flows) */}
            <button
              onClick={() => setShowFlows(true)}
              className={`${pill} bg-white text-blue-600 border border-blue-200 hover:bg-blue-50`}
              title="Browse ready-made flows & templates"
            >
              <Grid2x2 className="h-4 w-4" />
              Library
            </button>
          </div>
        </div>
      </section>

      {/* Settings drawer for animated/cartoon flows */}
      <ToolSettingsDrawer
        open={drawerOpen}
        title={drawerTitle}
        defaults={drawerDefaults}
        onClose={() => setDrawerOpen(false)}
        onProceed={handleDrawerProceed}
      />

      {/* Quick modal for non-animated flows */}
      <QuickFlowModal
        open={quickFlow.open}
        title={quickFlow.title}
        defaults={quickFlow.defaults}
        onClose={() => setQuickFlow({ open: false, title: "", defaults: {} })}
        onProceed={handleQuickProceed}
      />

      {/* Flow browser */}
      <FlowBrowser open={showFlows} onClose={() => setShowFlows(false)} onPick={handlePickFlow} />

      {/* 1) Quick “Creating…” overlay */}
      {phase === "creating" && <CreationOverlay onDone={() => setPhase("post")} />}

      <PostRenderSetup
        open={phase === "post"}
        onBack={() => setPhase("compose")}
        onGenerate={handleGenerateFromPost}
        /* Dynamic options driven by the selected tool */
        durationOptions={DURATION_OPTIONS_BY_TOOL[tool] || [8, 15, 30, 45, 60]}
        platformOptions={PLATFORM_OPTIONS_BY_TOOL[tool] || ["TikTok", "Instagram", "YouTube"]}
        styleOptions={STYLE_OPTIONS_BY_TOOL[tool] || ["Cinematic Magical Live Action"]}
        /* Optional defaults */
        defaults={{
          duration: (DURATION_OPTIONS_BY_TOOL[tool] || [30])[0] ?? 30,
          platform: (PLATFORM_OPTIONS_BY_TOOL[tool] || ["YouTube"])[0] ?? "YouTube",
          style: (STYLE_OPTIONS_BY_TOOL[tool] || [])[0] ?? "",
        }}
      />

      {/* Preview / progress (your local fake preview) */}
      <section className="mt-6">
        {isGenerating ? (
          <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold">Rendering preview…</div>
              <div className="text-xs text-black/60">
                Model: {currentModel?.label} • Mode: {currentTool?.label}
              </div>
            </div>

            <div className="h-2 w-full rounded-full bg-black/10">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 transition-all"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>

            {progress >= 100 && (
              <div className="mt-4 text-sm text-black/70">
                Preview ready! (Wire this to your real preview player later.)
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-black/50">
            Select a tool above, configure settings, or enter a prompt—then click{" "}
            <span className="font-semibold">Generate my video</span>.
          </div>
        )}
      </section>
    </main>
  );
}
