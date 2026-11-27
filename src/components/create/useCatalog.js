import { useMemo } from "react";
import { useShortFormTools } from "../workspace/CreateMenu";
import { STUDIOS, STYLES, stylesInStudio, visibleStyles } from "../../data/styles";
import { trackLaunch } from "../launch/launch";

/**
 * The styles this viewer may see. A row with a `gate` follows the same switch the old Short Form menu uses
 * (useShortFormTools: the Blocky Stories flag, the Cutaway tester check, In This Town's server access), so the Create
 * pages never show a template its own page would refuse.
 */
export function useVisibleStyles(studioId = null) {
  const tools = useShortFormTools();
  return useMemo(() => {
    const gates = new Set(tools.map((t) => t.id));
    return visibleStyles(studioId ? stylesInStudio(studioId) : [...STYLES].sort((a, b) => a.sort - b.sort), gates);
  }, [tools, studioId]);
}

/** each studio with the number of templates this viewer sees in it */
export function useStudios() {
  const all = useVisibleStyles();
  return useMemo(() => [...STUDIOS].sort((a, b) => a.sort - b.sort).map((s) => ({ ...s, count: all.filter((x) => x.studios.includes(s.id)).length })), [all]);
}

/** Part D events (docs/studio-v2-plan.md): Vercel analytics + marketing_events, never blocking the page */
export function trackCreate(event, meta = {}) {
  trackLaunch(event, { placement: meta.placement ?? "create", target: meta.target ?? meta.style ?? null, ...meta });
}
