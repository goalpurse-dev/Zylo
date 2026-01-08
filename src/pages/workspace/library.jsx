import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { BACKGROUND_PRESETS } from "../../lib/backgroundPresets";

import Toppicks from "../../components/library/Toppicks.jsx";
import Plain from "../../components/library/Plain.jsx";
import Studio from "../../components/library/Studio.jsx";
import Soft from "../../components/library/Soft.jsx";
import Nature from "../../components/library/Nature.jsx";
import Wood from "../../components/library/Wood.jsx";
import Stone from "../../components/library/Stone.jsx";
import Indoor from "../../components/library/Indoor.jsx";
import Outdoor from "../../components/library/Outdoor.jsx";
import Workspace from "../../components/library/Workspace.jsx";

// 🔑 Per-row unlock limits
const ROW_LIMITS = {
  starter: 3,
  pro: 10,
  generative: Infinity,
};

export default function Library({ onSelect, selectedId }) {
  const [planTier, setPlanTier] = useState(null);

  useEffect(() => {
    async function loadPlan() {
      const { data, error } = await supabase.functions.invoke("plan-features");

      if (error) {
        console.error("Plan features error:", error);
        setPlanTier("starter");
        return;
      }

      setPlanTier(data?.features?.plan_tier ?? "starter");
    }

    loadPlan();
  }, []);

  // Wait until plan is known
  if (!planTier) return null;

const withLock = (items) =>
  items.map((bg) => {
    const i = bg.index_in_category;

    // 🟢 NOT LOGGED IN → everything open
    if (planTier === "guest") {
      return { ...bg, locked: false };
    }

    // 🟡 GENERATIVE → everything open
    if (planTier === "generative") {
      return { ...bg, locked: false };
    }

    // 🔵 PRO
    if (planTier === "pro") {
      if (i <= 10) return { ...bg, locked: false };

      return {
        ...bg,
        locked: true,
        lockReason: "generative",
      };
    }

    // 🟣 STARTER
    if (planTier === "starter") {
      if (i <= 3) return { ...bg, locked: false };

      if (i <= 10) {
        return {
          ...bg,
          locked: true,
          lockReason: "pro",
        };
      }

      return {
        ...bg,
        locked: true,
        lockReason: "generative",
      };
    }

    // 🆓 FREE (logged in but no paid plan)
    if (planTier === "free") {
      if (i <= 3) {
        return {
          ...bg,
          locked: true,
          lockReason: "starter",
        };
      }

      if (i <= 10) {
        return {
          ...bg,
          locked: true,
          lockReason: "pro",
        };
      }

      return {
        ...bg,
        locked: true,
        lockReason: "generative",
      };
    }

    // 🛟 fallback (should never hit)
    return {
      ...bg,
      locked: true,
      lockReason: "starter",
    };
  });


  return (
    <section className="pb-10 space-y-12">
      <Toppicks
        items={withLock(BACKGROUND_PRESETS.filter(b => b.category === "toppicks"))}
        onSelect={onSelect}
        selectedId={selectedId}
      />

      <Workspace
        items={withLock(BACKGROUND_PRESETS.filter(b => b.category === "workspace"))}
        onSelect={onSelect}
        selectedId={selectedId}
      />

      <Plain
        items={withLock(BACKGROUND_PRESETS.filter(b => b.category === "plain"))}
        onSelect={onSelect}
        selectedId={selectedId}
      />

      <Studio
        items={withLock(BACKGROUND_PRESETS.filter(b => b.category === "studio"))}
        onSelect={onSelect}
        selectedId={selectedId}
      />

      <Soft
        items={withLock(BACKGROUND_PRESETS.filter(b => b.category === "soft"))}
        onSelect={onSelect}
        selectedId={selectedId}
      />

      <Nature
        items={withLock(BACKGROUND_PRESETS.filter(b => b.category === "nature"))}
        onSelect={onSelect}
        selectedId={selectedId}
      />

      <Wood
        items={withLock(BACKGROUND_PRESETS.filter(b => b.category === "wood"))}
        onSelect={onSelect}
        selectedId={selectedId}
      />

      <Stone
        items={withLock(BACKGROUND_PRESETS.filter(b => b.category === "stone"))}
        onSelect={onSelect}
        selectedId={selectedId}
      />

      <Indoor
        items={withLock(BACKGROUND_PRESETS.filter(b => b.category === "indoor"))}
        onSelect={onSelect}
        selectedId={selectedId}
      />

      <Outdoor
        items={withLock(BACKGROUND_PRESETS.filter(b => b.category === "outdoor"))}
        onSelect={onSelect}
        selectedId={selectedId}
      />
    </section>
  );
}
