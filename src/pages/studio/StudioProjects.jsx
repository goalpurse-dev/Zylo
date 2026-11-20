import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Check, ChevronDown, Clapperboard, Copy, Download, Film, Loader2, Mic, Plug, Trash2, Upload } from "lucide-react";
import AuthModal from "../../components/AuthModal";
import CreditIcon from "../../components/ui/zyvo/CreditIcon.jsx";
import NoCreditsModal from "../../components/viral-tools/shared/NoCreditsModal";
import { useAuth } from "../../context/AuthContext";
import { CONNECTOR_MOCK, connector, putFile } from "../../lib/zyvoConnector";
import { CONNECT_CLAUDE_PATH, STUDIO_PROJECTS_PATH } from "../../data/studioKit";
import { MockBanner } from "../../components/studio-kit/StudioKitUI";
import { CARD, DISPLAY, FOCUS, PRIMARY, SECONDARY, useDisplayFont, useStudioOpen } from "../../components/studio-kit/studioKitShared";

const KIT_PATH = "/in-this-town-story-video-maker#studio";
const STEPS = [["script", "Script"], ["voice", "Voice"], ["recording", "Recording"], ["finished", "Finished"]];
const STATUS = {
  voice_needed: { label: "Voice needed", tone: "text-amber-200 bg-amber-300/10 border-amber-300/25", step: 1 },
  voice_ready: { label: "Voice ready", tone: "text-lime-200 bg-lime-300/10 border-lime-300/25", step: 2 },
  recorded: { label: "Recorded", tone: "text-sky-200 bg-sky-300/10 border-sky-300/25", step: 3 },
  finished: { label: "Finished", tone: "text-[#11150D] bg-lime-300 border-lime-300", step: 4 },
};
const TYPES = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" };
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
 * /workspace/studio-projects: the Studio projects tab (docs/zyvo-studio-kit-plan.md B2). One card per project the free
 * Studio kit reported through the Zyvo connector: the script (read-only, copy), Create voice (the price, the balance,
 * credits taken only after the yes), the voice's player + downloads, the recording upload, Finish my video, and the
 * finished video. The server (supabase/functions/_shared/zyvoMcp/site.js) re-checks every price and runs the same
 * code as Claude's tool calls; a failed voice or finish refunds once.
 */
