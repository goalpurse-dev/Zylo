// Content Machine: one slideshow's state as the Queue and the All tab show it (owner, 2026-10-23). Shared by the
// API (the All tab's status filter) and the page (the badges), so both always agree.
//   posted      marked as posted on at least one platform
//   rejected    rejected by the owner
//   flagged     the compliance check still found something (not posted, not rejected)
//   not_posted  everything else
// "Outdated" (rendered with older slide templates) is shown next to the state, not instead of it.

export const STATES = Object.freeze(["posted", "not_posted", "rejected", "flagged", "outdated"]);

export function ideaState(idea) {
  if (idea.status === "posted") return "posted";
  if (idea.status === "rejected") return "rejected";
  if (idea.compliance?.flagged) return "flagged";
  return "not_posted";
}

/** Does this slideshow match the All tab's status filter? "outdated" matches any state. */
export function matchesState(idea, state) {
  if (!state) return true;
  if (state === "outdated") return Boolean(idea.outdated);
  return ideaState(idea) === state;
}
