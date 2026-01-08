import React from "react";

export default function AdCard({ job }) {
  return (
    <article className="overflow-hidden rounded-xl border border-white/10 bg-white/[.03]">
      <div className="aspect-video bg-black">
        {job.result_url ? (
          <video src={job.result_url} className="w-full h-full object-cover" controls />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/40 text-xs">
            {job.status === "failed" ? "Failed" : "Processing…"}
          </div>
        )}
      </div>
      <div className="p-3 space-y-1">
        <div className="text-xs text-white/60">
          #{(job.id || "").toString().slice(0, 8)} • {job.status || "ready"}
        </div>
        <div className="text-sm font-semibold line-clamp-2">
          {job.prompt || job.title || "Ad"}
        </div>
      </div>
    </article>
  );
}
