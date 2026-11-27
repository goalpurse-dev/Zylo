import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Clapperboard, Download, Image as ImageIcon, ImagePlus, Loader2, MessageCircle, RotateCcw, Sparkles, Trash2, X } from "lucide-react";
import AuthModal from "../../components/AuthModal";
import { useAuth } from "../../context/AuthContext";
import { useProfileCredits } from "../../hooks/useProfileCredits";
import { uploadUserFile } from "../../lib/storage";
import { saveMediaToDevice } from "../../lib/downloadMedia";
import { DIRECTOR_MOCK } from "../../lib/director";
import { QUICK, useQuickGenerate, useQuickPrice } from "../../components/create/useQuickGenerate";
import { QUICK_INSPIRATION } from "../../components/create/quickInspiration";
import { clearPendingPrompt, peekPendingPrompt } from "../../lib/pendingPrompt";
import { Lime, PageGlow } from "../../components/create/PageGlow";
import Reveal from "../../components/create/Reveal";
import { CREATE_PATH, MAESTRO_PATH, QUICK_GENERATE_PATH } from "../../data/styles";

const shapeClass = (size) => (size === "16:9" ? "aspect-video" : size === "1:1" ? "aspect-square" : "aspect-[9/16]");
const chip = (on) => `rounded-lg px-2.5 py-1 text-[12px] font-semibold transition ${on ? "bg-lime-300 text-[#11150D]" : "bg-white/[0.06] text-white/85 hover:bg-white/[0.12]"}`;

