// src/components/video/PostRenderSetup.jsx
import React, { useMemo, useState } from "react"; // ADDED useMemo
import { useNavigate } from "react-router-dom";
// ADDED
import { TIER_TO_QUALITY, creditsForVideo3dUGC } from "../../lib/pricing";

const pillBase =
  "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition";
const pill = `${pillBase} bg-white/5 text-white/80 border border-white/10 hover:bg-white/10`;
const pillActive = `${pillBase} bg-white text-black`;

export default function PostRenderSetup({
  open,
  defaults = {},
  onBack,
  onGenerate,

  // options (fall back to sane defaults)
  durationOptions = [8, 15, 30, 45, 60],
  platformOptions = ["TikTok", "Instagram", "YouTube"],
  styleOptions = [
    "Cinematic Magical Live Action",
    "Anime Wizard World",
    "Epic Fantasy Animation",
  ],
}) {
  if (!open) return null;

  const navigate = useNavigate();

  // Use provided defaults or first option as initial state
  const [duration, setDuration] = useState(
    Number.isFinite(defaults.duration) ? defaults.duration : durationOptions[2] ?? 30
  );
  const [platform, setPlatform] = useState(
    defaults.platform || platformOptions[0] || "YouTube"
  );
  const [style, setStyle] = useState(
    defaults.style || (styleOptions[0]?.label ?? styleOptions[0]) || ""
  );

  // ADDED: pick tier/resolution from defaults (or assume v2 @ 720p)
  const tier = defaults.tier || "zylo-v2";           // "zylo-v2" | "zylo-v3" | "zylo-v4"
  const resolution = defaults.resolution || "720p";  // "720p" | "1080p" | "4k"

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);

  const labelOf = (opt) => (typeof opt === "string" ? opt : opt.label);

  // ADDED: live price from central pricing
  const price = useMemo(() => {
    const quality = TIER_TO_QUALITY[tier] ?? "basic";
    return creditsForVideo3dUGC({
      seconds: duration,
      quality,
      resolution,
    });
  }, [tier, resolution, duration]);

  async function handleGenerate() {
    try {
      setSubmitting(true);
      setErr(null);
      const job = await onGenerate?.({
        duration,
        platform,
        style,
        // (Optional) You can also pass these through if your parent accepts them:
        // tier,
        // resolution,
        // price,
      });
      if (job?.id) navigate(`/jobs/${job.id}`);
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[65] bg-[#0b0b0b] text-white overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl px-6 py-10">
        <div className="text-sm text-white/50 mb-2">v4.0</div>
        <h1 className="text-2xl font-bold mb-8">Tweak before we render</h1>

        {/* Duration */}
        <Section title="Duration">
          <div className="flex flex-wrap gap-2">
            {durationOptions.map((d) => (
              <button
                key={d}
                type="button"
                disabled={submitting}
                onClick={() => setDuration(d)}
                className={d === duration ? pillActive : pill}
              >
                {d === 60 ? "1 minute" : `${d} seconds`}
              </button>
            ))}
          </div>
        </Section>

        {/* Platform */}
        <Section title="Platform">
          <div className="flex flex-wrap gap-2">
            {platformOptions.map((p) => (
              <button
                key={p}
                type="button"
                disabled={submitting}
                onClick={() => setPlatform(p)}
                className={p === platform ? pillActive : pill}
              >
                {p}
              </button>
            ))}
          </div>
        </Section>

        {/* Visual style */}
        <Section title="Visual style">
          <div className="flex flex-wrap gap-2">
            {styleOptions.map((s) => {
              const label = labelOf(s);
              return (
                <button
                  key={label}
                  type="button"
                  disabled={submitting}
                  onClick={() => setStyle(label)}
                  className={label === style ? pillActive : pill}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="text-xs text-white/50 mt-2">
            (we’ll auto-suggest styles from your prompt later)
          </div>
        </Section>

        {err && <div className="mt-4 text-red-400 text-sm">{err}</div>}

        {/* Footer */}
        <div className="mt-10 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onBack}
            disabled={submitting}
            className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
          >
            Back
          </button>

          {/* ADDED: credits-only CTA */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2
                       rounded-full px-5 py-2 text-sm font-semibold
                       bg-white text-black ring-1 ring-white/40
                       hover:bg-white/35 backdrop-blur-[1px]
                       shadow-sm transition disabled:opacity-50"
            title={`${price} credits`}
          >
            <img src="/credit.svg" alt="" className="h-4 w-4" />
            <span className="tabular-nums">{price}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-8">
      <div className="mb-3 text-sm font-semibold text-white/90">{title}</div>
      {children}
    </div>
  );
}
