// src/components/ResultVoteButtons.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { ThumbsUp, ThumbsDown } from "lucide-react";

export default function ResultVoteButtons({ jobId, tool }) {
  const [currentVote, setCurrentVote] = useState(null);
  const [loading, setLoading] = useState(false);

  // (optional) load existing vote so user sees state on refresh
  useEffect(() => {
    let ignore = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from("generation_feedback")
        .select("vote")
        .eq("user_id", user.id)
        .eq("job_id", jobId)
        .maybeSingle();
      if (!ignore && data && !error) setCurrentVote(data.vote);
    })();
    return () => {
      ignore = true;
    };
  }, [jobId]);

  const sendVote = async (vote) => {
    if (loading) return;
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const payload = {
        job_id: jobId,
        tool,
        vote,
        user_id: user?.id ?? null,
      };

      const { error } = await supabase
        .from("generation_feedback")
        .upsert(payload, {
          onConflict: "user_id,job_id",
        });

      if (error) {
        console.error(error);
      } else {
        setCurrentVote(vote);
      }
    } finally {
      setLoading(false);
    }
  };

  const toggle = (vote) => {
    // clicking same again clears vote:
    if (currentVote === vote) sendVote(vote * -1); // or change to "null" logic if you add nullable
    else sendVote(vote);
  };

  const base =
    "flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-white/60 transition hover:border-white/60 hover:text-white";
  const activeUp =
    "bg-emerald-500/10 border-emerald-400 text-emerald-400";
  const activeDown =
    "bg-rose-500/10 border-rose-400 text-rose-400";

  return (
    <div className="flex items-center gap-2">
      <button
        disabled={loading}
        onClick={() => toggle(1)}
        className={`${base} ${currentVote === 1 ? activeUp : ""}`}
      >
        <ThumbsUp size={16} />
      </button>
      <button
        disabled={loading}
        onClick={() => toggle(-1)}
        className={`${base} ${currentVote === -1 ? activeDown : ""}`}
      >
        <ThumbsDown size={16} />
      </button>
    </div>
  );
}
