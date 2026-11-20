import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Check, CheckCircle2, Copy, ExternalLink, Loader2, LogIn, ShieldCheck, Terminal, Trash2 } from "lucide-react";
import AuthModal from "../../components/AuthModal";
import { useAuth } from "../../context/AuthContext";
import { CONNECTOR_MOCK, connector } from "../../lib/zyvoConnector";
import { CLAUDE_CODE_COMMAND, CONNECT_CLAUDE_PATH, CONNECTOR_TOOLS, MCP_URL, SCOPE_TEXT, STUDIO_PROJECTS_PATH } from "../../data/studioKit";
import { MockBanner } from "../../components/studio-kit/StudioKitUI";
import { CARD, DISPLAY, FOCUS, PRIMARY, SECONDARY, useDisplayFont, useStudioOpen } from "../../components/studio-kit/studioKitShared";
import "../../components/studio-kit/studioKit.css";

const KIT_PATH = "/in-this-town-story-video-maker#studio";
const CLAUDE_CONNECTORS = "https://claude.ai/settings/connectors";
const when = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "never");

/**
 * /connect-claude: connect Claude to Zyvo in three steps (tabs: Claude on the web / desktop, Claude Code), what the
 * connector can do (Free / credit badges), and the user's connections with a Sign out each (/account/connections).
 * It is also the connector's documentation link (URLS.connect in _shared/zyvoMcp/config.js).
 */
