// /affiliate — the affiliate program (owner's brief, 2026-11-17). Not joined: how it works + "Get my code".
// Joined: the code, what to say, numbers, the 30-day chart, earnings, activity (no personal data), payout
// settings, rules. Rules and numbers: supabase/functions/_shared/affiliate/config.js; API: affiliate-api.
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { REWARDS_PATH } from "../../../lib/rewards";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, Check, Gift, PartyPopper, X } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { usePlanPrices } from "../../../lib/planPrices";
import { affiliateApi } from "../../../lib/affiliate";
import { AFFILIATE } from "../../../../supabase/functions/_shared/affiliate/config.js";
import { CODE_PROBLEM_TEXT, cleanCode } from "../../../../supabase/functions/_shared/affiliate/rules.js";
import { CARD, LABEL, emptyRow, validHandles } from "./ui.js";
import { ChannelsCard, HandlesEditor } from "./channels.jsx";
import { Activity, CodeCard, Confetti, DailyChart, Earnings, EditCode, Funnel, JoinHero, PayoutSettings, RulesFaq, SayThis, StatsRow } from "./parts.jsx";

const LOCAL_CONFIG = AFFILIATE; // a signed-out visitor: the same rules, read from the config file

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const t = document.createElement("textarea");
    t.value = text; t.style.position = "fixed"; t.style.opacity = "0";
    document.body.appendChild(t); t.select();
    const ok = document.execCommand("copy");
    t.remove();
    return ok;
  }
}

function Skeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      <div className="h-[210px] animate-pulse rounded-[26px] bg-white/[0.05]" />
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-[92px] animate-pulse rounded-[22px] bg-white/[0.04]" />)}</div>
      <div className="h-[180px] animate-pulse rounded-[22px] bg-white/[0.04]" />
    </div>
  );
}

function NewSinceBanner({ newSince, onClose }) {
  const parts = [];
  if (newSince.signups) parts.push(`${newSince.signups} new sign-up${newSince.signups === 1 ? "" : "s"}`);
  if (newSince.buyers) parts.push(`${newSince.buyers} new buyer${newSince.buyers === 1 ? "" : "s"}`);
  return (
    <div className="relative flex items-center gap-3 overflow-visible rounded-2xl border border-lime-300/40 bg-lime-300/[0.1] px-4 py-3" role="status" data-testid="affiliate-new-since">
      <Confetti run />
      <PartyPopper className="h-5 w-5 shrink-0 text-lime-300" aria-hidden="true" />
      <p className="flex-1 text-[14.5px] font-bold text-white">New since your last visit: <span className="text-lime-200">{parts.join(" · ")}</span></p>
      <button type="button" aria-label="Close" onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/60 hover:bg-white/10"><X className="h-4 w-4" /></button>
    </div>
  );
}

