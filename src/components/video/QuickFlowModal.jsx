// src/components/video/QuickFlowModal.jsx
import React, { useState } from "react";
import { X } from "lucide-react";

const chip =
  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold border border-blue-200 bg-white text-blue-600 hover:bg-blue-50 transition";

export default function QuickFlowModal({
  open,
  onClose,
  onProceed,
  title = "Create video",
  defaults = {
    topic: "",
    language: "English",
    subtitles: "None",
    watermark: "",
    bgMusic: "",
  },
}) {
  if (!open) return null;

  const [topic, setTopic] = useState(defaults.topic || "");
  const [language, setLanguage] = useState(defaults.language || "English");
  const [subtitles, setSubtitles] = useState(defaults.subtitles || "None");
  const [watermark, setWatermark] = useState(defaults.watermark || "");
  const [bgMusic, setBgMusic] = useState(defaults.bgMusic || "");
  const [openFields, setOpenFields] = useState([]);

  const openField = (id) =>
    setOpenFields((prev) => (prev.includes(id) ? prev : [...prev, id]));
  const closeField = (id) =>
    setOpenFields((prev) => prev.filter((x) => x !== id));

  const chipList = [
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

  const handleProceed = () => {
    onProceed?.({
      title,
      topic,
      settings: { language, subtitles, watermark, bgMusic },
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/30 p-4 sm:p-8">
      <div className="w-full max-w-5xl rounded-2xl bg-white p-4 sm:p-6 shadow-xl ring-1 ring-black/5">
        {/* Title + Close */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-black">{title}</h3>
          <button
            onClick={onClose}
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

        {/* Chips row (only unopened chips are shown) */}
        <div className="mb-3 flex flex-wrap gap-2">
          {chipList
            .filter((c) => !openFields.includes(c.id))
            .map((c) => (
              <button key={c.id} className={chip} onClick={() => openField(c.id)}>
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
            onClick={onClose}
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-black/70 hover:bg-black/5"
          >
            Back
          </button>
          <button
            onClick={handleProceed}
            className="rounded-full px-5 py-2 text-sm font-semibold shadow-sm bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-95"
          >
            Proceed
          </button>
        </div>
      </div>
    </div>
  );
}