import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Boxes, Check, ChevronDown, Clapperboard, Copy, Download, FileText, LayoutTemplate, Loader2, Mic, PartyPopper, Play, Plug, Trash2, Upload } from "lucide-react";
import AuthModal from "../../components/AuthModal";
import CreditIcon from "../../components/ui/zyvo/CreditIcon.jsx";
import NoCreditsModal from "../../components/viral-tools/shared/NoCreditsModal";
import Confetti from "../../components/studio-kit/Confetti";
import FlowLoop from "../../components/studio-kit/FlowLoop";
import { DISPLAY, FOCUS, MCP_CARD as CARD, MCP_H2, MCP_PRIMARY as PRIMARY, MCP_SECONDARY as SECONDARY, useStudioOpen } from "../../components/studio-kit/studioKitShared";
import { useAuth } from "../../context/AuthContext";
import { CONNECTOR_MOCK, connector, putFile } from "../../lib/zyvoConnector";
import { CONNECT_CLAUDE_PATH, MCP_TEMPLATES_PATH, STUDIO_PROJECTS_PATH } from "../../data/studioKit";
import "../../components/studio-kit/studioKit.css";

const KIT_PATH = MCP_TEMPLATES_PATH;
const STEPS = [
  { id: "script", label: "Script", icon: FileText },
  { id: "voice", label: "Voice", icon: Mic },
  { id: "recording", label: "Recording", icon: Clapperboard },
  { id: "finished", label: "Finished", icon: PartyPopper },
];
// the step a project is ON (0 = script, done once it is saved): voice needed = 1, voice ready = 2, recorded = 3, done = 4
const STEP_OF = { voice_needed: 1, voice_ready: 2, recorded: 3, finished: 4 };
const STATUS_LABEL = { voice_needed: "Voice needed", voice_ready: "Voice ready", recorded: "Recorded", finished: "Finished" };
const TYPES = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" };
const BIG = `${PRIMARY} w-full sm:w-auto`;
// where "Buy credits" goes: the site's own pricing page (https://www.tryzyvo.com/pricing on live)
const PRICING_PATH = "/pricing";
const ago = (iso) => {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  if (m < 60 * 24) return `${Math.round(m / 60)} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
};
const mmss = (s) => (s == null ? "" : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`);
const withDownload = (url, name) => (url && /^https?:/.test(url) ? `${url}${url.includes("?") ? "&" : "?"}download=${encodeURIComponent(name)}` : url);

/**
 * MCP > MCP Studio (/workspace/mcp/studio; /workspace/studio-projects redirects here, keeping the #<id> card link) (docs/zyvo-studio-kit-plan.md B2). One card per project the free
 * Studio kit reported through the Zyvo connector: a thumbnail, the four-step progress (Script -> Voice -> Recording ->
 * Finished), ONE next-step panel with one primary button, the script folded to two lines. A project that turns
 * Finished while the page is open gets confetti. The server (supabase/functions/_shared/zyvoMcp/site.js) re-checks
 * every price and runs the same code as Claude's tool calls; a failed voice or finish refunds once.
 */
