// src/pages/tools/TextToVideo.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Clapperboard as VideoIcon,
  Image as ImageIcon,
  Trash2,
  Monitor,
  Smartphone,
  Square,
  ChevronDown,
  Check,
  Timer,
  Tv2,
  AlertTriangle,
} from "lucide-react";

import { uploadUserFile, publishToPublic } from "../../lib/storage";
import { useGenerations } from "../../components/GenerationsDock";
import TextToVideoSteps from "../../components/TextToVideoSteps";
import imgPoster from "../../assets/home/hero3.png";

/* ── Config ─────────────────────────────────────────────────────────────── */
// ❌ removed v2, only v3 + v4
const VIDEO_TIERS = [
  { id: "zylo-v3", label: "v3.0" },
  { id: "zylo-v4", label: "v4.0" },
];

// still no mandatory-image tiers
const REQUIRES_IMAGE_TIERS = new Set([]);

const DURATION_BY_TIER = {
  "zylo-v3": [5, 10],
  "zylo-v4": [5, 10],
};

const ASPECTS_BY_TIER = {
  "zylo-v3": ["16:9", "9:16", "1:1"],
  "zylo-v4": ["9:16", "16:9"],
};

const RESOLUTIONS_BY_TIER = {
  "zylo-v3": ["720p"],   // ⬅️ was ["1080p"]
  "zylo-v4": ["1080p"],
};

const DEFAULT_ASPECT_BY_TIER = {
  "zylo-v3": "16:9",
  "zylo-v4": "16:9",
};

const DEFAULT_RES_BY_TIER = {
  "zylo-v3": "720p",     // ⬅️ was "1080p"
  "zylo-v4": "1080p",
};

