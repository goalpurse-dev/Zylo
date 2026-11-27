import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowUp, ChevronLeft, Clapperboard, Loader2, Plus, Send, Trash2 } from "lucide-react";
import { CREATE_PATH, DIRECTOR_LIMITS, QUICK_ASKS, creditsFor, newSceneId, speakSeconds, studioPath, styleById, variantOf } from "../../data/styles";
import { ChatScroll, ComposerDock, MetaChip, Thinking, UserBubble, ZyvoBubble } from "../../components/create/Chat";
import { PageGlow } from "../../components/create/PageGlow";
import { getDraft, reviseDraft, saveDraft } from "../../lib/director";
import { trackCreate } from "../../components/create/useCatalog";
import MakeChoice from "../../components/create/MakeChoice";
import ClaudeOption from "../../components/create/ClaudeOption";

const fmt = (s) => (s < 60 ? `${s}s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);
const field = "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[14px] text-white placeholder:text-white/30 focus:border-lime-300/40 focus:outline-none";

function Grow({ value, onChange, max, label, rows = 2, className = "" }) {
  const ref = useRef(null);
  useEffect(() => { const el = ref.current; if (!el) return; el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; }, [value]);
  return <textarea ref={ref} aria-label={label} rows={rows} value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} className={`${field} resize-none overflow-hidden ${className}`} />;
}

/** /create/director/:draftId: plan first, render last */
export default function DirectorPage() {
  const { draftId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(null);
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState("saved"); // saved | dirty | saving | error
  const [ask, setAsk] = useState("");
  const [asking, setAsking] = useState(false);
  const [pending, setPending] = useState(null); // the change being asked right now (shown as your message)
  const [editing, setEditing] = useState(false);
  const [choose, setChoose] = useState(false);
  const timer = useRef(null);
  const latest = useRef(null);
  const editedOnce = useRef(false);
  const autoAsked = useRef(false);

  useEffect(() => {
    let live = true;
    getDraft(draftId).then((r) => { if (live) { setDraft(r.draft); setPlan(r.plan ?? null); latest.current = r.draft; document.title = `${r.draft.title || "Your plan"} | Zyvo`; } })
      .catch((e) => live && setError(e.code === "SIGN_IN" ? "Sign in to see this plan." : e.message));
    return () => { live = false; };
  }, [draftId]);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const d = latest.current;
    if (!d) return d;
    setSaving("saving");
    try { const r = await saveDraft(d.id, { title: d.title, hook: d.hook, scenes: d.scenes }); setSaving("saved"); return r.draft; }
    catch { setSaving("error"); return d; }
  }, []);

  /** a local edit: shown at once, saved a moment later */
  const edit = (fn) => {
    setDraft((d) => { const next = fn(d); latest.current = next; return next; });
    setSaving("dirty");
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 900);
    if (!editedOnce.current) { editedOnce.current = true; trackCreate("plan_edited", { style: latest.current?.style_id }); }
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  const setScene = (i, patch) => edit((d) => ({ ...d, scenes: d.scenes.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const move = (i, by) => edit((d) => { const s = [...d.scenes]; const [x] = s.splice(i, 1); s.splice(i + by, 0, x); return { ...d, scenes: s }; });
  const remove = (i) => edit((d) => ({ ...d, scenes: d.scenes.filter((_, j) => j !== i) }));
  const add = () => edit((d) => ({ ...d, scenes: [...d.scenes, { id: newSceneId(), narration: "", visual: "", camera: "", seconds: 3 }] }));

  const send = useCallback(async (text, chip = null) => {
    const t = String(text ?? "").trim();
    if (!t || asking) return;
    setAsking(true); setError(null); setPending(t);
    try {
      await flush();
      const r = await reviseDraft(draftId, t);
      setDraft(r.draft); latest.current = r.draft; setAsk("");
      trackCreate("plan_chat_used", { style: r.draft.style_id, chip: chip ?? "free_text" });
    } catch (e) { setError(e.message); }
    finally { setAsking(false); setPending(null); }
  }, [asking, draftId, flush]);

  // "Change something" from a results page arrives as ?ask=: sent once, then taken off the address
  useEffect(() => {
    const a = params.get("ask");
    if (!draft || !a || autoAsked.current) return;
    autoAsked.current = true;
    setParams({}, { replace: true });
    setAsk(a);
    send(a, "from_result");
  }, [draft, params, setParams, send]);

  if (error && !draft) return <div className="mx-auto max-w-[720px] px-4 py-16 text-center text-white/70"><p>{error}</p><Link to={CREATE_PATH} className="mt-4 inline-block font-semibold text-lime-300">Back to Create</Link></div>;
  if (!draft) return <div className="grid place-items-center py-24"><Loader2 className="h-6 w-6 animate-spin text-lime-300" aria-label="Loading" /></div>;

  const style = styleById(draft.style_id);
  const total = draft.scenes.reduce((a, s) => a + (Number(s.seconds) || 0), 0);
  const credits = style ? creditsFor(style, total) : null;
  const target = draft.length_sec;

  const variant = variantOf(style, draft.extras?.variant);
  const sceneEditor = (
    <ol className="mt-3 space-y-3" data-testid="scene-list">
      {draft.scenes.map((s, i) => (
        <li key={s.id} className="rounded-2xl border border-white/[0.08] bg-black/25 p-3" data-testid="scene-card">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-lime-300/15 px-2.5 py-0.5 text-[12px] font-black text-lime-200">Scene {i + 1}</span>
            <label className="flex items-center gap-1 text-[12px] text-white/70">
              <input type="number" min={1} max={DIRECTOR_LIMITS.sceneSecMax} value={s.seconds} onChange={(e) => setScene(i, { seconds: Math.max(1, Math.min(DIRECTOR_LIMITS.sceneSecMax, Number(e.target.value) || 1)) })} className="w-12 rounded-md border border-white/10 bg-black/30 px-1.5 py-0.5 text-center text-[12px] text-white" aria-label={`Scene ${i + 1} seconds`} />
              seconds
            </label>
            {s.narration && speakSeconds(s.narration) > s.seconds + 1 && <span className="text-[11px] text-amber-300">a bit long to say in {s.seconds}s</span>}
            <div className="ml-auto flex items-center gap-1">
              <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-white/75 hover:bg-white/[0.08] disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" />Up</button>
              <button type="button" disabled={i === draft.scenes.length - 1} onClick={() => move(i, 1)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-white/75 hover:bg-white/[0.08] disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" />Down</button>
              <button type="button" disabled={draft.scenes.length <= 1} onClick={() => remove(i)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-white/75 hover:bg-rose-400/10 hover:text-rose-300 disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" />Delete</button>
            </div>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-lime-200/70">The voice says</p>
              <Grow label={`Scene ${i + 1}: the voice says`} value={s.narration} max={DIRECTOR_LIMITS.narrationMax} onChange={(v) => setScene(i, { narration: v })} />
            </div>
            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-lime-200/70">We see</p>
              <Grow label={`Scene ${i + 1}: we see`} value={s.visual} max={DIRECTOR_LIMITS.visualMax} onChange={(v) => setScene(i, { visual: v })} />
              <input aria-label={`Scene ${i + 1}: camera`} value={s.camera} maxLength={DIRECTOR_LIMITS.cameraMax} onChange={(e) => setScene(i, { camera: e.target.value })} placeholder="Camera, e.g. slow push in" className={`${field} mt-2 py-1.5 text-[13px]`} />
            </div>
          </div>
        </li>
      ))}
      <li>
        <button type="button" onClick={add} disabled={draft.scenes.length >= DIRECTOR_LIMITS.scenesMax} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 py-3 text-[14px] font-semibold text-white/80 hover:border-lime-300/40 hover:text-lime-200"><Plus className="h-4 w-4" />Add scene</button>
      </li>
    </ol>
  );

  return (
    <div className="relative isolate flex min-h-full flex-col overflow-x-clip">
      <PageGlow />
      <div className="mx-auto flex w-full max-w-[820px] items-center gap-2 px-4 pt-4">
        <Link to={draft.studio_id ? studioPath(draft.studio_id) : CREATE_PATH} className="inline-flex items-center gap-1 text-[13px] font-semibold text-white/70 hover:text-white"><ChevronLeft className="h-4 w-4" />Back</Link>
        <span className="ml-auto text-[12px] text-white/60" aria-live="polite">{saving === "saving" ? "Saving…" : saving === "dirty" ? "Not saved yet" : saving === "error" ? "Couldn't save. We'll try again." : "Saved"}</span>
      </div>
      <h1 className="sr-only">Your video plan</h1>

      <div className="relative flex-1">
        <ChatScroll deps={[draft.chat?.length, pending, asking]}>
          {/* your idea */}
          <UserBubble meta={<>
            {style && <MetaChip>{style.name}{variant ? ` · ${variant.name}` : ""}</MetaChip>}
            <MetaChip>{fmt(target)}</MetaChip>
            <MetaChip>{draft.format === "16:9" ? "Wide" : "Tall"}</MetaChip>
            {draft.extras?.where === "claude" && <MetaChip>With your Claude</MetaChip>}
          </>}>{draft.idea || draft.title}</UserBubble>

          {/* Zyvo's plan: the storyboard, editable in place */}
          <ZyvoBubble wide>
            <p>Here's your plan: <b className="text-white">{draft.scenes.length} scenes, {fmt(total)}</b>{Math.abs(total - target) > 3 ? <span className="text-amber-300"> (you picked {fmt(target)})</span> : null}. Change anything below, or ask me in the chat.</p>
            <div className="mt-3 flex items-center gap-2">
              {style && <img src={variant?.poster ?? style.poster} alt="" className="h-9 w-9 rounded-xl object-cover" />}
              <div className="min-w-0 flex-1">
                <label className="sr-only" htmlFor="dir-title">Title</label>
                <input id="dir-title" value={draft.title} maxLength={DIRECTOR_LIMITS.titleMax} onChange={(e) => edit((d) => ({ ...d, title: e.target.value }))} className="w-full bg-transparent text-[18px] font-black text-white focus:outline-none" />
              </div>
            </div>
            <label className="mt-2 block text-[11px] font-bold uppercase tracking-wide text-lime-200/70" htmlFor="dir-hook">Hook (the first thing people hear)</label>
            <input id="dir-hook" value={draft.hook} maxLength={DIRECTOR_LIMITS.hookMax} onChange={(e) => edit((d) => ({ ...d, hook: e.target.value }))} className={`${field} mt-1`} />
            {editing ? sceneEditor : (
              <ol className="mt-3 space-y-1.5">
                {draft.scenes.map((s, i) => (
                  <li key={s.id} className="flex gap-2.5 rounded-xl bg-black/20 px-3 py-2">
                    <span className="mt-0.5 shrink-0 rounded-md bg-lime-300/15 px-1.5 text-[11px] font-black text-lime-200">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] text-white">{s.narration || <i className="text-white/50">No words yet</i>}</span>
                      <span className="block truncate text-[12px] text-white/60">{s.visual}{s.camera ? ` · ${s.camera}` : ""}</span>
                    </span>
                    <span className="shrink-0 text-[12px] text-white/60">{s.seconds}s</span>
                  </li>
                ))}
              </ol>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setEditing((v) => !v)} className="rounded-xl border border-white/15 px-3 py-2 text-[13px] font-bold text-white hover:border-white/30" data-testid="edit-scenes">{editing ? "Done editing" : "Edit scenes"}</button>
              <button type="button" onClick={async () => { await flush(); setChoose(true); }} className="inline-flex items-center gap-2 rounded-xl bg-lime-300 px-4 py-2 text-[14px] font-black text-[#11150D] shadow-[0_0_24px_rgba(190,242,100,.3)] hover:bg-lime-200" data-testid="make-video">
                <Clapperboard className="h-4 w-4" />Make video
              </button>
              {credits != null && <span className="text-[13px] text-white/70">about <b className="text-white">{credits}</b> credits on Zyvo</span>}
            </div>
          </ZyvoBubble>

          {/* the changes you asked for, and what Zyvo did */}
          {(draft.chat ?? []).map((c, i) => (
            <div key={`${c.at}-${i}`} className="flex flex-col gap-4">
              <UserBubble>{c.ask}</UserBubble>
              <ZyvoBubble>{c.reply || "Done. I changed only what you asked; the plan above is updated."}</ZyvoBubble>
            </div>
          ))}
          {asking && pending && (
            <div className="flex flex-col gap-4">
              <UserBubble>{pending}</UserBubble>
              <ZyvoBubble><Thinking label="Changing the plan…" /></ZyvoBubble>
            </div>
          )}
          {draft.status === "sent_claude" && <ZyvoBubble>You took this plan to your Claude. Paste the prompt into a new Claude chat; the finished video lands in your Library.</ZyvoBubble>}
          {draft.status === "sent_zyvo" && <ZyvoBubble>This plan was sent to {style?.name ?? "its template"} on Zyvo. <Link to={draft.result_url || style?.engine.path || CREATE_PATH} className="font-bold text-lime-300 hover:underline">Open it</Link></ZyvoBubble>}
          {error && <ZyvoBubble><span className="text-rose-300">{error}</span></ZyvoBubble>}
        </ChatScroll>
      </div>

      <ComposerDock>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          {QUICK_ASKS.map((q) => <button key={q.id} type="button" disabled={asking} onClick={() => send(q.ask, q.id)} className="shrink-0 rounded-full border border-white/12 bg-white/[0.05] px-3 py-1.5 text-[13px] font-semibold text-white/90 hover:border-lime-300/40 disabled:opacity-50">{q.label}</button>)}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); send(ask); }} className="mt-2 flex items-end gap-2">
          <label htmlFor="dir-ask" className="sr-only">What should change?</label>
          <textarea id="dir-ask" rows={1} value={ask} maxLength={DIRECTOR_LIMITS.askMax} onChange={(e) => setAsk(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(ask); } }}
            placeholder="Ask for a change…" className="min-h-[44px] flex-1 resize-none bg-transparent px-1 py-2.5 text-[16px] leading-6 text-white placeholder:text-white/45 focus:outline-none" />
          <button type="submit" disabled={asking || !ask.trim()} className="mb-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3.5 py-2.5 text-[14px] font-black text-black disabled:opacity-50">{asking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}<span className="hidden sm:inline">{asking ? "Changing…" : "Send"}</span></button>
        </form>
        <p className="mt-1 hidden text-[11.5px] text-white/55 sm:block">Changes are free and only what you ask for changes. Try: &quot;change scene 2 so he finds a door&quot;.</p>
      </ComposerDock>
      {choose && style && <MakeChoice draft={latest.current ?? draft} style={style} plan={plan} onClose={() => setChoose(false)} navigate={navigate} ClaudeOption={ClaudeOption} />}
    </div>
  );
}
