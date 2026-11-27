// The site's door to THE STYLES REGISTRY (supabase/functions/_shared/director/styles.js): one row = one style. The
// Create hub, the studio pages, the prompt bar and the Director read only this. Add a niche = add a row there.
export * from "../../supabase/functions/_shared/director/styles.js";
export { FORMATS, LIMITS as DIRECTOR_LIMITS, QUICK_ASKS, estimateCredits, newSceneId, speakSeconds, totalSeconds, narrationOf, scriptWithNotes } from "../../supabase/functions/_shared/director/storyboard.js";

export const CREATE_PATH = "/create";
export const studioPath = (id) => `${CREATE_PATH}/${id}`;
export const directorPath = (draftId) => `${CREATE_PATH}/director/${draftId}`;
/** QUICK GENERATE: one image or one short clip from one line (not for stories). /ai-studio, its old name, forwards here */
export const QUICK_GENERATE_PATH = "/generate";
export const AI_STUDIO_PATH = QUICK_GENERATE_PATH;
/** MAESTRO: the chat that answers, plans and makes any template */
export const MAESTRO_PATH = "/maestro";
export const maestroChatPath = (id) => `${MAESTRO_PATH}/${id}`;
