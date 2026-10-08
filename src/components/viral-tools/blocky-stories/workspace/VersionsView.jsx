import { useEffect, useState } from "react";
import { Check, RefreshCw, Sparkles } from "lucide-react";
import { ErrorBanner, FOCUS, PrimaryButton, cx } from "../../../ui/zyvo";
import { Avatar } from "../shared/Avatar";
import WorkspaceHeader from "./WorkspaceHeader";

/** How long each part of the wait usually takes, for the progress line (seconds). */
const PLAN_SEC = 25;
const WRITE_SEC = 20;
const POLISH_SEC = 25;

/** Seconds since the component (or `key`) appeared, ticking once a second while `running`. */
function useElapsed(running) {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    if (!running) return undefined;
    setSec(0);
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);
  return sec;
}

function Steps({ stage }) {
  const steps = ["Plan the twist", "Write three versions", "You pick one"];
  return (
    <ol className="flex flex-wrap gap-1.5" aria-label="Where the writing is">
      {steps.map((label, i) => {
        const done = i < stage, now = i === stage;
        return (
          <li key={label} aria-current={now ? "step" : undefined} className={cx("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-bold", done ? "border-lime-300/30 bg-lime-300/[0.08] text-lime-200" : now ? "border-white/20 bg-white/[0.06] text-white" : "border-white/[0.07] text-white/35")}>
            {done ? <Check className="h-3 w-3" aria-hidden="true" /> : now ? <span aria-hidden="true" className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-lime-300/20 border-t-lime-300/80 motion-reduce:animate-none" /> : <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-white/20" />}
            {label}
          </li>
        );
      })}
    </ol>
  );
}

function Skeleton({ lines = 6 }) {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="h-2.5 animate-pulse rounded-full bg-white/[0.06] motion-reduce:animate-none" style={{ width: `${[92, 64, 84, 52, 88, 70][i % 6]}%`, animationDelay: `${i * 120}ms` }} />
      ))}
    </div>
  );
}

function VersionCard({ version, byId, picking, disabled, onPick }) {
  const ready = version.status === "ready";
  const failed = version.status === "failed";
  const mine = picking === version.n;
  return (
    <article
      className={cx("flex min-w-0 flex-col rounded-2xl border bg-[#111315] p-3.5 transition", mine ? "border-lime-300/50" : "border-white/[0.07]", failed && "opacity-70")}
      aria-busy={version.status === "writing"}
      aria-label={`Version ${version.n}${version.title ? `: ${version.title}` : ""}`}
    >
      <div className="mb-1 flex items-center gap-2">
        <span className="rounded-md bg-white/[0.07] px-1.5 py-0.5 text-[10px] font-black tabular-nums text-white/60">{version.n}</span>
        {version.vetted && <span className="flex items-center gap-1 rounded-md bg-lime-300/[0.12] px-1.5 py-0.5 text-[10px] font-black text-lime-200"><Sparkles className="h-3 w-3" aria-hidden="true" />Editor&apos;s pick</span>}
        {ready && version.lengthSec ? <span className="ml-auto text-[10px] font-semibold tabular-nums text-white/30">about {version.lengthSec} sec</span> : null}
      </div>
      <h3 className="text-[15px] font-black leading-snug text-white [text-wrap:balance]">{version.title || "Untitled"}</h3>
      {version.hook && <p className="mt-1 text-[12px] font-medium leading-relaxed text-white/55">{version.hook}</p>}

      <div className="mt-3 flex-1 border-t border-white/[0.06] pt-3">
        {failed ? (
          <p className="text-[12px] leading-relaxed text-white/50">{version.error}</p>
        ) : ready ? (
          <ol className="flex flex-col gap-2">
            {version.lines.map((l, i) => {
              const c = byId(l.speakerId);
              return (
                <li key={i} className="grid grid-cols-[auto_1fr] items-start gap-2">
                  <Avatar character={c} size="h-5 w-5" ring={false} className="mt-0.5" />
                  <p className="min-w-0 text-[12.5px] leading-relaxed text-white/85"><span className="font-black text-white">{c?.name ?? "?"}: </span>{l.line}</p>
                </li>
              );
            })}
          </ol>
        ) : (
          <>
            <p className="mb-2.5 text-[11px] font-bold text-white/40">Writing the lines…</p>
            <Skeleton />
          </>
        )}
      </div>

      {ready && (
        <PrimaryButton className="mt-3.5" size="sm" busy={mine ? "Polishing your pick…" : null} disabled={disabled && !mine} onClick={() => onPick(version.n)}>
          Use this version
        </PrimaryButton>
      )}
    </article>
  );
}

