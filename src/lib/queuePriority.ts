/**
 * Convert a plan code into a numeric priority for the generation queue.
 * Lower number = processed first.
 */
export function getPlanPriority(planCode?: string | null): number {
  const plan = String(planCode || "").toLowerCase().trim();
  if (plan === "generative") return 1;
  if (plan === "pro")        return 2;
  if (plan === "starter")    return 3;
  return 9; // free / trial / unknown
}

export type PlanPriorityLabel = "generative" | "pro" | "starter" | "free";

export function getPlanLabel(planCode?: string | null): PlanPriorityLabel {
  const plan = String(planCode || "").toLowerCase().trim();
  if (plan === "generative") return "generative";
  if (plan === "pro")        return "pro";
  if (plan === "starter")    return "starter";
  return "free";
}

/** Human-readable queue priority description shown in the modal */
export function getQueuePriorityMessage(planCode?: string | null): string {
  const label = getPlanLabel(planCode);
  if (label === "generative") return "You're on the Generative plan — your generation gets the highest queue priority.";
  if (label === "pro")        return "You're on the Pro plan — your generation gets priority after Generative users.";
  if (label === "starter")    return "You're on the Starter plan. Your generation is queued and will start automatically.";
  return "Your generation is queued. Upgrade your plan for faster priority processing.";
}
