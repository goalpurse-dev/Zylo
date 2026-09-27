// Pure checks for AI Fruit Story v2 steps. Each returns a plain-language
// reason the step can't continue yet, or null when it can.

/** Story step (single video). */
export function storyStepBlocker(single) {
  if (single.method === "idea") return single.ideaId ? null : "Pick an idea to continue.";
  if (!single.castIds.length) return "Add at least one character.";
  if (single.method === "prompt") return single.prompt.trim().length >= 10 ? null : "Describe the story in a sentence or two.";
  const lines = single.script.filter((r) => r.speakerId && r.line.trim());
  return lines.length >= 2 ? null : "Write at least two lines, each with a speaker.";
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

/** Script lines that count (speaker and text both set). */
export function usableScript(script) {
  return script.filter((r) => r.speakerId && r.line.trim()).map((r) => ({ speakerId: r.speakerId, line: r.line.trim() }));
}
