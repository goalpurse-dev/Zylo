import React from "react";

export function LabeledInput({ label, value, onChange, placeholder = "" }) {
  return (
    <div>
      <div className="text-xs text-white/60 mb-1">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/10 bg-white/5 p-2 text-sm outline-none"
      />
    </div>
  );
}

export function LabeledTextarea({ label, value, onChange, rows = 3, placeholder = "" }) {
  return (
    <div>
      <div className="text-xs text-white/60 mb-1">{label}</div>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/10 bg-white/5 p-2 text-sm outline-none"
      />
    </div>
  );
}
