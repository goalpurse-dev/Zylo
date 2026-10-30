// Content Machine: the Studio tab (owner, 2026-10-30). Short "how I made this with Zyvo" videos for the Zyvo account.
// "Let AI decide" or type a template; the plan shows the real creation it reuses (the owner's own, last 30 days: no
// generation cost), the recipes (hook type, length, end trigger, loop), the cost and time BEFORE anything starts, and
// whether the laptop worker is on (jobs wait while it's off). A new generation is only made after an explicit go.
// Finished videos land in the Queue as Studio videos with captions, tracked links and their recipe.
import React, { useCallback, useEffect, useState } from "react";
import { api, money, when } from "./cmApi";

const input = "rounded-lg border border-white/15 bg-white/[0.05] px-3 py-2 text-[14px] text-white outline-none focus:border-lime-300/60";
const primary = "rounded-lg bg-lime-300 px-3.5 py-2 text-[13.5px] font-semibold text-[#071006] disabled:opacity-40";
const ghost = "rounded-lg border border-white/15 px-3 py-1.5 text-[13px] text-white/80 hover:bg-white/[0.05] disabled:opacity-40";
const STATUS = {
  waiting_go: ["Waiting for your go", "text-amber-300"], queued: ["Waiting for the worker", "text-sky-300"], claimed: ["Rendering", "text-lime-300"],
  done: ["In the Queue", "text-lime-300"], failed: ["Failed", "text-rose-300"], cancelled: ["Cancelled", "text-white/40"],
};
const TRIGGER = { comment: "Comment", save: "Save", repost: "Send to a friend" };
const recipeText = (r) => `${r.variant} · ${String(r.hook_type ?? "").replace(/_/g, " ")} · ${r.length_s?.[0] ?? "?"}–${r.length_s?.[1] ?? "?"} s · ends: ${TRIGGER[r.end_trigger] ?? r.end_trigger} · ${r.loop ? "loops" : "no loop"}`;
const mins = (m) => (m ? `${m[0]}–${m[1]} min` : "–");

function WorkerBadge({ w }) {
  if (!w) return null;
  return (
    <div className={`rounded-xl border px-3 py-2 text-[12.5px] ${w.online ? "border-lime-300/40 bg-lime-300/[0.06] text-lime-200" : "border-amber-300/40 bg-amber-300/[0.06] text-amber-200"}`} data-testid="cm-studio-worker">
      {w.online ? `Laptop worker on (seen ${w.last_seen_s} s ago)` : w.last_seen_s == null ? "Laptop worker off: jobs wait until it runs" : `Laptop worker off (last seen ${Math.round(w.last_seen_s / 60)} min ago): jobs wait`}
      <div className="mt-0.5 text-white/50">{w.note}</div>
    </div>
  );
}

