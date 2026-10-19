// Content Machine: the Accounts tab (owner, 2026-10-19). The two accounts' own settings (slideshows per day for the
// automatic run, brand rules, CTA style, posting times), and the Zyvo fact sheet: the only things the Zyvo account
// may claim, each with its source. Retired facts stay listed but are no longer offered to the writer.
import React, { useCallback, useEffect, useState } from "react";
import { api } from "./cmApi";

const input = "rounded-lg border border-white/15 bg-white/[0.05] px-2.5 py-2 text-[14px] text-white outline-none focus:border-lime-300/60";
const primary = "rounded-lg bg-lime-300 px-3 py-1.5 text-[13px] font-semibold text-[#071006] disabled:opacity-40";
const TONE = { zyvo: "border-violet-400/40 bg-violet-400/[0.05]", creator: "border-sky-400/40 bg-sky-400/[0.04]" };
const TITLE = { zyvo: "Zyvo account", creator: "Creator account" };
const PLATFORMS = [["tiktok", "TikTok"], ["instagram", "Instagram"], ["youtube", "YouTube"]];

function LaneCard({ lane, onSaved }) {
  const [f, setF] = useState(() => ({
    slideshows_per_day: String(lane.slideshows_per_day ?? 0), brand_rules: lane.brand_rules ?? "", cta_style: lane.cta_style ?? "",
    post_times: Object.fromEntries(PLATFORMS.map(([k]) => [k, (lane.post_times?.[k] ?? []).join(", ")])),
  }));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setNote(null);
    try { await api("saveLane", { key: lane.key, patch: { ...f, slideshows_per_day: Number(f.slideshows_per_day) } }); setNote("Saved."); onSaved(); } catch (err) { setNote(err.message); }
    setBusy(false);
  };
  return (
    <form onSubmit={save} className={`space-y-3 rounded-2xl border-2 p-4 ${TONE[lane.key]}`} data-testid={`cm-lane-settings-${lane.key}`}>
      <h2 className="text-[14px] font-extrabold uppercase tracking-[0.1em] text-white/80">{TITLE[lane.key]}</h2>
      <label className="block text-[12.5px] text-white/60">Slideshows per day (the automatic run)
        <input type="number" min={0} max={20} value={f.slideshows_per_day} onChange={(e) => setF({ ...f, slideshows_per_day: e.target.value })} className={`${input} mt-1 block w-28`} />
      </label>
      <label className="block text-[12.5px] text-white/60">Brand rules (this account's writer follows them)
        <textarea rows={6} value={f.brand_rules} onChange={(e) => setF({ ...f, brand_rules: e.target.value })} className={`${input} mt-1 block w-full font-mono text-[12.5px]`} />
      </label>
      <label className="block text-[12.5px] text-white/60">CTA style
        <input value={f.cta_style} onChange={(e) => setF({ ...f, cta_style: e.target.value })} className={`${input} mt-1 block w-full`} />
      </label>
      <div className="grid gap-2 sm:grid-cols-3">
        {PLATFORMS.map(([k, l]) => (
          <label key={k} className="text-[12.5px] text-white/60">{l} posting times (Helsinki)
            <input value={f.post_times[k]} onChange={(e) => setF({ ...f, post_times: { ...f.post_times, [k]: e.target.value } })} placeholder="12:00, 19:30" className={`${input} mt-1 block w-full`} />
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3"><button type="submit" disabled={busy} className={primary}>Save</button>{note && <span className="text-[12.5px] text-white/70">{note}</span>}</div>
    </form>
  );
}

const EMPTY = { key: "", category: "long_form", claim: "", detail: "", source: "" };
const CATEGORIES = ["long_form", "fruit_story", "blocky_stories", "short_templates", "clay_rescue", "image_generator", "pricing", "workflow", "other", "not_feature"];

function FactRow({ fact, onSaved }) {
  const [edit, setEdit] = useState(null);
  const [note, setNote] = useState(null);
  const save = async (patch) => { setNote(null); try { await api("saveFact", { id: fact.id, ...patch }); setEdit(null); onSaved(); } catch (e) { setNote(e.message); } };
  const off = fact.status !== "active";
  return (
    <li className={`py-2.5 ${off ? "opacity-50" : ""}`} data-testid="cm-fact">
      {edit ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={edit.claim} onChange={(e) => setEdit({ ...edit, claim: e.target.value })} className={`${input} sm:col-span-2`} aria-label="Claim" />
          <input value={edit.detail ?? ""} onChange={(e) => setEdit({ ...edit, detail: e.target.value })} className={input} aria-label="Detail" placeholder="Exact numbers / limits" />
          <input value={edit.source} onChange={(e) => setEdit({ ...edit, source: e.target.value })} className={input} aria-label="Source" placeholder="Repo path or tryzyvo.com page" />
          <div className="flex gap-2"><button type="button" onClick={() => save(edit)} className={primary}>Save</button><button type="button" onClick={() => setEdit(null)} className="text-[13px] text-white/60 underline">Cancel</button></div>
        </div>
      ) : (
        <div className="flex flex-wrap items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-[14px] text-white">{fact.category === "not_feature" && <b className="mr-1 text-red-200">NOT:</b>}{fact.claim} <span className="text-[11.5px] text-white/40">[{fact.key}]</span></div>
            {fact.detail && <div className="text-[12.5px] text-white/60">{fact.detail}</div>}
            <div className="truncate text-[11.5px] text-white/40" title={fact.source}>{fact.source}</div>
          </div>
          <button type="button" onClick={() => setEdit({ claim: fact.claim, detail: fact.detail, source: fact.source })} className="text-[12.5px] text-white/70 underline">Edit</button>
          <button type="button" onClick={() => save({ status: off ? "active" : "retired" })} className="text-[12.5px] text-white/70 underline">{off ? "Use again" : "Retire"}</button>
        </div>
      )}
      {note && <p className="mt-1 text-[12px] text-red-200">{note}</p>}
    </li>
  );
}

export function AccountsTab() {
  const [lanes, setLanes] = useState(null);
  const [facts, setFacts] = useState(null);
  const [add, setAdd] = useState(EMPTY);
  const [note, setNote] = useState(null);
  const load = useCallback(async () => {
    try { const [l, f] = await Promise.all([api("lanes"), api("facts")]); setLanes(l.lanes); setFacts(f.facts); } catch (e) { setNote(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const create = async (e) => {
    e.preventDefault(); setNote(null);
    try { await api("saveFact", add); setAdd(EMPTY); await load(); } catch (err) { setNote(err.message); }
  };
  if (!lanes || !facts) return <p className="text-[13px] text-white/50">{note ?? "Loading…"}</p>;
  const groups = CATEGORIES.map((c) => [c, facts.filter((f) => f.category === c)]).filter(([, l]) => l.length);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">{["zyvo", "creator"].filter((k) => lanes[k]).map((k) => <LaneCard key={k} lane={lanes[k]} onSaved={load} />)}</div>
      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5" data-testid="cm-facts">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-white/55">Zyvo facts</h2>
        <p className="mt-1 text-[12.5px] text-white/55">The only things the Zyvo account may claim. Every slide cites the facts it uses, and the compliance check compares each claim with this sheet. "NOT" facts are things Zyvo doesn't do: they're never claimed. Each fact needs its source.</p>
        {groups.map(([c, list]) => (
          <div key={c} className="mt-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-white/40">{c.replace(/_/g, " ")}</div>
            <ul className="divide-y divide-white/[0.06]">{list.map((f) => <FactRow key={f.id} fact={f} onSaved={load} />)}</ul>
          </div>
        ))}
        <form onSubmit={create} className="mt-4 grid gap-2 sm:grid-cols-2">
          <input value={add.key} onChange={(e) => setAdd({ ...add, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} placeholder="key, e.g. lf_music" className={input} aria-label="New fact key" />
          <select value={add.category} onChange={(e) => setAdd({ ...add, category: e.target.value })} className={input} aria-label="Category">{CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}</select>
          <input value={add.claim} onChange={(e) => setAdd({ ...add, claim: e.target.value })} placeholder="The claim, short and literally true" className={`${input} sm:col-span-2`} aria-label="New fact claim" />
          <input value={add.detail} onChange={(e) => setAdd({ ...add, detail: e.target.value })} placeholder="Exact numbers / limits (optional)" className={input} aria-label="New fact detail" />
          <input value={add.source} onChange={(e) => setAdd({ ...add, source: e.target.value })} placeholder="Source: repo path or tryzyvo.com page" className={input} aria-label="New fact source" />
          <div className="flex items-center gap-3 sm:col-span-2"><button type="submit" className={primary}>Add fact</button>{note && <span className="text-[12.5px] text-red-200">{note}</span>}</div>
        </form>
      </section>
    </div>
  );
}
