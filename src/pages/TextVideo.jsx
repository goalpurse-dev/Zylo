import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ChatPreview from "../components/ChatPreview";

/* ----------------------------- THEME / UTILS ----------------------------- */
const BRAND = "#1677FF"; // primary blue
const ACCENT = "#7A3BFF"; // secondary accent
const BORDER = "border-gray-200";
const MUTED = "text-gray-600";

const cx = (...c) => c.filter(Boolean).join(" ");

/* Toast: top-right, playful/pro vibe */
const FancyToast = ({ toast }) => {
  if (!toast) return null;
  const isError = toast.type === "error";

  return (
    <div
      className={`
        fixed top-4 right-4 z-50
        px-4 py-3
        rounded-2xl
        shadow-[0_12px_40px_rgba(0,0,0,0.35)]
        border
        flex items-start gap-3
        max-w-xs
        bg-gradient-to-br
        ${
          isError
            ? "from-[#1b0b20] via-[#261338] to-[#3b1020] border-[#ff4d8a]"
            : "from-[#04191f] via-[#06252e] to-[#083647] border-[#3fd1ff]"
        }
        text-white
        animate-[fadeIn_0.18s_ease-out]
      `}
      style={{
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
      }}
    >
      <div
        className={`
          mt-[2px] w-6 h-6 rounded-full flex items-center justify-center text-[13px] font-extrabold
          ${isError ? "bg-[#ff4d8a]" : "bg-[#3fd1ff] text-black"}
        `}
      >
        {isError ? "!" : "i"}
      </div>
      <div className="text-[13px] leading-snug">
        <div className="font-extrabold tracking-wide mb-[2px]">
          {isError ? "Frame image required" : "Heads up"}
        </div>
        <div className="opacity-95">{toast.message}</div>
      </div>
    </div>
  );
};

const Card = ({ className = "", children }) => (
  <div
    className={cx(
      "bg-white rounded-2xl shadow-sm border",
      BORDER,
      className
    )}
  >
    {children}
  </div>
);

/* ------------------------------ MOCK DATA ------------------------------- */
const voiceBank = [
  {
    id: "william",
    name: "William",
    desc: "Default: professional & casual narration",
    tags: ["Male", "Middle-aged", "English"],
  },
  {
    id: "adam",
    name: "Adam",
    desc: "Most recognizable TikTok-style. Punchy delivery.",
    tags: ["Male", "Young", "Multilingual"],
  },
  {
    id: "natasha",
    name: "Natasha",
    desc: "Soft female voice—great for storytime.",
    tags: ["Female", "Young", "Multilingual"],
  },
  {
    id: "amir",
    name: "Amir",
    desc: "Energetic youthful tone—strong for comedy hooks.",
    tags: ["Male", "Young", "Multilingual"],
  },
  {
    id: "dan",
    name: "Dan",
    desc: "Punchy & clear. Used in 100k+ shorts.",
    tags: ["Male", "Middle-aged", "Multilingual"],
  },
];
const musicPicks = [
  { id: "none", name: "None" },
  { id: "lofi", name: "Lofi Chill" },
  { id: "trap", name: "Trap Pulse" },
  { id: "cin", name: "Cinematic" },
  { id: "neon", name: "Synthwave" },
];

const themePresets = [
  { id: "imessage-dark", name: "iMessage — Dark" },
  { id: "imessage-light", name: "iMessage — Light" },
  { id: "whatsapp-dark", name: "WhatsApp — Dark" },
  { id: "whatsapp-light", name: "WhatsApp — Light" },
  { id: "messenger", name: "Messenger" },
];

