import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronDown, ClipboardCheck, Copy, Download, ExternalLink, Loader2, ShieldCheck, Sparkles, Stamp, Trash2, Wand2 } from "lucide-react";
import { saveMediaToDevice } from "../../../lib/downloadMedia";
import { downloadName, postText } from "./api/cutawayApi";
import CutawayPlayer from "./CutawayPlayer";
import useFit, { useFitScreen } from "./hooks/useFit";
import useIsDesktop from "./hooks/useIsDesktop";

export function ExampleBadge({ className = "" }) {
  return <span className={`rounded-full border border-cutaway/30 bg-cutaway/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-cutaway ${className}`}>Example</span>;
}

/** Copy to the clipboard; when it is refused, the text is selected so it can be copied by hand. */
function useCopy() {
  const [copied, setCopied] = useState(null);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = async (key, text, selectEl) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      if (selectEl) window.getSelection()?.selectAllChildren(selectEl);
    }
    setCopied(key);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(null), 1800);
  };
  return { copied, copy };
}

function CopyButton({ id, text, copied, copy, label = "Copy" }) {
  const done = copied === id;
  return (
    <button type="button" onClick={() => copy(id, text)} aria-label={`${label} ${id}`} className={`cw-press flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold ${done ? "border-cutaway/40 bg-cutaway/15 text-cutaway" : "border-white/10 bg-white/[0.05] text-white/60 hover:border-white/20 hover:text-white"}`}>
      {done ? <Check key="y" className="cw-pop h-3 w-3" strokeWidth={3} /> : <Copy className="h-3 w-3" />}{done ? "Copied" : label}
    </button>
  );
}

const Card = ({ children, d = 0, className = "" }) => (
  <section style={{ "--d": `${d}ms` }} className={`cw-fade-up rounded-2xl border border-white/[0.07] bg-[#111315] p-4 ${className}`}>{children}</section>
);
const host = (url) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } };

// The reveal's sparks: 10 dots flying out from the centre (transform + opacity only).
const SPARKS = Array.from({ length: 10 }, (_, i) => {
  const a = (i / 10) * Math.PI * 2 + 0.3;
  const r = 120 + (i % 3) * 40;
  return { tx: `${Math.round(Math.cos(a) * r)}px`, ty: `${Math.round(Math.sin(a) * r)}px`, d: `${520 + (i % 4) * 40}ms` };
});

/**
 * The reveal of a video that has just finished: the ground "slices open" once more. Two halves of the poster close
 * over the player, a green seam flashes, they part, sparks fly and a "Your video is ready" badge rises. Removed
 * after it played (leaf elements only); none of it shows with "reduce motion".
 */
function Reveal({ poster }) {
  const [on, setOn] = useState(true);
  useEffect(() => { const t = window.setTimeout(() => setOn(false), 3400); return () => window.clearTimeout(t); }, []);
  if (!on) return null;
  const half = (top) => (
    <div className={`${top ? "cw-curtain-up top-0" : "cw-curtain-down bottom-0"} absolute inset-x-0 h-1/2 overflow-hidden bg-[#0D100E]`}>
      {poster && <img src={poster} alt="" className={`absolute inset-x-0 h-[200%] w-full object-cover ${top ? "top-0" : "bottom-0"}`} />}
      <div className={`absolute inset-x-0 ${top ? "bottom-0 bg-gradient-to-t" : "top-0 bg-gradient-to-b"} h-1/3 from-black/60 to-transparent`} />
    </div>
  );
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10">
      <div className="absolute inset-0 overflow-hidden rounded-[26px]">
        {half(true)}
        {half(false)}
        <div className="cw-seam absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 bg-cutaway shadow-[0_0_24px_6px_rgba(74,222,128,.7)]" />
      </div>
      <div className="absolute left-1/2 top-1/2">
        {SPARKS.map((s, i) => <span key={i} className="cw-burst absolute -ml-1 -mt-1 h-2 w-2 rounded-full bg-cutaway shadow-[0_0_10px_rgba(74,222,128,.9)]" style={{ "--tx": s.tx, "--ty": s.ty, "--d": s.d }} />)}
      </div>
      <span className="cw-badge absolute left-1/2 top-5 flex items-center gap-1.5 whitespace-nowrap rounded-full bg-cutaway px-3 py-1.5 text-[12px] font-black text-cutaway-ink shadow-[0_10px_30px_rgba(74,222,128,.45)]">
        <Sparkles className="h-3.5 w-3.5" />Your video is ready
      </span>
    </div>
  );
}

/** Download: Saving… while the file comes in, then a short "Saved" (or "Shared"). */
function useDownload(run) {
  const [state, setState] = useState("idle"); // idle | saving | saved
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const download = async () => {
    if (state === "saving") return;
    setState("saving");
    const url = run.downloadUrl || run.finalUrl;
    try {
      const res = await saveMediaToDevice({ url, filename: downloadName(run), title: run.title || "Cutaway Explainer" });
      setState(res?.method === "cancelled" ? "idle" : "saved");
    } catch {
      setState("idle");
      return;
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 2200);
  };
  return [state, download];
}

