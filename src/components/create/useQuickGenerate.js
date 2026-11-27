import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { watchJob } from "../../lib/jobs";
import { generateImageFromUI } from "../../lib/image-generator/generator";
import { imagePriceItem } from "../../lib/image-generator/pricing";
import { NANO_RESOLUTIONS } from "../../lib/image-generator/nanoResolutions";
import { generateVideoFromUI } from "../../lib/video-generator/generator";
import { videoPriceItem } from "../../lib/video-generator/pricing";
import useToolPriceQuotes from "../../hooks/useToolPriceQuotes";
import { DIRECTOR_MOCK } from "../../lib/director";
import { refreshRecent } from "./useRecent";
import { trackCreate } from "./useCatalog";

// QUICK GENERATE's defaults (the classic makers keep every model and setting: "More settings")
export const QUICK = Object.freeze({
  imageModel: "image:nano.2", imageRes: "2k",
  videoModel: "video:seedance15pro", videoRes: "720p",
  sizes: { image: [["9:16", "Tall"], ["1:1", "Square"], ["16:9", "Wide"]], video: [["9:16", "Tall"], ["16:9", "Wide"]] },
  lengths: [5, 8, 10],
});
const MAX_KEEP = 40;
const nid = () => Math.random().toString(36).slice(2, 10);

/** the server's price for exactly one quick job (image, or video of `seconds`) */
export function useQuickPrice(mode, size, seconds) {
  const items = useMemo(() => [mode === "image"
    ? imagePriceItem(QUICK.imageModel, size, QUICK.imageRes, "now")
    : videoPriceItem({ modelKey: QUICK.videoModel, size, duration: String(seconds), resolution: QUICK.videoRes, withSound: false }, "now")], [mode, size, seconds]);
  return useToolPriceQuotes(items).price("now");
}

/**
 * The quick jobs a page has started: start(req, { credits, balance }) makes one image or short clip, follows it live (also
 * after a reload) and keeps the list on the device. Each item: { id, mode, prompt, size, seconds, ref, credits, status:
 * making | done | failed | short, url, error, jobId, at }.
 */
export function useQuickGenerate(storageName = "quick-generate") {
  const { user } = useAuth() ?? {};
  const key = `zyvo:${storageName}:${user?.id ?? "guest"}`;
  const load = useCallback(() => { try { return JSON.parse(localStorage.getItem(key) ?? "[]"); } catch { return []; } }, [key]);
  const [items, setItems] = useState(load);
  const watchers = useRef(new Map());
  useEffect(() => { setItems(load()); }, [load]);
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(items.slice(0, MAX_KEEP))); } catch { /* full */ } }, [items, key]);

  const patch = useCallback((id, p) => setItems((t) => t.map((m) => (m.id === id ? { ...m, ...p } : m))), []);
  const follow = useCallback((id, jobId) => {
    if (!jobId || watchers.current.has(id) || DIRECTOR_MOCK) return;
    const stop = watchJob(jobId, (row) => {
      if (row.status === "succeeded") { patch(id, { status: "done", url: row.result_url }); stop?.(); watchers.current.delete(id); refreshRecent(); }
      else if (row.status === "failed" || row.status === "canceled") { patch(id, { status: "failed", error: "The maker couldn't make this one." }); stop?.(); watchers.current.delete(id); }
    });
    watchers.current.set(id, stop);
  }, [patch]);
  useEffect(() => { items.filter((m) => m.status === "making" && m.jobId).forEach((m) => follow(m.id, m.jobId)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { watchers.current.forEach((stop) => stop?.()); }, []);

  /** returns the new item's id; never charges when the balance is short (a "short" item instead) */
  const start = useCallback(async (req, { credits, balance }) => {
    const item = { id: nid(), mode: req.mode, prompt: req.prompt, size: req.size, seconds: req.seconds, ref: req.ref ?? null, credits, status: "making", at: Date.now() };
    if (!DIRECTOR_MOCK && Number(balance) < Number(credits)) { setItems((t) => [{ ...item, status: "short", have: balance }, ...t]); return item.id; }
    setItems((t) => [item, ...t]);
    trackCreate("quick_generate_started", { target: req.mode, size: req.size });
    if (DIRECTOR_MOCK) {
      setTimeout(() => patch(item.id, { status: "done", url: req.mode === "image" ? "/in-this-town/stories/milo.webp" : "/in-this-town/clips/plane-a.mp4" }), 2200);
      return item.id;
    }
    try {
      const job = req.mode === "image"
        ? await generateImageFromUI({ modelKey: QUICK.imageModel, prompt: req.prompt, style: undefined, size: req.size, resolution: QUICK.imageRes, ...(NANO_RESOLUTIONS[req.size]?.[QUICK.imageRes] ?? {}), refImages: req.ref?.url ? [req.ref.url] : [] })
        : await generateVideoFromUI({ modelKey: QUICK.videoModel, prompt: req.prompt, size: req.size, duration: String(req.seconds), resolution: QUICK.videoRes, refImages: req.ref?.url ? [req.ref.url] : [], withSound: false });
      if (!job?.id || job.ok === false || job.errors?.length) throw new Error(job?.errors?.[0]?.message || "rejected");
      patch(item.id, { jobId: job.id });
      refreshRecent();
      follow(item.id, job.id);
    } catch (e) {
      const m = String(e?.message ?? "");
      patch(item.id, { status: "failed", error: /INSUFFICIENT/i.test(m) ? "You don't have enough credits for this one." : /reject|safety|policy/i.test(m) ? "The maker said no to this one. Try different words." : "It didn't start. Nothing was made." });
    }
    return item.id;
  }, [follow, patch]);

  const remove = useCallback((id) => { watchers.current.get(id)?.(); watchers.current.delete(id); setItems((t) => t.filter((m) => m.id !== id)); }, []);
  return { items, start, remove };
}
