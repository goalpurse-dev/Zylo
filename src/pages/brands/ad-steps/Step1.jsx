import React, { useCallback } from "react";
import { cn } from "./ui";
import { hasTool } from "../../../lib/plan";
import { supabase } from "../../../lib/supabaseClient";

const CARD = "rounded-2xl border border-white/12 bg-white/[.03] hover:bg-white/[.05] transition";

export default function Step1({
  user,                 // <-- pass the profile (can be null)
  model,
  setModel,
  prompt,
  setPrompt,
  promptOk,
  showPromptErr,
  openUpgradeModal,     // optional toast/modal
}) {
  // Resolve plan
  const planCode = user?.plan_code ?? "free";
  const features = user?.plan?.features ?? user?.features ?? {};
  const canUseV5 = hasTool(features, "ads:sora") || planCode === "pro" || planCode === "generative";

  // Central click handler for choosing V5 (Sora)
  const pickV5 = useCallback(async () => {
    // First: quick client gate (so Free/Starter see upgrade immediately)
    if (!canUseV5) {
      openUpgradeModal ? openUpgradeModal("Upgrade to Pro to use V5 (Sora).")
                       :openUpgrade("Pro", "V5 • Sora is available on the Pro plan and higher.");
      return;
    }

    try {
      // Second: server authority (daily cap / true source of truth)
      const { data: resp, error: fnErr } = await supabase.functions.invoke("check-tool", {
        body: { key: "ads:sora", intent: "use", checkCap: true },
      });

      // Network/Edge error? Fail safe (don’t crash UI)
      if (fnErr) {
        console.warn("check-tool error:", fnErr);
        // Let the user proceed rather than blocking with an exception
        setModel("sora-v5");
        return;
      }

      // Our Edge always returns 200 with a JSON body
      const allowed = !!resp?.data?.allowed;
      const reason  = resp?.data?.reason || "";

      if (!allowed) {
        if (reason === "daily_limit" || /daily/i.test(reason)) {
          openUpgradeModal ? openUpgradeModal("Daily job limit reached for your plan today.")
                           : alert("Daily job limit reached.");
        } else {
          openUpgradeModal ? openUpgradeModal("Upgrade to Pro to use V5 (Sora).")
                           : openUpgrade("Pro", "V5 • Sora is available on the Pro plan and higher.");
        }
        return;
      }

      // All good → set V5
      setModel("sora-v5");
    } catch (e) {
      console.warn("pickV5 failed:", e);
      // Be permissive on unexpected errors to avoid dead-ends during testing
      setModel("sora-v5");
    }
  }, [canUseV5, openUpgradeModal, setModel]);

  const pickV4 = () => setModel("veo-3.1-fast");

  return (
    <div className="space-y-5">
      <div className="text-base font-semibold">
        <span className="mr-1">1)</span> <span className="font-extrabold">Choose a model</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* V4 */}
        <button
          type="button"
          onClick={pickV4}
          className={cn(CARD, "text-left p-4", model === "veo-3.1-fast" && "ring-2 ring-white/70")}
        >
          <div className="text-sm font-bold">V4 • Veo 3.1 fast</div>
          <ul className="mt-2 list-disc pl-5 text-xs text-white/70 space-y-1">
            <li>Highest consistency with face reference</li>
            <li>Great for talking avatars + movement</li>
            <li>8s single ad (split into scenes)</li>
            <li>Best for flagship campaigns</li>
          </ul>
        </button>

        {/* V5 */}
        <button
          type="button"
          onClick={pickV5}
          className={cn(
            CARD,
            "text-left p-4",
            model === "sora-v5" && "ring-2 ring-white/70",
            !canUseV5 && "opacity-60"
          )}
        >
          <div className="flex items-center gap-2">
            <div className="text-sm font-bold">V5 • Sora</div>
            <span className="text-[10px] rounded-full bg-white/15 px-2 py-0.5">Cinematic</span>
          </div>
          <ul className="mt-2 list-disc pl-5 text-xs text-white/70 space-y-1">
            <li>Flagship realism with rich motion & lighting</li>
            <li>Excellent for premium spokesperson creatives</li>
            <li>8s output</li>
            <li>Balanced consistency; great for hero ads</li>
          </ul>
          {!canUseV5 && (
            <div className="mt-3 text-[11px] text-white/60">Upgrade to Pro to use V5.</div>
          )}
        </button>
      </div>

      {/* (Optional) prompt helper – you’re not gating on prompt anymore */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-white/70">Ad idea (optional)</div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm outline-none focus:border-white/20"
          placeholder="(Optional) A short idea for your ad. You can leave this empty."
        />
        {showPromptErr && !promptOk && (
          <div className="text-[11px] text-rose-300/80">Write at least 50 characters for a stronger script.</div>
        )}
      </div>
    </div>
  );
}
