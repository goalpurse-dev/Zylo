import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Bell, Check, Clapperboard, Download, Film, ImagePlus, MapPin, Pencil, Play, RefreshCw, Sparkles, Wand2, X } from "lucide-react";
import { CreditIcon } from "../../ui/zyvo";
import { DEV_MOCK, isWorking, runStage, whichBackend } from "./api/blockyWorldsApi";
import "./blockyWorlds.css";
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
  // DEV ONLY: which server the page talks to (blockyWorldsApi.js whichBackend: the local API when it runs, else live)
  const [backend, setBackend] = useState(null);
  useEffect(() => { if (import.meta.env.DEV) whichBackend().then(setBackend); }, []);

  useEffect(() => { flow.setFlat?.(true); if (flow.lengthSec !== TARGET_LENGTH) flow.setLengthSec(TARGET_LENGTH); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // THE ONE PRICE (the server's access.flat: BLENDER_FLAT): paid at "Write my script" ("script") or at "Make my video" ("start")
  const flat = flow.access?.flat ?? { credits: flow.access?.prices?.[90] ?? null, charge: "start", keepCredits: 25, expireDays: 7 };
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
    if (flat.charge === "script" && balance > 0 && flat.credits && balance < flat.credits) { onNoCredits?.(flat.credits); return; }
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
    const price = paidFor(flow.draft) ? 0 : flat.credits ?? flow.draft?.credits ?? 0;
    if (balance > 0 && balance < price) { onNoCredits?.(price); return; }
    try { if (typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission().catch(() => {}); } catch { /* no notifications */ }
    await guarded(() => flow.generate());
  };
  const again = () => { flow.startOver(); setStory(""); setView("topic"); setNotice(null); };

  const doneIdx = { topic: flow.draft ? 1 : 0, script: 1, scenes: 2, make: 3 }[view];
  const stepIdx = STEPS.findIndex(([id]) => id === view);
  const writing = ["turning", "writing", "adapting"].includes(flow.busy);
  const words = story.trim().split(/\s+/).filter(Boolean).length;
  const canWrite = !writing && (mode === "explain" ? words >= 25 : flow.topic.trim().length >= 3);
  const hasRecent = (flow.recent?.length ?? 0) > 0;
  const d = flow.draft;

  return (
    <div className="bwm h-full w-full overflow-y-auto overflow-x-hidden" data-testid="bw-blender">
      {DEV_MOCK && <div className="sticky top-0 z-30 bg-[#ffd23f] px-4 py-2 text-center text-[15px] font-black text-black">TEST MODE: fake scripts and a fake video, nothing is charged</div>}
      {/* our own finished videos, slowly floating on both sides (big screens only, never over anything the user types in) */}
      <ShowcaseReels />
      <div ref={top} className={cx("relative z-10 mx-auto flex w-full flex-col gap-4 px-4 pb-4 pt-4 sm:px-6", hasRecent ? "max-w-[1300px]" : "max-w-[940px]")}>
        <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#bef264] text-[22px] shadow-[0_4px_0_#6f9a1f]" aria-hidden="true">🧱</span>
            <div>
              <h1 className="text-[24px] font-black leading-none tracking-[-0.03em] sm:text-[28px]">Blocky Worlds</h1>
              <p className="mt-1 text-[14.5px] font-bold text-white/80">Your story, built in blocks, in about 25 minutes.</p>
              {backend && <p className="mt-1.5 inline-flex rounded-lg border border-white/25 bg-black/40 px-2 py-0.5 text-[12px] font-black uppercase tracking-[0.08em] text-white/85" data-testid="bwm-backend">dev · {backend === "local" ? "local API :8000" : backend === "mock" ? "mock" : "live API"}</p>}
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

        <div className={cx("grid gap-4", hasRecent && "lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start")}>
        <div className="flex min-w-0 flex-col gap-4">
        {notice && <div className="bwm-rise flex items-start gap-3 rounded-2xl border-2 border-[#ff6fa8] bg-[#2a1220] px-4 py-3 text-[17px] font-bold text-white" role="status"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#ff6fa8]" />{notice}<button type="button" onClick={() => setNotice(null)} className="ml-auto" aria-label="Close"><X className="h-5 w-5" /></button></div>}

        {view === "topic" && (
          <TopicStep flow={flow} mode={mode} setMode={setMode} story={story} setStory={setStory} writing={writing} onWrite={write} />
        )}
        {view === "script" && flow.draft && (
          <ScriptStep flat={flat} flow={flow} />
        )}
        {view === "scenes" && flow.draft && (
          <ScenesStep flow={flow} />
        )}
        {view === "make" && (flow.run ? <RunStep flow={flow} onAgain={again} onRetry={() => guarded(() => flow.retryRun(flow.run))} />
          : flow.draft && <MakeStep flat={flat} flow={flow} />)}
        {/* THE STICKY ACTION BAR (the other templates' pinned Generate bar): the step's next action is always on screen */}
        {!(view === "make" && flow.run) && (
          <StickyBar>
            {view === "topic" && <>
              <PriceRule flat={flat} short className="hidden min-w-0 flex-1 md:block" />
              <button type="button" className="bwm-btn w-full whitespace-nowrap md:w-auto" disabled={!canWrite} onClick={write} data-testid="bwm-write">
                {writing ? <Blocks label="Writing your script…" /> : <><Wand2 className="h-5 w-5" />Write my script{flat.credits != null && <span className="ml-1 inline-flex items-center gap-1.5 rounded-xl bg-[#0d1208]/15 px-2 py-0.5 text-[17px]" data-testid="bwm-write-price"><Cr n={flat.credits} /><span className="hidden text-[13px] sm:inline">{flat.charge === "script" ? "pay now" : "at Make my video"}</span></span>}</>}
              </button>
            </>}
            {view === "script" && d && <>
              <button type="button" className="bwm-btn-2" onClick={() => setView("topic")}><ArrowLeft className="h-5 w-5" />Back</button>
              <button type="button" className="bwm-btn-2" onClick={() => guarded(() => flow.rewrite())} disabled={Boolean(flow.busy)}>{flow.busy === "rewriting" ? <Blocks label="Rewriting…" /> : <><RefreshCw className="h-5 w-5" />Rewrite</>}</button>
              <button type="button" className="bwm-btn flex-1 md:flex-none" onClick={toScenes} disabled={Boolean(flow.busy) || (!d.ready && !flow.edited)} data-testid="bwm-to-scenes">Next: scenes<ArrowRight className="h-5 w-5" /></button>
            </>}
            {view === "scenes" && d && <>
              <button type="button" className="bwm-btn-2" onClick={() => setView("script")}><ArrowLeft className="h-5 w-5" />Back</button>
              <button type="button" className="bwm-btn flex-1 md:flex-none" onClick={() => setView("make")} disabled={!flow.scenePlan} data-testid="bwm-to-make">Next: make it<ArrowRight className="h-5 w-5" /></button>
            </>}
            {view === "make" && d && <>
              <button type="button" className="bwm-btn-2" onClick={() => setView("scenes")}><ArrowLeft className="h-5 w-5" />Back</button>
              <button type="button" className="bwm-btn flex-1 md:flex-none" onClick={() => (LOCAL ? setConfirm(true) : make())} disabled={Boolean(flow.busy) || !d.ready} data-testid="bwm-make">
                {flow.busy === "starting" ? <Blocks label="Starting…" /> : <><Clapperboard className="h-5 w-5" />Make my video{paidFor(d) ? <span className="ml-1 rounded-xl bg-[#0d1208]/15 px-2 py-0.5 text-[14px]">included</span> : <span className="ml-1 inline-flex items-center rounded-xl bg-[#0d1208]/15 px-2 py-0.5 text-[17px]"><Cr n={flat.credits} /></span>}</>}
              </button>
            </>}
          </StickyBar>
        )}
        </div>
        {/* once there are videos: Recent creations takes the right side (compact); with none, the page stays centered */}
        {hasRecent && <aside className="min-w-0 lg:sticky lg:top-4"><RecentCreations compact recent={flow.recent} onOpen={(r) => flow.openRun(r)} onDownload={() => flow.sendEvent("downloaded")} /></aside>}
        </div>
      </div>
      {confirm && <ConfirmDialog flat={flat} draft={flow.draft} onCancel={() => setConfirm(false)} onGo={make} />}
    </div>
  );
}

function Card({ n, title, sub, active = true, children, className }) {
  return (
    <section className={cx("bwm-card bwm-rise p-4 sm:p-5", active && "is-active", className)}>
      <div className="mb-3 flex items-center gap-3">
        <span className="bwm-num">{n}</span>
        <div>
          <h2 className="text-[21px] font-black leading-tight tracking-[-0.02em] sm:text-[24px]">{title}</h2>
          {sub && <p className="mt-0.5 text-[14.5px] font-semibold text-white/80 sm:text-[15.5px]">{sub}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

/** the pinned action bar: above the bottom nav on phones, at the screen's foot on desktop (it never hides content: it
 *  sits at the end of the column, so the column's last card scrolls clear of it) */
function StickyBar({ children }) {
  return (
    <div className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] z-30 mt-1 flex flex-wrap items-center justify-end gap-2 rounded-2xl border-2 border-[#bef264]/45 bg-[#0b0f10]/95 p-3 shadow-[0_-10px_30px_rgba(0,0,0,.55)] backdrop-blur-xl lg:bottom-3" data-testid="bwm-sticky-bar">
      {children}
    </div>
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
      <Card n={1} title={<>Every story starts with <span className="bw-mark whitespace-nowrap">&ldquo;In this town&hellip;&rdquo;</span></>} sub="One line is enough. Or tell us more and we'll shape it.">
        <div className="bwm-tabs mb-3" role="group" aria-label="How do you want to start?">
          <button type="button" className="bwm-tab" aria-pressed={mode === "topic"} onClick={() => setMode("topic")}><Sparkles className="mr-1.5 inline h-5 w-5" />Topic</button>
          <button type="button" className="bwm-tab" aria-pressed={mode === "explain"} onClick={() => setMode("explain")}><Pencil className="mr-1.5 inline h-5 w-5" />Explain more</button>
        </div>
        {mode === "topic" ? (
          <>
            <label className="mb-1.5 block text-[16px] font-black" htmlFor="bwm-topic">Your topic</label>
            <input id="bwm-topic" className="bwm-input" value={flow.topic} onChange={(e) => flow.setTopic(e.target.value)} maxLength={160} placeholder="Every time you sneeze, you teleport" onKeyDown={(e) => { if (e.key === "Enter" && can) onWrite(); }} />
            <button type="button" className="mt-2 text-[15px] font-black text-[#bef264] underline decoration-2 underline-offset-4" onClick={() => setMode("explain")}><Pencil className="mr-1.5 inline h-4 w-4" />Paste my own script</button>
            <div className="mt-4 flex items-center justify-between gap-3">
              <h3 className="text-[17px] font-black">Or tap a ready idea</h3>
              <button type="button" className="bwm-btn-2 !min-h-[38px] !px-3 !text-[14px]" onClick={() => flow.askIdeas({ more: true })} disabled={flow.ideas.status === "loading"}><RefreshCw className={cx("h-4 w-4", flow.ideas.status === "loading" && "animate-spin")} />More ideas</button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Idea moods">
              {[{ id: null, label: "All" }, ...(flow.access?.moods ?? [])].map((m) => (
                <button key={m.id ?? "all"} type="button" className="bwm-tab !min-h-[36px] border-2 border-white/15 !px-3 !text-[14px]" aria-pressed={(flow.mood ?? null) === m.id} onClick={() => flow.setMood(m.id)}>{m.label}</button>
              ))}
            </div>
            <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {ideas.length ? ideas.map((c, i) => (
                <button key={c.id} type="button" className="bwm-chip bwm-rise" style={{ "--i": i }} aria-pressed={flow.picked?.id === c.id} onClick={() => flow.pickIdea(c)}>
                  <span className="block text-[15px] font-black leading-snug text-[#bef264]">{c.title}</span>
                  <span className="mt-0.5 line-clamp-3 block text-[13.5px] font-semibold leading-snug text-white/90">{c.opener}</span>
                </button>
              )) : <p className="col-span-full py-4"><Blocks label={<span className="text-[17px] font-bold text-white/80">Finding ideas…</span>} /></p>}
            </div>
          </>
        ) : (
          <>
            <label className="mb-1.5 block text-[16px] font-black" htmlFor="bwm-story">Tell us your story, or paste your whole narration</label>
            <textarea id="bwm-story" className="bwm-input min-h-[170px] resize-y !text-[16.5px] leading-relaxed" value={story} onChange={(e) => setStory(e.target.value)} maxLength={8000} placeholder="In my town, every lie makes you a little smaller. My best friend Zara fibs all day and fits in a teacup. I never lie, so I'm the biggest kid in town. One day a storm comes…" />
            <p className={cx("mt-2 text-[16px] font-bold", words >= 25 ? "text-[#bef264]" : "text-white/75")}>{words >= 25 ? <><Check className="mr-1 inline h-4 w-4" strokeWidth={3} />{words} words. We keep your characters and your twist.</> : `${words} of 25 words`}</p>
          </>
        )}
      </Card>

      <CharactersCard flow={flow} />

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
    <section className="bwm-card bwm-rise p-4 sm:p-5" style={{ "--i": 2 }}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[19px] font-black tracking-[-0.02em]">Your characters <span className="ml-1 rounded-lg bg-white/10 px-2 py-0.5 align-middle text-[14px] font-black text-white/85">optional</span></h2>
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
function ScriptStep({ flat, flow }) {
  const d = flow.draft;
  const ready = d.ready && !flow.edited;
  const sec = Math.round(d.check?.seconds || d.lengthSec);
  return (
    <Card n={2} title="Your script" sub="Tap any line to change it. We read it in the narrator's voice.">
      <ol className="flex flex-col gap-2">
        {flow.lines.map((l, i) => (
          <li key={i} className="bwm-rise flex items-start gap-3" style={{ "--i": i }}>
            <span className="mt-3 w-7 shrink-0 text-right text-[15px] font-black text-white/60">{i + 1}</span>
            <AutoLine value={l.text} onChange={(v) => flow.editLine(i, v)} label={`Line ${i + 1}`} />
          </li>
        ))}
      </ol>
      {(d.check?.problems ?? []).length > 0 && <p className="mt-4 rounded-2xl border-2 border-[#ffd23f] bg-[#2a2410] px-4 py-3 text-[16px] font-bold text-white">{d.check.problems[0]}</p>}
      <div className="mt-6 flex flex-col gap-4">
        <PriceTag flat={flat} paid={paidFor(d)} seconds={sec} ready={ready} edited={flow.edited} />
      </div>
    </Card>
  );
}

/** a script line that is always as tall as its text (phones wrap a line into 3-4 rows) */
function AutoLine({ value, onChange, label }) {
  const ref = useRef(null);
  const fit = () => { const el = ref.current; if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight + 4}px`; } };
  useLayoutEffect(fit, [value]);
  useEffect(() => { window.addEventListener("resize", fit); return () => window.removeEventListener("resize", fit); }, []);
  return <textarea ref={ref} rows={1} className="bwm-line overflow-hidden" value={value ?? ""} onChange={(e) => onChange(e.target.value)} aria-label={label} />;
}

/** a credit amount with OUR credit symbol (the app's CreditIcon, as on the other templates' Generate buttons) */
function Cr({ n, className = "h-5 w-5" }) {
  return <span className="inline-flex items-center gap-1 tabular-nums"><CreditIcon className={className} />{n ?? "…"}<span className="sr-only"> credits</span></span>;
}
/** was this draft already paid for at "Write my script"? */
const paidFor = (d) => d?.flat?.charge === "script" && Boolean(d.flat.paidAt);
/** the rule, in one clear sentence (where the one price is paid, what is included, the refunds) */
function PriceRule({ flat, short = false, className = "" }) {
  return (
    <p className={cx(short ? "text-[13.5px]" : "text-[15px]", "font-bold leading-snug text-white/85", className)} data-testid="bwm-price-rule">
      One price per video: <span className="text-[#bef264]"><Cr n={flat.credits} className="h-4 w-4" /></span>, {flat.charge === "script" ? <>paid now, when you press <b>Write my script</b></> : <>paid when you press <b>Make my video</b></>}. Script rewrites, the voice and the render are included. If the video fails, all of it comes back{flat.charge === "script" ? <>; no video within {flat.expireDays} days: all but <Cr n={flat.keepCredits} className="h-4 w-4" /> comes back</> : ""}.
    </p>
  );
}

function PriceTag({ flat, paid, seconds, ready, edited }) {
  return (
    <div className="bwm-pop flex items-center gap-4 rounded-2xl border-2 border-[#bef264]/60 bg-[#18210f] px-5 py-4" data-testid="bwm-price">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#bef264] text-[#0d1208]"><CreditIcon className="h-7 w-7" /></span>
      <div>
        <p className="text-[24px] font-black leading-none"><Cr n={flat.credits} className="h-6 w-6" />{paid && <span className="ml-2 align-middle text-[15px] font-black text-[#bef264]"><Check className="mr-0.5 inline h-4 w-4" strokeWidth={3} />Paid</span>}</p>
        <p className="mt-1 text-[15.5px] font-bold text-white/80">{edited ? "Saved when you go on" : !ready ? "Fix the note above first" : paid ? `About ${seconds} s of video · rewrites, voice and render included` : `About ${seconds} s of video · paid when you press ${flat.charge === "script" ? "Write my script" : "Make my video"}`}</p>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ 3. scenes
function ScenesStep({ flow }) {
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
    </Card>
  );
}

// ------------------------------------------------------------------ 4. make
function MakeStep({ flat, flow }) {
  const d = flow.draft;
  return (
    <Card n={4} title="Make my video" sub="We direct every shot, check every frame and render it in 3D.">
      <div className="flex flex-col gap-4">
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
        <PriceTag flat={flat} paid={paidFor(d)} seconds={Math.round(d.check?.seconds || d.lengthSec)} ready={d.ready} />
      </div>
      <PriceRule flat={flat} className="mt-4" />
    </Card>
  );
}

function ConfirmDialog({ flat, draft, onCancel, onGo }) {
  const paid = paidFor(draft);
  return (
    <div className="bwm-overlay" role="dialog" aria-modal="true" aria-labelledby="bwm-confirm-title">
      <div className="bwm-dialog bwm-card is-active p-6 sm:p-8">
        <p className="inline-block rounded-lg bg-[#ffd23f] px-2.5 py-1 text-[13px] font-black uppercase tracking-[0.1em] text-black">Localhost check</p>
        <h2 id="bwm-confirm-title" className="mt-3 text-[28px] font-black leading-tight">{paid ? <>Start the real video? It is already paid (<Cr n={flat.credits} className="h-6 w-6" />).</> : <>Start a real video for <Cr n={flat.credits} className="h-6 w-6" />?</>}</h2>
        <p className="mt-2 text-[17px] font-semibold text-white/85">This starts the real paid render (script, voice, director, GPU). It takes about 25–30 minutes. If it fails, all of it comes back.</p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" className="bwm-btn-2" onClick={onCancel}>Not now</button>
          <button type="button" className="bwm-btn" onClick={onGo} data-testid="bwm-confirm">{paid ? "Yes, make it" : <>Yes, make it · <Cr n={flat.credits} /></>}</button>
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
        <p className="inline-flex items-center gap-2 rounded-2xl bg-[#18210f] px-4 py-3 text-[18px] font-black text-[#bef264]"><Check className="h-5 w-5" strokeWidth={3} />{run.refunded ? <>All of it is back: <Cr n={run.credits} /></> : <>All of it comes back within a minute: <Cr n={run.credits} /></>}</p>
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

// ------------------------------------------------------------------ recent creations (like the other templates)
const STATUS_OF = (r) => (r.status === "done" ? ["Ready", "bg-[#bef264] text-[#0d1208]"] : r.status === "failed" ? (r.refunded ? ["Refunded", "bg-[#5cc8ff] text-[#06202e]"] : ["Failed", "bg-[#ff6fa8] text-[#2a0716]"]) : ["Rendering", "bg-[#ffd23f] text-[#2a2000]"]);
function RecentCreations({ recent, onOpen, onDownload, compact = false }) {
  if (!recent?.length) return null;
  return (
    <section className="bwm-card bwm-rise p-4" aria-labelledby="bwm-recent-title" data-testid="bwm-recent">
      <h2 id="bwm-recent-title" className="text-[19px] font-black tracking-[-0.02em]">Recent creations</h2>
      <p className="mt-0.5 text-[14px] font-semibold text-white/75">Your Blocky Worlds videos.</p>
      <ul className={cx("mt-3 grid grid-cols-1 gap-2.5", !compact && "sm:grid-cols-2 xl:grid-cols-3", compact && "max-h-[calc(100vh-190px)] overflow-y-auto pr-1")}>
        {recent.slice(0, 12).map((r, i) => {
          const [label, tone] = STATUS_OF(r);
          const working = isWorking(r);
          const pct = Math.max(3, Math.min(99, Number(r.pct) || STUDIO_STAGES.find((x) => x.stage === runStage(r))?.pct || 3));
          return (
            <li key={r.id} className="bwm-rise flex gap-3 rounded-2xl border-2 border-white/15 bg-[#0f1415] p-3" style={{ "--i": i }}>
              <button type="button" onClick={() => onOpen(r)} className="relative h-[96px] w-[54px] shrink-0 overflow-hidden rounded-lg bg-black" aria-label={`Open ${r.title || "video"}`}>
                {r.poster ? <img src={r.poster} alt="" className="h-full w-full object-cover" loading="lazy" /> : <span className="grid h-full place-items-center"><Film className="h-6 w-6 text-white/40" /></span>}
                {r.status === "done" && <span className="absolute inset-0 grid place-items-center bg-black/25"><Play className="h-7 w-7 fill-white text-white" /></span>}
              </button>
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="truncate text-[15.5px] font-black">{r.title || "Untitled"}</p>
                <p className="text-[13px] font-semibold text-white/75">{r.createdAt ? new Date(r.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : ""}</p>
                <span className={cx("mt-1.5 self-start rounded-lg px-2 py-0.5 text-[13px] font-black", tone)}>{working ? `${label} ${pct}%` : label}</span>
                {working && <div className="bwm-bar mt-2 !h-3"><span style={{ width: `${pct}%` }} /></div>}
                <div className="mt-auto flex gap-2 pt-2">
                  <button type="button" className="bwm-btn-2 !min-h-[40px] !px-3 !text-[14.5px]" onClick={() => onOpen(r)}>{r.status === "done" ? <><Play className="h-4 w-4" />Play</> : "Open"}</button>
                  {r.downloadUrl && <a href={r.downloadUrl} download onClick={onDownload} className="bwm-btn-2 !min-h-[40px] !px-3 !text-[14.5px]"><Download className="h-4 w-4" />Download</a>}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ------------------------------------------------------------------ the floating showcase (our own finished videos)
// Short muted loops cut from OUR Blender renders (public/blocky-worlds/showcase/: Milo, the tower, the plane, phase 1;
// ~120-360 KB each, 360x640, 8 s). Two slowly drifting, tilted columns in the side margins: 2xl screens only (never on
// phones or next to inputs), behind the cards, paused for people who ask for less motion (blenderMaker.css).
const SHOWCASE = ["milo", "tower", "plane", "phase1"].map((k) => ({ src: `/blocky-worlds/showcase/${k}.mp4`, poster: `/blocky-worlds/showcase/${k}.jpg` }));
function ShowcaseReels() {
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const column = (items, side) => (
    <div className={cx("bwm-reel absolute top-0 h-full w-[190px]", side === "left" ? "left-6 is-left" : "right-6 is-right")}>
      <div className={cx("bwm-reel-track", side === "right" && "is-down")}>
        {[...items, ...items].map((v, i) => (
          <div key={i} className="bwm-reel-tile">
            {reduce ? <img src={v.poster} alt="" /> : <video src={v.src} poster={v.poster} muted loop autoPlay playsInline preload="metadata" />}
          </div>
        ))}
      </div>
    </div>
  );
  return <div className="pointer-events-none sticky top-0 z-0 hidden h-0 2xl:block" aria-hidden="true"><div className="relative h-screen overflow-hidden">{column(SHOWCASE, "left")}{column([SHOWCASE[2], SHOWCASE[3], SHOWCASE[0], SHOWCASE[1]], "right")}</div></div>;
}
