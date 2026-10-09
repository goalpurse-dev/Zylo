import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { FOCUS, Toggle, cx } from "../../../ui/zyvo";
import { uploadPackage } from "../api/blockyStoriesApi";

/** Copy one field; falls back to selecting the text when the clipboard is refused. */
function CopyButton({ text, label }) {
  const [done, setDone] = useState(false);
  const copy = async (e) => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      const el = e.currentTarget.closest("[data-copy-row]")?.querySelector("[data-copy-text]");
      if (el) window.getSelection()?.selectAllChildren(el);
    }
  };
  return (
    <button type="button" onClick={copy} aria-label={`Copy ${label}`} className={cx("flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.05] px-2 py-1 text-[10px] font-bold text-white/70 transition hover:text-white", FOCUS)}>
      {done ? <Check className="h-3 w-3 text-lime-300" aria-hidden="true" /> : <Copy className="h-3 w-3" aria-hidden="true" />}
      {done ? "Copied" : "Copy"}
    </button>
  );
}

/**
 * Upload package: the YouTube title, description and tags, the TikTok / Reels
 * caption, a comment to pin, and hashtags. Written once by the server (free
 * for the user), every cap enforced there, and saved with the story. The
 * counts are the server's.
 */
export function UploadPackage({ storyId }) {
  const [state, setState] = useState({ status: "loading", pkg: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setState({ status: "loading", pkg: null });
    uploadPackage(storyId).then(
      (pkg) => { if (active) setState({ status: "ready", pkg }); },
      () => { if (active) setState({ status: "error", pkg: null }); },
    );
    return () => { active = false; };
  }, [storyId, attempt]);

  const counts = state.pkg?.counts ?? {};
  const count = (n, cap) => (Number.isFinite(n) ? `${n} / ${cap}` : null);
  const rows = state.pkg ? [
    ["YouTube title", state.pkg.title, count(counts.title, 100)],
    ["YouTube description", state.pkg.description, count(counts.description, 500)],
    ["YouTube tags", state.pkg.tags, count(counts.tags, 500)],
    ["TikTok and Reels caption", state.pkg.caption, count(counts.caption, 150)],
    ["Pinned comment", state.pkg.pinnedComment, null],
    ["Hashtags", (state.pkg.hashtags ?? []).join(" "), null],
  ].filter(([, text]) => text) : [];
  return (
    <section aria-label="Post text" className="rounded-2xl border border-white/[0.07] bg-[#111315] p-3.5">
      <h3 className="text-[13px] font-black text-white">Post text</h3>
      <p className="text-[11px] leading-relaxed text-white/45">Copy and paste when you upload.</p>
      {state.status === "loading" && <div className="mt-2.5 h-20 animate-pulse rounded-xl bg-white/[0.04] motion-reduce:animate-none" aria-label="Writing your post text" />}
      {state.status === "error" && (
        <p className="mt-2.5 text-[12px] text-orange-200">
          We couldn&apos;t write the post text. <button type="button" onClick={() => setAttempt((n) => n + 1)} className={cx("font-bold underline", FOCUS)}>Try again</button>
        </p>
      )}
      {rows.length > 0 && (
        <dl className="mt-2.5 flex flex-col divide-y divide-white/[0.06]">
          {rows.map(([label, text, size]) => (
            <div key={label} data-copy-row className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 py-2 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <dt className="text-[9.5px] font-black uppercase tracking-[0.12em] text-white/40">{label}{size && <span className="ml-2 font-semibold normal-case tracking-normal text-white/25">{size}</span>}</dt>
                {/* Three lines at most on the page; the copy button always copies all of it. */}
                <dd data-copy-text title={text} className="mt-0.5 select-text text-[12px] font-semibold leading-snug text-white/85" style={{ display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 3, overflow: "hidden" }}>{text}</dd>
              </div>
              <CopyButton text={text} label={label.toLowerCase()} />
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

/** "Part N" at the start and the end card ("Part N+1: … Follow for more"). */
export function SeriesOptions({ story, busy, onChange }) {
  const n = story.episodeNumber ?? 1;
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#111315] p-4">
      <h3 className="text-[14px] font-black text-white">Series extras</h3>
      <p className="mt-1 text-[12px] leading-relaxed text-white/50">{busy ? "Updating your video…" : "Drawn on the video by us, not by the AI."}</p>
      <div className="mt-3 flex flex-col gap-2.5">
        <label className="flex items-center justify-between gap-3 text-[12px] font-semibold text-white/75">
          <span>&ldquo;Part {n}&rdquo; for the first 1.5 seconds</span>
          <Toggle checked={Boolean(story.final.partLabel)} onChange={(v) => onChange({ partLabel: v })} label={`Part ${n} label`} disabled={busy} />
        </label>
        <label className="flex items-center justify-between gap-3 text-[12px] font-semibold text-white/75">
          <span>End card: {story.seriesId ? `Part ${n + 1} and "Follow for more"` : "\"Part 2 coming soon. Follow for more\""}</span>
          <Toggle checked={Boolean(story.final.endCard)} onChange={(v) => onChange({ endCard: v })} label="End card" disabled={busy} />
        </label>
      </div>
    </div>
  );
}
