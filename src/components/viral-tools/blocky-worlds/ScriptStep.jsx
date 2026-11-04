import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Check, ChevronRight, Wand2, X } from "lucide-react";
import { FOCUS, PrimaryButton, Toggle, cx } from "../../ui/zyvo";
import { PARTS } from "../../../../supabase/functions/_shared/blockyWorlds/script.js";
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
export default function ScriptStep({ flow, onGenerate, notice, onBack, made = false, onNew }) {
  const { draft, lines, busy, access } = flow;
  const [rewriting, setRewriting] = useState(false);
  const [note, setNote] = useState("");
  const check = draft.check, problems = flow.edited ? [] : check.problems;
  const price = access?.prices?.[flow.lengthSec];
  const openerProblem = problems.some((p) => /^The first line must start/.test(p));
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
        </div>

        {problems.length > 0 && (
          <div className="rounded-xl border border-rose-400/25 bg-rose-400/[0.07] px-3 py-2.5" role="alert">
            <p className="mb-1 flex items-center gap-1.5 text-[11.5px] font-black text-rose-200"><AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />Fix before making the video</p>
            <ul className="list-disc pl-4 text-[11.5px] leading-relaxed text-rose-100/85">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
            {openerProblem && <PrimaryButton size="sm" variant="secondary" className="mt-2" busy={busy === "fixing" ? "Fixing" : undefined} onClick={flow.fixOpener}>Fix the first line for me</PrimaryButton>}
          </div>
        )}
        {!problems.length && check.warnings.length > 0 && !flow.edited && (
          <details className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-[11px] text-white/55">
            <summary className="cursor-pointer font-semibold">{check.warnings.length} tip{check.warnings.length > 1 ? "s" : ""} to make it punchier</summary>
            <ul className="mt-1 list-disc pl-4 leading-relaxed">{check.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          </details>
        )}

        <ol className="flex flex-col gap-3">
          {groups.map((g, gi) => (
            <li key={`${draft.updatedAt}-${gi}`} className="bw-line-in rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 pb-2 pt-2.5" style={{ "--i": gi }}>
              {g.part !== "own" && (
                <p className="mb-1 flex items-center justify-between px-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.14em] text-lime-300/75">{LABEL[g.part] ?? g.part}</span>
                  <span className="text-[10px] font-semibold text-white/25">{wordsIn(g.lines)} words</span>
                </p>
              )}
              <div className="flex flex-col">
                {g.lines.map((l) => (l.i === 0 && !flow.edited
                  ? <TypedFirstLine key={`${draft.updatedAt}-0`} text={l.text} onEdit={(t) => flow.editLine(0, t)} />
                  : <textarea key={l.i} aria-label={`Line ${l.i + 1}`} rows={1} value={l.text} onChange={(e) => flow.editLine(l.i, e.target.value)}
                      className={cx("w-full resize-none overflow-hidden rounded-lg border border-transparent bg-transparent px-2 py-1 text-[13.5px] leading-snug text-white/85 outline-none transition hover:border-white/10 focus:border-lime-300/35 focus:bg-[#111315]", l.i === 0 && "text-[15px] font-black text-white")}
                      style={{ fieldSizing: "content" }} />))}
              </div>
            </li>
          ))}
        </ol>

        {access?.canRemoveWatermark && <Toggle checked={flow.removeWatermark} onChange={flow.setRemoveWatermark} label="Remove the Zyvo end card" />}
        {!access?.renderer && <p className="text-center text-[11px] leading-relaxed text-white/35">Video making switches on soon. Your script is saved.</p>}
      </StepBody>

      <ActionBar above={<>
        {notice && <p className="mb-2 text-center text-[11px] font-semibold text-white/70" role="status">{notice}</p>}
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
        <div className="mb-2 flex gap-2">
          <div className="grid flex-1 grid-cols-3 gap-1 rounded-xl border border-white/[0.07] bg-[#0E1012] p-1" role="group" aria-label="Length">
            {(access?.lengths ?? [60, 90, 120]).map((s) => (
              <button key={s} type="button" aria-pressed={flow.lengthSec === s} onClick={() => flow.setLengthSec(s)}
                className={cx("rounded-lg py-1.5 text-[12px] font-bold transition", FOCUS, flow.lengthSec === s ? "bg-white/[0.09] text-white" : "text-white/40 hover:text-white/70")}>{clock(s)}</button>
            ))}
          </div>
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
          <ActionButton busy={busy === "starting" ? "Starting…" : busy === "rewriting" ? "Rewriting…" : null} disabled={!ready} onClick={onGenerate}>
            Make the video<span className="flex items-center gap-1 text-[13px] font-semibold"><CreditMark />{price}</span><ChevronRight className="h-4 w-4" />
          </ActionButton>
        )}
      </ActionBar>
    </>
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