export default function StudioProjects() {
  const open = useStudioOpen();
  const { user, loading: authLoading } = useAuth() ?? {};
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [signIn, setSignIn] = useState(false);
  const [noCredits, setNoCredits] = useState(null);
  const [party, setParty] = useState({ n: 0, origin: null });
  const seen = useRef(new Map()); // project id -> last status
  const signedIn = CONNECTOR_MOCK || Boolean(user);

  useEffect(() => { document.title = "MCP Studio | Zyvo"; }, []);
  const load = useCallback(async () => {
    try {
      const d = await connector("/account/studio");
      // a project that just turned Finished (it wasn't on the last look): confetti from its card
      for (const p of d.projects ?? []) {
        const before = seen.current.get(p.id);
        if (before && before !== "finished" && p.status === "finished") {
          const r = document.getElementById(`p-${p.id}`)?.getBoundingClientRect();
          setParty((x) => ({ n: x.n + 1, origin: r ? { x: r.left + r.width / 2, y: r.top + 80 } : null }));
        }
        seen.current.set(p.id, p.status);
      }
      setData(d); setError(null);
    } catch (e) { setError(e); }
  }, []);
  useEffect(() => { if (signedIn && open === "open") load(); }, [signedIn, open, load]);
  // back from buying credits in another tab: look again, so the balance (and the paid buttons) are current
  useEffect(() => {
    if (!signedIn || open !== "open") return undefined;
    const f = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", f);
    return () => document.removeEventListener("visibilitychange", f);
  }, [signedIn, open, load]);
  // something being made: look again every few seconds (the worker moves the job's stage)
  const busy = data?.projects?.some((p) => p.busy);
  useEffect(() => {
    if (!busy) return undefined;
    const t = window.setInterval(load, CONNECTOR_MOCK ? 1500 : 5000);
    return () => window.clearInterval(t);
  }, [busy, load]);
  // a card link from Claude (…/studio-projects#<id>): scroll to it once the cards are there
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id && data?.projects?.length) document.getElementById(`p-${id}`)?.scrollIntoView({ block: "start" });
  }, [data?.projects?.length]);

  let body;
  if (!signedIn && !authLoading) {
    body = <Empty title="Sign in to see your projects" text="Projects you make with a free template show up here once Claude is connected to your Zyvo account." action={<button type="button" className={PRIMARY} onClick={() => setSignIn(true)}>Sign in</button>} />;
  } else if (open === "closed") {
    body = <Empty title="Coming soon" text="MCP Studio is being tested before launch. It isn't open for this account yet." />;
  } else if (error && !data) {
    body = <Empty title="We couldn't load your projects" text={error.message} action={<button type="button" className={PRIMARY} onClick={load}>Try again</button>} />;
  } else if (!data || open === "loading") {
    body = <div className="grid place-items-center py-16"><Loader2 className="h-5 w-5 animate-spin text-lime-300" aria-label="Loading" /></div>;
  } else if (!data.projects.length) {
    body = <FirstSteps />;
  } else {
    body = (
      <ul className="mt-4 space-y-3">
        {data.projects.map((p, i) => (
          <ProjectCard key={p.id} p={p} index={i} balance={data.balance} onChanged={load} onNoCredits={(n) => setNoCredits(n)} />
        ))}
      </ul>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 style={DISPLAY} className={MCP_H2}>MCP Studio</h2>
          <p className="mt-1.5 text-[14px] text-white/65">What you make with Claude lands here: voice, recording, finished video.</p>
        </div>
        {data?.open && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-[13.5px] font-black text-white" title="Your credits" data-testid="balance">
              <CreditIcon className="h-4 w-4 text-lime-300" />{data.balance}<span className="font-semibold text-white/60">credits</span>
            </span>
            <Link to={MCP_TEMPLATES_PATH} className={SECONDARY}><LayoutTemplate className="h-4 w-4" aria-hidden="true" />Templates</Link>
          </div>
        )}
      </div>
      {data?.open && data.projects.length > 0 && data.freeFinish && (
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-lime-300/10 px-3 py-1 text-[12.5px] font-bold text-lime-100"><PartyPopper className="h-3.5 w-3.5 text-lime-300" aria-hidden="true" />Your first Finish my video is free.</p>
      )}
      {body}
      <Confetti fire={party.n} origin={party.origin} />
      {signIn && <AuthModal mode="login" title="Sign in to Zyvo" subtitle="See your MCP Studio projects." returnTo={STUDIO_PROJECTS_PATH} onClose={() => setSignIn(false)} />}
      <NoCreditsModal open={Boolean(noCredits)} onClose={() => setNoCredits(null)} creditsNeeded={noCredits ?? 0} creditBalance={data?.balance ?? 0} variant="lime" />
    </div>
  );
}

