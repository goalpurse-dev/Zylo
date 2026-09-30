// VoiceLibraryDialog.jsx — Phase 6b. The narration voice library: the
// curated catalog (src/lib/voiceCatalog.js) with a fixed ~15 s sample per
// voice, filters (gender / tone / accent) + search, and "Recommended for this
// niche" badges. Used by Step 1 (Create page, "6 · Voice") and by the Voice
// step's "Change voice" (which passes costNote — the regeneration cost).
import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { Check, Pause, Play, Search, Sparkles, X } from "lucide-react";
import { VOICE_CATALOG, VOICE_TONES, filterVoices, isRecommendedForNiche } from "../../../lib/voiceCatalog";

const GENDERS = [{ id: "all", label: "Any" }, { id: "female", label: "Female" }, { id: "male", label: "Male" }, { id: "neutral", label: "Neutral" }];
const ACCENTS = ["all", ...Array.from(new Set(VOICE_CATALOG.map((v) => v.accent)))];
const cap = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-300 ${
        active ? "border-lime-300/40 bg-lime-300 text-[#11150D]" : "border-white/10 bg-white/[0.03] text-white/55 hover:border-white/25"
      }`}
    >
      {children}
    </button>
  );
}

// One shared <audio> for every sample: starting one stops the other.
export function useVoiceSamplePlayer() {
  const audioRef = useRef(null);
  const [playingId, setPlayingId] = useState(null);
  useEffect(() => () => audioRef.current?.pause(), []);
  const stop = () => { audioRef.current?.pause(); setPlayingId(null); };
  const toggle = (voice) => {
    if (playingId === voice.voiceId) return stop();
    audioRef.current?.pause();
    const a = new Audio(voice.sampleUrl);
    audioRef.current = a;
    a.onended = () => setPlayingId(null);
    a.play().then(() => setPlayingId(voice.voiceId)).catch(() => setPlayingId(null));
  };
  return { playingId, toggle, stop };
}

export function SampleButton({ voice, playingId, onToggle, size = "md" }) {
  const playing = playingId === voice.voiceId;
  const dim = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle(voice); }}
      aria-label={playing ? `Stop ${voice.name} sample` : `Play ${voice.name} sample`}
      className={`flex ${dim} shrink-0 items-center justify-center rounded-full border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-300 ${
        playing ? "border-lime-300 bg-lime-300 text-[#11150D]" : "border-white/15 bg-white/[0.05] text-white hover:border-lime-300/50"
      }`}
    >
      {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-[1px]" />}
    </button>
  );
}

export default function VoiceLibraryDialog({ open, onClose, onSelect, currentVoiceId = null, niche = null, costNote = null, selectLabel = "Use this voice" }) {
  const [query, setQuery] = useState("");
  const [gender, setGender] = useState("all");
  const [tone, setTone] = useState("all");
  const [accent, setAccent] = useState("all");
  const player = useVoiceSamplePlayer();

  const voices = useMemo(() => {
    const list = filterVoices({ gender, tone, accent, query });
    // Recommended for this niche first; otherwise catalog order.
    return [...list].sort((a, b) => Number(isRecommendedForNiche(b, niche)) - Number(isRecommendedForNiche(a, niche)));
  }, [gender, tone, accent, query, niche]);

  function close() {
    player.stop();
    onClose();
  }

  return (
    <Dialog open={open} onClose={close} className="relative z-[110]">
      <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-end justify-center sm:items-center sm:p-5">
        <DialogPanel data-testid="voice-library" className="flex h-[92vh] w-full max-w-3xl flex-col overflow-hidden bg-[#101414] text-white sm:h-[85vh] sm:rounded-2xl sm:border sm:border-white/15">
          <header className="shrink-0 border-b border-white/10 p-4 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <DialogTitle className="text-lg font-bold">Choose a voice</DialogTitle>
                <p className="mt-0.5 text-[12px] text-white/45">
                  {VOICE_CATALOG.length} narration voices · press ▶ to hear each one read the same line
                  {costNote ? <span className="text-amber-200/80"> · {costNote}</span> : null}
                </p>
              </div>
              <button type="button" aria-label="Close" onClick={close} className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-300">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search voices — e.g. warm, british, deep…"
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-9 pr-3 text-[13.5px] text-white outline-none placeholder:text-white/30 focus:border-lime-300/40"
              />
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                {GENDERS.map((g) => <Chip key={g.id} active={gender === g.id} onClick={() => setGender(g.id)}>{g.label}</Chip>)}
                <span className="mx-1 w-px shrink-0 bg-white/10" />
                {ACCENTS.map((a) => <Chip key={a} active={accent === a} onClick={() => setAccent(a)}>{a === "all" ? "Any accent" : cap(a)}</Chip>)}
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                <Chip active={tone === "all"} onClick={() => setTone("all")}>Any tone</Chip>
                {VOICE_TONES.map((t) => <Chip key={t.id} active={tone === t.id} onClick={() => setTone(t.id)}>{t.label}</Chip>)}
              </div>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            {voices.length === 0 ? (
              <p className="py-10 text-center text-[13px] text-white/40">No voices match these filters.</p>
            ) : (
              <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {voices.map((voice) => {
                  const recommended = isRecommendedForNiche(voice, niche);
                  const current = voice.voiceId === currentVoiceId;
                  return (
                    <li key={voice.voiceId} data-voice-id={voice.voiceId} className={`flex items-start gap-3 rounded-xl border p-3 ${current ? "border-lime-300/50 bg-lime-300/[0.06]" : "border-white/[0.08] bg-white/[0.02]"}`}>
                      <SampleButton voice={voice} playingId={player.playingId} onToggle={player.toggle} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="text-[14px] font-bold text-white">{voice.name}</p>
                          <span className="text-[11.5px] text-white/45">{cap(voice.gender)} · {cap(voice.accent)}</span>
                        </div>
                        <p className="mt-0.5 text-[12px] text-white/60">{voice.tags.join(" · ")}</p>
                        {recommended && (
                          <span title="Recommended for this niche" aria-label="Recommended for this niche"
                            className="mt-1.5 flex w-fit items-center gap-1 whitespace-nowrap rounded-full bg-lime-300/15 px-2 py-0.5 text-[10.5px] font-semibold text-lime-200" data-testid="voice-recommended">
                            <Sparkles className="h-3 w-3 shrink-0" /> Recommended
                          </span>
                        )}
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {voice.tones.map((t) => (
                            <span key={t} className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10.5px] text-white/55">{cap(t)}</span>
                          ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => { player.stop(); onSelect(voice); }}
                        className={`shrink-0 self-center rounded-lg px-3 py-1.5 text-[12px] font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-300 ${
                          current ? "bg-lime-300/20 text-lime-200" : "bg-white/[0.08] text-white hover:bg-lime-300 hover:text-[#11150D]"
                        }`}
                      >
                        {current ? <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Selected</span> : selectLabel}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
