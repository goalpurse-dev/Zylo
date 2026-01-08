// src/components/video/ToolSettingsDrawer.jsx
import React, { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import StylePickerGrid from "./StylePickerGrid";

const chip =
  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold border border-blue-200 bg-white text-blue-600 hover:bg-blue-50 transition";

/* ---------------------- Theme normalization helpers ---------------------- */

const THEME_LABELS = [
  "Pixar-ish",
  "Claymation",
  "Lego",
  "Anime",
  "Low-poly",
  "Neon/Glitch",
  "Noir",
];

const THEME_MAP = {
  // Pixar / Disney
  "pixar": "Pixar-ish",
  "pixarish": "Pixar-ish",
  "pixar-ish": "Pixar-ish",
  "disney": "Pixar-ish",
  "disney-pixar": "Pixar-ish",
  "pixar-style": "Pixar-ish",
  // Claymation
  "clay": "Claymation",
  "claymation": "Claymation",
  "stopmotion": "Claymation",
  "stop-motion": "Claymation",
  "claymation-style": "Claymation",
  // Lego
  "lego": "Lego",
  "lego-style": "Lego",
  // Anime
  "anime": "Anime",
  "anime-style": "Anime",
  // Low poly
  "lowpoly": "Low-poly",
  "low-poly": "Low-poly",
  "lowpoly-style": "Low-poly",
  "low-poly-style": "Low-poly",
  // Neon / Glitch
  "neon": "Neon/Glitch",
  "glitch": "Neon/Glitch",
  "neon-glitch": "Neon/Glitch",
  "neon-glitch-style": "Neon/Glitch",
  // Noir
  "noir": "Noir",
  "noir-style": "Noir",

  // (optional) example extra
  "minecraft": "Minecraft",
  "minecraft-style": "Minecraft",
};

function toThemeLabel(v) {
  if (!v) return "";
  // Already a friendly label?
  const byLabel = THEME_LABELS.find(
    (L) => L.toLowerCase() === String(v).trim().toLowerCase()
  );
  if (byLabel) return byLabel;

  // Otherwise accept ids/slugs like "lego-style" -> "Lego"
  let s = String(v).trim().toLowerCase().replace(/\s+|_+/g, "-");
  s = s.replace(/-style$/, ""); // strip trailing "-style" if present
  return THEME_MAP[s] || "";
}

/* ------------------------------- Component ------------------------------- */

export default function ToolSettingsDrawer({
  open,
  onClose = () => {},
  onProceed = () => {},
  title = "3D Cartoon Creator",
  defaultTopic = "",
  defaults = {
    bgMusic: "",
    language: "English",
    subtitles: "None",
    watermark: "",
    // You may pass either:
    // - themeId: "lego" | "lego-style" | "pixar" ...
    // - theme:   "Lego" | "Pixar-ish" (friendly label)
    themeId: null,
    theme: null,
  },
  toolId = "cartoon",
}) {
  const [topic, setTopic] = useState(defaultTopic || "");
  const [bgMusic, setBgMusic] = useState(defaults.bgMusic || "");
  const [language, setLanguage] = useState(defaults.language || "English");
  const [subtitles, setSubtitles] = useState(defaults.subtitles || "None");
  const [watermark, setWatermark] = useState(defaults.watermark || "");
  const [theme, setTheme] = useState(""); // always store the friendly label for the grid

  // which chips are expanded
  const [openFields, setOpenFields] = useState([]);

  const openField = (id) =>
    setOpenFields((prev) => (prev.includes(id) ? prev : [...prev, id]));
  const closeField = (id) =>
    setOpenFields((prev) => prev.filter((x) => x !== id));

  // validation
  const [themeError, setThemeError] = useState(false);
  const isValid = useMemo(() => Boolean(theme), [theme]);

  // —— Robust close/back handlers ——
  const handleClose = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    onClose();
  };
  const handleBack = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    onClose();
  };

  // Sync state on open; preselect & open Theme if defaults.themeId/theme exists
  useEffect(() => {
    if (!open) return;

    setTopic(defaultTopic || "");
    setBgMusic(defaults.bgMusic || "");
    setLanguage(defaults.language || "English");
    setSubtitles(defaults.subtitles || "None");
    setWatermark(defaults.watermark || "");

    const incoming = defaults.themeId ?? defaults.theme ?? "";
    const label = toThemeLabel(incoming);
    if (label) {
      setTheme(label);          // ✅ StylePickerGrid highlights the tile
      setThemeError(false);
      setOpenFields((prev) =>
        prev.includes("theme") ? prev : ["theme", ...prev] // expand Theme
      );
    } else {
      setTheme("");
    }
  }, [
    open,
    defaultTopic,
    defaults.bgMusic,
    defaults.language,
    defaults.subtitles,
    defaults.watermark,
    defaults.themeId,
    defaults.theme,
  ]);

  const handleProceed = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (!theme) {
      setThemeError(true);
      openField("theme");
      return;
    }
    onProceed({
      tool: title,
      topic,
      settings: { theme, bgMusic, language, subtitles, watermark },
    });
  };

  const chipList = [
    {
      id: "theme",
      label: "Theme",
      content: (
        <StylePickerGrid
          value={theme}
          onChange={(val) => {
            setTheme(toThemeLabel(val));
            setThemeError(false);
          }}
          required
          showError={themeError}
          setShowError={setThemeError}
        />
      ),
    },
    {
      id: "language",
      label: "Language",
      content: (
        <div className="space-y-2">
          <label className="text-sm font-semibold text-black">Language</label>
          <select
            className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-200"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            {["English", "Spanish", "German", "French", "Italian"].map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </div>
      ),
    },
    {
      id: "subs",
      label: "Subtitles",
      content: (
        <div className="space-y-2">
          <label className="text-sm font-semibold text-black">Subtitles</label>
          <select
            className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-200"
            value={subtitles}
            onChange={(e) => setSubtitles(e.target.value)}
          >
            {["None", "Karaoke", "Burned-in", "SRT output"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      ),
    },
    {
      id: "wm",
      label: "Watermark Text",
      content: (
        <div className="space-y-2">
          <label className="text-sm font-semibold text-black">Watermark text</label>
          <input
            className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-[15px] placeholder:text-black/30 focus:outline-none focus:ring-2 focus:ring-blue-200"
            placeholder="watermark text"
            value={watermark}
            onChange={(e) => setWatermark(e.target.value)}
          />
        </div>
      ),
    },
    {
      id: "bg",
      label: "Background music",
      content: (
        <div className="space-y-2">
          <label className="text-sm font-semibold text-black">Background music</label>
          <input
            type="text"
            className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-[15px] placeholder:text-black/30 focus:outline-none focus:ring-2 focus:ring-blue-200"
            placeholder="e.g., chill lofi, fast and energetic"
            value={bgMusic}
            onChange={(e) => setBgMusic(e.target.value)}
          />
        </div>
      ),
    },
  ];

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 sm:p-8"
      onClick={handleClose} // click overlay to close
    >
      <div
        className="w-full max-w-5xl rounded-2xl bg-white p-4 sm:p-6 shadow-xl ring-1 ring-black/5"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}     // prevent overlay close
        onMouseDown={(e) => e.stopPropagation()} // guard on some browsers
      >
        {/* Title + Close */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-black">{title}</h3>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1.5 text-sm font-semibold text-black/70 hover:bg-black/5"
            title="Close"
          >
            <X className="h-4 w-4 text-black/70" />
            Close
          </button>
        </div>

        {/* Topic */}
        <div className="mb-4">
          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-black/60">
            Topic
          </label>
          <input
            placeholder="Type your topic here"
            className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-[15px] placeholder:text-black/30 focus:outline-none focus:ring-2 focus:ring-blue-200"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
        </div>

        {/* Chips row (unopened) */}
        <div className="mb-3 flex flex-wrap gap-2">
          {chipList
            .filter((c) => !openFields.includes(c.id))
            .map((c) => (
              <button
                key={c.id}
                type="button"
                className={chip}
                onClick={() => openField(c.id)}
              >
                {c.label} <span className="text-blue-500">+</span>
              </button>
            ))}
        </div>

        {/* Expanded sections */}
        <div className="space-y-4">
          {chipList
            .filter((c) => openFields.includes(c.id))
            .map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-blue-200 p-3 sm:p-4 ring-1 ring-blue-100"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-black">{c.label}</span>
                  <button
                    type="button"
                    onClick={() => closeField(c.id)}
                    className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-2.5 py-1 text-xs font-semibold text-black/70 hover:bg-black/5"
                    title="Remove"
                  >
                    <X className="h-3.5 w-3.5 text-black/70" />
                    Remove
                  </button>
                </div>
                {c.content}
              </div>
            ))}
        </div>

        {/* Footer actions */}
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleBack}
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-black/70 hover:bg-black/5"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleProceed}
            disabled={!isValid}
            className={[
              "rounded-full px-5 py-2 text-sm font-semibold shadow-sm",
              isValid
                ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-95"
                : "bg-black/10 text-black/40 cursor-not-allowed",
            ].join(" ")}
          >
            Proceed
          </button>
        </div>
      </div>
    </div>
  );
}
