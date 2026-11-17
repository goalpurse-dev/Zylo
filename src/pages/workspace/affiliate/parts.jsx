// The /affiliate page's pieces. Dark Zyvo style: #090A0A page, white/4% cards, lime accents.
import { useMemo, useState } from "react";
import { CARD, LABEL, fmtCredits, fmtDate, reduceMotion, useCountUp } from "./ui.js";
import { ArrowRight, Check, ChevronDown, Copy, Gift, Link2, Lock, MousePointerClick, Share2, ShoppingBag, Sparkles, UserPlus, Wallet } from "lucide-react";
import { ago, activityText, eur, pct } from "../../../../supabase/functions/_shared/affiliate/rules.js";

/* ---------- confetti: a small burst, nothing with reduced motion ---------- */
const CONFETTI_COLORS = ["#bef264", "#d9f99d", "#ffffff", "#a3e635", "#facc15"];
export function Confetti({ run }) {
  const pieces = useMemo(() => Array.from({ length: 26 }, (_, i) => ({
    x: (Math.random() - 0.5) * 340, y: -90 - Math.random() * 150, r: Math.random() * 540 - 270,
    d: 650 + Math.random() * 500, c: CONFETTI_COLORS[i % CONFETTI_COLORS.length], w: 5 + Math.random() * 5,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  })), [run]);
  if (!run || reduceMotion()) return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 z-10" aria-hidden="true">
      {pieces.map((p, i) => (
        <span key={i} className="absolute block rounded-[2px]"
          style={{ width: p.w, height: p.w * 0.45, background: p.c, "--x": `${p.x}px`, "--y": `${p.y}px`, "--r": `${p.r}deg`, animation: `zyAffConfetti ${p.d}ms cubic-bezier(.15,.7,.3,1) forwards` }} />
      ))}
      <style>{`@keyframes zyAffConfetti { 0% { transform: translate(0,0) rotate(0); opacity: 1 } 70% { opacity: 1 } 100% { transform: translate(var(--x), calc(var(--y) + 160px)) rotate(var(--r)); opacity: 0 } }`}</style>
    </div>
  );
}