export function StudioTab() {
  const [mode, setMode] = useState("ai_decide");
  const [prompt, setPrompt] = useState("");
  const [count, setCount] = useState("");
  const [plan, setPlan] = useState(null);
  const [sourceId, setSourceId] = useState(null);
  const [jobs, setJobs] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);

  const loadJobs = useCallback(async () => { try { setJobs(await api("studioJobs")); } catch (e) { setNote(e.message); } }, []);
  useEffect(() => { loadJobs(); const t = setInterval(loadJobs, 15_000); return () => clearInterval(t); }, [loadJobs]);

  const body = () => ({ mode, prompt: mode === "prompt" ? prompt : null, count: count ? Number(count) : undefined });
  const makePlan = async (e) => {
    e?.preventDefault(); setBusy(true); setNote(null); setPlan(null);
    try { const p = await api("studioPlan", body()); setPlan(p); setSourceId(p.source?.id ?? null); } catch (err) { setNote(err.message); }
    setBusy(false);
  };
  const start = async () => {
    setBusy(true); setNote(null);
    try { const r = await api("studioStart", { ...body(), sourceId }); setNote(`${r.jobs.length} video${r.jobs.length > 1 ? "s" : ""} started${r.worker.online ? "" : " (they wait until the laptop worker runs)"}.`); setPlan(null); loadJobs(); } catch (err) { setNote(err.message); }
    setBusy(false);
  };
  const act = async (action, id) => { setNote(null); try { await api(action, { id }); loadJobs(); } catch (e) { setNote(e.message); } };
  const generate = plan && plan.source?.kind === "generate";

  return (
    <div className="space-y-5" data-testid="cm-studio">
      <form onSubmit={makePlan} className="space-y-3 rounded-2xl border border-violet-400/40 bg-violet-400/[0.05] p-4">
        <h2 className="text-[14px] font-extrabold uppercase tracking-[0.1em] text-white/80">Make Studio videos · Zyvo account</h2>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="How to choose">
          {[["ai_decide", "Let AI decide"], ["prompt", "I'll type a template"]].map(([k, l]) => (
            <button key={k} type="button" role="radio" aria-checked={mode === k} onClick={() => { setMode(k); setPlan(null); }}
              className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold ${mode === k ? "border-lime-300 bg-lime-300/15 text-white" : "border-white/15 text-white/60"}`}>{l}</button>
          ))}
        </div>
        {mode === "prompt" && (
          <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. AI Fruit Story" aria-label="Template" className={`${input} w-full`} data-testid="cm-studio-prompt" />
        )}
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-[12.5px] text-white/60">Videos
            <input type="number" min={1} max={10} value={count} onChange={(e) => setCount(e.target.value)} placeholder={mode === "ai_decide" ? "batch" : "1"} className={`${input} mt-1 block w-24 tabular-nums`} />
          </label>
          <button type="submit" disabled={busy || (mode === "prompt" && !prompt.trim())} className={primary} data-testid="cm-studio-plan">Show the plan and the cost</button>
        </div>
        <p className="text-[12px] text-white/45">Nothing starts until you press Start. Reuse first: your own finished creations of the last 30 days, no generation cost.</p>
      </form>

      {note && <p className="text-[13px] text-white/75" role="status">{note}</p>}

      {plan && (
        <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4" data-testid="cm-studio-planbox">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-[15px] font-bold">{plan.name} · {plan.count} video{plan.count > 1 ? "s" : ""}</h3>
            <span className="text-[12px] text-white/45">{plan.learning.posts_with_numbers} Studio posts with numbers so far · {plan.learning.rule}</span>
          </div>
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-wider text-white/50">The real creation it shows</div>
            {plan.sources.length ? (
              <ul className="mt-1 space-y-1">
                {plan.sources.map((s) => (
                  <li key={s.id}><label className="flex items-center gap-2 text-[13.5px]">
                    <input type="radio" name="studio-source" checked={sourceId === s.id} onChange={() => setSourceId(s.id)} />
                    <span className="font-semibold">{s.title || "Untitled"}</span>
                    <span className="text-white/45">{when(s.created_at)} · {s.length_sec} s · used {s.used}×{s.filter.skip.length ? ` · ${s.filter.skip.length} scene${s.filter.skip.length > 1 ? "s" : ""} skipped (a brand name)` : ""}</span>
                    {s.final_url && <a href={s.final_url} target="_blank" rel="noreferrer" className="text-lime-300 underline">watch</a>}
                  </label></li>
                ))}
              </ul>
            ) : <p className="mt-1 text-[13px] text-amber-200">No usable creation in the last 30 days: a new one is made on the internal account, after your go.</p>}
          </div>
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-wider text-white/50">Recipes</div>
            <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-[13px] text-white/80">
              {plan.recipes.map((r, i) => <li key={i}>{recipeText(r)} <span className="text-white/45">· {r.why}</span></li>)}
            </ol>
          </div>
          <div className="rounded-xl border border-lime-300/30 bg-lime-300/[0.05] p-3 text-[13.5px]" data-testid="cm-studio-estimate">
            <div className="font-bold">Estimated cost {money(plan.estimate.usd, plan.estimate.usd < 0.1 ? 4 : 2)} · {mins(plan.estimate.minutes)}</div>
            <div className="mt-0.5 text-white/60">{plan.estimate.why}</div>
          </div>
          <WorkerBadge w={plan.worker} />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={start} disabled={busy} className={primary} data-testid="cm-studio-start">{generate ? `Start (waits for your go: ~${money(plan.estimate.generation_usd)})` : "Start"}</button>
            <button type="button" onClick={() => setPlan(null)} className={ghost}>Cancel</button>
          </div>
        </section>
      )}

      <section className="space-y-2">
        <div className="flex items-baseline justify-between"><h3 className="text-[14px] font-bold text-white/80">Studio jobs</h3>{jobs && <WorkerBadge w={jobs.worker} />}</div>
        {!jobs ? <p className="text-white/50">Loading…</p> : !jobs.jobs.length ? <p className="text-[13px] text-white/50">No Studio jobs yet.</p> : (
          <ul className="divide-y divide-white/10 rounded-2xl border border-white/10" data-testid="cm-studio-jobs">
            {jobs.jobs.map((j) => {
              const [label, tone] = STATUS[j.status] ?? [j.status, "text-white/60"];
              return (
                <li key={j.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-[13px]">
                  <span className={`font-semibold ${tone}`}>{label}</span>
                  <span className="text-white/80">{recipeText(j.recipe)}</span>
                  <span className="text-white/45">{j.source?.kind === "generate" ? "new creation" : `reuses "${j.source?.title ?? "?"}"`} · est. {money(j.estimate?.usd, 4)} · {when(j.created_at)}</span>
                  {j.progress && j.status === "claimed" && <span className="text-white/60">· {j.progress}</span>}
                  {j.error && <span className="text-rose-300">· {j.error}</span>}
                  {j.status === "done" && j.idea_id && <span className="text-lime-300">· in the Queue (Studio video)</span>}
                  <span className="ml-auto flex gap-2">
                    {j.status === "waiting_go" && <button type="button" className={primary} onClick={() => act("studioApprove", j.id)}>Go: ~{money(j.estimate?.generation_usd)}</button>}
                    {["waiting_go", "queued"].includes(j.status) && <button type="button" className={ghost} onClick={() => act("studioCancel", j.id)}>Cancel</button>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
