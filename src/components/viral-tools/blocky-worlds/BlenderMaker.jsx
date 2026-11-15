import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Bell, Check, Clapperboard, Download, ImagePlus, MapPin, Pencil, RefreshCw, Sparkles, Wand2, X } from "lucide-react";
import { DEV_MOCK, isWorking, runStage } from "./api/blockyWorldsApi";
import { STUDIO_STAGES } from "../../../../supabase/functions/_shared/blockyWorlds/studioStages.js";
import "./blenderMaker.css";

/**
 * Blocky Worlds: THE BLENDER MAKER (owner-only first, 2026-11-15; the server's access.blenderUi). Four clear steps, each
 * its own card: 1 Topic (one line + ideas, or "Explain more" + character pictures) -> 2 Script (editable, the ONE price
 * once it is ready) -> 3 Scenes (change a location) -> 4 Make my video (a price confirm on localhost, the progress
 * screen, the video + confetti, a browser notification). No length picker: the length comes from the story.
 * Character pictures are shrunk in the browser and sent ONLY to the characterRef action (one vision call); the server
 * never stores them, and the page keeps only the spec.
 */
const STEPS = [["topic", "Topic"], ["script", "Script"], ["scenes", "Scenes"], ["make", "Make my video"]];
const LOCAL = typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);
const ROLES = ["Main character", "Villain", "Best friend", "Parent", "Teacher", "Other"];
const FACE = { "Main character": "hero", Villain: "villain", "Best friend": "kid", Parent: "plain", Teacher: "plain", Other: "kid" };
const TARGET_LENGTH = 80; // the writer's target: ~90 s of real video (the length comes from the story, no picker)
const cx = (...a) => a.filter(Boolean).join(" ");