const bgCategories = ["All", "Gameplay", "Satisfying", "Nature", "City", "Abstract"];
const backgroundLib = [
  {
    id: "subway-1",
    title: "Subway Surfers",
    cat: "Gameplay",
    thumb:
      "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=800&auto=format",
  },
  {
    id: "minecraft-1",
    title: "Minecraft Tunnel",
    cat: "Gameplay",
    thumb:
      "https://images.unsplash.com/photo-1560807707-8cc77767d783?q=80&w=800&auto=format",
  },
  {
    id: "slime-1",
    title: "Slime Press",
    cat: "Satisfying",
    thumb:
      "https://images.unsplash.com/photo-1600585154526-990dced4db0d?q=80&w=800&auto=format",
  },
  {
    id: "city-1",
    title: "Neon City",
    cat: "City",
    thumb:
      "https://images.unsplash.com/photo-1508057198894-247b23fe5ade?q=80&w=800&auto=format",
  },
  {
    id: "nature-1",
    title: "Pine Forest",
    cat: "Nature",
    thumb:
      "https://images.unsplash.com/photo-1511497584788-876760111969?q=80&w=800&auto=format",
  },
];

const defaultParticipants = {
  sender: { id: "p1", name: "Alex", side: "left" },
  receiver: { id: "p2", name: "Jamie", side: "right" },
};

const defaultMessages = [
  {
    id: "m1",
    from: "p1",
    text: "Would you still love me if I was a tank?",
    delay: 0,
  },
  {
    id: "m2",
    from: "p2",
    text: "Depends. Which tank are we talking about?",
    delay: 0.6,
  },
  { id: "m3", from: "p1", text: "Leopard 2 A7.", delay: 0.6 },
  { id: "m4", from: "p2", text: "…then yes. Obviously.", delay: 0.6 },
];

/* ---------- Theme surfaces (card/preview backgrounds) ---------- */
const THEME_SURFACES = {
  "imessage-dark": { bgColor: "#000000" },
  "imessage-light": { bgColor: "#F6F6F6" },
  "whatsapp-dark": {
    bgColor: "#0B141A",
    bgImage: "/images/whatsapp-dark.png",
  },
  "whatsapp-light": {
    bgColor: "#ECE5DD",
    bgImage: "/images/whatsapp-light.png",
  },
  messenger: { bgColor: "#0F0F10" },
};

const surfaceStyles = (id) => {
  const s = THEME_SURFACES[id] || {};
  return {
    backgroundColor: s.bgColor || "#F6F6F6",
    backgroundImage: s.bgImage ? `url(${s.bgImage})` : "none",
    backgroundRepeat: "no-repeat",
    backgroundSize: "cover",
    backgroundPosition: "center",
  };
};

