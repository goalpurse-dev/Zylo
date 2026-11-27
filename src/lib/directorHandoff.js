// "Make it on Zyvo": hands a Director plan to the style's EXISTING template page, without changing that page.
//   cutaway-topic  ?topic=<the idea>             (Cutaway reads it; 80 characters)
//   fruit-stash    the Fruit Story prefill        (its idea box)
//   town-stash     In This Town's topic prefill   (its topic box)
//   prompt-stash   the generic prompt stash       (only the SEO landing reads it today)
// Every page also gets THE PLAN CARD (components/create/DirectorPlanCard.jsx, mounted once in the workspace layout):
// the script and scene notes to copy, and "Change something", which goes back to the Director. The plan doc lists
// which engines should take the scenes directly later.
import { stashFruitStory, stashPrompt, stashTownTopic } from "./promptHandoff";
import { narrationOf, scriptWithNotes } from "../../supabase/functions/_shared/director/storyboard.js";

const KEY = "zyvo:director-handoff";

/** stash the plan for the template page and return where to go */
export function handoffToZyvo(draft, style) {
  const topic = String(draft.idea || draft.title || "").trim();
  let to = style.engine.path;
  if (style.engine.handoff === "cutaway-topic") to = `${to}?topic=${encodeURIComponent(topic.slice(0, 80))}`;
  else if (style.engine.handoff === "fruit-stash") stashFruitStory({ prompt: topic });
  else if (style.engine.handoff === "town-stash") stashTownTopic(topic);
  else stashPrompt(topic);
  try {
    localStorage.setItem(KEY, JSON.stringify({
      draftId: draft.id, styleId: style.id, styleName: style.name, path: style.engine.path, title: draft.title, topic,
      script: narrationOf(draft), notes: scriptWithNotes(draft), inputKind: style.inputKind, at: Date.now(),
    }));
  } catch { /* storage unavailable: the page still opens */ }
  return to;
}

/** the plan the user last sent to a template page (kept 3 days) */
export function readHandoff() {
  try {
    const h = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (!h || Date.now() - Number(h.at) > 3 * 86_400_000) return null;
    return h;
  } catch { return null; }
}
export function clearHandoff() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

/** "Copy prompt for Claude": short on purpose; get_draft / get_style carry every detail */
export const claudePrompt = (draft, style) => `Use Zyvo. Build my video from draft ${draft.id} in the ${style.name} style.`;
