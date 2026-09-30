import { motion as Motion, useReducedMotion } from "framer-motion";
import { Check, Lock } from "lucide-react";
import { ErrorBanner, cx } from "../../../ui/zyvo";
import { Avatar } from "../shared/Avatar";
import WorkspaceHeader from "./WorkspaceHeader";

/** Episode plan: title, what happens, cliffhanger, Made / Up next / Locked. */
export function Roadmap({ series, byId = () => null }) {
  return (
    <div className="flex flex-col gap-4">
      <WorkspaceHeader title="Episode plan" subtitle="Each episode ends on a cliffhanger that the next one picks up." />
      <ol className="flex flex-col gap-2">
        {series.episodes.map((ep) => (
          <li
            key={ep.number}
            aria-current={ep.status === "next" ? "step" : undefined}
            className={cx(
              "grid grid-cols-[40px_1fr] items-center gap-3 rounded-2xl border px-3.5 py-3 sm:grid-cols-[40px_1fr_auto]",
              ep.status === "next" ? "border-lime-300/45 bg-lime-300/[0.06]" : "border-white/[0.07] bg-[#111315]",
              ep.status === "locked" && "opacity-60",
            )}
          >
            <span className={cx(
              "grid h-10 w-10 place-items-center rounded-xl text-[15px] font-black",
              ep.status === "made" ? "bg-emerald-400/15 text-emerald-400" : ep.status === "next" ? "bg-lime-300 text-[#11150D]" : "bg-white/[0.05] text-white/40",
            )}>
              {ep.status === "made" ? <Check className="h-4 w-4" aria-hidden="true" /> : ep.number}
            </span>
            <div className="min-w-0">
              <h3 className="text-[13px] font-black text-white">{ep.title}</h3>
              <p className="mt-0.5 text-[11px] leading-relaxed text-white/50">{ep.summary}</p>
              <p className="mt-1 text-[11px] font-semibold text-lime-200/80">Ends on: {ep.cliffhanger}</p>
            </div>
            <span className={cx(
              "col-start-2 justify-self-start whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-black sm:col-start-auto sm:justify-self-end",
              ep.status === "made" ? "bg-emerald-400/10 text-emerald-400" : ep.status === "next" ? "bg-lime-300 text-[#11150D]" : "flex items-center gap-1 bg-white/[0.05] text-white/40",
            )}>
              {ep.status === "locked" && <Lock className="h-3 w-3" aria-hidden="true" />}
              {ep.status === "made" ? "Made" : ep.status === "next" ? "Up next" : "Locked"}
            </span>
          </li>
        ))}
      </ol>
      <SeriesBible bible={series.bible} byId={byId} />
    </div>
  );
}

/**
 * The series bible, read-only: the places every episode comes back to (with
 * their background plate once one is made), and each character's role,
 * signature prop and catchphrase. Keeps the series consistent.
 */
function SeriesBible({ bible, byId }) {
  if (!bible || (!bible.locations?.length && !bible.characters?.length)) return null;
  return (
    <section aria-labelledby="fv2-bible" className="flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-[#111315] p-3.5">
      <div>
        <h3 id="fv2-bible" className="text-[14px] font-black text-white">Series bible</h3>
        <p className="mt-0.5 text-[11px] leading-relaxed text-white/40">Every episode reuses these places and details, so the series stays consistent.</p>
      </div>
      {bible.characters?.length > 0 && (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label="Characters">
          {bible.characters.map((c) => {
            const ch = byId(c.id);
            return (
              <li key={c.id} className="flex gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.03] p-2.5">
                <Avatar character={ch} size="h-9 w-9" ring={false} />
                <span className="min-w-0 text-[11px] leading-relaxed text-white/55">
                  <span className="block font-black text-white">{ch?.name ?? c.id}</span>
                  <span className="block">{c.role}</span>
                  <span className="block"><span className="font-bold text-white/70">Prop:</span> {c.prop}</span>
                  <span className="block"><span className="font-bold text-white/70">Says:</span> &ldquo;{c.catchphrase}&rdquo;</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {bible.locations?.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Places">
          {bible.locations.map((l) => (
            <li key={l.id} className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03]">
              {l.plateUrl
                ? <img src={l.plateUrl} alt={`Empty set: ${l.description}`} className="aspect-[9/12] w-full object-cover" loading="lazy" />
                : <div className="grid aspect-[9/12] place-items-center text-[10px] font-semibold text-white/25">Pictured when first used</div>}
              <p className="p-2 text-[10px] font-semibold leading-relaxed text-white/55">{l.description}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Live preview of the series being created. */
export function SeriesPreview({ draft, byId }) {
  const cast = draft.castIds.length ? draft.castIds : [];
  const opener = draft.opener === "Something else" ? draft.openerCustom.trim() || "your idea" : draft.opener.toLowerCase();
  return (
    <div className="flex flex-col gap-4">
      <WorkspaceHeader title="Series preview" subtitle="This fills in as you answer." />
      <article className="w-full max-w-[420px] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111315]/95 shadow-[0_8px_32px_rgba(0,0,0,.45)]">
        <div className="grid grid-cols-3 gap-0.5 p-0.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="grid aspect-[9/14] place-items-center rounded-xl bg-white/[0.04]">
              {cast[i] ? <Avatar character={byId(cast[i])} size="h-14 w-14" ring={false} /> : <span className="h-14 w-14 rounded-full border border-dashed border-white/10" aria-hidden="true" />}
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1 px-3.5 pb-3.5 pt-2.5">
          <h3 className="text-[14px] font-black text-white">{draft.concept.trim() || "Your series"}</h3>
          <p className="text-[11px] font-semibold text-white/40">{draft.episodeCount} episodes{draft.tone ? `, ${draft.tone.toLowerCase()}` : ""}</p>
          {draft.opener && <p className="text-[11px] font-semibold text-white/40">Opens with: {opener}</p>}
          {cast.length > 3 && <p className="text-[11px] font-semibold text-white/40">+{cast.length - 3} more in the cast</p>}
        </div>
      </article>
    </div>
  );
}

/** "Writing your series plan" — the only loop is while the plan is being written. */
export function WritingPlan({ castIds, byId, error, onRetry }) {
  const reduce = useReducedMotion();
  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <WorkspaceHeader title="Series plan" />
        <ErrorBanner action="Try again" onAction={onRetry}>We couldn&apos;t write the series plan. Nothing was charged. Try again.</ErrorBanner>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-16 text-center" role="status">
      <div className="flex gap-2" aria-hidden="true">
        {castIds.slice(0, 3).map((id, i) => (
          <Motion.span
            key={id}
            animate={reduce ? undefined : { y: [0, -10, 0] }}
            transition={reduce ? undefined : { duration: 1, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
          >
            <Avatar character={byId(id)} size="h-12 w-12" ring={false} />
          </Motion.span>
        ))}
      </div>
      <h2 className="text-[20px] font-black tracking-[-0.03em] text-white">Writing your series plan</h2>
      <p className="max-w-[360px] text-[12px] leading-relaxed text-white/45">Roles, episode titles and a cliffhanger for every episode.</p>
    </div>
  );
}
