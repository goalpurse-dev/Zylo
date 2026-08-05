import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useSEO } from "../../hooks/useSEO";
import Face1 from "../../assets/blog/image-generator/human1.png";
import Face2 from "../../assets/blog/image-generator/human2.png";
import Face3 from "../../assets/blog/image-generator/human3.png";
import Face4 from "../../assets/blog/image-generator/human4.png";
import Face5 from "../../assets/blog/image-generator/human5.png";
import { saveMediaToDevice } from "../../lib/downloadMedia";

const PLACEHOLDER_FACES = [Face1, Face2, Face3, Face4, Face5];

/* ─── constants ─────────────────────────────────────────────── */
const ACCEPTED_VIDEO = ["video/mp4", "video/quicktime", "video/webm"];
const ACCEPTED_AUDIO = ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/m4a", "audio/x-m4a"];
const MAX_VIDEO_MB = 200;
const MAX_AUDIO_MB = 50;

const fmtBytes = (b) => {
  if (!b) return "";
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + " KB";
  return (b / (1024 * 1024)).toFixed(1) + " MB";
};

/* ─── SVG icons ─────────────────────────────────────────────── */
const IconVideo = ({ size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="15" height="16" rx="2"/>
    <path d="m17 8 5-3v14l-5-3"/>
  </svg>
);

const IconAudio = ({ size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 10v4"/><path d="M6 6v12"/><path d="M10 3v18"/><path d="M14 8v8"/><path d="M18 5v14"/><path d="M22 10v4"/>
  </svg>
);

const IconUpload = ({ size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);

const IconCheck = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const IconX = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

/* ─── Audio waveform display ─────────────────────────────────── */
const WAVE_HEIGHTS = [30, 55, 75, 45, 85, 60, 40, 70, 90, 50, 65, 80, 35, 75, 55, 85, 45, 70, 60, 90, 40, 65, 75, 50, 80, 35, 60, 70, 45, 85, 55, 65];

function AudioWaveform({ animate = false }) {
  return (
    <div className="flex items-center gap-[3px] h-10">
      {WAVE_HEIGHTS.map((h, i) => (
        <div
          key={i}
          className="rounded-full shrink-0"
          style={{
            width: 2.5,
            height: `${h}%`,
            background: animate
              ? `linear-gradient(180deg, #A78BFF, #7A3BFF)`
              : "rgba(122,59,255,0.35)",
            animation: animate ? `waveBar ${0.6 + (i % 7) * 0.09}s ease-in-out ${i * 0.03}s infinite alternate` : "none",
          }}
        />
      ))}
    </div>
  );
}

/* ─── Face fan config ────────────────────────────────────────── */
const FAN = [
  { x: -82, y: 10, r: -18, s: 0.72, o: 0.50, z: 1 },
  { x: -42, y: 4,  r: -9,  s: 0.87, o: 0.68, z: 2 },
  { x:   0, y:  0, r:  0,  s: 1.00, o: 1.00, z: 5 },
  { x:  42, y: 4,  r:  9,  s: 0.87, o: 0.68, z: 2 },
  { x:  82, y: 10, r:  18, s: 0.72, o: 0.50, z: 1 },
];

/* ─── Ambient wave SVG background ────────────────────────────── */
function AmbientWaves({ intensity = 1 }) {
  const W = 520, H = 90;
  const wave = (y, amp, freq) => {
    let d = `M0,${y}`;
    for (let x = 4; x <= W; x += 4) {
      d += ` L${x},${(y + amp * Math.sin((x / W) * freq * Math.PI * 2)).toFixed(2)}`;
    }
    return d;
  };
  const layers = [
    { y: 16, amp: 5,  freq: 2.5, op: 0.22 * intensity, spd: 14, color: "#7A3BFF" },
    { y: 30, amp: 9,  freq: 1.8, op: 0.13 * intensity, spd: 22, color: "#9B6DFF" },
    { y: 45, amp: 6,  freq: 3.2, op: 0.20 * intensity, spd: 11, color: "#A78BFF" },
    { y: 58, amp: 11, freq: 2.0, op: 0.10 * intensity, spd: 28, color: "#7A3BFF" },
    { y: 72, amp: 5,  freq: 4.0, op: 0.17 * intensity, spd: 16, color: "#C4B5FD" },
    { y: 83, amp: 7,  freq: 2.8, op: 0.09 * intensity, spd: 20, color: "#9B6DFF" },
  ];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
      {layers.map((l, i) => (
        <svg key={i} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full"
          style={{ animation: `waveDrift${i % 2 === 0 ? "R" : "L"} ${l.spd}s linear infinite`, opacity: l.op }}>
          <path d={wave(l.y, l.amp, l.freq)} fill="none" stroke={l.color} strokeWidth="1.2" />
        </svg>
      ))}
      <style>{`
        @keyframes waveDriftR { 0% { transform: translateX(-4%) } 100% { transform: translateX(4%) } }
        @keyframes waveDriftL { 0% { transform: translateX(4%)  } 100% { transform: translateX(-4%) } }
      `}</style>
    </div>
  );
}

/* ─── Video upload zone ──────────────────────────────────────── */
function VideoZone({ file, previewUrl, onFile, disabled }) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault(); setDrag(false);
    if (disabled) return;
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: "rgba(122,59,255,0.22)" }}>
            <IconVideo size={11} color="#A78BFF" />
          </div>
          <span className="text-white font-semibold text-[12px] tracking-wide">Face Video</span>
        </div>
        {file && !disabled && (
          <button onClick={() => { onFile(null); if (inputRef.current) inputRef.current.value = ""; }}
            className="flex items-center gap-1 text-white/45 hover:text-white/80 text-[11px] transition-colors px-1.5 py-0.5 rounded hover:bg-white/5">
            <IconX size={11} /> Remove
          </button>
        )}
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={handleDrop}
        onClick={() => !file && !disabled && inputRef.current?.click()}
        className="relative w-full rounded-xl overflow-hidden transition-all duration-300"
        style={{
          height: 130,
          background: file ? "#000" : drag ? "rgba(122,59,255,0.1)" : "#0D0D16",
          border: `1px solid ${file ? "rgba(122,59,255,0.45)" : drag ? "#9D6BFF" : "rgba(122,59,255,0.28)"}`,
          cursor: file ? "default" : disabled ? "not-allowed" : "pointer",
          boxShadow: drag
            ? "0 0 0 3px rgba(122,59,255,0.18), 0 0 40px rgba(122,59,255,0.12)"
            : "0 0 0 1px rgba(122,59,255,0.08), 0 0 24px rgba(122,59,255,0.06)",
        }}
      >
        {file && previewUrl ? (
          <video src={previewUrl} className="w-full h-full object-contain" muted playsInline preload="none" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
            {/* Faces fan */}
            <div className="relative flex items-center justify-center mb-3" style={{ height: 56, width: "100%" }}>
              {PLACEHOLDER_FACES.map((src, i) => {
                const c = FAN[i];
                return (
                  <div key={i} className="absolute rounded-lg overflow-hidden"
                    style={{
                      width: 40, height: 40,
                      transform: `translateX(${c.x}px) translateY(${c.y}px) rotate(${c.r}deg) scale(${c.s})`,
                      zIndex: c.z,
                      opacity: drag ? c.o * 0.7 : c.o,
                      boxShadow: i === 2
                        ? "0 4px 24px rgba(0,0,0,0.7), 0 0 0 1.5px rgba(122,59,255,0.5)"
                        : "0 2px 12px rgba(0,0,0,0.5)",
                      transition: "all 0.3s ease",
                    }}>
                    <img src={src} alt="" className="w-full h-full object-cover" />
                  </div>
                );
              })}
            </div>
            <div className="text-center">
              <p className="text-white/80 text-[12px] font-semibold">{drag ? "Drop video here" : "Upload face video"}</p>
              <p className="text-white/35 text-[10px] mt-0.5">MP4 · MOV · WebM · up to 200 MB</p>
            </div>
          </div>
        )}

        {file && (
          <div className="absolute bottom-0 inset-x-0 flex items-center gap-2 px-3 py-1.5"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85), transparent)" }}>
            <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0" style={{ background: "#7A3BFF" }}>
              <IconCheck size={8} />
            </div>
            <span className="text-white/80 text-[11px] truncate">{file.name}</span>
            <span className="text-white/45 text-[10px] shrink-0">{fmtBytes(file.size)}</span>
          </div>
        )}
      </div>

      <input ref={inputRef} type="file" accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
    </div>
  );
}

