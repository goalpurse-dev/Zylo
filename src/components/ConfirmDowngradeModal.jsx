import React from "react";

export default function ConfirmDowngradeModal({ open, planLabel, onCancel, onConfirm }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0f1420] p-5 text-white shadow-2xl">
        <h3 className="text-lg font-semibold mb-1">Downgrade to {planLabel}?</h3>
        <p className="text-sm text-white/70">
          This change will take effect on your next billing cycle. You won’t be charged now.
          Your current balance remains, and new monthly credits will match the downgraded plan.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm hover:bg-white/15"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-gray-100"
          >
            Confirm downgrade
          </button>
        </div>
      </div>
    </div>
  );
}
