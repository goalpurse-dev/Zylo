import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const REACTIONS = [
  { value: 1, emoji: "😕", label: "Meh" },
  { value: 2, emoji: "😐", label: "Okay" },
  { value: 3, emoji: "🙂", label: "Good" },
  { value: 4, emoji: "😄", label: "Great" },
  { value: 5, emoji: "🔥", label: "Fire" },
];

export default function ScriptFeedback({ userId, scriptId }) {
  const [rating, setRating] = useState(null);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("idle"); // idle | submitting | done | error

  const canSubmit = rating !== null && status === "idle";

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setStatus("submitting");
    try {
      const { error } = await supabase.from("script_feedback").insert([{
        user_id: userId || null,
        script_id: scriptId || null,
        rating,
        message: message.trim() || null,
      }]);
      if (error) throw error;
      setStatus("done");
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  if (status === "done") {
    return (
      <div className="rounded-2xl border border-green-500/20 bg-green-500/[0.05] px-5 py-4 flex items-center gap-3">
        <span className="text-xl">🙏</span>
        <div>
          <p className="text-green-400 text-sm font-semibold">Thanks for the feedback!</p>
          <p className="text-white/30 text-xs mt-0.5">Your input directly shapes Zyvo's roadmap.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <span className="text-base">💬</span>
          <div>
            <p className="text-white/70 text-xs font-semibold">Help us improve Script Builder</p>
            <p className="text-white/25 text-[10px] mt-0.5">Beta feedback shapes what we build next.</p>
          </div>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Emoji rating */}
        <div>
          <p className="text-white/30 text-[10px] font-semibold uppercase tracking-widest mb-2.5">How was this script?</p>
          <div className="flex gap-2">
            {REACTIONS.map((r) => (
              <button
                key={r.value}
                onClick={() => setRating(r.value)}
                title={r.label}
                className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl border transition-all duration-150 ${
                  rating === r.value
                    ? "bg-[#7A3BFF]/15 border-[#7A3BFF]/40 scale-105"
                    : "bg-white/[0.03] border-white/[0.07] hover:bg-white/[0.06] hover:border-white/[0.14]"
                }`}
              >
                <span className="text-lg leading-none">{r.emoji}</span>
                <span className="text-[9px] text-white/30 font-medium">{r.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Text suggestion */}
        <div>
          <p className="text-white/30 text-[10px] font-semibold uppercase tracking-widest mb-2">Suggestion or idea? <span className="normal-case font-normal text-white/20">(optional)</span></p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. Add a hook length slider, more YouTube styles, better CTAs..."
            maxLength={400}
            rows={3}
            className="w-full bg-[#060810] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white/65 text-xs placeholder:text-white/20 resize-none focus:outline-none focus:border-[#7A3BFF]/40 focus:bg-[#060810] transition-colors leading-relaxed"
          />
          <div className="flex items-center justify-between mt-1">
            <p className="text-white/15 text-[10px]">Your voice directly influences what we build.</p>
            <span className="text-white/15 text-[10px]">{message.length}/400</span>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`w-full py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
            canSubmit
              ? "bg-[#7A3BFF]/15 border border-[#7A3BFF]/30 text-[#A07BFF] hover:bg-[#7A3BFF]/25 hover:border-[#7A3BFF]/50"
              : "bg-white/[0.03] border border-white/[0.06] text-white/20 cursor-not-allowed"
          }`}
        >
          {status === "submitting" ? "Sending..." : status === "error" ? "Failed — try again" : "Send Feedback →"}
        </button>
      </div>
    </div>
  );
}