/* ─── Audio upload zone ──────────────────────────────────────── */
function AudioZone({ file, onFile, disabled }) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault(); setDrag(false);
    if (disabled) return;
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: "rgba(168,85,247,0.22)" }}>
            <IconAudio size={11} color="#C084FC" />
          </div>
          <span className="text-white font-semibold text-[12px] tracking-wide">Audio File</span>
        </div>
        {file && !disabled && (
          <button onClick={() => { onFile(null); if (inputRef.current) inputRef.current.value = ""; }}
            className="flex items-center gap-1 text-white/45 hover:text-white/80 text-[11px] transition-colors px-1.5 py-0.5 rounded hover:bg-white/5">
            <IconX size={11} /> Remove
          </button>
        )}
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={handleDrop}
        onClick={() => !file && !disabled && inputRef.current?.click()}
        className="relative w-full rounded-xl overflow-hidden transition-all duration-300"
        style={{
          background: file ? "#0C0A18" : "#0D0D16",
          border: `1px solid ${file ? "rgba(168,85,247,0.4)" : drag ? "#A78BFF" : "rgba(122,59,255,0.28)"}`,
          cursor: file ? "default" : disabled ? "not-allowed" : "pointer",
          boxShadow: drag
            ? "0 0 0 3px rgba(122,59,255,0.18), 0 0 40px rgba(122,59,255,0.12)"
            : "0 0 0 1px rgba(122,59,255,0.08), 0 0 24px rgba(122,59,255,0.06)",
          padding: file ? "14px" : "0",
          minHeight: 80,
        }}
      >
        {file ? (
          /* Audio loaded — waveform display */
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(122,59,255,0.2)", border: "1px solid rgba(122,59,255,0.3)" }}>
              <IconAudio size={15} color="#A78BFF" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-[13px] font-semibold truncate mb-1">{file.name}</p>
              <AudioWaveform animate={!disabled} />
            </div>
            <span className="text-white/30 text-[11px] shrink-0 self-start">{fmtBytes(file.size)}</span>
          </div>
        ) : (
          /* Empty state — ambient waves */
          <div className="relative flex items-center justify-center" style={{ height: 82 }}>
            <AmbientWaves intensity={drag ? 1.6 : 1} />
            {/* Center content */}
            <div className="relative z-10 flex items-center gap-3 select-none">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-300"
                style={{
                  background: drag ? "rgba(122,59,255,0.4)" : "rgba(122,59,255,0.18)",
                  border: `1px solid ${drag ? "rgba(167,139,250,0.6)" : "rgba(122,59,255,0.35)"}`,
                  boxShadow: drag ? "0 0 16px rgba(122,59,255,0.5)" : "none",
                }}>
                <IconAudio size={15} color={drag ? "#E9D5FF" : "#A78BFF"} />
              </div>
              <div>
                <p className="text-white/85 text-[12px] font-semibold">{drag ? "Drop audio here" : "Upload audio file"}</p>
                <p className="text-white/35 text-[10px] mt-0.5">MP3 · WAV · M4A · up to 50 MB</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <input ref={inputRef} type="file" accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4,audio/m4a" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
    </div>
  );
}

