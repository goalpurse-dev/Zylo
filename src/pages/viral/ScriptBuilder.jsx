import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSEO } from "../../hooks/useSEO";
import ScriptStylePicker from "../../components/ScriptBuilder/ScriptStylePicker";
import { SCRIPT_STYLES } from "../../lib/scriptTemplates";
import ScriptChat from "../../components/ScriptBuilder/ScriptChat";
import ScriptResult from "../../components/ScriptBuilder/ScriptResult";
import ScriptUpsellModal from "../../components/ScriptBuilder/ScriptUpsellModal";
import { supabase } from "../../lib/supabaseClient";

const HISTORY_MAX = 5;

export default function ScriptBuilder() {
  const navigate = useNavigate();

  useSEO({
    title: "AI Viral Script Builder — Write TikTok, Reels & YouTube Scripts in 60 Seconds | Zyvo",
    description:
      "Generate complete viral scripts with hooks, scenes, CTAs, and image prompts in under 60 seconds. Choose from 8 creator styles — MrBeast Mode, TikTok Viral, Story Arc, Comedy Skit, and more.",
    canonical: "https://www.tryzyvo.com/workspace/viral-script",
    structuredData: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Zyvo Viral Script Builder",
      applicationCategory: "CreativeApplication",
      operatingSystem: "Web",
      description:
        "AI-powered viral script generator. Build TikTok, Instagram Reels, and YouTube scripts with hooks, scenes, CTAs, and AI image prompts in 60 seconds.",
      url: "https://www.tryzyvo.com/workspace/viral-script",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      featureList: [
        "8 creator style presets",
        "Viral hook generator",
        "Scene-by-scene script structure",
        "AI image and video prompts per scene",
        "3 alternate hooks for A/B testing",
        "TikTok, Reels, and YouTube Shorts support",
      ],
    },
  });
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [imageIdea, setImageIdea] = useState(null);
  const [imageResult, setImageResult] = useState(null);

  const reloadHistory = async (uid) => {
    const { data: rows } = await supabase
      .from("viral_scripts")
      .select("id, created_at, preset, preset_icon, platform, type, idea, script_data")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(HISTORY_MAX);
    if (rows) {
      setHistory(rows.map((r) => ({
        id: r.id,
        createdAt: r.created_at,
        preset: r.preset,
        presetIcon: r.preset_icon || "✨",
        platform: r.platform,
        type: r.type,
        idea: r.idea,
        script: r.script_data,
      })));
    }
  };
  const [scriptData, setScriptData] = useState(null);
  const [history, setHistory] = useState([]);
  const [viewingEntry, setViewingEntry] = useState(null);
  const [mobileView, setMobileView] = useState("builder");

  // Auth / plan gate
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState(null);
  const [planCode, setPlanCode] = useState(null);
  const [upsellMode, setUpsellMode] = useState(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data: auth } = await supabase.auth.getSession();
      const user = auth?.session?.user;
      if (!mounted) return;

      if (!user) {
        setUserId(null);
        setPlanCode(null);
        setAuthReady(true);
        return;
      }

      setUserId(user.id);

      // Load history from Supabase so it syncs across devices
      const { data: rows } = await supabase
        .from("viral_scripts")
        .select("id, created_at, preset, preset_icon, platform, type, idea, script_data")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(HISTORY_MAX);

      if (mounted && rows) {
        setHistory(rows.map((r) => ({
          id: r.id,
          createdAt: r.created_at,
          preset: r.preset,
          presetIcon: r.preset_icon || "✨",
          platform: r.platform,
          type: r.type,
          idea: r.idea,
          script: r.script_data,
        })));
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("plan_code")
        .eq("id", user.id)
        .single();

      if (mounted) {
        setPlanCode((profile?.plan_code || "free").toLowerCase());
        setAuthReady(true);
      }
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) init();
      else {
        setUserId(null);
        setPlanCode(null);
        setHistory([]);
        setAuthReady(true);
      }
    });

    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  const handleStyleSelect = (style) => {
    if (!userId) { setUpsellMode("guest"); return; }
    if (planCode === "free") { setUpsellMode("free"); return; }
    setSelectedStyle(style);
  };

  const handleGenerate = async (form, script) => {
    const id = crypto.randomUUID();
    const entry = {
      id,
      createdAt: new Date().toISOString(),
      preset: selectedStyle?.name || "Custom",
      presetIcon: selectedStyle?.icon || "✨",
      platform: form.platform || selectedStyle?.defaults?.platform || "",
      type: form.type || selectedStyle?.defaults?.type || "",
      idea: (form.idea || "").slice(0, 140),
      form,
      script,
    };
    // Keep newest HISTORY_MAX, drop oldest
    const updated = [entry, ...history].slice(0, HISTORY_MAX);
    setHistory(updated);
    setScriptData({ ...script, _id: id });
    setViewingEntry(null);
    setImageResult(null);
    setMobileView("result");

    // Persist to Supabase so it syncs across devices
    if (userId) {
      supabase.from("viral_scripts").insert([{
        id,
        user_id: userId,
        preset: entry.preset,
        preset_icon: entry.presetIcon,
        platform: entry.platform,
        type: entry.type,
        idea: entry.idea,
        script_data: script,
      }]).then(() => {});
    }
  };

  const handleDeleteHistory = (id) => {
    setHistory((prev) => prev.filter((h) => h.id !== id));
    if (viewingEntry?.id === id) setViewingEntry(null);
    if (userId) supabase.from("viral_scripts").delete().eq("id", id).eq("user_id", userId).then(() => {});
  };

  const handleReset = () => {
    setSelectedStyle(null);
    setScriptData(null);
    setViewingEntry(null);
    setImageResult(null);
    setMobileView("builder");
  };

  const handleViewHistory = (entry) => {
    if (entry.type === "image_idea") {
      setViewingEntry(null);
      setScriptData(null);
      setImageResult({ imageUrl: entry.script?.imageUrl ?? null, idea: entry.idea });
      setMobileView("result");
      return;
    }
    // Normal script entry — clear any image result
    setImageResult(null);
    setViewingEntry(entry);
    setMobileView("result");
  };

  const activeScript = viewingEntry?.script || scriptData;

  return (
    <div className="h-full w-full flex overflow-hidden bg-[#090A0A]">

      {/* ─── LEFT PANEL ─────────────────────────────────────────────────────── */}
      <div
        className={`
          w-full xl:max-w-[460px] xl:min-w-[420px] border-r border-white/[0.06] flex flex-col
          ${mobileView === "result" ? "hidden xl:flex" : "flex"}
        `}
      >
        {/* Header */}
        <div className="shrink-0 px-5 py-4 border-b border-white/[0.06] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-[#7A3BFF] to-[#6F3AE6] flex items-center justify-center text-sm shadow-md shadow-purple-700/40">
              ✍️
            </div>
            <div>
              <h1 className="text-white text-sm font-bold leading-tight flex items-center gap-2">
                Viral Script Builder
                <span className="text-[9px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded-md bg-[#7A3BFF]/20 text-[#A07BFF] border border-[#7A3BFF]/25">beta</span>
              </h1>
              {selectedStyle ? (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[11px]">{selectedStyle.icon}</span>
                  <span className="text-white/40 text-[11px]">{selectedStyle.name}</span>
                  <button
                    onClick={handleReset}
                    className="text-white/25 hover:text-white/55 text-[10px] transition-colors ml-1 border border-white/10 px-1.5 py-0.5 rounded-md hover:border-white/20"
                  >
                    change
                  </button>
                </div>
              ) : (
                <p className="text-white/30 text-[11px]">Choose a style to start</p>
              )}
            </div>
          </div>

          {activeScript && (
            <button
              onClick={() => setMobileView("result")}
              className="xl:hidden flex items-center gap-1.5 text-[11px] text-[#9B6DFF] border border-[#7A3BFF]/40 px-3 py-1.5 rounded-lg font-medium hover:bg-[#7A3BFF]/10 transition-all shrink-0"
            >
              View Script →
            </button>
          )}

          {!activeScript && history.length > 0 && !selectedStyle && (
            <div className="text-[10px] text-white/25 shrink-0">
              {history.length} saved
            </div>
          )}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto pb-[80px] xl:pb-0">
          {!selectedStyle ? (
            <ScriptStylePicker
              onSelect={handleStyleSelect}
              history={history}
              onViewHistory={handleViewHistory}
              onDeleteHistory={handleDeleteHistory}
              onImageIdea={(result) => {
                setImageResult(result);
                setMobileView("result");
                if (userId) reloadHistory(userId);
              }}
            />
          ) : (
            <div className="px-5 py-5">
              <ScriptChat
                key={selectedStyle.id}
                stylePreset={selectedStyle}
                onGenerate={handleGenerate}
                prefillIdea={imageIdea}
              />
            </div>
          )}
        </div>
      </div>

      {/* ─── RIGHT PANEL (desktop) ──────────────────────────────────────────── */}
      <div className="hidden xl:flex flex-1 flex-col overflow-hidden">
        <div className="shrink-0 px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <span className="text-white/40 text-xs font-semibold uppercase tracking-widest">
            {imageResult ? "Script Idea" : activeScript ? "Script Output" : "Output"}
          </span>

          <div className="flex items-center gap-3">
            {imageResult && (
              <button onClick={() => setImageResult(null)} className="text-white/25 hover:text-white/60 text-xs transition-colors">✕</button>
            )}
            {!imageResult && viewingEntry && (
              <>
                <span className="text-white/30 text-xs">Viewing saved script</span>
                <button onClick={() => setViewingEntry(null)} className="text-white/25 hover:text-white/60 text-xs transition-colors">✕</button>
              </>
            )}
            {!imageResult && activeScript && !viewingEntry && (
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/80 border border-white/10 hover:border-white/25 px-3 py-1.5 rounded-lg transition-all"
              >
                + New Script
              </button>
            )}
          </div>
        </div>

        <ScriptResult
          script={imageResult ? null : activeScript}
          history={history}
          onViewHistory={handleViewHistory}
          onDeleteHistory={handleDeleteHistory}
          onGenerateAnother={handleReset}
          userId={userId}
          scriptId={activeScript?._id}
          imageResult={imageResult}
          onDiscardImageResult={() => setImageResult(null)}
        />
      </div>

      {/* ─── MOBILE RESULT PANEL ────────────────────────────────────────────── */}
      {mobileView === "result" && (activeScript || imageResult) && (
        <div className="xl:hidden flex flex-col w-full h-full">
          <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-white/[0.06] bg-[#090A0A]">
            <button
              onClick={() => { setMobileView("builder"); if (imageResult) setImageResult(null); }}
              className="flex items-center gap-2 text-white/50 hover:text-white/80 text-sm transition-colors"
            >
              <span className="text-base leading-none">←</span>
              <span>Back</span>
            </button>
            <span className="text-white text-sm font-semibold">{imageResult ? "Script Idea" : "Script Output"}</span>
            <button onClick={handleReset} className="text-xs text-[#9B6DFF] hover:text-[#B88FFF] font-medium transition-colors">
              New
            </button>
          </div>

          <div className="flex-1 min-h-0">
            <ScriptResult
              script={imageResult ? null : activeScript}
              history={history}
              onViewHistory={handleViewHistory}
              onDeleteHistory={handleDeleteHistory}
              onGenerateAnother={handleReset}
              bottomPad
              userId={userId}
              scriptId={activeScript?._id}
              imageResult={imageResult}
              onDiscardImageResult={() => { setImageResult(null); setMobileView("builder"); }}
            />
          </div>
        </div>
      )}

      {/* Upsell modal */}
      <ScriptUpsellModal
        open={upsellMode !== null}
        mode={upsellMode}
        onClose={() => setUpsellMode(null)}
      />
    </div>
  );
}
