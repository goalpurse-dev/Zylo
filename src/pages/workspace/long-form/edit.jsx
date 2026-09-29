// edit.jsx — Phase 6d-1. The Edit step: a simple CapCut for Stickman videos.
// Left tool tabs, centre preview, right properties, bottom timeline. The
// editor reads and writes the project's EDIT document (src/lib/stickmanEdit.js
// via long-form-edit): versioned, autosaved, undo/redo — and the render worker
// renders exactly that document.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, Loader2, Pause, Play, Redo2, Scissors, Undo2 } from "lucide-react";
import { LongFormActionFooter, LongFormCreationHeader } from "./shared";
import { cachedStickmanProject } from "./StickmanRouteGuard";
import { fetchLongFormProject } from "./project";
import { useOverlayFont } from "./sceneVisuals";
import EditorPreview from "./editor/EditorPreview";
import EditorTimeline from "./editor/EditorTimeline";
import { LeftPanel, RightPanel } from "./editor/EditorPanels";
import MobileEditor from "./editor/MobileEditor";
import { startPublish } from "./publish/publishApi";
import { loadEdit, saveEdit, sceneAction, sceneStatus, splitGenerate, uploadFile } from "./editor/editApi";
import { withEnds, clipMotion, moveCut, splitAt, setClip, newTextItem, updateText, captionPhrases, speechSpans, musicGainAt, setTransition, setAllTransitions, autoMix, deleteClip, mixMotions, setAllMotions, setClipMotion, setIntensity } from "../../../lib/stickmanEdit";

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// Peaks for the voiceover waveform (decoded once in the browser).
async function waveformPeaks(url, buckets = 6000) {
  const buf = await (await fetch(url)).arrayBuffer();
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const audio = await ctx.decodeAudioData(buf);
  const ch = audio.getChannelData(0);
  const step = Math.max(1, Math.floor(ch.length / buckets));
  const out = new Float32Array(buckets);
  let max = 0;
  for (let b = 0; b < buckets; b++) { let m = 0; for (let i = b * step; i < Math.min(ch.length, (b + 1) * step); i += 4) { const v = Math.abs(ch[i]); if (v > m) m = v; } out[b] = m; if (m > max) max = m; }
  ctx.close?.();
  return Array.from(out, (v) => (max ? v / max : 0));
}

