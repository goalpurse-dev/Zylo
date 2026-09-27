import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { AudioLines, CheckCircle2, Mic, Pause, Play, RotateCw, TriangleAlert, Volume2 } from "lucide-react";
import { fetchLongFormProject } from "./project";
import { supabase } from "../../../lib/supabaseClient";
import { fetchActiveGenerationProfile, isStickmanRecipeProfile } from "./productionProfile";
import { fetchLatestNarrationAudio, generateNarrationAudio, reconcileNarrationAlignment, changeNarrationVoice, fetchBeatDirectorReadiness, STICKMAN_VOICE_OPTIONS } from "./narration";
import { LongFormActionFooter, LongFormCreationHeader } from "./shared";

const POLL_INTERVAL_MS = 3000;

function formatDuration(seconds) {
  const total = Math.round(seconds ?? 0);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function NarrationLoadingState({ heading, microCopy }) {
  return (
    <div className="mx-auto flex max-w-[420px] flex-col items-center px-4 py-24 text-center">
      <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-lime-300/25 bg-lime-300/[0.06] text-lime-300">
        <AudioLines className="h-6 w-6 animate-pulse" strokeWidth={1.8} />
      </div>
      <h1 className="text-[19px] font-bold text-white">{heading}</h1>
      <p className="mt-2 text-[13.5px] leading-relaxed text-white/45">{microCopy}</p>
    </div>
  );
}

// Highlights the word whose [start,end) window contains currentTime — a
// plain linear scan over one segment's own (already short) words[] array,
// never the whole-episode word list, so this stays cheap on every
// audio timeupdate tick.
function TranscriptSegment({ segment, active, currentTime, onSeek }) {
  return (
    <button
      type="button"
      onClick={() => onSeek(segment.startSeconds)}
      className={`block w-full rounded-xl px-3.5 py-2.5 text-left transition ${active ? "bg-lime-300/[0.08] ring-1 ring-lime-300/25" : "hover:bg-white/[0.03]"}`}
    >
      <p className="mb-1 text-[10.5px] font-semibold text-white/25">{formatDuration(segment.startSeconds)}</p>
      <p className="text-[13.5px] leading-relaxed">
        {(segment.words ?? []).map((w, i) => {
          const isCurrentWord = active && currentTime >= w.start && currentTime < w.end;
          return (
            <span key={i} className={isCurrentWord ? "rounded bg-lime-300/25 text-white" : active ? "text-white/80" : "text-white/45"}>
              {w.word}{" "}
            </span>
          );
        })}
      </p>
    </button>
  );
}

function VoicePickerModal({ current, onCancel, onConfirm, allowanceRemaining }) {
  const [selected, setSelected] = useState(current);
  const changed = selected.voiceId !== current.voiceId;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onClick={onCancel}>
      <div className="w-full max-w-[440px] rounded-t-2xl border border-white/10 bg-[#131516] p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[16px] font-bold text-white">Change Voice</h2>
        <p className="mt-1 text-[12.5px] text-white/45">Choosing a different voice regenerates your narration audio from scratch.</p>
        <div className="mt-4 space-y-2">
          {STICKMAN_VOICE_OPTIONS.map((v) => (
            <button
              key={v.voiceId}
              type="button"
              onClick={() => setSelected(v)}
              className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition ${
                selected.voiceId === v.voiceId ? "border-lime-300/40 bg-lime-300/[0.06]" : "border-white/[0.08] bg-white/[0.02] hover:border-white/20"
              }`}
            >
              <span>
                <span className="block text-[13px] font-semibold text-white">{v.label}</span>
                <span className="block text-[11.5px] text-white/40">{v.description}</span>
              </span>
              {selected.voiceId === v.voiceId && <CheckCircle2 className="h-4 w-4 shrink-0 text-lime-300" />}
            </button>
          ))}
        </div>
        {changed && (
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-300/20 bg-amber-300/[0.05] px-3 py-2.5 text-[12px] leading-relaxed text-amber-200">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {allowanceRemaining > 0
              ? "This uses your included voice regeneration for this video."
              : "You've used your included regeneration — this will cost additional credits."}
          </p>
        )}
        <div className="mt-4 flex items-center justify-end gap-3">
          <button type="button" onClick={onCancel} className="text-[12.5px] font-semibold text-white/45 hover:text-white">Cancel</button>
          <button
            type="button"
            disabled={!changed}
            onClick={() => onConfirm(selected)}
            className={`rounded-xl px-4 py-2.5 text-[13px] font-semibold transition ${changed ? "bg-lime-300 text-[#11150D] hover:bg-lime-200" : "cursor-not-allowed bg-white/[0.06] text-white/30"}`}
          >
            Confirm Change
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LongFormNarration() {
  const { id: projectId } = useParams();
  return <ProjectNarration key={projectId} projectId={projectId} />;
}

function ProjectNarration({ projectId }) {
  const navigate = useNavigate();
  const [phase, setPhase] = useState("loading"); // loading | notfound | not-locked | generating | failed | alignment-issue | ready
  const [project, setProject] = useState(null);
  const [profile, setProfile] = useState(null);
  const [narration, setNarration] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [busyAction, setBusyAction] = useState(null); // null | "regenerate" | "changeVoice" | "retry"
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [actionError, setActionError] = useState(null);
  const reconcileAttemptedRef = useRef(false);
  const audioRef = useRef(null);
  const pollTimerRef = useRef(null);
  const mountTokenRef = useRef(0);

  useEffect(() => {
    document.title = "Narration | Zyvo";
    return () => clearTimeout(pollTimerRef.current);
  }, []);

  const refresh = async (token) => {
    const projectRow = await fetchLongFormProject(projectId);
    if (mountTokenRef.current !== token) return;
    if (!projectRow) { setPhase("notfound"); return; }
    setProject(projectRow);

    const activeProfile = await fetchActiveGenerationProfile(projectId);
    if (mountTokenRef.current !== token) return;
    setProfile(activeProfile);

    if (!projectRow.current_script_version_id) { setPhase("not-locked"); return; }
    const { data: scriptVersion } = await supabase.from("long_form_script_versions").select("locked_at,locked_generation_profile_id").eq("id", projectRow.current_script_version_id).maybeSingle();
    if (mountTokenRef.current !== token) return;
    if (!scriptVersion?.locked_at || !activeProfile || scriptVersion.locked_generation_profile_id !== activeProfile.id) {
      setPhase("not-locked");
      return;
    }

    const row = await fetchLatestNarrationAudio(projectId, activeProfile.id);
    if (mountTokenRef.current !== token) return;
    setNarration(row);

    let nextPhase = "generating";
    let delay = POLL_INTERVAL_MS;
    if (row?.status === "ready") {
      nextPhase = "ready";
      delay = 20000; // settle into a light heartbeat, matching visualWorld.jsx's pattern
      const readinessResult = await fetchBeatDirectorReadiness(projectId);
      if (mountTokenRef.current !== token) return;
      setReadiness(readinessResult);
    } else if (row?.status === "failed") {
      nextPhase = "failed";
      delay = null;
    } else if (row?.status === "alignment_failed") {
      nextPhase = "alignment-issue";
      if (!reconcileAttemptedRef.current) {
        reconcileAttemptedRef.current = true;
        await reconcileNarrationAlignment(row.id);
        if (mountTokenRef.current !== token) return;
        pollTimerRef.current = setTimeout(() => refresh(token), 1200);
        return;
      }
      delay = null;
    }
    setPhase(nextPhase);
    if (delay) pollTimerRef.current = setTimeout(() => refresh(token), delay);
  };

  useEffect(() => {
    const token = ++mountTokenRef.current;
    refresh(token);
    return () => clearTimeout(pollTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const segments = narration?.narration ?? [];
  const activeSegmentIndex = segments.findIndex((s) => currentTime >= s.startSeconds && currentTime < s.endSeconds);

  const handleSeek = (seconds) => {
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      audioRef.current.play();
    }
  };
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause(); else audioRef.current.play();
  };

  const handleRegenerate = async () => {
    setBusyAction("regenerate");
    setActionError(null);
    const result = await generateNarrationAudio(projectId, { manual: true });
    setBusyAction(null);
    if (!result.ok) { setActionError(result.message); return; }
    reconcileAttemptedRef.current = false;
    refresh(mountTokenRef.current);
  };

  const handleRetryFailed = async () => {
    setBusyAction("retry");
    setActionError(null);
    const result = await generateNarrationAudio(projectId, { manual: false });
    setBusyAction(null);
    if (!result.ok) { setActionError(result.message); return; }
    refresh(mountTokenRef.current);
  };

  const handleChangeVoice = async (voice) => {
    setVoiceModalOpen(false);
    setBusyAction("changeVoice");
    setActionError(null);
    const changed = await changeNarrationVoice(projectId, voice);
    if (!changed.ok) { setBusyAction(null); setActionError("Couldn't update the voice."); return; }
    const result = await generateNarrationAudio(projectId, { manual: true });
    setBusyAction(null);
    if (!result.ok) { setActionError(result.message); return; }
    reconcileAttemptedRef.current = false;
    refresh(mountTokenRef.current);
  };

  const stickman = isStickmanRecipeProfile(profile);
  const allowanceRemaining = project ? Math.max(0, (project.included_manual_tts_regenerations ?? 1) - (project.manual_tts_regenerations_used ?? 0)) : 0;
  const canContinue = readiness?.ready === true;

  if (phase === "notfound") {
    return (
      <div className="mx-auto max-w-xl px-5 py-20 text-center text-white">
        <p>Project not found.</p>
        <button onClick={() => navigate("/long-form")} className="mt-4 text-sm text-lime-300">Back to Long Form</button>
      </div>
    );
  }

  if (phase === "not-locked") {
    return (
      <div className="mx-auto max-w-xl px-5 py-20 text-center text-white">
        <p>This project's story hasn't been locked yet.</p>
        <button onClick={() => navigate(`/long-form/project/${projectId}/script`)} className="mt-4 text-sm text-lime-300">Go to Story</button>
      </div>
    );
  }

  if (phase === "loading" || phase === "generating") {
    return (
      <div className="mx-auto max-w-[760px] px-4 py-8 lg:px-8 lg:py-10">
        <LongFormCreationHeader current="narration" project={project} stickman={stickman} />
        <NarrationLoadingState
          heading="Preparing your narration…"
          microCopy="Zyvo is generating the voiceover and building the exact word-by-word timeline your video will be built on. This runs in the background — you can leave and come back."
        />
      </div>
    );
  }

  if (phase === "alignment-issue") {
    return (
      <div className="mx-auto max-w-[760px] px-4 py-8 pb-28 lg:px-8 lg:py-10">
        <LongFormCreationHeader current="narration" project={project} stickman={stickman} />
        <div className="mx-auto max-w-[480px] px-4 py-16 text-center">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] text-amber-300">
            <TriangleAlert className="h-6 w-6" strokeWidth={1.8} />
          </div>
          <h1 className="text-[19px] font-bold text-white">Voiceover ready, finishing the transcript timing</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-white/45">Your audio generated successfully. Zyvo is still reconciling the exact word-by-word timeline — no new voice generation is needed.</p>
          {narration?.audio_url && <audio className="mt-5 w-full" controls src={narration.audio_url} />}
        </div>
        <LongFormActionFooter primaryLabel="Retry Timing" onPrimary={() => { reconcileAttemptedRef.current = false; refresh(mountTokenRef.current); }} />
      </div>
    );
  }

  if (phase === "failed") {
    return (
      <div className="mx-auto max-w-[760px] px-4 py-8 pb-28 lg:px-8 lg:py-10">
        <LongFormCreationHeader current="narration" project={project} stickman={stickman} />
        <div className="mx-auto max-w-[480px] px-4 py-16 text-center">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-red-400/20 bg-red-400/[0.06] text-red-300">
            <TriangleAlert className="h-6 w-6" strokeWidth={1.8} />
          </div>
          <h1 className="text-[19px] font-bold text-white">Couldn't generate narration</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-white/45">{narration?.last_error_code ? "The voice provider returned an error." : "Something went wrong."} Your Production Bible was unaffected.</p>
          {actionError && <p className="mt-3 text-[12.5px] text-red-300/80">{actionError}</p>}
        </div>
        <LongFormActionFooter primaryLabel="Try Again" primaryLoadingLabel="Retrying…" onPrimary={handleRetryFailed} primaryLoading={busyAction === "retry"} />
      </div>
    );
  }

  // ready
  return (
    <div className="mx-auto max-w-[760px] px-4 py-8 pb-40 lg:px-8 lg:py-10 lg:pb-28">
      <LongFormCreationHeader current="narration" project={project} stickman={stickman} />
      {voiceModalOpen && (
        <VoicePickerModal
          current={STICKMAN_VOICE_OPTIONS.find((v) => v.voiceId === profile?.voice_id) ?? STICKMAN_VOICE_OPTIONS[0]}
          allowanceRemaining={allowanceRemaining}
          onCancel={() => setVoiceModalOpen(false)}
          onConfirm={handleChangeVoice}
        />
      )}

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mb-6">
        <h1 className="text-[24px] font-bold tracking-[-0.02em] text-white lg:text-[26px]">Narration Ready</h1>
        <p className="mt-1.5 text-[14px] text-white/45">Your real voiceover and exact word timeline — this is the master clock the rest of your video will follow.</p>
      </motion.div>

      <div className="mb-6 rounded-2xl border border-white/[0.09] bg-[#151719] p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-lime-300/10 text-lime-300"><Mic className="h-4 w-4" /></span>
            <div>
              <p className="text-[13px] font-semibold text-white">{STICKMAN_VOICE_OPTIONS.find((v) => v.voiceId === profile?.voice_id)?.label ?? profile?.voice_id ?? "Voice"}</p>
              <p className="text-[11.5px] text-white/40">{formatDuration(narration?.audio_duration_seconds)} • {segments.length} segments</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setVoiceModalOpen(true)} className="rounded-lg border border-white/10 px-3 py-1.5 text-[11.5px] font-semibold text-white/60 transition hover:bg-white/[0.05] hover:text-white">
              Change Voice
            </button>
            <button
              type="button"
              disabled={busyAction === "regenerate"}
              onClick={handleRegenerate}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[11.5px] font-semibold text-white/60 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-50"
            >
              {busyAction === "regenerate" ? <RotateCw className="h-3 w-3 animate-spin" /> : <Volume2 className="h-3 w-3" />}
              Regenerate Voice
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
          <button type="button" onClick={togglePlay} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-lime-300 text-[#11150D]">
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <div className="min-w-0 flex-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-lime-300" style={{ width: `${narration?.audio_duration_seconds ? Math.min(100, (currentTime / narration.audio_duration_seconds) * 100) : 0}%` }} />
            </div>
          </div>
          <span className="shrink-0 text-[11px] font-medium text-white/40">{formatDuration(currentTime)} / {formatDuration(narration?.audio_duration_seconds)}</span>
        </div>
        {narration?.audio_url && (
          <audio
            ref={audioRef}
            src={narration.audio_url}
            className="hidden"
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
          />
        )}
        {actionError && <p className="mt-3 text-[12px] text-red-300/80">{actionError}</p>}
        <p className="mt-3 text-[11px] text-white/25">
          {allowanceRemaining > 0 ? "1 included voice regeneration available for this video." : "Included voice regeneration used — further regenerations cost additional credits."}
        </p>
      </div>

      <div className="mb-6 space-y-1 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3">
        <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/30">Transcript</p>
        {segments.map((segment, i) => (
          <TranscriptSegment key={segment.segmentId} segment={segment} active={i === activeSegmentIndex} currentTime={currentTime} onSeek={handleSeek} />
        ))}
      </div>

      {!canContinue && (
        <p className="mb-4 flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-[12.5px] text-white/45">
          <RotateCw className="h-3.5 w-3.5 animate-spin" />
          Preparing production intelligence (Production Bible) — this usually finishes within a minute of narration.
        </p>
      )}

      <LongFormActionFooter
        primaryLabel="Continue to Visuals"
        onPrimary={() => navigate(`/long-form/project/${projectId}/visuals`)}
        primaryDisabled={!canContinue}
      />
    </div>
  );
}
