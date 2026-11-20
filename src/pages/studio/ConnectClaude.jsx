import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, CheckCircle2, Loader2, Plug, ShieldCheck, Terminal, Trash2 } from "lucide-react";
import AuthModal from "../../components/AuthModal";
import { useAuth } from "../../context/AuthContext";
import { CONNECTOR_MOCK, connector } from "../../lib/zyvoConnector";
import { CLAUDE_CODE_COMMAND, CONNECT_CLAUDE_PATH, CONNECTOR_TOOLS, MCP_URL, SCOPE_TEXT, STUDIO_PROJECTS_PATH } from "../../data/studioKit";
import { CopyField, MockBanner } from "../../components/studio-kit/StudioKitUI";
import { CARD, DISPLAY, PRIMARY, SECONDARY, useDisplayFont, useStudioOpen } from "../../components/studio-kit/studioKitShared";

const KIT_PATH = "/in-this-town-story-video-maker#studio";
const when = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "never");

/**
 * /connect-claude: how to add the Zyvo connector (claude.ai or Claude Code), what it can do and what it costs, and
 * the user's connections with a Sign out for each (the connector's /account/connections routes). It is also the
 * connector's documentation link (URLS.connect in _shared/zyvoMcp/config.js).
 */
export default function ConnectClaude() {
  useDisplayFont();
  const open = useStudioOpen();
  const { user } = useAuth() ?? {};
  const location = useLocation();
  const connected = new URLSearchParams(location.search).get("connected") === "1";
  const [signIn, setSignIn] = useState(false);
  useEffect(() => { document.title = "Connect Claude to Zyvo"; }, []);

  return (
    <div className="min-h-full w-full bg-[#0B0D0F] pb-16">
      <MockBanner />
      <div className="mx-auto w-full max-w-[980px] px-4 pt-8 sm:px-6 sm:pt-12">
        {connected && (
          <p role="status" className="mb-6 flex items-center gap-2 rounded-xl border border-lime-300/30 bg-lime-300/10 px-4 py-3 text-[14.5px] font-bold text-lime-100">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-lime-300" aria-hidden="true" />Connected. Go back to Claude and ask it for story ideas.
          </p>
        )}
        <p className="text-[13px] font-black uppercase tracking-[0.16em] text-lime-300">Zyvo connector</p>
        <h1 style={DISPLAY} className="mt-2 text-balance text-[40px] font-extrabold uppercase leading-[0.95] text-white sm:text-[56px]">Connect Claude to Zyvo</h1>
        <p className="mt-3 max-w-[680px] text-[16px] leading-7 text-white/70">
          Use Zyvo right inside Claude while you build your In This Town story in Roblox Studio: story ideas, our writer, the narrator voice and Finish my video. Claude shows every price and waits for your yes.
        </p>

        {open === "closed" ? (
          <ClosedNote signedIn={Boolean(user)} onSignIn={() => setSignIn(true)} />
        ) : open === "loading" ? (
          <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-lime-300" aria-label="Loading" /></div>
        ) : (
          <>
            <section className="mt-8 grid gap-4 md:grid-cols-2" aria-label="How to connect">
              <div className={`${CARD} p-5`}>
                <h2 className="flex items-center gap-2 text-[17px] font-black text-white"><Plug className="h-5 w-5 text-lime-300" aria-hidden="true" />In Claude (web or desktop app)</h2>
                <ol className="mt-4 space-y-3 text-[14.5px] leading-relaxed text-white/75">
                  <Step n={1}>Open <b className="text-white">Settings</b>, then <b className="text-white">Connectors</b>.</Step>
                  <Step n={2}>Choose <b className="text-white">Add custom connector</b>, name it <b className="text-white">Zyvo</b> and paste this address:</Step>
                </ol>
                <div className="mt-3"><CopyField value={MCP_URL} label="Zyvo connector address" /></div>
                <ol start={3} className="mt-3 space-y-3 text-[14.5px] leading-relaxed text-white/75">
                  <Step n={3}>Press <b className="text-white">Connect</b>, sign in with your Zyvo login and press <b className="text-white">Allow</b>.</Step>
                </ol>
              </div>
              <div className={`${CARD} p-5`}>
                <h2 className="flex items-center gap-2 text-[17px] font-black text-white"><Terminal className="h-5 w-5 text-lime-300" aria-hidden="true" />In Claude Code</h2>
                <ol className="mt-4 space-y-3 text-[14.5px] leading-relaxed text-white/75">
                  <Step n={1}>Run this once in a terminal:</Step>
                </ol>
                <div className="mt-3"><CopyField value={CLAUDE_CODE_COMMAND} label="Claude Code command" /></div>
                <ol start={2} className="mt-3 space-y-3 text-[14.5px] leading-relaxed text-white/75">
                  <Step n={2}>In Claude Code, type <code className="rounded bg-white/10 px-1.5 py-0.5 text-[13px] text-lime-100">/mcp</code>, pick <b className="text-white">zyvo</b> and sign in.</Step>
                  <Step n={3}>Start with <code className="rounded bg-white/10 px-1.5 py-0.5 text-[13px] text-lime-100">/mcp__zyvo__in-this-town</code>. Using our free Studio kit? It finds the connector by itself.</Step>
                </ol>
              </div>
            </section>

            <section className="mt-10" aria-labelledby="cc-tools">
              <h2 id="cc-tools" style={DISPLAY} className="text-[30px] font-extrabold uppercase leading-none text-white">What it can do</h2>
              <div className={`${CARD} mt-4 overflow-hidden`}>
                <ul className="divide-y divide-white/[0.07]">
                  {CONNECTOR_TOOLS.map((t) => (
                    <li key={t.name} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                      <div className="min-w-0">
                        <p className="text-[15px] font-black text-white">{t.name}</p>
                        <p className="text-[13.5px] text-white/60">{t.what}</p>
                      </div>
                      <p className={`shrink-0 text-[14px] font-black ${t.price === "Free" ? "text-lime-300" : "text-white"}`}>
                        {t.price}{t.note && <span className="ml-1.5 rounded-md bg-lime-300/15 px-1.5 py-0.5 text-[11px] font-black uppercase tracking-wide text-lime-200">{t.note}</span>}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="mt-3 flex gap-2 text-[13.5px] leading-relaxed text-white/55">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-lime-300" aria-hidden="true" />
                Nothing is charged until you say yes to the price in Claude. A voice, finish or video that fails gives every credit back.
              </p>
            </section>

            <section className="mt-10" aria-labelledby="cc-connections">
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

function Step({ n, children }) {
  return (
    <li className="flex gap-3">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-lime-300 text-[12px] font-black text-[#11150D]">{n}</span>
      <span>{children}</span>
    </li>
  );
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
    <div className={`${CARD} mt-8 max-w-[560px] p-6`}>
      <p className="text-[17px] font-black text-white">Coming soon</p>
      <p className="mt-2 text-[14.5px] leading-relaxed text-white/65">The Zyvo connector is being tested before launch.{signedIn ? " It isn't open for this account yet." : " Signed up already? Sign in to check."}</p>
      {!signedIn && <button type="button" className={`${SECONDARY} mt-4`} onClick={onSignIn}>Sign in</button>}
    </div>
  );
}
