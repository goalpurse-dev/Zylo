import React, { useMemo, useState } from "react";
import AdCard from "./AdCard";

export default function FullBrowseModal({ title, items, onClose }) {
  const [q, setQ] = useState("");

  const norm = (j) => ({
    ...j,
    prompt: j.prompt || j.title || "Ad",
    result_url: j.result_url || j.video_url || "",
    status: j.status || "ready",
    id: j.id,
  });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((j) => (j.prompt || j.title || "").toLowerCase().includes(needle));
  }, [items, q]);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative mx-auto max-w-5xl bg-[#121826] border border-white/10 rounded-2xl p-5 mt-10">
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg font-bold">{title}</div>
          <button
            onClick={onClose}
            className="rounded-lg border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10"
          >
            Close
          </button>
        </div>

        <div className="mb-4 flex items-center gap-2 rounded-xl border border-white/15 px-3 h-10 bg-white/[.02]">
          <span className="text-white/60 text-sm">Search</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="by title or prompt"
            className="w-full bg-transparent outline-none text-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((j) => (
            <AdCard key={j.id} job={norm(j)} />
          ))}
        </div>
      </div>
    </div>
  );
}
