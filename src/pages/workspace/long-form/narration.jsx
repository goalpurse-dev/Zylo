import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { AudioLines, Mic, Pause, Play, RotateCw, TriangleAlert } from "lucide-react";
import { fetchLongFormProject } from "./project";
import { supabase } from "../../../lib/supabaseClient";
import { fetchActiveGenerationProfile, isStickmanRecipeProfile } from "./productionProfile";
import { fetchLatestNarrationAudio, fetchNarrationStatus, generateNarrationAudio, reconcileNarrationAlignment, changeNarrationVoice, fetchBeatDirectorReadiness } from "./narration";
import { LongFormActionFooter, LongFormCreationHeader } from "./shared";
import VoiceLibraryDialog from "./VoiceLibraryDialog";
import { findVoice } from "../../../lib/voiceCatalog";
import { findNiche } from "./niches";

const POLL_INTERVAL_MS = 3000;

function formatDuration(seconds) {
  const total = Math.round(seconds ?? 0);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const voiceName = (voiceId) => findVoice(voiceId)?.name ?? "Custom voice";

// Phase 6b: display only. Everything here comes from the server (status,
// start time, server clock, ETA range from the script's length) — recovery
// of a stalled run is the server watchdog's job, never this page's.
export function NarrationProgress({ serverStatus, nowMs, clockOffsetMs, voiceId, locking }) {
  const startedMs = serverStatus?.startedAt ? Date.parse(serverStatus.startedAt) : null;
  const elapsed = startedMs ? Math.max(0, (nowMs - clockOffsetMs - startedMs) / 1000) : null;
  const [lo, hi] = serverStatus?.etaSeconds ?? [0, 0];
  const round5 = (s) => Math.max(5, Math.round(s / 5) * 5);
  const eta = hi ? `usually ${round5(lo)}–${round5(hi)} s` : null;
  const status = locking ? "Locking your script…"
    : serverStatus?.resuming ? "It paused — resuming from where it stopped…"
    : elapsed != null && hi && elapsed > hi ? "Taking longer than usual — still working"
    : "Recording the voiceover and timing every word";
  const pct = elapsed != null && hi ? Math.min(95, Math.round((elapsed / hi) * 100)) : 4;
  return (
    <div data-testid="narration-progress" className="mx-auto mt-10 max-w-[480px] rounded-2xl border border-white/[0.09] bg-[#151719] p-6 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-lime-300/25 bg-lime-300/[0.06] text-lime-300">
        <AudioLines className="h-6 w-6 animate-pulse" strokeWidth={1.8} />
      </div>
      <h1 className="text-[19px] font-bold text-white">Preparing your narration…</h1>
      <p className="mt-1.5 text-[13px] text-white/55">{status}</p>
      {voiceId && <p className="mt-3 text-[13px] text-white/55">Voice: <span className="font-semibold text-white">{voiceName(voiceId)}</span></p>}
      <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-lime-300 transition-[width] duration-1000" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2.5 flex items-center justify-between text-[12.5px] tabular-nums">
        <span data-testid="narration-elapsed" className="font-semibold text-white/80">{elapsed != null ? `${formatDuration(elapsed)} elapsed` : "Starting…"}</span>
        <span data-testid="narration-eta" className="text-white/45">{eta ?? "estimating…"}</span>
      </div>
      {serverStatus?.characterCount ? <p className="mt-3 text-[11.5px] text-white/30">{serverStatus.characterCount.toLocaleString("en-US")} characters of script{serverStatus?.attempt > 1 ? " · second attempt" : ""}</p> : null}
      <p className="mt-4 text-[12px] leading-relaxed text-white/35">This runs on our servers — you can close this page and come back.</p>
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
  const [serverStatus, setServerStatus] = useState(null); // Phase 6a: server progress while preparing
  const [locking, setLocking] = useState(false);
  const clockOffsetRef = useRef(0);
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNowTick(Date.now()), 1000); return () => clearInterval(t); }, []);
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
      // Phase 6b: the autopilot locks the finished script and starts the
      // narration itself — show progress (and keep polling) while it does.
      if (projectRow.autopilot?.status === "running") {
        setLocking(true);
        setPhase("generating");
        pollTimerRef.current = setTimeout(() => refresh(token), POLL_INTERVAL_MS);
        return;
      }
      setPhase("not-locked");
      return;
    }
    setLocking(false);
    // Phase 6a: the script is locked, so the stepper shows Voice (never Script) here.
    setProject({ ...projectRow, _scriptLocked: true });

    const row = await fetchLatestNarrationAudio(projectId, activeProfile.id);
    if (mountTokenRef.current !== token) return;
    setNarration(row);
    // While it's being prepared, the server reports progress (display only —
    // the server watchdog resumes a stalled run once, then marks it failed).
    if (!row || row.status === "generating") {
      const s = await fetchNarrationStatus(projectId);
      if (mountTokenRef.current !== token) return;
      if (s) { if (s.serverNow) clockOffsetRef.current = Date.now() - Date.parse(s.serverNow); setServerStatus(s); }
    }

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
        <NarrationProgress serverStatus={serverStatus} nowMs={nowTick} clockOffsetMs={clockOffsetRef.current} voiceId={serverStatus?.voice?.voiceId ?? profile?.voice_id} locking={locking} />
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
        <LongFormActionFooter primaryLabel="Retry (free)" primaryLoadingLabel="Retrying…" onPrimary={handleRetryFailed} primaryLoading={busyAction === "retry"} />
      </div>
    );
  }

  // ready — Phase 6b "Listen & change": the player, the voice, and the
  // script alongside (word-by-word highlight). Changing the voice reopens the
  // same library as Step 1, with the regeneration cost stated up front.
  const currentVoice = findVoice(profile?.voice_id);
  const costNote = allowanceRemaining > 0
    ? "Changing the voice is free — it uses your 1 included re-record (0 credits)"
    : "Your included re-record is used — another voice change isn't available for this video";
  const niche = findNiche(profile?.raw_setup_snapshot?.niche ?? null); // Setup stores the niche in the profile snapshot
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 pb-40 lg:px-8 lg:py-10 lg:pb-28">
      <LongFormCreationHeader current="narration" project={project} stickman={stickman} />
      <VoiceLibraryDialog
        open={voiceModalOpen}
        currentVoiceId={profile?.voice_id ?? null}
        niche={niche}
        costNote={costNote}
        selectLabel={allowanceRemaining > 0 ? "Re-record with this voice" : "Use this voice"}
        onClose={() => setVoiceModalOpen(false)}
        onSelect={(v) => { if (allowanceRemaining > 0 && v.voiceId !== profile?.voice_id) handleChangeVoice(v); else setVoiceModalOpen(false); }}
      />

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mb-6">
        <h1 className="text-[24px] font-bold tracking-[-0.02em] text-white lg:text-[26px]">Listen &amp; change</h1>
        <p className="mt-1.5 text-[14px] text-white/45">Your voiceover, timed word by word — the clock the rest of your video follows.</p>
      </motion.div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-white/[0.09] bg-[#151719] p-5 lg:sticky lg:top-6">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-lime-300/10 text-lime-300"><Mic className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1">
              <p data-testid="voice-name" className="truncate text-[15px] font-bold text-white">{currentVoice?.name ?? "Custom voice"}</p>
              <p className="truncate text-[11.5px] text-white/40">{currentVoice ? currentVoice.tags.join(" · ") : profile?.voice_id}</p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
            <button type="button" aria-label={playing ? "Pause" : "Play"} onClick={togglePlay} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-lime-300 text-[#11150D]">
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-[1px]" />}
            </button>
            <div className="min-w-0 flex-1">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-lime-300" style={{ width: `${narration?.audio_duration_seconds ? Math.min(100, (currentTime / narration.audio_duration_seconds) * 100) : 0}%` }} />
              </div>
              <p className="mt-1.5 text-[11px] font-medium tabular-nums text-white/40">{formatDuration(currentTime)} / {formatDuration(narration?.audio_duration_seconds)} · {segments.length} segments</p>
            </div>
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

          <button
            type="button"
            data-testid="change-voice"
            disabled={busyAction === "changeVoice"}
            onClick={() => setVoiceModalOpen(true)}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-[13px] font-semibold text-white/80 transition hover:border-lime-300/40 hover:text-white disabled:opacity-50"
          >
            {busyAction === "changeVoice" ? <RotateCw className="h-3.5 w-3.5 animate-spin" /> : <Mic className="h-3.5 w-3.5" />}
            Change voice
          </button>
          <p className="mt-2 text-center text-[11.5px] text-white/35">
            {allowanceRemaining > 0 ? "1 free re-record included (0 credits)." : "Included re-record used."}
          </p>
          {actionError && <p className="mt-3 text-[12px] text-red-300/80">{actionError}</p>}
        </div>

        <div className="space-y-1 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3">
          <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/30">Script</p>
          {segments.map((segment, i) => (
            <TranscriptSegment key={segment.segmentId} segment={segment} active={i === activeSegmentIndex} currentTime={currentTime} onSeek={handleSeek} />
          ))}
        </div>
      </div>

      {/* Phase 6e: the Voiceover panel of the Editor (no longer a stop in the flow —
          the chain goes from the voice straight to the scenes by itself). */}
      <LongFormActionFooter
        primaryLabel="Back to Edit"
        onPrimary={() => navigate(`/long-form/project/${projectId}/edit`)}
        maxWidthClassName="max-w-[1100px]"
      />
    </div>
  );
}
