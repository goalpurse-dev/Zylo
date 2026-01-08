// src/pages/CartoonCreator.jsx
import React, { useMemo, useState } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import VoiceAndLanguageStep from "../components/VoiceAndLanguageStep";
import SubtitleStyleStep from "../components/SubtitleStyleStep";

/* Lightweight modal used for refinement pop-overs */
function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-[min(560px,92vw)] rounded-2xl bg-white text-black shadow-2xl border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-black transition"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        <div className="px-5 pb-4">
          <Button onClick={onClose} className="w-full">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function CartoonCreator() {
  const [step, setStep] = useState(1);

  // step 1
  const [prompt, setPrompt] = useState("");
  const [length, setLength] = useState(null); // 15 | 30 | 45 | 60

  // step 2
  const [theme, setTheme] = useState(null);

  // step 3 – voice & language
  const [voicePayload, setVoicePayload] = useState({
    isValid: false,
    voiceId: null,
    language: "auto",
    sliders: { styleExaggeration: 25, stability: 30, volume: 65, speed: 45 },
  });

  // step 4 – text (subtitles) selection
  const [textPayload, setTextPayload] = useState({
    isValid: false,
    enabled: true,
    styleId: null,
    styleName: null,
  });

  // refinements (step 1)
  const [refMusic, setRefMusic] = useState("");
  const [refWatermark, setRefWatermark] = useState("");
  const [refModel, setRefModel] = useState("Zylo-5");
  const [openRef, setOpenRef] = useState(null); // "music"|"wm"|"model"|null

  const charCount = prompt.length;
  const promptOk = charCount > 0;
  const lengthOk = Boolean(length);

  // Step-by-step gating (now 5 steps)
  const canGoNext = (() => {
    if (step === 1) return promptOk && lengthOk;
    if (step === 2) return Boolean(theme);
    if (step === 3) return voicePayload.isValid;
    if (step === 4) return textPayload.isValid; // either disabled or style selected
    return true;
  })();

  const next = () => setStep((s) => Math.min(s + 1, 5));
  const back = () => setStep((s) => Math.max(s - 1, 1));

  // Zylo models (modal in step 1)
  const modelDescriptions = useMemo(
    () => ({
      "Zylo-5": {
        badge: "Best overall",
        desc:
          "Newest generation. Sharpest character fidelity, smoothest motion, and the most consistent scene continuity. Ideal for production-ready shorts.",
      },
      "Zylo-4": {
        badge: null,
        desc:
          "High-quality render with great detail and reliable pacing. A strong choice for creators who want quality with slightly faster turnaround.",
      },
      "Zylo-3": {
        badge: null,
        desc:
          "Balanced detail and speed. Perfect for drafts, ideation, and daily content where volume matters.",
      },
      "Zylo-Mini": {
        badge: "Fastest",
        desc:
          "Ultra-fast iterations at a fraction of the compute. Great for previews, A/B tests, and quick try-outs.",
      },
    }),
    []
  );

  // THEME CATALOG (unchanged – your images already work)
  const THEMES = [
    {
      key: "anime",
      name: "Anime / Manga",
      desc:
        "Bold outlines, expressive faces, dynamic motion lines—perfect for punchy, high-energy shorts.",
      img: "/themes/anime.png",
    },
    {
      key: "pixar",
      name: "Cartoon (3D Pixar)",
      desc:
        "Soft lighting, rounded characters and charming depth—family-friendly vibes with cinematic polish.",
      img: "/themes/pixar.png",
    },
    {
      key: "realistic",
      name: "Realistic AI Portrait",
      desc:
        "High-detail textures and lifelike faces. Great for ‘what if’ reels and grounded narratives.",
      img: "/themes/realistic.png",
    },
    {
      key: "fantasy",
      name: "Fantasy (Knight / Elf / Cyberpunk)",
      desc:
        "Stylized outfits, magical effects and world-building accents—heroic and adventurous.",
      img: "/themes/fantasy.png",
    },
    {
      key: "comic",
      name: "Comic Book",
      desc:
        "Halftones, captions and onomatopoeia—pop art energy that reads instantly in-feed.",
      img: "/themes/comic.png",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 text-black">
      {/* Header */}
      <div className="mb-6">
        <div className="text-xs font-bold tracking-widest uppercase text-[#007BFF]">
          3D Cartoon Creator
        </div>
        <h1 className="mt-2 text-[28px] sm:text-[34px] md:text-[38px] font-extrabold leading-tight">
          Bring your ideas to life as a 3D cartoon
        </h1>
        <p className="mt-2 text-gray-600">
          Describe the scene, pick a duration and style, then choose a voice, text & model.
          We’ll assemble an animated short—ready for Reels/Shorts.
        </p>
      </div>

      {/* Stepper (5 steps now) */}
      <div className="flex items-center gap-6 mb-6">
        {[
          { k: 1, label: "Prompt" },
          { k: 2, label: "Theme" },
          { k: 3, label: "Voice" },
          { k: 4, label: "Text" },
          { k: 5, label: "Preview" },
        ].map(({ k, label }) => (
          <div key={k} className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-full grid place-items-center text-xs font-bold ${
                step === k ? "bg-[#007BFF] text-white" : "bg-gray-200 text-gray-700"
              }`}
            >
              {k}
            </div>
            <div
              className={`text-sm font-medium ${
                step === k ? "text-[#007BFF]" : "text-gray-500"
              }`}
            >
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* STEP 1 – PROMPT (unchanged except refinements language removed earlier) */}
      {step === 1 && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* left */}
          <Card className="lg:col-span-2 border border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">1) Describe your cartoon</h2>
                <div className="text-xs text-gray-400">{charCount}/600</div>
              </div>

              <p className="text-sm text-gray-600 mt-1">
                Briefly explain what should happen on screen. Mention the main
                character(s), setting, mood and any specific actions.
              </p>

              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value.slice(0, 600))}
                className="mt-3 w-full min-h-[180px] rounded-md border border-gray-300 p-3 text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#007BFF]/30 focus:border-[#007BFF]"
                placeholder={`e.g. “A red-haired kid builds a cardboard robot in his garage. The robot comes alive, they high-five and race outside.”`}
              />

              {/* length selector */}
              <div className="mt-5">
                <div className="text-sm font-semibold mb-2">Pick a video length</div>
                <div className="flex gap-3">
                  {[15, 30, 45, 60].map((len) => {
                    const active = length === len;
                    return (
                      <button
                        key={len}
                        onClick={() => setLength(len)}
                        className={`h-10 px-4 rounded-md border text-sm transition ${
                          active
                            ? "bg-[#007BFF] text-white border-[#007BFF] shadow-md"
                            : "bg-white text-black border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {len}s
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Refinements */}
              <div className="mt-6 pt-5 border-t border-gray-200">
                <div className="text-sm font-semibold mb-2">
                  Refinements <span className="text-gray-400">(optional)</span>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => setOpenRef("music")}
                    className="px-3 h-9 rounded-full border border-gray-300 bg-white text-black text-sm hover:bg-gray-50"
                    title="Click to add background music instructions"
                  >
                    Background music
                    {refMusic ? <span className="ml-2 text-gray-500">· {refMusic}</span> : null}
                    <span className="ml-1 text-gray-400">ⓘ</span>
                  </button>

                  <button
                    onClick={() => setOpenRef("wm")}
                    className="px-3 h-9 rounded-full border border-gray-300 bg-white text-black text-sm hover:bg-gray-50"
                    title="Click to add watermark text"
                  >
                    Watermark
                    {refWatermark ? (
                      <span className="ml-2 text-gray-500">· Set</span>
                    ) : (
                      <span className="ml-2 text-gray-400">· None</span>
                    )}
                    <span className="ml-1 text-gray-400">ⓘ</span>
                  </button>

                  <button
                    onClick={() => setOpenRef("model")}
                    className="px-3 h-9 rounded-full border border-gray-300 bg-white text-black text-sm hover:bg-gray-50"
                    title="Click to choose the rendering model"
                  >
                    Model <span className="ml-2 text-gray-500">· {refModel}</span>
                    <span className="ml-1 text-gray-400">ⓘ</span>
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* right tips */}
          <Card className="border border-gray-200">
            <CardContent className="p-6">
              <h3 className="text-sm font-bold">Tips</h3>
              <ul className="mt-3 space-y-2 text-sm text-gray-600 list-disc list-inside">
                <li>Be specific about actions (“runs”, “jumps”, “waves”).</li>
                <li>Mention tone (“funny”, “dramatic”, “wholesome”).</li>
                <li>Add details (weather, time of day, season, prop gags).</li>
              </ul>

              <div className="mt-4 text-xs font-semibold text-gray-500">Examples</div>
              <div className="mt-2 space-y-2">
                <div className="text-sm bg-gray-50 border border-gray-200 rounded-md p-2">
                  “Space raccoon fixes a tiny ship, blasts off, and returns with
                  cosmic ice cream. Bright, playful.”
                </div>
                <div className="text-sm bg-gray-50 border border-gray-200 rounded-md p-2">
                  “Knight and dragon cooperate to rescue lost sheep. Sunset
                  meadow, warm & heartfelt.”
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* STEP 2 – THEME SELECTOR (same as you have now) */}
      {step === 2 && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* left: theme grid */}
          <Card className="lg:col-span-2 border border-gray-200">
            <CardContent className="p-6">
              <h2 className="text-lg font-bold">2) Choose a Theme</h2>
              <p className="text-sm text-gray-600 mt-1">
                Pick the visual style for your video. You can preview and change it later.
              </p>

              <div className="mt-4 grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {THEMES.map((t) => {
                  const active = theme?.key === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => setTheme(t)}
                      className={`text-left rounded-xl border overflow-hidden transition group flex flex-col h-full ${
                        active ? "border-[#7A3BFF] ring-2 ring-[#7A3BFF]/30" : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="w-full bg-gray-100 flex items-center justify-center h-44 sm:h-48 md:h-52 lg:h-56">
                        <img
                          src={t.img}
                          alt={t.name}
                          className="max-w-full max-h-full object-contain group-hover:scale-[1.02] transition-transform"
                          loading="lazy"
                        />
                      </div>
                      <div className="p-3 flex-1 flex flex-col">
                        <div className="flex items-center justify-between">
                          <div className="font-semibold">{t.name}</div>
                          {active && (
                            <span className="text-xs px-2 py-[2px] rounded-full bg-[#7A3BFF]/10 text-[#7A3BFF] border border-[#7A3BFF]/30">
                              Selected
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{t.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* right: preview / details */}
          <Card className="border border-gray-200">
            <CardContent className="p-6">
              <h3 className="text-sm font-bold">Preview</h3>
              {!theme ? (
                <div className="mt-3 h-48 grid place-items-center text-gray-400 bg-gray-50 border border-dashed border-gray-200 rounded-md">
                  Select a theme to preview
                </div>
              ) : (
                <>
                  <div className="mt-3 w-full bg-gray-100 border border-gray-200 rounded-md flex items-center justify-center h-56">
                    <img
                      src={theme.img}
                      alt={theme.name}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  <div className="mt-3">
                    <div className="font-semibold">{theme.name}</div>
                    <p className="text-sm text-gray-600 mt-1">{theme.desc}</p>
                  </div>
                </>
              )}
              <div className="mt-4 text-xs text-gray-500">
                You can switch the theme later if it doesn’t fit your script.
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* STEP 3 – Voice & Language (scrollable component) */}
      {step === 3 && (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-extrabold text-black mb-4">3) Voice & Language</h2>
          <VoiceAndLanguageStep onComplete={setVoicePayload} />
        </div>
      )}

      {/* STEP 4 – Text (Subtitles) – NEW */}
      {step === 4 && (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-extrabold text-black mb-4">4) Text (Subtitles)</h2>
          <SubtitleStyleStep onComplete={setTextPayload} initial={textPayload} />
        </div>
      )}

     {/* STEP 5 – Review & Generate (with Change buttons) */}
{step === 5 && (
  <Card className="border border-gray-200">
    <CardContent className="p-6">
      <h2 className="text-lg font-bold">5) Review & Generate</h2>

      {/* (Optional) keep a small visual placeholder on top */}
      <div className="mt-3 h-40 bg-gray-50 border border-gray-200 rounded-md grid place-items-center text-gray-400">
        Video preview placeholder
      </div>

      {/* Review list */}
      <div className="mt-6 rounded-2xl border border-gray-200 divide-y">
        {/* Row 1 – Prompt */}
        <div className="flex items-start justify-between p-4">
          <div>
            <div className="text-sm font-semibold text-gray-900">1) Prompt</div>
            <div className="mt-1 text-sm text-gray-600">
              {prompt?.length ? (
                <>
                  {prompt.length > 140 ? `${prompt.slice(0, 140)}…` : prompt}
                  <span className="ml-2 text-gray-400">({prompt.length}/600)</span>
                </>
              ) : (
                <span className="italic text-gray-400">No prompt</span>
              )}
            </div>
            <div className="mt-1 text-xs text-gray-500">
              Length: <span className="font-medium text-gray-700">{length || "-"}</span>s
            </div>
          </div>
          <Button variant="outline" onClick={() => setStep(1)}>
            Change
          </Button>
        </div>

        {/* Row 2 – Theme */}
        <div className="flex items-center justify-between p-4">
          <div>
            <div className="text-sm font-semibold text-gray-900">2) Theme</div>
            <div className="mt-1 text-sm text-gray-600">
              {theme?.name || <span className="italic text-gray-400">Not selected</span>}
            </div>
          </div>
          <Button variant="outline" onClick={() => setStep(2)}>
            Change
          </Button>
        </div>

        {/* Row 3 – Voice */}
        <div className="flex items-center justify-between p-4">
          <div>
            <div className="text-sm font-semibold text-gray-900">3) Voice</div>
            <div className="mt-1 text-sm text-gray-600">
              {voicePayload?.voiceId ? (
                <>
                  {voicePayload.voiceId}{" "}
                  <span className="text-gray-400">
                    ({voicePayload.language?.toUpperCase?.() || "AUTO"})
                  </span>
                </>
              ) : (
                <span className="italic text-gray-400">Not selected</span>
              )}
            </div>
          </div>
          <Button variant="outline" onClick={() => setStep(3)}>
            Change
          </Button>
        </div>

        {/* Row 4 – Text (Subtitles) */}
        <div className="flex items-center justify-between p-4">
          <div>
            <div className="text-sm font-semibold text-gray-900">4) Text (Subtitles)</div>
            <div className="mt-1 text-sm text-gray-600">
              {textPayload?.enabled
                ? textPayload?.styleName || <span className="italic text-gray-400">Style not selected</span>
                : "Disabled"}
            </div>
          </div>
          <Button variant="outline" onClick={() => setStep(4)}>
            Change
          </Button>
        </div>
      </div>

      {/* Footer actions */}
      
    </CardContent>
  </Card>
)}

      {/* Navigation */}
      <div className="mt-8 flex justify-between">
        {step > 1 ? (
          <Button onClick={back} variant="outline">
            Back
          </Button>
        ) : (
          <div />
        )}

        <Button
          onClick={next}
          disabled={!canGoNext}
          className="flex items-center gap-2 disabled:opacity-60"
        >
          {step === 5 ? "Generate" : "Next"} <span>▸</span>
        </Button>
      </div>

      {/* REFINEMENT MODALS (step 1) */}
      <Modal
        open={openRef === "music"}
        onClose={() => setOpenRef(null)}
        title="Background music"
      >
        <label className="text-sm text-gray-600">
          Describe the vibe you want. We’ll match a track.
        </label>
        <input
          value={refMusic}
          onChange={(e) => setRefMusic(e.target.value)}
          placeholder="e.g., fast and energetic, chill lo-fi, whimsical"
          className="mt-2 w-full h-11 rounded-md border border-gray-300 px-3 text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#007BFF]/30 focus:border-[#007BFF]"
        />
      </Modal>

      <Modal
        open={openRef === "wm"}
        onClose={() => setOpenRef(null)}
        title="Watermark text"
      >
        <label className="text-sm text-gray-600">
          Optional watermark text (channel, @handle, etc.)
        </label>
        <input
          value={refWatermark}
          onChange={(e) => setRefWatermark(e.target.value)}
          placeholder="@zyloai"
          className="mt-2 w-full h-11 rounded-md border border-gray-300 px-3 text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#007BFF]/30 focus:border-[#007BFF]"
        />
      </Modal>

      <Modal
        open={openRef === "model"}
        onClose={() => setOpenRef(null)}
        title="Rendering model"
      >
        <div className="space-y-3">
          {Object.entries(modelDescriptions).map(([name, info]) => {
            const active = refModel === name;
            return (
              <button
                key={name}
                onClick={() => setRefModel(name)}
                className={`w-full text-left rounded-lg border p-3 transition ${
                  active ? "border-[#7A3BFF] ring-2 ring-[#7A3BFF]/30 bg-white" : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="font-semibold">{name}</div>
                  {info.badge && (
                    <span className="text-xs px-2 py-[2px] rounded-full bg-[#7A3BFF]/10 text-[#7A3BFF] border border-[#7A3BFF]/30">
                      {info.badge}
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600 mt-1">{info.desc}</div>
              </button>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
