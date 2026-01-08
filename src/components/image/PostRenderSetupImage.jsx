// src/components/image/PostRenderSetupImage.jsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
// ADDED
import { TIER_TO_QUALITY, creditsForImage } from "../../lib/pricing";

const pillBase =
  "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition";
const pill = `${pillBase} bg-white/5 text-white/80 border border-white/10 hover:bg-white/10`;
const pillActive = `${pillBase} bg-white text-black`;

/**
 * Props:
 * - open
 * - defaults: { output, size, style, tier }
 * - onBack
 * - onGenerate: ({ output, size, style, tier, price }) => Promise<{ id: string }>
 * - outputOptions: string[]
 * - sizeOptions: string[]
 * - styleOptions: string[]
 * - tiers: [{ id, label }]               // ADDED: price removed (now computed)
 */
export default function PostRenderSetupImage({
  open,
  defaults = {},
  onBack,
  onGenerate,
  outputOptions = [],
  sizeOptions = [],
  styleOptions = [],
  tiers = [
    { id: "zylo-v2", label: "Zylo v2 (basic)" },
    { id: "zylo-v3", label: "Zylo v3 (plus)" },
    { id: "zylo-v4", label: "Zylo v4 (premium)" },
  ],
}) {
  if (!open) return null;

  const navigate = useNavigate();

  // Local UI state
  const [output, setOutput] = useState(
    defaults.output ?? outputOptions[0] ?? "Brand logo"
  );
  const [size, setSize] = useState(
    defaults.size ?? sizeOptions[0] ?? "1024x1024"
  );
  const [style, setStyle] = useState(
    defaults.style ?? styleOptions[0] ?? "Minimal"
  );
  const [tier, setTier] = useState(defaults.tier ?? tiers?.[0]?.id ?? "zylo-v2");

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);

  /* ---------- live price (from central pricing) ---------- */
  // ADDED
  const price = useMemo(() => {
    const quality = TIER_TO_QUALITY[tier] ?? "basic";
    return creditsForImage({ quality, size });
  }, [tier, size]);

  async function handleGenerate() {
    try {
      setSubmitting(true);
      setErr(null);

      const job = await onGenerate?.({
        output,
        size,
        style,
        tier,
        price, // worker will debit this
      });

      if (job && job.id) navigate(`/jobs/${job.id}`);
      else setErr("No job returned from onGenerate.");
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[65] bg-[#0b0b0b] text-white overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl px-6 py-10">
        <div className="mb-2 text-sm text-white/50">image • v1</div>
        <h1 className="text-2xl font-bold mb-8">Tweak before we render</h1>

        {/* Quality / Model tier */}
        <Section title="Quality">
          <div className="flex flex-wrap gap-2">
            {tiers.map((t) => (
              <button
                key={t.id}
                type="button"
                disabled={submitting}
                onClick={() => setTier(t.id)}
                className={t.id === tier ? pillActive : pill}
                title={t.label} // CHANGED: no per-tier price here
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="text-xs text-white/50 mt-2">
            Higher tiers use better models (v4 &gt; v3 &gt; v2). Larger sizes
            cost more credits.
          </div>
        </Section>

        {/* Output */}
        <Section title="Output">
          <div className="flex flex-wrap gap-2">
            {outputOptions.map((o) => (
              <button
                key={o}
                type="button"
                disabled={submitting}
                onClick={() => setOutput(o)}
                className={o === output ? pillActive : pill}
              >
                {o}
              </button>
            ))}
          </div>
        </Section>

        {/* Size */}
        <Section title="Size">
          <div className="flex flex-wrap gap-2">
            {sizeOptions.map((s) => (
              <button
                key={s}
                type="button"
                disabled={submitting}
                onClick={() => setSize(s)}
                className={s === size ? pillActive : pill}
              >
                {s}
              </button>
            ))}
          </div>
        </Section>

        {/* Style */}
        <Section title="Style">
          <div className="flex flex-wrap gap-2">
            {styleOptions.map((s) => (
              <button
                key={s}
                type="button"
                disabled={submitting}
                onClick={() => setStyle(s)}
                className={s === style ? pillActive : pill}
              >
                {s}
              </button>
            ))}
          </div>
        </Section>

        {err && <div className="mt-4 text-red-400 text-sm">{err}</div>}

        {/* FOOTER — SINGLE WHITE CREDITS BUTTON */}
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
