// EditorPanels.jsx — Phase 6d-1. Left tool tabs (Text · Captions · Audio ·
// Motion) and the right properties panel for the selection (a scene, a cut,
// a text, the captions, the music, or the whole video). Script and Voice are
// no longer editor tabs (the change-voice flow itself is unchanged).
import { useMemo, useState } from "react";
import { ImageUp, Loader2, Pencil, RefreshCw, Scissors, Trash2, Upload, Wand2 } from "lucide-react";
import { TEXT_STYLES, TEXT_STYLE_LABELS, CAPTION_STYLES, CAPTION_STYLE_LABELS, captionAt, transitionInto, TRANSITIONS } from "../../../../lib/stickmanEdit";
import { thumbOf } from "./editApi";
import TransitionPicker, { MotionPicker } from "./TransitionPicker";

// Commercially licensed tracks we may ship with (none yet — users upload their own).
export const MUSIC_LIBRARY = [];

const Btn = ({ children, className = "", ...p }) => <button type="button" className={`inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[12px] font-semibold text-white/80 transition hover:bg-white/[0.08] disabled:opacity-40 ${className}`} {...p}>{children}</button>;
const Lime = ({ children, className = "", ...p }) => <button type="button" className={`inline-flex items-center justify-center gap-1.5 rounded-lg bg-lime-300 px-3 py-2 text-[12.5px] font-bold text-[#11150D] transition hover:bg-lime-200 disabled:opacity-50 ${className}`} {...p}>{children}</button>;
const H = ({ children }) => <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-white/40">{children}</h3>;
const sec = (ms) => (ms / 1000).toFixed(2);
const Slider = ({ label, value, onChange, testid }) => (
  <label className="grid gap-1 text-[11.5px] text-white/55">
    <span className="flex justify-between"><span>{label}</span><span className="tabular-nums text-white/40">{Math.round(value * 100)}%</span></span>
    <input data-testid={testid} type="range" min={0} max={1} step={0.01} value={value} onChange={(e) => onChange(Number(e.target.value))} className="accent-lime-300" />
  </label>
);

export const LEFT_TABS = ["Text", "Captions", "Audio", "Motion"];

// The clip under the playhead and the next one (real thumbnails for the transition tiles).
export const pairAt = (clips, t) => { let i = 0; for (let j = 0; j < clips.length; j++) if (clips[j].startMs <= t * 1000) i = j; return [clips[i], clips[Math.min(clips.length - 1, i + 1)]]; };