export default function ConnectClaude() {
  useDisplayFont();
  const open = useStudioOpen();
  const { user } = useAuth() ?? {};
  const location = useLocation();
  const connected = new URLSearchParams(location.search).get("connected") === "1";
  const [tab, setTab] = useState(() => (new URLSearchParams(location.search).get("tab") === "code" ? "code" : "claude"));
  const [signIn, setSignIn] = useState(false);
  useEffect(() => { document.title = "Connect Claude to Zyvo"; }, []);

  const steps = tab === "claude"
    ? [
      { title: "Copy the link", text: "Zyvo's connector address.", action: <CopyBig value={MCP_URL} label="Copy link" /> },
      { title: "Open Claude's connectors", text: "Add custom connector, name it Zyvo, paste.", action: <a href={CLAUDE_CONNECTORS} target="_blank" rel="noreferrer" className={`${PRIMARY} w-full`}><ExternalLink className="h-4 w-4" aria-hidden="true" />Open Claude settings</a> },
      { title: "Sign in + Allow", text: "Claude opens Zyvo. Sign in and press Allow.", action: <StepBadge icon={LogIn} text="Then ask Claude for story ideas" /> },
    ]
    : [
      { title: "Copy the command", text: "Run it once in a terminal.", action: <CopyBig value={CLAUDE_CODE_COMMAND} label="Copy command" /> },
      { title: "Type /mcp", text: "In Claude Code, pick zyvo, then Authenticate.", action: <CopyBig value="/mcp" label="Copy /mcp" small /> },
      { title: "Sign in + Allow", text: "Zyvo opens in your browser. Sign in and press Allow.", action: <StepBadge icon={LogIn} text="Then try /mcp__zyvo__in-this-town" /> },
    ];

  return (
    <div className="min-h-full w-full bg-[#0B0D0F] pb-16">
      <MockBanner />
      <div className="mx-auto w-full max-w-[1040px] px-4 pt-8 sm:px-6 sm:pt-12">
        {connected && (
          <p role="status" className="sk-fadeup mb-6 flex items-center gap-2 rounded-xl border border-lime-300/30 bg-lime-300/10 px-4 py-3 text-[14.5px] font-bold text-lime-100">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-lime-300" aria-hidden="true" />Connected. Go back to Claude and ask it for story ideas.
          </p>
        )}
        <div className="text-center">
          <p className="text-[13px] font-black uppercase tracking-[0.16em] text-lime-300">Zyvo connector</p>
          <h1 style={DISPLAY} className="mt-2 text-balance text-[42px] font-extrabold uppercase leading-[0.95] text-white sm:text-[60px]">Connect Claude to Zyvo</h1>
          <p className="mx-auto mt-3 max-w-[600px] text-[16px] leading-7 text-white/70">Ideas, our writer, the narrator voice and Finish my video, right inside Claude. Claude shows every price first.</p>
        </div>

        {open === "closed" ? (
          <ClosedNote signedIn={Boolean(user)} onSignIn={() => setSignIn(true)} />
        ) : open === "loading" ? (
          <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-lime-300" aria-label="Loading" /></div>
        ) : (
          <>
            <div className="mx-auto mt-8 grid max-w-[460px] grid-cols-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1.5" role="tablist" aria-label="Which Claude">
              {[["claude", "Claude (web / desktop)"], ["code", "Claude Code"]].map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                  className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-[14.5px] font-black transition ${tab === id ? "bg-lime-300 text-[#11150D]" : "text-white/65 hover:text-white"} ${FOCUS}`}>
                  {id === "code" && <Terminal className="h-4 w-4" aria-hidden="true" />}
                  {/* phone (owner 2026-11-20): the short label, so the tab fits on one line */}
                  {id === "claude" ? <><span className="whitespace-nowrap sm:hidden">Claude app</span><span className="hidden whitespace-nowrap sm:inline">{label}</span></> : <span className="whitespace-nowrap">{label}</span>}
                </button>
              ))}
            </div>

            <div className="relative mt-8">
            {/* the line behind the numbers, with a green pulse travelling from step to step */}
            <span className="sk-line pointer-events-none absolute left-[16.6%] right-[16.6%] top-[26px] hidden h-1 rounded-full bg-lime-300/20 md:block" aria-hidden="true"><span className="sk-pulse" /></span>
            <ol key={tab} className="relative grid gap-4 md:grid-cols-3" aria-label="Three steps">
              {steps.map((s, i) => (
                <li key={s.title} className="sk-fadeup relative flex flex-col items-center text-center" style={{ animationDelay: `${i * 110}ms` }}>
                  <span className="relative z-10 grid h-14 w-14 place-items-center rounded-full border-4 border-[#0B0D0F] bg-lime-300 text-[24px] font-black text-[#11150D] shadow-[0_0_30px_-4px_rgba(190,242,100,0.6)]">{i + 1}</span>
                  <div className={`${CARD} mt-3 flex w-full flex-1 flex-col p-5`}>
                    <p className="text-[18px] font-black text-white">{s.title}</p>
                    <p className="mt-1 flex-1 text-[14px] leading-relaxed text-white/60">{s.text}</p>
                    <div className="mt-4">{s.action}</div>
                  </div>
                </li>
              ))}
            </ol>
            </div>
            {tab === "code" && <p className="mt-3 break-all text-center font-mono text-[12px] text-white/40">{CLAUDE_CODE_COMMAND}</p>}

            <section className="mt-12" aria-labelledby="cc-tools">
              <h2 id="cc-tools" style={DISPLAY} className="text-[30px] font-extrabold uppercase leading-none text-white">What it can do</h2>
              <ul className={`${CARD} mt-4 divide-y divide-white/[0.07] overflow-hidden`}>
                {CONNECTOR_TOOLS.map((t) => (
                  <li key={t.name} className="flex items-center justify-between gap-4 px-4 py-3.5">
                    <div className="min-w-0">
                      <p className="text-[15px] font-black text-white">{t.name}</p>
                      <p className="text-[13.5px] text-white/55">{t.what}</p>
                    </div>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className={`rounded-full px-2.5 py-1 text-[12px] font-black ${t.price === "Free" ? "bg-lime-300 text-[#11150D]" : "border border-white/15 bg-white/[0.06] text-white"}`}>{t.price}</span>
                      {t.note && <span className="text-[11px] font-black uppercase tracking-wide text-lime-200">{t.note}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 flex gap-2 text-[13.5px] leading-relaxed text-white/55">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-lime-300" aria-hidden="true" />
                Nothing is charged until you say yes to the price in Claude. A voice, finish or video that fails gives every credit back.
              </p>
            </section>

            <section className="mt-12" aria-labelledby="cc-connections">
              <h2 id="cc-connections" style={DISPLAY} className="text-[30px] font-extrabold uppercase leading-none text-white">Your connections</h2>
              {CONNECTOR_MOCK || user ? <Connections /> : (
                <div className={`${CARD} mt-4 flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between`}>
                  <p className="text-[14.5px] text-white/70">Sign in to see which Claude apps are connected to your account.</p>
                  <button type="button" className={SECONDARY} onClick={() => setSignIn(true)}>Sign in</button>
                </div>
              )}
            </section>

            <section className="mt-10 grid gap-3 sm:grid-cols-2">
              <Link to={STUDIO_PROJECTS_PATH} className={`${CARD} group flex items-center justify-between gap-4 p-5 transition hover:border-lime-300/50`}>
                <span><span className="block text-[16px] font-black text-white group-hover:text-lime-200">Studio projects</span><span className="text-[13.5px] text-white/60">Your projects from Claude: voice, recording, finished video</span></span>
                <ArrowRight className="h-5 w-5 shrink-0 text-lime-300" aria-hidden="true" />
              </Link>
              <Link to={KIT_PATH} className={`${CARD} group flex items-center justify-between gap-4 p-5 transition hover:border-lime-300/50`}>
                <span><span className="block text-[16px] font-black text-white group-hover:text-lime-200">Get the free Studio kit</span><span className="text-[13.5px] text-white/60">Make In This Town videos yourself in Roblox Studio</span></span>
                <ArrowRight className="h-5 w-5 shrink-0 text-lime-300" aria-hidden="true" />
              </Link>
            </section>
          </>
        )}
      </div>
      {signIn && <AuthModal mode="login" title="Sign in to Zyvo" subtitle="See and manage your Claude connections." returnTo={CONNECT_CLAUDE_PATH} onClose={() => setSignIn(false)} />}
    </div>
  );
}

/** one big one-click copy: "Copied!" pops for a moment */
function CopyBig({ value, label, small = false }) {
  const [n, setN] = useState(0);
  const copy = async () => { try { await navigator.clipboard.writeText(value); } catch { /* the value is shown */ } setN((x) => x + 1); window.setTimeout(() => setN(0), 1800); };
  return (
    <div>
      <button type="button" key={n} onClick={copy} className={`${PRIMARY} w-full ${small ? "" : "min-h-12 text-[16px]"} ${n ? "sk-copied" : ""}`}>
        {n ? <Check className="h-5 w-5" aria-hidden="true" /> : <Copy className="h-5 w-5" aria-hidden="true" />}{n ? "Copied!" : label}
      </button>
      {!small && <p className="mt-2 truncate font-mono text-[12px] text-white/45" title={value}>{value}</p>}
    </div>
  );
}

function StepBadge({ icon, text }) {
  const Icon = icon;
  return <p className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-dashed border-lime-300/30 px-3 text-[13px] font-bold text-lime-100/85"><Icon className="h-4 w-4 text-lime-300" aria-hidden="true" />{text}</p>;
}

function Connections() {
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const load = useCallback(() => {
    setError(null);
    connector("/account/connections").then((r) => setList(r.connections ?? [])).catch((e) => setError(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);
  const signOut = async (id) => {
    setBusy(id);
    try { await connector("/account/connections/revoke", { method: "POST", body: { id } }); setList((l) => l.filter((c) => c.id !== id)); }
    catch (e) { setError(e.message); }
    finally { setBusy(null); }
  };
  if (error) return <p className={`${CARD} mt-4 p-5 text-[14.5px] text-white/70`}>{error} <button type="button" onClick={load} className="font-bold text-lime-200 underline underline-offset-4">Try again</button></p>;
  if (!list) return <div className="grid place-items-center py-8"><Loader2 className="h-5 w-5 animate-spin text-lime-300" aria-label="Loading" /></div>;
  if (!list.length) return <p className={`${CARD} mt-4 p-5 text-[14.5px] text-white/65`}>No Claude app is connected yet. Follow the steps above.</p>;
  return (
    <ul className="mt-4 space-y-2.5">
      {list.map((c) => (
        <li key={c.id} className={`${CARD} flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between`}>
          <div className="min-w-0">
            <p className="text-[15.5px] font-black text-white">{c.client}</p>
            <p className="mt-0.5 text-[13px] text-white/55">Connected {when(c.since)} · last used {when(c.lastUsed)}</p>
            <p className="mt-1.5 flex flex-wrap gap-1.5">
              {(c.scopes ?? []).map((s) => <span key={s} className={`rounded-md px-1.5 py-0.5 text-[11.5px] font-bold ${s === "spend" ? "bg-amber-300/15 text-amber-200" : "bg-white/[0.07] text-white/70"}`} title={SCOPE_TEXT[s]}>{s === "spend" ? "can spend credits" : s}</span>)}
            </p>
          </div>
          <button type="button" className={SECONDARY} disabled={busy === c.id} onClick={() => signOut(c.id)}>
            {busy === c.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}Sign out
          </button>
        </li>
      ))}
    </ul>
  );
}

function ClosedNote({ signedIn, onSignIn }) {
  return (
    <div className={`${CARD} mx-auto mt-8 max-w-[560px] p-6`}>
      <p className="text-[17px] font-black text-white">Coming soon</p>
      <p className="mt-2 text-[14.5px] leading-relaxed text-white/65">The Zyvo connector is being tested before launch.{signedIn ? " It isn't open for this account yet." : " Signed up already? Sign in to check."}</p>
      {!signedIn && <button type="button" className={`${SECONDARY} mt-4`} onClick={onSignIn}>Sign in</button>}
    </div>
  );
}
