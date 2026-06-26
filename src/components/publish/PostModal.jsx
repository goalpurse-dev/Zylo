import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X, ChevronLeft, Sparkles, Send, AlertTriangle,
  Upload, Clock, Loader2, CheckCircle2,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;
const MAX_CAPTION   = 2200;
const ACCEPTED      = ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"];

/* ── Instagram gradient icon ─────────────────────────────────────────────── */
function IgIconGradient({ size = 16 }) {
  const id = "ig-grad-pm";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <defs>
        <linearGradient id={id} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#FCAF45" />
          <stop offset="30%"  stopColor="#FD1D1D" />
          <stop offset="70%"  stopColor="#C13584" />
          <stop offset="100%" stopColor="#833AB4" />
        </linearGradient>
      </defs>
      <path fill={`url(#${id})`} d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
    </svg>
  );
}

/* ── Video thumbnail card ─────────────────────────────────────────────────── */
function VideoThumb({ video, selected, onClick }) {
  const ref = useRef(null);
  return (
    <button
      onClick={onClick}
      className={`group relative aspect-[9/16] w-full overflow-hidden rounded-xl border-2 transition-all ${
        selected ? "border-[#7A3BFF] ring-2 ring-[#7A3BFF]/30" : "border-transparent hover:border-white/20"
      }`}
    >
      <video
        ref={ref}
        src={video.result_url}
        className="h-full w-full object-cover"
        muted preload="metadata"
        onMouseEnter={() => ref.current?.play().catch(() => {})}
        onMouseLeave={() => { if (ref.current) { ref.current.pause(); ref.current.currentTime = 0; } }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition" />
      {selected && (
        <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#7A3BFF]">
          <CheckCircle2 className="h-3 w-3 text-white" />
        </div>
      )}
    </button>
  );
}

/* ── Platform selector pill ──────────────────────────────────────────────── */
function PlatformPill({ account, selected, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 transition w-full ${
        selected
          ? "border-[#7A3BFF]/60 bg-[#7A3BFF]/15 text-white"
          : "border-white/[0.07] bg-white/[0.03] text-white/50 hover:border-white/15"
      }`}
    >
      <IgIconGradient size={16} />
      <div className="text-left flex-1">
        <p className="text-xs font-semibold leading-none">Instagram</p>
        <p className="mt-0.5 text-[10px] text-white/40 leading-none">@{account.username || account.platform_user_id}</p>
      </div>
      <div className={`h-4 w-4 rounded-full border-2 transition ${selected ? "border-[#7A3BFF] bg-[#7A3BFF]" : "border-white/20"}`} />
    </button>
  );
}

/* ── Main drawer ─────────────────────────────────────────────────────────── */
export default function PostModal({
  connectedAccounts,
  videos: videosProp = [],
  loadingVideos: loadingProp = false,
  onConnectInstagram,
  onClose,
  onPublished,
}) {
  const [visible, setVisible]                   = useState(false);
  const [step, setStep]                         = useState(1);   // 1=pick, 2=details
  const [selectedVideo, setSelectedVideo]       = useState(null);
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  const [caption, setCaption]                   = useState("");
  const [generatingCaption, setGeneratingCaption] = useState(false);
  const [publishing, setPublishing]             = useState(false);
  const [publishError, setPublishError]         = useState("");
  const [dragging, setDragging]                 = useState(false);
  const [uploading, setUploading]               = useState(false);
  const [uploadProgress, setUploadProgress]     = useState(0);
  const fileInputRef = useRef(null);
  const textareaRef  = useRef(null);

  // Entrance animation
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Pre-select first connected account
  useEffect(() => {
    if (connectedAccounts.length > 0 && selectedAccounts.length === 0) {
      setSelectedAccounts([connectedAccounts[0].id]);
    }
  }, [connectedAccounts]);

  // Escape key
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  /* ── File handling ──────────────────────────────────────────────────────── */
  const handleFile = useCallback(async (file) => {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      alert("Please select an MP4, MOV, or WebM video file.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const ext  = file.name.split(".").pop() || "mp4";
      const path = `${user.id}/custom-uploads/${Date.now()}.${ext}`;

      // Supabase JS client upload (no XHR progress API, simulate progress)
      const progressInterval = setInterval(() => {
        setUploadProgress(p => Math.min(p + 12, 85));
      }, 300);

      const { error: uploadErr } = await supabase.storage
        .from("published")
        .upload(path, file, { cacheControl: "3600", upsert: false });

      clearInterval(progressInterval);

      if (uploadErr) throw uploadErr;

      setUploadProgress(100);

      const { data: { publicUrl } } = supabase.storage
        .from("published")
        .getPublicUrl(path);

      // Brief pause so user sees 100%
      await new Promise(r => setTimeout(r, 400));

      setSelectedVideo({
        id:          null,          // custom upload — no creation_id
        result_url:  publicUrl,
        prompt:      file.name.replace(/\.[^/.]+$/, ""),
        created_at:  new Date().toISOString(),
        isCustom:    true,
        customUrl:   publicUrl,
      });
      setStep(2);
    } catch (e) {
      alert(e.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, []);

  function onFileInput(e) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }
  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  /* ── Pick a video from exports ──────────────────────────────────────────── */
  function pickVideo(video) {
    setSelectedVideo(video);
    if (!caption && video.prompt) setCaption(video.prompt.slice(0, 120));
    setStep(2);
  }

  /* ── AI caption ─────────────────────────────────────────────────────────── */
  async function generateCaption() {
    const prompt = selectedVideo?.prompt;
    if (!prompt) return;
    setGeneratingCaption(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-caption`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_ANON, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, platform: "instagram" }),
      });
      const json = await res.json();
      if (json.caption) { setCaption(json.caption); setTimeout(() => textareaRef.current?.focus(), 50); }
    } catch { /* silent */ } finally {
      setGeneratingCaption(false);
    }
  }

  /* ── Publish ─────────────────────────────────────────────────────────────── */
  async function handlePublish() {
    if (selectedAccounts.length === 0) { setPublishError("Select at least one account."); return; }
    if (!selectedVideo) return;
    setPublishing(true);
    setPublishError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      for (const accountId of selectedAccounts) {
        const payload = {
          social_account_id: accountId,
          caption: caption.trim(),
          ...(selectedVideo.isCustom
            ? { video_url: selectedVideo.customUrl }
            : { creation_id: selectedVideo.id }),
        };
        const res = await fetch(`${SUPABASE_URL}/functions/v1/instagram-publish-reel`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_ANON, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to start publishing");
      }
      onPublished();
    } catch (e) {
      setPublishError(e.message || "Something went wrong. Please try again.");
    } finally {
      setPublishing(false);
    }
  }

  function toggleAccount(id) {
    setSelectedAccounts(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);
  }

  /* ── Render ──────────────────────────────────────────────────────────────── */
  return createPortal(
    <div className="fixed inset-0 z-[9000] flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200"
        style={{ opacity: visible ? 1 : 0 }}
        onClick={onClose}
      />

      {/* Drawer — slides in from right */}
      <div
        className="relative z-10 flex flex-col h-full w-full max-w-[400px] bg-[#0e1012] border-l border-white/[0.07] shadow-2xl transition-transform duration-[250ms] ease-out"
        style={{ transform: visible ? "translateX(0)" : "translateX(100%)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3.5 shrink-0">
          {step === 2 && (
            <button
              onClick={() => { setStep(1); setPublishError(""); }}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.06] text-white/50 hover:bg-white/10 hover:text-white transition"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <div className="flex-1">
            <h2 className="text-[14px] font-bold text-white leading-none">
              {step === 1 ? "Publish New Content" : "Post Details"}
            </h2>
          </div>
          {/* Step dots */}
          <div className="flex items-center gap-1">
            {[1,2].map(s => (
              <div key={s} className={`h-1.5 rounded-full transition-all ${s === step ? "w-4 bg-[#7A3BFF]" : s < step ? "w-2 bg-[#7A3BFF]/40" : "w-2 bg-white/15"}`} />
            ))}
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.06] text-white/40 hover:bg-white/10 hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Step 1: Pick video ───────────────────────────────────────────── */}
        {step === 1 && (
          <div className="flex-1 overflow-y-auto">

            {/* Schedule Custom Video */}
            <div className="px-4 pt-5 pb-4">
              <h3 className="text-[13px] font-bold text-white mb-3">Schedule Custom Video</h3>

              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => !uploading && fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 cursor-pointer transition ${
                  dragging
                    ? "border-[#7A3BFF] bg-[#7A3BFF]/10"
                    : "border-white/[0.10] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                }`}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-7 w-7 text-[#9F5CFF] animate-spin" />
                    <p className="text-sm text-white/60 font-medium">Uploading… {uploadProgress}%</p>
                    <div className="w-32 h-1 rounded-full bg-white/10 overflow-hidden mt-1">
                      <div
                        className="h-full bg-[#7A3BFF] rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/25">
                      <Upload className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-[13px] text-white/60 leading-snug">
                        Drop a video or{" "}
                        <span className="text-[#9F5CFF] font-semibold">click here</span>{" "}
                        to browse files
                      </p>
                      <p className="mt-1 text-[11px] text-white/25">MP4, MOV, WebM · max 1 GB</p>
                    </div>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm"
                  className="hidden"
                  onChange={onFileInput}
                />
              </div>
            </div>

            {/* Divider */}
            <div className="mx-4 border-t border-white/[0.06]" />

            {/* My Exports */}
            <div className="px-4 pt-4 pb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[13px] font-bold text-white">My Exports</h3>
                {!loadingProp && videosProp.length > 0 && (
                  <span className="text-[11px] text-white/30">{videosProp.length} video{videosProp.length !== 1 ? "s" : ""}</span>
                )}
              </div>

              {loadingProp ? (
                <div className="grid grid-cols-3 gap-2">
                  {[1,2,3,4,5,6].map(i => (
                    <div key={i} className="aspect-[9/16] rounded-xl bg-white/[0.04] animate-pulse" />
                  ))}
                </div>
              ) : videosProp.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04] border border-white/[0.07]">
                    <Send className="h-5 w-5 text-white/20" />
                  </div>
                  <p className="text-[13px] font-semibold text-white/40">Export your videos to publish</p>
                  <p className="mt-1.5 text-[11px] text-white/25 max-w-[200px] leading-relaxed">
                    To publish your videos, they need to be exported. Open a project and click the "export" button.
                  </p>
                  <button
                    onClick={onClose}
                    className="mt-4 rounded-xl bg-white px-5 py-2 text-[13px] font-bold text-[#090A0A] hover:bg-white/90 transition"
                  >
                    Open Your Videos
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {videosProp.map(v => (
                    <VideoThumb
                      key={v.id}
                      video={v}
                      selected={selectedVideo?.id === v.id}
                      onClick={() => pickVideo(v)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Step 2: Post details ─────────────────────────────────────────── */}
        {step === 2 && selectedVideo && (
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

            {/* Video preview strip */}
            <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
              <div className="h-[56px] w-[32px] shrink-0 overflow-hidden rounded-lg bg-white/5">
                <video src={selectedVideo.result_url} className="h-full w-full object-cover" muted preload="metadata" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white/80 truncate leading-snug">
                  {selectedVideo.prompt?.slice(0, 70) || (selectedVideo.isCustom ? "Custom video" : "Video")}
                </p>
                <p className="mt-0.5 text-[11px] text-white/30">
                  {new Date(selectedVideo.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>
              <button onClick={() => { setStep(1); setCaption(""); }} className="text-[11px] text-[#9F5CFF] hover:text-[#C084FC] font-semibold transition shrink-0">Change</button>
            </div>

            {/* Publish to */}
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/30">Publish to</p>
              {connectedAccounts.length === 0 ? (
                <button onClick={onConnectInstagram} className="flex w-full items-center gap-3 rounded-xl border border-dashed border-white/[0.08] px-4 py-3 text-left hover:border-white/15 transition">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white/70">No accounts connected</p>
                    <p className="text-[11px] text-white/35">Connect Instagram to publish</p>
                  </div>
                  <span className="text-xs text-[#9F5CFF] font-semibold">Connect →</span>
                </button>
              ) : (
                <div className="space-y-2">
                  {connectedAccounts.map(acc => (
                    <PlatformPill
                      key={acc.id}
                      account={acc}
                      selected={selectedAccounts.includes(acc.id)}
                      onToggle={() => toggleAccount(acc.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Caption */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/30">Caption</p>
                <span className={`text-[11px] ${caption.length > MAX_CAPTION * 0.9 ? "text-amber-400" : "text-white/25"}`}>
                  {caption.length} / {MAX_CAPTION}
                </span>
              </div>
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={caption}
                  onChange={e => setCaption(e.target.value.slice(0, MAX_CAPTION))}
                  rows={5}
                  placeholder="Write a caption… (emojis and hashtags welcome)"
                  className="w-full resize-none rounded-xl border border-white/[0.08] bg-[#1a1d24] px-4 py-3 pb-10 text-sm text-white/85 placeholder:text-white/20 outline-none focus:border-[#7A3BFF]/50 focus:ring-1 focus:ring-[#7A3BFF]/20 transition"
                />
                <button
                  onClick={generateCaption}
                  disabled={generatingCaption || !selectedVideo?.prompt}
                  className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg border border-[#7A3BFF]/30 bg-[#7A3BFF]/15 px-3 py-1.5 text-[11px] font-semibold text-[#C084FC] hover:bg-[#7A3BFF]/25 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {generatingCaption ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  {generatingCaption ? "Writing…" : "Write with AI"}
                </button>
              </div>
            </div>

            {/* Timing note */}
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5">
              <Clock className="h-3.5 w-3.5 shrink-0 text-white/25" />
              <p className="text-[11px] text-white/35 leading-snug">Instagram may take a few minutes to process your Reel.</p>
            </div>

            {/* Error */}
            {publishError && (
              <div className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/[0.08] px-3 py-2.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <p className="text-sm text-red-300">{publishError}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="shrink-0 border-t border-white/[0.06] px-4 py-4 flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] py-2.5 text-sm font-semibold text-white/50 hover:bg-white/[0.07] hover:text-white/80 transition"
            >
              Cancel
            </button>
            <button
              onClick={handlePublish}
              disabled={publishing || selectedAccounts.length === 0 || !selectedVideo || connectedAccounts.length === 0}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7A3BFF] to-[#9F5CFF] py-2.5 text-sm font-bold text-white hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[.99] transition shadow-lg shadow-[#7A3BFF]/20"
            >
              {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {publishing ? "Publishing…" : "Post Now"}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
