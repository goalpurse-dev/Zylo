// generating.jsx — Phase 6e. After "Generate video" (Idea: pay + pick the
// voice), ONE screen runs everything with no stops: Writing script ->
// Recording voice -> Drawing scenes. Each stage reuses its live screen (the
// fact feed, the voice status, the live scene grid). The server autopilot
// chains the stages; this page only displays state and, when the drawing is
// done, opens the Scenes home. Opening the project while it runs lands here,
// at the live stage.
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, Loader2, Mic, PenLine, RotateCw, Shapes, TriangleAlert } from "lucide-react";
import { fetchLongFormProject } from "./project";
import { LongFormCreationHeader } from "./shared";
import { deriveStickmanStep } from "./projectStage";
import { startAutopilot, watchProject } from "./autopilot";
import { startScenes } from "./scenes";
import { fetchNarrationStatus, lockStory } from "./narration";
import { NarrationProgress } from "./narration.jsx";
import LongFormWritingPage from "./writing";
import { ScenesPage } from "./scenes.jsx";
import { cachedStickmanProject, fetchStickmanFacts, invalidateStickmanCache } from "./StickmanRouteGuard";
import { fetchActiveGenerationProfile } from "./productionProfile";
import { RefundedNotice } from "./RefundedNotice.jsx";

const STAGES = [
  { key: "script", label: "Writing script", icon: PenLine },
  { key: "voice", label: "Recording voice", icon: Mic },
  { key: "scenes", label: "Drawing scenes", icon: Shapes },
];

function VoiceStage({ projectId }) {
  const [status, setStatus] = useState(null);
  const [now, setNow] = useState(Date.now());
  const offset = useRef(0);
  useEffect(() => {
    let alive = true;
    const poll = async () => { const s = await fetchNarrationStatus(projectId); if (alive && s) { if (s.serverNow) offset.current = Date.now() - Date.parse(s.serverNow); setStatus(s); } };
    poll();
    const t = setInterval(poll, 3000);
    const c = setInterval(() => setNow(Date.now()), 1000);
    return () => { alive = false; clearInterval(t); clearInterval(c); };
  }, [projectId]);
  return (
    <>
      <NarrationProgress serverStatus={status} nowMs={now} clockOffsetMs={offset.current} voiceId={status?.voice?.voiceId} locking={!status || status.status === "none"} />
      {/* The voice provider failed: the server waits and tries again by itself (never a failure). */}
      {status?.paused && <p data-testid="voice-paused" className="mx-auto mt-3 flex max-w-[560px] items-center justify-center gap-2 rounded-xl border border-amber-300/25 bg-amber-300/[0.06] px-3 py-2 text-[13px] text-amber-100"><RotateCw className="h-4 w-4 shrink-0" />{status.pausedMessage ?? "Paused for a moment, continues automatically."}</p>}
    </>
  );
}