/** Owner only: approve this layout, so the server reuses it for everyone who picks the same topic. */
function ApproveLayout({ run, onApprove }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const on = run.layoutApproved === true;
  const toggle = async () => {
    if (busy) return;
    setBusy(true); setError("");
    const res = await onApprove?.(run.id, !on);
    setBusy(false);
    if (res && !res.ok) setError(res.error?.message || "Couldn't save that. Try again.");
  };
  return (
    <Card d={60} className="!border-[#F5C042]/20 !bg-[#F5C042]/[0.04]">
      <button type="button" role="switch" aria-checked={on} onClick={toggle} disabled={busy} className="flex w-full items-center justify-between gap-3 text-left">
        <span className="min-w-0">
          <span className="flex items-center gap-2 text-[12px] font-black text-white/85"><Stamp className="h-4 w-4 text-[#F5C042]" />Approve layout<span className="rounded-full bg-[#F5C042]/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#F5C042]">Owner</span></span>
          <span className="mt-0.5 block text-[10.5px] font-medium leading-snug text-white/45">{on ? "Approved: this layout is reused for everyone who makes this topic." : "Not approved yet. Approve it to reuse this layout for everyone."}</span>
        </span>
        <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${on ? "bg-cutaway" : "bg-white/15"}`}>
          {busy ? <Loader2 className="absolute left-3.5 top-1 h-4 w-4 animate-spin text-white motion-reduce:animate-none" /> : <span className={`cw-knob absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white ${on ? "translate-x-5" : ""}`} />}
        </span>
      </button>
      {error && <p className="mt-2 text-[11px] font-semibold text-red-300">{error}</p>}
    </Card>
  );
}

/** A finished video (the viewer's own, or one of our examples): the player is the hero, then what to do with it. */
export default function CutawayResultView({ run, onBack, onMakeLike, onDelete, onApprove, reveal = false }) {
  const { copied, copy } = useCopy();
  const isDesktop = useIsDesktop();
  const [fitRef, fit] = useFit(9 / 16);
  // phones: the whole 9:16 between the header and the bottom nav, with the action row (46 px + gaps) still on screen
  const [screenRef, screen] = useFitScreen(9 / 16, { reserveBelow: 46 + 12 + 10, minHeight: 240 });
  const [transcript, setTranscript] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dl, download] = useDownload(run);
  const postRef = useRef(null);
  const own = !run.example;
  const post = run.post;
  const hashtags = post?.hashtags?.join(" ") ?? "";
  const box = isDesktop ? fit : screen;
  const allCopied = copied === "post";

  return (
    <div className="cw-view flex w-full flex-col gap-3 lg:h-full lg:min-h-0 lg:p-3">
      <header className="flex shrink-0 items-center gap-3 rounded-2xl border border-white/[0.07] bg-[#111315] px-3 py-2.5">
        <button type="button" onClick={onBack} aria-label="Back" className="cw-press grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-white/70 hover:bg-white/[0.1] hover:text-white">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-[14px] font-black text-white">{run.title || run.topic}</h2>
            {run.example && <ExampleBadge className="shrink-0" />}
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-white/35">{run.lengthSec} sec · 9:16 · {run.endCard === false ? "no end card" : "with the Zyvo end card"}</p>
        </div>
        {own && !confirmDelete && (
          <button type="button" onClick={() => setConfirmDelete(true)} aria-label="Delete video" className="cw-press grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.04] text-white/40 hover:bg-red-400/10 hover:text-red-300">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </header>
      {own && confirmDelete && (
        <div className="cw-fade-up flex shrink-0 items-center gap-2 rounded-xl border border-red-400/25 bg-red-400/[0.06] px-3 py-2 text-[12px] font-semibold text-red-200">
          <span className="flex-1">Delete this video? This can't be undone.</span>
          <button type="button" onClick={() => setConfirmDelete(false)} className="cw-press rounded-lg px-2 py-1 text-white/60 hover:text-white">Keep</button>
          <button type="button" onClick={() => onDelete(run.id)} className="cw-press rounded-lg bg-red-500/80 px-2.5 py-1 font-bold text-white hover:bg-red-500">Delete</button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        {/* the hero, never cropped: on desktop the largest 9:16 next to the details, on phones the largest 9:16
            between the header and the bottom nav (with Download under it still on screen) */}
        <div ref={isDesktop ? fitRef : screenRef} className="flex min-h-0 w-full shrink-0 items-start justify-center lg:w-auto lg:min-w-0 lg:flex-1 lg:items-center">
          <div style={box ? { width: box.width, height: box.height } : undefined} className={`relative ${box ? "" : "aspect-[9/16] h-full max-h-[60dvh]"} ${reveal ? "cw-reveal" : ""}`}>
            <CutawayPlayer src={run.finalUrl} poster={run.poster} autoPlay className={`absolute inset-0 h-full w-full ${reveal ? "cw-glow" : ""}`} />
            {reveal && <Reveal poster={run.poster} />}
          </div>
        </div>

        <aside className="flex min-h-0 flex-col gap-3 lg:w-[300px] lg:shrink-0 lg:overflow-y-auto lg:pr-1 lg:[scrollbar-width:thin] xl:w-[340px]">
          <div style={{ "--d": reveal ? "700ms" : "40ms" }} className="cw-fade-up flex gap-2">
            <button type="button" onClick={download} aria-busy={dl === "saving" || undefined} className={`cw-press relative flex h-[46px] flex-1 items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-xl px-3 text-[13px] font-black shadow-[0_10px_30px_rgba(74,222,128,.22)] ${dl === "saved" ? "bg-white text-black" : "bg-cutaway text-cutaway-ink hover:bg-cutaway-soft"}`}>
              {dl === "saving" ? <><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />Saving…</> : dl === "saved" ? <><Check key="s" className="cw-pop h-4 w-4" strokeWidth={3} />Saved</> : <><Download className="h-4 w-4" />Download</>}
            </button>
            <button type="button" onClick={() => onMakeLike(run)} className="cw-press flex h-[46px] flex-[1.4] items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-white/10 bg-white/[0.05] px-3 text-[13px] font-bold text-white/85 hover:border-cutaway/30 hover:text-white">
              <Wand2 className="h-4 w-4 text-cutaway" />Make one like this
            </button>
          </div>

          {run.owner === true && <ApproveLayout run={run} onApprove={onApprove} />}

          {post && (
            <Card d={reveal ? 780 : 90}>
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-white/45"><Sparkles className="h-3.5 w-3.5 text-cutaway" />Ready to post</div>
              <p className="mt-0.5 text-[10px] font-semibold text-white/30">TikTok · YouTube Shorts · Instagram Reels</p>
              {/* everything at once: title, description and hashtags, ready to paste under the video */}
              <div className="relative mt-3">
                <button type="button" onClick={() => copy("post", postText(post), postRef.current)} className={`cw-press relative flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-xl border text-[13px] font-black ${allCopied ? "border-cutaway/50 text-cutaway-ink" : "border-cutaway/30 bg-cutaway/[0.08] text-cutaway hover:bg-cutaway/[0.14]"}`}>
                  {allCopied && <span aria-hidden="true" className="cw-fill absolute inset-0 bg-cutaway" />}
                  <span className="relative flex items-center gap-2">{allCopied ? <ClipboardCheck key="c" className="cw-pop h-4 w-4" /> : <Copy className="h-4 w-4" />}{allCopied ? "Copied! Paste it with your video" : "Copy post text"}</span>
                </button>
                <p role="status" className={`mt-1.5 text-center text-[10.5px] font-semibold transition-opacity duration-200 ${allCopied ? "text-cutaway/80 opacity-100" : "text-white/30 opacity-100"}`}>
                  {allCopied ? `Title, description and ${post.hashtags?.length ?? 0} hashtags are on your clipboard` : "Title, description and hashtags in one tap"}
                </p>
              </div>
              <div ref={postRef} className="mt-3 space-y-3">
                {[["title", "Title", post.title], ["description", "Description", post.description], ["hashtags", "Hashtags", hashtags]].map(([id, label, text]) => (
                  <div key={id}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-white/35">{label}</span>
                      <CopyButton id={id} text={text} copied={copied} copy={copy} />
                    </div>
                    {id === "hashtags" ? (
                      <div className="mt-1.5 flex flex-wrap gap-1">{post.hashtags.map((h, i) => <span key={h} style={{ "--d": `${(reveal ? 820 : 120) + i * 25}ms` }} className="cw-pop rounded-full bg-white/[0.06] px-2 py-0.5 text-[10.5px] font-semibold text-cutaway/90">{h}</span>)}</div>
                    ) : (
                      <p className={`mt-1 select-text leading-relaxed text-white/80 ${id === "title" ? "text-[13px] font-bold" : "text-[11.5px]"}`}>{text}</p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {run.facts?.length > 0 && (
            <Card d={reveal ? 860 : 140}>
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-white/45"><ShieldCheck className="h-3.5 w-3.5 text-cutaway" />Fact-checked</div>
              <ul className="mt-3 space-y-2.5">
                {run.facts.map((f) => (
                  <li key={f.claim} className="text-[11.5px] leading-snug text-white/75">
                    <span className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cutaway" strokeWidth={3} />{f.claim}</span>
                    <span className="ml-5 mt-1 flex flex-wrap gap-x-2.5 gap-y-1">
                      {(f.sources ?? []).map((s) => (
                        <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" title={host(s.url)} className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-white/40 underline decoration-white/15 underline-offset-2 transition hover:text-cutaway hover:decoration-cutaway/50">
                          {s.label}<ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {run.narration && (
            <Card d={reveal ? 900 : 190} className="!p-0">
              <button type="button" onClick={() => setTranscript((v) => !v)} aria-expanded={transcript} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.12em] text-white/45 transition hover:text-white/70">
                Voiceover transcript
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${transcript ? "rotate-180" : ""}`} />
              </button>
              <div className={`grid transition-[grid-template-rows] duration-200 ${transcript ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                <div className="overflow-hidden">
                  <p className="select-text px-4 pb-4 text-[11.5px] leading-relaxed text-white/65">{run.narration}</p>
                </div>
              </div>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