export default function StudioProjects() {
  useDisplayFont();
  const open = useStudioOpen();
  const { user, loading: authLoading } = useAuth() ?? {};
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [signIn, setSignIn] = useState(false);
  const [noCredits, setNoCredits] = useState(null);
  const signedIn = CONNECTOR_MOCK || Boolean(user);

  useEffect(() => { document.title = "Studio projects | Zyvo"; }, []);
  const load = useCallback(async () => {
    try { setData(await connector("/account/studio")); setError(null); }
    catch (e) { setError(e); }
  }, []);
  useEffect(() => { if (signedIn && open === "open") load(); }, [signedIn, open, load]);
  // something being made: look again every 5 s (the worker moves the job's stage)
  const busy = data?.projects?.some((p) => p.busy);
  useEffect(() => {
    if (!busy) return undefined;
    const t = window.setInterval(load, 5000);
    return () => window.clearInterval(t);
  }, [busy, load]);
  // a card link from Claude (…/studio-projects#<id>): scroll to it once the cards are there
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id && data?.projects?.length) document.getElementById(`p-${id}`)?.scrollIntoView({ block: "start" });
  }, [data?.projects?.length]);

  let body;
  if (!signedIn && !authLoading) {
    body = <Empty title="Sign in to see your Studio projects" text="Projects you make with the free Studio kit show up here once Claude is connected to your Zyvo account." action={<button type="button" className={PRIMARY} onClick={() => setSignIn(true)}>Sign in</button>} />;
  } else if (open === "closed") {
    body = <Empty title="Coming soon" text="Studio projects are being tested before launch. They aren't open for this account yet." />;
  } else if (error && !data) {
    body = <Empty title="We couldn't load your projects" text={error.message} action={<button type="button" className={PRIMARY} onClick={load}>Try again</button>} />;
  } else if (!data || open === "loading") {
    body = <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-lime-300" aria-label="Loading" /></div>;
  } else if (!data.projects.length) {
    body = <FirstSteps />;
  } else {
    body = (
      <ul className="mt-6 space-y-4">
        {data.projects.map((p) => (
          <ProjectCard key={p.id} p={p} balance={data.balance} onChanged={load} onNoCredits={(n) => setNoCredits(n)} />
        ))}
      </ul>
    );
  }

  return (
    <div className="min-h-full w-full bg-[#0B0D0F] pb-16">
      <MockBanner />
      <div className="mx-auto w-full max-w-[980px] px-4 pt-8 sm:px-6 sm:pt-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[13px] font-black uppercase tracking-[0.16em] text-lime-300">In This Town · Roblox Studio</p>
            <h1 style={DISPLAY} className="mt-1.5 text-[40px] font-extrabold uppercase leading-[0.95] text-white sm:text-[52px]">Studio projects</h1>
          </div>
          {data?.open && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[14px] font-black text-white" title="Your credits">
                <CreditIcon className="h-4 w-4 text-lime-300" />{data.balance}<span className="font-semibold text-white/55">credits</span>
              </span>
              <Link to={CONNECT_CLAUDE_PATH} className={SECONDARY}><Plug className="h-4 w-4" aria-hidden="true" />Connect Claude</Link>
            </div>
          )}
        </div>
        {data?.open && data.projects.length > 0 && (
          <p className="mt-3 max-w-[700px] text-[14.5px] leading-relaxed text-white/60">
            Your projects from the free Studio kit. Build and record in Roblox Studio; make the voice and finish the video here or from Claude.
            {data.freeFinish && <span className="font-bold text-lime-200"> Your first Finish my video is free.</span>}
          </p>
        )}
        {body}
      </div>
      {signIn && <AuthModal mode="login" title="Sign in to Zyvo" subtitle="See your Studio projects." returnTo={STUDIO_PROJECTS_PATH} onClose={() => setSignIn(false)} />}
      <NoCreditsModal open={Boolean(noCredits)} onClose={() => setNoCredits(null)} creditsNeeded={noCredits ?? 0} creditBalance={data?.balance ?? 0} />
    </div>
  );
}

