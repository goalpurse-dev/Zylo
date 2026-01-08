// src/pages/enhancements/Enhancements.jsx
import React, { useMemo, useState } from "react";
import { useNavigate, Routes, Route, Link } from "react-router-dom";
import { ArrowRight, Image as ImageIcon, Film, Settings } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { uploadUserFile, publishToPublic } from "../../lib/storage"; // you already have these
// If you have job helpers, import and use them instead of the raw insert below.
// import { createImageJobSimple, createVideoJobSimple } from "../../lib/jobs";
import { estimateCredits } from "../../lib/pricing";

// ---- Demo 9:16 thumbnails (place your real images here) ----

import imgBefore from "../../assets/library/v43.png";
import imgAfter from "../../assets/library/v44.png";
import vidAfter from "../../assets/library/v45.png";
import vidBefore from "../../assets/library/v46.png";

const zyloGrad = "bg-gradient-to-r from-blue-600 to-purple-600";

// Inlined pricing map for VIDEO UPSCALE (keeps UI snappy).
// If you add a pricing helper later, swap this for an import.
const UPSCALE_PRICING = {
  video1080p: { 8: 6, 16: 10, 24: 15, 30: 20 },
  video4k: { 8: 10, 16: 18, 24: 26, 30: 32 },
};
// Simple image pricing by aspect; swap to your own if needed.
const IMAGE_UPSCALE_CREDITS = { "1:1": 2, "9:16": 3, "16:9": 3 };

