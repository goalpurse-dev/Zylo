import { useEffect, useMemo, useRef, useState } from "react";
import { Play, RefreshCw, Volume2 } from "lucide-react";
import {
  VOICES,
  SCENE_COUNT,
  captureThirtyDaysFrames,
  fetchThirtyDaysScript,
  generateThirtyDaysVoice,
  getVoice,
  previewThirtyDaysVoice,
  probeClipDuration,
  saveNarrationToGeneration,
  saveThirtyDaysNarrationDraft,
  thirtyDaysVoicePlaybackRate,
} from "./api/thirtyDaysApi";

function base64Blob(value, mimeType = "audio/mpeg") {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mimeType });
}

function buildAudioClipTimings(alignedWords, plannedClipSegments) {
  if (!Array.isArray(alignedWords) || !Array.isArray(plannedClipSegments) || !plannedClipSegments.length) return [];
  let cursor = 0;
  let previousEnd = 0;
  const timings = plannedClipSegments.map((segment, index) => {
    const plannedWordCount = String(segment?.text || "").trim().split(/\s+/).filter(Boolean).length;
    const spokenWords = alignedWords.slice(cursor, cursor + plannedWordCount);
    cursor += plannedWordCount;
    const sourceStart = index === 0 ? 0 : Number(spokenWords[0]?.start ?? previousEnd);
    const sourceEnd = Number(spokenWords.at(-1)?.end ?? sourceStart);
    previousEnd = Math.max(previousEnd, sourceEnd);
    return {
      clip: Number(segment?.clip || index + 1),
      sourceStart: Number(sourceStart.toFixed(3)),
      sourceEnd: Number(sourceEnd.toFixed(3)),
      targetDuration: Number(Math.max(0.2, Number(segment?.end) - Number(segment?.start)).toFixed(3)),
    };
  });
  return timings.length === plannedClipSegments.length && timings.every((item) => item.sourceEnd > item.sourceStart) ? timings : [];
}