/* ---------------------------- (unused) Bubble ---------------------------- */
function Bubble({
  align = "left",
  color = "#1F6FEB",
  children,
  delay,
  textClass = "text-white",
}) {
  return (
    <div
      className={cx(
        "flex",
        align === "right" ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cx(
          "max-w-[70%] px-3 py-2 rounded-2xl shadow",
          textClass
        )}
        style={{ background: color }}
      >
        <div className="whitespace-pre-wrap">{children}</div>
        {typeof delay === "number" && (
          <div className="mt-1 text-[11px] opacity-70">
            {delay.toFixed(1)}s
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================== MAIN PAGE =============================== */
export default function TextVideo() {
  const [step, setStep] = useState(0);
  const steps = ["Script", "Theme", "Video", "Audio", "Review"];

  const [participants, setParticipants] = useState(defaultParticipants);
  const [messages, setMessages] = useState(defaultMessages);

  const [theme, setTheme] = useState("imessage-dark");

  const [aspect, setAspect] = useState("9:16");
  const [bgCat, setBgCat] = useState("All");
  const [bgPick, setBgPick] = useState("subway-1");

  const [music, setMusic] = useState("none");
  const [voiceIntro, setVoiceIntro] = useState("william");
  const [voiceScript, setVoiceScript] = useState("adam");
  const [language, setLanguage] = useState("Auto Detect Language");
  const [styleExaggeration, setStyleExaggeration] = useState(25);
  const [stability, setStability] = useState(30);
  const [volume, setVolume] = useState(65);
  const [speed, setSpeed] = useState(45);

  /* --- NEW: model tier & init-image tracking + toast --- */
  // Hook `tier` up to your existing video tier selector (zylo-v2 / v3 / v4).
  const [tier, setTier] = useState("zylo-v3");
  // Call setInitImageUrl(url) when user imports/uploads the frame image.
  const [initImageUrl, setInitImageUrl] = useState("");

  const [toast, setToast] = useState(null);
  const showToast = (message, type = "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2600);
  };

  const filteredBg = useMemo(
    () =>
      backgroundLib.filter((b) =>
        bgCat === "All" ? true : b.cat === bgCat
      ),
    [bgCat]
  );

  /* ------------------------------- STEPS -------------------------------- */

  /** ------------------ STEP 1: Script (unchanged) ------------------ */
  const StepScript = () => {
    const [aiOpen, setAiOpen] = useState(false);
    const [aiPrompt, setAiPrompt] = useState(
      "Write a short, funny texting conversation (6–10 bubbles) about: 'Would you still love me if I was a tank?' End with a playful twist."
    );
    const [isGen, setIsGen] = useState(false);

    const generateAI = async () => {
      setIsGen(true);
      const draft = [
        {
          from: participants.sender.id,
          text: "Serious question—would you still love me if I was a tank?",
          delay: 0.0,
        },
        {
          from: participants.receiver.id,
          text: "What kind of tank are we talking about?",
          delay: 0.6,
        },
        {
          from: participants.sender.id,
          text: "Leopard 2 A7… the fancy one.",
          delay: 0.6,
        },
        {
          from: participants.receiver.id,
          text: "Obviously yes. We’d roll into the sunset together 💙",
          delay: 0.6,
        },
        {
          from: participants.sender.id,
          text: "romantic 😌",
          delay: 0.5,
        },
        {
          from: participants.receiver.id,
          text:
            "If you were a shopping cart with one squeaky wheel? Also yes.",
          delay: 0.6,
        },
      ];
      setMessages([]);
      for (let i = 0; i < draft.length; i++) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 200));
        setMessages((prev) => [
          ...prev,
          {
            id: `m${Date.now()}_${i}`,
            contentType: "text",
            ...draft[i],
          },
        ]);
      }
      setIsGen(false);
      setAiOpen(false);
    };

    return (
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-black">1) Script</h2>
          <button
            onClick={() => setAiOpen((v) => !v)}
            className="h-10 px-3 rounded-md border border-gray-300 text-sm text-black hover:bg-gray-50"
          >
            ✨ Let AI write it
          </button>
        </div>

        <p className="mt-1 text-gray-600">
          Type your conversation lines and set a small delay for each
          message. You can also ask AI to draft it, then edit.
        </p>

        {aiOpen && (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="font-semibold text-blue-900">
              Describe the conversation
            </div>
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              rows={4}
              className="mt-2 w-full rounded-md border border-blue-200 bg-white p-3 text-black placeholder:text-gray-400"
              placeholder="Describe topic, tone, characters, ending…"
            />
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={generateAI}
                disabled={isGen}
                className="h-10 px-4 rounded-md bg-[#007BFF] text-white disabled:opacity-60"
              >
                {isGen ? "Generating…" : "Generate"}
              </button>
              <button
                onClick={() => setAiOpen(false)}
                disabled={isGen}
                className="h-10 px-4 rounded-md border border-blue-200 bg-white text-blue-900"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Manual messages table */}
        <div className="mt-5 grid gap-3">
          {messages.map((m, i) => (
            <div
              key={m.id}
              className="grid md:grid-cols-[1fr_130px_110px] gap-3"
            >
              <input
                value={m.text}
                onChange={(e) =>
                  setMessages((prev) =>
                    prev.map((x) =>
                      x.id === m.id
                        ? { ...x, text: e.target.value }
                        : x
                    )
                  )
                }
                className="h-11 rounded-md border px-3 text-black placeholder:text-gray-400 focus:ring-2 focus:ring-blue-100"
                placeholder={`Message ${i + 1}`}
              />
              <select
                value={m.from}
                onChange={(e) =>
                  setMessages((prev) =>
                    prev.map((x) =>
                      x.id === m.id
                        ? { ...x, from: e.target.value }
                        : x
                    )
                  )
                }
                className="h-11 rounded-md border px-3 text-black bg-white"
              >
                <option value={participants.sender.id}>
                  {participants.sender.name} (sender)
                </option>
                <option value={participants.receiver.id}>
                  {participants.receiver.name} (receiver)
                </option>
              </select>
              <div className="relative w-full">
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  value={m.delay}
                  onChange={(e) =>
                    setMessages((prev) =>
                      prev.map((x) =>
                        x.id === m.id
                          ? {
                              ...x,
                              delay: parseFloat(
                                e.target.value || 0
                              ),
                            }
                          : x
                      )
                    )
                  }
                  className="h-11 w-full rounded-md border pl-2 pr-6 text-right"
                  placeholder="Delay (s)"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                  s
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <button
            onClick={() =>
              setMessages((prev) => [
                ...prev,
                {
                  id: `m${Date.now()}`,
                  from: participants.sender.id,
                  contentType: "text",
                  text: "",
                  delay: 0.5,
                },
              ])
            }
            className="h-10 px-4 rounded-md border text-black hover:bg-gray-50"
          >
            + Add message
          </button>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-semibold text-black">
            Preview
          </h3>
          <div className="mt-2">
            <ChatPreview
              participants={participants}
              messages={messages}
            />
          </div>
        </div>
      </Card>
    );
  };

  /** ------------------ STEP 2: Theme ------------------ */
  const StepTheme = () => (
    <div className="grid lg:grid-cols-3 gap-6 text-black">
      {/* Left: theme grid */}
      <Card className="p-6 lg:col-span-2">
        <h2 className="text-lg font-bold text-gray-900">
          2) Theme
        </h2>
        <p className="mt-1 text-gray-600">
          Pick the chat look you like. You can preview and change it
          later.
        </p>

        <div className="mt-4 grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {themePresets.map((t) => {
            const active = theme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`text-left rounded-xl border overflow-hidden transition group flex flex-col h-full ${
                  active ? "ring-2" : ""
                }`}
                style={{
                  borderColor: active
                    ? "#7A3BFF"
                    : "#E5E7EB",
                  boxShadow: active
                    ? "0 0 0 4px rgba(122,59,255,0.10)"
                    : "none",
                }}
              >
                <div className="p-2">
                  <div className="rounded-lg border border-gray-200 overflow-hidden">
                    <div
                      className="p-2 h-48"
                      style={surfaceStyles(t.id)}
                    >
                      <ChatPreview
                        themeId={t.id}
                        participants={participants}
                        messages={messages.slice(0, 3)}
                        transparent
                      />
                    </div>
                  </div>
                </div>

                <div className="p-3 flex-1 flex flex-col">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-gray-900">
                      {t.name}
                    </div>
                    {active && (
                      <span
                        className="text-xs px-2 py-[2px] rounded-full border"
                        style={{
                          color: "#7A3BFF",
                          borderColor:
                            "rgba(122,59,255,.35)",
                          background:
                            "rgba(122,59,255,.08)",
                        }}
                      >
                        Selected
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Clean bubble layout preset.
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Right: large preview */}
      <Card className="p-6">
        <h3 className="text-sm font-bold text-gray-900">
          Preview
        </h3>
        <div
          className="mt-3 rounded-md border border-gray-200 p-3"
          style={{
            ...surfaceStyles(theme),
            minHeight: 360,
          }}
        >
          <ChatPreview
            themeId={theme}
            participants={participants}
            messages={messages.slice(0, 6)}
            transparent
          />
        </div>
        <div className="mt-4 text-xs text-gray-500">
          You can switch the theme later if it doesn’t fit your
          script.
        </div>
      </Card>
    </div>
  );

  /** ------------------ STEP 3: Video ------------------ */
  const StepVideo = () => (
    <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-6">
      <Card className="p-6">
        <h2 className="text-lg font-bold text-black">3) Video</h2>

        <div className="mt-4">
          <div className="text-sm font-medium mb-2 text-black">
            Format
          </div>
          <div className="flex gap-2">
            {["9:16", "1:1", "16:9"].map((a) => (
              <button
                key={a}
                onClick={() => setAspect(a)}
                className={cx(
                  "h-9 px-3 rounded-md border text-black",
                  aspect === a
                    ? "border-[--brand] bg-blue-50 text-[--brand]"
                    : BORDER
                )}
                style={{ ["--brand"]: BRAND }}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <div className="text-sm font-medium mb-2 text-black">
            Background category
          </div>
          <div className="flex gap-2 flex-wrap">
            {bgCategories.map((c) => (
              <button
                key={c}
                onClick={() => setBgCat(c)}
                className={cx(
                  "h-9 px-3 rounded-full border text-sm text-black",
                  bgCat === c
                    ? "border-[--brand] bg-blue-50 text-[--brand]"
                    : BORDER
                )}
                style={{ ["--brand"]: BRAND }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          {filteredBg.map((b) => (
            <button
              key={b.id}
              onClick={() => setBgPick(b.id)}
              className={cx(
                "flex items-center gap-3 p-2 rounded-xl border text-left hover:border-gray-300",
                bgPick === b.id
                  ? "border-[--brand] ring-2 ring-blue-100"
                  : BORDER
              )}
              style={{ ["--brand"]: BRAND }}
            >
              <img
                src={b.thumb}
                alt=""
                className="w-20 h-14 rounded-lg object-cover"
              />
              <div>
                <div className="font-medium text-black">
                  {b.title}
                </div>
                <div className={cx("text-xs", MUTED)}>
                  {b.cat}
                </div>
              </div>
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-sm font-bold text-black">
          Framing Preview
        </h3>
        <div
          className={cx(
            "mt-3 relative border rounded-xl overflow-hidden bg-gray-50",
            aspect === "9:16"
              ? "w-[320px] aspect-[9/16]"
              : aspect === "1:1"
              ? "w-[380px] aspect-square"
              : "w-full aspect-video"
          )}
        >
          <img
            src={
              backgroundLib.find((b) => b.id === bgPick)?.thumb
            }
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-70"
          />
          <div className="absolute inset-0 p-3">
            <ChatPreview
              participants={participants}
              messages={messages.slice(0, 5)}
              themeId={theme}
            />
          </div>
        </div>
      </Card>
    </div>
  );

  /** ------------------ STEP 4: Audio / Voice ------------------ */
  const StepAudio = () => (
    <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6">
      {/* Left: voice pickers */}
      <Card className="p-6">
        <h2 className="text-lg font-bold text-black">4) Audio</h2>
        <p className={cx("mt-1", MUTED)}>
          Pick intro & narration voices, then fine-tune delivery.
        </p>

        <div className="mt-4 grid sm:grid-cols-2 gap-4">
          {/* Intro Voice */}
          <div className="rounded-xl border p-2 h-[420px] overflow-y-auto">
            <div className="px-2 py-1 text-xs font-semibold text-gray-500">
              Intro Voice
            </div>
            {voiceBank.map((v) => {
              const active = voiceIntro === v.id;
              return (
                <button
                  key={`intro-${v.id}`}
                  onClick={() => setVoiceIntro(v.id)}
                  className={cx(
                    "w-full text-left p-4 rounded-xl border mb-2 hover:border-gray-300",
                    active
                      ? "border-[--brand] ring-2 ring-blue-100"
                      : BORDER
                  )}
                  style={{ ["--brand"]: BRAND }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full bg-blue-50 grid place-items-center text-[--brand]"
                      style={{ ["--brand"]: BRAND }}
                    >
                      {v.name[0]}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-black">
                        {v.name}
                      </div>
                      <div className={cx("text-sm", MUTED)}>
                        {v.desc}
                      </div>
                      <div className="mt-2 flex gap-2 flex-wrap">
                        {v.tags.map((t) => (
                          <span
                            key={`intro-${v.id}-${t}`}
                            className="text-xs px-2 py-1 border rounded-full bg-gray-50 text-black"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-xl">▶</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Script Voice */}
          <div className="rounded-xl border p-2 h-[420px] overflow-y-auto">
            <div className="px-2 py-1 text-xs font-semibold text-gray-500">
              Script Voice
            </div>
            {voiceBank.map((v) => {
              const active = voiceScript === v.id;
              return (
                <button
                  key={`script-${v.id}`}
                  onClick={() => setVoiceScript(v.id)}
                  className={cx(
                    "w-full text-left p-4 rounded-xl border mb-2 hover:border-gray-300",
                    active
                      ? "border-[--brand] ring-2 ring-blue-100"
                      : BORDER
                  )}
                  style={{ ["--brand"]: BRAND }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full bg-blue-50 grid place-items-center text-[--brand]"
                      style={{ ["--brand"]: BRAND }}
                    >
                      {v.name[0]}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-black">
                        {v.name}
                      </div>
                      <div className={cx("text-sm", MUTED)}>
                        {v.desc}
                      </div>
                      <div className="mt-2 flex gap-2 flex-wrap">
                        {v.tags.map((t) => (
                          <span
                            key={`script-${v.id}-${t}`}
                            className="text-xs px-2 py-1 border rounded-full bg-gray-50 text-black"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-xl">▶</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Right: settings */}
      <Card className="p-6">
        <h3 className="text-sm font-bold text-black">
          Language & Voice Settings
        </h3>

        <div className="mt-3">
          <div className="text-sm font-medium mb-1 text-black">
            Language
          </div>
          <select
            value={language}
            onChange={(e) =>
              setLanguage(e.target.value)
            }
            className="h-11 w-full rounded-md border px-3 bg-white text-black"
          >
            {[
              "Auto Detect Language",
              "English",
              "Spanish",
              "German",
              "French",
              "Romanian",
              "Turkish",
              "Italian",
              "Portuguese",
              "Russian",
              "Chinese",
              "Japanese",
              "Korean",
            ].map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </div>

        <div className="mt-4 grid gap-4">
          <Slider
            label="Style Exaggeration"
            value={styleExaggeration}
            onChange={setStyleExaggeration}
          />
          <Slider
            label="Voice Stability"
            value={stability}
            onChange={setStability}
          />
          <Slider
            label="Voice Volume"
            value={volume}
            onChange={setVolume}
          />
          <Slider
            label="Voice Speed"
            value={speed}
            onChange={setSpeed}
          />
        </div>

        <button
          onClick={() => {
            setStyleExaggeration(25);
            setStability(40);
            setVolume(65);
            setSpeed(45);
          }}
          className="mt-4 h-10 px-4 rounded-md border text-black hover:bg-gray-50"
        >
          Reset To Default
        </button>

        <div className="mt-6">
          <div className="text-sm font-medium mb-2 text-black">
            Background music
          </div>
          <div className="flex gap-2 flex-wrap">
            {musicPicks.map((m) => (
              <button
                key={m.id}
                onClick={() => setMusic(m.id)}
                className={cx(
                  "h-9 px-3 rounded-full border text-sm text-black",
                  music === m.id
                    ? "border-[--brand] bg-blue-50 text-[--brand]"
                    : BORDER
                )}
                style={{ ["--brand"]: BRAND }}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 text-xs text-gray-500">
          We’ll generate the intro card, captions from your story,
          and mix music/voice automatically.
        </div>
      </Card>
    </div>
  );

  /** ------------------ STEP 5: Review ------------------ */
  const StepReview = () => (
    <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6">
      <Card className="p-6">
        <h2 className="text-lg font-bold text-black">
          5) Preview
        </h2>
        <div className="mt-3 w-[360px] aspect-[9/16] border rounded-xl overflow-hidden relative bg-gray-50">
          <img
            src={
              backgroundLib.find((b) => b.id === bgPick)?.thumb
            }
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-70"
          />
          <div className="absolute inset-0 p-3">
            <ChatPreview
              participants={participants}
              messages={messages}
              themeId={theme}
            />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-sm font-bold text-black">
          Summary
        </h3>
        <ul className="mt-3 text-sm text-black">
          <li className="mb-2">
            <b>Format:</b> {aspect}
          </li>
          <li className="mb-2">
            <b>Theme:</b>{" "}
            {
              themePresets.find((t) => t.id === theme)
                ?.name
            }
          </li>
          <li className="mb-2">
            <b>Background:</b>{" "}
            {
              backgroundLib.find((b) => b.id === bgPick)
                ?.title
            }
          </li>
          <li className="mb-2">
            <b>Voice:</b> {/* voiceId undefined in original; left as-is */}
          </li>
          <li className="mb-2">
            <b>Music:</b> {music}
          </li>
          <li className="mb-2">
            <b>Messages:</b> {messages.length}
          </li>
        </ul>
        <p className={MUTED}>
          We’ll animate bubbles, apply caption-like timing
          from your delays, and mix music/voice.
        </p>
      </Card>
    </div>
  );

  /* -------------------- Next / Generate handler (with v2 guard) -------------------- */
  const handleNextOrGenerate = () => {
    if (step < steps.length - 1) {
      setStep((s) => Math.min(steps.length - 1, s + 1));
      return;
    }

    // Final step: GENERATE
    if (tier === "zylo-v2" && !initImageUrl) {
      // This mirrors the Runware "missingFrameImagesForImageToVideoModel" constraint.
      showToast(
        "Kling v2 requires a frame image before generating. Please upload/import a PNG/JPG/WEBP first.",
        "error"
      );
      return;
    }

    // Put your real job creation / Runware call here.
    showToast(
      "Generating your video with your current settings ⚡",
      "info"
    );
  };

  /* ------------------------------- RENDER -------------------------------- */
  return (
    <div className="min-h-screen bg-white text-black">
      <div className="max-w-7xl mx-auto px-6 pt-8 pb-28">
        {/* Header */}
        <div className="mb-6">
          <div
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: BRAND }}
          >
            Text Messages Generator
          </div>
          <h1 className="mt-2 text-[28px] sm:text-[34px] font-extrabold leading-tight text-black">
            Build viral chat videos with{" "}
            <span style={{ color: BRAND }}>AI</span>
          </h1>
          <p className={cx("mt-2", MUTED)}>
            Script the thread, choose a theme, set background,
            then voice & language. We’ll assemble the final
            short.
          </p>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-4 mb-6">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <button
                onClick={() => setStep(i)}
                className={cx(
                  "h-8 px-3 rounded-full border text-sm text-black",
                  step === i
                    ? "border-[--brand] bg-blue-50 text-[--brand]"
                    : BORDER
                )}
                style={{ ["--brand"]: BRAND }}
              >
                {i + 1}. {s}
              </button>
              {i < steps.length - 1 && (
                <div className="h-px w-6 bg-gray-200" />
              )}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="space-y-6">
          {step === 0 && <StepScript />}
          {step === 1 && <StepTheme />}
          {step === 2 && <StepVideo />}
          {step === 3 && <StepAudio />}
          {step === 4 && <StepReview />}
        </div>
      </div>

      {/* Bottom nav */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-3 flex justify-between">
          <button
            onClick={() =>
              setStep((s) => Math.max(0, s - 1))
            }
            disabled={step === 0}
            className={cx(
              "h-10 px-4 rounded-md border",
              step === 0
                ? "text-gray-400 border-gray-200"
                : "text-black hover:bg-gray-50"
            )}
          >
            Back
          </button>
          <button
            onClick={handleNextOrGenerate}
            className="h-10 px-5 rounded-md text-white"
            style={{ background: BRAND }}
          >
            {step < steps.length - 1
              ? "Next ▸"
              : "Generate ▸"}
          </button>
        </div>
      </div>

      {/* Toast */}
      <FancyToast toast={toast} />
    </div>
  );
}

/* ----------------------------- tiny slider ------------------------------ */
function Slider({ label, value, onChange }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-black">
          {label}
        </div>
        <div className="text-sm text-gray-500">
          {value}
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) =>
          onChange(parseInt(e.target.value, 10))
        }
        className="w-full"
      />
    </div>
  );
}

/*
Add this once to your global CSS (e.g. index.css) for the toast animation:

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
*/

