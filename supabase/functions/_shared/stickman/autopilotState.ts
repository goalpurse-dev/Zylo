// deno-lint-ignore-file no-explicit-any
// stickman/autopilotState.ts — loads a project's rows into the autopilot's
// input, and turns them into the progress screen's REAL events (title
// chosen, facts found + source name, live word count, claims checked).
// Shared by advance-long-form-autopilot and get-long-form-autopilot-status.
import { decideAutopilot, UI_STAGES, type AutopilotInput, type AutopilotRecord } from "./autopilot.ts";

export async function loadAutopilotInput(admin: any, projectId: string, now = new Date().toISOString()) {
  const { data: project } = await admin.from("long_form_projects").select("id, user_id, autopilot, current_story_plan_version_id, current_script_version_id, resolved_length_minutes, custom_length_minutes, selected_title").eq("id", projectId).maybeSingle();
  if (!project?.autopilot) return null;
  const planId = project.current_story_plan_version_id;
  const plan = planId ? (await admin.from("long_form_story_plan_versions").select("id, created_at, story_plan").eq("id", planId).maybeSingle()).data : null;
  const research = planId ? (await admin.from("long_form_research_versions").select("id, status, stage, stage_started_at, worker_lock_until, created_at, fact_graph, intermediate, meta").eq("project_id", projectId).eq("story_plan_version_id", planId).order("version", { ascending: false }).limit(1).maybeSingle()).data : null;
  const script = planId ? (await admin.from("long_form_script_versions").select("id, status, stage, stage_started_at, worker_lock_until, created_at, script_document, intermediate").eq("project_id", projectId).eq("story_plan_version_id", planId).order("created_at", { ascending: false }).limit(1).maybeSingle()).data : null;
  const input: AutopilotInput = {
    now,
    autopilot: project.autopilot as AutopilotRecord,
    plan: plan ? { id: plan.id, created_at: plan.created_at } : null,
    research: research ? { id: research.id, status: research.status, stage: research.stage, stage_started_at: research.stage_started_at, worker_lock_until: research.worker_lock_until, created_at: research.created_at } : null,
    script: script ? { id: script.id, status: script.status, stage: script.stage, stage_started_at: script.stage_started_at, worker_lock_until: script.worker_lock_until, created_at: script.created_at, has_document: !!script.script_document } : null,
  };
  return { project, plan, research, script, input };
}

const words = (t: string) => String(t ?? "").trim().split(/\s+/).filter(Boolean).length;
export function scriptWordCount(doc: any): number {
  if (!doc) return 0;
  if (Number(doc.actualWords) > 0) return Number(doc.actualWords);
  return (doc.narrationSegments ?? []).reduce((n: number, s: any) => n + words(s.text), 0);
}

// Everything the progress screen shows comes from real rows — nothing invented.
export function buildProgressView(loaded: NonNullable<Awaited<ReturnType<typeof loadAutopilotInput>>>) {
  const { plan, research, script, input, project } = loaded;
  const d = decideAutopilot(input);
  const ap = input.autopilot;
  const idx = UI_STAGES.findIndex((s) => s.key === d.uiStage);
  const done = d.action.kind === "done";
  const stages = UI_STAGES.map((s, i) => ({ key: s.key, label: s.label, state: done || i < idx ? "done" : i === idx ? (ap.status === "failed" ? "failed" : "active") : "todo" }));

  const events: { at: string | null; kind: string; text: string; detail?: string }[] = [];
  const sp = plan?.story_plan;
  if (sp?.recommendedTitle) events.push({ at: plan!.created_at, kind: "title", text: `Title chosen: “${sp.recommendedTitle}”` });
  if (sp?.chapters?.length) events.push({ at: plan!.created_at, kind: "plan", text: `${sp.chapters.length} chapters planned` });
  const sources = new Map<string, string>();
  for (const s of [...(research?.intermediate?.v1SourcesFull ?? []), ...(research?.intermediate?.finalSourcesFull ?? [])]) if (s?.id) sources.set(s.id, s.title ?? "");
  const shortSource = (t: string) => t.replace(/\s*[—–(|].*$/, "").trim().slice(0, 60);
  for (const f of (research?.fact_graph?.facts ?? []).slice(0, 8)) {
    const src = (f.sourceIds ?? []).map((id: string) => sources.get(id)).find(Boolean);
    const claim = String(f.claim ?? "").replace(/^According to [^,]+,\s*/i, "");
    events.push({ at: research!.created_at, kind: "fact", text: claim.length > 110 ? `${claim.slice(0, 107).trimEnd()}…` : claim, detail: src ? shortSource(src) : undefined });
  }
  const doc = script?.script_document;
  const wordCount = scriptWordCount(doc);
  const verdicts = script?.intermediate?.claimVerdicts ?? doc?.claimVerification ?? null;
  const verdictList = Array.isArray(verdicts) ? verdicts : Array.isArray(verdicts?.verdicts) ? verdicts.verdicts : [];
  const checked = verdictList.filter((v: any) => /support|verified|ok|pass|true/i.test(String(v?.verdict ?? v?.status ?? ""))).length;
  if (wordCount) events.push({ at: script!.stage_started_at, kind: "words", text: `${wordCount.toLocaleString("en-US")} words written` });
  if (verdictList.length) events.push({ at: script!.stage_started_at, kind: "claims", text: `${checked} of ${verdictList.length} claims checked ✓` });

  const minutes = Number(project.resolved_length_minutes ?? project.custom_length_minutes ?? 0);
  return {
    status: done ? "done" : ap.status,
    uiStage: d.uiStage,
    stages,
    startedAt: ap.startedAt,
    serverNow: input.now,
    etaSeconds: done ? [0, 0] : d.etaSeconds,
    progress: d.progress,
    events,
    wordCount,
    targetWords: minutes ? Math.round(minutes * 146.6) : null,
    plan: sp ? { title: sp.recommendedTitle ?? null, chapters: (sp.chapters ?? []).map((c: any) => ({ title: c.title, summary: c.summary, minutes: c.estimatedMinutes ?? null })) } : null,
    scriptVersionId: done ? (d.action as any).scriptVersionId : null,
    failed: ap.status === "failed" ? { message: "Something went wrong while writing your script." } : null,
    stale: d.stale,
  };
}