export default function LongFormGenerating() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(() => cachedStickmanProject(projectId)?.project ?? null);
  const [busy, setBusy] = useState(false);
  const profileRef = useRef(cachedStickmanProject(projectId)?.profile ?? null);

  const refresh = useCallback(async () => {
    const p = await fetchLongFormProject(projectId);
    if (!p) return;
    profileRef.current ??= await fetchActiveGenerationProfile(projectId);
    const facts = profileRef.current ? await fetchStickmanFacts(p, profileRef.current) : {};
    setProject({ ...p, ...facts });
  }, [projectId]);
  useEffect(() => {
    document.title = "Making your video | Zyvo";
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  const step = project ? deriveStickmanStep(project) : null;
  // Done (or never generating) -> the Scenes home.
  useEffect(() => {
    if (step && step.route !== "generating") { invalidateStickmanCache(projectId); navigate(`/long-form/project/${projectId}/${step.route}`, { replace: true }); }
  }, [step?.route, projectId, navigate]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (step?.active) watchProject(projectId); }, [step?.active, projectId]);

  const stage = step?.stage ?? "script";
  const failed = step?.statusLabel === "Needs a retry";
  // The video could not be made at all: the whole hold went back by itself (nothing to retry).
  const refunded = !!project?.autopilot?.holdReleasedAt && project?.autopilot?.status === "failed";
  const stageIdx = STAGES.findIndex((s) => s.key === stage);
  const startedAt = project?.autopilot?.startedAt ? Date.parse(project.autopilot.startedAt) : null;

  const retry = async () => {
    setBusy(true);
    if (stage === "scenes") await startScenes(projectId, { retry: true }); else await startAutopilot(projectId, { retry: true });
    setBusy(false);
    invalidateStickmanCache(projectId);
    refresh();
  };
  // Projects made before the one-screen flow may have stopped after the script or the voice.
  const start = async () => {
    setBusy(true);
    if (stage === "voice") await startScenes(projectId); else await lockStory(projectId);
    setBusy(false);
    invalidateStickmanCache(projectId);
    refresh();
  };
  const toScenes = useCallback(() => { invalidateStickmanCache(projectId); refresh(); }, [projectId, refresh]);

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 pb-24 lg:px-8 lg:py-10">
      <LongFormCreationHeader current="generating" project={project} stickman />
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-bold tracking-[-0.02em] text-white">Making your video</h1>
            <p className="mt-1 text-[13.5px] text-white/50">Script, voice and scenes — one run, no stops. You can leave; we'll let you know when your scenes are ready.</p>
          </div>
          {startedAt && !failed && <GeneratingClock startedAt={startedAt} />}
        </div>

        <ol data-testid="generating-stages" className="mb-8 grid gap-2 sm:grid-cols-3">
          {STAGES.map((s, i) => {
            const state = i < stageIdx ? "done" : i === stageIdx ? (failed ? "failed" : step?.needsStart ? "waiting" : "active") : "todo";
            const Icon = s.icon;
            return (
              <li key={s.key} className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-[13.5px] font-semibold ${state === "active" ? "border-lime-300/40 bg-lime-300/[0.07] text-white" : state === "done" ? "border-white/[0.08] text-white/60" : state === "failed" ? "border-amber-300/40 bg-amber-300/[0.06] text-amber-200" : state === "waiting" ? "border-white/15 text-white" : "border-white/[0.05] text-white/30"}`}>
                {state === "done" ? <Check className="h-4 w-4 text-lime-300" /> : state === "active" ? <Loader2 className="h-4 w-4 animate-spin text-lime-300" /> : state === "failed" ? <TriangleAlert className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                <span>{i + 1}. {s.label}</span>
              </li>
            );
          })}
        </ol>

        {!project ? (
          <div className="zyvo-shimmer h-40 rounded-2xl bg-white/[0.03]" />
        ) : refunded ? (
          <RefundedNotice className="mx-auto max-w-[560px]" />
        ) : failed && stage !== "script" ? (
          <div className="mx-auto max-w-[560px] rounded-2xl border border-amber-300/25 bg-amber-300/[0.05] p-6 text-center">
            <p className="text-[16px] font-bold text-white">{stage === "voice" ? "The voiceover stopped" : "Drawing the scenes stopped"}</p>
            <p className="mt-1 text-[13px] text-white/55">Everything so far is saved — retrying picks up where it stopped. It's free.</p>
            <button type="button" disabled={busy} onClick={retry} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-lime-300 px-5 py-2.5 text-[14px] font-bold text-[#11150D] disabled:opacity-60"><RotateCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> Retry (free)</button>
          </div>
        ) : step?.needsStart ? (
          <div className="mx-auto max-w-[560px] rounded-2xl border border-white/10 bg-[#151719] p-6 text-center">
            <p className="text-[16px] font-bold text-white">{stage === "voice" ? "Your voiceover is ready" : "Your script is ready"}</p>
            <p className="mt-1 text-[13px] text-white/55">This project was started before the one-run flow. Continue to {stage === "voice" ? "draw its scenes" : "record the voice and draw the scenes"}.</p>
            <button type="button" disabled={busy} onClick={start} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-lime-300 px-5 py-2.5 text-[14px] font-bold text-[#11150D] disabled:opacity-60">{busy && <RotateCw className="h-4 w-4 animate-spin" />}{stage === "voice" ? "Draw my scenes" : "Continue"}</button>
          </div>
        ) : stage === "script" ? (
          <LongFormWritingPage embedded projectId={projectId} onDone={refresh} />
        ) : stage === "voice" ? (
          <VoiceStage projectId={projectId} />
        ) : (
          <ScenesPage embedded projectId={projectId} onDone={toScenes} />
        )}
      </div>
    </div>
  );
}

function GeneratingClock({ startedAt }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const s = Math.max(0, Math.round((now - startedAt) / 1000));
  return <p className="text-[13px] tabular-nums text-white/50">{Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")} elapsed</p>;
}