export default function LongFormEdit() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  useOverlayFont();
  const cached = cachedStickmanProject(projectId);
  const [project, setProject] = useState(cached?.project ?? null);
  const [meta, setMeta] = useState(null); // words, script, voice, credits, sections, reveals
  const metaRef = useRef(null);
  metaRef.current = meta;
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [hist, setHist] = useState({ past: [], present: null, future: [], key: null, at: 0 });
  const [live, setLive] = useState(null); // a drag in progress (not yet an undo step)
  const doc = live ?? hist.present;
  const docRef = useRef(null);
  docRef.current = hist.present;
  const versionRef = useRef(0);
  const [saveState, setSaveState] = useState("saved");
  const saveStateRef = useRef("saved");
  saveStateRef.current = saveState;
  const [selection, setSelection] = useState(null);
  const [tab, setTab] = useState("Text");
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState(6);
  const [peaks, setPeaks] = useState(null);
  const [busy, setBusy] = useState(null);
  const audioRef = useRef(null);
  const musicRef = useRef(null);
  const centerRef = useRef(null);
  const [previewW, setPreviewW] = useState(null);

  useEffect(() => { document.title = "Edit | Zyvo"; fetchLongFormProject(projectId).then((p) => p && setProject((o) => ({ ...(o ?? {}), ...p }))); }, [projectId]);
  useEffect(() => {
    let alive = true;
    loadEdit(projectId).then((r) => {
      if (!alive) return;
      if (!r.ok) { setError(r.message); return; }
      setMeta({ words: r.words, script: r.script, voice: r.voice, creditsPerScene: r.creditsPerScene, sections: r.sections ?? {}, reveals: r.reveals ?? [], sides: r.sides ?? {} });
      versionRef.current = r.version;
      setHist({ past: [], present: r.doc, future: [], key: null, at: 0 });
      if (r.retimed) setNotice("Your new voiceover is in: the cuts follow its timing and your pictures stay.");
      else if (r.resynced) setNotice(`${r.resynced} scene${r.resynced === 1 ? "" : "s"} now show their newest picture.`);
      if (r.version === 0) saveNow(r.doc); // the first edit is saved at once (a re-timed / re-synced one is saved by the server)
      waveformPeaks(r.doc.audio.url).then((p) => alive && setPeaks(p)).catch(() => {});
    });
    return () => { alive = false; };
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- history + autosave ----
  const commit = useCallback((next, key = null) => {
    if (!next) return;
    setLive(null);
    setHist((h) => {
      if (next === h.present) return h;
      const coalesce = key && h.key === key && Date.now() - h.at < 1200;
      return { past: coalesce ? h.past : [...h.past.slice(-99), h.present], present: next, future: [], key, at: Date.now() };
    });
  }, []);
  const undo = useCallback(() => setHist((h) => (h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future], key: null, at: 0 } : h)), []);
  const redo = useCallback(() => setHist((h) => (h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1), key: null, at: 0 } : h)), []);
  const saving = useRef({ inFlight: false, again: false });
  const saveNow = useCallback(async (d) => {
    if (saving.current.inFlight) { saving.current.again = true; return; }
    saving.current.inFlight = true;
    setSaveState("saving");
    const r = await saveEdit(projectId, d, versionRef.current);
    saving.current.inFlight = false;
    if (r.ok) { versionRef.current = r.version; setSaveState("saved"); }
    else { setSaveState("error"); setNotice(r.message); }
    if (saving.current.again) { saving.current.again = false; saveNow(docRef.current); }
  }, [projectId]);
  // Continue to Publish: the edit is saved first (the render renders the saved
  // version), then the server starts the render, the YouTube text and the
  // thumbnails at once (each only if missing), and Publish shows them filling in.
  const [publishing, setPublishing] = useState(false);
  const goPublish = useCallback(async () => {
    setPublishing(true);
    if (saveStateRef.current !== "saved") await saveNow(docRef.current);
    while (saving.current.inFlight) await new Promise((r) => setTimeout(r, 150));
    await startPublish(projectId);
    navigate(`/long-form/project/${projectId}/publish`, { state: { autopilot: true } });
  }, [projectId, saveNow, navigate]);
  const first = useRef(true);
  useEffect(() => {
    if (!hist.present) return;
    if (first.current) { first.current = false; return; }
    setSaveState("pending");
    const id = setTimeout(() => saveNow(hist.present), 900);
    return () => clearTimeout(id);
  }, [hist.present, saveNow]);

  // ---- derived ----
  const words = meta?.words ?? [];
  const clips = useMemo(() => (doc ? withEnds(doc).map((c) => ({ ...c, motionPath: clipMotion(doc, c) })) : []), [doc]);
  const phrases = useMemo(() => captionPhrases(words, doc?.captions?.edits ?? {}), [words, doc?.captions?.edits]);
  const spans = useMemo(() => speechSpans(words), [words]);
  const selClipIndex = selection?.kind === "clip" ? clips.findIndex((c) => c.id === selection.id) : -1;
  const selText = selection?.kind === "text" ? doc?.texts.find((x) => x.id === selection.id) : null;

  // ---- playback: the voice is the master clock; music follows with its ducking ----
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const a = audioRef.current;
      if (a) { setT(a.currentTime); const m = musicRef.current; if (m && docRef.current?.music?.url) m.volume = musicGainAt(docRef.current.music, spans, a.currentTime * 1000); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, spans]);
  // The voice's volume (Audio tab) — the render applies the same volume.
  useEffect(() => { if (audioRef.current) audioRef.current.volume = Math.max(0, Math.min(1, Number(doc?.audio?.volume ?? 1))); }, [doc?.audio?.volume]);
  const seek = useCallback((ms) => {
    const s = Math.max(0, ms / 1000);
    if (audioRef.current) audioRef.current.currentTime = s;
    const m = musicRef.current;
    if (m && m.duration) m.currentTime = s % m.duration;
    setT(s);
  }, []);
  const play = useCallback(() => { const a = audioRef.current; if (!a) return; a.play().catch(() => {}); const m = musicRef.current; if (m && docRef.current?.music?.url) { if (m.duration) m.currentTime = a.currentTime % m.duration; m.play().catch(() => {}); } }, []);
  const pause = useCallback(() => { audioRef.current?.pause(); musicRef.current?.pause(); }, []);
  const toggle = useCallback(() => (audioRef.current?.paused ? play() : pause()), [play, pause]);

  // ---- actions ----
  const onSplit = useCallback(() => {
    const r = splitAt(docRef.current, t * 1000, words);
    if (r.error) { setNotice(r.error); return; }
    commit(r.doc);
    setSelection({ kind: "clip", id: r.clipId });
    setNotice("Scene split. The new half keeps the picture until you generate its own.");
  }, [t, words, commit]);
  const pollImage = useCallback(async (clipId, args, patch = {}) => {
    for (let i = 0; i < 120; i++) {
      await new Promise((res) => setTimeout(res, 4000));
      const s = await sceneStatus(projectId, args);
      if (s.ok && s.status === "ready" && s.imageUrl) { commit(setClip(docRef.current, clipId, { image: s.imageUrl, needsImage: false, ...(args.beatSequence != null ? { sceneId: s.sceneId, imageVersion: s.version } : {}), ...patch })); setBusy(null); setNotice("The new picture is in."); return; }
      if (s.ok && s.status === "failed") { setBusy(null); setNotice("That picture couldn't be drawn. Try again (it's free)."); return; }
    }
    setBusy(null);
  }, [projectId, commit]);
  const actions = {
    onMoveCut: (index, ms) => commit(moveCut(docRef.current, index, ms, words)),
    onClip: (id, patch) => commit(setClip(docRef.current, id, patch)),
    onRegenerate: async (clip) => { setBusy(clip.id); const r = await sceneAction(projectId, "regenerate", { sceneNumber: clip.beatSequence }); if (!r.ok) { setBusy(null); setNotice(r.message); return; } setNotice("Drawing a new picture…"); pollImage(clip.id, { beatSequence: clip.beatSequence }); },
    onDescribe: async (clip, description) => { setBusy(clip.id); const r = await sceneAction(projectId, "describe", { sceneNumber: clip.beatSequence, description }); if (!r.ok) { setBusy(null); setNotice(r.message); return; } setNotice("Drawing your description…"); pollImage(clip.id, { beatSequence: clip.beatSequence }); },
    onGenerateSplit: async (clip) => { setBusy(clip.id); const r = await splitGenerate(projectId, { beatSequence: clip.beatSequence, narration: clip.narration }); if (!r.ok) { setBusy(null); setNotice(r.message); return; } setNotice("Drawing the new scene…"); pollImage(clip.id, { sceneId: r.sceneId }, { sceneId: r.sceneId }); },
    onUploadImage: async (clip, file) => { setBusy(`up-${clip.id}`); const r = await uploadFile(projectId, "image", file); setBusy(null); if (!r.ok) { setNotice(r.message); return; } commit(setClip(docRef.current, clip.id, { image: r.url, uploaded: true, needsImage: false })); },
    onSplit,
    onText: (id, patch, key) => commit(updateText(docRef.current, id, patch), key ? `${key}-${id}` : null),
    onDeleteText: (id) => { commit({ ...docRef.current, texts: docRef.current.texts.filter((x) => x.id !== id) }); setSelection(null); },
    onCaptions: (patch) => commit({ ...docRef.current, captions: { ...docRef.current.captions, ...patch } }),
    onCaptionWord: (i, text) => commit({ ...docRef.current, captions: { ...docRef.current.captions, edits: { ...(docRef.current.captions.edits ?? {}), [i]: text } } }),
    onMusic: (patch, key) => commit({ ...docRef.current, music: { ...docRef.current.music, ...patch } }, key ? `music-${key}` : null),
    onTransitionCut: (clipId, kind) => commit(setTransition(docRef.current, clipId, kind)),
    onApplyAll: (kind) => { if (!kind) return; commit(setAllTransitions(docRef.current, kind)); setNotice("Transition set on every cut."); },
    onAutoMix: () => { const next = autoMix(docRef.current, metaRef.current?.sections ?? {}, metaRef.current?.reveals ?? []); commit(next); setNotice(`Auto mix: ${Object.values(next.transitions).filter((k) => k !== "cut").length} transitions on section changes and reveals.`); },
    onDeleteClip: (id) => { commit(deleteClip(docRef.current, id)); setSelection(null); },
    commitDoc: (d) => commit(d),
    // Camera: Mix is seeded by the project id (preview == render); a scene's own pick overrides it.
    onMotionAll: (mode) => { const d = docRef.current; const mixArgs = { seed: projectId, reveals: metaRef.current?.reveals ?? [], sides: metaRef.current?.sides ?? {} };
      commit(mode === "mix" ? mixMotions({ ...d, clips: d.clips.map((c) => ({ ...c, motionManual: false })) }, mixArgs) : setAllMotions(d, mode)); },
    onClipMotion: (id, mode) => { const d = docRef.current;
      if (mode !== "mix") { commit(setClipMotion(d, id, mode)); return; }
      const auto = mixMotions({ ...d, clips: d.clips.map((c) => (c.id === id ? { ...c, motionManual: false } : c)) }, { seed: projectId, reveals: metaRef.current?.reveals ?? [], sides: metaRef.current?.sides ?? {} }).clips.find((c) => c.id === id);
      commit(setClip(d, id, { motion: auto.motion, motionSpeed: auto.motionSpeed, motionManual: false })); },
    onIntensity: (k) => commit(setIntensity(docRef.current, k)),
    onVoiceVolume: (v) => commit({ ...docRef.current, audio: { ...docRef.current.audio, volume: v } }, "voice-volume"),
  };
  const onAddText = (style) => { const item = newTextItem(style, t * 1000); commit({ ...docRef.current, texts: [...docRef.current.texts, item] }); setSelection({ kind: "text", id: item.id }); };
  const onMoveText = (id, pos, final) => { const next = updateText(docRef.current, id, pos); if (final) commit(next); else setLive(next); };
  const onUploadMusic = async (file) => { setBusy("music"); const r = await uploadFile(projectId, "music", file, { rightsConfirmed: true }); setBusy(null); if (!r.ok) { setNotice(r.message); return; } actions.onMusic({ trackId: "upload", url: r.url, name: r.name }); setSelection({ kind: "music" }); };

  // ---- keyboard: space, J/K/L, S split, arrows, undo/redo, delete ----
  useEffect(() => {
    const onKey = (e) => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName)) return;
      const k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if ((e.metaKey || e.ctrlKey) && k === "y") { e.preventDefault(); redo(); return; }
      if (k === " ") { e.preventDefault(); toggle(); }
      else if (k === "k") pause();
      else if (k === "l") play();
      else if (k === "j") seek(Math.max(0, t * 1000 - 5000));
      else if (k === "s") onSplit();
      else if (k === "arrowleft") seek(t * 1000 - (e.shiftKey ? 5000 : 1000 / 30));
      else if (k === "arrowright") seek(t * 1000 + (e.shiftKey ? 5000 : 1000 / 30));
      else if ((k === "delete" || k === "backspace") && selection?.kind === "text") actions.onDeleteText(selection.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // The editor fills the screen from its top down to the sticky footer (no
  // page scroll at 1366x768); the timeline row is 180-360 px, drag to resize.
  const gridRef = useRef(null);
  const [editorH, setEditorH] = useState(null);
  const [timelinePref, setTimelinePref] = useState(() => { try { return Number(localStorage.getItem("zyvo_edit_timeline_h")) || 240; } catch { return 240; } });
  useLayoutEffect(() => {
    const fit = () => {
      const el = gridRef.current;
      if (!el) return;
      const sc = document.getElementById("workspace-scroll");
      const top = el.getBoundingClientRect().top + (sc ? sc.scrollTop : window.scrollY);
      const footer = document.querySelector("[data-long-form-footer]");
      const bottom = footer ? footer.getBoundingClientRect().top + (sc ? sc.scrollTop : window.scrollY) : window.innerHeight;
      setEditorH(Math.max(430, Math.round(bottom - top - 10)));
    };
    fit();
    const id = setTimeout(fit, 400); // after the footer mounts
    window.addEventListener("resize", fit);
    return () => { clearTimeout(id); window.removeEventListener("resize", fit); };
  }, [doc != null]); // eslint-disable-line react-hooks/exhaustive-deps
  const timelineH = Math.round(Math.max(180, Math.min(360, timelinePref, (editorH ?? 520) - 210)));
  const startTimelineResize = (e) => {
    e.preventDefault();
    const y0 = e.clientY, h0 = timelineH;
    let last = h0;
    const move = (ev) => { last = Math.max(180, Math.min(360, h0 - (ev.clientY - y0))); setTimelinePref(last); };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); try { localStorage.setItem("zyvo_edit_timeline_h", String(Math.round(last))); } catch { /* optional */ } };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // The preview fits the centre area (16:9, never cropped).
  useEffect(() => {
    const el = centerRef.current;
    if (!el) return;
    const fit = () => setPreviewW(Math.max(240, Math.min(el.clientWidth - 16, ((el.clientHeight - 56) * 16) / 9)));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [doc != null]); // eslint-disable-line react-hooks/exhaustive-deps

  // Phones (< 768 px) get their own CapCut-style layout; desktop is unchanged.
  const [mobile, setMobile] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches);
  useEffect(() => { const mq = window.matchMedia("(max-width: 767px)"); const on = () => setMobile(mq.matches); mq.addEventListener("change", on); return () => mq.removeEventListener("change", on); }, []);

  useEffect(() => { if (!notice) return; const id = setTimeout(() => setNotice(null), 5000); return () => clearTimeout(id); }, [notice]);

  const footer = <LongFormActionFooter secondaryLabel="Back to Scenes" onSecondary={() => navigate(`/long-form/project/${projectId}/scenes`)} primaryLabel={publishing ? "Starting…" : "Continue to Publish"} onPrimary={goPublish} primaryDisabled={publishing} maxWidthClassName="max-w-[880px]" />;
  if (error || !doc) return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 pb-32 lg:px-8">
      <LongFormCreationHeader current="edit" project={project} stickman />
      <div className="mt-10 flex items-center justify-center gap-2 text-white/60" data-testid="edit-loading">{error ? <span>{error}</span> : <><Loader2 className="h-5 w-5 animate-spin" /> Opening the editor…</>}</div>
      {footer}
    </div>
  );

  const media = (
    <>
      {notice && <div className="fixed left-1/2 z-[90] max-w-[92vw] -translate-x-1/2 rounded-full bg-black/85 px-4 py-2 text-center text-[12.5px] text-white shadow-lg" style={{ bottom: mobile ? "calc(160px + env(safe-area-inset-bottom))" : "6rem" }} data-testid="edit-notice">{notice}</div>}
      <audio ref={audioRef} src={doc.audio.url} preload="auto" className="hidden" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onTimeUpdate={(e) => { if (!playing) setT(e.currentTarget.currentTime); }} />
      {doc.music?.url && <audio ref={musicRef} src={doc.music.url} preload="auto" loop className="hidden" />}
    </>
  );
  if (mobile) return (
    <>
      <MobileEditor doc={doc} clips={clips} t={t} playing={playing} toggle={toggle} seek={seek} undo={undo} redo={redo} canUndo={hist.past.length > 0} canRedo={hist.future.length > 0}
        phrases={phrases} peaks={peaks} selection={selection} setSelection={setSelection} actions={actions} meta={meta} busy={busy} saveState={saveState}
        onAddText={onAddText} onUploadMusic={onUploadMusic} onMoveText={onMoveText} onChangeVoice={() => navigate(`/long-form/project/${projectId}/narration`)}
        onBack={() => navigate(`/long-form/project/${projectId}/scenes`)} onPublish={goPublish} />
      {media}
    </>
  );

  return (
    <div className="px-3 pb-28 pt-3 lg:px-4" data-testid="edit-page">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1"><LongFormCreationHeader current="edit" project={project} stickman /></div>
      </div>
      {/* Named areas in inline styles: [tools | preview | properties] on top, the
          timeline one full-width row below — no utility class decides the layout. */}
      <div ref={gridRef} data-testid="edit-grid" className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#121416]" style={{ display: "grid", height: editorH ?? 520, gridTemplateAreas: '"tools preview props" "timeline timeline timeline"', gridTemplateRows: `minmax(0,1fr) ${timelineH}px`, gridTemplateColumns: "clamp(200px, 17vw, 260px) minmax(0,1fr) clamp(220px, 19vw, 290px)" }}>
        <div className="min-h-0 min-w-0 overflow-hidden border-r border-white/[0.06]" style={{ gridArea: "tools" }}>
          <LeftPanel tab={tab} setTab={setTab} doc={doc} clips={clips} t={t} busy={busy} onAddText={onAddText} onUploadMusic={onUploadMusic} {...actions} />
        </div>
        <div ref={centerRef} className="flex min-h-0 min-w-0 flex-col items-center justify-center gap-2 p-2" style={{ gridArea: "preview" }}>
          <EditorPreview doc={doc} clips={clips} t={t} phrases={phrases} selectedTextId={selText?.id} maxWidth={previewW ?? undefined}
            onSelectText={(id) => setSelection(id ? { kind: "text", id } : null)} onMoveText={onMoveText} />
          <div className="flex items-center gap-2 text-[12px] text-white/60">
            <button type="button" aria-label="Undo" data-testid="undo" disabled={!hist.past.length} onClick={undo} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/10 disabled:opacity-30"><Undo2 className="h-4 w-4" /></button>
            <button type="button" aria-label="Redo" data-testid="redo" disabled={!hist.future.length} onClick={redo} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/10 disabled:opacity-30"><Redo2 className="h-4 w-4" /></button>
            <button type="button" aria-label={playing ? "Pause" : "Play"} data-testid="edit-play" onClick={toggle} className="grid h-9 w-9 place-items-center rounded-full bg-lime-300 text-[#11150D]">{playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-[1px]" />}</button>
            <span className="w-[92px] tabular-nums">{fmt(t)} / {fmt(doc.audio.durationMs / 1000)}</span>
            <button type="button" aria-label="Split at playhead" onClick={onSplit} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/10"><Scissors className="h-4 w-4" /></button>
            <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-white/40" data-testid="save-state">{saveState === "saved" ? <><Check className="h-3 w-3" /> Saved</> : saveState === "error" ? "Not saved" : <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>}</span>
          </div>
        </div>
        <div className="min-h-0 min-w-0 overflow-y-auto border-l border-white/[0.06]" style={{ gridArea: "props" }}>
          <RightPanel doc={doc} clips={clips} selection={selection} clip={clips[selClipIndex]} clipIndex={selClipIndex} text={selText} t={t} phrases={phrases} words={words}
            creditsPerScene={meta?.creditsPerScene} busy={busy} {...actions} />
        </div>
        <div className="relative min-h-0 min-w-0" style={{ gridArea: "timeline" }}>
          <div data-testid="timeline-resize" title="Drag to resize the timeline" onPointerDown={startTimelineResize} className="absolute inset-x-0 -top-1 z-40 h-2 cursor-ns-resize hover:bg-lime-300/30" />
          <EditorTimeline doc={doc} clips={clips} words={words} phrases={phrases} peaks={peaks} t={t} onSeek={seek} zoom={zoom} setZoom={setZoom}
            selection={selection} onSelect={setSelection} onMoveCut={actions.onMoveCut} onUpdateText={(id, patch) => actions.onText(id, patch)} musicName={doc.music?.name} playing={playing} />
        </div>
      </div>
      {media}
      {footer}
    </div>
  );
}
