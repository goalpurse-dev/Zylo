// src/pages/assistant/ZyloPromptAssistant.jsx
import React, { useMemo, useRef, useState } from "react";
import { Send, Plus, Settings2, Sparkles, MessageSquarePlus, Music2, ImagePlus } from "lucide-react";

function cx(...xs){ return xs.filter(Boolean).join(" "); }

const SUGGESTIONS = [
  { icon: <ImagePlus className="w-4 h-4" />, text: "Create/modify an Image or video", key: "create" },
  { icon: <Sparkles className="w-4 h-4" />, text: "What makes a good prompt?", key: "prompt-tips" },
  { icon: <MessageSquarePlus className="w-4 h-4" />, text: "Tell me about Zylo", key: "about" },
  { icon: <Music2 className="w-4 h-4" />, text: "Create a video with sound", key: "video-sound" },
];

const RATIOS = [
  { id: "16:9", label: "16:9" },
  { id: "1:1",  label: "1:1"  },
  { id: "9:16", label: "9:16" },
];

export default function ZyloPromptAssistant() {
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Hello, I'm Zylo’s creative assistant. Describe what you want and I’ll write a perfect prompt and payload for our generators." }
  ]);
  const [input, setInput] = useState("");
  const [ratio, setRatio] = useState("16:9");
  const [showSettings, setShowSettings] = useState(false);
  const [custom, setCustom] = useState({ tone: "punchy", brand: "auto-detect", safety: "strict" });
  const [mode, setMode] = useState("all"); // all | image | video
  const listRef = useRef(null);

  const canSend = input.trim().length > 0;

  function addSuggestion(key){
    const map = {
      "create": "I want to create a product ad. Ask me for brand, product image (with/without bg), avatar or background narrator, and scene count.",
      "prompt-tips": "Explain briefly how to write a great ad prompt for Zylo (hook, subject, motion, lighting, CTA).",
      "about": "Summarize what Zylo can generate (product photos, ads v2–v5, avatar lip-sync, narrator), and how credits work.",
      "video-sound": "Set up a video with background narrator (no lip-sync) and optional avatar segments. Include timestamps per scene.",
    };
    setInput(map[key]);
  }

  function push(role, text){ setMessages(m => [...m, { role, text }]); }

  async function onSend(){
    if (!canSend) return;
    const userText = input.trim();
    setInput("");
    push("user", userText);

    // --- Placeholder: call your backend (Responses API) ---
    // const res = await fetch("/api/assistant", { method:"POST", body: JSON.stringify({ text:userText, ratio, mode, custom }) });
    // const data = await res.json();

    // For now, synthesize an answer that builds a prompt + payload Zylo understands:
    const reply = buildZyloDraft(userText, ratio, mode, custom);
    push("assistant", reply);

    // optional: auto-scroll
    queueMicrotask(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior:"smooth" }));
  }

  return (
    <div className="min-h-[calc(100vh-80px)] w-full mx-auto max-w-4xl px-4 py-6
                    bg-[#f3efe9] text-[#0b1220]">
      {/* Header / Suggestions */}
      <div className="mb-4">
        <h1 className="text-lg font-semibold">Hello, I'm Zylo’s creative assistant.</h1>
        <p className="text-sm text-[#5b6275]">Describe what you want and I’ll write a prompt to generate it. What would you like to create?</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map(s => (
            <button
              key={s.key}
              onClick={() => addSuggestion(s.key)}
              className="inline-flex items-center gap-2 rounded-lg border border-[#e8eaf1]
                         bg-white px-3 py-2 text-sm hover:shadow-sm"
            >
              {s.icon}{s.text}
            </button>
          ))}
        </div>
      </div>

      {/* Controls Bar */}
      <div className="mb-3 flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setShowSettings(v => !v)}
            className="inline-flex items-center gap-2 rounded-lg border border-[#e8eaf1] bg-white px-3 py-2 text-sm"
          >
            <Settings2 className="w-4 h-4" />
            Aspect Ratio & Settings
          </button>
          {showSettings && (
            <div className="absolute z-20 mt-2 w-72 rounded-xl border border-[#e8eaf1] bg-white shadow-lg p-3">
              <div className="mb-2 text-xs font-semibold text-[#5b6275]">Aspect ratio</div>
              <div className="grid grid-cols-3 gap-2">
                {RATIOS.map(r => (
                  <button
                    key={r.id}
                    onClick={() => setRatio(r.id)}
                    className={cx(
                      "rounded-lg border px-2 py-2 text-sm",
                      ratio === r.id ? "border-[#7A3BFF] ring-2 ring-[#7A3BFF]/20" : "border-[#e8eaf1]"
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              <div className="mt-3 text-xs font-semibold text-[#5b6275]">Mode</div>
              <div className="mt-1 flex gap-2">
                {["all","image","video"].map(m => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={cx(
                      "rounded-lg border px-2 py-1 text-xs capitalize",
                      mode === m ? "border-[#7A3BFF] ring-2 ring-[#7A3BFF]/20" : "border-[#e8eaf1]"
                    )}
                  >{m}</button>
                ))}
              </div>

              <div className="mt-3 text-xs font-semibold text-[#5b6275]">Custom instructions</div>
              <div className="mt-2 space-y-2">
                <label className="block">
                  <span className="text-xs text-[#5b6275]">Tone</span>
                  <input value={custom.tone} onChange={e=>setCustom(c=>({...c,tone:e.target.value}))}
                         className="mt-1 w-full rounded-lg border border-[#e8eaf1] bg-white px-3 py-2 text-sm"/>
                </label>
                <label className="block">
                  <span className="text-xs text-[#5b6275]">Brand</span>
                  <input value={custom.brand} onChange={e=>setCustom(c=>({...c,brand:e.target.value}))}
                         className="mt-1 w-full rounded-lg border border-[#e8eaf1] bg-white px-3 py-2 text-sm"/>
                </label>
                <label className="block">
                  <span className="text-xs text-[#5b6275]">Safety</span>
                  <input value={custom.safety} onChange={e=>setCustom(c=>({...c,safety:e.target.value}))}
                         className="mt-1 w-full rounded-lg border border-[#e8eaf1] bg-white px-3 py-2 text-sm"/>
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chat stream */}
      <div ref={listRef} className="rounded-2xl border border-[#e8eaf1] bg-white p-4 h-[54vh] overflow-y-auto">
        {messages.map((m, i) => (
          <div key={i} className={cx("mb-4", m.role === "assistant" ? "" : "text-right")}>
            <div className={cx(
              "inline-block max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
              m.role === "assistant" ? "bg-[#f6f7fb] text-[#0b1220]" : "bg-[#7A3BFF] text-white"
            )}>
              {m.text}
            </div>
          </div>
        ))}
      </div>

      {/* Composer */}
      <div className="mt-3 flex items-center gap-2">
        <button className="rounded-xl border border-[#e8eaf1] bg-white p-2">
          <Plus className="w-5 h-5" />
        </button>
        <div className="relative flex-1">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            rows={2}
            placeholder="Describe your idea"
            className="w-full resize-none rounded-xl border border-[#e8eaf1] bg-white px-4 py-3 text-sm"
          />
          <button
            disabled={!canSend}
            onClick={onSend}
            className={cx(
              "absolute right-2 bottom-2 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
              canSend ? "bg-[#7A3BFF] text-white" : "bg-[#e8eaf1] text-[#5b6275] cursor-not-allowed"
            )}
          >
            <Send className="w-4 h-4" /> Send
          </button>
        </div>
        <button className="rounded-xl border border-[#e8eaf1] bg-white p-2">
          <Settings2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

// --- simple local “draft” builder to demo the idea ---
function buildZyloDraft(userText, ratio, mode, custom){
  // This is where your backend will RAG over Zylo docs and then return:
  const prompt = [
    `Goal: ${userText}`,
    `Tone: ${custom.tone}; Brand: ${custom.brand}; Safety: ${custom.safety}.`,
    `Aspect ratio: ${ratio}. Target: ${mode}.`,
    `Write a single-line, camera-forward ad prompt with subject, motion, lighting, style and a CTA.`,
    `If video, include timestamps and whether to use avatar lip-sync or background narrator (no lip-sync).`,
  ].join("\n");

  const payload = {
    ratio,
    mode,
    voice: "background-narrator", // or "avatar-lipsync"
    quality: "1080p",
    sound: mode !== "image" ? "no-sound" : undefined, // Veo v5 “no sound” input flag
    steps: [
      { t: [0.00, 0.08], type: "narrator" },
      // avatar segments can be inserted here with exact timecodes
    ],
  };

  return [
    "Here’s a Zylo-ready draft. Edit anything and press Generate:",
    "",
    "— Prompt —",
    "• "+userText,
    "",
    "— Input Payload —",
    "```json",
    JSON.stringify(payload, null, 2),
    "```",
    "",
    "Tip: upload your product, auto-remove background first, then pass product+bg to the video generator. If you choose avatar TTS, enable lip-sync; for background narrator, skip lip-sync and just mix audio into the clip."
  ].join("\n");
}