/** /generate: QUICK GENERATE, the standard generator layout. One line -> images or short clips (no voice). */
export default function QuickGenerate() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth() ?? {};
  const balance = useProfileCredits();
  const { items, start, remove } = useQuickGenerate("quick-generate");
  const [mode, setMode] = useState(location.state?.mode === "video" ? "video" : "image");
  const [size, setSize] = useState("9:16");
  const [seconds, setSeconds] = useState(5);
  const [count, setCount] = useState(1);
  const [prompt, setPrompt] = useState(location.state?.prompt ?? peekPendingPrompt("quick"));
  useEffect(() => { if (user) clearPendingPrompt("quick"); }, [user]);
  const [ref, setRef] = useState(location.state?.refImage ? { id: location.state.refImage.id, url: location.state.refImage.url, name: "Your image" } : null);
  const [error, setError] = useState(null);
  const [signIn, setSignIn] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [going, setGoing] = useState(false);
  const box = useRef(null);
  const file = useRef(null);
  const price = useQuickPrice(mode, size, seconds);
  const total = price == null ? null : price * count;

  // always opens at the top
  useEffect(() => { document.title = "Quick Generate | Zyvo"; document.getElementById("workspace-scroll")?.scrollTo({ top: 0 }); }, []);
  useEffect(() => { if (!QUICK.sizes[mode].some(([k]) => k === size)) setSize("9:16"); }, [mode, size]);
  // the text box grows with the text, never below 2 lines (an empty box must always be visible)
  useEffect(() => { const el = box.current; if (!el) return; el.style.height = "auto"; el.style.height = `${Math.max(52, Math.min(el.scrollHeight, Math.round(window.innerHeight * 0.3)))}px`; }, [prompt]);

  const addRef = async (f) => {
    if (!f) return;
    if (!user) { setSignIn(true); return; }
    if (!/^image\//.test(f.type) || f.size > 10 * 1024 * 1024) { setError("Pick an image under 10 MB."); return; }
    setUploading(true); setError(null);
    try { const r = await uploadUserFile(f, { prefix: "quick-generate" }); setRef({ id: r.path, url: r.signedUrl, name: f.name }); }
    catch { setError("That image didn't upload. Try again."); }
    finally { setUploading(false); }
  };

  const go = async (again = null) => {
    const req = again ?? { mode, size, seconds, prompt: prompt.trim(), ref };
    const n = again ? 1 : count;
    if (req.prompt.length < 3) { setError("Describe what you want in a few words."); box.current?.focus(); return; }
    if (!user && !DIRECTOR_MOCK) { setSignIn(true); return; }
    const each = again?.credits ?? price;
    if (each == null && !DIRECTOR_MOCK) { setError("Getting the price… try again in a second."); return; }
    setError(null); setGoing(true);
    // one at a time, each with its own price check (a short balance stops the rest, nothing half-charged)
    let left = Number(balance);
    for (let i = 0; i < n; i++) { await start(req, { credits: each, balance: left }); left -= Number(each ?? 0); }
    setGoing(false);
    if (!again) setPrompt("");
  };
  const reuse = (m) => { setMode(m.mode); setSize(m.size); if (m.seconds) setSeconds(m.seconds); setPrompt(m.prompt); setRef(m.ref ?? null); document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "smooth" }); requestAnimationFrame(() => box.current?.focus()); };
  const toMaestro = (m) => navigate(MAESTRO_PATH, { state: { text: `Make a short video from this idea: ${m.prompt}` } });
  const inspire = (x) => { setMode("image"); setPrompt(x.prompt); document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "smooth" }); requestAnimationFrame(() => box.current?.focus()); };

  return (
    <div className="relative isolate min-h-full overflow-x-clip pb-16">
      <PageGlow />
      <div className="relative mx-auto w-full max-w-[1100px] px-4 pt-6 lg:px-6">
        <h1 className="text-center text-[28px] font-black leading-[1.05] tracking-[-0.03em] text-white sm:text-[40px]">Quick <Lime>Generate</Lime></h1>
        <p className="mx-auto mt-2 max-w-[600px] text-center text-[15px] text-white/80">Images and short clips (5 to 10 seconds, no voice) from one line. For a full story video, <Link to={MAESTRO_PATH} className="font-bold text-lime-300 hover:underline">ask Maestro</Link> or <Link to={CREATE_PATH} className="font-bold text-lime-300 hover:underline">open Create</Link>.</p>

        {/* the compact bar */}
        <div className="mx-auto mt-5 w-full max-w-[820px] rounded-[22px] border border-white/[0.12] bg-[#141618]/95 p-3 shadow-[0_20px_60px_rgba(0,0,0,.5)]" data-testid="quick-generate-bar">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className="flex items-center gap-0.5 rounded-full bg-white/[0.06] p-0.5" role="radiogroup" aria-label="What to make">
              {[["image", "Image", <ImageIcon key="i" className="h-3.5 w-3.5" />], ["video", "Short clip", <Clapperboard key="v" className="h-3.5 w-3.5" />]].map(([id, label, icon]) => (
                <button key={id} type="button" role="radio" aria-checked={mode === id} onClick={() => setMode(id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-bold transition ${mode === id ? "bg-white text-black" : "text-white/80 hover:text-white"}`}>{icon}{label}</button>
              ))}
            </div>
            <div className="flex items-center gap-1" role="group" aria-label="Shape">
              {QUICK.sizes[mode].map(([k, label]) => <button key={k} type="button" aria-pressed={size === k} onClick={() => setSize(k)} className={chip(size === k)}>{label}</button>)}
            </div>
            {mode === "video" && (
              <div className="flex items-center gap-1" role="group" aria-label="Length">
                {QUICK.lengths.map((s) => <button key={s} type="button" aria-pressed={seconds === s} onClick={() => setSeconds(s)} className={chip(seconds === s)}>{s}s</button>)}
              </div>
            )}
            <div className="flex items-center gap-1" role="group" aria-label="How many">
              <span className="mr-0.5 text-[11px] font-semibold uppercase tracking-wide text-white/55">How many</span>
              {[1, 2, 3, 4].map((n) => <button key={n} type="button" aria-pressed={count === n} onClick={() => setCount(n)} className={chip(count === n)}>{n}</button>)}
            </div>
            <Link to={mode === "image" ? "/workspace/image-generator" : "/workspace/video-generator"} state={{ prompt }} className="ml-auto text-[12px] font-semibold text-white/70 hover:text-white">More settings</Link>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-2 sm:flex-nowrap">
            <label htmlFor="quick-prompt" className="sr-only">What do you want to make?</label>
            <textarea id="quick-prompt" ref={box} rows={2} value={prompt} maxLength={2000} onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) go(); }}
              placeholder={mode === "image" ? "Describe the image you want" : "Describe the clip you want"}
              className="min-h-[52px] w-full flex-1 basis-full resize-none bg-transparent px-1 py-1 text-[16px] leading-6 text-white placeholder:text-white/45 focus:outline-none sm:basis-0" />
            {/* the text takes the space on the left; the picture and Generate sit on the right (owner 2026-11-26) */}
            <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => { addRef(e.target.files?.[0]); e.target.value = ""; }} />
            {ref ? (
              <span className="mb-1 inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white/[0.07] py-1 pl-1 pr-2 text-[12px] text-white/85">
                <img src={ref.url} alt="" className="h-9 w-9 rounded-lg object-cover" />
                <button type="button" onClick={() => setRef(null)} className="inline-flex items-center gap-0.5 text-white/65 hover:text-white"><X className="h-3 w-3" />Remove</button>
              </span>
            ) : (
              <button type="button" onClick={() => file.current?.click()} disabled={uploading} title="Start from an image" className="mb-1 inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/15 px-2.5 py-2 text-[12px] font-semibold text-white/85 hover:border-white/30">
                <ImagePlus className="h-4 w-4" /><span>{uploading ? "Uploading…" : "Start from an image"}</span>
              </button>
            )}
            <button type="button" onClick={() => go()} disabled={going} className="mb-0.5 ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-lime-300 sm:ml-0 px-4 py-2.5 text-[14px] font-black text-[#11150D] shadow-[0_0_24px_rgba(190,242,100,.3)] hover:bg-lime-200 disabled:opacity-70" data-testid="quick-generate-go">
              {going ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}Generate{total != null && <span className="rounded-md bg-black/10 px-1.5 py-0.5 text-[12px] font-bold">{total} credits</span>}
            </button>
          </div>
          {error && <p className="mt-2 text-[13px] text-rose-300" role="alert">{error}</p>}
        </div>

        {/* your generations */}
        {items.length > 0 && (
          <section className="mt-9" aria-labelledby="quick-results">
            <h2 id="quick-results" className="text-[18px] font-black text-white">Your generations</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" data-testid="quick-results">
              {items.map((m, i) => (
                <Reveal key={m.id} delay={(i % 4) * 50}>
                  <article className="overflow-hidden rounded-2xl border border-white/[0.09] bg-white/[0.03]">
                    <div className={`relative w-full overflow-hidden bg-black ${shapeClass(m.size)}`}>
                      {m.status === "done" ? (
                        m.mode === "image" ? <img src={m.url} alt={m.prompt} className="h-full w-full object-contain" /> : <video src={m.url} controls muted loop playsInline className="h-full w-full object-contain" />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-lime-300/[0.06] via-white/[0.02] to-violet-400/[0.06] p-3 text-center">
                          {m.status === "making" && <><Loader2 className="h-6 w-6 animate-spin text-lime-300" /><p className="text-[12.5px] font-semibold text-white/85">{m.mode === "image" ? "Making your image…" : "Making your clip… about a minute"}</p></>}
                          {m.status === "failed" && <p className="text-[12.5px] text-rose-200">{m.error ?? "It didn't work."}</p>}
                          {m.status === "short" && <p className="text-[12.5px] text-white/85">This costs <b>{m.credits}</b> credits, you have <b>{m.have}</b>. Nothing was charged.<br /><Link to="/pricing" className="mt-1 inline-block font-bold text-lime-300">Get credits</Link> · <Link to="/rewards" className="font-bold text-lime-300">Free credits</Link></p>}
                        </div>
                      )}
                      <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10.5px] font-bold text-white backdrop-blur">{m.mode === "image" ? "Image" : `Clip · ${m.seconds}s`}</span>
                    </div>
                    <div className="px-3 py-2.5">
                      <p className="line-clamp-2 text-[13px] text-white/90">{m.prompt}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {m.status === "done" && (
                          <button type="button" onClick={() => saveMediaToDevice({ url: m.url, filename: m.mode === "image" ? "zyvo-image.png" : "zyvo-clip.mp4", title: "My Zyvo creation" }).catch(() => window.open(m.url, "_blank"))}
                            className="inline-flex items-center gap-1 rounded-lg bg-lime-300 px-2.5 py-1 text-[12px] font-black text-[#11150D]"><Download className="h-3.5 w-3.5" />Download</button>
                        )}
                        {m.status !== "making" && <button type="button" onClick={() => reuse(m)} className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1 text-[12px] font-bold text-white"><RotateCcw className="h-3.5 w-3.5" />Use again</button>}
                        {m.status === "done" && <button type="button" onClick={() => toMaestro(m)} className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1 text-[12px] font-bold text-white"><MessageCircle className="h-3.5 w-3.5" /><span className="sm:hidden">Make a video</span><span className="hidden sm:inline">Make a video from this</span></button>}
                        {m.status !== "making" && <button type="button" onClick={() => remove(m.id)} aria-label="Remove from this list" className="ml-auto inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[12px] text-white/60 hover:text-white"><Trash2 className="h-3.5 w-3.5" />Remove</button>}
                      </div>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          </section>
        )}

        {/* inspiration: real results with the prompt that made them; click = use it */}
        <section className="mt-10" aria-labelledby="quick-inspo">
          <h2 id="quick-inspo" className="text-[18px] font-black text-white">Inspiration</h2>
          <p className="mt-0.5 text-[13px] text-white/70">Real images made with Zyvo. Tap one to use its prompt.</p>
          <div className="mt-3 columns-2 gap-3 sm:columns-3 lg:columns-4" data-testid="quick-inspiration">
            {QUICK_INSPIRATION.map((x, i) => (
              <button key={i} type="button" onClick={() => inspire(x)} className="group relative mb-3 block w-full break-inside-avoid overflow-hidden rounded-2xl border border-white/[0.08] text-left">
                <img src={x.src} alt="" loading="lazy" className="w-full" />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-2.5 pt-8 text-[12px] leading-snug text-white/90 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                  <span className="line-clamp-3">{x.prompt}</span>
                  <span className="mt-1 inline-block font-bold text-lime-300">Use this prompt</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
      {signIn && <AuthModal mode="signup" title="Make your first image" subtitle="A free Zyvo account is all you need." returnTo={QUICK_GENERATE_PATH} onClose={() => setSignIn(false)} />}
    </div>
  );
}
