import { useState } from "react";
import { ArrowLeft, Check, ChevronDown, Copy, Download, ExternalLink, ShieldCheck, Sparkles, Trash2, Wand2 } from "lucide-react";
import { saveMediaToDevice } from "../../../lib/downloadMedia";
import CutawayPlayer from "./CutawayPlayer";
import useFit from "./hooks/useFit";
import useIsDesktop from "./hooks/useIsDesktop";

export function ExampleBadge({ className = "" }) {
  return <span className={`rounded-full border border-cutaway/30 bg-cutaway/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-cutaway ${className}`}>Example</span>;
}

function useCopy() {
  const [copied, setCopied] = useState(null);
  const copy = async (key, text) => {
    try { await navigator.clipboard.writeText(text); } catch { /* clipboard blocked: the text stays selectable */ }
    setCopied(key); window.setTimeout(() => setCopied((k) => (k === key ? null : k)), 1600);
  };
  return { copied, copy };
}

function CopyButton({ id, text, copied, copy, label = "Copy" }) {
  const done = copied === id;
  return (
    <button type="button" onClick={() => copy(id, text)} aria-label={`${label} ${id}`} className={`cw-press flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold ${done ? "border-cutaway/40 bg-cutaway/15 text-cutaway" : "border-white/10 bg-white/[0.05] text-white/60 hover:border-white/20 hover:text-white"}`}>
      {done ? <Check className="h-3 w-3" strokeWidth={3} /> : <Copy className="h-3 w-3" />}{done ? "Copied" : label}
    </button>
  );
}

const Card = ({ children, d = 0, className = "" }) => (
  <section style={{ "--d": `${d}ms` }} className={`cw-fade-up rounded-2xl border border-white/[0.07] bg-[#111315] p-4 ${className}`}>{children}</section>
);
const host = (url) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } };

/** A finished video (the viewer's own, or one of our examples): the player is the hero, then what to do with it. */
export default function CutawayResultView({ run, onBack, onMakeLike, onDelete, reveal = false }) {
  const { copied, copy } = useCopy();
  const isDesktop = useIsDesktop();
  const [fitRef, fit] = useFit(9 / 16);
  const [transcript, setTranscript] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const own = !run.example;
  const post = run.post;
  const hashtags = post?.hashtags?.join(" ") ?? "";
  const download = () => saveMediaToDevice({ url: run.finalUrl, filename: `${(run.title || "cutaway-explainer").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.mp4`, title: run.title || "Cutaway Explainer" });

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
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        {/* the hero: on desktop the largest 9:16 that fits the space next to the details; on phones full width */}
        <div ref={fitRef} className="flex min-h-0 shrink-0 items-start justify-center lg:min-w-0 lg:flex-1 lg:items-center">
          <div style={isDesktop && fit ? { width: fit.width, height: fit.height } : undefined} className={`relative ${isDesktop ? (fit ? "" : "aspect-[9/16] h-full") : "aspect-[9/16] w-full max-w-[420px]"} ${reveal ? "cw-reveal" : ""}`}>
            <CutawayPlayer src={run.finalUrl} poster={run.poster} autoPlay className={`absolute inset-0 h-full w-full ${reveal ? "cw-glow" : ""}`} />
          </div>
        </div>

        <aside className="flex min-h-0 flex-col gap-3 lg:w-[300px] lg:shrink-0 lg:overflow-y-auto lg:pr-1 lg:[scrollbar-width:thin] xl:w-[340px]">
          <div style={{ "--d": "40ms" }} className="cw-fade-up flex flex-wrap gap-2">
            <button type="button" onClick={download} className="cw-press flex flex-1 items-center justify-center gap-2 rounded-xl bg-cutaway px-4 py-3 text-[13px] font-black text-cutaway-ink shadow-[0_10px_30px_rgba(74,222,128,.22)] hover:bg-cutaway-soft">
              <Download className="h-4 w-4" />Download
            </button>
            <button type="button" onClick={() => onMakeLike(run)} className="cw-press flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-[13px] font-bold text-white/85 hover:border-cutaway/30 hover:text-white">
              <Wand2 className="h-4 w-4 text-cutaway" />Make one like this
            </button>
            {own && (
              confirmDelete ? (
                <div className="flex w-full items-center gap-2 rounded-xl border border-red-400/25 bg-red-400/[0.06] px-3 py-2 text-[12px] font-semibold text-red-200">
                  <span className="flex-1">Delete this video?</span>
                  <button type="button" onClick={() => setConfirmDelete(false)} className="cw-press rounded-lg px-2 py-1 text-white/60 hover:text-white">Keep</button>
                  <button type="button" onClick={() => onDelete(run.id)} className="cw-press rounded-lg bg-red-500/80 px-2.5 py-1 font-bold text-white hover:bg-red-500">Delete</button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmDelete(true)} aria-label="Delete video" className="cw-press grid h-[46px] w-[46px] place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-white/45 hover:border-red-400/30 hover:text-red-300">
                  <Trash2 className="h-4 w-4" />
                </button>
              )
            )}
          </div>

          {post && (
            <Card d={90}>
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-white/45"><Sparkles className="h-3.5 w-3.5 text-cutaway" />Ready to post</div>
              <p className="mt-0.5 text-[10px] font-semibold text-white/30">TikTok · YouTube Shorts · Instagram Reels</p>
              <div className="mt-3 space-y-3">
                {[["title", "Title", post.title], ["description", "Description", post.description], ["hashtags", "Hashtags", hashtags]].map(([id, label, text]) => (
                  <div key={id}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-white/35">{label}</span>
                      <CopyButton id={id} text={text} copied={copied} copy={copy} />
                    </div>
                    {id === "hashtags" ? (
                      <div className="mt-1.5 flex flex-wrap gap-1">{post.hashtags.map((h, i) => <span key={h} style={{ "--d": `${120 + i * 25}ms` }} className="cw-pop rounded-full bg-white/[0.06] px-2 py-0.5 text-[10.5px] font-semibold text-cutaway/90">{h}</span>)}</div>
                    ) : (
                      <p className={`mt-1 select-text leading-relaxed text-white/80 ${id === "title" ? "text-[13px] font-bold" : "text-[11.5px]"}`}>{text}</p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {run.facts?.length > 0 && (
            <Card d={140}>
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-white/45"><ShieldCheck className="h-3.5 w-3.5 text-cutaway" />Fact-checked</div>
              <ul className="mt-3 space-y-2.5">
                {run.facts.map((f) => (
                  <li key={f.claim} className="text-[11.5px] leading-snug text-white/75">
                    <span className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cutaway" strokeWidth={3} />{f.claim}</span>
                    <span className="ml-5 mt-1 flex flex-wrap gap-x-2.5 gap-y-1">
                      {f.sources.map((s) => (
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
            <Card d={190} className="!p-0">
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
