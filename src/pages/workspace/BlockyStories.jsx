import React, { Suspense, lazy } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useFeatureFlag } from "../../lib/featureFlags";
import { BLOCKY_NICHE } from "../../components/viral-tools/ai-fruit-story-v2/niches";

// The same story builder as AI Fruit Story, as its own template: its own
// library, ideas, series, recent creations and price rows (niches.js).
const StoryBuilderPage = lazy(() => import("../../components/viral-tools/ai-fruit-story-v2/FruitStoryV2Page"));

/**
 * /workspace/blocky-stories — Blocky Stories. Hidden until launch: it opens
 * only when the global switch public.global_feature_flags.blocky_v1 is on or
 * the user's own blocky_v1 flag is on (src/lib/featureFlags.js). Everyone else
 * lands on Home, as if the page didn't exist. The API checks the same flag.
 */
export default function BlockyStories() {
  const { user, loading: authLoading } = useAuth();
  const flag = useFeatureFlag(BLOCKY_NICHE.flag, user?.id);

  if (flag.enabled) {
    return (
      <Suspense fallback={<div className="min-h-full w-full bg-[#0B0D0F]" />}>
        <StoryBuilderPage niche={BLOCKY_NICHE} />
      </Suspense>
    );
  }
  if (authLoading || flag.loading) return <div className="min-h-full w-full bg-[#0B0D0F]" />;
  return <Navigate to="/workspace" replace />;
}
