import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Lock } from "lucide-react";
import {
  AUDIENCES, AVG_VIEWS, DEFAULTS, NICHES, PLATFORMS, VIDEOS_PER_WEEK,
} from "./earningsConfig.ts";
import { calculate, formatCount, formatMoney } from "./earningsMath.ts";
import "./earnings.css";

const STORAGE_KEY = "zyvo:earnings-calculator:v1";
const COUNT_MS = 600;

/* ─── Saved inputs (per browser; never required) ──────────────────────────── */
function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

function sanitize(saved) {
  const s = saved && typeof saved === "object" ? saved : {};
  const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
  return {
    niche: NICHES.some((n) => n.id === s.niche) ? s.niche : DEFAULTS.niche,
    platform: PLATFORMS.some((p) => p.id === s.platform) ? s.platform : DEFAULTS.platform,
    audience: AUDIENCES.some((a) => a.id === s.audience) ? s.audience : DEFAULTS.audience,
    videosPerWeek: clamp(Math.round(num(s.videosPerWeek, DEFAULTS.videosPerWeek)), VIDEOS_PER_WEEK.min, VIDEOS_PER_WEEK.max),
    avgViews: clamp(Math.round(num(s.avgViews, DEFAULTS.avgViews)), AVG_VIEWS.min, AVG_VIEWS.max),
    stack: {
      payout: typeof s.stack?.payout === "boolean" ? s.stack.payout : DEFAULTS.stack.payout,
      brand: typeof s.stack?.brand === "boolean" ? s.stack.brand : DEFAULTS.stack.brand,
      affiliate: typeof s.stack?.affiliate === "boolean" ? s.stack.affiliate : DEFAULTS.stack.affiliate,
    },
  };
}

/* ─── Count-up: eases from the number on screen to the new one ───────────── */
function useCountUp(target) {
  const [shown, setShown] = useState(0);
  const [landed, setLanded] = useState(0);
  const shownRef = useRef(0);

  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const from = shownRef.current;
    if (reduce || from === target) {
      shownRef.current = target;
      setShown(target);
      return undefined;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / COUNT_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = from + (target - from) * eased;
      shownRef.current = v;
      setShown(v);
      if (t < 1) raf = requestAnimationFrame(tick);
      else setLanded((n) => n + 1);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  return [shown, landed];
}

function Money({ value, format = formatMoney, className = "" }) {
  const [shown] = useCountUp(value);
  return <span className={`earn-money ${className}`}>{format(shown)}</span>;
}

/* ─── Small building blocks ──────────────────────────────────────────────── */
function Card({ className = "", children }) {
  return (
    <section className={`rounded-[22px] border border-white/[0.08] bg-white/[0.03] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.03)] sm:p-5 ${className}`}>
      {children}
    </section>
  );
}

function Label({ children, right }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">{children}</p>
      {right}
    </div>
  );
}

function Segmented({ options, value, onChange, small = false }) {
  return (
    <div className="flex gap-1 rounded-[14px] border border-white/[0.07] bg-black/25 p-1" role="radiogroup">
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.id)}
            className={`min-w-0 flex-1 rounded-[10px] px-2 font-semibold leading-tight transition-all duration-150 active:scale-[0.97] ${
              small ? "py-1.5 text-[11px]" : "py-2 text-[12.5px]"
            } ${active ? "bg-lime-300 text-black shadow-[0_0_18px_-4px_rgba(190,242,100,.7)]" : "text-white/55 hover:bg-white/[0.05] hover:text-white"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Switch({ on, onChange, disabled, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-[26px] w-[46px] shrink-0 rounded-full border transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${
        on ? "border-lime-300/60 bg-lime-300" : "border-white/[0.1] bg-white/[0.08]"
      }`}
    >
      <span
        className={`absolute left-0 top-[2px] h-5 w-5 rounded-full shadow transition-transform duration-200 ${on ? "translate-x-[22px] bg-black" : "translate-x-[2px] bg-white/70"}`}
      />
    </button>
  );
}

