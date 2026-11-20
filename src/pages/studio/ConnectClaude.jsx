import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Check, CheckCircle2, Copy, ExternalLink, Loader2, LogIn, Radio, Terminal, Trash2, XCircle } from "lucide-react";
import AuthModal from "../../components/AuthModal";
import { useAuth } from "../../context/AuthContext";
import { CONNECTOR_MOCK, connector } from "../../lib/zyvoConnector";
import { CLAUDE_CODE_COMMAND, CONNECT_CLAUDE_PATH, MCP_URL, SCOPE_TEXT } from "../../data/studioKit";
import { CARD, DISPLAY, FOCUS, PRIMARY, SECONDARY } from "../../components/studio-kit/studioKitShared";
import "../../components/studio-kit/studioKit.css";

const CLAUDE_CONNECTORS = "https://claude.ai/settings/connectors";
const when = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "never");
const minutesAgo = (iso) => (iso ? Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000)) : null);
const agoText = (m) => (m == null ? "not yet" : m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 60 * 24 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / (60 * 24))} days ago`);

/**
 * MCP > Connect (/workspace/mcp/connect; /connect-claude redirects here): ONLY how to connect Zyvo to Claude (owner
 * 2026-11-20). Tabs Claude app / Claude Code, the three steps, Test my connection, and the user's connections with a
 * Sign out each (/account/connections). Also the connector's documentation link (URLS.connect in zyvoMcp/config.js).
 */
export default function ConnectClaude() {
  const { user } = useAuth() ?? {};
  const location = useLocation();
  const connected = new URLSearchParams(location.search).get("connected") === "1";
  const [tab, setTab] = useState(() => (new URLSearchParams(location.search).get("tab") === "code" ? "code" : "claude"));
  const [signIn, setSignIn] = useState(false);
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  const signedIn = CONNECTOR_MOCK || Boolean(user);
  useEffect(() => { document.title = "Connect Claude | MCP | Zyvo"; }, []);

  const load = useCallback(async () => {
    setError(null);
    try { const r = await connector("/account/connections"); setList(r.connections ?? []); return r.connections ?? []; }
    catch (e) { setError(e.message); return null; }
  }, []);
  useEffect(() => { if (signedIn) load(); }, [signedIn, load]);

  const steps = tab === "claude"
    ? [
      { title: "Copy the link", text: "Zyvo's connector address.", action: <CopyBig value={MCP_URL} label="Copy link" /> },
      { title: "Open Claude's settings", text: "Connectors > Add custom connector. Name it Zyvo and paste the link.", action: <a href={CLAUDE_CONNECTORS} target="_blank" rel="noreferrer" className={`${PRIMARY} min-h-12 w-full text-[16px]`}><ExternalLink className="h-5 w-5" aria-hidden="true" />Open Claude's settings</a> },
      { title: "Sign in + Allow", text: "Claude opens Zyvo. Sign in and press Allow.", action: <StepBadge icon={LogIn} text="Then test it below" /> },
    ]
    : [
      { title: "Copy the command", text: "Run it once in a terminal.", action: <CopyBig value={CLAUDE_CODE_COMMAND} label="Copy command" /> },
      { title: "Type /mcp", text: "In Claude Code, pick zyvo, then Authenticate.", action: <CopyBig value="/mcp" label="Copy /mcp" small /> },
      { title: "Sign in + Allow", text: "Zyvo opens in your browser. Sign in and press Allow.", action: <StepBadge icon={LogIn} text="Then test it below" /> },
    ];

  return (
    <div className="mt-8">
      {connected && (
        <p role="status" className="sk-fadeup mb-6 flex items-center gap-2 rounded-xl border border-lime-300/30 bg-lime-300/10 px-4 py-3 text-[14.5px] font-bold text-lime-100">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-lime-300" aria-hidden="true" />Connected. Go back to Claude and ask it for story ideas.
        </p>
      )}
      <div className="text-center">
        <h2 style={DISPLAY} className="text-balance text-[34px] font-extrabold uppercase leading-[0.95] text-white sm:text-[46px]">Connect Zyvo to Claude</h2>
        <p className="mx-auto mt-2 max-w-[600px] text-[15.5px] leading-7 text-white/70">Three steps, once. Claude shows every price first.</p>
      </div>

      <div className="mx-auto mt-6 grid max-w-[460px] grid-cols-2 rounded-2xl border border-white/10 bg-white/[0.04] p-1.5" role="tablist" aria-label="Which Claude">
        {[["claude", "Claude app"], ["code", "Claude Code"]].map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`flex min-h-12 items-center justify-center gap-1.5 rounded-xl px-3 text-[15px] font-black transition ${tab === id ? "bg-lime-300 text-[#11150D]" : "text-white/70 hover:text-white"} ${FOCUS}`}>
            {id === "code" && <Terminal className="h-4 w-4" aria-hidden="true" />}<span className="whitespace-nowrap">{label}</span>
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
                <p className="mt-1 flex-1 text-[14.5px] leading-relaxed text-white/65">{s.text}</p>
                <div className="mt-4">{s.action}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
      {tab === "code" && <p className="mt-3 break-all text-center font-mono text-[12px] text-white/45">{CLAUDE_CODE_COMMAND}</p>}

      <TestConnection signedIn={signedIn} onSignIn={() => setSignIn(true)} reload={load} />

      <section className="mt-12" aria-labelledby="cc-connections">
        <h2 id="cc-connections" style={DISPLAY} className="text-[30px] font-extrabold uppercase leading-none text-white">Your connections</h2>
        {signedIn ? <Connections list={list} error={error} reload={load} onRemoved={(id) => setList((l) => l.filter((c) => c.id !== id))} onError={setError} /> : (
          <div className={`${CARD} mt-4 flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between`}>
            <p className="text-[14.5px] text-white/70">Sign in to see which Claude apps are connected to your account.</p>
            <button type="button" className={SECONDARY} onClick={() => setSignIn(true)}>Sign in</button>
          </div>
        )}
      </section>
      {signIn && <AuthModal mode="login" title="Sign in to Zyvo" subtitle="See and manage your Claude connections." returnTo={CONNECT_CLAUDE_PATH} onClose={() => setSignIn(false)} />}
    </div>
  );
}

/**
 * "Test my connection": reads the account's connections again. A connection Claude used in the last 15 minutes =
 * working; connected but not used = ask Claude one free thing, then test again; none = do the steps. Free, no tool call.
 */
function TestConnection({ signedIn, onSignIn, reload }) {
  const [state, setState] = useState(null); // null | "busy" | { kind, c }
  const test = async () => {
    if (!signedIn) { onSignIn(); return; }
    setState("busy");
    const list = await reload();
    if (!list) { setState({ kind: "error" }); return; }
    const newest = [...list].sort((a, b) => Date.parse(b.lastUsed ?? b.since ?? 0) - Date.parse(a.lastUsed ?? a.since ?? 0))[0];
    const m = minutesAgo(newest?.lastUsed);
    setState({ kind: !newest ? "none" : m != null && m <= 15 ? "working" : "idle", c: newest, m });
  };
  const r = typeof state === "object" ? state : null;
  return (
    <section className="mx-auto mt-8 max-w-[640px] rounded-2xl border-2 border-lime-300/25 bg-gradient-to-br from-lime-300/[0.07] to-transparent p-5 text-center" aria-labelledby="cc-test">
      <p id="cc-test" className="text-[17px] font-black text-white">Done? Check it worked.</p>
      <button type="button" onClick={test} disabled={state === "busy"} className={`${PRIMARY} mt-3 min-h-12 px-6 text-[16px]`} data-testid="test-connection">
        {state === "busy" ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Radio className="h-5 w-5" aria-hidden="true" />}Test my connection
      </button>
      {r && (
        <div role="status" className={`sk-fadeup mx-auto mt-4 flex max-w-[520px] gap-2.5 rounded-xl border px-4 py-3 text-left text-[14.5px] leading-relaxed ${r.kind === "working" ? "border-lime-300/40 bg-lime-300/10 text-lime-50" : "border-white/15 bg-black/30 text-white/85"}`}>
          {r.kind === "working" ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-lime-300" aria-hidden="true" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />}
          <span>
            {r.kind === "working" && <><b>It works.</b> {r.c.client} used Zyvo {agoText(r.m)}.</>}
            {r.kind === "idle" && <><b>{r.c.client} is connected</b>, last used {agoText(r.m)}. In Claude, ask: <i>"Give me 3 In This Town ideas with Zyvo"</i> (free), then test again.</>}
            {r.kind === "none" && <><b>Not connected yet.</b> Do the 3 steps above, press Allow on Zyvo's page, then test again.</>}
            {r.kind === "error" && <><b>We couldn't check right now.</b> Try again in a moment.</>}
          </span>
        </div>
      )}
    </section>
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
  return <p className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-dashed border-lime-300/30 px-3 text-[13.5px] font-bold text-lime-100/85"><Icon className="h-4 w-4 text-lime-300" aria-hidden="true" />{text}</p>;
}

function Connections({ list, error, reload, onRemoved, onError }) {
  const [busy, setBusy] = useState(null);
  const signOut = async (id) => {
    setBusy(id);
    try { await connector("/account/connections/revoke", { method: "POST", body: { id } }); onRemoved(id); }
    catch (e) { onError(e.message); }
    finally { setBusy(null); }
  };
  if (error && !list) return <p className={`${CARD} mt-4 p-5 text-[14.5px] text-white/70`}>{error} <button type="button" onClick={reload} className="font-bold text-lime-200 underline underline-offset-4">Try again</button></p>;
  if (!list) return <div className="grid place-items-center py-8"><Loader2 className="h-5 w-5 animate-spin text-lime-300" aria-label="Loading" /></div>;
  if (!list.length) return <p className={`${CARD} mt-4 p-5 text-[14.5px] text-white/65`}>No Claude app is connected yet. Follow the steps above.</p>;
  return (
    <ul className="mt-4 space-y-2.5">
      {list.map((c) => (
        <li key={c.id} className={`${CARD} flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between`}>
          <div className="min-w-0">
            <p className="text-[15.5px] font-black text-white">{c.client}</p>
            <p className="mt-0.5 text-[13px] text-white/60">Connected {when(c.since)} · last used {when(c.lastUsed)}</p>
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
