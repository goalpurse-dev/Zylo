// Real Idea Discovery API client. Replaces mockIdeaEngine.js's text
// generation — the backend (supabase/functions/generate-long-form-ideas)
// owns every generation instruction/quality rule; this module only ever
// sends structured preferences and gets back structured results.
import { supabase } from "../../../lib/supabaseClient";

export const IDEA_ENGINE_ERROR = {
  AUTH_REQUIRED: "auth_required",
  COOLDOWN: "cooldown",
  RATE_LIMITED: "rate_limited",
  NETWORK: "network",
  SERVER: "server",
  INSUFFICIENT_CREDITS: "insufficient_credits",
};

export async function isAuthenticated() {
  const { data } = await supabase.auth.getSession();
  return Boolean(data?.session?.user);
}

// Trims each existing idea down to exactly what the backend's dedup context
// needs (title/topic/angle) — never the whole idea object (conceptPreview
// status/jobId/etc. are irrelevant to generation and shouldn't leave the client).
function toExistingIdeaRef(idea) {
  return { title: idea.title, topic: idea.topic, angle: idea.angle };
}

export async function fetchLongFormIdeas({ category, direction, count = 10, existingIdeas = [], discoverySessionId, nicheHint, styleId, steer }) {
  if (!(await isAuthenticated())) {
    return { ok: false, errorType: IDEA_ENGINE_ERROR.AUTH_REQUIRED };
  }

  let response;
  try {
    response = await supabase.functions.invoke("generate-long-form-ideas", {
      body: {
        category,
        direction,
        count,
        existingIdeas: existingIdeas.map(toExistingIdeaRef),
        discoverySessionId,
        nicheHint,
        styleId,
        steer,
      },
    });
  } catch {
    return { ok: false, errorType: IDEA_ENGINE_ERROR.NETWORK };
  }

  const { data, error } = response;
  if (error) {
    const status = error?.context?.status;
    let body = null;
    try {
      body = await error.context.json();
    } catch {
      // Non-JSON or unreadable body — fall through to the generic error below.
    }

    if (status === 401) return { ok: false, errorType: IDEA_ENGINE_ERROR.AUTH_REQUIRED };
    if (status === 429 && body?.code === "DISCOVERY_COOLDOWN") {
      return { ok: false, errorType: IDEA_ENGINE_ERROR.COOLDOWN, nextAllowedAt: body.nextAllowedAt, retryAfterSeconds: body.retryAfterSeconds };
    }
    if (status === 402 && body?.code === "INSUFFICIENT_CREDITS") {
      return { ok: false, errorType: IDEA_ENGINE_ERROR.INSUFFICIENT_CREDITS };
    }
    if (status === 429) return { ok: false, errorType: IDEA_ENGINE_ERROR.RATE_LIMITED };
    return { ok: false, errorType: IDEA_ENGINE_ERROR.SERVER };
  }

  if (!Array.isArray(data?.ideas) || data.ideas.length === 0) {
    return { ok: false, errorType: IDEA_ENGINE_ERROR.SERVER };
  }

  return { ok: true, ideas: data.ideas, batchId: data.batchId ?? null, charged: data.charged ?? 0, discovery: data.discovery ?? null };
}