/* ---------- not joined ---------- */
export function JoinHero({ config, proPrice, onJoin, busy, signedIn }) {
  const buyers = config.example.buyers;
  const cash = buyers * proPrice * config.cashRate;
  const credits = buyers * proPrice * config.creditRate;
  const steps = [
    { icon: Sparkles, title: "Get your code", text: "One tap. It's yours instantly — no approval." },
    { icon: Share2, title: "Post videos made with Zyvo", text: `Say your code in the video or caption. New users get ${config.signupBonusCredits} free credits.` },
    { icon: Wallet, title: "Get paid when people buy", text: `${Math.round(config.cashRate * 100)}% cash or ${Math.round(config.creditRate * 100)}% in credits on their first purchase.` },
  ];
  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-[26px] border border-lime-300/20 bg-[radial-gradient(120%_90%_at_50%_0%,rgba(190,242,100,0.16),rgba(9,10,10,0)_60%)] px-5 pb-6 pt-8 text-center sm:px-8 sm:pt-10">
        <span className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-lime-300/30 bg-lime-300/10 px-3 py-1 text-[12px] font-bold text-lime-200"><Gift className="h-3.5 w-3.5" aria-hidden="true" />Affiliate program</span>
        <h1 className="mt-4 text-[34px] font-black leading-[1.05] tracking-[-0.03em] text-white sm:text-[44px]">Earn with Zyvo</h1>
        <p className="mx-auto mt-3 max-w-[440px] text-[15.5px] leading-snug text-white/65">
          Share your code. Earn {Math.round(config.cashRate * 100)}% cash or {Math.round(config.creditRate * 100)}% in credits on every new buyer you bring.
        </p>
        <button type="button" onClick={onJoin} disabled={busy} data-testid="affiliate-join"
          className="mx-auto mt-6 flex min-h-[56px] w-full max-w-[360px] items-center justify-center gap-2 rounded-2xl bg-lime-300 text-[17px] font-black text-[#11150D] shadow-[0_10px_40px_rgba(190,242,100,0.25)] transition hover:bg-lime-200 active:scale-[0.98] disabled:opacity-60">
          {busy ? "Creating your code…" : signedIn ? "Get my code" : "Sign up to get my code"}<ArrowRight className="h-5 w-5" aria-hidden="true" />
        </button>
        <p className="mt-2.5 text-[12.5px] text-white/40">Free · instant · no approval</p>
      </section>

      <section aria-labelledby="how-it-works">
        <h2 id="how-it-works" className={`${LABEL} mb-2.5 px-1`}>How it works</h2>
        <ol className="grid gap-2.5 sm:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className={`${CARD} flex gap-3.5 p-4 sm:flex-col sm:gap-3`}>
              <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-[14px] border border-lime-300/25 bg-gradient-to-b from-lime-300/25 to-lime-300/[0.06] text-lime-200">
                <s.icon className="h-5 w-5" aria-hidden="true" />
                <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-lime-300 text-[11px] font-black text-[#11150D]">{i + 1}</span>
              </span>
              <div>
                <h3 className="text-[15.5px] font-bold text-white">{s.title}</h3>
                <p className="mt-0.5 text-[13.5px] leading-snug text-white/55">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className={`${CARD} p-4 sm:p-5`} aria-label="Earnings example">
        <p className={LABEL}>Example</p>
        <p className="mt-2 text-[16px] font-bold leading-snug text-white">
          {buyers} people buy {config.example.planName} = <span className="text-lime-300">{eur(Math.round(cash * 100))} cash</span> or <span className="text-lime-300">{eur(Math.round(credits * 100))} in credits</span>
        </p>
        <p className="mt-1 text-[12.5px] text-white/45">One-time, on each buyer's first purchase. {eur(Math.round(credits * 100))} in credits = {fmtCredits(Math.round(credits / config.creditValueEur))}.</p>
      </section>
    </div>
  );
}