// bare: just the tool's content (the mobile bottom sheets), no tab bar.
// The tab bar stays put; the body is its own scroll container.
export function LeftPanel({ tab, setTab, bare = false, doc, clips = [], t = 0, onAddText, onCaptions, onMusic, onUploadMusic, onVoiceVolume, onMotionAll, onIntensity, onApplyAll, onAutoMix, busy }) {
  const [rights, setRights] = useState(false);
  const [a, b] = pairAt(clips, t);
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden" data-testid="edit-left">
      {!bare && <div className="z-10 flex shrink-0 gap-1 border-b border-white/[0.06] bg-[#121416] p-1.5">
        {LEFT_TABS.map((x) => <button key={x} type="button" data-testid={`tab-${x.toLowerCase()}`} onClick={() => setTab(x)} className={`flex-1 rounded-md px-1 py-1.5 text-[11.5px] font-semibold ${tab === x ? "bg-lime-300/15 text-lime-200" : "text-white/50 hover:text-white/80"}`}>{x}</button>)}
      </div>}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 text-[12.5px] text-white/75" data-testid="edit-left-body">
        {tab === "Text" && (
          <div className="grid gap-2">
            <H>Add text at the playhead</H>
            {TEXT_STYLES.map((st) => (
              <button key={st} type="button" data-testid={`add-text-${st}`} onClick={() => onAddText(st)} className="min-h-[44px] rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-left hover:border-lime-300/40">
                <span style={{ fontFamily: "'Lilita One', system-ui", color: st === "QUESTION" ? "#fff" : "#FFD21F", WebkitTextStroke: "1px #000" }} className="text-[18px]">{{ HEADLINE: "HEADLINE", BIG_STAT: "300,000", QUESTION: "BUT WHY?", CALLOUT: "LABEL →" }[st]}</span>
                <span className="block text-[11px] text-white/45">{TEXT_STYLE_LABELS[st]}</span>
              </button>
            ))}
          </div>
        )}
        {tab === "Captions" && (
          <div className="grid gap-3">
            <label className="flex min-h-[44px] items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2.5">
              <span className="font-semibold">Captions</span>
              <input data-testid="captions-toggle" type="checkbox" checked={!!doc.captions?.enabled} onChange={(e) => onCaptions({ enabled: e.target.checked })} className="h-4 w-4 accent-lime-300" />
            </label>
            <H>Style</H>
            {CAPTION_STYLES.map((st) => <Btn key={st} data-testid={`caption-style-${st}`} onClick={() => onCaptions({ style: st, enabled: true })} className={doc.captions?.style === st ? "border-lime-300/60 text-lime-200" : ""}>{CAPTION_STYLE_LABELS[st]}</Btn>)}
            <p className="text-[11.5px] text-white/40">Built from the voiceover's word timings. Select the captions track to fix a word.</p>
          </div>
        )}
        {tab === "Audio" && (
          <div className="grid gap-3" data-testid="audio-panel">
            <H>Volume</H>
            <Slider testid="voice-volume" label="Voice" value={Number(doc.audio?.volume ?? 1)} onChange={onVoiceVolume} />
            <Slider testid="music-volume" label="Music" value={Number(doc.music?.volume ?? 0.35)} onChange={(v) => onMusic({ volume: v }, "volume")} />
            <label className="flex min-h-[44px] items-center justify-between gap-2 text-[12px] text-white/70"><span>Lower the music while the voice speaks (ducking)</span><input data-testid="music-duck" type="checkbox" checked={doc.music?.duck !== false} onChange={(e) => onMusic({ duck: e.target.checked })} className="h-4 w-4 accent-lime-300" /></label>
            <H>Music</H>
            {MUSIC_LIBRARY.length ? MUSIC_LIBRARY.map((m) => <Btn key={m.id} onClick={() => onMusic({ trackId: m.id, url: m.url, name: m.name })}>{m.name}</Btn>)
              : <p className="rounded-lg border border-white/10 bg-black/20 p-3 text-[12px] text-white/50">No licensed tracks yet — the library is coming. Upload your own music below.</p>}
            <label className="flex items-start gap-2 text-[11.5px] text-white/60"><input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} className="mt-0.5 accent-lime-300" />I own this music or have a licence to use it in my videos.</label>
            <label className={`inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[12px] font-semibold ${rights ? "bg-white/[0.06] text-white/80" : "pointer-events-none opacity-40"}`}>
              {busy === "music" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Upload MP3 / M4A / WAV
              <input type="file" accept="audio/*" className="hidden" onChange={(e) => e.target.files?.[0] && onUploadMusic(e.target.files[0])} />
            </label>
            {doc.music?.url && <div className="flex items-center justify-between gap-2 text-[11.5px] text-lime-200/80"><span className="truncate">Music: {doc.music.name ?? "Music"}</span><Btn onClick={() => onMusic({ trackId: null, url: null, name: null })} className="text-red-200"><Trash2 className="h-3.5 w-3.5" /></Btn></div>}
          </div>
        )}
        {tab === "Motion" && (
          <div className="grid gap-4" data-testid="motion-panel">
            <div className="grid gap-2">
              <H>Camera · all scenes</H>
              <MotionPicker value={doc.motion?.mode ?? null} image={a?.image} onPick={onMotionAll} />
              <div className="grid grid-cols-2 gap-1">
                {["subtle", "normal"].map((k) => <Btn key={k} data-testid={`intensity-${k}`} onClick={() => onIntensity(k)} className={(doc.motion?.intensity ?? "normal") === k ? "border-lime-300/60 text-lime-200" : ""}>{k === "subtle" ? "Subtle" : "Normal"}</Btn>)}
              </div>
              <p className="text-[11px] text-white/40">Select a scene on the timeline to give just that one its own move.</p>
            </div>
            <div className="grid gap-2">
              <H>Transitions · all cuts</H>
              <TransitionPicker scope="all" value={null} a={a?.image} b={b?.image} onPick={onApplyAll} onApplyAll={onApplyAll} onAutoMix={onAutoMix} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function RightPanel({ doc, clips = [], selection, clip, clipIndex, text, t, phrases, words, creditsPerScene, busy, onClip, onRegenerate, onDescribe, onUploadImage, onSplit, onGenerateSplit, onText, onDeleteText, onCaptions, onCaptionWord, onMusic, onTransitionCut, onApplyAll, onAutoMix, onClipMotion }) {
  const [desc, setDesc] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const ms = t * 1000;
  const nearby = useMemo(() => {
    if (selection?.kind !== "captions") return [];
    const i = Math.max(0, phrases.findIndex((p) => p.endMs > ms));
    return phrases.slice(Math.max(0, i - 1), i + 4);
  }, [selection, phrases, Math.floor(ms / 400)]); // eslint-disable-line react-hooks/exhaustive-deps
  void words; void captionAt; void TRANSITIONS;

  if (selection?.kind === "cut") {
    const i = clips.findIndex((c) => c.id === selection.id);
    const into = clips[i];
    if (into && i > 0) return (
      <div className="grid gap-3 p-3 text-[12.5px] text-white/75" data-testid="props-cut">
        <H>Transition · scene {i} → {i + 1}</H>
        <TransitionPicker value={transitionInto(doc, into, i)} a={clips[i - 1]?.image} b={into.image} onPick={(k) => onTransitionCut(into.id, k)} onApplyAll={onApplyAll} onAutoMix={onAutoMix} />
      </div>
    );
  }

  if (selection?.kind === "clip" && clip) return (
    <div className="grid gap-3 p-3 text-[12.5px] text-white/75" data-testid="props-clip">
      <H>Scene {clipIndex + 1}</H>
      <div className="aspect-video w-full overflow-hidden rounded-lg bg-black"><img src={thumbOf(clip.image, 640, clip.imageVersion)} alt="" className="h-full w-full object-contain" /></div>
      <p className="rounded-md bg-white/[0.03] p-2 text-[12px] italic leading-relaxed text-white/65">“{clip.narration}”</p>
      <div>
        <H>Camera move · this scene</H>
        <MotionPicker testid="scene-motion" value={clip.motionManual ? clip.motion : "mix"} image={clip.image} onPick={(m) => onClipMotion(clip.id, m)} />
      </div>
      {clip.needsImage ? (
        <Lime data-testid="generate-split" disabled={busy === clip.id} onClick={() => onGenerateSplit(clip)}>{busy === clip.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Generate this scene · {creditsPerScene} credits</Lime>
      ) : (
        <Lime data-testid="regenerate-scene" disabled={busy === clip.id || !clip.beatSequence || clip.uploaded} onClick={() => onRegenerate(clip)}>{busy === clip.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Regenerate · {creditsPerScene} credits</Lime>
      )}
      {!clip.needsImage && !clip.uploaded && (editingDesc ? (
        <div className="grid gap-1.5">
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} maxLength={400} placeholder="Describe what you want to see…" className="rounded-lg border border-white/10 bg-black/30 p-2 text-[12.5px] text-white outline-none focus:border-lime-300/50" />
          <div className="flex gap-1.5"><Lime disabled={desc.trim().length < 8} onClick={() => { onDescribe(clip, desc); setEditingDesc(false); }}>Draw it · {creditsPerScene} credits</Lime><Btn onClick={() => setEditingDesc(false)}>Cancel</Btn></div>
        </div>
      ) : <Btn onClick={() => { setDesc(""); setEditingDesc(true); }}><Pencil className="h-3.5 w-3.5" /> Edit description</Btn>)}
      <label className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[12px] font-semibold text-white/80 hover:bg-white/[0.08]">
        {busy === `up-${clip.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageUp className="h-3.5 w-3.5" />} Upload my own image
        <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && onUploadImage(clip, e.target.files[0])} />
      </label>
      <Btn data-testid="split-button" onClick={onSplit}><Scissors className="h-3.5 w-3.5" /> Split at playhead</Btn>
      <p className="text-[11px] text-white/35">{sec(clip.startMs)}s – {sec(clip.endMs)}s · drag the line between scenes on the timeline to move a cut.</p>
    </div>
  );

  if (selection?.kind === "text" && text) return (
    <div className="grid gap-3 p-3 text-[12.5px] text-white/75" data-testid="props-text">
      <H>Text</H>
      <textarea data-testid="text-input" value={text.text} onChange={(e) => onText(text.id, { text: e.target.value.toUpperCase() }, "typing")} rows={2} className="rounded-lg border border-white/10 bg-black/30 p-2 text-[14px] font-bold text-white outline-none focus:border-lime-300/50" />
      <div className="grid grid-cols-2 gap-1">{TEXT_STYLES.map((s) => <Btn key={s} data-testid={`text-style-${s}`} onClick={() => onText(text.id, { style: s })} className={text.style === s ? "border-lime-300/60 text-lime-200" : ""}>{TEXT_STYLE_LABELS[s]}</Btn>)}</div>
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1 text-[11px] text-white/45">In (s)<input type="number" step="0.1" value={sec(text.startMs)} onChange={(e) => onText(text.id, { startMs: Math.max(0, Math.round(Number(e.target.value) * 1000)) })} className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[12.5px] text-white" /></label>
        <label className="grid gap-1 text-[11px] text-white/45">Out (s)<input type="number" step="0.1" value={sec(text.endMs)} onChange={(e) => onText(text.id, { endMs: Math.round(Number(e.target.value) * 1000) })} className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[12.5px] text-white" /></label>
      </div>
      <div>
        <H>Position</H>
        <div className="grid grid-cols-3 gap-1">
          {[["Top", 180], ["Middle", 540], ["Bottom", 860]].map(([l, y]) => <Btn key={l} onClick={() => onText(text.id, { y, ...(text.label ? {} : {}) })}>{l}</Btn>)}
          {[["Left", 480], ["Centre", 960], ["Right", 1440]].map(([l, x]) => <Btn key={l} onClick={() => onText(text.id, { x })}>{l}</Btn>)}
        </div>
        <p className="mt-1 text-[11px] text-white/35">Or drag the words in the preview.</p>
      </div>
      <label className="grid gap-1 text-[11px] text-white/45">Size<input type="range" min={48} max={320} value={text.scale} onChange={(e) => onText(text.id, { scale: Number(e.target.value) }, "size")} className="accent-lime-300" /></label>
      <Btn data-testid="delete-text" onClick={() => onDeleteText(text.id)} className="text-red-200"><Trash2 className="h-3.5 w-3.5" /> Delete text</Btn>
    </div>
  );

  if (selection?.kind === "captions") return (
    <div className="grid gap-3 p-3 text-[12.5px] text-white/75" data-testid="props-captions">
      <H>Captions</H>
      <label className="flex items-center justify-between"><span>Show captions</span><input type="checkbox" checked={!!doc.captions?.enabled} onChange={(e) => onCaptions({ enabled: e.target.checked })} className="h-4 w-4 accent-lime-300" /></label>
      <div className="grid gap-1">{CAPTION_STYLES.map((s) => <Btn key={s} onClick={() => onCaptions({ style: s })} className={doc.captions?.style === s ? "border-lime-300/60 text-lime-200" : ""}>{CAPTION_STYLE_LABELS[s]}</Btn>)}</div>
      <H>Fix a word (near the playhead)</H>
      {nearby.map((p, k) => (
        <div key={k} className="flex flex-wrap gap-1">
          {p.words.map((w) => <input key={w.i} data-testid="caption-word" defaultValue={w.text} onBlur={(e) => e.target.value !== w.text && onCaptionWord(w.i, e.target.value)} className="w-[88px] rounded border border-white/10 bg-black/30 px-1.5 py-0.5 text-[12px] text-white" />)}
        </div>
      ))}
    </div>
  );

  if (selection?.kind === "music" && doc.music?.url) return (
    <div className="grid gap-3 p-3 text-[12.5px] text-white/75" data-testid="props-music">
      <H>Music</H>
      <p className="font-semibold text-white">{doc.music.name ?? "Music"}</p>
      <label className="grid gap-1 text-[11px] text-white/45">Volume<input type="range" min={0} max={1} step={0.01} value={doc.music.volume ?? 0.35} onChange={(e) => onMusic({ volume: Number(e.target.value) }, "volume")} className="accent-lime-300" /></label>
      <label className="flex items-center justify-between"><span>Lower under the voice (auto-duck)</span><input type="checkbox" checked={doc.music.duck !== false} onChange={(e) => onMusic({ duck: e.target.checked })} className="h-4 w-4 accent-lime-300" /></label>
      <Btn onClick={() => onMusic({ trackId: null, url: null, name: null })} className="text-red-200"><Trash2 className="h-3.5 w-3.5" /> Remove music</Btn>
    </div>
  );

  return (
    <div className="grid gap-3 p-3 text-[12.5px] text-white/75" data-testid="props-video">
      <H>Video</H>
      <p className="text-white/55">{doc.clips.length} scenes · {doc.texts.length} texts · captions {doc.captions?.enabled ? "on" : "off"}</p>
      <p className="text-[11px] text-white/45">Camera: {doc.motion?.mode === "mix" ? "Mix" : doc.motion?.mode ?? "per scene"} · {Object.values(doc.transitions ?? {}).filter((k) => k !== "cut").length} transitions. Set both in the Motion tab.</p>
      <p className="text-[11px] text-white/35">Select a scene, a cut, a text, the captions or the music on the timeline to edit it.</p>
    </div>
  );
}