// A brand-new account that hasn't used a creator code yet can still add one here.
function RedeemCard({ bonus, onDone }) {
  const [v, setV] = useState("");
  const [state, setState] = useState({ s: "idle" });
  const code = cleanCode(v);
  useEffect(() => {
    if (code.length < AFFILIATE.codeMinLength) { setState({ s: "idle" }); return undefined; }
    let live = true;
    setState({ s: "checking" });
    const t = setTimeout(() => affiliateApi("lookup", { code }).then((r) => { if (live) setState(r?.valid ? { s: "valid", name: r.displayName } : { s: r?.reason === "self" ? "self" : "invalid" }); }).catch(() => live && setState({ s: "idle" })), 350);
    return () => { live = false; clearTimeout(t); };
  }, [code]);
  const apply = async () => {
    try {
      const r = await affiliateApi("claim", { code, source: "code" });
      if (r?.result === "claimed") { toast.success(r.bonusCredits ? `+${r.bonusCredits} free credits — thanks to ${r.displayName}!` : "Code applied"); onDone(); }
      else toast.error(r?.result === "self" ? "That's your own code." : "That code can't be added to this account.");
    } catch (e) { toast.error(e.message); }
  };
  return (
    <section className={`${CARD} p-4`} aria-label="Got a creator code?">
      <p className="flex items-center gap-2 text-[15px] font-bold text-white"><Gift className="h-4 w-4 text-lime-300" aria-hidden="true" />Did a creator send you? Get {bonus} free credits</p>
      <div className="mt-2.5 flex gap-2">
        <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Their code" aria-label="Creator code" maxLength={40} autoCapitalize="characters" spellCheck={false}
          className="h-12 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.05] px-4 text-[16px] font-bold uppercase tracking-[0.05em] text-white outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-white/35 focus:border-lime-300/60" />
        <button type="button" onClick={apply} disabled={state.s !== "valid"} className="min-h-[48px] rounded-xl bg-lime-300 px-4 text-[14.5px] font-black text-[#11150D] disabled:opacity-40">Apply</button>
      </div>
      <p className="mt-1.5 min-h-[18px] text-[12.5px] font-semibold" aria-live="polite">
        {state.s === "valid" && <span className="flex items-center gap-1 text-lime-300"><Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />{state.name}'s code</span>}
        {state.s === "invalid" && <span className="text-white/45">No creator with that code</span>}
        {state.s === "self" && <span className="text-amber-200">That's your own code</span>}
      </p>
    </section>
  );
}

// Affiliate = cash for creators; Rewards = free credits for paying users
function ToRewards() {
  return (
    <Link to={REWARDS_PATH} className={`${CARD} flex items-center gap-3 p-4 transition hover:border-white/20`} data-testid="affiliate-to-rewards">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-lime-300"><Gift className="h-5 w-5" aria-hidden="true" /></span>
      <span className="flex-1 text-[14.5px] font-bold text-white">Just want free credits? See Rewards</span>
      <ArrowRight className="h-4 w-4 text-white/50" aria-hidden="true" />
    </Link>
  );
}

export default function AffiliatePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { prices } = usePlanPrices();
  const proPrice = Number(prices?.plans?.[AFFILIATE.example.plan]?.monthly) || AFFILIATE.example.fallbackPriceEur;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [joining, setJoining] = useState(false);
  const [justJoined, setJustJoined] = useState(false);
  const [editing, setEditing] = useState(false);
  const [banner, setBanner] = useState(null);
  const [rows, setRows] = useState([emptyRow()]); // "Where do you post?" before joining
  const [suggested, setSuggested] = useState(null); // "Your code will be …"
  const handles = validHandles(rows);
  const handlesKey = JSON.stringify(handles);
  const seenSent = useRef(false);

  useEffect(() => { document.title = "Affiliate · Earn with Zyvo"; }, []);

  const load = useCallback(async () => {
    setError(null);
    try { setData(await affiliateApi("me")); } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { if (!loading && user) load(); }, [loading, user, load]);

  // "New since your last visit": shown once per visit, then the visit is remembered
  useEffect(() => {
    if (!data?.joined || seenSent.current) return undefined;
    seenSent.current = true;
    if (data.newSince.signups + data.newSince.buyers > 0) setBanner(data.newSince);
    const t = setTimeout(() => affiliateApi("markSeen").catch(() => {}), 1500);
    return () => clearTimeout(t);
  }, [data]);

  // the code they'd get, from their first channel (unique: the server picks the first free one)
  useEffect(() => {
    if (!user || data?.joined || !handles.length) { setSuggested(null); return undefined; }
    let live = true;
    const t = setTimeout(() => affiliateApi("suggestCode", { handles }).then((r) => { if (live) setSuggested(r?.code ?? null); }).catch(() => {}), 500);
    return () => { live = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, data?.joined, handlesKey]);

  const onCopy = async (text, msg) => { if (await copyText(text)) toast.success(msg); else toast.error("Couldn't copy. Long-press to copy instead."); };

  const join = async () => {
    if (!user) { navigate("/signup"); return; }
    setJoining(true);
    try {
      const next = await affiliateApi("join", { handles });
      if (next?.ok === false) { toast.error("Add at least one place where you post."); setJoining(false); return; }
      setJustJoined(true);
      setData(next);
      seenSent.current = true; // a brand-new affiliate has nothing "new since last visit"
      affiliateApi("markSeen").catch(() => {});
      toast.success("Your code is ready!");
      setTimeout(() => setJustJoined(false), 1800);
    } catch (e) { toast.error(e.message); }
    setJoining(false);
  };

  const saveCode = async (code) => {
    try {
      const r = await affiliateApi("setCode", { code });
      if (!r.ok) return CODE_PROBLEM_TEXT[r.problem] ?? "That code can't be used.";
      toast.success(`Your code is now ${r.code}`);
      setEditing(false);
      await load();
      return null;
    } catch (e) { return e.message; }
  };

  const saveHandles = async (list) => {
    try {
      const r = await affiliateApi("setHandles", { handles: list });
      if (!r.ok) return "Add at least one place where you post.";
      toast.success("Saved");
      await load();
      return null;
    } catch (e) { return e.message; }
  };

  const savePayout = async (p) => {
    try {
      const r = await affiliateApi("setPayout", p);
      if (!r.ok) return r.problem === "email" ? "Enter a valid email for your payouts." : "Couldn't save.";
      toast.success("Payout settings saved");
      await load();
      return null;
    } catch (e) { return e.message; }
  };

  const page = (children) => (
    <div className="min-h-full bg-[#090A0A] pb-[calc(110px+env(safe-area-inset-bottom))] lg:pb-12" data-testid="affiliate-page">
      <div className="mx-auto w-full max-w-[880px] space-y-3 px-4 pt-4 sm:px-6 sm:pt-6">{children}</div>
    </div>
  );

  if (loading || (user && !data && !error)) return page(<Skeleton />);
  if (error) {
    return page(
      <div className={`${CARD} p-6 text-center`}>
        <p className="text-[15px] font-semibold text-white">{error}</p>
        <button type="button" onClick={load} className="mt-3 rounded-xl bg-lime-300 px-5 py-2.5 text-[14px] font-black text-[#11150D]">Try again</button>
      </div>,
    );
  }

  if (!user || !data?.joined) {
    const config = data?.config ?? LOCAL_CONFIG;
    return page(
      <>
        <JoinHero config={config} proPrice={proPrice} onJoin={join} busy={joining} signedIn={Boolean(user)} canJoin={!user || handles.length > 0}
          form={user ? (
            <div data-testid="affiliate-where">
              <p className={LABEL}>Where do you post?</p>
              <div className="mt-2.5"><HandlesEditor rows={rows} onChange={setRows} /></div>
              {suggested && <p className="mt-3 text-[13.5px] text-white/60" data-testid="affiliate-suggested">Your code will be <span className="font-black tracking-wide text-lime-300">{suggested}</span> <span className="text-white/40">(you can change it once later)</span></p>}
            </div>
          ) : null} />
        {data?.claim?.eligible && <RedeemCard bonus={data.claim.bonusCredits} onDone={load} />}
        <ToRewards />
        <ToRewards />
      <RulesFaq config={config} />
      </>,
    );
  }

  const { affiliate, stats, earnings, series, activity, config } = data;
  return page(
    <>
      {affiliate.status === "disabled" && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300/40 bg-amber-300/[0.08] px-4 py-3" role="alert">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />
          <p className="text-[14px] text-white/85">Your affiliate account is paused, so your code doesn't work right now. Questions? <a className="underline" href="mailto:support@tryzyvo.com">support@tryzyvo.com</a></p>
        </div>
      )}
      {banner && <NewSinceBanner newSince={banner} onClose={() => setBanner(null)} />}
      {editing
        ? <EditCode current={affiliate.code} config={config} onSave={saveCode} onCancel={() => setEditing(false)} />
        : <CodeCard affiliate={affiliate} onCopy={onCopy} onEdit={() => setEditing(true)} justJoined={justJoined} />}
      <ChannelsCard handles={affiliate.handles} onSave={saveHandles} />
      <SayThis code={affiliate.code} bonus={config.signupBonusCredits} onCopy={onCopy} />
      <StatsRow stats={stats} />
      <div className="grid gap-3 lg:grid-cols-2">
        <Funnel stats={stats} />
        <Earnings earnings={earnings} payoutType={affiliate.payoutType} />
      </div>
      <DailyChart series={series} />
      <Activity items={activity} />
      <PayoutSettings key={`${affiliate.payoutType}-${affiliate.payoutEmail}`} affiliate={affiliate} config={config} onSave={savePayout} />
      <RulesFaq config={config} />
    </>,
  );
}
