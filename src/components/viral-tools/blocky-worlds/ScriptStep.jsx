import { useState } from "react";
import { AlertTriangle, ArrowLeft, Check, Wand2 } from "lucide-react";
import { FOCUS, OptionChip, PrimaryButton, SectionLabel, Toggle, cx } from "../../ui/zyvo";
import { PARTS } from "../../../../supabase/functions/_shared/blockyWorlds/script.js";
import { clock } from "./api/blockyWorldsApi";

const LABEL = Object.fromEntries(PARTS.map((p) => [p.id, p.label]));

/**
 * Steps 2 and 3: the script (every line editable, grouped by the seven parts, the checks shown with fixes) and the
 * settings (length, end card) with Generate and its price. Generate is disabled while the script has problems.
 */
export default function ScriptStep({ flow, onGenerate, notice, onBack }) {
  const { draft, lines, busy, access } = flow;
  const [note, setNote] = useState("");
  const check = draft.check, problems = flow.edited ? [] : check.problems;
  const price = access?.prices?.[flow.lengthSec];
  const openerProblem = problems.some((p) => /^The first line must start/.test(p));
  const lengthMismatch = draft.lengthSec !== flow.lengthSec;
  const ready = !problems.length && !lengthMismatch && !flow.edited;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <button type="button" onClick={onBack} className={cx("mb-1 flex items-center gap-1 text-[11px] font-bold text-white/45 hover:text-white", FOCUS)}><ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />Ideas</button>
          <h2 className="truncate text-[18px] font-black tracking-[-0.02em] text-white">{draft.title || "Your script"}</h2>
          <p className="mt-0.5 text-[11.5px] text-white/45">{check.words} words · about {clock(check.seconds)} at the narrator&apos;s pace · read by {access?.narrator?.name}</p>
        </div>
      </div>

      {problems.length > 0 && (
        <div className="rounded-xl border border-rose-400/25 bg-rose-400/[0.07] px-3 py-2.5" role="alert">
          <p className="mb-1 flex items-center gap-1.5 text-[11.5px] font-black text-rose-200"><AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />Fix before making the video</p>
          <ul className="list-disc pl-4 text-[11.5px] leading-relaxed text-rose-100/85">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
          {openerProblem && <PrimaryButton size="sm" variant="secondary" className="mt-2" busy={busy === "fixing" ? "Fixing" : undefined} onClick={flow.fixOpener}>Fix the first line for me</PrimaryButton>}
        </div>
      )}
      {!problems.length && check.warnings.length > 0 && !flow.edited && (
        <details className="rounded-xl border border-amber-300/20 bg-amber-300/[0.05] px-3 py-2 text-[11px] text-amber-100/80">
          <summary className="cursor-pointer font-bold">{check.warnings.length} tip{check.warnings.length > 1 ? "s" : ""} to make it punchier</summary>
          <ul className="mt-1 list-disc pl-4 leading-relaxed">{check.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </details>
      )}

      <div>
        <SectionLabel hint="tap a line to edit">The script</SectionLabel>
        <ol className="flex flex-col gap-1">
          {lines.map((l, i) => {
            const first = i === 0 || lines[i - 1].part !== l.part;
            return (
              <li key={i}>
                {first && l.part !== "own" && <p className="mb-0.5 mt-2 text-[9.5px] font-black uppercase tracking-[0.14em] text-lime-300/70">{LABEL[l.part] ?? l.part}</p>}
                <textarea aria-label={`Line ${i + 1}`} rows={1} value={l.text} onChange={(e) => flow.editLine(i, e.target.value)}
                  className={cx("w-full resize-none overflow-hidden rounded-lg border border-transparent bg-transparent px-2 py-1 text-[13px] leading-snug text-white/90 outline-none transition hover:border-white/10 focus:border-lime-300/35 focus:bg-[#111315]", i === 0 && "font-bold text-white")}
                  style={{ fieldSizing: "content" }} />
              </li>
            );
          })}
        </ol>
        {flow.edited && (
          <div className="sticky bottom-2 mt-2 flex items-center justify-between gap-2 rounded-xl border border-lime-300/25 bg-[#13170f] px-3 py-2">
            <span className="text-[11.5px] font-semibold text-white/70">You changed the script.</span>
            <PrimaryButton size="sm" fullWidth={false} busy={busy === "saving" ? "Checking" : undefined} onClick={flow.saveEdits}><Check className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />Save and check</PrimaryButton>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
        <SectionLabel htmlFor="bw-note">Rewrite it</SectionLabel>
        <div className="flex gap-2">
          <input id="bw-note" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="optional: make it scarier, a funnier ending..." className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-[#111315] px-3 py-2 text-[12.5px] text-white outline-none placeholder:text-white/25 focus:border-lime-300/35" />
          <PrimaryButton size="sm" fullWidth={false} variant="secondary" busy={busy === "rewriting" ? "Writing" : undefined} disabled={Boolean(busy)} onClick={() => flow.rewrite(note)}><Wand2 className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />Rewrite</PrimaryButton>
        </div>
        <p className="mt-1.5 text-[10px] text-white/30">Rewrites are free ({draft.writesLeft ?? "a few"} left today).</p>
      </div>

      <div>
        <SectionLabel>Length</SectionLabel>
        <div className="grid grid-cols-3 gap-1.5">
          {(access?.lengths ?? [60, 90, 120]).map((s) => (
            <OptionChip key={s} selected={flow.lengthSec === s} onClick={() => flow.setLengthSec(s)}>
              <span className="block text-[13px] font-black">{clock(s)}</span>
              <span className="block text-[10.5px] text-white/45">{access?.prices?.[s]} credits</span>
            </OptionChip>
          ))}
        </div>
        {lengthMismatch && (
          <p className="mt-2 text-[11px] leading-relaxed text-amber-100/80">This script was written for {clock(draft.lengthSec)}. <button type="button" className={cx("font-bold text-lime-300 underline", FOCUS)} onClick={() => flow.rewrite(`Fit it to ${flow.lengthSec} seconds.`)}>Rewrite it for {clock(flow.lengthSec)}</button></p>
        )}
      </div>
      {access?.canRemoveWatermark && <Toggle checked={flow.removeWatermark} onChange={flow.setRemoveWatermark} label="Remove the Zyvo end card" />}

      {notice && <p className="rounded-lg bg-white/[0.05] px-3 py-2 text-[11.5px] leading-relaxed text-white/70" role="status">{notice}</p>}
      <PrimaryButton price={price} busy={busy === "starting" ? "Starting" : undefined} disabled={!ready || Boolean(busy)} onClick={onGenerate}>Make the video</PrimaryButton>
      {!access?.renderer && !notice && <p className="-mt-2 text-center text-[10.5px] leading-relaxed text-white/35">Video making switches on soon. Your script is saved.</p>}
    </div>
  );
}