/**
 * The three versions of a story, shown as each becomes ready. The user picks one before any picture is
 * made; only the picked one gets the editor's polish.
 * draft: {status: "planning"} while the twist is being planned, then the server's draft view.
 */
export default function VersionsView({ draft, byId, picking, error, onPick, onNew, onBack }) {
  const planning = draft.status === "planning";
  const versions = draft.versions ?? [];
  const writing = versions.filter((v) => v.status === "writing").length;
  const ready = versions.filter((v) => v.status === "ready").length;
  const stage = planning ? 0 : writing ? 1 : 2;
  const elapsed = useElapsed(planning || writing > 0 || Boolean(picking));
  const expected = picking ? POLISH_SEC : planning ? PLAN_SEC : WRITE_SEC;
  const allFailed = !planning && versions.length > 0 && !writing && !ready;
  const title = picking ? "Polishing your pick…" : planning ? "Planning three versions…" : writing ? `Writing… ${ready} of ${versions.length} ready` : "Pick your version";
  const subtitle = picking
    ? "An editor reads it once more and fixes what a viewer would trip on. Then you'll see every scene."
    : planning
      ? "Three different twists for your story. Each card appears as soon as it is written."
      : "Same story, three different twists. Read them and pick the one you'd watch. Writing is free: pictures are only made after you pick.";

  return (
    <div className="flex flex-col gap-4">
      <WorkspaceHeader title={title} subtitle={subtitle} />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-white/[0.07] bg-[#111315] px-4 py-3">
        <Steps stage={picking ? 2 : stage} />
        {(planning || writing > 0 || picking) && (
          <p className="ml-auto text-[11px] font-semibold tabular-nums text-white/40" aria-live="polite">
            {elapsed} s · usually about {expected} s
          </p>
        )}
      </div>

      {error && <ErrorBanner>{error}</ErrorBanner>}
      {allFailed && <ErrorBanner action="Write three new ones" onAction={onNew}>None of the three versions could be written. Nothing was charged.</ErrorBanner>}

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        {planning
          ? [1, 2, 3].map((n) => (
            <article key={n} className="rounded-2xl border border-white/[0.07] bg-[#111315] p-3.5" aria-busy="true" aria-label={`Version ${n}, being planned`}>
              <span className="rounded-md bg-white/[0.07] px-1.5 py-0.5 text-[10px] font-black text-white/60">{n}</span>
              <div className="mt-3"><Skeleton lines={3} /></div>
            </article>
          ))
          : versions.map((v) => <VersionCard key={v.n} version={v} byId={byId} picking={picking} disabled={Boolean(picking)} onPick={onPick} />)}
      </div>

      {!planning && !picking && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <button type="button" onClick={onNew} disabled={writing > 0 || draft.left === 0} className={cx("flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11.5px] font-bold text-white/55 transition hover:text-lime-300 disabled:opacity-40", FOCUS)}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Write three new versions
          </button>
          <button type="button" onClick={onBack} className={cx("rounded-lg px-2 py-1 text-[11.5px] font-bold text-white/55 transition hover:text-white", FOCUS)}>Change the story</button>
          {draft.left != null && (
            <p className="ml-auto text-[10.5px] font-medium text-white/30">
              {draft.left === 0 ? "That was today's last free writing. More tomorrow." : `${draft.left} free ${draft.left === 1 ? "writing" : "writings"} left today`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
