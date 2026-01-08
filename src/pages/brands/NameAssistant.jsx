import React, { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

const cn = (...a) => a.filter(Boolean).join(" ");
const wrap = "mx-auto w-full max-w-[1180px] px-4 lg:px-2";
const zyloGrad = "bg-gradient-to-r from-blue-600 to-purple-600";

export default function NameAssistant() {
  const navigate = useNavigate();

  const [brandId, setBrandId] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: user } = await supabase.auth.getUser();
      const uid = user?.user?.id;
      if (!uid) return;
      const { data, error } = await supabase
        .from("brands")
        .select("id")
        .eq("user_id", uid)
        .maybeSingle();
      if (!error && data?.id) setBrandId(data.id);
    })();
  }, []);

  function suggestNamesLocal(text) {
    // Light-weight "AI": combines keywords with curated adjectives/nouns.
    const adj = ["Nova", "Prime", "Aura", "Bold", "True", "Pure", "Urban", "Echo", "Peak", "Luxe", "Core", "Fable", "Neon", "Velvet", "Terra", "Flux", "Hyper", "Aero", "Zero", "Zen"];
    const nouns = ["Labs", "Works", "Studio", "Collective", "Forge", "Supply", "House", "Co", "Craft", "Union", "Origin", "Line", "Edge", "Field", "Mode", "Leaf", "Wave", "Bloom", "Pulse", "Shift"];

    const words = (text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean);

    const caps = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    const kw = Array.from(new Set(words.map(caps))).slice(0, 3); // up to 3 keywords

    const picks = new Set();
    function push(pair) { if (picks.size < 15) picks.add(pair); }

    for (let i = 0; i < 60 && picks.size < 15; i++) {
      const a = adj[Math.floor(Math.random() * adj.length)];
      const n = nouns[Math.floor(Math.random() * nouns.length)];
      push(`${a} ${n}`);
      if (kw.length) push(`${kw[Math.floor(Math.random()*kw.length)]} ${n}`);
      if (kw.length) push(`${a} ${kw[Math.floor(Math.random()*kw.length)]}`);
    }

    return Array.from(picks).slice(0, 15);
  }

  function generate() {
    setLoading(true);
    setTimeout(() => {
      setIdeas(suggestNamesLocal(prompt));
      setLoading(false);
    }, 300); // small UX delay
  }

  async function choose(name) {
    if (!brandId) return;
    const ok = window.confirm(`Use “${name}” as your brand name?`);
    if (!ok) return;
    const { error } = await supabase.from("brands").update({ name }).eq("id", brandId);
    if (error) { alert(error.message); return; }
    navigate("/brand"); // back to workspace
  }

  return (
    <main className="w-full bg-[#0b0f14] text-white py-8 min-h-screen">
      <div className={wrap}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/brand")}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-1.5 text-sm font-semibold text-white/80 hover:bg-white/10"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
            <h1 className="text-2xl font-extrabold tracking-tight">AI Name Assistant</h1>
          </div>
          <button
            onClick={() => navigate("/products/new")}
            className={cn("rounded-2xl px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95", zyloGrad)}
          >
            Generate product next →
          </button>
        </div>

        <section className="rounded-2xl border border-white/10 bg-[#10151d] p-5 shadow-sm">
          <div className="text-sm text-white/80 mb-2">Describe your brand</div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            placeholder="e.g., Minimalist activewear brand for daily commuters. Comfort, breathable fabrics, neutral tones."
            className="w-full rounded-xl border border-white/15 bg-white/[.04] p-3 text-sm outline-none focus:ring-2 focus:ring-[#7A3BFF] text-white placeholder-white/60 caret-white"
          />
          <div className="flex items-center justify-between mt-3">
            <div className="text-xs text-white/60">We’ll suggest ~15 name ideas you can pick from.</div>
            <button
              onClick={generate}
              className={cn("rounded-xl px-4 py-2 text-sm font-semibold text-white hover:opacity-95", zyloGrad)}
              disabled={loading || prompt.trim().length < 10}
              title={prompt.trim().length < 10 ? "Add a bit more detail" : "Generate"}
            >
              {loading ? "Generating…" : "Generate names"}
            </button>
          </div>

          {!!ideas.length && (
            <div className="mt-5">
              <div className="text-sm font-semibold mb-2 text-white/85">Name ideas</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {ideas.map((n) => (
                  <button
                    key={n}
                    onClick={() => choose(n)}
                    className="text-left rounded-xl border border-white/10 bg-white/[.03] px-3 py-2 hover:bg-white/10"
                  >
                    <div className="font-semibold">{n}</div>
                    <div className="text-xs text-white/60">Click to use this name</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
