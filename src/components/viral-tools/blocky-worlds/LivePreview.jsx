// The alive parts of the page: our own looping clips of the locked look (public/blocky-worlds/clips, made with
// scripts/blockyWorlds/look/clips.mjs) and the caption player that "plays" a story over them at the narrator's pace,
// a few words at a time, the way the finished video shows them. Asked for less motion: one still and the first line.
import { useEffect, useMemo, useRef, useState } from "react";
import { EXAMPLE_IDEAS } from "../../../../supabase/functions/_shared/blockyWorlds/examples.js";
import { cx } from "../../ui/zyvo";
import { CLIPS, clipPoster, clipSrc, useReducedMotion } from "./clips";
import "./blockyWorlds.css";


const SAMPLES = EXAMPLE_IDEAS.slice(0, 4).map((i) => [i.opener, i.teaser]);
const MS_PER_WORD = 230; // about the narrator's 260 words a minute
const CLIP_MS = 5200;


/** A muted looping clip that only plays while `playing` (so a phone plays one at a time). */
export function Clip({ clip, playing = true, className = "" }) {
  const ref = useRef(null);
  const still = useReducedMotion();
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    if (playing && !still) v.play().catch(() => {}); else v.pause();
  }, [playing, still]);
  return (
    <video ref={ref} src={clipSrc(clip)} poster={clipPoster(clip)} muted loop playsInline preload="metadata" disablePictureInPicture aria-hidden="true"
      className={cx("absolute inset-0 h-full w-full object-cover", className)} />
  );
}

/** The story's words in caption-sized chunks (at most three words, a sentence end closes a chunk). */
function chunksOf(lines) {
  const out = [];
  for (const line of lines) {
    let cur = [];
    for (const w of String(line).split(/\s+/).filter(Boolean)) {
      cur.push(w);
      if (cur.length === 3 || /[.!?…,]$/.test(w)) { out.push(cur); cur = []; }
    }
    if (cur.length) out.push(cur);
  }
  return out;
}

/** The caption player: the words pop in chunk by chunk over the clip, then the story starts again. */
function Captions({ lines, still }) {
  const chunks = useMemo(() => chunksOf(lines), [lines]);
  const [at, setAt] = useState(0);
  useEffect(() => { setAt(0); }, [chunks]);
  useEffect(() => {
    if (still || !chunks.length) return undefined;
    const last = at >= chunks.length - 1;
    const t = setTimeout(() => setAt(last ? 0 : at + 1), chunks[at].length * MS_PER_WORD + (last ? 1400 : 60));
    return () => clearTimeout(t);
  }, [at, chunks, still]);
  if (!chunks.length) return null;
  const words = still ? String(lines[0] ?? "").split(/\s+/) : chunks[Math.min(at, chunks.length - 1)];
  return (
    <p key={`${at}-${words.join(" ")}`} className="bw-caption absolute inset-x-3 top-[62%] text-center text-[30px] leading-[1.05]" aria-hidden="true">
      {words.map((w, i) => <span key={i} className="bw-word mx-[0.2em]" style={{ animationDelay: `${i * 70}ms` }}>{w}</span>)}
    </p>
  );
}

/**
 * The right side before a video is made: a phone that cross-fades between the clips and plays a story's captions over
 * them. lines: what to play (the hovered idea, the script); none: our sample openers, one after another.
 */
export default function LivePreview({ lines = null, label = null, meta = null }) {
  const still = useReducedMotion();
  const [clip, setClip] = useState(0);
  const [sample, setSample] = useState(0);
  useEffect(() => {
    if (still) return undefined;
    const t = setInterval(() => setClip((c) => (c + 1) % CLIPS.length), CLIP_MS);
    return () => clearInterval(t);
  }, [still]);
  // with no story of its own, the next sample comes up with every second clip
  useEffect(() => { if (!lines && clip % 2 === 0) setSample((s) => (s + 1) % SAMPLES.length); }, [clip, lines]);
  const playing = lines?.length ? lines : SAMPLES[sample];

  return (
    <div className="mx-auto flex w-full max-w-[330px] flex-col items-center gap-3">
      <div className="relative aspect-[9/16] w-full overflow-hidden rounded-[30px] border border-white/10 bg-black shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]">
        {CLIPS.map((c, i) => (
          <div key={c.key} className={cx("bw-xfade absolute inset-0", i === clip ? "opacity-100" : "opacity-0")}>
            <Clip clip={c.key} playing={i === clip} />
          </div>
        ))}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/40" />
        <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white/90 backdrop-blur">
          <span className="relative grid h-2 w-2 place-items-center"><span className="bw-ping absolute h-2 w-2 rounded-full bg-lime-300" /><span className="h-2 w-2 rounded-full bg-lime-300" /></span>
          {label ?? "Preview"}
        </span>
        <Captions lines={playing} still={still} />
      </div>
      {meta && <p className="text-center text-[11px] font-semibold text-white/45">{meta}</p>}
    </div>
  );
}
