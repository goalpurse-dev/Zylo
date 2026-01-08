// src/components/video/InlineToolSheet.jsx
import React, { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";

/**
 * Inline settings sheet that opens over FlowBrowser.
 * - black card, centered
 * - banner space at the top
 * - chips row: when a chip is opened as a panel it disappears from choices
 * - removing a panel brings the chip back
 */

const CHIP_DEFS = {
  language:  { id: "language",  label: "Language +" },
  subtitles: { id: "subtitles", label: "Subtitles +" },
  watermark: { id: "watermark", label: "Watermark Text +" },
  bgm:       { id: "bgm",       label: "Background music +" },
};

// simple text field block (used for watermark & bgm)
const TextBlock = ({ title, placeholder, value, onChange, onRemove }) => (
  <div className="rounded-xl border border-white/10 bg-[#111] p-4 sm:p-5">
    <div className="mb-2 flex items-center justify-between">
      <div className="font-semibold text-white">{title}</div>
      <button
        onClick={onRemove}
        className="rounded-full border border-white/10 px-2 py-1 text-xs text-white/80 hover:bg-white/5"
      >
        ✕ Remove
      </button>
    </div>
    <input
      className="w-full rounded-lg border border-white/10 bg-[#0b0b0b] px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500/30"
      placeholder={placeholder}
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

export default function InlineToolSheet({
  open,
  title = "Settings",
  bannerImage,                 // optional
  chips = ["language", "subtitles", "watermark", "bgm"], // ← no Voice Actors
  defaults = {},
  onClose,
  onProceed,
}) {
  const allChipDefs = useMemo(
    () => chips.map((id) => CHIP_DEFS[id]).filter(Boolean),
    [chips]
  );

  // which panels are open, and the values for each
  const [panels, setPanels] = useState([]); // array of chip ids
  const [form, setForm] = useState({
    topic: "",
    platform: defaults?.platform ?? "TikTok",
    theme: defaults?.theme ?? null,
    ...defaults,
  });

  useEffect(() => {
    if (!open) {
      setPanels([]);
      setForm({
        topic: "",
        platform: defaults?.platform ?? "TikTok",
        theme: defaults?.theme ?? null,
        ...defaults,
      });
    }
  }, [open, defaults]);

  if (!open) return null;

  // chips available to add (not already opened as a panel)
  const available = allChipDefs.filter((c) => !panels.includes(c.id));

  const addPanel = (id) => setPanels((p) => (p.includes(id) ? p : [...p, id]));
  const removePanel = (id) => setPanels((p) => p.filter((x) => x !== id));
  const setField = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleProceed = () => {
    onProceed?.({
      topic: form.topic?.trim(),
      platform: form.platform,
      settings: Object.fromEntries(
        panels.map((id) => [
          id,
          id === "subtitles"
            ? form.subtitles === "on" ? "on" : "off"
            : form[id] || "",
        ])
      ),
      openedPanels: panels,
    });
  };

  const LANGS = ["English", "Spanish", "French", "German", "Italian"];

  return (
    <div className="fixed inset-0 z-[80]">
      {/* dark blur overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* sheet (CENTERED) */}
      <div
        className={[
          "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
          "w-[min(100vw-24px,980px)]",
          "rounded-2xl bg-[#0f0f10] text-white shadow-[0_40px_100px_rgba(0,0,0,0.6)]",
          "ring-1 ring-white/10 overflow-hidden",
          "animate-[sheetIn_.18s_ease-out]",
        ].join(" ")}
      >
       {/* banner / hero — bright image + 25% bottom fade */}
<div className="relative h-40 sm:h-44 overflow-hidden">
  {bannerImage && (
    <img
      src={bannerImage}
      alt=""
      className="absolute inset-0 h-full w-full object-cover"
    />
  )}

  {/* only the bottom quarter fades: darkest at bottom → transparent by 25% */}
  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[25%] bg-gradient-to-t from-black/90 via-black/60 to-transparent" />

  <div className="absolute inset-x-0 bottom-0 p-5">
    <div className="text-lg sm:text-xl font-extrabold text-white">{title}</div>
  </div>

  <button
    onClick={onClose}
    className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1.5 text-sm font-semibold text-black shadow-sm hover:bg-white"
  >
    <X className="h-4 w-4" />
    Close
  </button>
</div>

        {/* body */}
        <div className="p-5 sm:p-6">
          {/* topic */}
          <div className="mb-3">
            <div className="mb-1 text-xs font-semibold text-white/60">TOPIC</div>
            <input
              className="w-full rounded-lg border border-white/10 bg-[#0b0b0b] px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500/30"
              placeholder="Type your topic here"
              value={form.topic || ""}
              onChange={(e) => setField("topic", e.target.value)}
            />
          </div>

          {/* platform */}
          <div className="mb-3">
            <div className="mb-1 text-xs font-semibold text-white/60">PLATFORM</div>
            <select
              className="w-full rounded-lg border border-white/10 bg-[#0b0b0b] px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500/30"
              value={form.platform}
              onChange={(e) => setField("platform", e.target.value)}
            >
              <option value="TikTok">TikTok</option>
              <option value="YouTube">YouTube</option>
              <option value="Instagram">Instagram</option>
            </select>
          </div>

          {/* chips row */}
          {!!available.length && (
            <div className="mb-4 flex flex-wrap gap-2">
              {available.map((c) => (
                <button
                  key={c.id}
                  onClick={() => addPanel(c.id)}
                  className="rounded-full border border-white/10 bg-[#141416] px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/5"
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}

          {/* opened panels */}
          <div className="space-y-4">
            {panels.map((id) => {
              if (id === "language") {
                return (
                  <div
                    key={id}
                    className="rounded-xl border border-white/10 bg-[#111] p-4 sm:p-5"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div className="font-semibold">Language</div>
                      <button
                        onClick={() => removePanel(id)}
                        className="rounded-full border border-white/10 px-2 py-1 text-xs text-white/80 hover:bg-white/5"
                      >
                        ✕ Remove
                      </button>
                    </div>
                    <select
                      value={form.language || ""}
                      onChange={(e) => setField("language", e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-[#0b0b0b] px-3 py-2 text-white outline-none"
                    >
                      <option value="" disabled>
                        Select a language…
                      </option>
                      {LANGS.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              }

              if (id === "subtitles") {
                const on = (form.subtitles || "off") === "on";
                return (
                  <div
                    key={id}
                    className="rounded-xl border border-white/10 bg-[#111] p-4 sm:p-5"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div className="font-semibold">Subtitles</div>
                      <button
                        onClick={() => removePanel(id)}
                        className="rounded-full border border-white/10 px-2 py-1 text-xs text-white/80 hover:bg-white/5"
                      >
                        ✕ Remove
                      </button>
                    </div>

                    <div className="inline-flex rounded-full bg-[#0b0b0b] p-1 border border-white/10">
                      <button
                        onClick={() => setField("subtitles", "on")}
                        className={`px-4 py-1.5 rounded-full text-sm ${
                          on ? "bg-white text-black" : "text-white/80"
                        }`}
                      >
                        On
                      </button>
                      <button
                        onClick={() => setField("subtitles", "off")}
                        className={`px-4 py-1.5 rounded-full text-sm ${
                          !on ? "bg-white text-black" : "text-white/80"
                        }`}
                      >
                        Off
                      </button>
                    </div>
                  </div>
                );
              }

              if (id === "watermark") {
                return (
                  <TextBlock
                    key={id}
                    title="Watermark Text"
                    placeholder="Your brand or channel name"
                    value={form.watermark}
                    onChange={(v) => setField("watermark", v)}
                    onRemove={() => removePanel(id)}
                  />
                );
              }

              if (id === "bgm") {
                return (
                  <TextBlock
                    key={id}
                    title="Background music"
                    placeholder="Calm lo-fi, upbeat pop…"
                    value={form.bgm}
                    onChange={(v) => setField("bgm", v)}
                    onRemove={() => removePanel(id)}
                  />
                );
              }

              return null;
            })}
          </div>

          {/* actions */}
          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={onClose}
              className="rounded-full border border-white/10 bg-[#141416] px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/5"
            >
              Back
            </button>
            <button
              onClick={handleProceed}
              className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95"
            >
              Proceed
            </button>
          </div>
        </div>
      </div>

      {/* slide-up keyframe */}
      <style>{`
        @keyframes sheetIn {
          0%   { transform: translateY(36px); opacity: 0; }
          100% { transform: translateY(0);   opacity: 1; }
        }
      `}</style>
    </div>
  );
}
