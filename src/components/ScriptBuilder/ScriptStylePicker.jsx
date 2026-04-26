import { useRef, useState } from "react";
import {
  Loader2,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { SCRIPT_STYLES } from "../../lib/scriptTemplates";

const SAMPLE_REFERENCE_IMAGE = "/script/addimage.png";

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

      await supabase.from("viral_scripts").insert([{
        id: entryId,
        user_id: user.id,
        preset: "From Image",
        preset_icon: storedImageUrl ?? "image",
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
        className="group w-full rounded-xl border border-white/[0.08] bg-[#151718] px-3.5 py-3 text-left transition-colors hover:border-[#7A3BFF]/45 hover:bg-[#181A1B] active:scale-[0.99]"
      >
        <div className="flex items-center gap-3">
          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-white/[0.1] bg-white/[0.04]">
            {loading ? (
              <div className="flex h-full w-full items-center justify-center bg-[#7A3BFF]/10">
                <Loader2 className="h-4 w-4 animate-spin text-[#9B6DFF]" />
              </div>
            ) : preview ? (
              <img src={preview} alt="" className="h-full w-full object-cover" />
            ) : (
              <img src={SAMPLE_REFERENCE_IMAGE} alt="" className="h-full w-full object-cover" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold leading-tight text-white">
              {loading ? "Analyzing image..." : "Generate from image"}
            </p>
            <p className="mt-0.5 truncate text-[11px] leading-snug text-white/50">
              {loading ? "AI is crafting your viral concept" : "Add a reference photo"}
            </p>
          </div>

          <span className="shrink-0 rounded-lg border border-[#7A3BFF]/30 bg-[#7A3BFF]/12 px-3 py-1.5 text-[11px] font-bold text-[#C9B6FF] transition-colors group-hover:border-[#7A3BFF]/55 group-hover:bg-[#7A3BFF]/18">
            Add
          </span>
        </div>
      </button>

      {error && (
        <p className="mt-2 px-1 text-[11px] leading-snug text-red-400/70">{error}</p>
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

const PLATFORM_SHORT = {
  "YouTube Long": "YT Long",
  "YouTube Shorts": "YT Shorts",
  "Instagram Reels": "IG Reels",
  TikTok: "TikTok",
};

const STYLE_LABEL = {
  Shock: "Shock",
  "Curiosity Gap": "Curiosity",
  Storytelling: "Story",
  Authority: "Authority",
};

const FEATURED_PRESET = SCRIPT_STYLES.find((s) => s.id === "skeleton");
const PRESETS = SCRIPT_STYLES.filter((s) => s.id !== "custom" && s.id !== "skeleton");
const CUSTOM = SCRIPT_STYLES.find((s) => s.id === "custom");

function StyleRow({ style, onClick, recommended = false }) {
  const platformShort = PLATFORM_SHORT[style.defaults?.platform] || style.defaults?.platform;
  const scriptStyle = STYLE_LABEL[style.defaults?.style] || style.defaults?.style;

  return (
    <button
      onClick={onClick}
      className={`group w-full rounded-xl border p-3 text-left transition-colors active:scale-[0.99] ${
        recommended
          ? "border-[#7A3BFF]/45 bg-[#171522] hover:border-[#9B6DFF]/70"
          : "border-white/[0.08] bg-[#151718] hover:border-white/[0.16] hover:bg-[#181A1B]"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg text-base"
          style={{ background: `${style.accentColor}16`, border: `1px solid ${style.accentColor}30` }}
        >
          {style.previewImage
            ? <img src={style.previewImage} alt={style.name} className="h-full w-full object-cover" />
            : style.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="truncate text-[13px] font-bold leading-tight text-white">{style.name}</div>
            {recommended && (
              <span className="rounded-md bg-[#7A3BFF]/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#B69CFF]">
                Best
              </span>
            )}
          </div>
          <div className="mt-1 truncate text-[11px] leading-snug text-white/45">{style.tagline}</div>
          <div className="mt-2 flex gap-1.5">
            {platformShort && (
              <span className="rounded-md border border-white/[0.07] bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium text-white/45">
                {platformShort}
              </span>
            )}
            {scriptStyle && (
              <span className="rounded-md border border-white/[0.07] bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium text-white/45">
                {scriptStyle}
              </span>
            )}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-bold ${
            recommended
              ? "bg-[#7A3BFF] text-white"
              : "border border-white/[0.08] bg-white/[0.05] text-white/65 group-hover:border-[#7A3BFF]/35 group-hover:bg-[#7A3BFF]/10 group-hover:text-[#C9B6FF]"
          }`}
        >
          Use
        </span>
      </div>
    </button>
  );
}

function CustomRow({ style, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group w-full rounded-xl border border-white/[0.08] bg-[#151718] p-3 text-left transition-colors hover:border-white/[0.16] hover:bg-[#181A1B] active:scale-[0.99]"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.06] text-base">
          {style.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-bold leading-tight text-white">{style.name}</div>
          <div className="mt-1 truncate text-[11px] leading-snug text-white/45">{style.tagline}</div>
        </div>
        <span className="shrink-0 rounded-lg border border-white/[0.08] bg-white/[0.05] px-3 py-1.5 text-[11px] font-bold text-white/65 group-hover:border-[#7A3BFF]/35 group-hover:bg-[#7A3BFF]/10 group-hover:text-[#C9B6FF]">
          Use
        </span>
      </div>
    </button>
  );
}

export default function ScriptStylePicker({ onSelect, history = [], onViewHistory, onImageIdea }) {
  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      {history.length > 0 && (
        <div className="space-y-2 xl:hidden">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-white/30">Recent</span>
            <span className="text-[10px] text-white/15">({history.length})</span>
          </div>
          {history.slice(0, 4).map((entry) => {
            const style = SCRIPT_STYLES.find((s) => s.name === entry.preset);
            return (
              <button
                key={entry.id}
                onClick={() => onViewHistory?.(entry)}
                className="flex w-full items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-2.5 text-left transition-all hover:border-[#7A3BFF]/25 hover:bg-[#7A3BFF]/[0.06]"
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg text-base"
                  style={style ? { background: `${style.accentColor}18`, border: `1px solid ${style.accentColor}30` } : { border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  {entry.presetIcon?.startsWith("http")
                    ? <img src={entry.presetIcon} alt={entry.preset} className="h-full w-full object-cover" />
                    : style?.previewImage
                      ? <img src={style.previewImage} alt={entry.preset} className="h-full w-full object-cover" />
                      : <span>{style?.icon || entry.presetIcon}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-white/65">{entry.preset}</span>
                    {entry.platform && (
                      <span className="rounded-md border border-white/[0.06] bg-white/[0.07] px-1.5 py-0.5 text-[10px] text-white/30">
                        {PLATFORM_SHORT[entry.platform] || entry.platform}
                      </span>
                    )}
                    <span className="ml-auto shrink-0 text-[10px] text-white/20">{timeAgo(entry.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-white/25">{entry.idea || "No description"}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="rounded-2xl border border-white/[0.08] bg-[#111314] p-3">
        <div className="mb-3 px-1">
          <h2 className="text-[15px] font-bold tracking-tight text-white">Start a viral script</h2>
          <p className="mt-1 text-[12px] leading-snug text-white/45">Upload an image or choose a writing style.</p>
        </div>

        <ImageToScriptIdea onResult={onImageIdea} />

        <div className="mb-2 mt-4 px-1">
          <h3 className="text-[12px] font-bold uppercase tracking-wide text-white/35">Choose style</h3>
        </div>

        {FEATURED_PRESET && (
          <StyleRow
            style={FEATURED_PRESET}
            onClick={() => onSelect(FEATURED_PRESET)}
            recommended
          />
        )}

        <div className="mt-2 grid grid-cols-1 gap-2">
          {PRESETS.map((style) => (
            <StyleRow key={style.id} style={style} onClick={() => onSelect(style)} />
          ))}
        </div>

        {CUSTOM && (
          <div className="mt-2">
            <CustomRow style={CUSTOM} onClick={() => onSelect(CUSTOM)} />
          </div>
        )}
      </div>
    </div>
  );
}