function Empty({ title, text, action }) {
  return (
    <div className={`${CARD} mt-8 max-w-[560px] p-6`}>
      <p className="text-[18px] font-black text-white">{title}</p>
      <p className="mt-2 text-[14.5px] leading-relaxed text-white/65">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function FirstSteps() {
  const steps = [
    ["Get the free Studio kit", "A Claude skill that builds and films your story in Roblox Studio.", KIT_PATH, "Get the kit"],
    ["Connect Claude to Zyvo", "One address in Claude's connectors, or one command in Claude Code.", CONNECT_CLAUDE_PATH, "Connect Claude"],
    ["Build your story with Claude", "When the script is ready, Claude saves the project here. Make the voice, then finish the video.", null, null],
  ];
  return (
    <div className="mt-8">
      <p className="text-[18px] font-black text-white">No Studio projects yet</p>
      <ol className="mt-4 grid gap-3 md:grid-cols-3">
        {steps.map(([t, d, to, cta], i) => (
          <li key={t} className={`${CARD} flex flex-col p-5`}>
            <span className="grid h-7 w-7 place-items-center rounded-full bg-lime-300 text-[13px] font-black text-[#11150D]">{i + 1}</span>
            <p className="mt-3 text-[16px] font-black text-white">{t}</p>
            <p className="mt-1 flex-1 text-[14px] leading-relaxed text-white/60">{d}</p>
            {to && <Link to={to} className={`${SECONDARY} mt-4 self-start`}>{cta}</Link>}
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------- one project
function ProjectCard({ p, balance, onChanged, onNoCredits }) {
  const s = STATUS[p.status] ?? STATUS.voice_needed;
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
    <li id={`p-${p.id}`} className={`${CARD} scroll-mt-6 overflow-hidden`}>
      <div className="flex flex-col gap-3 border-b border-white/[0.07] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-balance text-[18px] font-black leading-snug text-white">{p.title}</h2>
          <p className="mt-1 text-[12.5px] text-white/50">{p.lines.length} lines · about {mmss(p.estimatedSeconds)}{p.shots ? ` · ${p.shots} shots` : ""} · updated {ago(p.updatedAt)}</p>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border px-2.5 py-1 text-[12px] font-black ${making ? "border-white/15 bg-white/[0.06] text-white" : s.tone}`}>
          {making ? <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />{job.kind === "voice" ? "Making the voice" : "Finishing"}</> : s.label}
        </span>
      </div>

      <div className="grid gap-5 px-5 py-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <Rail step={s.step} />
          <Script lines={p.lines} />
        </div>
        <div className="min-w-0">
          {failed && (
            <p className="mb-3 flex gap-2 rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2.5 text-[13.5px] text-red-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" aria-hidden="true" />
              <span>The last {job.kind === "voice" ? "voice" : "finish"} didn't work: {job.error}{job.refunded && job.credits ? ` ${job.credits} credits were given back.` : ""}</span>
            </p>
          )}
          {making ? <Making job={job} /> : (
            <>
              {p.status === "voice_needed" && <VoiceStep p={p} balance={balance} onChanged={onChanged} onNoCredits={onNoCredits} />}
              {p.status === "voice_ready" && <><VoicePlayer p={p} /><UploadStep p={p} onChanged={onChanged} /></>}
              {p.status === "recorded" && <><VoicePlayer p={p} compact /><FinishStep p={p} balance={balance} onChanged={onChanged} onNoCredits={onNoCredits} /></>}
              {p.status === "finished" && <Finished p={p} />}
            </>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-white/[0.07] px-5 py-2.5">
        <p className="truncate text-[12px] text-white/40">Kit project <span className="font-mono text-white/55">{p.kitProjectId}</span>{p.kitVersion ? ` · kit ${p.kitVersion}` : ""}</p>
        {!p.busy && (removing ? (
          <span className="flex shrink-0 items-center gap-2 text-[12.5px] text-white/70">Remove it?
            <button type="button" onClick={remove} className={`rounded-lg bg-red-500/20 px-2.5 py-1 font-bold text-red-100 hover:bg-red-500/30 ${FOCUS}`}>Remove</button>
            <button type="button" onClick={() => setRemoving(false)} className={`rounded-lg px-2 py-1 font-bold text-white/70 hover:text-white ${FOCUS}`}>Keep</button>
          </span>
        ) : (
          <button type="button" onClick={() => setRemoving(true)} className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-[12.5px] font-bold text-white/45 hover:text-white/80 ${FOCUS}`}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />Remove</button>
        ))}
      </div>
      {notice && <p className="px-5 pb-3 text-[13px] text-amber-200">{notice}</p>}
    </li>
  );
}

function Rail({ step }) {
  return (
    <ol className="mb-4 flex items-center gap-1.5" aria-label="Progress">
      {STEPS.map(([id, label], i) => {
        const done = i < step, now = i === step;
        return (
          <li key={id} className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className={`h-1.5 rounded-full ${done ? "bg-lime-300" : now ? "bg-lime-300/40" : "bg-white/10"}`} />
            <span className={`flex items-center gap-1 truncate text-[11.5px] font-bold ${done ? "text-lime-200" : now ? "text-white" : "text-white/40"}`}>
              {done && <Check className="h-3 w-3 shrink-0" aria-hidden="true" />}{label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Script({ lines }) {
  const [all, setAll] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = lines.map((l) => (l.speaker ? `${l.speaker}: ${l.text}` : l.text)).join("\n");
  const shown = all ? lines : lines.slice(0, 4);
  const copy = async () => { try { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1500); } catch { /* selectable */ } };
  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/25">
      <div className="flex items-center justify-between border-b border-white/[0.07] px-3 py-2">
        <p className="text-[11.5px] font-black uppercase tracking-[0.14em] text-white/45">Script</p>
        <button type="button" onClick={copy} className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[12.5px] font-bold text-white/70 hover:bg-white/10 hover:text-white ${FOCUS}`}>
          {copied ? <Check className="h-3.5 w-3.5 text-lime-300" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}{copied ? "Copied" : "Copy"}
        </button>
      </div>
      <ol className="space-y-1.5 px-3 py-3 text-[14px] leading-relaxed text-white/80">
        {shown.map((l, i) => (
          <li key={i}>{l.speaker && <span className="mr-1.5 font-black text-lime-200">{l.speaker}:</span>}{l.text}</li>
        ))}
      </ol>
      {lines.length > 4 && (
        <button type="button" onClick={() => setAll((v) => !v)} className={`flex w-full items-center justify-center gap-1 border-t border-white/[0.07] py-2 text-[12.5px] font-bold text-white/60 hover:text-white ${FOCUS}`}>
          {all ? "Show less" : `Show all ${lines.length} lines`}<ChevronDown className={`h-3.5 w-3.5 transition ${all ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function Making({ job }) {
  const label = job.kind === "voice"
    ? "Making the narrator's voice and its word timings. About a minute."
    : `Finishing your video: ${String(job.stage ?? "in line").replace(/_/g, " ")}. Usually 3-6 minutes.`;
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className="flex items-center gap-2 text-[14.5px] font-bold text-white"><Loader2 className="h-4 w-4 animate-spin text-lime-300" aria-hidden="true" />{job.status === "queued" ? "In line, starting soon" : "Working on it"}</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-lime-300 transition-all duration-700" style={{ width: `${Math.max(6, job.pct ?? 0)}%` }} /></div>
      <p className="mt-2.5 text-[13px] leading-relaxed text-white/60">{label} You can leave this page.</p>
    </div>
  );
}

/** a paid button: the price, then one "Yes" (the click that takes the credits); a changed price asks again */
function PaidAction({ icon, label, credits, free, balance, path, id, what, onChanged, onNoCredits }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const go = async () => {
    setBusy(true); setNotice(null);
    try { await connector(path, { method: "POST", body: { id, credits: free ? 0 : credits } }); setAsking(false); onChanged(); }
    catch (e) {
      if (e.code === "CREDITS") onNoCredits(credits);
      else { setNotice(e.message); if (e.code === "PRICE_CHANGED") onChanged(); }
    } finally { setBusy(false); }
  };
  const short = !free && balance < credits;
  const Icon = icon;
  return (
    <div>
      {!asking ? (
        <button type="button" className={`${PRIMARY} w-full sm:w-auto`} onClick={() => (short ? onNoCredits(credits) : setAsking(true))}>
          <Icon className="h-4 w-4" aria-hidden="true" />{label}
          <span className="ml-1 inline-flex items-center gap-1 rounded-md bg-black/15 px-1.5 py-0.5 text-[13px]">{free ? "Free" : <><CreditIcon className="h-3.5 w-3.5" />{credits}</>}</span>
        </button>
      ) : (
        <div className="rounded-xl border border-lime-300/30 bg-lime-300/[0.06] p-3.5">
          <p className="text-[14px] leading-relaxed text-white">
            {free ? <>{what} <b>Free</b> (your first finish).</> : <>{what} for <b>{credits} credits</b>. Balance {balance} → {balance - credits}.</>}
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" className={PRIMARY} disabled={busy} onClick={go}>{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}Yes, {label.toLowerCase()}</button>
            <button type="button" className={SECONDARY} disabled={busy} onClick={() => setAsking(false)}>Cancel</button>
          </div>
        </div>
      )}
      {notice && <p className="mt-2 text-[13px] text-amber-200" role="status">{notice}</p>}
    </div>
  );
}

function VoiceStep({ p, balance, onChanged, onNoCredits }) {
  return (
    <div>
      <p className="text-[15px] font-black text-white">Next: the voice</p>
      <p className="mb-3 mt-1 text-[13.5px] leading-relaxed text-white/60">Our narrator reads your script, with exact word timings, so the kit can time every shot to its word. Credits are taken only after your yes; a voice that fails gives them back.</p>
      <PaidAction icon={Mic} label="Create voice" credits={p.prices.voice} balance={balance} path="/account/studio/voice" id={p.id} what={`Create the voice for "${p.title}" (about ${mmss(p.estimatedSeconds)})`} onChanged={onChanged} onNoCredits={onNoCredits} />
      <p className="mt-3 text-[12.5px] text-white/45">Or use your own voice file in the kit: that stays free.</p>
    </div>
  );
}

function VoicePlayer({ p, compact = false }) {
  if (!p.voice) return null;
  return (
    <div className={compact ? "mb-4" : "mb-5"}>
      <p className="mb-2 flex items-center justify-between text-[13px] font-bold text-white/70"><span className="flex items-center gap-1.5"><Mic className="h-4 w-4 text-lime-300" aria-hidden="true" />Voice · {mmss(p.voice.seconds)}</span></p>
      <audio controls preload="none" src={p.voice.mp3} className="h-10 w-full" />
      {!compact && (
        <div className="mt-2 flex flex-wrap gap-2">
          <a href={withDownload(p.voice.mp3, "voice.mp3")} className={`${SECONDARY} min-h-9 py-1.5 text-[13px]`}><Download className="h-3.5 w-3.5" aria-hidden="true" />voice.mp3</a>
          <a href={withDownload(p.voice.words, "words.json")} className={`${SECONDARY} min-h-9 py-1.5 text-[13px]`}><Download className="h-3.5 w-3.5" aria-hidden="true" />words.json</a>
        </div>
      )}
    </div>
  );
}

function UploadStep({ p, onChanged }) {
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
      <p className="text-[15px] font-black text-white">Next: record the Play run</p>
      <p className="mb-3 mt-1 text-[13.5px] leading-relaxed text-white/60">The kit times every shot to this voice. Record the Play run, then drop the recording here (or let Claude upload it).</p>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); send(e.dataTransfer.files?.[0]); }}
        disabled={pct != null}
        className={`flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${over ? "border-lime-300 bg-lime-300/10" : "border-white/15 bg-white/[0.02] hover:border-white/30"} ${FOCUS}`}
      >
        {pct != null ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin text-lime-300" aria-hidden="true" />
            <span className="text-[14px] font-bold text-white">Uploading {Math.round(pct * 100)}%</span>
          </>
        ) : (
          <>
            <Upload className="h-5 w-5 text-lime-300" aria-hidden="true" />
            <span className="text-[14px] font-bold text-white">Drop the recording or choose a file</span>
            <span className="text-[12.5px] text-white/50">mp4, mov or webm · up to 500 MB · deleted after 7 days</span>
          </>
        )}
      </button>
      <input ref={input} type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" className="hidden" onChange={(e) => send(e.target.files?.[0])} />
      {notice && <p className="mt-2 text-[13px] text-amber-200" role="status">{notice}</p>}
    </div>
  );
}

function FinishStep({ p, balance, onChanged, onNoCredits }) {
  const mb = p.recording?.bytes ? `${Math.round(p.recording.bytes / 1e6)} MB` : "";
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[13px] font-bold text-white/70"><Film className="h-4 w-4 text-sky-300" aria-hidden="true" />Recording uploaded {p.recording?.uploadedAt ? ago(p.recording.uploadedAt) : ""}{mb ? ` · ${mb}` : ""}</p>
      <p className="mt-3 text-[15px] font-black text-white">Next: finish the video</p>
      <p className="mb-3 mt-1 text-[13.5px] leading-relaxed text-white/60">We turn it upright, fit it to the voice and add coloured captions, sound effects and music. You get the video and a copy without music.</p>
      <PaidAction icon={Clapperboard} label="Finish my video" credits={p.prices.finish} free={p.prices.finishFree} balance={balance} path="/account/studio/finish" id={p.id} what={`Finish "${p.title}"`} onChanged={onChanged} onNoCredits={onNoCredits} />
    </div>
  );
}

function Finished({ p }) {
  const f = p.final;
  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <video controls preload="none" poster={f.poster ?? undefined} src={f.video} className="aspect-[9/16] w-full max-w-[220px] self-center rounded-xl border border-white/10 bg-black object-cover sm:self-start" />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-black text-white">Your video is ready</p>
        <p className="mt-1 text-[13px] text-white/55">{mmss(f.seconds)} · made {f.madeAt ? ago(f.madeAt) : ""}</p>
        <div className="mt-3 flex flex-col gap-2">
          <a href={withDownload(f.download, `${p.kitProjectId}.mp4`)} className={PRIMARY}><Download className="h-4 w-4" aria-hidden="true" />Download</a>
          {f.noMusic && <a href={withDownload(f.noMusic, `${p.kitProjectId} (no music).mp4`)} className={SECONDARY}><Download className="h-4 w-4" aria-hidden="true" />Without music</a>}
        </div>
        {f.notes?.length > 0 && <ul className="mt-3 space-y-1 text-[12.5px] text-white/50">{f.notes.map((n) => <li key={n}>· {n}</li>)}</ul>}
      </div>
    </div>
  );
}
