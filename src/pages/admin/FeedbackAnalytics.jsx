import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function FeedbackAnalytics() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc(
        "generation_feedback_stats"
      );
      if (!error && data) setRows(data);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="p-6 text-white/70">Loading…</div>;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold text-white">
        Generation Feedback
      </h1>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((r) => {
          const upPct = r.total > 0 ? Math.round((r.up_count / r.total) * 100) : 0;
          const downPct = 100 - upPct;
          return (
            <div
              key={r.tool}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-1"
            >
              <div className="text-sm text-white/60 uppercase tracking-wide">
                {r.tool}
              </div>
              <div className="text-3xl font-semibold text-white">
                {upPct}% <span className="text-sm text-white/60">positive</span>
              </div>
              <div className="text-xs text-white/60">
                👍 {r.up_count} | 👎 {r.down_count} | Total {r.total}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