/* ---------- the code ---------- */
export function CodeCard({ affiliate, onCopy, onEdit, justJoined }) {
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const share = async () => {
    try { await navigator.share({ title: "Zyvo", text: `Make AI videos with Zyvo — use my code ${affiliate.code} for free credits`, url: affiliate.link }); } catch { /* closed */ }
  };
  return (
    <section className="relative overflow-hidden rounded-[26px] border border-lime-300/25 bg-[radial-gradient(120%_100%_at_50%_0%,rgba(190,242,100,0.14),rgba(255,255,255,0.02)_65%)] p-5 text-center sm:p-6" aria-label="Your code">
      <Confetti run={justJoined} />
      <p className={LABEL}>Your creator code</p>
      <p className={`mt-2 select-all break-all font-black tracking-[0.04em] text-white ${affiliate.code.length > 12 ? "text-[34px]" : "text-[46px]"} leading-none sm:text-[56px] ${justJoined ? "animate-[zyAffPop_520ms_cubic-bezier(.2,1.4,.4,1)_both]" : ""}`} data-testid="affiliate-code">
        {affiliate.code}
      </p>
      <p className="mt-2 truncate text-[13px] text-white/45">{affiliate.link.replace(/^https?:\/\//, "")}</p>
      <div className={`mx-auto mt-4 grid max-w-[460px] gap-2 ${canShare ? "grid-cols-3" : "grid-cols-2"}`}>
        <button type="button" onClick={() => onCopy(affiliate.code, "Code copied")} data-testid="copy-code"
          className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-2xl bg-lime-300 px-3 text-[14.5px] font-black text-[#11150D] transition hover:bg-lime-200 active:scale-[0.97]">
          <Copy className="h-4 w-4" aria-hidden="true" />Copy code
        </button>
        <button type="button" onClick={() => onCopy(affiliate.link, "Link copied")} data-testid="copy-link"
          className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-2xl border border-white/15 bg-white/[0.06] px-3 text-[14.5px] font-bold text-white transition hover:bg-white/[0.1] active:scale-[0.97]">
          <Link2 className="h-4 w-4" aria-hidden="true" />Copy link
        </button>
        {canShare && (
          <button type="button" onClick={share} className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-2xl border border-white/15 bg-white/[0.06] px-3 text-[14.5px] font-bold text-white transition hover:bg-white/[0.1] active:scale-[0.97]">
            <Share2 className="h-4 w-4" aria-hidden="true" />Share
          </button>
        )}
      </div>
      {affiliate.codeEditsLeft > 0 && (
        <button type="button" onClick={onEdit} className="mt-3 text-[12.5px] font-semibold text-white/45 underline-offset-2 hover:text-white/80 hover:underline">
          Change code (you can do this once)
        </button>
      )}
      <style>{`@keyframes zyAffPop { 0% { transform: scale(.6); opacity: 0 } 100% { transform: scale(1); opacity: 1 } }`}</style>
    </section>
  );
}

export function EditCode({ current, config, onSave, onCancel }) {
  const [v, setV] = useState(current);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const clean = v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, config.codeMaxLength);
  const save = async () => {
    setBusy(true); setProblem(null);
    const p = await onSave(clean);
    if (p) setProblem(p);
    setBusy(false);
  };
  return (
    <section className={`${CARD} p-4`} aria-label="Change your code">
      <p className="text-[15px] font-bold text-white">Pick your new code</p>
      <p className="mt-0.5 text-[12.5px] text-white/50">{config.codeMinLength}–{config.codeMaxLength} letters or numbers. You can change it only once, and your old code stops working.</p>
      <input value={clean} onChange={(e) => setV(e.target.value)} maxLength={config.codeMaxLength} autoCapitalize="characters" spellCheck={false} aria-label="New code"
        className="mt-3 h-12 w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 text-[18px] font-black tracking-[0.05em] text-white outline-none focus:border-lime-300/60" />
      {problem && <p className="mt-2 text-[13px] text-amber-200" role="alert">{problem}</p>}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={save} disabled={busy || clean === current || clean.length < config.codeMinLength}
          className="min-h-[46px] flex-1 rounded-xl bg-lime-300 text-[14.5px] font-black text-[#11150D] disabled:opacity-50">{busy ? "Saving…" : "Save code"}</button>
        <button type="button" onClick={onCancel} className="min-h-[46px] rounded-xl border border-white/15 px-4 text-[14.5px] font-semibold text-white/75">Cancel</button>
      </div>
    </section>
  );
}

export function SayThis({ code, bonus, onCopy }) {
  const line = `Use code ${code} on tryzyvo.com for ${bonus} free credits`;
  return (
    <section className={`${CARD} p-4 sm:p-5`} aria-label="What to say in your video">
      <p className={LABEL}>What to say in your video</p>
      <div className="mt-2.5 flex items-center gap-3 rounded-2xl border border-dashed border-lime-300/30 bg-lime-300/[0.05] p-3.5">
        <p className="flex-1 text-[15.5px] font-semibold leading-snug text-white">"{line}"</p>
        <button type="button" onClick={() => onCopy(line, "Line copied")} aria-label="Copy the line" data-testid="copy-line"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/[0.06] text-white transition hover:bg-white/[0.12] active:scale-95">
          <Copy className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <p className="mt-2 text-[12.5px] text-white/45">Tip: show the code on screen for 2–3 seconds and put it in the caption too.</p>
    </section>
  );
}

/* ---------- numbers ---------- */
// empty: what a zero says instead (a nudge, not a "0")
function Tile({ icon, label, value, format = (n) => Math.round(n).toLocaleString("en"), empty }) {
  const Icon = icon;
  const v = useCountUp(value);
  return (
    <div className={`${CARD} p-3.5 sm:p-4`}>
      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-white/50"><Icon className="h-3.5 w-3.5" aria-hidden="true" />{label}</div>
      {value > 0 || !empty
        ? <div className="mt-1.5 text-[26px] font-black tabular-nums leading-none text-white sm:text-[30px]" aria-label={`${label}: ${format(value)}`}>{format(v)}</div>
        : <div className="mt-2 text-[14px] font-bold leading-tight text-lime-200/90">{empty}</div>}
    </div>
  );
}

export function StatsRow({ stats }) {
  return (
    <section className="grid grid-cols-2 gap-2.5 lg:grid-cols-4" aria-label="Your numbers">
      <Tile icon={MousePointerClick} label="Link clicks" value={stats.clicks} empty="Share your link to start" />
      <Tile icon={UserPlus} label="Sign-ups" value={stats.signups} empty="One video away" />
      <Tile icon={ShoppingBag} label="Buyers" value={stats.buyers} empty="Your first is coming" />
      <Tile icon={Wallet} label="Earned" value={stats.earnedCents} empty="Paid on every new buyer" format={(c) => eur(Math.round(c), { decimals: c >= 10000 ? 0 : 2 })} />
    </section>
  );
}

export function Funnel({ stats }) {
  const rows = [
    { label: "Link clicks", n: stats.clicks, note: null },
    { label: "Sign-ups", n: stats.signups, note: stats.clicks ? `${pct(stats.signups, stats.clicks)} of clicks` : null },
    { label: "Buyers", n: stats.buyers, note: stats.signups ? `${pct(stats.buyers, stats.signups)} of sign-ups` : null },
  ];
  const max = Math.max(1, ...rows.map((r) => r.n));
  if (stats.clicks + stats.signups + stats.buyers === 0) {
    return (
      <section className={`${CARD} p-4 sm:p-5`} aria-label="Funnel">
        <p className={LABEL}>Funnel</p>
        <ol className="mt-3 flex items-center gap-2 text-[13px] font-semibold text-white/70">
          {["Clicks", "Sign-ups", "Buyers"].map((s, i) => (
            <li key={s} className="flex items-center gap-2">{i > 0 && <ArrowRight className="h-3.5 w-3.5 text-white/30" aria-hidden="true" />}<span className="rounded-full border border-white/10 px-2.5 py-1">{s}</span></li>
          ))}
        </ol>
        <p className="mt-3 text-[13px] leading-snug text-white/50">Share your link and you'll see how many clickers sign up — and how many of them buy.</p>
      </section>
    );
  }
  return (
    <section className={`${CARD} p-4 sm:p-5`} aria-label="Funnel">
      <p className={LABEL}>Funnel</p>
      <div className="mt-3 space-y-3">
        {rows.map((r, i) => (
          <div key={r.label}>
            <div className="flex items-baseline justify-between gap-2 text-[13.5px]">
              <span className="font-semibold text-white/80">{r.label}</span>
              <span className="tabular-nums text-white"><b>{r.n.toLocaleString("en")}</b>{r.note && <span className="ml-2 text-[12px] text-white/45">{r.note}</span>}</span>
            </div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/[0.07]">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(r.n ? 3 : 0, (r.n / max) * 100)}%`, background: i === 2 ? "#bef264" : i === 1 ? "#d9f99d" : "rgba(255,255,255,0.55)" }} />
            </div>
          </div>
        ))}
      </div>
      {stats.clicks === 0 && <p className="mt-3 text-[12.5px] text-white/45">Share your link — every click shows up here.</p>}
    </section>
  );
}

/* ---------- the 30-day chart (validated: #3b82f6 / #65a30d on #111315; legend + table view) ---------- */
const SIGNUP = "#3b82f6";
const BUYER = "#65a30d";
export function DailyChart({ series }) {
  const [hover, setHover] = useState(null);
  const [table, setTable] = useState(false);
  const max = Math.max(1, ...series.map((d) => Math.max(d.signups, d.buyers)));
  const total = series.reduce((a, d) => ({ s: a.s + d.signups, b: a.b + d.buyers }), { s: 0, b: 0 });
  const W = 600, H = 150, pad = 4, slot = (W - pad * 2) / series.length, bw = Math.max(2, Math.min(7, slot / 2 - 2));
  const y = (v) => H - (v / max) * (H - 14);
  const top = max <= 4 ? max : Math.ceil(max / 2) * 2;
  const shown = hover != null ? series[hover] : null;
  return (
    <section className={`${CARD} p-4 sm:p-5`} aria-label="Sign-ups and buyers, last 30 days">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={LABEL}>Last 30 days</p>
        <div className="flex items-center gap-3 text-[12px] text-white/70">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: SIGNUP }} />Sign-ups {total.s}</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: BUYER }} />Buyers {total.b}</span>
        </div>
      </div>
      {total.s + total.b === 0 ? (
        <div className="mt-3 grid h-[120px] place-items-center rounded-2xl border border-dashed border-white/10 text-center">
          <p className="px-6 text-[13.5px] text-white/50">Your first sign-up is one video away.<br /><span className="text-white/35">This chart fills in as people join with your code.</span></p>
        </div>
      ) : table ? (
        <div className="mt-3 max-h-[220px] overflow-y-auto rounded-xl border border-white/10">
          <table className="w-full text-left text-[12.5px]">
            <thead className="sticky top-0 bg-[#141617] text-white/50"><tr><th className="px-3 py-2 font-semibold">Day</th><th className="px-3 py-2 text-right font-semibold">Sign-ups</th><th className="px-3 py-2 text-right font-semibold">Buyers</th></tr></thead>
            <tbody>{[...series].reverse().map((d) => <tr key={d.day} className="border-t border-white/[0.06] text-white/80"><td className="px-3 py-1.5">{fmtDate(d.day)}</td><td className="px-3 py-1.5 text-right tabular-nums">{d.signups}</td><td className="px-3 py-1.5 text-right tabular-nums">{d.buyers}</td></tr>)}</tbody>
          </table>
        </div>
      ) : (
        <div className="relative mt-3">
          <svg viewBox={`0 0 ${W} ${H + 18}`} className="block h-[170px] w-full" role="img" aria-label={`Last 30 days: ${total.s} sign-ups, ${total.b} buyers`} onMouseLeave={() => setHover(null)}>
            <line x1="0" x2={W} y1={y(top)} y2={y(top)} stroke="rgba(255,255,255,0.07)" strokeDasharray="3 4" />
            <text x={W} y={y(top) - 4} textAnchor="end" fill="rgba(255,255,255,0.4)" fontSize="11">{top}</text>
            <line x1="0" x2={W} y1={H} y2={H} stroke="rgba(255,255,255,0.14)" />
            {series.map((d, i) => {
              const cx = pad + slot * i + slot / 2;
              return (
                <g key={d.day} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}>
                  <rect x={pad + slot * i} y="0" width={slot} height={H} fill={hover === i ? "rgba(255,255,255,0.05)" : "transparent"} />
                  {d.signups > 0 && <rect x={cx - bw - 1} y={y(d.signups)} width={bw} height={H - y(d.signups)} rx={Math.min(2, bw / 2)} fill={SIGNUP} />}
                  {d.buyers > 0 && <rect x={cx + 1} y={y(d.buyers)} width={bw} height={H - y(d.buyers)} rx={Math.min(2, bw / 2)} fill={BUYER} />}
                </g>
              );
            })}
            <text x={pad} y={H + 14} fill="rgba(255,255,255,0.4)" fontSize="11">{fmtDate(series[0]?.day)}</text>
            <text x={W - pad} y={H + 14} textAnchor="end" fill="rgba(255,255,255,0.4)" fontSize="11">Today</text>
          </svg>
          {shown && (
            <div className="pointer-events-none absolute top-0 rounded-xl border border-white/10 bg-[#1a1c1e] px-3 py-2 text-[12px] shadow-xl"
              style={{ left: `clamp(0px, calc(${((hover + 0.5) / series.length) * 100}% - 70px), calc(100% - 140px))`, width: 140 }}>
              <p className="font-semibold text-white">{fmtDate(shown.day)}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-white/75"><span className="h-2 w-2 rounded-[2px]" style={{ background: SIGNUP }} />{shown.signups} sign-up{shown.signups === 1 ? "" : "s"}</p>
              <p className="flex items-center gap-1.5 text-white/75"><span className="h-2 w-2 rounded-[2px]" style={{ background: BUYER }} />{shown.buyers} buyer{shown.buyers === 1 ? "" : "s"}</p>
            </div>
          )}
        </div>
      )}
      {total.s + total.b > 0 && (
        <button type="button" onClick={() => setTable((t) => !t)} className="mt-2 text-[12px] font-semibold text-white/45 hover:text-white/80">{table ? "Show chart" : "Show as table"}</button>
      )}
    </section>
  );
}