// Avg views slider: log scale 1K → 1M, rounded to 2 significant digits.
const LOG_MIN = Math.log10(AVG_VIEWS.min);
const LOG_MAX = Math.log10(AVG_VIEWS.max);
const SLIDER_STEPS = 1000;
const viewsToPos = (v) => Math.round(((Math.log10(v) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * SLIDER_STEPS);
function posToViews(pos) {
  const raw = Math.pow(10, LOG_MIN + (pos / SLIDER_STEPS) * (LOG_MAX - LOG_MIN));
  const mag = Math.pow(10, Math.floor(Math.log10(raw)) - 1);
  return clamp(Math.round(raw / mag) * mag, AVG_VIEWS.min, AVG_VIEWS.max);
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function EarningsCalculator() {
  const [input, setInput] = useState(() => sanitize(null));
  const loaded = useRef(false);

  // Load after mount so the number counts up from the defaults to the saved plan.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setInput(sanitize(JSON.parse(raw)));
    } catch {
      // storage blocked or bad JSON: the defaults are fine
    }
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(input));
    } catch {
      // private mode: nothing to remember
    }
  }, [input]);

  // Keep the picked niche chip in view inside its row (horizontal only, never scrolls the page).
  const chipsRef = useRef(null);
  useEffect(() => {
    const row = chipsRef.current;
    const chip = row?.querySelector("[data-active]");
    if (!row || !chip) return;
    const left = chip.getBoundingClientRect().left - row.getBoundingClientRect().left + row.scrollLeft;
    if (left < row.scrollLeft || left + chip.offsetWidth > row.scrollLeft + row.clientWidth) {
      row.scrollTo({ left: Math.max(0, left - 12), behavior: "smooth" });
    }
  }, [input.niche]);

  const set = (patch) => setInput((cur) => ({ ...cur, ...patch }));
  const setStack = (key, on) => setInput((cur) => ({ ...cur, stack: { ...cur.stack, [key]: on } }));

  const r = useMemo(() => calculate(input), [input]);
  const [heroShown, heroLanded] = useCountUp(r.monthly);
  const platform = PLATFORMS.find((p) => p.id === input.platform);
  const maxCompare = Math.max(...r.compare.map((c) => c.total), 0);
  const elig = r.eligibility;
  const pct = elig.progress * 100;
  const pctText = elig.unlocked ? "100%" : pct > 0 && pct < 1 ? "<1%" : `${Math.floor(pct)}%`;
  const notMonetized = input.stack.payout && !elig.unlocked;
  const nothingOn = !input.stack.payout && !input.stack.brand && !input.stack.affiliate;

  const stackRows = [
    { key: "payout", label: "Platform payout", sub: `${platform.label} ad revenue`, value: r.rows.payout },
    {
      key: "brand",
      label: "Brand deals",
      sub: r.brandUnlocked ? `${r.dealsPerMonth} sponsored video${r.dealsPerMonth > 1 ? "s" : ""} a month` : null,
      value: r.rows.brand,
      locked: !r.brandUnlocked,
    },
    { key: "affiliate", label: "Affiliate links", sub: "Links in bio and descriptions", value: r.rows.affiliate },
  ];

  const openTemplates = () => window.dispatchEvent(new CustomEvent("zyvo:open-create-menu"));

  return (
    <div className="mx-auto w-full max-w-[1040px] px-4 pb-28 pt-4 sm:px-6 lg:pb-12 lg:pt-8">
      <div className="mb-4 px-1 lg:mb-6">
        <h1 className="text-[22px] font-black tracking-[-0.03em] text-white sm:text-[26px]">Earnings Calculator</h1>
        <p className="mt-0.5 text-[13px] text-white/45">Pick your niche and posting plan. See what it could pay.</p>
      </div>

      {/* minmax(0,1fr): the swipeable niche row must never widen the column past the screen */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-4">
        {/* LEFT: hero + inputs */}
        <div className="flex min-w-0 flex-col gap-3 lg:gap-4">
          {/* 1. Hero */}
          <section className="relative overflow-hidden rounded-[24px] border border-lime-300/[0.16] bg-[radial-gradient(120%_90%_at_50%_0%,rgba(190,242,100,.10),rgba(255,255,255,.02)_60%)] px-5 pb-5 pt-6 text-center shadow-[inset_0_1px_0_rgba(255,255,255,.05)]">
            <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-lime-300/70 to-transparent" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
              Your monthly earnings{notMonetized && <span className="ml-1.5 rounded-full border border-white/[0.1] bg-white/[0.05] px-2 py-0.5 normal-case tracking-normal text-white/55">once monetized</span>}
            </p>
            <div className="mt-2 flex items-baseline justify-center gap-2">
              <span key={heroLanded} className={`earn-money text-[52px] font-black leading-none tracking-[-0.045em] text-lime-300 sm:text-[60px] ${heroLanded ? "earn-land" : ""}`}>
                {formatMoney(heroShown)}
              </span>
              <span className="text-[16px] font-semibold text-white/45">/ month</span>
            </div>
            <p className="mt-3 text-[13px] text-white/50">
              Realistic range: <Money value={r.low} className="font-semibold text-white/75" /> – <Money value={r.high} className="font-semibold text-white/75" />
            </p>
            <p className="mt-0.5 text-[13px] text-white/50">
              <Money value={r.yearly} className="font-semibold text-white/75" /> / year
            </p>
            {/* 7. Fun equivalent */}
            <p className="mt-3 text-[13.5px] font-medium text-white/80">
              {nothingOn ? "Switch on an income row below" : r.equivalent ?? "Every view counts"}
            </p>
          </section>

          {/* 2. Inputs */}
          <Card className="flex flex-col gap-5">
            <div>
              <Label>Niche</Label>
              <div ref={chipsRef} className="earn-chips -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
                {NICHES.map((n) => {
                  const active = n.id === input.niche;
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => set({ niche: n.id })}
                      aria-pressed={active}
                      data-active={active || undefined}
                      className={`shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-all duration-150 active:scale-[0.96] ${
                        active ? "border-lime-300/60 bg-lime-300/[0.12] text-lime-300" : "border-white/[0.08] bg-white/[0.03] text-white/60 hover:text-white"
                      }`}
                    >
                      {n.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <Label>Platform</Label>
              <Segmented options={PLATFORMS} value={input.platform} onChange={(platformId) => set({ platform: platformId })} />
              {input.platform === "tiktok" && <p className="mt-2 text-[11.5px] text-white/40">On TikTok, only videos 1 min+ earn.</p>}
            </div>

            <div>
              <Label right={<span className="earn-money text-[14px] font-bold text-white">{input.videosPerWeek}</span>}>Videos per week</Label>
              <input
                type="range"
                className="earn-range"
                min={VIDEOS_PER_WEEK.min}
                max={VIDEOS_PER_WEEK.max}
                step={1}
                value={input.videosPerWeek}
                onChange={(e) => set({ videosPerWeek: Number(e.target.value) })}
                aria-label="Videos per week"
                style={{ "--fill": `${((input.videosPerWeek - VIDEOS_PER_WEEK.min) / (VIDEOS_PER_WEEK.max - VIDEOS_PER_WEEK.min)) * 100}%` }}
              />
            </div>

            <div>
              <Label right={<span className="earn-money text-[14px] font-bold text-white">{formatCount(input.avgViews)}</span>}>Avg views per video</Label>
              <input
                type="range"
                className="earn-range"
                min={0}
                max={SLIDER_STEPS}
                step={1}
                value={viewsToPos(input.avgViews)}
                onChange={(e) => set({ avgViews: posToViews(Number(e.target.value)) })}
                aria-label="Average views per video"
                aria-valuetext={`${formatCount(input.avgViews)} views`}
                style={{ "--fill": `${(viewsToPos(input.avgViews) / SLIDER_STEPS) * 100}%` }}
              />
              <div className="mt-1 grid grid-cols-6 gap-1">
                {AVG_VIEWS.chips.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => set({ avgViews: v })}
                    className={`rounded-[9px] py-1 text-[11px] font-semibold transition active:scale-[0.95] ${
                      input.avgViews === v ? "bg-white/[0.12] text-white" : "text-white/40 hover:bg-white/[0.05] hover:text-white/75"
                    }`}
                  >
                    {formatCount(v)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>Audience</Label>
              <Segmented small options={AUDIENCES} value={input.audience} onChange={(audience) => set({ audience })} />
            </div>
          </Card>
        </div>

        {/* RIGHT: results */}
        <div className="flex min-w-0 flex-col gap-3 lg:gap-4">
          {/* 3. Stat tiles */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Per video", node: <Money value={r.perVideo} /> },
              { label: "Monthly views", node: <Money value={r.monthlyViews} format={formatCount} /> },
              { label: "RPM used", node: <Money value={r.rpm} format={(v) => `$${v.toFixed(2)}`} /> },
            ].map((t) => (
              <div key={t.label} className="rounded-[16px] border border-white/[0.07] bg-white/[0.03] px-3 py-3">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/35">{t.label}</p>
                <p className="mt-1 text-[17px] font-bold text-white">{t.node}</p>
              </div>
            ))}
          </div>

          {/* 4. Same views, different platforms */}
          <Card>
            <Label>Same views, different platforms</Label>
            <div className="mt-1 flex flex-col gap-3">
              {r.compare.map((c) => {
                const active = c.id === input.platform;
                const width = maxCompare > 0 ? Math.max(c.total > 0 ? 3 : 0, (c.total / maxCompare) * 100) : 0;
                return (
                  <button key={c.id} type="button" onClick={() => set({ platform: c.id })} className="group block w-full text-left">
                    <div className="mb-1 flex items-baseline justify-between">
                      <span className={`text-[12.5px] font-semibold ${active ? "text-white" : "text-white/50 group-hover:text-white/75"}`}>{c.label}</span>
                      <span className={`text-[13px] font-bold ${active ? "text-lime-300" : "text-white/60"}`}><Money value={c.total} /><span className="font-medium text-white/35"> /mo</span></span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className={`earn-bar h-full rounded-full ${active ? "bg-gradient-to-r from-lime-400 to-lime-300 shadow-[0_0_14px_rgba(190,242,100,.45)]" : "bg-white/[0.22]"}`}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* 5. Stack your income */}
          <Card>
            <Label>Stack your income</Label>
            <div className="divide-y divide-white/[0.06]">
              {stackRows.map((row) => (
                <div key={row.key} className="flex items-center gap-3 py-3 first:pt-1 last:pb-1">
                  <div className="min-w-0 flex-1">
                    <p className={`text-[13.5px] font-semibold ${row.locked ? "text-white/45" : "text-white"}`}>{row.label}</p>
                    {row.locked ? (
                      <p className="mt-0.5 flex items-center gap-1 text-[11.5px] text-white/40"><Lock className="h-3 w-3" /> Unlocks at 10K avg views</p>
                    ) : (
                      <p className="mt-0.5 truncate text-[11.5px] text-white/40">{row.sub}</p>
                    )}
                  </div>
                  <span className={`text-[14px] font-bold transition-colors ${input.stack[row.key] && !row.locked ? "text-lime-300" : "text-white/30"}`}>
                    {row.locked ? "—" : <Money value={row.value} />}
                  </span>
                  <Switch on={input.stack[row.key] && !row.locked} disabled={row.locked} onChange={(on) => setStack(row.key, on)} label={row.label} />
                </div>
              ))}
            </div>
          </Card>

          {/* 6. Monetization progress */}
          <Card>
            <div className="mb-2.5 flex items-start justify-between gap-3">
              <p className="text-[13.5px] font-semibold text-white">
                {elig.unlocked ? (
                  <span className="inline-flex items-center gap-1.5 text-lime-300"><Check className="h-4 w-4" strokeWidth={3} />{platform.short} payouts unlocked</span>
                ) : (
                  <>{pctText} of the way to unlocking {platform.short} payouts</>
                )}
              </p>
            </div>
            <div className="relative h-3 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={`earn-bar relative h-full overflow-hidden rounded-full ${elig.unlocked ? "bg-gradient-to-r from-lime-400 to-lime-200 shadow-[0_0_18px_rgba(190,242,100,.6)]" : "bg-gradient-to-r from-lime-500/70 to-lime-300"}`}
                style={{ width: `${Math.max(pct > 0 ? 2 : 0, pct)}%` }}
              >
                {elig.unlocked && <span key={input.platform} className="earn-sweep absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/70 to-transparent" />}
              </div>
            </div>
            <p className="mt-2 text-[11.5px] text-white/40">
              <span className="earn-money text-white/60">{formatCount(elig.current)} / {formatCount(elig.target)} {elig.unit}</span> · Needs {elig.requirement}
            </p>
          </Card>

          {/* 8. CTA */}
          <button
            type="button"
            onClick={openTemplates}
            className="group flex w-full items-center justify-center gap-2 rounded-[16px] bg-lime-300 py-3.5 text-[15px] font-bold text-black shadow-[0_10px_30px_-10px_rgba(190,242,100,.7)] transition hover:bg-lime-200 active:scale-[0.985]"
          >
            Make this week's videos
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>

          {/* 9. Footnote */}
          <p className="px-1 text-[11px] leading-relaxed text-white/30">
            Estimates based on public 2026 creator data. Real payouts depend on audience country, watch time, and eligibility. Q4 often pays more.
          </p>
        </div>
      </div>
    </div>
  );
}
