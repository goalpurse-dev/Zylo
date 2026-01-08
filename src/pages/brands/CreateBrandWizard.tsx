import React, { useState } from "react";
import { useBrandWizard } from "../../store/brandWizard";
import { supabase } from "../../lib/supabaseClient";

/** Two steps: Basics → Next Steps (no logo) */
const steps = ["Basics", "Next steps"];

export default function CreateBrandWizard({ open, onClose, onCreated }) {
  const { state, patch, reset } = useBrandWizard();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  if (!open) return null;

  const next = () => setStep((s) => Math.min(s + 1, steps.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));
  const basicsValid = (state.basics.name || "").trim().length >= 2;

  function closeAll() {
    reset();
    onClose && onClose();
  }

  async function commit() {
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); return; }

    // Minimal brand row (no logo handling)
    const { data: brandRow, error } = await supabase
      .from("brands")
      .insert({
        user_id: user.id,
        name: (state.basics.name || "").trim(),
        description: (state.basics.description || "").trim() || null,
      })
      .select("*")
      .single();

    setBusy(false);
    if (error || !brandRow) return;

    reset();
    onCreated && onCreated(brandRow.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeAll} />

      {/* modal */}
      <div className="relative w-full max-w-3xl rounded-3xl border border-white/10 bg-[#0d1117]/95 text-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="font-extrabold tracking-tight">
            {step === 0 && "Let’s start with the basics"}
            {step === 1 && "You’re almost done"}
          </div>
          <button
            onClick={closeAll}
            className="rounded-lg px-2 py-1 text-white/60 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 max-h-[70vh] overflow-auto">
          {step === 0 && <StepBasics patch={patch} state={state} />}
          {step === 1 && <StepGuide />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/10 px-6 py-4">
          <div className="text-sm text-white/60">
            Step {step + 1} / {steps.length}
          </div>
          <div className="flex gap-3">
            <button
              disabled={step === 0 || busy}
              onClick={back}
              className="rounded-xl border border-white/15 bg-white/10 px-5 h-10 text-sm font-bold hover:bg-white/15 disabled:opacity-50"
            >
              Back
            </button>

            {step < steps.length - 1 && (
              <button
                onClick={next}
                disabled={busy || (step === 0 && !basicsValid)}
                className="rounded-xl px-6 h-10 text-sm font-extrabold text-white bg-gradient-to-r from-[#7A3BFF] via-[#9B4DFF] to-[#FF57B2] hover:opacity-95 disabled:opacity-60"
              >
                Continue
              </button>
            )}

            {step === steps.length - 1 && (
              <button
                onClick={commit}
                disabled={busy || !basicsValid}
                className="rounded-xl px-6 h-10 text-sm font-extrabold text-white bg-gradient-to-r from-[#7A3BFF] via-[#9B4DFF] to-[#FF57B2] hover:opacity-95 disabled:opacity-60"
              >
                {busy ? "Creating…" : "Create brand"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Step 1: Basics ---------------- */
function StepBasics({ patch, state }) {
  return (
    <div className="space-y-6">
      {/* friendly headline */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-[12px] font-black uppercase tracking-[0.09em]">
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: "linear-gradient(90deg,#7A3BFF,#FF57B2)" }}
          >
            Create your brand
          </span>
        </div>
        <p className="mt-1 text-sm text-white/80">
          Tell us your brand’s name and a short description to get you started.
        </p>
      </div>

      {/* brand name */}
      <div>
        <label className="text-sm font-bold text-white/90">Brand name</label>
        <input
          value={state.basics.name || ""}
          onChange={(e) => patch("basics", { name: e.target.value })}
          className="mt-2 w-full rounded-xl border border-white/10 bg-[#0b0f14] px-3 h-11 text-sm outline-none focus:ring-2 focus:ring-blue-500/30"
          placeholder="e.g., Zylo"
        />
      </div>

      {/* short description */}
      <div>
        <label className="text-sm font-bold text-white/90">Short description</label>
        <textarea
          value={state.basics.description || ""}
          onChange={(e) => patch("basics", { description: e.target.value })}
          className="mt-2 w-full rounded-xl border border-white/10 bg-[#0b0f14] p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/30"
          rows={4}
          placeholder="1–2 sentences about what you do"
        />
      </div>
    </div>
  );
}

/* ---------------- Step 2: Next steps ---------------- */
function StepGuide() {
  const pill =
    "inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm font-extrabold cursor-default select-none";

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-[12px] font-black uppercase tracking-[0.09em]">What’s next</div>
        <p className="mt-1 text-sm text-white/80">
          After you press <span className="font-bold">Create brand</span>, you can:
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className={pill}>Brand workspace</div>
        <div className={pill}>Ad studio</div>
        <div className={pill}>Product photos</div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0b0f14] p-4">
        <div className="text-sm font-bold mb-1">Tip</div>
        <p className="text-sm text-white/70">
          We’ll take you to your brand home after creation. From there, open Workspace, Ad studio,
          or Product photos anytime.
        </p>
      </div>
    </div>
  );
}