/* ── Dropdown primitives ────────────────────────────────────────────────── */
function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}
function useOutsideClose(ref, onClose) {
  useEffect(() => {
    const handler = (e) => {
      if (!ref.current || ref.current.contains(e.target)) return;
      onClose?.();
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [ref, onClose]);
}
function Dropdown({
  label,
  subtitle,
  badge,
  icon: Icon,
  children,
  className,
  disabled,
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  useOutsideClose(wrapRef, () => setOpen(false));
  return (
    <div ref={wrapRef} className={classNames("relative", className)}>
      <button
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className={classNames(
          "group inline-flex items-center gap-3 rounded-xl px-3 py-2 w-full",
          "border border-white/15 bg-white/[.08] text-white/90",
          "backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,.35)] ring-1 ring-black/20",
          "hover:bg-white/[.12] transition disabled:opacity-60"
        )}
      >
        {Icon ? <Icon className="h-4 w-4 opacity-90" /> : null}
        <div className="flex flex-col items-start leading-tight">
          <span className="text-[13px] font-semibold">{label}</span>
          {subtitle ? (
            <span className="text-[11px] text-white/65">{subtitle}</span>
          ) : null}
        </div>
        {badge ? (
          <span className="ml-auto rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold">
            {badge}
          </span>
        ) : (
          <span className="ml-auto" />
        )}
        <ChevronDown
          className={classNames(
            "h-4 w-4 ml-2 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <div
          role="listbox"
          className={classNames(
            "absolute z-30 mt-2 min-w-[260px] overflow-hidden",
            "rounded-2xl border border-white/10",
            "bg-[rgba(13,18,27,0.92)] backdrop-blur-xl",
            "shadow-[0_18px_50px_rgba(0,0,0,.55)] ring-1 ring-black/30"
          )}
          style={{
            boxShadow:
              "0 18px 50px rgba(0,0,0,.55), inset 0 0 0 1px rgba(255,255,255,.03)",
          }}
        >
          {children({ close: () => setOpen(false) })}
        </div>
      )}
    </div>
  );
}
function MenuItem({
  active,
  title,
  meta,
  lines = [],
  Icon,
  rightBadge,
  onClick,
}) {
  return (
    <button
      role="option"
      onClick={onClick}
      className={classNames(
        "w-full text-left px-3 py-2.5 flex gap-3 items-start",
        "hover:bg-white/[.06] transition",
        active ? "bg-white/[.08]" : ""
      )}
    >
      <div className="mt-0.5">
        {Icon ? (
          <Icon className="h-4 w-4 opacity-90" />
        ) : (
          <div className="h-4 w-4" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white/95">{title}</span>
          {rightBadge ? (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold">
              {rightBadge}
            </span>
          ) : null}
          {active ? (
            <Check className="h-4 w-4 text-white/80 ml-auto" />
          ) : null}
        </div>
        {meta ? (
          <div className="text-[11px] text-white/60">{meta}</div>
        ) : null}
        {lines.length ? (
          <ul className="mt-1 text-[11px] text-white/70 space-y-0.5 list-disc pl-4">
            {lines.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </button>
  );
}

/* ── Helpers ────────────────────────────────────────────────────────────── */
const tierTips = {
  // v3 now takes the “balanced / everyday” spot
  "zylo-v3": [
    "Balanced quality & speed",
    "Higher fidelity motion",
    "Great for ads & hooks",
  ],
  "zylo-v4": [
    "Veo 3 Fast quality feel",
    "Best realism for hero shots",
    "No audio on this page",
  ],
};

const aspectIcon = (a) =>
  a === "16:9" ? Monitor : a === "9:16" ? Smartphone : Square;

/* ── Page ───────────────────────────────────────────────────────────────── */
export default function TextToVideo() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addJob } = useGenerations();

  const [prompt, setPrompt] = useState("");

  // ✅ v3 is the new default tier
  const [tier, setTier] = useState("zylo-v3");
  const [aspect, setAspect] = useState(DEFAULT_ASPECT_BY_TIER["zylo-v3"]);
  const [resolution, setResolution] = useState(
    DEFAULT_RES_BY_TIER["zylo-v3"]
  );
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);

  const allowedDurations = DURATION_BY_TIER[tier] || [5];
  const [duration, setDuration] = useState(allowedDurations[0]);
  const [submitting, setSubmitting] = useState(false);

  // Toast state
  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);

  const showToast = (msg) => {
    setToast(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), 2600);
  };

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!allowedDurations.includes(duration)) {
      setDuration(allowedDurations[0]);
    }

    const aspects = ASPECTS_BY_TIER[tier];
    const reses = RESOLUTIONS_BY_TIER[tier];

    if (!aspects) setAspect(DEFAULT_ASPECT_BY_TIER[tier]);
    else if (!aspects.includes(aspect)) setAspect(aspects[0]);

    if (!reses) setResolution(DEFAULT_RES_BY_TIER[tier]);
    else if (!reses.includes(resolution)) setResolution(reses[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier]);

  useEffect(() => {
    const q = searchParams.get("prompt");
    const m = searchParams.get("model");
    const a = searchParams.get("aspect");
    const d = searchParams.get("duration");
    const r = searchParams.get("res");

    if (q) setPrompt(q);

    if (m) {
      const norm = m.startsWith("zylo-") ? m : `zylo-${m}`;
      // ❌ drop v2, only allow v3 & v4 from URL
      if (["zylo-v3", "zylo-v4"].includes(norm)) setTier(norm);
    }

    const aspects = ASPECTS_BY_TIER[tier];
    if (a && aspects && aspects.includes(a)) setAspect(a);

    if (d) {
      const dd = Number(d);
      if ((DURATION_BY_TIER[tier] || []).includes(dd)) setDuration(dd);
    }

    const reses = RESOLUTIONS_BY_TIER[tier];
    if (r && reses && reses.includes(r)) setResolution(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const price = useMemo(() => {
    switch (tier) {
      case "zylo-v3":
        return duration === 10 ? 44 : 22;
      case "zylo-v4":
        return duration === 10 ? 75 : 40;
      default:
        return 0;
    }
  }, [tier, duration]);

  const needsImage = REQUIRES_IMAGE_TIERS.has(tier);

  function onPickImages(e) {
    const files = Array.from(e.target.files || []);
    const newList = [...imageFiles, ...files].slice(0, 1); // max 1 image
    imagePreviews.forEach((u) => URL.revokeObjectURL(u));
    setImageFiles(newList);
    setImagePreviews(newList.map((f) => URL.createObjectURL(f)));
  }

  function removeImage(idx) {
    const nextFiles = imageFiles.filter((_, i) => i !== idx);
    URL.revokeObjectURL(imagePreviews[idx]);
    setImageFiles(nextFiles);
    setImagePreviews(imagePreviews.filter((_, i) => i !== idx));
  }

  async function filesToPublicUrls(files) {
    const urls = [];
    for (const f of files) {
      const up = await uploadUserFile(f, { prefix: "t2v-init" });
      const pub = await publishToPublic(up.path);
      urls.push(pub.publicUrl);
    }
    return urls;
  }

  async function handleGenerate() {
    if (submitting) return;

    if (!prompt.trim()) {
      showToast("Add a short prompt first, then we’ll spin up your clip.");
      return;
    }

    if (needsImage && imageFiles.length === 0) {
      showToast(
        "This model needs at least one image. Drop in a reference frame to begin."
      );
      return;
    }

    setSubmitting(true);
    try {
      let initImageUrl = null;

      if (imageFiles.length > 0) {
        const urls = await filesToPublicUrls(imageFiles);
        initImageUrl = urls[0] || null;
      }

   const subject = prompt.trim();

const meta = {
  tool: "text-to-video",
  kind: "video",
  prompt: subject,
  tier,
  aspect,
  resolution,
  durationSec: duration,
  hasInitImage: !!initImageUrl,
};

// 1) Ask backend to create Runware job + DB job row
const job = await createVideoJobSimple({
  subject,
  tier,
  aspect,
  resolution,
  durationSec: duration,
  audio: false,
  initImageUrl,
});

if (!job || !job.id) {
  throw new Error("No job id returned from server.");
}

// 2) Tell GenerationsDock to track the REAL jobs.id
const addRes = addJob(job.id, meta);

if (!addRes.ok && addRes.reason === "limit") {
  showToast("Max parallel jobs reached for your plan.");
}
    } catch (e) {
      console.error("generate error:", e);
      showToast(e?.message || "Something went wrong starting your job.");
    } finally {
      setSubmitting(false);
    }
  }

  const visibleAspects = ASPECTS_BY_TIER[tier] || [];
  const visibleRes = RESOLUTIONS_BY_TIER[tier] || [];
  const tierOptions = VIDEO_TIERS.map((t) => ({
    id: t.id,
    label: t.label,
    tips: tierTips[t.id] || [],
    right: t.id === "zylo-v3" ? "balanced" : "flagship",
  }));
  const durationOptions = (DURATION_BY_TIER[tier] || []).map((d) => ({
    id: d,
    label: `${d} seconds`,
  }));
  const aspectOptions = visibleAspects.map((a) => ({
    id: a,
    label: a,
    Icon: aspectIcon(a),
  }));
  const resOptions = visibleRes.map((r) => ({
    id: r,
    label: r,
  }));

  return (
    <main className=" w-full bg-[#0b0f14] text-white py-8">
      {/* Toast */}
      {toast && (
        <div
          className="fixed right-4 top-4 z-50"
          onClick={() => setToast(null)}
        >
          <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-gradient-to-l from-[#1264FF] via-[#5B5FFF] to-[#B845FF] px-4 py-3 shadow-[0_18px_40px_rgba(0,0,0,.6)]">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-black/25">
              <AlertTriangle className="h-4 w-4 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
                Heads up
              </span>
              <span className="text-[13px] font-semibold leading-snug text-white">
                {toast}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-[1180px] px-4 lg:px-2">
        <h1 className="text-2xl font-extrabold tracking-tight mb-2 text-center">
          Text to Video{" "}
          <span className="ml-2 text-sm text-white/60">(no audio)</span>
        </h1>
        <p className="mb-5 text-center text-[12px] text-white/55">
          Turn scroll-stopping hooks into polished clips in seconds with Zylo’s
          video engines.
        </p>

        {/* Generator card */}
        <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0f141b] via-[#0e131a] to-[#121922] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
          {/* Prompt + CTA */}
          <div className="flex flex-col sm:flex-row items-stretch gap-3">
            <div className="flex-1 min-w-0 rounded-xl border border-white/15 bg-white/[.05] px-3 py-1 focus-within:ring-2 focus-within:ring-[#5B5FFF] transition">
              <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe a short video (subject, style, motion)"
                className="prompt-input h-12 w-full bg-transparent px-2 text-[15px] outline-none placeholder:text-white/35"
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={submitting}
              className="w-full sm:w-auto inline-flex h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#1264FF] via-[#5B5FFF] to-[#B845FF] px-6 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(0,0,0,.6)] hover:shadow-[0_18px_40px_rgba(0,0,0,.8)] hover:translate-y-[0.5px] transition disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-[0_10px_30px_rgba(0,0,0,.6)]"
              title={`${price} credits`}
            >
              <VideoIcon className="h-4 w-4" />
              {submitting ? "Starting…" : "Generate a video"}
              <span className="ml-2 rounded-full bg-white/15 px-2 py-0.5 text-[10px]">
                {price} credits
              </span>
            </button>
          </div>

          {/* Dropdowns */}
          <div className="mt-3 grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-2">
            {/* Tier */}
            <Dropdown
              label={
                tierOptions.find((t) => t.id === tier)?.label ||
                "Select model"
              }
              subtitle="Model quality & cost"
              badge={`${price} cr`}
              icon={VideoIcon}
            >
              {({ close }) => (
                <div className="py-2">
                  {tierOptions.map((opt) => (
                    <MenuItem
                      key={opt.id}
                      active={opt.id === tier}
                      title={`${opt.label} • Video`}
                      meta={opt.right}
                      lines={opt.tips}
                      rightBadge={
                        opt.id === "zylo-v4"
                          ? "40–75 cr"
                          : "22–44 cr"
                      }
                      onClick={() => {
                        setTier(opt.id);
                        close();
                      }}
                    />
                  ))}
                </div>
              )}
            </Dropdown>

            {/* Aspect */}
            <Dropdown
              label={
                aspectOptions.find((x) => x.id === aspect)?.label ||
                "Aspect"
              }
              subtitle="Framing"
              icon={aspectIcon(aspect)}
            >
              {({ close }) => (
                <div className="py-2">
                  {aspectOptions.map((a) => {
                    const Icon = a.Icon;
                    return (
                      <MenuItem
                        key={a.id}
                        active={a.id === aspect}
                        title={a.label}
                        meta={
                          a.id === "9:16"
                            ? "TikTok / Reels"
                            : a.id === "16:9"
                            ? "YouTube / Desktop"
                            : "Square feed"
                        }
                        Icon={Icon}
                        onClick={() => {
                          setAspect(a.id);
                          close();
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </Dropdown>

            {/* Duration */}
            <Dropdown
              label={`${duration}s`}
              subtitle="Clip length"
              badge="sec"
              icon={Timer}
            >
              {({ close }) => (
                <div className="py-2">
                  {durationOptions.map((d) => (
                    <MenuItem
                      key={d.id}
                      active={d.id === duration}
                      title={`${d.id} seconds`}
                      meta={
                        d.id === 5
                          ? "Snappy hooks"
                          : "More room for scenes"
                      }
                      onClick={() => {
                        setDuration(d.id);
                        close();
                      }}
                    />
                  ))}
                </div>
              )}
            </Dropdown>

            {/* Resolution */}
            <Dropdown
              label={resolution}
              subtitle="Output quality"
              icon={Tv2}
            >
              {({ close }) => (
                <div className="py-2">
                  {resOptions.map((r) => (
                    <MenuItem
                      key={r.id}
                      active={r.id === resolution}
                      title={r.label}
                      meta={r.id === "1080p" ? "Full HD" : "HD"}
                      onClick={() => {
                        setResolution(r.id);
                        close();
                      }}
                    />
                  ))}
                </div>
              )}
            </Dropdown>
          </div>

          {/* Learn more */}
          <div className="mt-3 text-center">
            <Link
              to="/support/policies"
              className="text-[12px] font-semibold text-[#5B8CFF] hover:text-[#8FB0FF]"
            >
              learn more about our models
            </Link>
          </div>

          {/* Reference images */}
          <div className="mt-5">
            <div className="flex items-center justify-between pb-2">
              <span className="text-xs text-white/80">
                Reference images (optional, max 1)
              </span>
            </div>

            <div className="relative rounded-2xl border border-dashed border-white/15 bg-black/30 p-4 hover:bg-black/40 transition">
              <label className="block cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={onPickImages}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  disabled={submitting}
                />

                {imagePreviews.length ? (
                  <div className="flex gap-4 flex-wrap">
                    {imagePreviews.map((src, idx) => (
                      <div
                        key={idx}
                        className="relative overflow-hidden rounded-xl border border-white/10 bg-white/5"
                        style={{ width: 180, height: 260 }}
                      >
                        <img
                          src={src}
                          alt={`preview-${idx}`}
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            removeImage(idx);
                          }}
                          className="absolute top-2 right-2 rounded-full bg-black/60 p-1 hover:bg-black/80"
                          title="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex min-h-[220px] items-center justify-center">
                    <div className="flex flex-col items-center gap-2 text-white/70">
                      <ImageIcon className="h-7 w-7" />
                      <div className="text-xs">
                        Click to add an optional reference frame
                      </div>
                      <div className="text-[11px] text-white/50">
                        PNG, JPG or WEBP • max 1
                      </div>
                    </div>
                  </div>
                )}
              </label>
            </div>
          </div>
        </section>

        {/* Steps component */}
        <TextToVideoSteps />
      </div>
    </main>
  );
}
