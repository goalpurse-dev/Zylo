import { useState } from "react";
import { createPortal } from "react-dom";
import { X, RotateCcw } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

const REASONS = [
  { id: "too_expensive",       label: "Too expensive" },
  { id: "not_using_enough",    label: "Not using it enough" },
  { id: "missing_features",    label: "Missing features I need" },
  { id: "better_tool",         label: "Found a better tool" },
  { id: "taking_a_break",      label: "Just taking a break" },
  { id: "other",               label: "Other" },
];

export default function CancelFeedbackModal({
  open,
  onClose,
  onConfirmCancel,   // calls the actual cancel API
  onResume,          // calls resume subscription
  periodEnd,         // formatted date string
  planCode,
  isProcessing,
}) {
  const [reason, setReason]     = useState("");
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  async function handleCancel() {
    if (!reason) return;
    setSubmitting(true);
    try {
      // Save feedback to DB
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("cancellation_feedback").insert({
        user_id:   user?.id ?? null,
        email:     user?.email ?? null,
        plan_code: planCode ?? null,
        reason,
        feedback:  feedback.trim() || null,
      });
    } catch (e) {
      console.error("Failed to save cancellation feedback:", e);
      // Don't block the cancellation if feedback save fails
    } finally {
      setSubmitting(false);
    }
    onConfirmCancel();
  }

  return createPortal(
    <div className="fixed inset-0 z-[600] flex items-end justify-center p-0 sm:items-center sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-t-[28px] border border-white/10 bg-[#111315] sm:rounded-[24px]"
        style={{ boxShadow: "0 24px 80px rgba(0,0,0,0.7)" }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.07] text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          <X size={14} />
        </button>

        <div className="p-6 sm:p-7">
          {/* Header */}
          <div className="mb-5">
            <h2 className="text-[18px] font-bold text-white">Before you cancel…</h2>
            <p className="mt-1 text-[13px] text-white/45">
              Help us improve. Why are you cancelling?
              {periodEnd && (
                <span className="block mt-0.5 text-white/30">
                  You'll keep access until {periodEnd}.
                </span>
              )}
            </p>
          </div>

          {/* Reason pills */}
          <div className="mb-4 flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setReason(r.id)}
                className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition ${
                  reason === r.id
                    ? "border-purple-400/60 bg-purple-500/20 text-purple-200"
                    : "border-white/10 bg-white/[0.04] text-white/55 hover:border-white/20 hover:text-white"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Optional feedback */}
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Anything else you'd like to tell us? (optional)"
            rows={3}
            className="w-full resize-none rounded-[14px] border border-white/10 bg-white/[0.04] px-4 py-3 text-[13px] text-white/80 outline-none transition placeholder:text-white/25 focus:border-purple-400/40 focus:bg-white/[0.06]"
          />

          {/* Actions */}
          <div className="mt-4 flex flex-col gap-2.5">
            {/* Resume — prominent */}
            <button
              type="button"
              onClick={onResume}
              disabled={isProcessing}
              className="flex w-full items-center justify-center gap-2 rounded-[14px] border border-green-400/30 bg-green-500/15 py-3 text-[14px] font-bold text-green-300 transition hover:bg-green-500/20 disabled:opacity-50"
            >
              <RotateCcw size={15} className={isProcessing ? "animate-spin" : ""} />
              {isProcessing ? "Processing…" : "Keep my subscription"}
            </button>

            {/* Cancel — subtle, requires reason */}
            <button
              type="button"
              onClick={handleCancel}
              disabled={!reason || submitting || isProcessing}
              className="w-full rounded-[14px] border border-white/[0.07] bg-white/[0.03] py-2.5 text-[13px] font-semibold text-white/35 transition hover:border-red-400/25 hover:bg-red-500/[0.06] hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "Processing…" : "Cancel plan"}
              {!reason && <span className="ml-1 text-[11px] text-white/20">(select a reason first)</span>}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