function narrationFingerprint(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export default function ThirtyDaysVoiceStep({ generation, seriesContext = null, autoGenerate = true, onDraftReady, onReady, onBack }) {
  const clips = useMemo(() => [...(generation?.scenes || [])].filter((scene) => scene.videoUrl).sort((a, b) => a.index - b.index), [generation]);
  const expectedSceneCount = generation?.scenes?.length || SCENE_COUNT;
  const hasInternalStatus = (value) => /\b(?:qa[_ -]?unavailable|qa[_ -]?warning|qa[_ -]?failed|verified usable|identity[_ -]?drift|pov[_ -]?violation|near[_ -]?duplicate)\b/i.test(String(value || ""));
  const hasImageDescription = (value) => /\b(?:the image (?:shows|depicts)|the (?:scene|frame) (?:shows|depicts)|a (?:wide|close|medium) shot|a LEGO scene depicting|scene depicting|rendered (?:scene|image)|minifigures?, including)\b/i.test(String(value || ""));
  const hasBrokenSeriesNarration = (value) => {
    const text = String(value || "");
    const captionConnectors = text.match(/\b(?:that's when|a little later|the next morning|but then|because of that|finally)\b/gi)?.length || 0;
    return /\b(?:i both|i all|my faces)\b|\bfocusing on\s*[.!?]|\bas\s+[A-Z][A-Za-z'-]{2,}\s*[.!?]/i.test(text)
      || captionConnectors >= 5;
  };
  const savedNarrationText = [generation?.narrationTake?.hook, generation?.narrationTake?.narration, generation?.narrationTake?.script].filter(Boolean).join(" ");
  // Old drafts can contain vision-QA prose, broken grammar, or a chain of
  // seven captions rather than narration. Reopening replaces them automatically.
  const savedDraft = generation?.narrationTake?.draft && !hasInternalStatus(savedNarrationText) && !hasImageDescription(savedNarrationText) && !hasBrokenSeriesNarration(savedNarrationText) ? generation.narrationTake : null;
  const [visualDuration, setVisualDuration] = useState(0);
  const [hook, setHook] = useState(savedDraft?.hook || generation?.hook || "");
  // A completed episode can legitimately have no saved narration yet. Keep
  // this controlled textarea/string-only: `null` here used to crash the
  // Generate button's narration.trim() while merely reopening an episode.
  const [narration, setNarration] = useState(savedDraft?.narration || (!hasInternalStatus(generation?.narrationScript) && !hasImageDescription(generation?.narrationScript) && !hasBrokenSeriesNarration(generation?.narrationScript) ? (generation?.narrationScript || "") : ""));
  const [scriptTiming, setScriptTiming] = useState(savedDraft?.captionScript || null);
  const [voiceId, setVoiceId] = useState(savedDraft?.voiceId || VOICES[0].id);
  const [status, setStatus] = useState(savedDraft ? "AI-synced narration ready" : "Watching the finished clips…");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [scriptBusy, setScriptBusy] = useState(false);
  // This workspace stays mounted while a creator selects a different series
  // episode. A boolean made the first episode permanently "initialized" and
  // silently skipped automatic narration for every episode opened after it.
  const autoDraftReadyGenerationIdRef = useRef(null);
  const autoDraftInFlightGenerationIdRef = useRef(null);
  const previewUrlRef = useRef(null);

  useEffect(() => () => { if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current); }, []);
  useEffect(() => {
    if (!generation?.id || clips.length !== expectedSceneCount
      || autoDraftReadyGenerationIdRef.current === generation.id
      || autoDraftInFlightGenerationIdRef.current === generation.id) return;
    autoDraftInFlightGenerationIdRef.current = generation.id;
    let cancelled = false;
    (async () => {
      try {
        const durations = await Promise.all(clips.map((clip) => probeClipDuration(clip.videoUrl)));
        const duration = durations.reduce((sum, value) => sum + value, 0);
        if (cancelled) return;
        setVisualDuration(duration);
        if (seriesContext?.mode === "series" && !autoGenerate) {
          autoDraftReadyGenerationIdRef.current = generation.id;
          setStatus(savedDraft ? "Stored episode narration loaded" : "Narration not generated yet");
          return;
        }
        if (savedDraft?.captionScript?.clipSegments?.length === expectedSceneCount) {
          autoDraftReadyGenerationIdRef.current = generation.id;
          setStatus("AI-synced narration ready");
          return;
        }
        setStatus("Writing narration from the actual clips…");
        const clipFrames = await captureThirtyDaysFrames(clips);
        const script = await fetchThirtyDaysScript({
          generationId: generation.id,
          universe: generation.universe,
          premise: generation.premise,
          hook: generation.hook,
          scenes: generation.scenes,
          clips: clips.map((clip, index) => ({ ...clip, durationSec: durations[index] })),
          clipPrompts: generation.scenes.map((scene) => ({ index: scene.index, prompt: scene.videoPrompt })),
          clipFrames,
          visualDurationSec: duration,
          voiceId,
          seriesContext,
        });
        if (cancelled) return;
        setHook(script.hook || generation.hook || "");
        setNarration(script.narration || "");
        setScriptTiming(script);
        const saved = await saveThirtyDaysNarrationDraft({
          generationId: generation.id,
          hook: script.hook || generation.hook || "",
          narration: script.narration || "",
          voiceId,
          captionScript: script,
        });
        if (cancelled) return;
        onDraftReady?.(saved);
        autoDraftReadyGenerationIdRef.current = generation.id;
        setStatus("AI-synced narration ready");
      } catch (caught) {
        if (!cancelled) { setError(String(caught?.message || caught)); setStatus("Script needs attention"); }
      } finally {
        if (autoDraftInFlightGenerationIdRef.current === generation.id) autoDraftInFlightGenerationIdRef.current = null;
      }
    })();
    return () => { cancelled = true; };
  }, [autoGenerate, clips, expectedSceneCount, generation, onDraftReady, savedDraft, seriesContext, voiceId]);

  const regeneratePrompt = async () => {
    if (!generation?.id || clips.length !== expectedSceneCount || busy || scriptBusy) return;
    setScriptBusy(true);
    setError("");
    setStatus("Regenerating the story from the finished clips…");
    try {
      const durations = await Promise.all(clips.map((clip) => probeClipDuration(clip.videoUrl)));
      const duration = durations.reduce((sum, value) => sum + value, 0);
      setVisualDuration(duration);
      const clipFrames = await captureThirtyDaysFrames(clips);
      const script = await fetchThirtyDaysScript({
        generationId: generation.id,
        universe: generation.universe,
        premise: generation.premise,
        hook: generation.hook,
        scenes: generation.scenes,
        clips: clips.map((clip, index) => ({ ...clip, durationSec: durations[index] })),
        clipPrompts: generation.scenes.map((scene) => ({ index: scene.index, prompt: scene.videoPrompt })),
        clipFrames,
        visualDurationSec: duration,
        forceRegenerate: true,
        previousNarration: narration,
        voiceId,
        seriesContext,
      });
      const nextHook = script.hook || generation.hook || "";
      const nextNarration = script.narration || "";
      if (!nextNarration.trim() || narrationFingerprint(nextNarration) === narrationFingerprint(narration)) {
        throw new Error("A fresh narration draft was not returned. Your current narration was kept unchanged—please try Regenerate prompt again.");
      }
      setHook(nextHook);
      setNarration(nextNarration);
      setScriptTiming(script);
      const saved = await saveThirtyDaysNarrationDraft({
        generationId: generation.id,
        hook: nextHook,
        narration: nextNarration,
        voiceId,
        captionScript: script,
      });
      onDraftReady?.(saved);
      setStatus("New AI-synced narration ready");
    } catch (caught) {
      setError(String(caught?.message || caught));
      setStatus("Narration regeneration needs attention");
    } finally {
      setScriptBusy(false);
    }
  };

  const preview = async () => {
    setError("");
    try {
      const blob = await previewThirtyDaysVoice({ voiceId, universe: generation.universe, generationId: generation.id });
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = URL.createObjectURL(blob);
      new Audio(previewUrlRef.current).play();
    } catch (caught) { setError(String(caught?.message || caught)); }
  };

  const generate = async () => {
    const combined = `${hook.trim()} ${narration.trim()}`.trim();
    if (!combined || busy) return;
    setBusy(true); setError(""); setStatus("Creating voiceover…");
    try {
      let activeHook = hook.trim();
      let activeNarration = narration.trim();
      let activeTiming = scriptTiming;
      let response = await generateThirtyDaysVoice({ voiceId, script: `${activeHook} ${activeNarration}`.trim(), generationId: generation.id });
      let shortened = false;
      if (!seriesContext && Number(response.durationSec) > visualDuration + 0.2) {
        setStatus("Shortening the voiceover to fit…");
        const revised = await fetchThirtyDaysScript({
          generationId: generation.id,
          universe: generation.universe,
          premise: generation.premise,
          hook: generation.hook,
          scenes: generation.scenes,
          clips,
          clipPrompts: generation.scenes.map((scene) => ({ index: scene.index, prompt: scene.videoPrompt })),
          clipFrames: [],
          visualDurationSec: visualDuration,
          shortenFrom: { hook: activeHook, narration: activeNarration },
          seriesContext,
        });
        activeHook = revised.hook || activeHook;
        activeNarration = revised.narration || activeNarration;
        activeTiming = revised;
        setHook(activeHook); setNarration(activeNarration);
        setScriptTiming(activeTiming);
        response = await generateThirtyDaysVoice({ voiceId, script: `${activeHook} ${activeNarration}`.trim(), generationId: generation.id });
        shortened = true;
      } else if (!seriesContext && Number(response.durationSec) < visualDuration * 0.85 - 0.3) {
        // The playback-rate stretch that syncs audio to video is capped at
        // 0.85-1.15x so it never sounds unnaturally slow/fast — beyond that
        // range it can't hide a real shortfall, leaving a silent video tail.
        // A too-short script gets one rewrite pass to actually fill the
        // runtime, mirroring the shorten path above.
        setStatus("Lengthening the voiceover to fill the video…");
        const revised = await fetchThirtyDaysScript({
          generationId: generation.id,
          universe: generation.universe,
          premise: generation.premise,
          hook: generation.hook,
          scenes: generation.scenes,
          clips,
          clipPrompts: generation.scenes.map((scene) => ({ index: scene.index, prompt: scene.videoPrompt })),
          clipFrames: [],
          visualDurationSec: visualDuration,
          expandFrom: { hook: activeHook, narration: activeNarration },
          seriesContext,
        });
        activeHook = revised.hook || activeHook;
        activeNarration = revised.narration || activeNarration;
        activeTiming = revised;
        setHook(activeHook); setNarration(activeNarration);
        setScriptTiming(activeTiming);
        response = await generateThirtyDaysVoice({ voiceId, script: `${activeHook} ${activeNarration}`.trim(), generationId: generation.id });
      }
      if (!seriesContext && Number(response.durationSec) > visualDuration + 0.2) {
        throw new Error(shortened ? "The shortened voiceover is still longer than the video. Trim the script and try again." : "The voiceover is too long.");
      }
      const audioBlob = base64Blob(response.audioBase64, response.mimeType);
      const voice = getVoice(voiceId);
      const playbackRate = thirtyDaysVoicePlaybackRate(Number(response.durationSec), visualDuration);
      const plannedClipSegments = activeTiming?.clipSegments || [];
      const audioClipTimings = buildAudioClipTimings(response.captionScript?.words || [], plannedClipSegments);
      const captionScript = {
        ...activeTiming,
        ...response.captionScript,
        clipSegments: plannedClipSegments,
        plannedWords: activeTiming?.words || [],
        audioClipTimings,
        timingVersion: 5,
        timingSource: "elevenlabs-alignment-per-rendered-clip",
      };
      const saved = await saveNarrationToGeneration({
        generationId: generation.id,
        voiceId,
        voiceLabel: voice.label,
        script: `${activeHook} ${activeNarration}`.trim(),
        audioBlob,
        durationSec: Number(response.durationSec),
        playbackRate,
        captionScript,
      });
      setStatus("Voiceover ready");
      onReady?.(saved?.narrationTake || saved?.narration_take || {
        voiceId, voiceLabel: voice.label, script: `${activeHook} ${activeNarration}`.trim(),
        durationSec: Number(response.durationSec), playbackRate,
      }, saved);
    } catch (caught) {
      setError(String(caught?.message || caught));
      setStatus("Voiceover needs attention");
    } finally { setBusy(false); }
  };

  const persistDraft = async (nextVoiceId = voiceId) => {
    if (!generation?.id || !narration.trim() || scriptBusy || busy) return;
    try {
      const saved = await saveThirtyDaysNarrationDraft({
        generationId: generation.id,
        hook,
        narration,
        voiceId: nextVoiceId,
        captionScript: scriptTiming,
      });
      onDraftReady?.(saved);
    } catch (caught) {
      setError(String(caught?.message || caught));
    }
  };

  const words = `${hook} ${narration}`.trim().split(/\s+/).filter(Boolean).length;
  const seriesLengthInvalid = seriesContext?.mode === "series" && (words < 100 || words > 115);
  return (
    <section className="rounded-2xl border border-lime-300/[0.13] bg-[#0C0F0D] p-5 text-white lg:h-full lg:overflow-y-auto">
      {onBack && <button type="button" onClick={onBack} className="mb-3 text-[10px] font-bold text-white/35 hover:text-white/65">← Back to series</button>}
      <p className="text-[10px] font-black uppercase tracking-[.2em] text-lime-300">Voiceover</p>
      <h2 className="mt-1 text-xl font-black">{seriesContext?.mode === "series" ? "Tell this episode" : "Tell the story"}</h2>
      <p className="mt-1 text-xs text-white/40">{status}{visualDuration > 0 ? ` · ${visualDuration.toFixed(1)}s visuals` : ""}</p>
      <label className="mt-5 block text-[11px] font-bold text-white/65">Hook</label>
      <textarea value={hook} onChange={(event) => setHook(event.target.value)} onBlur={() => void persistDraft()} rows={2} className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/30 p-3 text-sm outline-none focus:border-lime-300/40" />
      <div className="mt-4 flex items-center justify-between gap-3">
        <label className="block text-[11px] font-bold text-white/65">Narration</label>
        <button type="button" onClick={regeneratePrompt} disabled={busy || scriptBusy || clips.length !== expectedSceneCount} className="inline-flex items-center gap-1.5 rounded-lg border border-lime-300/20 bg-lime-300/[.06] px-2.5 py-1.5 text-[10px] font-black text-lime-200 transition hover:border-lime-300/40 hover:bg-lime-300/10 disabled:cursor-not-allowed disabled:opacity-40">
          <RefreshCw className={`h-3 w-3 ${scriptBusy ? "animate-spin" : ""}`} />
          {scriptBusy ? "Writing…" : narration.trim() ? "Regenerate prompt" : "Generate prompt"}
        </button>
      </div>
      <textarea value={narration} onChange={(event) => setNarration(event.target.value)} onBlur={() => void persistDraft()} rows={7} className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/30 p-3 text-sm leading-6 outline-none focus:border-lime-300/40" />
      <p className={`mt-1 text-right text-[10px] ${(seriesLengthInvalid || words > 130) ? "text-red-300" : "text-white/30"}`}>{words} total words · {seriesContext?.mode === "series" ? "required 100–115" : "ideal 90–115 · max 130"}</p>
      <div className="mt-4 grid grid-cols-[1fr_auto] gap-2"><select value={voiceId} onChange={(event) => { const nextVoiceId = event.target.value; setVoiceId(nextVoiceId); void persistDraft(nextVoiceId); }} className="rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-xs outline-none">{VOICES.map((voice) => <option key={voice.id} value={voice.id}>{voice.label} — {voice.traits.join(", ")}</option>)}</select><button type="button" onClick={preview} className="rounded-xl border border-white/10 px-4 text-xs font-bold text-white/70"><Play className="mr-1 inline h-3.5 w-3.5" />Preview</button></div>
      {error && <p className="mt-3 rounded-xl bg-red-400/10 p-3 text-xs text-red-200">{error}</p>}
      <button type="button" disabled={busy || scriptBusy || !narration.trim() || words > 130 || seriesLengthInvalid} onClick={generate} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-lime-300 px-4 py-3 text-sm font-black text-[#11150D] transition hover:bg-lime-200 disabled:opacity-40"><Volume2 className="h-4 w-4" />{busy ? "Generating…" : "Generate voiceover"}</button>
    </section>
  );
}
