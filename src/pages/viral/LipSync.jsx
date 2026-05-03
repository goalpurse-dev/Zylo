import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useSEO } from "../../hooks/useSEO";

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const ACCEPTED_VIDEO = ["video/mp4", "video/quicktime", "video/webm"];
const ACCEPTED_AUDIO = ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/m4a", "audio/x-m4a"];
const MAX_VIDEO_MB   = 200;
const MAX_AUDIO_MB   = 50;

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const fmtBytes = (b) => {
  if (!b) return "";
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + " KB";
  return (b / (1024 * 1024)).toFixed(1) + " MB";
};

/* ═══════════════════════════════════════════════════════════════
   UPLOAD ZONE
═══════════════════════════════════════════════════════════════ */
function DropZone({ label, icon, accept, file, onFile, disabled, accentColor = "#7A3BFF", formats }) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    if (disabled) return;
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  return (
    <div>
      <p className="text-white/50 text-[12px] font-semibold uppercase tracking-widest mb-2">{label}</p>

      {file ? (
        /* File selected card */
        <div
          className="flex items-center gap-3 rounded-xl border px-4 py-3.5"
          style={{ background: `${accentColor}0d`, border: `1px solid ${accentColor}30` }}
        >
          <span className="text-xl shrink-0">{icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-white text-[13px] font-semibold truncate">{file.name}</p>
            <p className="text-white/35 text-[11px]">{fmtBytes(file.size)}</p>
          </div>
          {!disabled && (
            <button
              onClick={() => { onFile(null); if (inputRef.current) inputRef.current.value = ""; }}
              className="text-white/25 hover:text-white/70 text-[11px] transition-colors"
            >
              ✕
            </button>
          )}
        </div>
      ) : (
        /* Drop zone */
        <div
          onDragOver={(e) => { e.preventDefault(); if (!disabled) setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={handleDrop}
          onClick={() => !disabled && inputRef.current?.click()}
          className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 py-8 cursor-pointer transition-all duration-200"
          style={{
            borderColor: drag ? accentColor : `${accentColor}40`,
            background:  drag ? `${accentColor}0f` : `${accentColor}05`,
            boxShadow:   drag ? `0 0 20px ${accentColor}20` : "none",
            opacity:     disabled ? 0.45 : 1,
            cursor:      disabled ? "not-allowed" : "pointer",
          }}
        >
          <span className="text-2xl">{icon}</span>
          <div className="text-center">
            <p className="text-white/65 text-[13px] font-semibold">{drag ? "Drop it here" : "Drop file or click to browse"}</p>
            <p className="text-white/25 text-[11px] mt-0.5">{formats}</p>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   EMPTY STATE
═══════════════════════════════════════════════════════════════ */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 py-16 text-center">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl mb-6"
        style={{ background: "rgba(122,59,255,0.12)", border: "1px solid rgba(122,59,255,0.2)" }}
      >
        👄
      </div>
      <h2 className="text-white font-bold text-lg mb-2">Lip Sync Output</h2>
      <p className="text-white/35 text-sm max-w-xs leading-relaxed mb-10">
        Upload a video with a face and an audio file on the left, then hit Generate to sync the lips to your audio.
      </p>
      <div className="w-full max-w-sm space-y-2.5">
        {[
          { icon: "🎬", label: "Step 1 — Upload a face video", desc: "MP4, MOV, or WebM with a clear face" },
          { icon: "🎵", label: "Step 2 — Upload audio", desc: "MP3, WAV, or M4A — the voice to sync to" },
          { icon: "⚡", label: "Step 3 — Generate", desc: "AI syncs the lips in ~1–3 minutes" },
        ].map((s) => (
          <div key={s.label} className="flex items-start gap-3 text-left bg-white/[0.03] border border-white/[0.05] rounded-xl px-4 py-3">
            <span className="text-base mt-0.5">{s.icon}</span>
            <div>
              <p className="text-white/70 text-[12px] font-semibold">{s.label}</p>
              <p className="text-white/30 text-[11px] leading-relaxed">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PROCESSING STATE
═══════════════════════════════════════════════════════════════ */
function ProcessingState() {
  const [dots, setDots] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setDots((d) => (d + 1) % 4), 600);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 py-16 text-center">
      <div className="relative mb-8">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center text-3xl"
          style={{ background: "rgba(122,59,255,0.15)", border: "2px solid rgba(122,59,255,0.3)", boxShadow: "0 0 40px rgba(122,59,255,0.2)" }}
        >
          👄
        </div>
        <div className="absolute inset-0 rounded-full border-2 border-[#7A3BFF]/40" style={{ animation: "ping 1.5s cubic-bezier(0,0,0.2,1) infinite" }} />
      </div>
      <p className="text-white font-bold text-base mb-2">
        Syncing lips{".".repeat(dots)}
      </p>
      <p className="text-white/40 text-sm max-w-xs leading-relaxed mb-8">
        fal.ai MuseTalk is processing your video. This typically takes 1–3 minutes depending on length.
      </p>
      {/* Animated bar */}
      <div className="w-48 h-1 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            background: "linear-gradient(90deg, #7A3BFF, #FF57B2)",
            animation: "lipsyncProgress 2.5s ease-in-out infinite",
          }}
        />
      </div>
      <style>{`
        @keyframes lipsyncProgress {
          0%   { width: 15%; margin-left: 0%; }
          50%  { width: 40%; margin-left: 30%; }
          100% { width: 15%; margin-left: 85%; }
        }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   RESULT STATE
═══════════════════════════════════════════════════════════════ */
function ResultState({ resultUrl, onReset }) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res  = await fetch(resultUrl);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `lipsync-${Date.now()}.mp4`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* silent */ } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ overscrollBehavior: "contain" }}>
      <div className="flex-1 flex flex-col gap-5 p-5 pb-16">
        {/* Video player */}
        <div className="rounded-2xl overflow-hidden border border-white/[0.07] bg-black">
          <video
            src={resultUrl}
            controls
            autoPlay
            loop
            playsInline
            className="w-full max-h-[70vh] object-contain"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex-1 py-3 rounded-xl font-semibold text-white text-[14px] transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            style={{
              background: "linear-gradient(135deg, #7A3BFF, #FF57B2)",
              boxShadow: "0 4px 20px rgba(122,59,255,0.35)",
            }}
          >
            {downloading ? "Downloading…" : "⬇ Download Video"}
          </button>
          <button
            onClick={onReset}
            className="px-4 py-3 rounded-xl border border-white/[0.10] text-white/50 hover:text-white hover:border-white/25 text-[13px] font-medium transition-all"
          >
            New
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */
export default function LipSync() {
  useSEO({
    title: "AI Lip Sync — Sync Any Face to Any Audio | Zyvo",
    description: "Upload a face video and an audio file. Zyvo's AI syncs the lips to match the audio perfectly using MuseTalk.",
    canonical: "https://www.tryzyvo.com/workspace/lip-sync",
  });

  /* ── file state ── */
  const [videoFile, setVideoFile] = useState(null);
  const [audioFile, setAudioFile] = useState(null);

  /* ── generation state ── */
  const [status,    setStatus]    = useState("idle"); // idle | uploading | processing | completed | failed
  const [resultUrl, setResultUrl] = useState(null);
  const [errorMsg,  setErrorMsg]  = useState("");

  /* ── auth ── */
  const [userId,   setUserId]   = useState(null);
  const [planCode, setPlanCode] = useState(null);

  /* ── mobile ── */
  const [mobileView, setMobileView] = useState("input"); // input | result

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!mounted || !user) return;
      setUserId(user.id);
      const { data: p } = await supabase.from("profiles").select("plan_code").eq("id", user.id).single();
      if (mounted) setPlanCode((p?.plan_code || "free").toLowerCase());
    })();
    const { data: l } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s?.user) setUserId(s.user.id);
      else setUserId(null);
    });
    return () => { mounted = false; l.subscription.unsubscribe(); };
  }, []);

  /* ── file validation ── */
  const handleVideoFile = useCallback((f) => {
    if (!f) { setVideoFile(null); return; }
    if (!ACCEPTED_VIDEO.includes(f.type)) { setErrorMsg("Video must be MP4, MOV, or WebM."); return; }
    if (f.size > MAX_VIDEO_MB * 1024 * 1024) { setErrorMsg(`Video too large (max ${MAX_VIDEO_MB}MB).`); return; }
    setErrorMsg(""); setVideoFile(f);
  }, []);

  const handleAudioFile = useCallback((f) => {
    if (!f) { setAudioFile(null); return; }
    if (!ACCEPTED_AUDIO.includes(f.type) && !f.name.match(/\.(mp3|wav|m4a)$/i)) {
      setErrorMsg("Audio must be MP3, WAV, or M4A."); return;
    }
    if (f.size > MAX_AUDIO_MB * 1024 * 1024) { setErrorMsg(`Audio too large (max ${MAX_AUDIO_MB}MB).`); return; }
    setErrorMsg(""); setAudioFile(f);
  }, []);

  /* ── upload helper ── */
  const uploadFile = async (file, prefix) => {
    const ext  = file.name.split(".").pop() || "bin";
    const path = `${userId}/${prefix}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("lipsync-inputs")
      .upload(path, file, { upsert: false });
    if (error) throw new Error("Upload failed: " + error.message);
    const { data: pub } = supabase.storage.from("lipsync-inputs").getPublicUrl(path);
    return pub.publicUrl;
  };

  /* ── generate ── */
  const handleGenerate = async () => {
    if (!videoFile || !audioFile || !userId) return;
    if (planCode === "free") {
      setErrorMsg("Lip Sync is available on Starter and above. Upgrade to get access.");
      return;
    }

    setStatus("uploading");
    setErrorMsg("");

    try {
      // 1. Upload both files to storage
      const [videoUrl, audioUrl] = await Promise.all([
        uploadFile(videoFile, "video"),
        uploadFile(audioFile, "audio"),
      ]);

      // 2. Call edge function
      setStatus("processing");

      const { data, error } = await supabase.functions.invoke("lipsync", {
        body: { videoUrl, audioUrl, userId },
      });

      if (error) throw new Error(error.message || "Processing failed");
      if (!data?.resultUrl) throw new Error("No result URL returned");

      setResultUrl(data.resultUrl);
      setStatus("completed");
      setMobileView("result");
    } catch (e) {
      setStatus("failed");
      setErrorMsg(e.message || "Something went wrong. Please try again.");
    }
  };

  const handleReset = () => {
    setVideoFile(null);
    setAudioFile(null);
    setStatus("idle");
    setResultUrl(null);
    setErrorMsg("");
    setMobileView("input");
  };

  const isProcessing = status === "uploading" || status === "processing";
  const canGenerate  = !!videoFile && !!audioFile && !isProcessing && status !== "completed";

  /* ═══════════════ LEFT PANEL ═══════════════ */
  const LeftPanel = (
    <div className={`w-full xl:max-w-[420px] xl:min-w-[380px] border-r border-white/[0.06] bg-[#111314] flex flex-col ${mobileView === "result" ? "hidden xl:flex" : "flex"}`}>

      {/* Header */}
      <div className="shrink-0 px-5 py-4 border-b border-white/[0.06] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center text-base shrink-0"
            style={{ background: "linear-gradient(135deg, #7A3BFF, #FF57B2)", boxShadow: "0 0 16px rgba(122,59,255,0.5)" }}
          >
            👄
          </div>
          <div>
            <h1 className="text-white text-sm font-bold leading-tight flex items-center gap-2">
              Lip Sync
              <span className="text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded-md bg-[#FF57B2]/20 text-[#FF57B2] border border-[#FF57B2]/30">beta</span>
            </h1>
            <p className="text-white/50 text-[11px]">Sync any face to any audio</p>
          </div>
        </div>
        {status === "completed" && (
          <button onClick={handleReset} className="text-[11px] text-white/35 hover:text-white/70 border border-white/10 hover:border-white/25 px-3 py-1.5 rounded-lg transition-all">
            + New
          </button>
        )}
        {status === "completed" && (
          <button onClick={() => setMobileView("result")} className="xl:hidden text-[11px] text-[#9B6DFF] border border-[#7A3BFF]/40 px-3 py-1.5 rounded-lg font-medium hover:bg-[#7A3BFF]/10 transition-all">
            View Result →
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto pb-24 xl:pb-6" style={{ overscrollBehavior: "contain" }}>
        <div className="px-5 py-5 space-y-5">

          {/* Video upload */}
          <DropZone
            label="Face Video"
            icon="🎬"
            accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm"
            file={videoFile}
            onFile={handleVideoFile}
            disabled={isProcessing}
            accentColor="#7A3BFF"
            formats="MP4 · MOV · WebM · up to 200 MB"
          />

          {/* Audio upload */}
          <DropZone
            label="Audio File"
            icon="🎵"
            accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4,audio/m4a"
            file={audioFile}
            onFile={handleAudioFile}
            disabled={isProcessing}
            accentColor="#FF57B2"
            formats="MP3 · WAV · M4A · up to 50 MB"
          />

          {/* Status / error */}
          {errorMsg && (
            <div className="flex items-start gap-2.5 bg-red-500/08 border border-red-500/20 rounded-xl px-4 py-3">
              <span className="text-red-400 text-[13px] shrink-0 mt-0.5">⚠</span>
              <p className="text-red-400/80 text-[12px] leading-relaxed">{errorMsg}</p>
            </div>
          )}

          {isProcessing && (
            <div className="flex items-center gap-2.5 bg-[#7A3BFF]/08 border border-[#7A3BFF]/20 rounded-xl px-4 py-3">
              <span className="text-[#9B6DFF] text-[13px] shrink-0 animate-spin">⚙</span>
              <p className="text-[#9B6DFF] text-[12px]">
                {status === "uploading" ? "Uploading files…" : "Processing with MuseTalk — this takes 1–3 min…"}
              </p>
            </div>
          )}

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="w-full py-4 rounded-xl font-bold text-white text-[15px] transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center gap-2.5"
            style={canGenerate ? {
              background: "linear-gradient(135deg, #7A3BFF 0%, #FF57B2 100%)",
              boxShadow: "0 4px 32px rgba(122,59,255,0.45), 0 0 0 1px rgba(255,255,255,0.08)",
            } : {
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {isProcessing ? (
              <>
                <span className="animate-spin text-[14px]">⚙</span>
                {status === "uploading" ? "Uploading…" : "Generating…"}
              </>
            ) : (
              <>👄 Generate Lip Sync</>
            )}
          </button>

          {/* Info note */}
          {!isProcessing && (
            <p className="text-white/20 text-[11px] text-center leading-relaxed">
              Powered by fal.ai MuseTalk · Results saved to your account
            </p>
          )}

        </div>
      </div>
    </div>
  );

  /* ═══════════════ RIGHT PANEL ═══════════════ */
  const RightPanel = (
    <div className="hidden xl:flex flex-1 flex-col overflow-hidden bg-[#111314]">
      <div className="shrink-0 px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
        <span className="text-white/30 text-[10px] font-bold uppercase tracking-widest">
          {status === "idle"      ? "Output"
         : isProcessing           ? "Processing…"
         : status === "completed" ? "Result"
         :                          "Failed"}
        </span>
        {status === "completed" && (
          <button onClick={handleReset} className="text-xs text-white/35 hover:text-white/70 border border-white/10 hover:border-white/25 px-3 py-1.5 rounded-lg transition-all">
            + New
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {status === "idle"      && <EmptyState />}
        {isProcessing           && <ProcessingState />}
        {status === "completed" && resultUrl && <ResultState resultUrl={resultUrl} onReset={handleReset} />}
        {status === "failed"    && (
          <div className="flex flex-col items-center justify-center h-full px-8 py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-2xl mb-5">❌</div>
            <h2 className="text-white font-bold text-base mb-2">Generation Failed</h2>
            <p className="text-white/40 text-sm max-w-xs leading-relaxed mb-6">{errorMsg}</p>
            <button onClick={handleReset} className="px-6 py-2.5 rounded-xl border border-white/10 text-white/60 text-sm font-medium hover:text-white hover:border-white/25 transition-all">
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );

  /* ═══════════════ MOBILE RESULT ═══════════════ */
  const MobileResult = mobileView === "result" && status !== "idle" && (
    <div className="xl:hidden flex flex-col w-full h-full bg-[#111314]">
      <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
        <button onClick={() => setMobileView("input")} className="flex items-center gap-2 text-white/45 hover:text-white/80 text-sm transition-colors">
          <span className="text-base">←</span> Back
        </button>
        <span className="text-white text-sm font-semibold">
          {isProcessing ? "Processing…" : status === "completed" ? "Result" : "Failed"}
        </span>
        {status === "completed" && (
          <button onClick={handleReset} className="text-xs text-[#9B6DFF] font-medium hover:text-[#B88FFF] transition-colors">New</button>
        )}
        {status !== "completed" && <div className="w-8" />}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {isProcessing           && <ProcessingState />}
        {status === "completed" && resultUrl && <ResultState resultUrl={resultUrl} onReset={handleReset} />}
        {status === "failed"    && (
          <div className="flex flex-col items-center justify-center h-full px-8 text-center">
            <p className="text-white font-bold mb-2">Generation Failed</p>
            <p className="text-white/40 text-sm mb-6">{errorMsg}</p>
            <button onClick={handleReset} className="px-6 py-2.5 rounded-xl border border-white/10 text-white/60 text-sm">Try again</button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-full w-full flex overflow-hidden bg-[#111314]">
      {MobileResult || LeftPanel}
      {RightPanel}
    </div>
  );
}
