import { useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { SCRIPT_STYLES } from "../../lib/scriptTemplates";

function ImageToScriptIdea({ onResult }) {
  const fileRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const imageUrl = URL.createObjectURL(file);
    setPreview(imageUrl);
    setLoading(true);
    setError(null);
    try {
      // Deduct 1 credit before calling the edge function
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const { error: creditErr } = await supabase.rpc("deduct_credits", {
        uid: user.id,
        amount: 1,
      });
      if (creditErr) {
        if (creditErr.message?.includes("INSUFFICIENT_CREDITS")) {
          throw new Error("INSUFFICIENT_CREDITS");
        }
        throw creditErr;
      }

      const entryId = crypto.randomUUID();

      // Upload image to storage so the thumbnail persists permanently
      const ext = file.name.split(".").pop() || "jpg";
      const storagePath = `${user.id}/image-ideas/${entryId}.${ext}`;
      let storedImageUrl = null;
      const { error: uploadErr } = await supabase.storage
        .from("reference-images")
        .upload(storagePath, file, { upsert: false });
      if (!uploadErr) {
        const { data: pub } = supabase.storage.from("reference-images").getPublicUrl(storagePath);
        storedImageUrl = pub?.publicUrl ?? null;
      }

      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const { data, error: fnErr } = await supabase.functions.invoke("image-to-prompt", {
        body: { imageBase64: base64, mimeType: file.type || "image/jpeg", kind: "script" },
      });
      if (fnErr || !data?.prompt) throw new Error(fnErr?.message || "No idea returned");

      // Persist idea + image URL to DB
      await supabase.from("viral_scripts").insert([{
        id: entryId,
        user_id: user.id,
        preset: "From Image",
        preset_icon: storedImageUrl ?? "🖼️",
        platform: "",
        type: "image_idea",
        idea: data.prompt,
        script_data: { imageUrl: storedImageUrl },
      }]).then(() => {});

      onResult?.({ imageUrl: storedImageUrl ?? imageUrl, idea: data.prompt, entryId });
      setPreview(null);
    } catch (err) {
      console.error("image-to-prompt error:", err);
      const msg = err?.message?.includes("INSUFFICIENT_CREDITS")
        ? "Not enough credits. Top up to analyze images."
        : "Couldn't analyze image. Try again.";
      setError(msg);
      setPreview(null);
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

      <button
        onClick={() => !loading && fileRef.current?.click()}
        disabled={loading}
        className="group relative w-full text-left rounded-xl border border-white/[0.07] bg-white/[0.03] hover:bg-[#7A3BFF]/[0.06] hover:border-[#7A3BFF]/30 transition-all duration-200 active:scale-[0.99] overflow-hidden"
      >
        <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl bg-gradient-to-b from-[#7A3BFF] to-[#C084FC] opacity-70 group-hover:opacity-100 transition-opacity" />
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{ background: "linear-gradient(105deg,transparent 40%,rgba(122,59,255,0.06) 50%,transparent 60%)" }} />

        <div className="flex items-center gap-3.5 pl-5 pr-4 py-4">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${!loading ? "img2prompt-icon" : ""}`}
            style={{ background: "rgba(122,59,255,0.14)", border: "1px solid rgba(122,59,255,0.28)" }}>
            {loading ? (
              <div className="w-4 h-4 rounded-full border-2 border-[#7A3BFF]/30 border-t-[#C084FC] animate-spin" />
            ) : preview ? (
              <img src={preview} alt="" className="w-full h-full object-cover rounded-lg" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="6" width="13" height="11" rx="2" stroke="#C084FC" strokeWidth="1.5"/>
                <path d="M15 10l4-2.5v9L15 14" stroke="#C084FC" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M19.5 3.5L21 5M22.5 2L21 3.5" stroke="#ff57b2" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-white text-[13px] font-semibold leading-tight">
              {loading ? "Analyzing image…" : "Generate from image"}
            </p>
            <p className="text-white/35 text-[11px] mt-0.5 leading-snug">
              {loading ? "AI is crafting your viral concept" : "Upload any photo — AI writes the script idea"}
            </p>
          </div>

          <span className="text-white/20 group-hover:text-[#7A3BFF] transition-colors text-lg shrink-0">→</span>
        </div>
      </button>

      {error && (
        <p className="text-[11px] text-red-400/70 mt-2 px-1 leading-snug">{error}</p>
      )}
    </div>
  );
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Platform → short label
const PLATFORM_SHORT = {
  "YouTube Long": "YT Long",
  "YouTube Shorts": "YT Shorts",
  "Instagram Reels": "IG Reels",
  TikTok: "TikTok",
};

// Style → descriptor
const STYLE_LABEL = {
  Shock: "Shock",
  "Curiosity Gap": "Curiosity",
  Storytelling: "Story",
  Authority: "Authority",
};

const PRESETS = SCRIPT_STYLES.filter((s) => s.id !== "custom");
const CUSTOM = SCRIPT_STYLES.find((s) => s.id === "custom");

function StyleCard({ style, onClick }) {
  const platform = style.defaults?.platform;
  const platformShort = PLATFORM_SHORT[platform] || platform;
  const scriptStyle = STYLE_LABEL[style.defaults?.style] || style.defaults?.style;

  return (
    <button
      onClick={onClick}
      className="group relative text-left p-4 rounded-xl border border-white/[0.07] bg-white/[0.03] hover:bg-[#7A3BFF]/[0.06] hover:border-[#7A3BFF]/30 transition-all duration-200 active:scale-[0.98] overflow-hidden"
    >
      {/* Accent left bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl transition-opacity duration-200 opacity-60 group-hover:opacity-100"
        style={{ background: style.accentColor }}
      />

      {/* Top row: icon + arrow */}
      <div className="flex items-start justify-between mb-3">
        <div
          className="h-8 w-8 rounded-lg flex items-center justify-center text-base overflow-hidden"
          style={{ background: `${style.accentColor}18`, border: `1px solid ${style.accentColor}30` }}
        >
          {style.previewImage
            ? <img src={style.previewImage} alt={style.name} className="w-full h-full object-cover" />
            : style.icon}
        </div>
        <span className="text-white/20 group-hover:text-white/50 text-xs transition-colors mt-1">→</span>
      </div>

      {/* Name */}
      <div className="text-white text-[13px] font-semibold leading-tight mb-1">
        {style.name}
      </div>

      {/* Tagline */}
      <div className="text-white/35 text-[11px] leading-snug mb-3">
        {style.tagline}
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap gap-1.5">
        {platformShort && (
          <span
            className="text-[10px] px-2 py-0.5 rounded-md font-medium"
            style={{
              background: `${style.accentColor}15`,
              color: style.accentColor,
              border: `1px solid ${style.accentColor}25`,
            }}
          >
            {platformShort}
          </span>
        )}
        {scriptStyle && (
          <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.06] text-white/35 border border-white/[0.06] font-medium">
            {scriptStyle}
          </span>
        )}
      </div>
    </button>
  );
}

export default function ScriptStylePicker({ onSelect, history = [], onViewHistory, onImageIdea }) {
  return (
    <div className="px-5 py-6 flex flex-col gap-6">

      {/* Recent scripts — mobile only, desktop has it in the Output panel */}
      {history.length > 0 && (
        <div className="xl:hidden space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-white/30 text-[11px] font-semibold uppercase tracking-widest">Recent</span>
            <span className="text-white/15 text-[10px]">({history.length})</span>
          </div>
          {history.slice(0, 4).map((entry) => {
            const style = SCRIPT_STYLES.find((s) => s.name === entry.preset);
            return (
            <button
              key={entry.id}
              onClick={() => onViewHistory?.(entry)}
              className="w-full text-left flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] hover:bg-[#7A3BFF]/[0.06] hover:border-[#7A3BFF]/25 transition-all px-3.5 py-2.5"
            >
              <div className="h-8 w-8 rounded-lg flex items-center justify-center text-base overflow-hidden shrink-0"
                style={style ? { background: `${style.accentColor}18`, border: `1px solid ${style.accentColor}30` } : { border: "1px solid rgba(255,255,255,0.08)" }}
              >
                {entry.presetIcon?.startsWith("http")
                  ? <img src={entry.presetIcon} alt={entry.preset} className="w-full h-full object-cover" />
                  : style?.previewImage
                    ? <img src={style.previewImage} alt={entry.preset} className="w-full h-full object-cover" />
                    : <span>{style?.icon || entry.presetIcon}</span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-white/65 text-xs font-medium">{entry.preset}</span>
                  {entry.platform && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/[0.07] text-white/30 border border-white/[0.06]">
                      {PLATFORM_SHORT[entry.platform] || entry.platform}
                    </span>
                  )}
                  <span className="text-white/20 text-[10px] ml-auto shrink-0">{timeAgo(entry.createdAt)}</span>
                </div>
                <p className="text-white/25 text-[11px] mt-0.5 truncate">{entry.idea || "No description"}</p>
              </div>
            </button>
            );
          })}
        </div>
      )}

      {/* Image → Script idea */}
      <ImageToScriptIdea onResult={onImageIdea} />

      {/* Section header */}
      <div>
        <h2 className="text-white text-base font-bold tracking-tight">Choose your style</h2>
        <p className="text-white/30 text-xs mt-1">
          Each preset has a tuned creative engine. Pick one and go.
        </p>
      </div>

      {/* Style grid — 2 columns */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2.5">
          {PRESETS.map((style) => (
            <StyleCard key={style.id} style={style} onClick={() => onSelect(style)} />
          ))}
        </div>

        {/* Custom — full width, different visual treatment */}
        {CUSTOM && (
          <button
            onClick={() => onSelect(CUSTOM)}
            className="group w-full text-left px-4 py-3.5 rounded-xl border border-white/[0.07] bg-white/[0.03] hover:bg-[#7A3BFF]/[0.06] hover:border-[#7A3BFF]/30 transition-all duration-200 active:scale-[0.99] flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-white/[0.06] border border-white/[0.1] flex items-center justify-center text-base">
                {CUSTOM.icon}
              </div>
              <div>
                <div className="text-white text-[13px] font-semibold">{CUSTOM.name}</div>
                <div className="text-white/30 text-[11px] mt-0.5">{CUSTOM.tagline}</div>
              </div>
            </div>
            <span className="text-white/20 group-hover:text-white/55 text-sm transition-colors">→</span>
          </button>
        )}
      </div>

    </div>
  );
}
