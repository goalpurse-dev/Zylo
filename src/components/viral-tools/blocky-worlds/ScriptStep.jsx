import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Check, ChevronRight, Wand2, X } from "lucide-react";
import { FOCUS, PrimaryButton, Toggle, cx } from "../../ui/zyvo";
import { PARTS } from "../../../../supabase/functions/_shared/blockyWorlds/script.js";
import { problemSpots } from "../../../../supabase/functions/_shared/blockyWorlds/protocol.js";
import { clock } from "./api/blockyWorldsApi";
import { useReducedMotion } from "./clips";
import { ActionBar, ActionButton, CreditMark, StepBody } from "./StepShell";
import "./blockyWorlds.css";

const LABEL = Object.fromEntries(PARTS.map((p) => [p.id, p.label]));
const wordsIn = (lines) => lines.reduce((n, l) => n + l.text.trim().split(/\s+/).filter(Boolean).length, 0);

/**
 * Step 2: the script, grouped by its parts (each part its own block, every line editable), the checks with their fixes;
 * pinned at the bottom: the length, Rewrite, and "Make the video" with its price. Generate waits for a clean script.
 */
export default function ScriptStep({ flow, onGenerate, notice, onBack, made = false, onNew, onTake }) {
  const { draft, lines, busy, access } = flow;
  // the topic's other worlds (optional): never the one this script was written from
  const takes = (flow.takes ?? []).filter((t) => t.id !== draft.ideaId);
  const [rewriting, setRewriting] = useState(false);
  const [note, setNote] = useState("");
  const check = draft.check, problems = flow.edited ? [] : check.problems;
  const price = access?.prices?.[flow.lengthSec];
  // where each problem sits (the server's problemSpots): shown next to its part, with Fix it for just that part
  const spots = flow.edited ? [] : check.spots ?? problemSpots({ lines: draft.lines }, problems);
  const spotsOf = (part) => spots.filter((x) => x.part === part && x.fix !== "rewrite");
  const loose = spots.filter((x) => !x.part || x.fix === "rewrite");
  const flagged = new Set(spots.filter((x) => x.lines.length === 1).flatMap((x) => x.lines)); // a single flagged line is marked too
  const firstBad = spots.find((x) => x.part && x.fix !== "rewrite");
  const lengthMismatch = draft.lengthSec !== flow.lengthSec;
  const ready = !problems.length && !lengthMismatch && !flow.edited;

  // the lines in their parts: one block per part, in the script's order
  const groups = useMemo(() => {
    const out = [];
    lines.forEach((l, i) => {
      if (!out.length || out.at(-1).part !== l.part) out.push({ part: l.part, lines: [] });
      out.at(-1).lines.push({ ...l, i });
    });
    return out;
  }, [lines]);

  const doRewrite = async () => { const r = await flow.rewrite(note); if (r?.ok) { setRewriting(false); setNote(""); } };

  return (
    <>
      <StepBody className="gap-5">
        <div>
          <button type="button" onClick={onBack} className={cx("mb-2 flex items-center gap-1 text-[11px] font-semibold text-white/40 hover:text-white", FOCUS)}><ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />Ideas</button>
          <h2 className="text-[24px] font-black leading-tight tracking-[-0.03em] text-white">{draft.title || "Your script"}</h2>
          <p className="mt-1 text-[11.5px] text-white/40">{check.words} words · about {clock(check.seconds)} · read by {access?.narrator?.name}</p>
          {takes.length > 0 && !made && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Try another take">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-white/35">Try another take</span>
              {takes.map((t) => (
                <button key={t.id} type="button" disabled={Boolean(busy)} onClick={() => onTake(t)} title={t.opener}
                  className={cx("max-w-[220px] truncate rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] font-semibold text-white/60 transition hover:border-lime-300/30 hover:text-white disabled:opacity-40", FOCUS, busy === "writing" && flow.pickedId === t.id && "bw-shimmer")}>{t.title}</button>
              ))}
            </div>
          )}
        </div>

        {problems.length > 0 && (
          <div className="rounded-xl border border-rose-400/25 bg-rose-400/[0.07] px-3 py-2.5" role="alert">
            <p className="flex items-center gap-1.5 text-[12px] font-black text-rose-200"><AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />{problems.length === 1 ? "One thing to fix before making the video" : `${problems.length} things to fix before making the video`}</p>
            {firstBad && <p className="mt-0.5 text-[11.5px] leading-relaxed text-rose-100/75">It&rsquo;s marked in red below, with a Fix it button that rewrites only that part.</p>}
            {loose.length > 0 && (
              <>
                <ul className="mt-1 list-disc pl-4 text-[11.5px] leading-relaxed text-rose-100/85">{loose.map((x) => <li key={x.problem}>{x.problem}</li>)}</ul>
                <PrimaryButton size="sm" variant="secondary" className="mt-2" busy={busy === "rewriting" ? "Rewriting" : undefined} disabled={Boolean(busy)} onClick={() => flow.rewrite("")}>Rewrite the script to fix it</PrimaryButton>
              </>
            )}
          </div>
        )}
        {!problems.length && check.warnings.length > 0 && !flow.edited && (
          <details className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-[11px] text-white/55">
            <summary className="cursor-pointer font-semibold">{check.warnings.length} tip{check.warnings.length > 1 ? "s" : ""} to make it punchier</summary>
            <ul className="mt-1 list-disc pl-4 leading-relaxed">{check.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          </details>
        )}

        <ol className="flex flex-col gap-3">
          {groups.map((g, gi) => {
            // a part's problems sit on its block (the first block of that part, when "own" lines are split up)
            const mine = groups.findIndex((x) => x.part === g.part) === gi ? spotsOf(g.part) : [];
            const fixing = busy === `fix:${g.part}` || (busy === "fixing" && mine.some((x) => x.fix === "opener"));
            return (
              <li key={`${draft.updatedAt}-${gi}`} className={cx("bw-line-in rounded-xl border px-3 pb-2 pt-2.5", mine.length ? "border-rose-400/40 bg-rose-400/[0.05]" : "border-white/[0.06] bg-white/[0.02]")} style={{ "--i": gi }}>
                {g.part !== "own" && (
                  <p className="mb-1 flex items-center justify-between px-2">
                    <span className={cx("text-[10px] font-black uppercase tracking-[0.14em]", mine.length ? "text-rose-200" : "text-lime-300/75")}>{LABEL[g.part] ?? g.part}</span>
                    <span className="text-[10px] font-semibold text-white/25">{wordsIn(g.lines)} words</span>
                  </p>
                )}
                {mine.length > 0 && (
                  <div className="mx-2 mb-1.5 flex items-start justify-between gap-3 rounded-lg bg-rose-400/[0.08] px-2.5 py-2" role="alert">
                    <ul className="flex flex-col gap-1 text-[11.5px] leading-relaxed text-rose-100/90">{mine.map((x) => <li key={x.problem} className="flex gap-1.5"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-rose-200" aria-hidden="true" />{x.problem}</li>)}</ul>
                    <button type="button" disabled={Boolean(busy)} onClick={() => (mine.every((x) => x.fix === "opener") ? flow.fixOpener() : flow.fixPart(g.part))}
                      className={cx("flex shrink-0 items-center gap-1 rounded-lg bg-rose-200 px-2.5 py-1.5 text-[11.5px] font-black text-[#2a0f12] transition hover:bg-white disabled:opacity-50", FOCUS, fixing && "bw-shimmer")}>
                      <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />{fixing ? "Fixing…" : "Fix it"}
                    </button>
                  </div>
                )}
                <div className="flex flex-col">
                  {g.lines.map((l) => (l.i === 0 && !flow.edited
                    ? <TypedFirstLine key={`${draft.updatedAt}-0`} text={l.text} onEdit={(t) => flow.editLine(0, t)} />
                    : <textarea key={l.i} aria-label={`Line ${l.i + 1}`} rows={1} value={l.text} onChange={(e) => flow.editLine(l.i, e.target.value)}
                        className={cx("w-full resize-none overflow-hidden rounded-lg border border-transparent bg-transparent px-2 py-1 text-[13.5px] leading-snug text-white/85 outline-none transition hover:border-white/10 focus:border-lime-300/35 focus:bg-[#111315]", l.i === 0 && "text-[15px] font-black text-white", flagged.has(l.i) && "border-l-2 border-l-rose-300/70")}
                        style={{ fieldSizing: "content" }} />))}
                </div>
              </li>
            );
          })}
        </ol>

        {access?.canRemoveWatermark && (
          // was an unlabelled switch (its name was only read out to screen readers): now it says what it does
          <div className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
            <div>
              <p className="text-[12.5px] font-bold text-white/85">Remove the Zyvo end card</p>
              <p className="text-[11px] leading-relaxed text-white/45">Your plan can end the video on your last line, without the short Zyvo card after it.</p>
            </div>
            <Toggle checked={flow.removeWatermark} onChange={flow.setRemoveWatermark} label="Remove the Zyvo end card" />
          </div>
        )}
        {!access?.renderer && <p className="text-center text-[11px] leading-relaxed text-white/35">Video making switches on soon. Your script is saved.</p>}
      </StepBody>

      <ActionBar above={<>
        {notice && <p className="mb-2 text-center text-[11px] font-semibold text-white/70" role="status">{notice}</p>}
        {problems.length > 0 && !made && (
          <p className="mb-2 flex items-center justify-center gap-1.5 text-center text-[11.5px] font-semibold text-rose-200/90"><AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {firstBad ? `Make the video unlocks once the ${firstBad.part === "own" ? "marked line" : `${LABEL[firstBad.part] ?? firstBad.part} part`} is fixed.` : "Make the video unlocks once the script is fixed."}
          </p>
        )}
        {lengthMismatch && !flow.edited && (
          <p className="mb-2 text-center text-[11px] text-white/55">Written for {clock(draft.lengthSec)}. <button type="button" className={cx("font-bold text-lime-300 underline", FOCUS)} onClick={() => flow.rewrite(`Fit it to ${flow.lengthSec} seconds.`)}>Rewrite it for {clock(flow.lengthSec)}</button></p>
        )}
        {rewriting && (
          <div className="bw-step-in mb-2 flex gap-2">
            <input autoFocus value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") doRewrite(); }}
              placeholder="Optional: scarier, a funnier ending…" className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-[#111315] px-3 py-2 text-[12.5px] text-white outline-none placeholder:text-white/25 focus:border-lime-300/35" />
            <button type="button" onClick={doRewrite} disabled={Boolean(busy)} className={cx("rounded-lg bg-white/[0.08] px-3 text-[12px] font-bold text-white transition hover:bg-white/[0.12] disabled:opacity-40", FOCUS)}>{busy === "rewriting" ? "Writing…" : "Rewrite"}</button>
            <button type="button" aria-label="Cancel" onClick={() => setRewriting(false)} className={cx("grid w-8 place-items-center rounded-lg text-white/40 hover:text-white", FOCUS)}><X className="h-4 w-4" /></button>
          </div>
        )}
      </>}>
        <div className="mb-2 flex items-stretch gap-2">
          <LengthSlider lengths={access?.lengths} prices={access?.prices} value={flow.lengthSec} onChange={flow.setLengthSec} disabled={Boolean(busy)} />
          <button type="button" onClick={() => setRewriting((v) => !v)} disabled={Boolean(busy)} aria-pressed={rewriting}
            className={cx("flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 text-[12px] font-bold text-white/70 transition hover:bg-white/[0.08] disabled:opacity-40", FOCUS, rewriting && "border-lime-300/30 text-lime-200")}>
            <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />Rewrite
          </button>
        </div>
        {made && !flow.edited ? (
          <ActionButton variant="secondary" onClick={onNew}>Start a new story<ChevronRight className="h-4 w-4" /></ActionButton>
        ) : flow.edited ? (
          <ActionButton busy={busy === "saving" ? "Checking…" : null} onClick={flow.saveEdits}><Check className="h-4 w-4" />Save and check</ActionButton>
        ) : (
          <ActionButton busy={busy === "starting" ? "Starting…" : busy === "rewriting" ? "Rewriting…" : busy === "writing" ? "Writing your story…" : null} disabled={!ready} onClick={onGenerate}>
            Make the video<span className="flex items-center gap-1 text-[13px] font-semibold"><CreditMark />{price}</span><ChevronRight className="h-4 w-4" />
          </ActionButton>
        )}
      </ActionBar>
    </>
  );
}

/**
 * The video length: a draggable slider (30 s to 3 min in 10 s steps), the value and its price shown live while dragging.
 * A native range input, so arrows / Page Up / Home / End and screen readers work; aria-valuetext reads "1:30, 62 credits".
 */
function LengthSlider({ lengths, prices, value, onChange, disabled }) {
  const steps = lengths?.length ? lengths : [60, 90, 120];
  const min = steps[0], max = steps.at(-1), step = steps.length > 1 ? steps[1] - steps[0] : 10;
  const price = prices?.[value];
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 rounded-xl border border-white/[0.07] bg-[#0E1012] px-3 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor="bw-length" className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-white/45">Video length</label>
        <span className="flex items-baseline gap-2 tabular-nums" aria-hidden="true">
          <span className="text-[14px] font-black text-white">{clock(value)}</span>
          {price != null && <span className="flex items-center gap-1 text-[11.5px] font-bold text-lime-300/85"><CreditMark className="h-3 w-3" />{price} credits</span>}
        </span>
      </div>
      <input id="bw-length" type="range" min={min} max={max} step={step} value={value} disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={price != null ? `${clock(value)}, ${price} credits` : clock(value)}
        className={cx("bw-range w-full", FOCUS)} style={{ "--bw-pct": `${pct}%` }} />
      <div className="flex justify-between text-[9.5px] font-semibold text-white/25" aria-hidden="true"><span>{clock(min)}</span><span>{clock(max)}</span></div>
    </div>
  );
}

/** The first line types itself in (the hook the whole video hangs on), then it is an ordinary editable line. */
function TypedFirstLine({ text, onEdit }) {
  const still = useReducedMotion();
  const [n, setN] = useState(still ? text.length : 0);
  useEffect(() => {
    if (n >= text.length) return undefined;
    const t = setTimeout(() => setN((c) => Math.min(text.length, c + 2)), 22);
    return () => clearTimeout(t);
  }, [n, text]);
  const field = "w-full resize-none overflow-hidden rounded-lg border border-transparent px-2 py-1 text-[15px] font-black leading-snug text-white outline-none";
  if (n < text.length) return <p className={field} aria-label="Line 1">{text.slice(0, n)}<span className="bw-caret" /></p>;
  return <textarea aria-label="Line 1" rows={1} value={text} onChange={(e) => onEdit(e.target.value)} className={cx(field, "bg-transparent transition hover:border-white/10 focus:border-lime-300/35 focus:bg-[#111315]")} style={{ fieldSizing: "content" }} />;
}
