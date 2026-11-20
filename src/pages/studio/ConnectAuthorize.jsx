import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Boxes, Coins, FileText, Lightbulb, Loader2, ShieldCheck, Video } from "lucide-react";
import AuthModal from "../../components/AuthModal";
import Logo from "../../assets/logo-mark.webp";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import { CONNECTOR_MOCK, connector } from "../../lib/zyvoConnector";
import { CONNECT_CLAUDE_PATH, SCOPE_TEXT } from "../../data/studioKit";
import { MockBanner } from "../../components/studio-kit/StudioKitUI";
import { CARD, DISPLAY, PRIMARY, SECONDARY, useDisplayFont } from "../../components/studio-kit/studioKitShared";
import "../../components/studio-kit/studioKit.css";

const SCOPE_ICON = { ideas: Lightbulb, scripts: FileText, videos: Video, spend: Coins };

/**
 * /connect/authorize?request=...: the connector's consent screen (supabase/functions/_shared/zyvoMcp/oauth.js sends the
 * browser here from mcp.tryzyvo.com/authorize). The user signs in with their normal Zyvo login, sees who asks and for
 * what, and allows or denies; the connector then sends the browser back to Claude with a one-time code (or a "denied").
 * Nothing here holds a token: the request id is single use, 10 minutes, and only works with this user's site login.
 */
