// stickman/scriptModels.ts — the script's backup model (2026-10-07).
// After three failed tries on the default model the autopilot starts the script
// once more on this one (start-long-form-script stores it on the new version's
// meta.modelOverride; advance-long-form-script then uses it for every Stickman
// stage of that version: draft, critic, revision).
export const STICKMAN_BACKUP_MODEL = Deno.env.get("LONG_FORM_STICKMAN_BACKUP_MODEL") ?? "gpt-5.6-sol";
