import React, { Suspense, lazy } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useFeatureFlag } from "../../lib/featureFlags";
import { BLOCKY_STORIES_FLAG } from "../../data/blockyStories";

// Blocky Stories is its own product: its own page, backend (blocky-story-api),
// tables and library (src/components/viral-tools/blocky-stories/).
const BlockyStoriesPage = lazy(() => import("../../components/viral-tools/blocky-stories/BlockyStoriesPage"));

/**
 * /workspace/blocky-stories — Blocky Stories. Hidden until launch: it opens
 * only when the global switch public.global_feature_flags.blocky_v1 is on or
 * the user's own blocky_v1 flag is on (src/lib/featureFlags.js). Everyone else
 * lands on the home page ("/"), as if the page didn't exist. The API checks the same flag.
 */
export default function BlockyStories() {
  const { user, loading: authLoading } = useAuth();
  const flag = useFeatureFlag(BLOCKY_STORIES_FLAG, user?.id);

  if (flag.enabled) {
    return (
      <Suspense fallback={<div className="min-h-full w-full bg-[#0B0D0F]" />}>
        <BlockyStoriesPage />
      </Suspense>
    );
  }
  if (authLoading || flag.loading) return <div className="min-h-full w-full bg-[#0B0D0F]" />;
  return <Navigate to="/" replace />;
}