/* ---------- money ---------- */
export function Earnings({ earnings, payoutType }) {
  const progress = Math.min(1, earnings.availableCents / earnings.minPayoutCents);
  const left = Math.max(0, earnings.minPayoutCents - earnings.availableCents);
  const nothing = !earnings.pendingCents && !earnings.availableCents && !earnings.paidCents;
  return (
    <section className={`${CARD} p-4 sm:p-5`} aria-label="Earnings">
      <p className={LABEL}>Earnings</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-white/[0.04] p-3">
          <p className="text-[12px] font-semibold text-white/50">Pending</p>
          <p className="mt-1 text-[19px] font-black tabular-nums text-white">{eur(earnings.pendingCents, { decimals: 2 })}</p>
          <p className="mt-0.5 text-[11px] leading-tight text-white/40">{earnings.nextUnlockAt ? `unlocks on ${fmtDate(earnings.nextUnlockAt)}` : "30-day hold"}</p>
        </div>
        <div className="rounded-2xl bg-lime-300/[0.08] p-3 ring-1 ring-lime-300/20">
          <p className="text-[12px] font-semibold text-lime-200/80">Available</p>
          <p className="mt-1 text-[19px] font-black tabular-nums text-lime-200">{eur(earnings.availableCents, { decimals: 2 })}</p>
          <p className="mt-0.5 text-[11px] leading-tight text-white/40">cash ready</p>
        </div>
        <div className="rounded-2xl bg-white/[0.04] p-3">
          <p className="text-[12px] font-semibold text-white/50">Paid out</p>
          <p className="mt-1 text-[19px] font-black tabular-nums text-white">{eur(earnings.paidCents, { decimals: 2 })}</p>
          <p className="mt-0.5 text-[11px] leading-tight text-white/40">{earnings.paidCredits ? fmtCredits(earnings.paidCredits) : "all time"}</p>
        </div>
      </div>
      {payoutType === "cash" ? (
        <div className="mt-4">
          <div className="flex items-baseline justify-between text-[12.5px]">
            <span className="font-semibold text-white/70">Cash payout at {eur(earnings.minPayoutCents)}</span>
            <span className="tabular-nums text-white/50">{eur(earnings.availableCents, { decimals: 2 })} / {eur(earnings.minPayoutCents)}</span>
          </div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/[0.07]" role="progressbar" aria-valuemin={0} aria-valuemax={earnings.minPayoutCents} aria-valuenow={earnings.availableCents}>
            <div className="h-full rounded-full bg-lime-300 transition-all duration-700" style={{ width: `${Math.max(progress ? 3 : 0, progress * 100)}%` }} />
          </div>
          <p className="mt-1.5 text-[12px] text-white/45">{left > 0 ? `${eur(left, { decimals: 2 })} more and we send it to you (PayPal or Wise).` : "Ready — we'll send it to you soon."}</p>
        </div>
      ) : (
        <p className="mt-3 text-[12.5px] text-white/50">Credits are added to your account automatically when they unlock.</p>
      )}
      {nothing && <p className="mt-3 text-[12.5px] text-white/45">Nothing yet — your first commission arrives when someone you referred buys a plan or credits.</p>}
    </section>
  );
}