function Empty({ title, text, action }) {
  return (
    <div className={`${CARD} mt-6 max-w-[520px] p-5`}>
      <p className="text-[15px] font-bold text-white">{title}</p>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/65">{text}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/** no projects yet: the flow as a loop, then the two ways in */
function FirstSteps() {
  return (
    <div className="mt-6 rounded-2xl border border-lime-300/20 bg-gradient-to-b from-[#121a0d] to-[#0B0D0F] p-4 sm:p-6">
      <p style={DISPLAY} className="text-center text-[22px] font-extrabold uppercase leading-none text-white sm:text-[24px]">Your first MCP video</p>
      <p className="mx-auto mb-5 mt-1.5 max-w-[520px] text-center text-[13.5px] text-white/70">Pick a template, Claude builds it in your Roblox Studio, the video lands here.</p>
      <FlowLoop compact />
      <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
        <Link to={KIT_PATH} className={PRIMARY}><LayoutTemplate className="h-4 w-4" aria-hidden="true" />Pick a free template</Link>
        <Link to={CONNECT_CLAUDE_PATH} className={SECONDARY}><Plug className="h-4 w-4" aria-hidden="true" />Connect Claude</Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- one project
function ProjectCard({ p, index, balance, onChanged, onNoCredits }) {
  const step = STEP_OF[p.status] ?? 1;
  const job = p.job;
  const making = p.busy && job;
  const failed = job?.status === "failed";
  const [removing, setRemoving] = useState(false);
  const [notice, setNotice] = useState(null);
  const remove = async () => {
    try { await connector("/account/studio/remove", { method: "POST", body: { id: p.id } }); onChanged(); }
    catch (e) { setNotice(e.message); setRemoving(false); }
  };

  return (
    <li id={`p-${p.id}`} className={`${CARD} sk-fadeup scroll-mt-6 overflow-hidden ${p.status === "finished" ? "border-lime-300/40" : ""}`} style={{ animationDelay: `${Math.min(index, 4) * 70}ms` }}>
      <div className="flex gap-3 p-3.5 sm:gap-4 sm:p-4">
        <Thumb p={p} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-balance text-[15px] font-bold leading-snug text-white sm:text-[16px]">{p.title}</h3>
              <p className="mt-0.5 text-[12px] text-white/50">{p.lines.length} lines · about {mmss(p.estimatedSeconds)}{p.shots ? ` · ${p.shots} shots` : ""} · {ago(p.updatedAt)}</p>
            </div>
            <span className={`hidden shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-black sm:inline-flex ${p.status === "finished" ? "border-lime-300 bg-lime-300 text-[#11150D]" : "border-white/15 bg-white/[0.05] text-white/75"}`}>
              {making ? (job.kind === "voice" ? "Making the voice" : "Finishing") : STATUS_LABEL[p.status]}
            </span>
          </div>
          <Stepper step={step} busy={Boolean(making)} />
        </div>
      </div>

      <div className="px-3.5 pb-3.5 sm:px-4 sm:pb-4">
        {failed && (
          <p className="mb-3 flex gap-2 rounded-lg border border-red-400/25 bg-red-500/10 px-3 py-2 text-[13px] text-red-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" aria-hidden="true" />
            <span>The last {job.kind === "voice" ? "voice" : "finish"} didn't work: {job.error}{job.refunded && job.credits ? ` ${job.credits} credits were given back.` : ""}</span>
          </p>
        )}
        <NextStep p={p} balance={balance} onChanged={onChanged} onNoCredits={onNoCredits} />
        <Script lines={p.lines} />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-white/[0.07] px-3.5 py-2 sm:px-4">
        <p className="truncate text-[11.5px] text-white/40">Kit project <span className="font-mono text-white/55">{p.kitProjectId}</span>{p.kitVersion ? ` · kit ${p.kitVersion}` : ""}</p>
        {!p.busy && (removing ? (
          <span className="flex shrink-0 items-center gap-2 text-[12.5px] text-white/70">Remove it?
            <button type="button" onClick={remove} className={`rounded-lg bg-red-500/20 px-2.5 py-1 font-bold text-red-100 hover:bg-red-500/30 ${FOCUS}`}>Remove</button>
            <button type="button" onClick={() => setRemoving(false)} className={`rounded-lg px-2 py-1 font-bold text-white/70 hover:text-white ${FOCUS}`}>Keep</button>
          </span>
        ) : (
          <button type="button" onClick={() => setRemoving(true)} className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-[12.5px] font-bold text-white/45 hover:text-white/80 ${FOCUS}`}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />Remove</button>
        ))}
      </div>
      {notice && <p className="px-4 pb-3 text-[13px] text-amber-200">{notice}</p>}
    </li>
  );
}

/** the thumbnail: the finished video's poster (tap: play), else a tile with the step's icon */
function Thumb({ p }) {
  const [play, setPlay] = useState(false);
  const f = p.final;
  const Icon = STEPS[Math.min(3, STEP_OF[p.status] ?? 1)].icon;
  return (
    <div className="relative aspect-[9/16] w-[64px] shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black sm:w-[84px]">
      {f?.poster || f?.video ? (
        play ? <video src={f.video} poster={f.poster} controls autoPlay playsInline className="h-full w-full object-cover" /> : (
          <button type="button" onClick={() => setPlay(true)} className={`group absolute inset-0 ${FOCUS}`} aria-label={`Play ${p.title}`}>
            <img src={f.poster} alt="" className="h-full w-full object-cover" />
            <span className="absolute inset-0 grid place-items-center bg-black/25 transition group-hover:bg-black/10">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-lime-300 text-[#11150D] shadow-lg"><Play className="ml-0.5 h-4 w-4" aria-hidden="true" /></span>
            </span>
          </button>
        )
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_30%,rgba(190,242,100,0.22),transparent_65%),linear-gradient(160deg,#1a2412,#0B0D0F)]">
          <Boxes className="absolute left-1.5 top-1.5 h-3.5 w-3.5 text-lime-300/50" aria-hidden="true" />
          <Icon className="sk-float h-6 w-6 text-lime-300/80 sm:h-7 sm:w-7" aria-hidden="true" />
          <span className="absolute bottom-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-white/40">9:16</span>
        </div>
      )}
    </div>
  );
}

/** the big four-step progress: done steps pop a check, the current one glows */
function Stepper({ step, busy }) {
  return (
    <ol className="mt-3 flex items-start" aria-label={`Step ${Math.min(step + 1, 4)} of 4`}>
      {STEPS.map((s, i) => {
        const done = i < step, now = i === step, Icon = s.icon;
        return (
          <li key={s.id} className={`flex items-start ${i < STEPS.length - 1 ? "flex-1" : ""}`}>
            <div className="flex w-12 flex-col items-center gap-1 sm:w-14">
              <span className={`grid h-8 w-8 place-items-center rounded-full border-2 sm:h-9 sm:w-9 ${done ? "border-lime-300 bg-lime-300 text-[#11150D]" : now ? "sk-glow border-lime-300 bg-[#16200c] text-lime-200" : "border-white/15 bg-white/[0.03] text-white/35"}`}>
                {done ? (
                  <svg viewBox="0 0 24 24" className="sk-pop sk-check h-4 w-4 sm:h-[18px] sm:w-[18px]" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" style={{ animationDelay: `${i * 120}ms` }} aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                ) : now && busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Icon className="h-4 w-4" aria-hidden="true" />}
              </span>
              <span className={`text-center text-[10.5px] font-black sm:text-[11.5px] ${done ? "text-lime-200" : now ? "text-white" : "text-white/40"}`}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <span className="relative mt-[15px] h-0.5 flex-1 overflow-hidden rounded-full bg-white/10 sm:mt-[17px]">
                <span className="absolute inset-y-0 left-0 rounded-full bg-lime-300 transition-[width] duration-700 ease-out" style={{ width: i + 1 <= step ? "100%" : "0%", transitionDelay: `${i * 120}ms` }} />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** ONE next step per card, one primary button */
function NextStep({ p, balance, onChanged, onNoCredits }) {
  const job = p.job;
  if (p.busy && job) return <Panel title={job.kind === "voice" ? "Making the voice" : "Finishing your video"}><Making job={job} /></Panel>;
  if (p.status === "voice_needed") {
    // THE FREE PATH (owner 2026-11-23): a free account that can't pay for the voice skips it. The first finish is free
    // and makes the voice, fitted to the recording. Without this, the card's only button was a voice they can't pay for.
    if (p.prices.finishFree && !(Number(balance) >= Number(p.prices.voice))) {
      return (
        <Panel title="Next: drop your recording" text="Your first Finish my video is free and makes the voice too. So skip the voice: record the Play run in Studio, then drop the file here (or let Claude upload it).">
          <UploadDrop p={p} onChanged={onChanged} />
        </Panel>
      );
    }
    return (
      <Panel title="Next: create the voice" text="Our narrator reads your script with exact word timings. Or record your own in the kit: free.">
        <PaidAction icon={Mic} label="Create voice" credits={p.prices.voice} balance={balance} path="/account/studio/voice" id={p.id} what={`The voice for "${p.title}" (about ${mmss(p.estimatedSeconds)})`} onChanged={onChanged} onNoCredits={onNoCredits} />
      </Panel>
    );
  }
  if (p.status === "voice_ready") {
    return (
      <Panel title="Next: drop your recording" text="Record the Play run in Studio, then drop the file here (or let Claude upload it)."
        extra={p.voice && <span className="flex flex-wrap gap-x-3 gap-y-1 text-[12.5px]"><span className="text-white/55">Voice {mmss(p.voice.seconds)}</span><a href={withDownload(p.voice.mp3, "voice.mp3")} className="font-bold text-white/70 underline underline-offset-4 hover:text-white">voice.mp3</a><a href={withDownload(p.voice.words, "words.json")} className="font-bold text-white/70 underline underline-offset-4 hover:text-white">words.json</a></span>}>
        <UploadDrop p={p} onChanged={onChanged} />
      </Panel>
    );
  }
  if (p.status === "recorded") {
    return (
      <Panel title="Next: finish the video" text="Upright, fitted to the voice, coloured captions, sound effects and music. Plus a copy without music.">
        <PaidAction icon={Clapperboard} label="Finish my video" credits={p.prices.finish} free={p.prices.finishFree} balance={balance} path="/account/studio/finish" id={p.id} what={`Finish "${p.title}"`} onChanged={onChanged} onNoCredits={onNoCredits} />
      </Panel>
    );
  }
  const f = p.final;
  return (
    <Panel title="Your video is ready" text={`${mmss(f?.seconds)} · made ${f?.madeAt ? ago(f.madeAt) : ""}${f?.notes?.length ? ` · ${f.notes[0]}` : ""}`} done>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <a href={withDownload(f?.download, `${p.kitProjectId}.mp4`)} className={BIG}><Download className="h-4 w-4" aria-hidden="true" />Download</a>
        {f?.noMusic && <a href={withDownload(f.noMusic, `${p.kitProjectId} (no music).mp4`)} className={SECONDARY}><Download className="h-4 w-4" aria-hidden="true" />Without music</a>}
      </div>
    </Panel>
  );
}

function Panel({ title, text, extra, done = false, children }) {
  return (
    <div className={`rounded-xl border p-3.5 sm:p-4 ${done ? "border-lime-300/50 bg-lime-300/[0.08]" : "border-lime-300/25 bg-gradient-to-br from-lime-300/[0.07] to-transparent"}`}>
      <p className="text-[15px] font-black text-white">{title}</p>
      {text && <p className="mb-3 mt-0.5 text-[13.5px] leading-relaxed text-white/65">{text}</p>}
      {!text && <div className="mb-3" />}
      {children}
      {extra && <div className="mt-3">{extra}</div>}
    </div>
  );
}

function Script({ lines }) {
  const [all, setAll] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = lines.map((l) => (l.speaker ? `${l.speaker}: ${l.text}` : l.text)).join("\n");
  const copy = async () => { try { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1500); } catch { /* selectable */ } };
  return (
    <div className="mt-3 rounded-lg border border-white/[0.08] bg-black/25 px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => setAll((v) => !v)} aria-expanded={all} className={`flex items-center gap-1 text-[11.5px] font-black uppercase tracking-[0.12em] text-white/55 hover:text-white ${FOCUS}`}>
          {all ? "Hide script" : "Show script"}<ChevronDown className={`h-4 w-4 transition ${all ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
        <button type="button" onClick={copy} className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[12.5px] font-bold text-white/60 hover:bg-white/10 hover:text-white ${FOCUS}`}>
          {copied ? <Check className="h-3.5 w-3.5 text-lime-300" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}{copied ? "Copied" : "Copy"}
        </button>
      </div>
      <ol className={`mt-1.5 space-y-1 text-[13.5px] leading-relaxed text-white/75 ${all ? "" : "line-clamp-2"}`}>
        {(all ? lines : lines.slice(0, 2)).map((l, i) => (
          <li key={i}>{l.speaker && <span className="mr-1.5 font-black text-lime-200">{l.speaker}:</span>}{l.text}</li>
        ))}
      </ol>
    </div>
  );
}

function Making({ job }) {
  const stage = job.kind === "voice" ? "the narrator is reading your script" : String(job.stage ?? "in line").replace(/_/g, " ");
  return (
    <div>
      <div className="flex items-center justify-between text-[13px] font-bold text-white/80">
        <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin text-lime-300" aria-hidden="true" />{job.status === "queued" ? "In line, starting soon" : stage}</span>
        <span className="tabular-nums text-lime-200">{job.pct ?? 0}%</span>
      </div>
      <div className="sk-shimmer mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-lime-300 transition-all duration-700" style={{ width: `${Math.max(4, job.pct ?? 0)}%` }} /></div>
      <p className="mt-2 text-[12px] text-white/50">{job.kind === "voice" ? "About a minute." : "Usually 3-6 minutes."} You can leave this page.</p>
    </div>
  );
}

/** a paid button: the price, then one "Yes" (the click that takes the credits); a changed price asks again */
function PaidAction({ icon, label, credits, free, balance, path, id, what, onChanged, onNoCredits }) {
  const Icon = icon;
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const go = async () => {
    setBusy(true); setNotice(null);
    try { await connector(path, { method: "POST", body: { id, credits: free ? 0 : credits } }); setAsking(false); onChanged(); }
    catch (e) {
      if (e.code === "CREDITS") { onNoCredits(credits); onChanged(); }
      else { setNotice(e.message); if (e.code === "PRICE_CHANGED") onChanged(); }
    } finally { setBusy(false); }
  };
  // the balance can't pay the price: the button is off and says so, with Buy credits (owner 2026-11-20, item 13); this
  // also covers the "Yes" step, so a balance that drops meanwhile never starts a job that can't be paid
  const short = !free && !(Number(balance) >= Number(credits));
  const price = free ? <span className="ml-1 rounded-md bg-black/15 px-1.5 py-0.5 text-[13px]">Free</span> : <span className="ml-1 inline-flex items-center gap-1 rounded-md bg-black/15 px-1.5 py-0.5 text-[13px]"><CreditIcon className="h-3.5 w-3.5" />{credits}</span>;
  if (short) {
    return (
      <div data-testid="not-enough-credits">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button type="button" className="inline-flex min-h-10 w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-[14px] font-black text-white/55 sm:w-auto" disabled aria-describedby={`short-${id}`}><Icon className="h-4 w-4" aria-hidden="true" />Not enough credits{price}</button>
          <Link to={PRICING_PATH} className={`${SECONDARY} border-lime-300/40 text-lime-100 hover:border-lime-300`}><CreditIcon className="h-4 w-4 text-lime-300" />Buy credits</Link>
        </div>
        <p id={`short-${id}`} className="mt-2 text-[12.5px] text-white/55">{label} costs {credits} credits. You have {balance ?? 0}. Nothing is charged until you can pay.</p>
      </div>
    );
  }
  return (
    <div>
      {!asking ? (
        <button type="button" className={BIG} onClick={() => setAsking(true)}><Icon className="h-4 w-4" aria-hidden="true" />{label}{price}</button>
      ) : (
        <div className="sk-fadeup rounded-lg border border-lime-300/40 bg-black/30 p-3">
          <p className="text-[13.5px] leading-relaxed text-white">
            {free ? <>{what}: <b className="text-lime-200">free</b>, your first finish.</> : <>{what}: <b className="text-lime-200">{credits} credits</b>. Balance {balance} → {balance - credits}.</>}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button type="button" className={PRIMARY} disabled={busy} onClick={go}>{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}Yes, {label.toLowerCase()}</button>
            <button type="button" className={SECONDARY} disabled={busy} onClick={() => setAsking(false)}>Cancel</button>
          </div>
        </div>
      )}
      {notice && <p className="mt-2 text-[13px] text-amber-200" role="status">{notice}</p>}
    </div>
  );
}

function UploadDrop({ p, onChanged }) {
  const input = useRef(null);
  const [pct, setPct] = useState(null);
  const [notice, setNotice] = useState(null);
  const [over, setOver] = useState(false);
  const send = async (file) => {
    if (!file) return;
    const format = TYPES[file.type] ?? (/\.(mp4|mov|webm)$/i.exec(file.name)?.[1] ?? "").toLowerCase();
    if (!format) { setNotice("Upload an mp4, mov or webm video."); return; }
    if (file.size > 500 * 1024 * 1024) { setNotice("The recording is over 500 MB. Record a shorter take or a lower bitrate."); return; }
    setNotice(null); setPct(0);
    try {
      const up = await connector("/account/studio/upload", { method: "POST", body: { id: p.id, format, bytes: file.size } });
      await putFile(up.url, file, up.contentType, setPct);
      await connector("/account/studio/uploaded", { method: "POST", body: { id: p.id } });
      onChanged();
    } catch (e) { setNotice(e.message); }
    finally { setPct(null); }
  };
  return (
    <div>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); send(e.dataTransfer.files?.[0]); }}
        disabled={pct != null}
        className={`flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-5 text-center transition ${over ? "scale-[1.01] border-lime-300 bg-lime-300/15" : "border-lime-300/40 bg-lime-300/[0.04] hover:border-lime-300 hover:bg-lime-300/[0.08]"} ${FOCUS}`}
      >
        {pct != null ? (
          <>
            <Loader2 className="h-6 w-6 animate-spin text-lime-300" aria-hidden="true" />
            <span className="text-[14.5px] font-black text-white">Uploading {Math.round(pct * 100)}%</span>
            <span className="h-2 w-full max-w-[260px] overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-lime-300 transition-all" style={{ width: `${Math.round(pct * 100)}%` }} /></span>
          </>
        ) : (
          <>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-lime-300 text-[#11150D]"><Upload className="h-[18px] w-[18px]" aria-hidden="true" /></span>
            <span className="text-[14.5px] font-black text-white">Drop recording</span>
            <span className="text-[12px] text-white/50">or tap to choose · mp4, mov, webm · up to 500 MB · deleted after 7 days</span>
          </>
        )}
      </button>
      <input ref={input} type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" className="hidden" onChange={(e) => send(e.target.files?.[0])} />
      {notice && <p className="mt-2 text-[13px] text-amber-200" role="status">{notice}</p>}
    </div>
  );
}
