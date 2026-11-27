import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Clapperboard, Download, ExternalLink, Image as ImageIcon, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { directorPath, styleById } from "../../data/styles";
import { getDraft } from "../../lib/director";
import { handoffToZyvo } from "../../lib/directorHandoff";
import { saveMediaToDevice } from "../../lib/downloadMedia";
import { useProfileCredits } from "../../hooks/useProfileCredits";
import { MAESTRO_MOCK } from "../../lib/maestro";
import { worldsCall } from "../viral-tools/blocky-worlds/api/blockyWorldsApi";
import { cutawayServer } from "../viral-tools/cutaway-explainer/api/cutawayApi";
import { useQuickGenerate, useQuickPrice } from "../create/useQuickGenerate";
import { refreshRecent } from "../create/useRecent";
import { trackCreate } from "../create/useCatalog";
import { prepareTown, startTown } from "../../lib/townHandover";
import { mergeLive, stepLine } from "../../lib/townLive";
import TownLiveFeed from "./TownLiveFeed";
import { LIVE } from "../../../supabase/functions/_shared/liveFeatures.js";

const fmt = (s) => (s < 60 ? `${s}s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);
const runKey = (draftId) => `zyvo:maestro-run:${draftId}`;
const readRun = (draftId) => { try { return JSON.parse(localStorage.getItem(runKey(draftId)) ?? "null"); } catch { return null; } };
const writeRun = (draftId, run) => { try { localStorage.setItem(runKey(draftId), JSON.stringify(run)); } catch { /* full */ } };

/** the plan, right in the chat: title, hook, every scene; quick changes go back to Maestro */
export function PlanCard({ card, onAsk }) {
  const style = styleById(card.styleId);
  const version = style?.variants?.find((v) => v.id === card.variant);
  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-lime-300/25 bg-gradient-to-br from-lime-300/[0.07] to-transparent" data-testid="maestro-plan">
      <div className="flex items-center gap-2.5 border-b border-white/[0.07] px-3.5 py-2.5">
        {style && <img src={version?.poster ?? style.poster} alt="" className="h-9 w-9 rounded-xl object-cover" />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-black text-white">{card.title}</p>
          <p className="text-[12px] text-white/70">{style?.name}{version ? ` · ${version.name}` : ""} · {card.scenes.length} scenes · {fmt(card.seconds)} · {card.format === "16:9" ? "Wide" : "Tall"}</p>
        </div>
      </div>
      <div className="px-3.5 py-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-lime-200/80">Hook</p>
        <p className="text-[14px] text-white">{card.hook}</p>
        <ol className="mt-2.5 space-y-1.5">
          {card.scenes.map((s, i) => (
            <li key={i} className="flex gap-2 text-[13.5px] text-white/90">
              <span className="mt-0.5 h-5 shrink-0 rounded-md bg-lime-300/15 px-1.5 text-[11px] font-black leading-5 text-lime-200">{i + 1}</span>
              <span className="min-w-0 flex-1">{s.narration}</span>
              <span className="shrink-0 text-[11.5px] text-white/55">{s.seconds}s</span>
            </li>
          ))}
        </ol>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {["Make the hook better", "Make it shorter", "Change the ending"].map((t) => <button key={t} type="button" onClick={() => onAsk(t)} className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-[12.5px] font-semibold text-white/90 hover:border-lime-300/40">{t}</button>)}
          <Link to={directorPath(card.draftId)} className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12.5px] font-semibold text-lime-200 hover:underline">Edit scenes<ExternalLink className="h-3 w-3" /></Link>
        </div>
      </div>
    </div>
  );
}

/** GENERATE NOW: the price on the button; pressing it charges the balance and starts the template (here or its page) */
export function GenerateCard({ card }) {
  const navigate = useNavigate();
  const balance = useProfileCredits();
  const style = styleById(card.styleId);
  const [run, setRun] = useState(() => readRun(card.draftId)); // { kind, runId, status, pct, url, error }
  const [credits, setCredits] = useState(card.credits);
  const [exact, setExact] = useState(card.exact);
  const [busy, setBusy] = useState(false);
  // In This Town: the lines saved as written + the exact price for that length (nothing charged yet)
  const [town, setTown] = useState(null); // { draftId, credits }
  // In This Town's live feed (docs/in-this-town-live-feed.md): the stills as they come, and the last step line
  const [feed, setFeed] = useState(null);
  const [lastStatus, setLastStatus] = useState(null);
  const timer = useRef(null);
  const cutawayLen = card.seconds > 45 ? 60 : 30;

  // Cutaway: the server's exact price for this topic + length
  useEffect(() => {
    if (card.how !== "cutaway" || MAESTRO_MOCK) return;
    let live = true;
    getDraft(card.draftId).then((r) => cutawayServer.quote(String(r.draft.idea || r.draft.title).slice(0, 80), cutawayLen)).then((q) => { if (live && q?.credits) { setCredits(q.credits); setExact(true); } }).catch(() => {});
    return () => { live = false; };
  }, [card.how, card.draftId, cutawayLen]);

  const save = (next) => { setRun(next); writeRun(card.draftId, next); };
  // follow a started video until it's done (also after a reload)
  useEffect(() => {
    if (!run?.runId || ["done", "failed"].includes(run.status)) return undefined;
    const tick = async () => {
      try {
        const v = import.meta.env.DEV && MAESTRO_MOCK && run.kind === "town" ? (await import("../../lib/maestroMock.js")).mockTownStatus(run.startedAt)
          : MAESTRO_MOCK ? { status: Date.now() - run.startedAt > 6000 ? "done" : "render", pct: Math.min(99, Math.round((Date.now() - run.startedAt) / 60)), finalUrl: "/in-this-town/stories/milo.mp4" }
          : run.kind === "town" ? await worldsCall("status", { runId: run.runId }) : await cutawayServer.status(run.runId);
        if (run.kind === "town") { setFeed((prev) => mergeLive(prev, v?.live)); setLastStatus({ status: v?.status, stage: v?.stage, progress: v?.progress }); }
        const done = v?.status === "done", failed = v?.status === "failed";
        save({ ...run, status: done ? "done" : failed ? "failed" : "making", pct: Number(v?.pct ?? v?.renderPct ?? 0), url: v?.finalUrl ?? v?.downloadUrl ?? null, error: failed ? (v?.reason ?? "It didn't work. Your credits were given back.") : null });
        if (done) refreshRecent();
      } catch { /* keep trying */ }
    };
    timer.current = setInterval(tick, MAESTRO_MOCK ? 1500 : 8000);
    tick();
    return () => clearInterval(timer.current);
  }, [run?.runId, run?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const short = !MAESTRO_MOCK && credits != null && Number(balance) < Number(credits);

  const go = async () => {
    setBusy(true);
    try {
      const { draft } = await getDraft(card.draftId);
      trackCreate("video_started", { style: card.styleId, where: "zyvo", target: "maestro" });
      if (card.how === "page") { navigate(handoffToZyvo(draft, style)); return; }
      if (MAESTRO_MOCK) { save({ kind: card.how, runId: "mock", status: "making", pct: 0, startedAt: Date.now() }); return; }
      if (card.how === "town") {
        // the plan's lines go to In This Town word for word (no rewrite); the exact price first, charged only at start
        let t = town;
        if (!t) {
          const p = await prepareTown(worldsCall, draft, card.seconds);
          if (p.problems?.length) { save({ status: "failed", error: `${p.problems[0]} Nothing was charged.` }); return; }
          t = { draftId: p.draftId, credits: p.credits };
          setTown(t);
          // a different price than the button showed: show it and wait for a second press
          if (Number.isFinite(t.credits) && t.credits !== Number(credits)) { setCredits(t.credits); setExact(true); return; }
        }
        if (Number.isFinite(t.credits) && Number(balance) < t.credits) { setCredits(t.credits); return; }
        const r = await startTown(worldsCall, t.draftId);
        save({ kind: "town", runId: r.id, status: "making", pct: 0, startedAt: Date.now() });
      } else {
        const r = await cutawayServer.start({ topic: String(draft.idea || draft.title).slice(0, 80), lengthSec: cutawayLen });
        save({ kind: "cutaway", runId: r.id, status: "making", pct: 0, startedAt: Date.now() });
      }
      refreshRecent();
    } catch (e) {
      save({ status: "failed", error: e?.code === "UPGRADE" ? "This template needs a paid plan." : e?.message || "It didn't start. Nothing was charged." });
    } finally { setBusy(false); }
  };

  return (
    <div className="mt-3 rounded-2xl border border-white/12 bg-black/25 p-3.5" data-testid="maestro-generate">
      <div className="flex items-center gap-2.5">
        {style && <img src={style.poster} alt="" className="h-10 w-10 rounded-xl object-cover" />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14.5px] font-black text-white">{card.title}</p>
          <p className="text-[12px] text-white/70">{style?.name} · {fmt(card.seconds)}{card.how === "page" ? " · made on its own page" : " · made right here"}</p>
        </div>
      </div>
      {!run || run.status === "failed" ? (
        <>
          {run?.status === "failed" && <p className="mt-2.5 text-[13px] text-rose-200">{run.error}</p>}
          {short ? (
            <div className="mt-3 text-[13.5px] text-white/90">
              This costs <b>{credits} credits</b>, you have <b>{balance}</b>. Nothing was charged.
              <div className="mt-2 flex gap-2"><Link to="/pricing" className="rounded-lg bg-lime-300 px-3 py-1.5 text-[13px] font-black text-[#11150D]">Get credits</Link>{LIVE.rewards && <Link to="/rewards" className="rounded-lg border border-white/15 px-3 py-1.5 text-[13px] font-bold text-white">Free credits</Link>}</div>
            </div>
          ) : (
            <button type="button" onClick={go} disabled={busy} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-lime-300 px-4 py-3 text-[15px] font-black text-[#11150D] shadow-[0_0_26px_rgba(190,242,100,.3)] hover:bg-lime-200 disabled:opacity-70" data-testid="generate-now">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {card.how === "page" ? `Open ${style?.name ?? "the template"} with this plan` : `Generate now · ${credits} credits`}
            </button>
          )}
          <p className="mt-1.5 text-center text-[11.5px] text-white/55">
            {card.how === "page" ? `About ${credits} credits. You see the exact price on the next screen before anything is charged.` : exact ? "Taken from your balance when you press it. If the video fails, every credit comes back." : `About ${credits} credits.`}
          </p>
        </>
      ) : run.status === "done" ? (
        <div className="mt-3">
          <video src={run.url} controls playsInline className="max-h-[460px] rounded-2xl" />
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => saveMediaToDevice({ url: run.url, filename: `${card.title || "zyvo-video"}.mp4`, title: card.title }).catch(() => window.open(run.url, "_blank"))} className="inline-flex items-center gap-1.5 rounded-lg bg-lime-300 px-3 py-1.5 text-[13px] font-black text-[#11150D]"><Download className="h-3.5 w-3.5" />Download</button>
            <Link to="/workspace/creations" className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-[13px] font-bold text-white">In your Library</Link>
          </div>
        </div>
      ) : (
        card.how === "town" ? <TownLiveFeed feed={feed} line={stepLine(lastStatus, feed)} pct={run.pct} /> : <div className="mt-3">
          <p className="flex items-center gap-2 text-[13.5px] font-semibold text-amber-100"><Loader2 className="h-4 w-4 animate-spin" />Making your video… {card.how === "town" ? "usually 10-25 minutes" : "a few minutes"}. You can leave this page.</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-lime-300 transition-all" style={{ width: `${Math.max(4, run.pct ?? 0)}%` }} /></div>
        </div>
      )}
    </div>
  );
}

/** a quick image or short clip from the chat (the exact price on the button) */
export function QuickCard({ card, cardKey }) {
  const balance = useProfileCredits();
  const price = useQuickPrice(card.mode, card.size, card.seconds);
  const { items, start } = useQuickGenerate("maestro-quick");
  const mapKey = `zyvo:maestro-quick-map:${cardKey}`;
  const [itemId, setItemId] = useState(() => { try { return localStorage.getItem(mapKey); } catch { return null; } });
  const item = items.find((m) => m.id === itemId);
  const go = async () => {
    const id = await start({ mode: card.mode, prompt: card.prompt, size: card.size, seconds: card.seconds }, { credits: price, balance });
    setItemId(id);
    try { localStorage.setItem(mapKey, id); } catch { /* full */ }
  };
  return (
    <div className="mt-3 rounded-2xl border border-white/12 bg-black/25 p-3.5" data-testid="maestro-quick">
      <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-lime-200/80">{card.mode === "image" ? <ImageIcon className="h-3.5 w-3.5" /> : <Clapperboard className="h-3.5 w-3.5" />}{card.mode === "image" ? "Quick image" : `Quick clip · ${card.seconds}s, no voice`}</p>
      <p className="mt-1 text-[14px] text-white">{card.prompt}</p>
      {!item || item.status === "failed" ? (
        <>
          {item?.status === "failed" && <p className="mt-2 text-[13px] text-rose-200">{item.error}</p>}
          <button type="button" onClick={go} disabled={price == null && !MAESTRO_MOCK} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-lime-300 px-4 py-2.5 text-[14px] font-black text-[#11150D] disabled:opacity-60">
            {item ? <RotateCcw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}{item ? "Try again" : "Generate"}{price != null && ` · ${price} credits`}
          </button>
        </>
      ) : item.status === "short" ? (
        <p className="mt-2 text-[13.5px] text-white/90">This costs <b>{item.credits}</b> credits, you have <b>{item.have}</b>. Nothing was charged. <Link to="/pricing" className="font-bold text-lime-300">Get credits</Link></p>
      ) : item.status === "making" ? (
        <p className="mt-3 flex items-center gap-2 text-[13.5px] text-amber-100"><Loader2 className="h-4 w-4 animate-spin" />Making it…</p>
      ) : (
        <div className="mt-3">
          {card.mode === "image" ? <img src={item.url} alt={card.prompt} className="max-h-[420px] rounded-2xl" /> : <video src={item.url} controls muted loop playsInline className="max-h-[420px] rounded-2xl" />}
          <button type="button" onClick={() => saveMediaToDevice({ url: item.url, filename: card.mode === "image" ? "zyvo-image.png" : "zyvo-clip.mp4", title: "My Zyvo creation" }).catch(() => window.open(item.url, "_blank"))} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-lime-300 px-3 py-1.5 text-[13px] font-black text-[#11150D]"><Download className="h-3.5 w-3.5" />Download</button>
        </div>
      )}
    </div>
  );
}
