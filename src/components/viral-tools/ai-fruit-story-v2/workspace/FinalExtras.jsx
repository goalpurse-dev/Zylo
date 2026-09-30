import { useEffect, useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { FOCUS, PrimaryButton, Toggle, cx } from "../../../ui/zyvo";
import { uploadPackage } from "../api/fruitStoryV2Api";

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
 * Upload package: title, caption, pinned comment, hashtags. Written once by
 * the server (free for the user) and saved with the story.
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

  const rows = state.pkg ? [
    ["Title", state.pkg.title],
    ["Caption", state.pkg.caption],
    ["Pinned comment", state.pkg.pinnedComment],
    ["Hashtags", state.pkg.hashtags.join(" ")],
  ] : [];
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#111315] p-4">
      <h3 className="text-[14px] font-black text-white">Post it</h3>
      <p className="mt-1 text-[12px] leading-relaxed text-white/50">A title, caption, a comment to pin, and hashtags. Copy and paste when you upload.</p>
      {state.status === "loading" && <div className="mt-3 h-24 animate-pulse rounded-xl bg-white/[0.04] motion-reduce:animate-none" aria-label="Writing your post text" />}
      {state.status === "error" && (
        <p className="mt-3 text-[12px] text-orange-200">
          We couldn&apos;t write the post text. <button type="button" onClick={() => setAttempt((n) => n + 1)} className={cx("font-bold underline", FOCUS)}>Try again</button>
        </p>
      )}
      {rows.length > 0 && (
        <dl className="mt-3 flex flex-col gap-2">
          {rows.map(([label, text]) => (
            <div key={label} data-copy-row className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-[10px] font-black uppercase tracking-[0.12em] text-white/40">{label}</dt>
                <CopyButton text={text} label={label.toLowerCase()} />
              </div>
              <dd data-copy-text className="mt-1 select-text text-[12px] font-semibold leading-relaxed text-white/85">{text}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
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

/** The cover: the most dramatic scene with the title, same layout across a series. */
export function CoverImage({ story, onDownload }) {
  if (!story.final.coverUrl) return null;
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#111315] p-4">
      <h3 className="text-[14px] font-black text-white">Cover image</h3>
      <p className="mt-1 text-[12px] leading-relaxed text-white/50">The most dramatic scene with the title. Use it as the video cover or thumbnail.</p>
      <img src={story.final.coverUrl} alt={`Cover: ${story.title}`} className={cx("mx-auto mt-3 rounded-xl object-cover", story.aspect === "16:9" ? "aspect-video w-full" : "aspect-[9/16] w-full max-w-[200px]")} loading="lazy" />
      <PrimaryButton variant="secondary" className="mt-3" onClick={onDownload}>
        <Download className="h-4 w-4" aria-hidden="true" />
        Download cover
      </PrimaryButton>
    </div>
  );
}
