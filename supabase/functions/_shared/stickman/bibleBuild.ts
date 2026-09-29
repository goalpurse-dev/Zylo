// deno-lint-ignore-file no-explicit-any
// stickman/bibleBuild.ts — one Production Bible build per script (Phase 6d-1).
// The bible row only exists once it is frozen, so a build still running was
// invisible: Scenes saw "no bible" after its 150 s budget and started a SECOND
// paid build while the lock's build was still working. Every build now logs
// bible_build_started / _done / _failed (system_logs); a build that started
// and hasn't finished is IN FLIGHT — a second call waits for it, and Scenes
// treats it as its own build (dispatched at its real start).
export const BIBLE_BUILD_MAX_S = 420; // a started build older than this (no end logged) is dead
const SOURCE = "build-stickman-production-bible";

export type BibleBuildState = { startedAt: string; ended: "done" | "failed" | null; endedAt: string | null } | null;

export async function bibleBuildState(admin: any, projectId: string, scriptVersionId: string): Promise<BibleBuildState> {
  const { data } = await admin.from("system_logs").select("event, created_at, details").eq("source", SOURCE).in("event", ["bible_build_started", "bible_build_done", "bible_build_failed"])
    .eq("details->>projectId", projectId).eq("details->>scriptVersionId", scriptVersionId).order("created_at", { ascending: false }).limit(6);
  const rows = data ?? [];
  const start = rows.find((r: any) => r.event === "bible_build_started");
  if (!start) return null;
  const end = rows.find((r: any) => r.event !== "bible_build_started" && r.created_at >= start.created_at);
  return { startedAt: start.created_at, ended: end ? (end.event === "bible_build_done" ? "done" : "failed") : null, endedAt: end?.created_at ?? null };
}

// In flight = started, not ended, and not older than the dead-build limit.
export function bibleBuildInFlight(s: BibleBuildState, nowMs = Date.now()): boolean {
  return !!s && !s.ended && nowMs - Date.parse(s.startedAt) < BIBLE_BUILD_MAX_S * 1000;
}
