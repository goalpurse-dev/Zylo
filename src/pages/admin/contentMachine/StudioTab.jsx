// Content Machine: the Studio tab (Master Prompt v2, owner 2026-10-31). "Let AI decide" or type what you want ("Fruit",
// "make an A2 one"). The plan is one screen: a different angle, world, creation, length and end trigger for each video,
// the cost and the time, whether the laptop worker is on. Nothing starts until Start; a new creation only after a go.
// Each finished video is watchable in its row at once, and is in the Queue with captions and tracked links.
import React, { useCallback, useEffect, useState } from "react";
import { api, money, when } from "./cmApi";
import { MarkPosted } from "./PostedTabs";

const input = "rounded-lg border border-white/15 bg-white/[0.05] px-3 py-2 text-[14px] text-white outline-none focus:border-lime-300/60";
const primary = "rounded-lg bg-lime-300 px-3.5 py-2 text-[13.5px] font-semibold text-[#071006] disabled:opacity-40";
const ghost = "rounded-lg border border-white/15 px-3 py-1.5 text-[13px] text-white/80 hover:bg-white/[0.05] disabled:opacity-40";
const STATUS = {
  waiting_go: ["Waiting for your go", "text-amber-300"], queued: ["Waiting for the worker", "text-sky-300"], claimed: ["Rendering", "text-lime-300"],
  done: ["In the Queue", "text-lime-300"], failed: ["Failed", "text-rose-300"], cancelled: ["Cancelled", "text-white/40"],
};
const TRIGGER = { comment: "Comment", save: "Save", repost: "Send to a friend" };
const WORLD = { sunny: "Sunny park", cozy: "Cozy room", factory: "Idea factory", studio: "Bright studio" };
const recipeText = (r) => (r.angle
  ? `${r.angle} · ${r.angle_name ?? ""} · ${WORLD[r.world] ?? r.world ?? ""} · ${r.length_bucket ?? "?"} s · ends: ${TRIGGER[r.end_trigger] ?? r.end_trigger}`
  : `${r.variant} · ${String(r.hook_type ?? "").replace(/_/g, " ")} · ends: ${TRIGGER[r.end_trigger] ?? r.end_trigger}`);
const mins = (m) => (m ? `${m[0]}–${m[1]} min` : "–");

/** A finished video, watchable right away. Keeps its first link: the tab refreshes every 15 s and playback must not restart. */
function JobVideo({ url }) {
  const [src] = useState(url);
  return (
    <div className="mt-2 flex w-full items-end gap-3" data-testid="cm-studio-video">
      <video src={src} controls preload="metadata" className="h-64 rounded-lg border border-white/10 bg-black" />
      <a href={src} download className="text-[12.5px] text-lime-300 underline">Download</a>
    </div>
  );
}

function WorkerBadge({ w }) {
  if (!w) return null;
  return (
    <div className={`rounded-xl border px-3 py-2 text-[12.5px] ${w.online ? "border-lime-300/40 bg-lime-300/[0.06] text-lime-200" : "border-amber-300/40 bg-amber-300/[0.06] text-amber-200"}`} data-testid="cm-studio-worker">
      {w.online ? `Laptop worker on (seen ${w.last_seen_s} s ago)` : w.last_seen_s == null ? "Laptop worker off: jobs wait until it runs" : `Laptop worker off (last seen ${Math.round(w.last_seen_s / 60)} min ago): jobs wait`}
      <div className="mt-0.5 text-white/50">{w.note}</div>
    </div>
  );
}