/* ─── Empty state ────────────────────────────────────────────── */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 py-12 text-center">
      {/* Placeholder "screen" */}
      <div className="w-full max-w-sm mb-10">
        <div className="rounded-xl overflow-hidden" style={{ background: "#0E0E18", border: "1px solid rgba(122,59,255,0.22)", aspectRatio: "16/9", position: "relative" }}>
          <div className="absolute inset-0 flex items-center justify-center">
            <div style={{ opacity: 0.22 }}>
              <IconVideo size={48} color="#9D6BFF" />
            </div>
          </div>
          {/* Fake scan line */}
          <div className="absolute inset-x-0 h-px" style={{ top: "50%", background: "linear-gradient(90deg, transparent, rgba(122,59,255,0.4), transparent)" }} />
        </div>
        {/* Fake waveform below */}
        <div className="mt-3 flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ background: "rgba(122,59,255,0.08)", border: "1px solid rgba(122,59,255,0.2)" }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(122,59,255,0.15)" }}>
            <IconAudio size={13} color="rgba(122,59,255,0.6)" />
          </div>
          <AudioWaveform animate={false} />
        </div>
      </div>

      <h2 className="text-white font-bold text-lg mb-2 tracking-tight">Output will appear here</h2>
      <p className="text-white/55 text-sm max-w-xs leading-relaxed mb-8">
        Upload a face video and audio file on the left. The lip-synced result will play here when ready.
      </p>

      <div className="w-full max-w-sm space-y-2">
        {[
          { n: "01", label: "Upload a face video", sub: "MP4, MOV, WebM — clear frontal face required" },
          { n: "02", label: "Upload audio",         sub: "MP3, WAV, M4A — the voice to sync to the face" },
          { n: "03", label: "Generate",             sub: "MuseTalk AI processes in ~1–3 minutes" },
        ].map((s) => (
          <div key={s.n} className="flex items-start gap-3 text-left px-4 py-3 rounded-xl"
            style={{ background: "rgba(122,59,255,0.06)", border: "1px solid rgba(122,59,255,0.18)" }}>
            <span className="text-[10px] font-bold tracking-widest mt-0.5 shrink-0" style={{ color: "#7A3BFF" }}>{s.n}</span>
            <div>
              <p className="text-white/80 text-[13px] font-semibold">{s.label}</p>
              <p className="text-white/30 text-[11px] leading-snug mt-0.5">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Processing state ───────────────────────────────────────── */
function ProcessingState({ uploading }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const dots = ".".repeat((tick % 3) + 1);

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 py-16 text-center">
      {/* Animated waveform orb */}
      <div className="relative w-20 h-20 mb-8 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full opacity-20" style={{ background: "radial-gradient(circle, #7A3BFF, transparent)", animation: "pulse 2s ease-in-out infinite" }} />
        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "rgba(122,59,255,0.15)", border: "1px solid rgba(122,59,255,0.3)" }}>
          <IconAudio size={28} color="#A78BFF" />
        </div>
      </div>

      <p className="text-white font-bold text-base mb-1.5">
        {uploading ? "Uploading files" : `Processing${dots}`}
      </p>
      <p className="text-white/55 text-sm max-w-xs leading-relaxed mb-8">
        {uploading
          ? "Transferring your files to secure storage…"
          : "MuseTalk is analysing facial landmarks and synchronising lip motion. This usually takes 1–3 minutes."}
      </p>

      {/* Progress bar */}
      <div className="w-48 h-0.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div className="h-full rounded-full" style={{ background: "linear-gradient(90deg, #7A3BFF, #A78BFF)", animation: "processSweep 2s ease-in-out infinite" }} />
      </div>

      <style>{`
        @keyframes processSweep {
          0%   { width: 15%; margin-left: 0 }
          50%  { width: 45%; margin-left: 28% }
          100% { width: 15%; margin-left: 85% }
        }
        @keyframes waveBar {
          from { transform: scaleY(0.4); }
          to   { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}

/* ─── Result state ───────────────────────────────────────────── */
function ResultState({ resultUrl, onReset }) {
  const [dl, setDl] = useState(false);

  const download = async () => {
    setDl(true);
    try {
      await saveMediaToDevice({
        url: resultUrl,
        filename: `lipsync-${Date.now()}.mp4`,
        title: "My lip-sync video",
      });
    } catch { /**/ } finally { setDl(false); }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ overscrollBehavior: "contain" }}>
      <div className="flex flex-col gap-4 p-5 pb-16">

        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-emerald-400 text-[12px] font-semibold">Complete</span>
        </div>

        <div className="rounded-xl overflow-hidden" style={{ background: "#000", border: "1px solid rgba(255,255,255,0.08)" }}>
          <video src={resultUrl} controls autoPlay loop playsInline preload="none" className="w-full max-h-[65vh] object-contain" />
        </div>

        <div className="flex gap-2">
          <button onClick={download} disabled={dl}
            className="flex-1 py-3 rounded-xl font-semibold text-white text-[14px] transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, #7A3BFF, #9D6BFF)", boxShadow: "0 4px 20px rgba(122,59,255,0.35)" }}>
            <IconUpload size={16} color="white" />
            {dl ? "Downloading…" : "Download"}
          </button>
          <button onClick={onReset}
            className="px-4 py-3 rounded-xl text-white/45 hover:text-white text-[13px] font-medium transition-all"
            style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
            New
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE
═══════════════════════════════════════════════════════════════ */
export default function LipSync() {
  useSEO({ title: "AI Lip Sync | Zyvo", description: "Sync any face to any audio using AI." });

  const [videoFile,   setVideoFile]   = useState(null);
  const [previewUrl,  setPreviewUrl]  = useState(null);
  const [audioFile,   setAudioFile]   = useState(null);
  const [status,      setStatus]      = useState("idle");
  const [resultUrl,   setResultUrl]   = useState(null);
  const [errorMsg,    setErrorMsg]    = useState("");
  const [userId,      setUserId]      = useState(null);
  const [planCode,    setPlanCode]    = useState(null);
  const [mobileView,  setMobileView]  = useState("input");

  useEffect(() => {
    let m = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!m || !user) return;
      setUserId(user.id);
      const { data: p } = await supabase.from("profiles").select("plan_code").eq("id", user.id).single();
      if (m) setPlanCode((p?.plan_code || "free").toLowerCase());
    })();
    const { data: l } = supabase.auth.onAuthStateChange((_e, s) => {
      setUserId(s?.user?.id ?? null);
    });
    return () => { m = false; l.subscription.unsubscribe(); };
  }, []);

  const handleVideoFile = useCallback((f) => {
    if (!f) {
      setVideoFile(null);
      if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
      return;
    }
    if (!ACCEPTED_VIDEO.includes(f.type)) { setErrorMsg("Video must be MP4, MOV, or WebM."); return; }
    if (f.size > MAX_VIDEO_MB * 1024 * 1024) { setErrorMsg(`Video too large (max ${MAX_VIDEO_MB} MB).`); return; }
    setErrorMsg("");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(f));
    setVideoFile(f);
  }, [previewUrl]);

  const handleAudioFile = useCallback((f) => {
    if (!f) { setAudioFile(null); return; }
    if (!ACCEPTED_AUDIO.includes(f.type) && !f.name.match(/\.(mp3|wav|m4a)$/i)) {
      setErrorMsg("Audio must be MP3, WAV, or M4A."); return;
    }
    if (f.size > MAX_AUDIO_MB * 1024 * 1024) { setErrorMsg(`Audio too large (max ${MAX_AUDIO_MB} MB).`); return; }
    setErrorMsg(""); setAudioFile(f);
  }, []);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const uploadFile = async (file, prefix) => {
    const ext  = file.name.split(".").pop() || "bin";
    const path = `${userId}/${prefix}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("lipsync-inputs").upload(path, file, { upsert: false });
    if (error) throw new Error("Upload failed: " + error.message);
    return supabase.storage.from("lipsync-inputs").getPublicUrl(path).data.publicUrl;
  };

  const handleGenerate = async () => {
    if (!videoFile || !audioFile || !userId) return;
    if (planCode === "free") { setErrorMsg("Lip Sync is available on Starter and above."); return; }
    setStatus("uploading"); setErrorMsg("");
    try {
      const [videoUrl, audioUrl] = await Promise.all([uploadFile(videoFile, "video"), uploadFile(audioFile, "audio")]);
      setStatus("processing");
      const { data, error } = await supabase.functions.invoke("lipsync", { body: { videoUrl, audioUrl, userId } });
      if (error) throw new Error(error.message);
      if (!data?.resultUrl) throw new Error("No result URL returned");
      setResultUrl(data.resultUrl); setStatus("completed"); setMobileView("result");
    } catch (e) {
      setStatus("failed"); setErrorMsg(e.message || "Something went wrong.");
    }
  };

  const handleReset = () => {
    setVideoFile(null); setAudioFile(null);
    if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
    setStatus("idle"); setResultUrl(null); setErrorMsg(""); setMobileView("input");
  };

  const isProcessing = status === "uploading" || status === "processing";
  const canGenerate  = !!videoFile && !!audioFile && !isProcessing && status !== "completed";

  /* ── Left panel ── */
  const LeftPanel = (
    <div className={`w-full xl:max-w-[400px] xl:min-w-[360px] flex flex-col bg-[#111318] border-r border-white/[0.08] ${mobileView === "result" ? "hidden xl:flex" : "flex"}`}>

      {/* Header */}
      <div className="shrink-0 px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, #7A3BFF, #9D6BFF)", boxShadow: "0 0 14px rgba(122,59,255,0.4)" }}>
            <IconAudio size={15} color="white" />
          </div>
          <div>
            <h1 className="text-white text-[14px] font-bold flex items-center gap-2">
              Lip Sync
              <span className="text-[9px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded"
                style={{ background: "rgba(122,59,255,0.2)", color: "#A78BFF", border: "1px solid rgba(122,59,255,0.3)" }}>
                BETA
              </span>
            </h1>
            <p className="text-white/55 text-[11px]">Sync any face to any audio</p>
          </div>
        </div>
        {status === "completed" && (
          <div className="flex items-center gap-2">
            <button onClick={handleReset}
              className="text-[11px] text-white/55 hover:text-white/70 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
              style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              + New
            </button>
            <button onClick={() => setMobileView("result")}
              className="xl:hidden text-[11px] text-[#A78BFF] px-3 py-1.5 rounded-lg font-medium transition-all hover:bg-[#7A3BFF]/10"
              style={{ border: "1px solid rgba(122,59,255,0.3)" }}>
              View Result →
            </button>
          </div>
        )}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto pb-24 xl:pb-6" style={{ overscrollBehavior: "contain" }}>
        <div className="px-5 py-5 flex flex-col gap-5">

          {/* Video zone */}
          <VideoZone file={videoFile} previewUrl={previewUrl} onFile={handleVideoFile} disabled={isProcessing} />

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full h-px" style={{ background: "rgba(255,255,255,0.05)" }} />
            </div>
            <div className="relative flex justify-center">
              <span className="px-2 text-[11px] text-white/45 font-semibold tracking-widest uppercase"
                style={{ background: "#111318" }}>
                then
              </span>
            </div>
          </div>

          {/* Audio zone */}
          <AudioZone file={audioFile} onFile={handleAudioFile} disabled={isProcessing} />

          {/* Error */}
          {errorMsg && (
            <div className="flex items-start gap-2.5 rounded-lg px-3.5 py-3"
              style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.18)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgb(239,68,68)" strokeWidth="2" className="shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p className="text-red-400/80 text-[12px] leading-relaxed">{errorMsg}</p>
            </div>
          )}

          {/* Processing status */}
          {isProcessing && (
            <div className="flex items-center gap-2.5 rounded-lg px-3.5 py-3"
              style={{ background: "rgba(122,59,255,0.08)", border: "1px solid rgba(122,59,255,0.2)" }}>
              <svg className="animate-spin shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A78BFF" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              <p className="text-[#A78BFF] text-[12px] font-medium">
                {status === "uploading" ? "Uploading files…" : "Processing with MuseTalk — 1–3 min…"}
              </p>
            </div>
          )}

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="w-full py-3.5 rounded-xl font-semibold text-[14px] transition-all active:scale-[0.98] flex items-center justify-center gap-2.5 relative overflow-hidden"
            style={canGenerate ? {
              background: "linear-gradient(135deg, #7A3BFF, #9D6BFF)",
              boxShadow: "0 0 0 1px rgba(155,109,255,0.5), 0 6px 32px rgba(122,59,255,0.6)",
              color: "white",
            } : {
              background: "rgba(76,29,149,0.35)",
              border: "1px solid rgba(122,59,255,0.35)",
              color: "rgba(167,139,250,0.5)",
              cursor: "not-allowed",
            }}
          >
            {isProcessing ? (
              <>
                <svg className="animate-spin shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                {status === "uploading" ? "Uploading…" : "Generating…"}
              </>
            ) : (
              <>
                <IconAudio size={15} color={canGenerate ? "white" : "rgba(255,255,255,0.25)"} />
                Generate Lip Sync
              </>
            )}
          </button>

          {!videoFile && !audioFile && !isProcessing && (
            <p className="text-white/40 text-[11px] text-center">Upload both files above to continue</p>
          )}

        </div>
      </div>
    </div>
  );

  /* ── Right panel ── */
  const RightPanel = (
    <div className="hidden xl:flex flex-1 flex-col overflow-hidden bg-[#111318]">
      <div className="shrink-0 px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
        <span className="text-white/45 text-[11px] font-semibold uppercase tracking-widest">
          {status === "idle" ? "Output" : isProcessing ? "Processing" : status === "completed" ? "Result" : "Error"}
        </span>
        {status === "completed" && (
          <button onClick={handleReset}
            className="text-[11px] text-white/55 hover:text-white/70 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
            style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
            + New
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {status === "idle"      && <EmptyState />}
        {isProcessing           && <ProcessingState uploading={status === "uploading"} />}
        {status === "completed" && resultUrl && <ResultState resultUrl={resultUrl} onReset={handleReset} />}
        {status === "failed"    && (
          <div className="flex flex-col items-center justify-center h-full px-8 py-16 text-center">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)" }}>
              <IconX size={20} />
            </div>
            <h2 className="text-white font-bold text-base mb-2">Generation failed</h2>
            <p className="text-white/55 text-sm max-w-xs mb-6">{errorMsg}</p>
            <button onClick={handleReset}
              className="px-5 py-2.5 rounded-xl text-white/55 hover:text-white text-[13px] font-medium transition-all"
              style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );

  /* ── Mobile result overlay ── */
  const MobileResult = mobileView === "result" && status !== "idle" && (
    <div className="xl:hidden flex flex-col w-full h-full bg-[#0D0D11]">
      <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
        <button onClick={() => setMobileView("input")} className="flex items-center gap-2 text-white/40 hover:text-white/75 text-sm transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
        <span className="text-white text-sm font-semibold">
          {isProcessing ? "Processing…" : status === "completed" ? "Result" : "Error"}
        </span>
        {status === "completed"
          ? <button onClick={handleReset} className="text-xs text-[#A78BFF] font-medium">New</button>
          : <div className="w-10" />}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {isProcessing           && <ProcessingState uploading={status === "uploading"} />}
        {status === "completed" && resultUrl && <ResultState resultUrl={resultUrl} onReset={handleReset} />}
        {status === "failed"    && (
          <div className="flex flex-col items-center justify-center h-full px-8 text-center">
            <p className="text-white font-bold mb-2">Generation failed</p>
            <p className="text-white/55 text-sm mb-6">{errorMsg}</p>
            <button onClick={handleReset} className="px-5 py-2.5 rounded-xl text-white/55 text-sm" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-full w-full flex overflow-hidden" style={{ background: "#0B0C10" }}>
      {MobileResult || LeftPanel}
      {RightPanel}
    </div>
  );
}