export default function ConnectAuthorize() {
  useDisplayFont();
  const { user, loading: authLoading } = useAuth() ?? {};
  const location = useLocation();
  const request = new URLSearchParams(location.search).get("request");
  const [details, setDetails] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null); // "allow" | "deny"
  const [signIn, setSignIn] = useState(null); // "login" | "signup"
  const signedIn = CONNECTOR_MOCK || Boolean(user);

  useEffect(() => { document.title = "Connect Claude to Zyvo"; }, []);
  useEffect(() => {
    if (!request || !signedIn || (authLoading && !CONNECTOR_MOCK)) return undefined;
    let on = true;
    setError(null);
    connector("/authorize/request", { query: { request } })
      .then((d) => { if (on) setDetails(d); })
      .catch((e) => { if (on) setError(e); });
    return () => { on = false; };
  }, [request, signedIn, authLoading, user?.id]);

  const decide = async (approve) => {
    setBusy(approve ? "allow" : "deny");
    try {
      const r = await connector("/authorize/decision", { method: "POST", body: { request, approve } });
      window.location.assign(r.redirect);
    } catch (e) {
      setError(e);
      setBusy(null);
    }
  };
  const switchAccount = async () => {
    await supabase.auth.signOut().catch(() => {});
    setDetails(null);
    setSignIn("login");
  };

  let body;
  if (!request) {
    body = <Notice title="Start from Claude" text="This page opens by itself when you add the Zyvo connector in Claude. Add it there and sign in when Claude sends you here." link />;
  } else if (authLoading && !CONNECTOR_MOCK) {
    body = <Spinner />;
  } else if (!signedIn) {
    body = (
      <div className="text-center">
        <Heading>Sign in to connect Claude</Heading>
        <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-white/65">Claude asked to connect to your Zyvo account. Sign in with your Zyvo login (or make a free account) to continue.</p>
        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
          <button type="button" className={PRIMARY} onClick={() => setSignIn("login")}>Log in</button>
          <button type="button" className={SECONDARY} onClick={() => setSignIn("signup")}>Make a free account</button>
        </div>
      </div>
    );
  } else if (error) {
    body = error.code === "expired"
      ? <Notice title="This link expired" text="Sign-in links work for 10 minutes. Go back to Claude and connect Zyvo again." />
      : error.code === "not_open"
        ? <Notice title="Not open for this account yet" text="The Zyvo connector is being tested before launch. Check back soon." link />
        : <Notice title="That didn't work" text={error.message} retry />;
  } else if (!details) {
    body = <Spinner />;
  } else if (details.allowed === false) {
    body = <Notice title="Not open for this account yet" text="The Zyvo connector is being tested before launch. Check back soon." link />;
  } else {
    body = (
      <>
        <div className="sk-pop flex items-center justify-center gap-3" aria-hidden="true">
          <span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/15 bg-white/[0.06] text-[20px] font-black text-white">{String(details.client).slice(0, 1).toUpperCase()}</span>
          <span className="h-px w-8 bg-gradient-to-r from-white/10 via-lime-300/60 to-white/10" />
          <img src={Logo} alt="" className="h-12 w-12 rounded-2xl" />
        </div>
        <Heading className="mt-5 text-center"><span className="text-lime-300">{details.client}</span> wants to connect to your Zyvo account</Heading>
        <p className="mt-3 text-center text-[14px] text-white/60">
          Signed in as <span className="font-bold text-white">{details.email}</span>.{" "}
          <button type="button" onClick={switchAccount} className="font-bold text-lime-200 underline underline-offset-4">Not you?</button>
        </p>
        <p className="mt-6 text-[12px] font-black uppercase tracking-[0.14em] text-white/45">It will be able to</p>
        <ul className="mt-2 space-y-2">
          {details.scopes.map((s) => {
            const Icon = SCOPE_ICON[s] ?? Boxes;
            return (
              <li key={s} className={`${CARD} sk-fadeup flex items-center gap-3 px-4 py-3`} style={{ animationDelay: `${160 + details.scopes.indexOf(s) * 70}ms` }}>
                <Icon className={`h-5 w-5 shrink-0 ${s === "spend" ? "text-amber-300" : "text-lime-300"}`} aria-hidden="true" />
                <span className="text-[14.5px] font-semibold text-white/85">{SCOPE_TEXT[s] ?? s}</span>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 flex gap-2 text-[13px] leading-relaxed text-white/55">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-lime-300" aria-hidden="true" />
          <span>It can't see your password or payment details. Sign it out any time on <Link to={CONNECT_CLAUDE_PATH} className="font-bold text-lime-200 underline underline-offset-4">Connect Claude</Link>. After you choose, you go back to <span className="font-bold text-white/80">{details.redirectHost}</span>.</span>
        </p>
        <div className="mt-6 grid grid-cols-2 gap-2.5">
          <button type="button" className={SECONDARY} disabled={Boolean(busy)} onClick={() => decide(false)}>{busy === "deny" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}Deny</button>
          <button type="button" className={PRIMARY} disabled={Boolean(busy)} onClick={() => decide(true)}>{busy === "allow" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}Allow</button>
        </div>
      </>
    );
  }

  return (
    <div className="flex min-h-[100dvh] w-full flex-col bg-[#0B0D0F]">
      <MockBanner />
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <main className="w-full max-w-[460px]">
          <Link to="/" className="mx-auto mb-6 flex w-fit items-center gap-2 text-white" aria-label="Zyvo home">
            <img src={Logo} alt="" className="h-7 w-7 rounded-lg" />
            <span className="text-[17px] font-black tracking-tight">Zyvo</span>
          </Link>
          <div className="sk-fadeup rounded-[24px] border border-lime-300/[0.15] bg-[#0F1311] p-6 shadow-[0_30px_80px_rgba(0,0,0,.45)] sm:p-8">{body}</div>
        </main>
      </div>
      {signIn && (
        <AuthModal mode={signIn} title="Sign in to connect Claude" subtitle="Use your Zyvo login. New here? A free account is enough to connect." returnTo={`${location.pathname}${location.search}`} onClose={() => setSignIn(null)} />
      )}
    </div>
  );
}

function Heading({ children, className = "" }) {
  return <h1 style={DISPLAY} className={`text-balance text-[30px] font-extrabold uppercase leading-[0.98] text-white sm:text-[34px] ${className}`}>{children}</h1>;
}
function Spinner() {
  return <div className="grid place-items-center py-10" aria-busy="true"><Loader2 className="h-6 w-6 animate-spin text-lime-300" aria-label="Loading" /></div>;
}
function Notice({ title, text, link = false, retry = false }) {
  return (
    <div className="text-center">
      <Heading>{title}</Heading>
      <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-white/65">{text}</p>
      <div className="mt-6 flex justify-center gap-2.5">
        {retry && <button type="button" className={PRIMARY} onClick={() => window.location.reload()}>Try again</button>}
        {link && <Link to={CONNECT_CLAUDE_PATH} className={SECONDARY}>How to connect Claude</Link>}
      </div>
    </div>
  );
}
