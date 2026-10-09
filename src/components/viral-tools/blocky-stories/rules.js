// Pure checks for Blocky Stories steps. Each returns a plain-language
// reason the step can't continue yet, or null when it can.

/**
 * Story step (single video).
 * @param {object} single  single-video form state
 * @param {{blocker: string|null}} scriptParse  parseScript() result for the script tab
 */
export function storyStepBlocker(single, scriptParse) {
  if (single.method === "idea") return single.ideaId ? null : "Pick an idea to continue.";
  if (single.method === "script") {
    // blocker is null when the script is ready, so don't use ?? here.
    return scriptParse ? scriptParse.blocker : "Write at least two lines, like Vex: Who gave you admin?";
  }
  if (!single.castIds.length) return "Add at least one character.";
  return single.prompt.trim().length >= 10 ? null : "Describe the story in a sentence or two.";
}

/** Series wizard, one question at a time. */
export function wizardBlocker(step, draft) {
  if (step === 0) return draft.concept.trim().length >= 6 ? null : "Describe the series in a sentence or two.";
  if (step === 1) return draft.castIds.length >= 2 ? null : "Pick at least 2 characters.";
  if (step === 2) {
    if (!draft.opener) return "Pick how episode 1 opens.";
    if (draft.opener === "Something else" && !draft.openerCustom.trim()) return "Describe the opening moment.";
    return null;
  }
  if (step === 3) return draft.tone ? null : "Pick a tone.";
  return null;
}
