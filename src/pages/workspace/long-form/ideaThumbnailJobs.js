// Client for generate-long-form-idea-thumbnails (see that function's own
// comments for the full billing model). Mirrors previewJobs.js's shape —
// submission failures never throw, so a caller can mark cards FAILED and
// move on rather than blocking the whole grid on one bad request.
import { supabase } from "../../../lib/supabaseClient";

export const IDEA_THUMBNAIL_ERROR = {
  INSUFFICIENT_CREDITS: "insufficient_credits",
  NETWORK: "network",
  SERVER: "server",
};

// ideas: [{ id, thumbnailConcept: { headline, scene } }]
// batchId: pass the batchId a just-completed generate-long-form-ideas call
// returned to ride its free-or-already-charged batch; omit it for a
// standalone "Refresh thumbnails" call, which is charged on its own.
export async function submitIdeaThumbnailJobs({ discoverySessionId, styleId, ideas, batchId, mode, retry }) {
  try {
    const { data, error } = await supabase.functions.invoke("generate-long-form-idea-thumbnails", {
      body: { discoverySessionId, styleId, ideas, batchId, mode, retry },
    });
    if (error) {
      const status = error?.context?.status;
      let body = null;
      try {
        body = await error.context.json();
      } catch {
        // ignore
      }
      if (status === 402 && body?.code === "INSUFFICIENT_CREDITS") {
        return { ok: false, errorType: IDEA_THUMBNAIL_ERROR.INSUFFICIENT_CREDITS };
      }
      return { ok: false, errorType: IDEA_THUMBNAIL_ERROR.SERVER };
    }
    return { ok: true, jobs: Array.isArray(data?.jobs) ? data.jobs : [], charged: data?.charged ?? 0 };
  } catch {
    return { ok: false, errorType: IDEA_THUMBNAIL_ERROR.NETWORK };
  }
}