function Card({ to, title, subtitle, beforeSrc, afterSrc, icon: Icon }) {
  return (
    <Link
      to={to}
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition shadow-sm"
    >
      <div className="p-5 flex items-center gap-3">
        <div className={`p-2 rounded-xl text-white ${zyloGrad}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <div className="text-lg font-semibold">{title}</div>
          <div className="text-sm text-white/70">{subtitle}</div>
        </div>
      </div>

      <div className="px-5 pb-5">
        {/* before → after strip (9:16 thumbs) */}
        <div className="w-full grid grid-cols-3 gap-3 items-center">
          <img
            src={beforeSrc}
            alt="Before"
            className="aspect-[9/16] w-full object-cover rounded-xl ring-1 ring-white/10"
          />
          <div className="flex items-center justify-center">
            <ArrowRight className="w-7 h-7 text-white/70 group-hover:text-white" />
          </div>
          <img
            src={afterSrc}
            alt="After"
            className="aspect-[9/16] w-full object-cover rounded-xl ring-2 ring-blue-500/60"
          />
        </div>
      </div>
    </Link>
  );
}

export default function Enhancements() {
  return (
    <Routes>
      <Route index element={<EnhancementsHome />} />
      <Route path="image" element={<ImageEnhanceWizard />} />
      <Route path="video" element={<VideoEnhanceWizard />} />
    </Routes>
  );
}

function EnhancementsHome() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold">Business Enhancements</h1>
        <p className="text-white/70 mt-2">
          Fix quality fast. Upscale, clean, and polish — no expert skills needed.
        </p>
      </header>

      <div className="grid md:grid-cols-2 gap-6">
        <Card
          to="/enhancements/image"
          title="Improve Image Quality"
          subtitle="Upscale • Sharpen • Deblur • Denoise • Color balance"
          beforeSrc={imgBefore}
          afterSrc={imgAfter}
          icon={ImageIcon}
        />
        <Card
          to="/enhancements/video"
          title="Improve Video Quality"
          subtitle="Upscale to 1080p/4K • Denoise • Stabilize • (Optional) 60 fps"
          beforeSrc={vidBefore}
          afterSrc={vidAfter}
          icon={Film}
        />
      </div>
    </section>
  );
}

/* =======================================
   IMAGE WIZARD
   ======================================= */
function ImageEnhanceWizard() {
  const nav = useNavigate();
  const [file, setFile] = useState(null);
  const [aspect, setAspect] = useState("9:16"); // 1:1 | 9:16 | 16:9
  const [quality, setQuality] = useState("pro"); // basic | pro | premium
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [adv, setAdv] = useState({
    denoise: true,
    sharpen: true,
    deblur: true,
    faceRestore: true,
    colorBalance: true,
  });
  const [busy, setBusy] = useState(false);
  const credits = IMAGE_UPSCALE_CREDITS[aspect] ?? 2;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) return;

    try {
      setBusy(true);
      // 1) Upload file → signed URL
      const { url: signedUrl, path } = await uploadUserFile(file, {
        folder: "enhance",
        makePublic: false,
      });

      // (Optionally) sign for worker access
      const input = {
        source_url: signedUrl,
        mode: "image_upscale",
        aspect,
        quality,
        advanced: adv,
      };

      // 2) Create job
      // If you have a helper, call it here instead:
      // const job = await createImageJobSimple({ prompt: null, input });
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const { data: job, error } = await supabase
        .from("jobs")
        .insert({
          type: "upscaler",
          status: "queued",
          prompt: null,
          settings: { kind: "image", aspect, quality, adv },
          input,
        })
        .select()
        .single();

      if (error) throw error;

      // 3) Route to job progress
      nav(`/jobs/${job.id}`);
    } catch (err) {
      console.error(err);
      alert("Failed to start image enhancement.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="max-w-3xl mx-auto px-6 py-10">
      <BackBar title="Improve Image Quality" />
      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <UploadField file={file} setFile={setFile} accept="image/*" />

        <div className="grid md:grid-cols-3 gap-4">
          <SelectField
            label="Aspect"
            value={aspect}
            setValue={setAspect}
            options={[
              { v: "1:1", l: "1:1 (Square)" },
              { v: "9:16", l: "9:16 (Portrait)" },
              { v: "16:9", l: "16:9 (Landscape)" },
            ]}
          />
          <SelectField
            label="Quality"
            value={quality}
            setValue={setQuality}
            options={[
              { v: "basic", l: "Basic" },
              { v: "pro", l: "Pro (recommended)" },
              { v: "premium", l: "Premium" },
            ]}
          />
          <ReadOnlyField label="Estimated credits" value={`${credits} cr`} />
        </div>

        <AdvancedPanel
          open={advancedOpen}
          setOpen={setAdvancedOpen}
          items={[
            ["denoise", "Denoise & clean"],
            ["sharpen", "AI sharpen"],
            ["deblur", "Deblur (motion/focus)"],
            ["faceRestore", "Face restoration"],
            ["colorBalance", "Auto color & lighting"],
          ]}
          state={adv}
          setState={setAdv}
        />

        <SubmitButton busy={busy} label="Enhance Image" />
      </form>
    </section>
  );
}

/* =======================================
   VIDEO WIZARD
   ======================================= */
function VideoEnhanceWizard() {
  const nav = useNavigate();
  const [file, setFile] = useState(null);
  const [resolution, setResolution] = useState("1080p"); // 1080p | 4k
  const [duration, setDuration] = useState(16); // 8 | 16 | 24 | 30
  const [quality, setQuality] = useState("pro"); // UI-only tag for display
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [adv, setAdv] = useState({
    denoise: true,
    stabilize: true,
    interpolateTo60: false,
    preserveAudio: true,
  });
  const [busy, setBusy] = useState(false);

  const estCredits = useMemo(() => {
    const table = resolution === "4k" ? UPSCALE_PRICING.video4k : UPSCALE_PRICING.video1080p;
    return table[duration] ?? 10;
  }, [resolution, duration]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) return;
    try {
      setBusy(true);
      // 1) Upload file
      const { url: signedUrl } = await uploadUserFile(file, {
        folder: "enhance",
        makePublic: false,
      });

      const input = {
        source_url: signedUrl,
        mode: "video_upscale",
        resolution,
        duration_sec: duration, // hint for workers; they can measure real duration
        advanced: adv,
        // For your worker: use Runway upscale_v1 with 1080p or 4K preset.
      };

      // 2) Create job
      // const job = await createVideoJobSimple({...})
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const { data: job, error } = await supabase
        .from("jobs")
        .insert({
          type: "upscaler",
          status: "queued",
          prompt: null,
          settings: { kind: "video", resolution, duration, quality, adv },
          input,
        })
        .select()
        .single();

      if (error) throw error;

      nav(`/jobs/${job.id}`);
    } catch (err) {
      console.error(err);
      alert("Failed to start video enhancement.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="max-w-3xl mx-auto px-6 py-10">
      <BackBar title="Improve Video Quality" />
      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <UploadField file={file} setFile={setFile} accept="video/*" />

        <div className="grid md:grid-cols-3 gap-4">
          <SelectField
            label="Target Resolution"
            value={resolution}
            setValue={setResolution}
            options={[
              { v: "1080p", l: "1080p" },
              { v: "4k", l: "4K (premium)" },
            ]}
          />
          <SelectField
            label="Clip Length"
            value={duration}
            setValue={(v) => setDuration(parseInt(v, 10))}
            options={[
              { v: 8, l: "8 sec" },
              { v: 16, l: "16 sec" },
              { v: 24, l: "24 sec" },
              { v: 30, l: "30 sec" },
            ]}
          />
          <ReadOnlyField label="Estimated credits" value={`${estCredits} cr`} />
        </div>

        <AdvancedPanel
          open={advancedOpen}
          setOpen={setAdvancedOpen}
          items={[
            ["denoise", "Denoise & clean"],
            ["stabilize", "Stabilize motion"],
            ["interpolateTo60", "Smooth to 60 fps (adds latency & cost)"],
            ["preserveAudio", "Preserve original audio"],
          ]}
          state={adv}
          setState={setAdv}
        />

        <SubmitButton busy={busy} label="Enhance Video" />
      </form>
    </section>
  );
}

/* =======================================
   Small UI bits
   ======================================= */
function BackBar({ title }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-white/60 text-sm">
          Upload, pick settings, and we’ll process it in the background.
        </p>
      </div>
      <Link
        to="/enhancements"
        className="text-sm text-white/70 hover:text-white underline underline-offset-4"
      >
        ← Back
      </Link>
    </div>
  );
}

function UploadField({ file, setFile, accept }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 p-5 bg-white/5">
      <label className="block text-sm font-medium mb-2">Upload file</label>
      <input
        type="file"
        accept={accept}
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
      />
      {file && (
        <div className="text-sm text-white/70 mt-2">
          Selected: <span className="text-white">{file.name}</span>
        </div>
      )}
    </div>
  );
}

function SelectField({ label, value, setValue, options }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full rounded-xl bg-white/5 border border-white/10 p-2.5"
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    </div>
  );
}

function ReadOnlyField({ label, value }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>
      <div className="w-full rounded-xl bg-white/5 border border-white/10 p-2.5">
        {value}
      </div>
    </div>
  );
}

function AdvancedPanel({ open, setOpen, items, state, setState }) {
  return (
    <div className="rounded-2xl border border-white/10">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <span className="flex items-center gap-2">
          <Settings className="w-4 h-4" />
          Advanced settings
        </span>
        <span className="text-sm text-white/60">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 grid md:grid-cols-2 gap-3">
          {items.map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!state[key]}
                onChange={(e) =>
                  setState((s) => ({ ...s, [key]: e.target.checked }))
                }
              />
              {label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function SubmitButton({ busy, label }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className={`w-full md:w-auto px-5 py-3 rounded-xl text-white font-medium ${
        busy ? "bg-white/20 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
      }`}
    >
      {busy ? "Starting..." : label}
    </button>
  );
}
