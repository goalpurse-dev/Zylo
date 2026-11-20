import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Check, CheckCircle2, ChevronDown, Copy, ExternalLink, Info, Loader2, LogIn, Radio, Terminal, Trash2, XCircle } from "lucide-react";
import AuthModal from "../../components/AuthModal";
import { useAuth } from "../../context/AuthContext";
import { CONNECTOR_MOCK, connector } from "../../lib/zyvoConnector";
import { CLAUDE_CODE_COMMAND, CLAUDE_CODE_NAME, CONNECT_CLAUDE_PATH, MCP_URL, SCOPE_TEXT } from "../../data/studioKit";
import { DISPLAY, FOCUS, MCP_CARD, MCP_H2, MCP_PRIMARY, MCP_SECONDARY } from "../../components/studio-kit/studioKitShared";
import "../../components/studio-kit/studioKit.css";

const CLAUDE_CONNECTORS = "https://claude.ai/settings/connectors";
const when = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "never");
const minutesAgo = (iso) => (iso ? Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000)) : null);
const agoText = (m) => (m == null ? "not yet" : m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 60 * 24 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / (60 * 24))} days ago`);
/** the connection Claude used last (or, never used, the newest) */
const newestOf = (list) => [...list].sort((a, b) => Date.parse(b.lastUsed ?? b.since ?? 0) - Date.parse(a.lastUsed ?? a.since ?? 0))[0] ?? null;

/**
 * MCP > Connect (/workspace/mcp/connect; /connect-claude redirects here): ONLY how to connect Zyvo to Claude (owner
 * 2026-11-20). Connected (the account has a Claude connection, /account/connections): "You're connected to Claude",
 * the date, Test my connection, and the steps folded under "Set up again" (item 16). Not connected: the steps.
 * One connector for both (item 17): the Claude app's connector also shows up inside Claude Code as "claude.ai Zyvo",
 * so the terminal command is only the other way, never both. Then the user's connections with a Sign out each.
 */
export default function ConnectClaude() {
  const { user } = useAuth() ?? {};
  const location = useLocation();
  const justConnected = new URLSearchParams(location.search).get("connected") === "1";
  const [signIn, setSignIn] = useState(false);
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  const [test, setTest] = useState(null); // null | "busy" | { kind, c, m, at }
  const signedIn = CONNECTOR_MOCK || Boolean(user);
  useEffect(() => { document.title = "Connect Claude | MCP | Zyvo"; }, []);

  const load = useCallback(async () => {
    setError(null);
    try { const r = await connector("/account/connections"); setList(r.connections ?? []); return r.connections ?? []; }
    catch (e) { setError(e.message); return null; }
  }, []);
  useEffect(() => { if (signedIn) load(); }, [signedIn, load]);

  /**
   * "Test my connection": reads the account's connections again (the same account API, free, no tool call). A
   * connection Claude used in the last 15 minutes = working; connected but not used lately = ask Claude one free thing,
   * then test again; none = not connected (any more).
   */
  const runTest = async () => {
    if (!signedIn) { setSignIn(true); return; }
    setTest("busy");
    const fresh = await load();
    if (!fresh) { setTest({ kind: "error", at: Date.now() }); return; }
    const c = newestOf(fresh);
    const m = minutesAgo(c?.lastUsed);
    setTest({ kind: !c ? "none" : m != null && m <= 15 ? "working" : "idle", c, m, at: Date.now() });
  };

  const view = !signedIn ? "setup" : list === null && !error ? "loading" : list?.length ? "connected" : "setup";
  const active = view === "connected" ? newestOf(list) : null;

  return (
    <div className="mt-6">
      {view === "loading" && <div className="grid place-items-center py-14"><Loader2 className="h-5 w-5 animate-spin text-lime-300" aria-label="Loading" /></div>}

      {view === "connected" && (
        <>
          <section className="sk-fadeup rounded-xl border border-lime-300/30 bg-gradient-to-br from-lime-300/[0.08] to-transparent p-4 sm:p-5" aria-labelledby="cc-ok" data-testid="connected-card">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-lime-300 text-[#11150D]"><Check className="h-5 w-5" strokeWidth={3} aria-hidden="true" /></span>
                <div className="min-w-0">
                  <h2 id="cc-ok" className="text-[17px] font-black leading-tight text-white">You're connected to Claude</h2>
                  <p className="mt-0.5 text-[13px] text-white/65">{active.client} · connected {when(active.since)}{list.length > 1 ? ` · ${list.length} connections` : ""}</p>
                </div>
              </div>
              <TestButton test={test} onTest={runTest} className="w-full sm:w-auto" />
            </div>
            {test && test !== "busy" && <TestResult r={test} />}
            {justConnected && !test && <p className="mt-3 text-[13px] text-lime-100/85">Go back to Claude and ask it for story ideas.</p>}
          </section>
          <details className="group mt-4 rounded-xl border border-white/10 bg-white/[0.02]" data-testid="setup-again">
            <summary className={`flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 text-[14px] font-bold text-white/80 hover:text-white ${FOCUS}`}>
              Set up again<ChevronDown className="h-4 w-4 transition group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="px-4 pb-5"><Setup /></div>
          </details>
        </>
      )}

      {view === "setup" && (
        <>
          {justConnected && (
            <p role="status" className="sk-fadeup mb-4 flex items-center gap-2 rounded-xl border border-lime-300/30 bg-lime-300/10 px-3.5 py-2.5 text-[13.5px] font-bold text-lime-100">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-lime-300" aria-hidden="true" />Connected. Go back to Claude and ask it for story ideas.
            </p>
          )}
          <h2 style={DISPLAY} className={MCP_H2}>Connect Zyvo to Claude</h2>
          <p className="mt-1.5 text-[14px] text-white/65">Three steps, once. Claude shows every price first.</p>
          <div className="mt-4"><Setup /></div>
          <section className="mt-5 flex flex-col gap-3 rounded-xl border border-lime-300/25 bg-gradient-to-br from-lime-300/[0.06] to-transparent p-4 sm:flex-row sm:items-center sm:justify-between" aria-labelledby="cc-test">
            <p id="cc-test" className="text-[14.5px] font-bold text-white">Done? Check it worked.</p>
            <TestButton test={test} onTest={runTest} className="w-full sm:w-auto" />
          </section>
          {test && test !== "busy" && <TestResult r={test} />}
        </>
      )}

      <section className="mt-8" aria-labelledby="cc-connections">
        <h2 id="cc-connections" className="text-[16px] font-black text-white">Your connections</h2>
        {signedIn ? <Connections list={list} error={error} reload={load} onRemoved={(id) => { setList((l) => l.filter((c) => c.id !== id)); setTest(null); }} onError={setError} /> : (
          <div className={`${MCP_CARD} mt-3 flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between`}>
            <p className="text-[13.5px] text-white/70">Sign in to see which Claude apps are connected to your account.</p>
            <button type="button" className={MCP_SECONDARY} onClick={() => setSignIn(true)}>Sign in</button>
          </div>
        )}
      </section>
      {signIn && <AuthModal mode="login" title="Sign in to Zyvo" subtitle="See and manage your Claude connections." returnTo={CONNECT_CLAUDE_PATH} onClose={() => setSignIn(false)} />}
    </div>
  );
}

function TestButton({ test, onTest, className = "" }) {
  return (
    <button type="button" onClick={onTest} disabled={test === "busy"} className={`${MCP_PRIMARY} ${className}`} data-testid="test-connection">
      {test === "busy" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Radio className="h-4 w-4" aria-hidden="true" />}Test my connection
    </button>
  );
}

function TestResult({ r }) {
  const ok = r.kind === "working";
  const at = new Date(r.at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return (
    <div role="status" className={`sk-fadeup mt-3 flex gap-2.5 rounded-lg border px-3.5 py-2.5 text-[13.5px] leading-relaxed ${ok ? "border-lime-300/40 bg-lime-300/10 text-lime-50" : "border-white/15 bg-black/30 text-white/85"}`} data-testid="test-result">
      {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-lime-300" aria-hidden="true" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />}
      <span>
        {r.kind === "working" && <><b>Working.</b> {r.c.client} last used Zyvo {agoText(r.m)}.</>}
        {r.kind === "idle" && <><b>Connected</b>, but {r.c.client} last used Zyvo {r.m == null ? "never" : agoText(r.m)}. To check it end to end, ask Claude: <i>"Give me 3 In This Town ideas with Zyvo"</i> (free), then test again. If Claude says Zyvo needs you to sign in, use Set up again.</>}
        {r.kind === "none" && <><b>Not connected.</b> No Claude app is connected to this account. Do the 3 steps, press Allow on Zyvo's page, then test again.</>}
        {r.kind === "error" && <><b>We couldn't check right now.</b> Try again in a moment.</>}
        <span className="ml-1 text-white/40">Checked {at}.</span>
      </span>
    </div>
  );
}

/** the setup: one connector for both apps, the two ways as tabs, three steps each */
function Setup() {
  const location = useLocation();
  const [tab, setTab] = useState(() => (new URLSearchParams(location.search).get("tab") === "code" ? "code" : "claude"));
  const steps = tab === "claude"
    ? [
      { title: "Copy the link", text: "Zyvo's connector address.", action: <CopyBig value={MCP_URL} label="Copy link" /> },
      { title: "Open Claude's settings", text: "In the Claude desktop or web app: Settings > Connectors > Add custom connector. Name it Zyvo and paste the link.", action: <a href={CLAUDE_CONNECTORS} target="_blank" rel="noreferrer" className={`${MCP_PRIMARY} w-full`}><ExternalLink className="h-4 w-4" aria-hidden="true" />Open Claude's settings</a> },
      { title: "Sign in + Allow", text: `Claude opens Zyvo. Sign in and press Allow. Zyvo is then in Claude Code too, as "${CLAUDE_CODE_NAME}".`, action: <StepBadge icon={LogIn} text="Then test it" /> },
    ]
    : [
      { title: "Copy the command", text: "Run it once in a terminal.", action: <CopyBig value={CLAUDE_CODE_COMMAND} label="Copy command" /> },
      { title: "Type /mcp", text: "In Claude Code, pick zyvo, then Authenticate.", action: <CopyBig value="/mcp" label="Copy /mcp" small /> },
      { title: "Sign in + Allow", text: "Zyvo opens in your browser. Sign in and press Allow.", action: <StepBadge icon={LogIn} text="Then test it" /> },
    ];
  return (
    <div>
      <OneConnector />
      <div className="mt-4 grid max-w-[400px] grid-cols-2 rounded-xl border border-white/10 bg-white/[0.04] p-1" role="tablist" aria-label="Which way">
        {[["claude", "Claude app"], ["code", "Terminal command"]].map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-2 text-[13.5px] font-bold transition ${tab === id ? "bg-lime-300 font-black text-[#11150D]" : "text-white/70 hover:text-white"} ${FOCUS}`}>
            {id === "code" && <Terminal className="h-3.5 w-3.5" aria-hidden="true" />}<span className="whitespace-nowrap">{label}</span>
            {id === "claude" && <span className={`rounded px-1 py-px text-[10px] font-black uppercase tracking-wide ${tab === id ? "bg-black/15" : "bg-lime-300/15 text-lime-200"}`}>Most people</span>}
          </button>
        ))}
      </div>
      {tab === "code" && (
        <p className="mt-3 flex gap-2 rounded-lg border border-amber-300/25 bg-amber-300/[0.07] px-3 py-2 text-[13px] leading-relaxed text-amber-50/90">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
          <span>Only if you don't use the Claude app way. Added Zyvo in the Claude app already? Skip this: it's in Claude Code as "{CLAUDE_CODE_NAME}". Don't add both.</span>
        </p>
      )}

      <div className="relative mt-5">
        {/* the line behind the numbers, with a green pulse travelling from step to step */}
        <span className="sk-line pointer-events-none absolute left-[16.6%] right-[16.6%] top-[17px] hidden h-0.5 rounded-full bg-lime-300/20 md:block" aria-hidden="true"><span className="sk-pulse" /></span>
        <ol key={tab} className="relative grid gap-3 md:grid-cols-3" aria-label="Three steps">
          {steps.map((s, i) => (
            <li key={s.title} className="sk-fadeup relative flex flex-col items-center text-center" style={{ animationDelay: `${i * 110}ms` }}>
              <span className="relative z-10 grid h-9 w-9 place-items-center rounded-full border-[3px] border-[#0B0D0F] bg-lime-300 text-[15px] font-black text-[#11150D]">{i + 1}</span>
              <div className={`${MCP_CARD} mt-2 flex w-full flex-1 flex-col p-4`}>
                <p className="text-[15px] font-black text-white">{s.title}</p>
                <p className="mt-1 flex-1 text-[13.5px] leading-relaxed text-white/65">{s.text}</p>
                <div className="mt-3">{s.action}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
      {tab === "code" && <p className="mt-2 break-all text-center font-mono text-[11.5px] text-white/45">{CLAUDE_CODE_COMMAND}</p>}
    </div>
  );
}

/** no hidden steps (item 17): the Claude app's connector also works in Claude Code; never add both */
function OneConnector() {
  return (
    <div className="flex gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3 text-[13.5px] leading-relaxed text-white/75" data-testid="one-connector">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-lime-300" aria-hidden="true" />
      <p><b className="text-white">One connector works in both.</b> Add Zyvo in the Claude app and it also shows up inside Claude Code, as "{CLAUDE_CODE_NAME}". So most people only need the Claude app way. The terminal command is the other way. Don't add both.</p>
    </div>
  );
}

/** a one-click copy: "Copied!" pops for a moment */
function CopyBig({ value, label, small = false }) {
  const [n, setN] = useState(0);
  const copy = async () => { try { await navigator.clipboard.writeText(value); } catch { /* the value is shown */ } setN((x) => x + 1); window.setTimeout(() => setN(0), 1800); };
  return (
    <div>
      <button type="button" key={n} onClick={copy} className={`${MCP_PRIMARY} w-full ${n ? "sk-copied" : ""}`}>
        {n ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}{n ? "Copied!" : label}
      </button>
      {!small && <p className="mt-1.5 truncate font-mono text-[11.5px] text-white/45" title={value}>{value}</p>}
    </div>
  );
}

function StepBadge({ icon, text }) {
  const Icon = icon;
  return <p className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-dashed border-lime-300/30 px-3 text-[13px] font-bold text-lime-100/85"><Icon className="h-4 w-4 text-lime-300" aria-hidden="true" />{text}</p>;
}

function Connections({ list, error, reload, onRemoved, onError }) {
  const [busy, setBusy] = useState(null);
  const signOut = async (id) => {
    setBusy(id);
    try { await connector("/account/connections/revoke", { method: "POST", body: { id } }); onRemoved(id); }
    catch (e) { onError(e.message); }
    finally { setBusy(null); }
  };
  if (error && !list) return <p className={`${MCP_CARD} mt-3 p-4 text-[13.5px] text-white/70`}>{error} <button type="button" onClick={reload} className="font-bold text-lime-200 underline underline-offset-4">Try again</button></p>;
  if (!list) return <div className="grid place-items-center py-6"><Loader2 className="h-5 w-5 animate-spin text-lime-300" aria-label="Loading" /></div>;
  if (!list.length) return <p className={`${MCP_CARD} mt-3 p-4 text-[13.5px] text-white/65`}>No Claude app is connected yet. Follow the steps above.</p>;
  return (
    <ul className="mt-3 space-y-2">
      {list.map((c) => (
        <li key={c.id} className={`${MCP_CARD} flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between`}>
          <div className="min-w-0">
            <p className="text-[14.5px] font-bold text-white">{c.client}</p>
            <p className="mt-0.5 text-[12.5px] text-white/55">Connected {when(c.since)} · last used {when(c.lastUsed)}</p>
            <p className="mt-1.5 flex flex-wrap gap-1.5">
              {(c.scopes ?? []).map((s) => <span key={s} className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${s === "spend" ? "bg-amber-300/15 text-amber-200" : "bg-white/[0.07] text-white/70"}`} title={SCOPE_TEXT[s]}>{s === "spend" ? "can spend credits" : s}</span>)}
            </p>
          </div>
          <button type="button" className={MCP_SECONDARY} disabled={busy === c.id} onClick={() => signOut(c.id)}>
            {busy === c.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}Sign out
          </button>
        </li>
      ))}
    </ul>
  );
}