export default function BlenderMaker({ flow, pageAccess, onSignUp, onUpgrade, onNoCredits, balance = 0 }) {
  const [view, setView] = useState("topic");
  const [mode, setMode] = useState("topic"); // "topic" | "explain"
  const [story, setStory] = useState("");
  const [notice, setNotice] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const top = useRef(null);

  useEffect(() => { if (flow.lengthSec !== TARGET_LENGTH) flow.setLengthSec(TARGET_LENGTH); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // every step opens at its top (the page scrolls in a container on desktop, the window on phones)
  useEffect(() => { let el = top.current; while (el) { if (el.scrollTop) el.scrollTop = 0; el = el.parentElement; } window.scrollTo?.(0, 0); }, [view]);
  // a run (new or opened) shows step 4
  useEffect(() => { if (flow.run) setView("make"); }, [flow.run?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fail = (error) => {
    if (!error) return;
    if (error.code === "SIGN_IN") onSignUp?.();
    else if (error.code === "UPGRADE") onUpgrade?.();
    else if (error.code === "CREDITS") onNoCredits?.(error.credits ?? flow.draft?.credits);
    else setNotice(error.code === "NOT_READY" ? error.problems?.[0] ?? error.message : error.message);
  };
  const guarded = async (fn) => {
    if (pageAccess === "guest") { onSignUp?.(); return null; }
    setNotice(null);
    const r = await fn();
    if (r && !r.ok) fail(r.error);
    return r;
  };
  const write = async () => {
    const r = await guarded(() => (mode === "explain" ? flow.adaptStory(story) : flow.continueStory()));
    if (r?.ok) setView("script");
  };
  const toScenes = async () => {
    if (flow.edited) { const s = await guarded(() => flow.saveEdits()); if (!s?.ok) return; }
    setView("scenes");
    if (!flow.scenePlan) flow.loadScenePlan();
  };
  const make = async () => {
    setConfirm(false);
    const price = flow.draft?.credits ?? 0;
    if (balance > 0 && balance < price) { onNoCredits?.(price); return; }
    try { if (typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission().catch(() => {}); } catch { /* no notifications */ }
    await guarded(() => flow.generate());
  };
  const again = () => { flow.startOver(); setStory(""); setView("topic"); setNotice(null); };

  const doneIdx = { topic: flow.draft ? 1 : 0, script: 1, scenes: 2, make: 3 }[view];
  const stepIdx = STEPS.findIndex(([id]) => id === view);
  const writing = ["turning", "writing", "adapting"].includes(flow.busy);

  return (
    <div className="bwm h-full w-full overflow-y-auto" data-testid="bw-blender">
      {DEV_MOCK && <div className="sticky top-0 z-30 bg-[#ffd23f] px-4 py-2 text-center text-[15px] font-black text-black">TEST MODE: fake scripts and a fake video, nothing is charged</div>}
      <div ref={top} className="mx-auto flex w-full max-w-[1120px] flex-col gap-5 px-4 pb-28 pt-5 sm:px-6 lg:pt-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#bef264] text-[28px] shadow-[0_6px_0_#6f9a1f]" aria-hidden="true">🧱</span>
            <div>
              <h1 className="text-[30px] font-black leading-none tracking-[-0.03em] sm:text-[36px]">Blocky Worlds</h1>
              <p className="mt-1 text-[16px] font-bold text-white/80">Your story, built in blocks, in about 25 minutes.</p>
            </div>
          </div>
          <ol className="flex flex-wrap gap-2" aria-label={`Step ${stepIdx + 1} of 4: ${STEPS[stepIdx][1]}`}>
            {STEPS.map(([id, label], i) => (
              <li key={id} className={cx("bwm-step-pill", i === stepIdx && "is-active", i < Math.max(stepIdx, doneIdx) && i !== stepIdx && "is-done")} aria-current={i === stepIdx ? "step" : undefined}>
                <span className="dot">{i < stepIdx ? <Check className="h-5 w-5" strokeWidth={3.5} /> : i + 1}</span>{label}
              </li>
            ))}
          </ol>
        </header>

        {notice && <div className="bwm-rise flex items-start gap-3 rounded-2xl border-2 border-[#ff6fa8] bg-[#2a1220] px-4 py-3 text-[17px] font-bold text-white" role="status"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#ff6fa8]" />{notice}<button type="button" onClick={() => setNotice(null)} className="ml-auto" aria-label="Close"><X className="h-5 w-5" /></button></div>}

        {view === "topic" && (
          <TopicStep flow={flow} mode={mode} setMode={setMode} story={story} setStory={setStory} writing={writing} onWrite={write} />
        )}
        {view === "script" && flow.draft && (
          <ScriptStep flow={flow} onBack={() => setView("topic")} onNext={toScenes} onRewrite={() => guarded(() => flow.rewrite())} />
        )}
        {view === "scenes" && flow.draft && (
          <ScenesStep flow={flow} onBack={() => setView("script")} onNext={() => setView("make")} />
        )}
        {view === "make" && (flow.run ? <RunStep flow={flow} onAgain={again} onRetry={() => guarded(() => flow.retryRun(flow.run))} />
          : flow.draft && <MakeStep flow={flow} onBack={() => setView("scenes")} onMake={() => (LOCAL ? setConfirm(true) : make())} />)}
      </div>
      {confirm && <ConfirmDialog draft={flow.draft} onCancel={() => setConfirm(false)} onGo={make} />}
    </div>
  );
}

function Card({ n, title, sub, active = true, children, className }) {
  return (
    <section className={cx("bwm-card bwm-rise p-5 sm:p-7", active && "is-active", className)}>
      <div className="mb-5 flex items-center gap-4">
        <span className="bwm-num">{n}</span>
        <div>
          <h2 className="text-[26px] font-black leading-tight tracking-[-0.02em] sm:text-[30px]">{title}</h2>
          {sub && <p className="mt-0.5 text-[16px] font-semibold text-white/75 sm:text-[17px]">{sub}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Blocks({ label }) {
  return <span className="inline-flex items-center gap-3" role="status"><span className="bwm-blocks" aria-hidden="true"><i /><i /><i /><i /></span>{label}</span>;
}

// ------------------------------------------------------------------ 1. topic
function TopicStep({ flow, mode, setMode, story, setStory, writing, onWrite }) {
  const words = story.trim().split(/\s+/).filter(Boolean).length;
  const can = !writing && (mode === "explain" ? words >= 25 : flow.topic.trim().length >= 3);
  const ideas = flow.shownIdeas.slice(0, 6);
  return (
    <>
      <Card n={1} title="What's your story?" sub="One line is enough. Or tell us more and we'll shape it.">
        <div className="bwm-tabs mb-5" role="group" aria-label="How do you want to start?">
          <button type="button" className="bwm-tab" aria-pressed={mode === "topic"} onClick={() => setMode("topic")}><Sparkles className="mr-1.5 inline h-5 w-5" />Topic</button>
          <button type="button" className="bwm-tab" aria-pressed={mode === "explain"} onClick={() => setMode("explain")}><Pencil className="mr-1.5 inline h-5 w-5" />Explain more</button>
        </div>
        {mode === "topic" ? (
          <>
            <label className="mb-2 block text-[18px] font-black" htmlFor="bwm-topic">Your topic</label>
            <input id="bwm-topic" className="bwm-input" value={flow.topic} onChange={(e) => flow.setTopic(e.target.value)} maxLength={160} placeholder="Every time you sneeze, you teleport" onKeyDown={(e) => { if (e.key === "Enter" && can) onWrite(); }} />
            <div className="mt-6 flex items-center justify-between gap-3">
              <h3 className="text-[19px] font-black">Or tap a ready idea</h3>
              <button type="button" className="bwm-btn-2 !min-h-[44px] !px-4 !text-[15px]" onClick={() => flow.askIdeas({ more: true })} disabled={flow.ideas.status === "loading"}><RefreshCw className={cx("h-4 w-4", flow.ideas.status === "loading" && "animate-spin")} />More ideas</button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ideas.length ? ideas.map((c, i) => (
                <button key={c.id} type="button" className="bwm-chip bwm-rise" style={{ "--i": i }} aria-pressed={flow.picked?.id === c.id} onClick={() => flow.pickIdea(c)}>
                  <span className="block text-[17px] font-black leading-snug text-[#bef264]">{c.title}</span>
                  <span className="mt-1 block text-[15.5px] font-semibold leading-snug text-white/85">{c.opener}</span>
                </button>
              )) : <p className="col-span-full py-4"><Blocks label={<span className="text-[17px] font-bold text-white/80">Finding ideas…</span>} /></p>}
            </div>
          </>
        ) : (
          <>
            <label className="mb-2 block text-[18px] font-black" htmlFor="bwm-story">Tell us your story, or paste your whole narration</label>
            <textarea id="bwm-story" className="bwm-input min-h-[220px] resize-y !text-[18px] leading-relaxed" value={story} onChange={(e) => setStory(e.target.value)} maxLength={8000} placeholder="In my town, every lie makes you a little smaller. My best friend Zara fibs all day and fits in a teacup. I never lie, so I'm the biggest kid in town. One day a storm comes…" />
            <p className={cx("mt-2 text-[16px] font-bold", words >= 25 ? "text-[#bef264]" : "text-white/75")}>{words >= 25 ? <><Check className="mr-1 inline h-4 w-4" strokeWidth={3} />{words} words. We keep your characters and your twist.</> : `${words} of 25 words`}</p>
          </>
        )}
      </Card>

      <CharactersCard flow={flow} />

      <div className="sticky bottom-24 z-20 flex justify-center sm:justify-end lg:bottom-4">
        <button type="button" className="bwm-btn w-full sm:w-auto" disabled={!can} onClick={onWrite} data-testid="bwm-write">
          {writing ? <Blocks label="Writing your script…" /> : <><Wand2 className="h-6 w-6" />Write my script</>}
        </button>
      </div>
    </>
  );
}

/** the picture -> a small JPEG data URL (max 768 px): smaller to send, cheaper to read; never kept by the server */
function shrink(file) {
  return new Promise((resolve, reject) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, 768 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.88));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That picture couldn't be opened. Try a PNG or JPG.")); };
    img.src = url;
  });
}

function CharactersCard({ flow }) {
  const [items, setItems] = useState([]); // { key, preview, role, status: "reading" | "ok" | "refused", spec, error }
  const [role, setRole] = useState("Main character");
  const input = useRef(null);
  useEffect(() => { flow.setCharacters(items.filter((x) => x.status === "ok").map((x) => ({ ...x.spec, role: x.role, face: FACE[x.role] }))); }, [items]); // eslint-disable-line react-hooks/exhaustive-deps
  const add = async (file) => {
    if (!file || items.length >= 4) return;
    const key = crypto.randomUUID(), preview = URL.createObjectURL(file);
    setItems((l) => [...l, { key, preview, role, status: "reading" }]);
    try {
      const data = await shrink(file);
      const r = await flow.readCharacter(data, role);
      setItems((l) => l.map((x) => (x.key === key ? { ...x, status: "ok", spec: r.spec } : x)));
    } catch (e) {
      setItems((l) => l.map((x) => (x.key === key ? { ...x, status: "refused", error: e?.message ?? "We couldn't read that picture." } : x)));
    }
  };
  const remove = (key) => setItems((l) => { const x = l.find((i) => i.key === key); if (x) URL.revokeObjectURL(x.preview); return l.filter((i) => i.key !== key); });
  const setItemRole = (key, r) => setItems((l) => l.map((x) => (x.key === key ? { ...x, role: r } : x)));
  return (
    <section className="bwm-card bwm-rise p-5 sm:p-7" style={{ "--i": 2 }}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[24px] font-black tracking-[-0.02em]">Your characters <span className="ml-1 rounded-lg bg-white/10 px-2 py-0.5 align-middle text-[14px] font-black text-white/85">optional</span></h2>
          <p className="mt-1 text-[16px] font-semibold text-white/75">Add a Roblox avatar or a cartoon character. We build our own blocky look from it.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="bwm-role">Role</label>
          <select id="bwm-role" className="bwm-select" value={role} onChange={(e) => setRole(e.target.value)}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select>
          <button type="button" className="bwm-btn-2" onClick={() => input.current?.click()} disabled={items.length >= 4}><ImagePlus className="h-5 w-5" />Add a picture</button>
          <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { add(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
      </div>
      {items.length > 0 && (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {items.map((x, i) => (
            <li key={x.key} className={cx("bwm-pop flex gap-4 rounded-2xl border-2 p-3", x.status === "refused" ? "border-[#ff6fa8] bg-[#2a1220]" : "border-white/15 bg-[#0f1415]")} style={{ "--i": i }}>
              <img src={x.preview} alt="" className="h-24 w-24 shrink-0 rounded-xl object-cover" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <select className="bwm-select !min-h-[40px] !text-[15px]" value={x.role} onChange={(e) => setItemRole(x.key, e.target.value)} aria-label="Role">{ROLES.map((r) => <option key={r}>{r}</option>)}</select>
                  <button type="button" onClick={() => remove(x.key)} aria-label="Remove"><X className="h-5 w-5 text-white/80" /></button>
                </div>
                {x.status === "reading" && <p className="mt-2 text-[16px] font-bold"><Blocks label="Reading the look…" /></p>}
                {x.status === "refused" && <p className="mt-2 text-[15.5px] font-bold leading-snug text-white">{x.error}</p>}
                {x.status === "ok" && (
                  <>
                    <p className="mt-2 truncate text-[17px] font-black text-[#bef264]">{x.spec.name}</p>
                    <div className="mt-1.5 flex items-center gap-1.5" aria-label="Colours">
                      {[x.spec.skin, x.spec.hairColor, x.spec.shirt, x.spec.shirt2, x.spec.pants].map((c, k) => <span key={k} className="h-6 w-6 rounded-md border-2 border-white/40" style={{ background: c }} />)}
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-[14.5px] font-semibold text-white/80">{x.spec.hair} hair · {x.spec.pattern} top{x.spec.accessories.length ? ` · ${x.spec.accessories.join(", ")}` : ""}</p>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-[14px] font-semibold text-white/65">Avatars and cartoons only: no photos of real people, no logos. Your picture is only used to read the look and is never stored.</p>
    </section>
  );
}

// ------------------------------------------------------------------ 2. script
function ScriptStep({ flow, onBack, onNext, onRewrite }) {
  const d = flow.draft;
  const ready = d.ready && !flow.edited;
  const sec = Math.round(d.check?.seconds || d.lengthSec);
  return (
    <Card n={2} title="Your script" sub="Tap any line to change it. We read it in the narrator's voice.">
      <ol className="flex flex-col gap-2">
        {flow.lines.map((l, i) => (
          <li key={i} className="bwm-rise flex items-start gap-3" style={{ "--i": i }}>
            <span className="mt-3 w-7 shrink-0 text-right text-[15px] font-black text-white/60">{i + 1}</span>
            <textarea className="bwm-line" rows={Math.max(1, Math.ceil((l.text?.length ?? 0) / 70))} value={l.text} onChange={(e) => flow.editLine(i, e.target.value)} aria-label={`Line ${i + 1}`} />
          </li>
        ))}
      </ol>
      {(d.check?.problems ?? []).length > 0 && <p className="mt-4 rounded-2xl border-2 border-[#ffd23f] bg-[#2a2410] px-4 py-3 text-[16px] font-bold text-white">{d.check.problems[0]}</p>}
      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <PriceTag credits={d.credits} seconds={sec} ready={ready} edited={flow.edited} />
        <div className="flex flex-wrap gap-3">
          <button type="button" className="bwm-btn-2" onClick={onBack}><ArrowLeft className="h-5 w-5" />Back</button>
          <button type="button" className="bwm-btn-2" onClick={onRewrite} disabled={Boolean(flow.busy)}>{flow.busy === "rewriting" ? <Blocks label="Rewriting…" /> : <><RefreshCw className="h-5 w-5" />Rewrite</>}</button>
          <button type="button" className="bwm-btn" onClick={onNext} disabled={Boolean(flow.busy) || (!d.ready && !flow.edited)} data-testid="bwm-to-scenes">Next: scenes<ArrowRight className="h-6 w-6" /></button>
        </div>
      </div>
    </Card>
  );
}

function PriceTag({ credits, seconds, ready, edited }) {
  return (
    <div className="bwm-pop flex items-center gap-4 rounded-2xl border-2 border-[#bef264]/60 bg-[#18210f] px-5 py-4" data-testid="bwm-price">
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#bef264] text-[22px] font-black text-[#0d1208]">⚡</span>
      <div>
        <p className="text-[24px] font-black leading-none">{credits != null ? `${credits} credits` : "…"}</p>
        <p className="mt-1 text-[15.5px] font-bold text-white/80">{edited ? "Saved when you go on" : ready ? `About ${seconds} s of video · charged only when you press Make my video` : "Fix the note above first"}</p>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ 3. scenes
function ScenesStep({ flow, onBack, onNext }) {
  const plan = flow.scenePlan;
  const places = plan?.locations ?? [];
  return (
    <Card n={3} title="Where it happens" sub="We picked a place for every scene. Change any of them.">
      {!plan ? <p className="py-6 text-[17px] font-bold"><Blocks label="Picking the places…" /></p> : (
        <ol className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {plan.scenes.map((sc, i) => (
            <li key={i} className="bwm-rise min-w-0 rounded-2xl border-2 border-white/15 bg-[#0f1415] p-4" style={{ "--i": i }}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[15px] font-black uppercase tracking-[0.08em] text-[#bef264]">Scene {i + 1} · lines {sc.lines[0] + 1}{sc.lines[1] > sc.lines[0] ? `–${sc.lines[1] + 1}` : ""}</span>
                {!sc.auto && <span className="rounded-lg bg-[#bef264] px-2 py-0.5 text-[13px] font-black text-[#0d1208]">changed</span>}
              </div>
              <p className="mt-2 line-clamp-2 text-[16.5px] font-semibold text-white/85">“{sc.preview ?? flow.lines[sc.lines[0]]?.text}”</p>
              <label className="mt-3 flex min-w-0 items-center gap-2 text-[16px] font-black"><MapPin className="h-5 w-5 text-[#bef264]" /><span className="sr-only">Change location</span>
                <select className="bwm-select w-full min-w-0 flex-1" value={sc.location} onChange={(e) => flow.changeScene(i, { location: e.target.value })} aria-label={`Change location of scene ${i + 1}`}>
                  {places.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </label>
            </li>
          ))}
        </ol>
      )}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button type="button" className="bwm-btn-2" onClick={onBack}><ArrowLeft className="h-5 w-5" />Back</button>
        <button type="button" className="bwm-btn" onClick={onNext} disabled={!plan} data-testid="bwm-to-make">Next: make it<ArrowRight className="h-6 w-6" /></button>
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------ 4. make
function MakeStep({ flow, onBack, onMake }) {
  const d = flow.draft;
  return (
    <Card n={4} title="Make my video" sub="We direct every shot, check every frame and render it in 3D.">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="rounded-2xl border-2 border-white/15 bg-[#0f1415] p-5">
          <p className="text-[22px] font-black leading-tight">“{d.title}”</p>
          <ul className="mt-3 flex flex-wrap gap-2 text-[15.5px] font-bold">
            <li className="rounded-xl bg-white/10 px-3 py-1.5">{flow.lines.length} lines</li>
            <li className="rounded-xl bg-white/10 px-3 py-1.5">About {Math.round(d.check?.seconds || d.lengthSec)} s</li>
            {flow.scenePlan && <li className="rounded-xl bg-white/10 px-3 py-1.5">{flow.scenePlan.scenes.length} scenes</li>}
            {flow.characters.length > 0 && <li className="rounded-xl bg-white/10 px-3 py-1.5">{flow.characters.length} of your characters</li>}
            <li className="rounded-xl bg-white/10 px-3 py-1.5">Ready in about 25–30 min</li>
          </ul>
        </div>
        <PriceTag credits={d.credits} seconds={Math.round(d.check?.seconds || d.lengthSec)} ready={d.ready} />
      </div>
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" className="bwm-btn-2" onClick={onBack}><ArrowLeft className="h-5 w-5" />Back</button>
        <button type="button" className="bwm-btn !min-h-[72px] !px-10 !text-[24px]" onClick={onMake} disabled={Boolean(flow.busy) || !d.ready} data-testid="bwm-make">
          {flow.busy === "starting" ? <Blocks label="Starting…" /> : <><Clapperboard className="h-7 w-7" />Make my video</>}
        </button>
      </div>
    </Card>
  );
}

function ConfirmDialog({ draft, onCancel, onGo }) {
  return (
    <div className="bwm-overlay" role="dialog" aria-modal="true" aria-labelledby="bwm-confirm-title">
      <div className="bwm-dialog bwm-card is-active p-6 sm:p-8">
        <p className="inline-block rounded-lg bg-[#ffd23f] px-2.5 py-1 text-[13px] font-black uppercase tracking-[0.1em] text-black">Localhost check</p>
        <h2 id="bwm-confirm-title" className="mt-3 text-[28px] font-black leading-tight">Start a real video for {draft?.credits} credits?</h2>
        <p className="mt-2 text-[17px] font-semibold text-white/85">This starts the real paid render (script, voice, director, GPU). It takes about 25–30 minutes. If it fails, the credits come back.</p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" className="bwm-btn-2" onClick={onCancel}>Not now</button>
          <button type="button" className="bwm-btn" onClick={onGo} data-testid="bwm-confirm">Yes, make it · {draft?.credits} credits</button>
        </div>
      </div>
    </div>
  );
}

function RunStep({ flow, onAgain, onRetry }) {
  const run = flow.run;
  const working = isWorking(run);
  const stage = runStage(run);
  const at = Math.max(0, STUDIO_STAGES.findIndex((s) => s.stage === stage));
  const pct = run.status === "done" ? 100 : Math.max(3, run.pct ?? STUDIO_STAGES[at]?.pct ?? 0);
  const wasWorking = useRef(working);
  const [party, setParty] = useState(false);
  useEffect(() => {
    if (run.status === "done" && wasWorking.current) {
      wasWorking.current = false;
      setParty(true);
      try { if (document.hidden && typeof Notification !== "undefined" && Notification.permission === "granted") new Notification("Your Blocky Worlds video is ready!", { body: run.title }); } catch { /* no notifications */ }
      const t = setTimeout(() => setParty(false), 4200);
      return () => clearTimeout(t);
    }
    if (working) wasWorking.current = true;
    return undefined;
  }, [run.status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (run.status === "failed") {
    return (
      <Card n={4} title="This video didn't make it" sub={run.reason ?? "Something went wrong on our side."}>
        <p className="inline-flex items-center gap-2 rounded-2xl bg-[#18210f] px-4 py-3 text-[18px] font-black text-[#bef264]"><Check className="h-5 w-5" strokeWidth={3} />{run.refunded ? `Your ${run.credits} credits are back.` : "Your credits come back within a minute."}</p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" className="bwm-btn-2" onClick={onAgain}>New story</button>
          <button type="button" className="bwm-btn" onClick={onRetry} disabled={Boolean(flow.busy)}><RefreshCw className="h-6 w-6" />Try again</button>
        </div>
      </Card>
    );
  }
  if (run.status === "done") {
    return (
      <>
        {party && <Confetti />}
        <Card n="✓" title="Your video is ready!" sub={`“${run.title}”`}>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr] lg:items-start">
            <div className="bwm-pop mx-auto aspect-[9/16] w-full max-w-[360px] overflow-hidden rounded-3xl border-4 border-[#bef264] bg-black shadow-[0_20px_60px_rgba(190,242,100,.25)]">
              {run.finalUrl ? <video src={run.finalUrl} poster={run.poster ?? undefined} controls playsInline className="h-full w-full object-contain" /> : <div className="grid h-full place-items-center text-[18px] font-bold">Video</div>}
            </div>
            <div className="flex flex-col gap-3">
              <p className="text-[19px] font-bold text-white/85">Download it and post it. Vertical, captioned, ready for TikTok, Shorts and Reels.</p>
              {run.downloadUrl && <a href={run.downloadUrl} download onClick={() => flow.sendEvent("downloaded")} className="bwm-btn"><Download className="h-6 w-6" />Download video</a>}
              <button type="button" className="bwm-btn-2" onClick={onAgain}><Sparkles className="h-5 w-5" />Make another story</button>
            </div>
          </div>
        </Card>
      </>
    );
  }
  return (
    <Card n={4} title="Making your video…" sub="About 25–30 minutes. You can leave this page: we'll let you know when it's ready.">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Blocks label={<span className="text-[20px] font-black">{STUDIO_STAGES[at]?.label ?? "Getting ready"}</span>} />
          <span className="text-[28px] font-black text-[#bef264]">{pct}%</span>
        </div>
        <div className="bwm-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${pct}%` }} /></div>
        <ol className="grid gap-2 sm:grid-cols-3">
          {STUDIO_STAGES.map((s, i) => (
            <li key={s.stage} className={cx("flex items-center gap-3 rounded-2xl border-2 px-3 py-2.5 text-[16px] font-bold", i < at ? "border-[#bef264]/50 bg-[#18210f] text-white" : i === at ? "bwm-stage-now border-[#bef264] bg-[#22301a] text-white" : "border-white/12 bg-[#0f1415] text-white/70")}>
              <span className={cx("grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[15px] font-black", i <= at ? "bg-[#bef264] text-[#0d1208]" : "bg-white/10 text-white")}>{i < at ? <Check className="h-4 w-4" strokeWidth={3.5} /> : i + 1}</span>{s.label}
            </li>
          ))}
        </ol>
        <p className="flex items-center gap-2 text-[16px] font-bold text-white/80"><Bell className="h-5 w-5 text-[#bef264]" />We'll send a notification{flow.access?.readyEmail ? " and an email" : ""} when it's done.</p>
      </div>
    </Card>
  );
}

function Confetti() {
  const bits = useMemo(() => Array.from({ length: 90 }, (_, i) => ({ left: Math.random() * 100, d: Math.random() * 0.6, t: 2.2 + Math.random() * 1.6, dx: (Math.random() - 0.5) * 240, r: 360 + Math.random() * 720, c: ["#bef264", "#5cc8ff", "#ff6fa8", "#ffd23f", "#ffffff"][i % 5] })), []);
  return <div className="bwm-confetti" aria-hidden="true">{bits.map((b, i) => <i key={i} style={{ left: `${b.left}%`, background: b.c, "--d": `${b.d}s`, "--t": `${b.t}s`, "--dx": `${b.dx}px`, "--r": `${b.r}deg` }} />)}</div>;
}