/** The angle library: what a video can be about. Retire one, or edit its example hooks. */
function AnglesPanel() {
  const [angles, setAngles] = useState(null);
  const [note, setNote] = useState(null);
  const load = useCallback(async () => { try { setAngles((await api("studioAngles")).angles); } catch (e) { setNote(e.message); } }, []);
  useEffect(() => { load(); }, [load]);
  const save = async (key, patch) => { setNote(null); try { await api("saveStudioAngle", { key, ...patch }); await load(); } catch (e) { setNote(e.message); } };
  if (!angles) return <p className="text-[13px] text-white/50">{note ?? "Loading…"}</p>;
  return (
    <div className="space-y-2" data-testid="cm-studio-angles">
      {note && <p className="text-[13px] text-rose-200">{note}</p>}
      <ul className="divide-y divide-white/10 rounded-2xl border border-white/10">
        {angles.map((a) => (
          <li key={a.key} className={`px-3 py-2.5 text-[13px] ${a.status === "retired" ? "opacity-50" : ""}`}>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <b className="text-white">{a.key} · {a.name}</b>
              <span className="text-white/45">{a.length_bucket} s · the viewer gets: {a.viewer_gets} · Zyvo: {a.zyvo_role}</span>
              <button type="button" onClick={() => save(a.key, { status: a.status === "retired" ? "active" : "retired" })} className="ml-auto text-[12px] text-white/60 underline">{a.status === "retired" ? "Bring back" : "Retire"}</button>
            </div>
            <textarea rows={Math.max(1, (a.hooks ?? []).length)} defaultValue={(a.hooks ?? []).join("\n")} onBlur={(e) => { if (e.target.value !== (a.hooks ?? []).join("\n")) save(a.key, { hooks: e.target.value }); }} aria-label={`Example hooks of ${a.name}`}
              className="mt-1 block w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-[12.5px] text-white/75 outline-none focus:border-lime-300/50" />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StudioTab() {
  const [mode, setMode] = useState("ai_decide");
  const [prompt, setPrompt] = useState("");
  const [count, setCount] = useState("");
  const [plan, setPlan] = useState(null);
  const [jobs, setJobs] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const [showAngles, setShowAngles] = useState(false);

  const loadJobs = useCallback(async () => { try { setJobs(await api("studioJobs")); } catch (e) { setNote(e.message); } }, []);
  useEffect(() => { loadJobs(); const t = setInterval(loadJobs, 15_000); return () => clearInterval(t); }, [loadJobs]);

  const body = () => ({ mode, prompt: mode === "prompt" ? prompt : null, count: count ? Number(count) : undefined });
  const makePlan = async (e) => {
    e?.preventDefault(); setBusy(true); setNote(null); setPlan(null);
    try { setPlan(await api("studioPlan", body())); } catch (err) { setNote(err.message); }
    setBusy(false);
  };
  const start = async () => {
    setBusy(true); setNote(null);
    try { const r = await api("studioStart", body()); setNote(`${r.jobs.length} video${r.jobs.length > 1 ? "s" : ""} started${r.worker.online ? "" : " (they wait until the laptop worker runs)"}.`); setPlan(null); loadJobs(); } catch (err) { setNote(err.message); }
    setBusy(false);
  };
  const act = async (action, args, done = null) => { setNote(null); try { await api(action, args); if (done) setNote(done); loadJobs(); } catch (e) { setNote(e.message); } };
  const fresh = plan?.videos?.filter((v) => v.source.kind === "generate").length ?? 0;

  return (
    <div className="space-y-5" data-testid="cm-studio">
      <form onSubmit={makePlan} className="space-y-3 rounded-2xl border border-violet-400/40 bg-violet-400/[0.05] p-4">
        <h2 className="text-[14px] font-extrabold uppercase tracking-[0.1em] text-white/80">Make Studio videos · Zyvo account</h2>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="How to choose">
          {[["ai_decide", "Let AI decide"], ["prompt", "I'll type what I want"]].map(([k, l]) => (
            <button key={k} type="button" role="radio" aria-checked={mode === k} onClick={() => { setMode(k); setPlan(null); }}
              className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold ${mode === k ? "border-lime-300 bg-lime-300/15 text-white" : "border-white/15 text-white/60"}`}>{l}</button>
          ))}
        </div>
        {mode === "prompt" && (
          <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder='e.g. "AI Fruit Story", "make an A2 one", "a tutorial"' aria-label="What you want" className={`${input} w-full`} data-testid="cm-studio-prompt" />
        )}
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-[12.5px] text-white/60">Videos
            <input type="number" min={1} max={10} value={count} onChange={(e) => setCount(e.target.value)} placeholder={mode === "ai_decide" ? "batch" : "1"} className={`${input} mt-1 block w-24 tabular-nums`} />
          </label>
          <button type="submit" disabled={busy || (mode === "prompt" && !prompt.trim())} className={primary} data-testid="cm-studio-plan">Show the plan and the cost</button>
          <button type="button" onClick={() => setShowAngles(!showAngles)} className={ghost}>{showAngles ? "Hide angles" : "Angles"}</button>
        </div>
        <p className="text-[12px] text-white/45">Nothing starts until you press Start. Every video gets its own angle, world and creation; reuse first, no generation cost.</p>
      </form>

      {showAngles && <AnglesPanel />}
      {note && <p className="text-[13px] text-white/75" role="status">{note}</p>}

      {plan && (
        <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4" data-testid="cm-studio-planbox">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-[15px] font-bold">{plan.name} · {plan.count} different video{plan.count > 1 ? "s" : ""}</h3>
            <span className="text-[12px] text-white/45">{plan.learning.posts_with_numbers} Studio posts with numbers · {plan.learning.rule}</span>
          </div>
          <ol className="space-y-1.5 text-[13px]" data-testid="cm-studio-videos">
            {plan.videos.map(({ recipe: r, source: s }, i) => (
              <li key={i} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <div className="font-semibold text-white">{i + 1}. {recipeText(r)}</div>
                {r.example_hook && <div className="text-white/60">Like: “{r.example_hook}” <span className="text-white/40">(the script is written fresh when it renders)</span></div>}
                <div className="text-white/50">{s.kind === "generate" ? <span className="text-amber-200">No unused creation left: a new one, after your go</span> : <>Shows “{s.title}” ({s.length_sec} s) {s.final_url && <a href={s.final_url} target="_blank" rel="noreferrer" className="text-lime-300 underline">watch</a>}</>} · {r.why}</div>
              </li>
            ))}
          </ol>
          <div className="rounded-xl border border-lime-300/30 bg-lime-300/[0.05] p-3 text-[13.5px]" data-testid="cm-studio-estimate">
            <div className="font-bold">Estimated cost {money(plan.estimate.usd)} · {mins(plan.estimate.minutes)}</div>
            <div className="mt-0.5 text-white/60">{plan.estimate.why}</div>
          </div>
          <WorkerBadge w={plan.worker} />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={start} disabled={busy} className={primary} data-testid="cm-studio-start">{fresh ? `Start (${fresh} wait${fresh > 1 ? "" : "s"} for your go)` : "Start"}</button>
            <button type="button" onClick={() => setPlan(null)} className={ghost}>Cancel</button>
          </div>
        </section>
      )}

      <section className="space-y-2">
        <div className="flex items-baseline justify-between"><h3 className="text-[14px] font-bold text-white/80">Studio jobs</h3>{jobs && <WorkerBadge w={jobs.worker} />}</div>
        {!jobs ? <p className="text-white/50">Loading…</p> : !jobs.jobs.length ? <p className="text-[13px] text-white/50">No Studio jobs yet.</p> : (
          <ul className="divide-y divide-white/10 rounded-2xl border border-white/10" data-testid="cm-studio-jobs">
            {jobs.jobs.map((j) => {
              const posted = j.idea?.status === "posted";
              const [label, tone] = posted ? ["Posted", "text-lime-300"] : STATUS[j.status] ?? [j.status, "text-white/60"];
              return (
                <li key={j.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-[13px]">
                  <span className={`font-semibold ${tone}`}>{label}</span>
                  <span className="text-white/80">{recipeText(j.recipe)}</span>
                  <span className="text-white/45">{j.source?.kind === "generate" ? "new creation" : `shows "${j.source?.title ?? "?"}"`} · est. {money(j.estimate?.usd)} · {when(j.created_at)}</span>
                  {j.progress && j.status === "claimed" && <span className="text-white/60">· {j.progress}</span>}
                  {j.error && <span className="text-rose-300">· {j.error}</span>}
                  {j.status === "done" && j.video_url && <JobVideo key={j.id} url={j.video_url} />}
                  {j.status === "done" && j.idea && (
                    <div className="mt-1 flex w-full flex-wrap items-center gap-2" data-testid="cm-studio-actions">
                      {(j.idea.posts ?? []).map((p) => <a key={p.post_url} href={p.post_url} target="_blank" rel="noreferrer" className="text-[12.5px] text-lime-300 underline">Posted on {p.platform}</a>)}
                      <MarkPosted idea={j.idea} onDone={loadJobs} />
                      {posted && <button type="button" className={ghost} data-testid="cm-studio-undo-posted" onClick={() => { if (window.confirm("Undo posted? Its posts and their stats are removed, and it goes back to Not posted (in the Queue).")) act("unmarkPosted", { ideaId: j.idea.id }); }}>Undo posted</button>}
                      {!posted && j.recipe?.angle && <button type="button" className={ghost} data-testid="cm-studio-remake" onClick={() => { if (window.confirm("Make this video again? The same angle, world, creation and ending, with a new script and new voices. About $0.10, within the caps; the worker makes it next.")) act("studioRemake", { id: j.id }, "The remake is waiting for the worker. The first video stays until you reject or post it."); }}>Remake same idea</button>}
                    </div>
                  )}
                  <span className="ml-auto flex gap-2">
                    {j.status === "waiting_go" && <button type="button" className={primary} onClick={() => act("studioApprove", { id: j.id })}>Go: ~{money(j.estimate?.generation_usd)}</button>}
                    {["waiting_go", "queued"].includes(j.status) && <button type="button" className={ghost} onClick={() => act("studioCancel", { id: j.id })}>Cancel</button>}
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
