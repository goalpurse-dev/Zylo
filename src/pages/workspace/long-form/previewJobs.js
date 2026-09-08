// Wires Idea Concept Previews into Zyvo's EXISTING image-job pipeline —
// same jobs table, same job-worker -> runware-image -> Runware flow every
// other Zyvo image tool uses. Submission goes through the dedicated
// generate-long-form-preview edge function (not createImageJobSimple) so
// the zero-user-credit decision is made entirely server-side — see that
// function for why. Completion tracking reuses src/lib/jobs.ts's watchJob
// directly (called per-idea from new.jsx) rather than a hand-rolled
// watcher — that generic realtime+poll helper is the same one every normal
// Zyvo image tool already relies on.
import { supabase } from "../../../lib/supabaseClient";

// Submits one real, FREE-TO-USER concept-preview image job for a single
// idea. Returns the new job id, or null if submission itself failed (e.g.
// malformed session) — callers mark that one idea FAILED and continue; a
// submission failure must never block the idea text or any other card.
export async function submitConceptPreviewJob({ visualDirection, discoverySessionId, styleContext }) {
  try {
    const { data, error } = await supabase.functions.invoke("generate-long-form-preview", {
      body: { visualDirection, discoverySessionId, styleContext },
    });
    if (error) return null;
    return data?.jobId ?? null;
  } catch {
    return null;
  }
}
