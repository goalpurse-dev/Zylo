import { useEffect, useState } from "react";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Clapperboard, Link2, Pencil, RotateCw, X } from "lucide-react";
import StoryboardSketch from "./StoryboardSketch";
import StylePicker from "./StylePicker";
import { getStylePreset, parseVersionedId } from "./stylePresets";
import { SHOTS, TYPES, CATEGORIES, beatBadge, beatPatch, chapterGroups, continuityLabels, editWarnings, storyboardStats, timeRange } from "./storyboardModel";

const fieldClass = "mt-2 w-full rounded-xl border border-white/15 bg-[#181c1c] p-3 text-sm text-white focus:border-lime-300 focus:outline-none";
const buttonClass = "rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/10 disabled:opacity-40";
function SceneMark({ beat, large = false, visualStylePreset }) {
  const frame=beat.productionFrame;
  return <div className={`overflow-hidden rounded-xl border border-white/10 ${large ? "w-full" : "w-full shrink-0 sm:w-36"}`}>
    {frame?.referenceBacked && frame?.status==="ready" && frame?.url ? <img className="aspect-video w-full object-cover" src={frame.url} alt={beat.informationToCommunicate}/> : <StoryboardSketch beat={beat} compact={!large} visualStylePreset={visualStylePreset}/>}
  </div>;
}
function BeatCard({ beat, number, chapter, script, continuity, onEdit, visualStylePreset }) {
  const excerpt = beat.narrationRanges?.length ? beat.narrationRanges.map(r=>script?.narrationSegments?.find(s=>s.id===r.segmentId)?.text?.slice(r.startChar,r.endChar)).filter(Boolean).join(" ") : (beat.narrationSegmentIds ?? []).map(id => script?.narrationSegments?.find(s => s.id === id)?.text).filter(Boolean).join(" ");
  return <article className="rounded-2xl border border-white/10 bg-white/[.025] p-4">
    <div className="flex flex-col gap-4 sm:flex-row">
      <div className="w-full sm:w-auto"><SceneMark beat={beat} visualStylePreset={visualStylePreset} /></div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/40"><span className="font-bold text-white/70">Shot {String(number).padStart(2, "0")}</span><span>Chapter {chapter}</span><span>{timeRange(beat)}</span><span className={`rounded-full px-2 py-1 ${beat.shotStrategy === "REUSE_WITH_DELTA" ? "bg-sky-300/10 text-sky-200" : "bg-lime-300/10 text-lime-200"}`}>{beatBadge(beat)}</span></div>
        <p className="mt-2 text-sm leading-relaxed text-white/85">{beat.informationToCommunicate}</p>
        {excerpt && <p className="mt-2 line-clamp-2 text-xs italic leading-relaxed text-white/40">“{excerpt}”</p>}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-white/45"><span>{SHOTS[beat.shotSize] ?? "Planned shot"}</span>{continuity && <span className="inline-flex items-center gap-1.5 text-sky-200/70"><Link2 className="h-3 w-3" />{continuity}</span>}</div>
      </div>
      {onEdit && <button className="self-start rounded-lg p-2 text-lime-300 hover:bg-white/10" aria-label={`Edit shot ${number}`} onClick={onEdit}><Pencil className="h-4 w-4" /></button>}
    </div>
  </article>;
}
function BeatEditor({ beat, row, onApply, onCancel }) {
  const entities = row.entity_registry ?? [];
  const characters = entities.filter(e => e.category === "CHARACTER");
  const [draft, setDraft] = useState(() => ({ ...beat, characterIds: beat.characterIds ?? characters.filter(e => [...(beat.primaryEntityIds ?? []), ...(beat.supportingEntityIds ?? [])].includes(e.id)).map(e => e.id) }));
  const [error, setError] = useState("");
  const warnings = editWarnings(beat, draft);
  const shortDetail = !row.visual_plan?.shotPlannerVersion || beat.estimatedEndSeconds-beat.estimatedStartSeconds<=7;
  const set = (key, value) => setDraft(current => ({ ...current, [key]: value }));
  return <form className="mt-3 rounded-2xl border border-lime-300/30 bg-[#141b17] p-5" onSubmit={event => { event.preventDefault(); try { onApply(beatPatch(beat, draft)); } catch (e) { setError(e.message); } }}>
    <h3 className="font-semibold text-white">Edit this scene</h3>
    <p className="mt-1 text-xs text-white/45">Your narration and its timing stay attached.</p>
    <label className="mt-5 block text-xs font-semibold text-white/70">What the viewer sees<textarea autoFocus value={draft.informationToCommunicate} maxLength={3000} rows={4} className={fieldClass} onChange={e => set("informationToCommunicate", e.target.value)} /></label>
    <div className="mt-4 grid grid-cols-2 gap-4">
      <label className="text-xs font-semibold text-white/70">Shot<select aria-label="Shot" className={fieldClass} value={draft.shotSize} onChange={e => set("shotSize", e.target.value)}>{Object.entries(SHOTS).map(([value, label]) => <option disabled={!shortDetail&&["DETAIL","INSERT"].includes(value)} key={value} value={value}>{label}</option>)}</select></label>
      <label className="text-xs font-semibold text-white/70">Visual type<select aria-label="Visual type" className={fieldClass} value={draft.visualType} onChange={e => set("visualType", e.target.value)}>{Object.entries(TYPES).map(([value, label]) => <option disabled={!shortDetail&&value==="OBJECT_DETAIL"} key={value} value={value}>{label}</option>)}</select></label>
    </div>
    <label className="mt-4 block text-xs font-semibold text-white/70">Location<select aria-label="Location" className={fieldClass} value={draft.locationId ?? ""} onChange={e => set("locationId", e.target.value)}><option value="">No specific location</option>{entities.filter(e => e.category === "LOCATION").map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
    {characters.length > 0 && <fieldset className="mt-4"><legend className="text-xs font-semibold text-white/70">Characters</legend><div className="mt-2 flex flex-wrap gap-3">{characters.map(e => <label key={e.id} className="flex items-center gap-2 rounded-lg border border-white/10 p-2 text-xs text-white/70"><input type="checkbox" checked={draft.characterIds.includes(e.id)} onChange={event => set("characterIds", event.target.checked ? [...draft.characterIds, e.id] : draft.characterIds.filter(id => id !== e.id))} />{e.name}</label>)}</div></fieldset>}
    {warnings.map(w => <p key={w} className="mt-3 text-xs leading-relaxed text-amber-200/80">{w}</p>)}
    {(beat.factualVisualConstraints?.length > 0 || beat.forbiddenElements?.length > 0 || beat.revealConstraints?.length > 0) && <details className="mt-3 text-xs text-white/50"><summary className="cursor-pointer">Scene guidance</summary><ul className="mt-2 list-disc space-y-1 pl-4">{(beat.factualVisualConstraints ?? []).map((c, i) => <li key={`fact-${i}`}>{c.description}</li>)}{(beat.forbiddenElements ?? []).map((c, i) => <li key={`avoid-${i}`}>Avoid: {c}</li>)}{(beat.revealConstraints ?? []).map((c, i) => <li key={`reveal-${i}`}>{c}</li>)}</ul></details>}
    {error && <p role="alert" className="mt-3 text-sm text-red-200">{error}</p>}
    <div className="mt-5 flex gap-3"><button type="submit" className="rounded-xl bg-lime-300 px-4 py-2.5 text-sm font-bold text-black">Apply to draft</button><button type="button" className={buttonClass} onClick={onCancel}>Cancel</button></div>
  </form>;
}
export function FullStoryboard({ row, script, onClose, onSave, readOnly = false, visualStylePreset, focusBeatIds = [] }) {
  const [editing, setEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  // 2026-09-22 structured readiness routing fix — arriving here from a
  // Generate-page "Fix Storyboard" CTA with specific conflicting shot ids:
  // scroll straight to the first one instead of dropping the user at the
  // top of a 175-shot list to hunt for it themselves.
  useEffect(() => {
    if (!focusBeatIds.length) return;
    const el = document.getElementById(`storyboard-beat-${focusBeatIds[0]}`);
    if (el) requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", block: "center" }));
  }, [focusBeatIds]);
  const [patches, setPatches] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [discard, setDiscard] = useState(false);
  const groups = chapterGroups(row, script);
  const continuity = continuityLabels(row);
  const original = row.visual_plan?.visualBeats ?? [];
  const dirty = Object.keys(patches).length > 0 || editingId;
  function close() { if (saving) return; if (dirty) setDiscard(true); else onClose(); }
  async function save() {
    setSaving(true); setError("");
    try { await onSave(Object.values(patches)); setPatches({}); setEditing(false); setEditingId(null); }
    catch (e) { setError(e.message || "Could not save. Your draft is still here."); }
    finally { setSaving(false); }
  }
  return <Dialog open onClose={close} className="relative z-[100]">
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" aria-hidden="true" />
    <div className="fixed inset-0 flex items-center justify-center sm:p-5"><DialogPanel className="flex h-full w-full max-w-6xl flex-col overflow-hidden bg-[#101414] text-white sm:h-[92vh] sm:rounded-2xl sm:border sm:border-white/15">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4 sm:px-6"><div><DialogTitle className="text-lg font-bold">Full Storyboard</DialogTitle><p className="mt-1 text-xs text-white/45">{original.length} shots · Estimated timing · Narration stays attached</p></div><div className="flex items-center gap-2">{!readOnly && <button type="button" className={buttonClass} disabled={saving} aria-pressed={editing} onClick={() => { setEditing(!editing); setEditingId(null); }}>{editing ? "Finish editing" : "Edit Storyboard"}</button>}<button type="button" aria-label="Close storyboard" onClick={close} className="rounded-lg p-2 hover:bg-white/10"><X className="h-5 w-5" /></button></div></header>
      <nav aria-label="Storyboard chapters" className="flex shrink-0 gap-2 overflow-x-auto border-b border-white/10 px-4 py-3">{groups.map(g => <a key={g.id} href={`#storyboard-chapter-${g.number}`} className="whitespace-nowrap rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/65 hover:border-lime-300/50">{String(g.number).padStart(2, "0")} {g.title}</a>)}</nav>
      <div className="min-h-0 flex-1 overflow-y-auto scroll-smooth px-4 py-6 sm:px-8">
        {editing && <p className="mb-5 text-sm text-lime-200">Choose a scene to edit. Apply changes to your draft, then save a new version.</p>}
        {groups.map(group => <section id={`storyboard-chapter-${group.number}`} key={group.id} className="mb-9 scroll-mt-6"><div className="mb-4"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-lime-300/70">Chapter {group.number}</p><h3 className="mt-1 text-xl font-semibold">{group.title}</h3></div>{(group.sequences.length ? group.sequences : [{id:group.id,number:1,beats:group.beats}]).map(sequence => <div key={sequence.id} className="mb-7"><h4 className="mb-2 text-xs font-bold uppercase tracking-widest text-lime-200/60">Sequence {sequence.number}{sequence.purpose ? ` · ${timeRange(sequence)}` : ""}</h4>{sequence.purpose && <p className="mb-4 max-w-3xl text-sm leading-relaxed text-white/45">{sequence.purpose}</p>}<div className="space-y-3">{sequence.beats.map(beat => {
          const patch = patches[beat.id];
          const display = { ...beat, ...patch };
          const focused = focusBeatIds.includes(beat.id);
          return <div key={beat.id} id={`storyboard-beat-${beat.id}`} className={focused ? "scroll-mt-6 rounded-xl ring-2 ring-amber-400/70" : "scroll-mt-6"}>{focused && <p className="mb-1.5 px-1 text-[11px] font-semibold text-amber-300">Needs replanning — resolves to nearly the same visual as another nearby shot</p>}<BeatCard beat={display} number={original.indexOf(beat) + 1} chapter={group.number} script={script} continuity={continuity.get(beat.id)} onEdit={editing && !saving ? () => setEditingId(beat.id) : null} visualStylePreset={visualStylePreset} />{patch && <p className="mt-1 px-2 text-[11px] text-lime-200/60">Edited in draft</p>}{editingId === beat.id && <BeatEditor key={beat.id} beat={display} row={row} onCancel={() => setEditingId(null)} onApply={value => { setPatches(old => ({ ...old, [beat.id]: value })); setEditingId(null); }} />}</div>;
        })}</div></div>)}</section>)}
      </div>
      {(Object.keys(patches).length > 0 || error) && <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-[#141919] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"><div><p className="text-sm">{Object.keys(patches).length} edited scenes</p><p className="text-xs text-white/45">Saves a new version. Earlier storyboards remain intact.</p>{error && <p role="alert" className="mt-2 text-sm text-red-200">{error}</p>}</div><button disabled={saving || Boolean(editingId)} className="rounded-xl bg-lime-300 px-5 py-3 text-sm font-bold text-black disabled:opacity-40" onClick={save}>{saving ? "Saving…" : "Save storyboard"}</button></footer>}
      {discard && <div className="absolute inset-0 grid place-items-center bg-black/80 p-5"><div className="rounded-2xl border border-white/15 bg-[#18201b] p-6"><h3 className="font-bold">Discard unsaved edits?</h3><p className="mt-2 text-sm text-white/55">Your saved storyboard will stay unchanged.</p><div className="mt-5 flex gap-3"><button className={buttonClass} onClick={() => setDiscard(false)}>Keep editing</button><button className={buttonClass} onClick={onClose}>Discard edits</button></div></div></div>}
    </DialogPanel></div>
  </Dialog>;
}
export default function StoryboardWorkspace({ row, script, onRegenerate, onBuildWorld, onContinueToScenes, onBackToNarration, onSave, busy = false, stale = false, visualStylePreset, visualWorldExists = false, resumeState, onChangeVisualStyle, replanReview = null, onAdoptPlan, focusBeatIds = [] }) {
  const [open, setOpen] = useState(false);
  // 2026-09-22 structured readiness routing fix — arriving here from
  // Generate's "Fix Storyboard" CTA opens the full storyboard straight to
  // the conflicting shots, instead of landing on the summary view.
  useEffect(() => { if (focusBeatIds.length) setOpen(true); }, [focusBeatIds]);
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState(null);
  const [saved, setSaved] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingStyle, setPendingStyle] = useState(null); // set only while the post-Visual-World confirm dialog is open
  // Item 2 of the 2026-09-19 "fix the missing production workflow" pass:
  // set only while the "Create a new visual plan?" confirmation is open.
  const [replanConfirmOpen, setReplanConfirmOpen] = useState(false);
  const beats = row.visual_plan?.visualBeats ?? [];
  const groups = chapterGroups(row, script);
  const stats = storyboardStats(row);
  // Item 3: "show old vs new shot-strategy summary" — the SAME storyboardStats
  // function run against the still-active previous plan, so the comparison
  // is real numbers, never an invented summary.
  const previousStats = replanReview?.previousPlan ? storyboardStats(replanReview.previousPlan) : null;
  const continuity = continuityLabels(row);
  const representative = selected === null ? null : beats[Math.min(selected, beats.length - 1)];
  const entities = row.entity_registry ?? [];
  const currentStyle = getStylePreset(parseVersionedId(visualStylePreset).id);

  // Part 4: this page must never claim downstream work hasn't happened.
  // `resumeState` is the SAME authoritative resolver every other Long Form
  // entry point uses (long_form_project_resume_state) — route "look" means
  // genuinely nothing downstream exists yet (the only case that still shows
  // "Build Visual World"); "visual-world"/"generate" mean it's real and the
  // CTA/label must say so instead of pretending otherwise.
  const downstreamBuilt = resumeState && resumeState.route !== "look";
  const buildCta = !downstreamBuilt ? { label: "Build Visual World", action: onBuildWorld, disabled: busy || stale }
    : resumeState.route === "visual-world" ? { label: "Continue to Visual World", action: onBuildWorld, disabled: busy }
    : resumeState.needsReview > 0 ? { label: "Review Scenes", action: onContinueToScenes, disabled: busy }
    : { label: "Continue to Scenes", action: onContinueToScenes, disabled: busy };

  // Style picker confirms a versioned preset id — before a Visual World
  // exists (Part 10) the change is instant/free; once one exists (Part 11)
  // changing style would invalidate its canonical references, so confirm
  // first rather than silently mixing styles. Either way the Storyboard
  // itself (sequences/beats/timings/EntityRegistry) is never touched.
  function handleStyleConfirm(nextPreset) {
    setPickerOpen(false);
    if (visualWorldExists && nextPreset !== visualStylePreset) setPendingStyle(nextPreset);
    else onChangeVisualStyle?.(nextPreset);
  }

  const controls = <><p className="text-[10px] font-bold uppercase tracking-[.2em] text-lime-300/70">Visual direction</p><h2 className="mt-3 text-2xl font-semibold leading-tight text-white">Give your story<br />a visual language.</h2><div className="mt-7 space-y-5">
    <div>
      <p className="text-xs text-white/40">Visual style</p>
      <button type="button" onClick={() => setPickerOpen(true)} className="mt-2 flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-left transition hover:border-white/25 hover:bg-white/[0.04]">
        {currentStyle.previewAsset ? (
          <img src={currentStyle.previewAsset} alt="" className="h-16 w-24 shrink-0 rounded-lg object-cover" aria-hidden="true" onError={(e) => { e.currentTarget.style.background = `linear-gradient(135deg, ${currentStyle.sketchTheme.paper}, ${currentStyle.sketchTheme.structureFill})`; e.currentTarget.removeAttribute("src"); }} />
        ) : (
          <span className="h-16 w-24 shrink-0 overflow-hidden rounded-lg" style={{ background: `linear-gradient(135deg, ${currentStyle.sketchTheme.paper}, ${currentStyle.sketchTheme.structureFill})` }} aria-hidden="true" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-white/90">{currentStyle.name}</span>
          <span className="block truncate text-[11px] text-white/40">{currentStyle.descriptors.join(" · ")}</span>
        </span>
        <span className="shrink-0 text-[11px] font-semibold text-lime-300">Change</span>
      </button>
    </div>
    <div><p className="text-xs text-white/40">Visual approach</p><p className="mt-1 text-sm font-semibold text-white/85">{{ STORY: "Story-driven", EXPLAINER: "Explainer", HYBRID: "Hybrid" }[row.visual_mode] ?? "Hybrid"}</p></div></div><div className="mt-7 border-t border-white/10 pt-5"><p className="mb-4 text-[10px] font-bold uppercase tracking-[.16em] text-white/40">Planned world</p><dl className="space-y-3">{Object.entries(CATEGORIES).map(([key, label]) => <div key={key} className="flex justify-between text-sm"><dt className="text-white/50">{label}</dt><dd className="font-semibold text-white/85">{stats.counts[key]}</dd></div>)}<div className="flex justify-between text-sm"><dt className="text-white/50">Diagrams / maps</dt><dd>{stats.diagrams + stats.maps}</dd></div></dl></div><p className="mt-6 text-xs leading-relaxed text-white/35">Review the storyboard and refine individual scenes before building reusable references.</p></>;
  return <div className="flex min-h-0 flex-1 flex-col gap-5 lg:flex-row lg:gap-0">
    <aside className="flex min-h-0 shrink-0 flex-col rounded-2xl border border-white/10 bg-[#111616] lg:w-[350px] lg:rounded-r-none lg:border-r-0">
      {onBackToNarration && (
        <button type="button" onClick={onBackToNarration} className="flex shrink-0 items-center gap-1.5 border-b border-white/10 px-4 py-3 text-[12.5px] font-semibold text-white/45 transition hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Narration
        </button>
      )}
      <button className="flex items-center justify-between p-4 text-sm font-semibold text-white lg:hidden" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>Visual direction · {stats.beats} shots<ChevronDown className={`h-4 w-4 ${expanded ? "rotate-180" : ""}`} /></button><div className={`${expanded ? "block" : "hidden"} min-h-0 flex-1 overflow-y-auto p-6 lg:block`}>{controls}</div><footer className="fixed inset-x-3 bottom-[calc(78px+env(safe-area-inset-bottom))] z-40 space-y-2 rounded-2xl border border-white/10 bg-[#151b17]/95 p-3 backdrop-blur-xl lg:static lg:rounded-none lg:border-x-0 lg:border-b-0 lg:p-5">
      {downstreamBuilt && (
        <p className="flex items-center gap-1.5 px-1 text-[11px] font-semibold text-lime-300">
          <Check className="h-3.5 w-3.5" />Visual World built
          {resumeState.route === "generate" && resumeState.needsReview > 0 && <span className="text-amber-300"> · {resumeState.needsReview} need review</span>}
        </p>
      )}
      {/* Item 2 of the 2026-09-19 pass: "Replan Episode Visuals" only once
          there's something real downstream (Visual World or Generate) that
          a silent regenerate could otherwise disrupt — that's exactly when
          the distinction from a plain "Regenerate Storyboard" (a project
          that hasn't built anything yet — nothing to preserve, nothing to
          confirm) actually matters. Both paths call the SAME onRegenerate;
          only the copy and the confirm gate differ. */}
      <button disabled={busy} className={`${buttonClass} flex w-full items-center justify-center gap-2`} onClick={() => (downstreamBuilt ? setReplanConfirmOpen(true) : onRegenerate())}>
        <RotateCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
        {stale ? "Update Storyboard" : downstreamBuilt ? "Replan Episode Visuals ↻" : "Regenerate Storyboard"}
      </button>
      <button disabled={buildCta.disabled} onClick={buildCta.action} className="flex w-full items-center justify-center gap-2 rounded-xl bg-lime-300 px-4 py-3 text-sm font-bold text-[#11180c] disabled:opacity-40">{buildCta.label}<ArrowRight className="h-4 w-4" /></button></footer></aside>
    <main className="min-h-0 min-w-0 flex-1 rounded-2xl border border-white/10 bg-[#0e1212] p-5 pb-56 lg:overflow-y-auto lg:rounded-l-none lg:p-8">
      {stale && <p className="mb-5 rounded-xl bg-amber-200/10 p-3 text-sm text-amber-200">This storyboard belongs to an earlier script. Update it to match your narration.</p>}
      {/* Item 3: "show the new storyboard, show old vs new shot-strategy
          summary, let me inspect it... then Visual World compatibility must
          be checked... Do not charge anything until I explicitly click
          Generate/Rebuild." This is that review — the plan shown above/below
          is already the NEW one; nothing downstream (Generate, the active
          plan pointer) has moved yet. */}
      {replanReview && (
        <div className="mb-5 rounded-xl border border-sky-400/25 bg-sky-400/[0.06] p-4">
          <p className="text-sm font-semibold text-sky-100">A new visual plan is ready for review</p>
          <p className="mt-1 text-xs leading-relaxed text-sky-200/70">Your current plan is still active — nothing changes until you use this one.</p>
          {previousStats && (
            <dl className="mt-3 grid grid-cols-3 gap-3 text-xs sm:grid-cols-3">
              <div><dt className="text-sky-200/50">Visual beats</dt><dd className="mt-0.5 font-semibold text-white">{previousStats.beats} → {stats.beats}</dd></div>
              <div><dt className="text-sky-200/50">Sequences</dt><dd className="mt-0.5 font-semibold text-white">{previousStats.sequences} → {stats.sequences}</dd></div>
              <div><dt className="text-sky-200/50">Recurring setups</dt><dd className="mt-0.5 font-semibold text-white">{previousStats.setups} → {stats.setups}</dd></div>
            </dl>
          )}
          {replanReview.compatibility && (
            <p className="mt-3 text-xs text-sky-200/70">
              {replanReview.compatibility.compatible
                ? `Your current Visual World already covers everything this plan needs (${replanReview.compatibility.reusableCount} reference${replanReview.compatibility.reusableCount === 1 ? "" : "s"}) — no new references would need to be generated.`
                : `${replanReview.compatibility.reusableCount} of ${replanReview.compatibility.totalRequired} required references can be reused; ${replanReview.compatibility.missingCount} new reference${replanReview.compatibility.missingCount === 1 ? "" : "s"} would be needed: ${replanReview.compatibility.missing.map((m) => m.name).join(", ")}.`}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button disabled={busy} onClick={onAdoptPlan} className="rounded-xl bg-lime-300 px-4 py-2.5 text-xs font-bold text-[#11150D] transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-40">Use This Plan</button>
          </div>
        </div>
      )}
      <div className="mb-6 flex items-start justify-between gap-3"><div><div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.16em] text-lime-200/70"><Check className="h-3 w-3" />{saved ? "Changes saved" : "Storyboard ready"}</div><h1 className="text-[28px] font-bold tracking-tight text-white">Your Storyboard</h1><p className="mt-2 max-w-xl text-sm leading-relaxed text-white/45">Zyvo mapped each part of your narration to the visuals the viewer should see.</p></div><Clapperboard className="mt-5 hidden h-7 w-7 text-white/20 sm:block" /></div>
      {beats.length > 0 && <section aria-label="Storyboard filmstrip" className="overflow-hidden rounded-2xl border border-white/10 bg-[#121918]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-xs"><span className="font-semibold text-white/70">First sequence · Director sketches</span><span className="text-white/35">Estimated timing</span></div>
        <div className="grid grid-cols-2 gap-px bg-white/10 xl:grid-cols-3">{beats.slice(0,6).map((beat,i)=><button key={beat.id} onClick={()=>setSelected(selected===i?null:i)} aria-label={`Preview shot ${i+1}`} aria-pressed={selected===i} className={`min-w-0 p-3 text-left ${selected===i?'bg-[#233022]':'bg-[#121918] hover:bg-[#1c2620]'}`}><div className="mb-3 overflow-hidden rounded-lg"><StoryboardSketch beat={beat} compact visualStylePreset={visualStylePreset} /></div><div className="flex flex-wrap justify-between gap-1 text-[10px] text-white/45"><span>Shot {String(i+1).padStart(2,'0')}</span><span>{timeRange(beat)}</span></div><p className="mt-2 line-clamp-2 text-xs leading-relaxed text-white/80">{beat.informationToCommunicate}</p><p className="mt-2 text-[10px] font-semibold text-lime-200/65">{beatBadge(beat)} · {SHOTS[beat.shotSize]}</p></button>)}</div>
        {representative && <div className="border-t border-white/10 p-4"><SceneMark beat={representative} large visualStylePreset={visualStylePreset} /><div className="mt-3 flex items-start justify-between gap-3"><p className="text-sm leading-relaxed text-white/70">{representative.informationToCommunicate}</p><button className="p-1 text-white/40" aria-label="Close shot preview" onClick={()=>setSelected(null)}><X className="h-4 w-4" /></button></div></div>}
      </section>}
      <div className="my-5 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-white/40">{stats.sequences} sequences · {stats.beats} visual beats · {stats.setups} recurring setups</p><button className="text-sm font-semibold text-lime-300 hover:text-lime-200" onClick={() => setOpen(true)}>Show Full Storyboard →</button></div>
      {groups.slice(0,2).map(group => <section key={group.id} className="mt-7"><h2 className="mb-3 text-sm font-semibold text-white/65">{String(group.number).padStart(2,"0")} · {group.title}</h2><div className="space-y-3">{group.beats.slice(0,2).map(beat => <BeatCard key={beat.id} beat={beat} number={beats.indexOf(beat)+1} chapter={group.number} script={script} continuity={continuity.get(beat.id)} visualStylePreset={visualStylePreset} />)}</div></section>)}
      <section className="mt-8 border-t border-white/10 pt-6"><div className="flex items-center gap-3"><h2 className="text-lg font-semibold text-white">Your Visual World</h2><span className="rounded-full border border-white/15 px-2 py-1 text-[10px] text-white/45">Planned</span></div><p className="mt-2 text-xs leading-relaxed text-white/40">The people, places and objects that will keep your video consistent. Images are created in the next step.</p><div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">{Object.entries(CATEGORIES).filter(([key]) => key !== "DIAGRAM_SUBJECT").map(([key,label]) => <div key={key} className="rounded-xl border border-white/10 bg-white/[.02] p-4"><p className="text-xl font-semibold text-white">{stats.counts[key]} <span className="text-xs font-normal text-white/30">planned</span></p><p className="mt-1 text-xs text-white/50">{label}</p></div>)}</div><div className="mt-4 flex flex-wrap gap-2">{entities.filter(e => e.importance !== "INCIDENTAL").slice(0,12).map(e => <span key={e.id} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/45">{e.name}</span>)}</div></section>
    </main>
    {open && <FullStoryboard row={row} script={script} readOnly={stale} onClose={() => setOpen(false)} onSave={async patches => { await onSave(patches); setSaved(true); }} visualStylePreset={visualStylePreset} focusBeatIds={focusBeatIds} />}
    {pickerOpen && <StylePicker open={pickerOpen} currentStylePreset={visualStylePreset} previewBeat={beats[0]} onClose={() => setPickerOpen(false)} onConfirm={handleStyleConfirm} />}
    {pendingStyle && <div className="fixed inset-0 z-[120] grid place-items-center bg-black/80 p-5">
      <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#18201b] p-6">
        <h3 className="font-bold text-white">Change visual style?</h3>
        <p className="mt-2 text-sm leading-relaxed text-white/55">Changing style will rebuild your Visual World and future visuals. Your storyboard will stay the same.</p>
        <div className="mt-5 flex justify-end gap-3">
          <button className={buttonClass} onClick={() => setPendingStyle(null)}>Cancel</button>
          <button className="rounded-xl bg-lime-300 px-4 py-2.5 text-sm font-bold text-[#11150D]" onClick={() => { onChangeVisualStyle?.(pendingStyle); setPendingStyle(null); }}>Change Style</button>
        </div>
      </div>
    </div>}
    {/* Item 2's own exact copy: distinct from Rebuild Episode Visuals (which
        keeps this same plan and re-renders scenes for image-generation
        credits) — this creates a brand-new plan with the current planner,
        costs nothing on its own, and never touches an existing generated
        scene until the new plan is explicitly adopted below. */}
    {replanConfirmOpen && <div className="fixed inset-0 z-[120] grid place-items-center bg-black/80 p-5">
      <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#18201b] p-6">
        <h3 className="font-bold text-white">Create a new visual plan?</h3>
        <p className="mt-2 text-sm leading-relaxed text-white/55">Zyvo will rebuild the storyboard and shot strategy using the latest visual-planning system. Your existing generated scenes and previous credit spend will remain in history. No image-generation credits are used until you choose to generate the new plan.</p>
        <div className="mt-5 flex justify-end gap-3">
          <button className={buttonClass} onClick={() => setReplanConfirmOpen(false)}>Cancel</button>
          <button className="rounded-xl bg-lime-300 px-4 py-2.5 text-sm font-bold text-[#11150D]" onClick={() => { setReplanConfirmOpen(false); onRegenerate(); }}>Create New Visual Plan</button>
        </div>
      </div>
    </div>}
  </div>;
}