/* ---------- activity ---------- */
export function Activity({ items }) {
  return (
    <section className={`${CARD} p-4 sm:p-5`} aria-label="Recent activity">
      <p className={LABEL}>Recent activity</p>
      {items.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center">
          <p className="text-[14px] font-semibold text-white/70">Your first sign-up is one video away.</p>
          <p className="mt-1 text-[12.5px] text-white/45">Post a video made with Zyvo and say your code — new sign-ups and buyers show up here.</p>
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-white/[0.06]">
          {items.map((it, i) => {
            const Icon = it.kind === "signup" ? UserPlus : it.kind === "payout" ? Wallet : it.status === "reversed" ? Lock : ShoppingBag;
            const tone = it.kind === "buyer" && it.status !== "reversed" ? "text-lime-300" : "text-white/70";
            return (
              <li key={`${it.at}-${i}`} className="flex items-center gap-3 py-2.5">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.05] ${tone}`}><Icon className="h-4 w-4" aria-hidden="true" /></span>
                <div className="min-w-0 flex-1">
                  <p className={`text-[14px] font-semibold leading-snug ${it.status === "reversed" ? "text-white/45 line-through" : "text-white"}`}>{activityText(it)}</p>
                  {it.review ? <p className="text-[11.5px] text-amber-200/80">under review</p>
                    : it.unlocksAt ? <p className="text-[11.5px] text-white/40">unlocks {fmtDate(it.unlocksAt)}</p>
                      : it.status === "reversed" ? <p className="text-[11.5px] text-white/40">refunded — not counted</p> : null}
                </div>
                <span className="shrink-0 text-[12px] text-white/40">{ago(it.at)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ---------- payout settings ---------- */
export function PayoutSettings({ affiliate, config, onSave }) {
  const [type, setType] = useState(affiliate.payoutType);
  const [method, setMethod] = useState(affiliate.payoutMethod ?? "paypal");
  const [email, setEmail] = useState(affiliate.payoutEmail ?? "");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const dirty = type !== affiliate.payoutType || (type === "cash" && (method !== (affiliate.payoutMethod ?? "paypal") || email !== (affiliate.payoutEmail ?? "")));
  const save = async () => {
    setBusy(true); setProblem(null);
    const p = await onSave({ type, method, email });
    if (p) setProblem(p);
    setBusy(false);
  };
  const Option = ({ value, title, text }) => (
    <button type="button" onClick={() => setType(value)} aria-pressed={type === value}
      className={`flex-1 rounded-2xl border-2 p-3 text-left transition ${type === value ? "border-lime-300 bg-lime-300/[0.08]" : "border-white/10 bg-white/[0.03] hover:border-white/20"}`}>
      <span className="flex items-center justify-between text-[15px] font-black text-white">{title}{type === value && <Check className="h-4 w-4 text-lime-300" strokeWidth={3} aria-hidden="true" />}</span>
      <span className="mt-0.5 block text-[12px] leading-snug text-white/50">{text}</span>
    </button>
  );
  return (
    <section className={`${CARD} p-4 sm:p-5`} aria-label="Payout settings">
      <p className={LABEL}>How you get paid</p>
      <div className="mt-3 flex gap-2">
        <Option value="cash" title={`${Math.round(affiliate.cashRate * 100)}% cash`} text={`PayPal or Wise, from ${eur(config.minCashPayoutEur * 100)}`} />
        <Option value="credits" title={`${Math.round(affiliate.creditRate * 100)}% credits`} text="Added automatically, double the value" />
      </div>
      {type === "cash" && (
        <div className="mt-3 space-y-2">
          <div className="flex gap-2" role="radiogroup" aria-label="Payout method">
            {["paypal", "wise"].map((m) => (
              <button key={m} type="button" role="radio" aria-checked={method === m} onClick={() => setMethod(m)}
                className={`min-h-[42px] flex-1 rounded-xl border text-[14px] font-bold transition ${method === m ? "border-lime-300/60 bg-lime-300/[0.08] text-white" : "border-white/10 text-white/60"}`}>{m === "paypal" ? "PayPal" : "Wise"}</button>
            ))}
          </div>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={`Your ${method === "paypal" ? "PayPal" : "Wise"} email`} aria-label="Payout email" autoComplete="email"
            className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 text-[15px] text-white outline-none placeholder:text-white/35 focus:border-lime-300/60" />
        </div>
      )}
      <p className="mt-2 text-[12px] text-white/40">Applies to commissions from new buyers; earlier ones keep the type they were made with.</p>
      {problem && <p className="mt-2 text-[13px] text-amber-200" role="alert">{problem}</p>}
      {dirty && (
        <button type="button" onClick={save} disabled={busy} className="mt-3 min-h-[48px] w-full rounded-2xl bg-lime-300 text-[15px] font-black text-[#11150D] disabled:opacity-60">{busy ? "Saving…" : "Save"}</button>
      )}
    </section>
  );
}

/* ---------- rules ---------- */
export function RulesFaq({ config }) {
  const items = [
    ["How much do I earn?", `${Math.round(config.cashRate * 100)}% cash or ${Math.round(config.creditRate * 100)}% in Zyvo credits (1 credit = ${eur(config.creditValueEur * 100, { decimals: 2 })}) of a new user's first purchase. It's one-time — renewals and later purchases don't count.`],
    ["When do I get paid?", `Every commission waits ${config.holdDays} days ("pending"), then becomes available. Credits are added automatically. Cash is sent by hand via PayPal or Wise once you have at least ${eur(config.minCashPayoutEur * 100)} available.`],
    ["What if someone gets a refund?", "If the payment is refunded or charged back before your commission is paid out, the commission is cancelled."],
    ["Who counts as my referral?", `A new account that enters your code (or signs up through your link) within ${config.claimWindowDays} days of signing up, before buying anything. Each person can have only one creator, and it can't be changed later.`],
    ["What do my followers get?", `${config.signupBonusCredits} free credits when they sign up with your code — once per account.`],
    ["What's not allowed?", "Using your own code, fake or duplicate accounts, spam, misleading claims, or paid ads on the Zyvo brand name. Suspicious sign-ups are held for review."],
    ["Can I be removed?", "Yes. Zyvo can pause or remove affiliates who break these rules, and unpaid commissions from rule-breaking are cancelled."],
  ];
  return (
    <section className={`${CARD} p-1.5`} aria-label="Rules and FAQ">
      <details className="group">
        <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between rounded-[18px] px-3.5 text-[15px] font-bold text-white hover:bg-white/[0.03]">
          Rules &amp; FAQ <ChevronDown className="h-4 w-4 text-white/50 transition group-open:rotate-180" aria-hidden="true" />
        </summary>
        <dl className="space-y-3 px-3.5 pb-4 pt-1">
          {items.map(([q, a]) => (
            <div key={q}>
              <dt className="text-[14px] font-semibold text-white">{q}</dt>
              <dd className="mt-0.5 text-[13.5px] leading-snug text-white/55">{a}</dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
}
