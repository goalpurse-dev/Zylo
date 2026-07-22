import { useCallback, useEffect, useRef, useState } from "react";
import { stitchClips, probeDuration } from "./ffmpegStitcher";
import { supabase } from "../../../../lib/supabaseClient";
import { saveFullVideo } from "../../../../lib/jobs";
import { updateFootballerNationalitySwapFullVideo } from "../api/footballerNationalitySwapApi";

let nextClipId = 1;

const STAGE_MESSAGES = {
  engine: "Video editing isn't available right now — the in-browser video engine couldn't load. Refresh the page and try again.",
  fetch: "Couldn't download one of your clips. Check your connection and try again.",
  render: "Couldn't render the final video. Try again.",
};

function renderErrorMessage(e) {
  return STAGE_MESSAGES[e?.stage] ?? "Couldn't render the final video. Try again.";
}

// See Clay Rescue's useClayRescueEditor.js for the origin of this bucket
// convention — "public-assets" is the real bucket for published exports,
// matching src/lib/storage.ts's publishToPublic() path shape.
const PUBLIC_BUCKET = "public-assets";

// Bump this whenever the encoded full-video format changes incompatibly.
// Versioning the storage path gives us targeted cache invalidation: old
// broken stitches rebuild once, while current exports remain reusable.
const STITCH_CACHE_VERSION = "v2";
const STITCH_VERSION_PATH = `/footballer-nationality-swap-final/${STITCH_CACHE_VERSION}/`;

function isCurrentStitchUrl(url) {
  if (!url) return false;
  try {
    return new URL(url, window.location.origin).pathname.includes(STITCH_VERSION_PATH);
  } catch {
    return String(url).includes(STITCH_VERSION_PATH);
  }
}

// Appended to the end of every stitched video for Starter-plan accounts —
// Pro/Generative exports stay clean. NOTE: this currently contradicts
// Pricing.jsx, which advertises "Watermark-free exports" for every paid
// tier including Starter — that copy needs updating to match, or this needs
// reconsidering, before this ships broadly.
const ENDWATERMARK_URL = "/template/nationality-swap/endwatermark.mp4";
// Hardcoded rather than probed at runtime — measured directly from the file
// (video track 3.10s, audio track 3.13s). probeDuration() falls back to a
// generic 6s guess if the browser's <video> element fails to read real
// metadata (e.g. moov atom not at the front of the file for fast metadata
// reads), which silently told ffmpeg to trim to a duration 2x longer than
// the clip actually has — combined with -vsync cfr (which pads by
// duplicating the last frame to fill a requested duration), that produced
// an extra ~3s frozen hold before the watermark appeared.
const ENDWATERMARK_DURATION = 3.15;
const WATERMARKED_PLAN_CODES = new Set(["starter"]);

/** Resolves the caller's plan_code, or null if unknown/unauthenticated. */
async function getCurrentPlanCode() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_code")
    .eq("id", user.id)
    .single();
  return (profile?.plan_code ?? "").toLowerCase().trim() || null;
}

/** Uploads the stitched blob to Storage and returns its public URL. */
async function uploadFinalVideo(blob) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const path = `published/${user.id}/footballer-nationality-swap-final/${STITCH_CACHE_VERSION}/${Date.now()}.mp4`;
  const { error: uploadErr } = await supabase.storage
    .from(PUBLIC_BUCKET)
    .upload(path, blob, { cacheControl: "3600", upsert: false, contentType: "video/mp4" });
  if (uploadErr) throw uploadErr;

  const { data: { publicUrl } } = supabase.storage.from(PUBLIC_BUCKET).getPublicUrl(path);
  return publicUrl;
}

/**
 * Manages the "stitch all scene clips into one final video" editor step:
 * clip order, per-clip trim range, deletions, and the rendered final video.
 *
 * If `existingFullVideoUrl` is passed (reopening a generation that was
 * already stitched before), it's used as-is and nothing gets re-rendered —
 * only editing a clip (reorder/trim/delete) and hitting "Ready" produces a
 * fresh render. Otherwise it auto-renders once, the first time clips arrive.
 *
 * After every successful render, uploads the result to Storage, upserts a
 * `jobs` row (tool_key: full-video) so it shows up in the Publish picker's
 * "My Exports" list, and — if `generationId` is known — persists the URL
 * back onto that generation row so it doesn't need re-stitching next time.
 * Save/persist failures are tracked separately from render failures, since a
 * save failure shouldn't block the user from previewing/downloading the
 * video they already got.
 */
export default function useFootballerStitchEditor(sceneClips, { generationId, existingFullVideoUrl, onSaved } = {}) {
  // sceneClips: [{ sceneIndex, videoUrl }] — only scenes with a finished video
  const [clips, setClips] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [finalUrl, setFinalUrl] = useState(null);
  const [stitching, setStitching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [renderError, setRenderError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saved, setSaved] = useState(false);

  const seenSignatureRef = useRef("");
  const finalUrlRef = useRef(null);
  const savedJobIdRef = useRef(null);
  const autoRenderedRef = useRef(false);

  // Always-current refs so render() (a stable useCallback keyed on `clips`)
  // never closes over a stale generationId/onSaved from an earlier render.
  const generationIdRef = useRef(generationId);
  const onSavedRef = useRef(onSaved);
  useEffect(() => { generationIdRef.current = generationId; }, [generationId]);
  useEffect(() => { onSavedRef.current = onSaved; }, [onSaved]);

  // Seed / reset clip list whenever the underlying set of finished scene
  // videos changes (new generation, retried scene, etc.) — but not on every
  // render, so in-progress trims/reorders aren't clobbered.
  useEffect(() => {
    const clipSignature = sceneClips.map((c) => `${c.sceneIndex}:${c.videoUrl}`).join("|");
    const signature = `${STITCH_CACHE_VERSION}|${clipSignature}`;
    if (signature === seenSignatureRef.current) return;

    let cancelled = false;
    (async () => {
      const withDurations = await Promise.all(
        sceneClips.map(async (c) => ({
          id: nextClipId++,
          sceneIndex: c.sceneIndex,
          videoUrl: c.videoUrl,
          duration: await probeDuration(c.videoUrl),
        }))
      );
      // Only mark this signature "seen" once we're actually about to apply
      // its result — not when the effect starts. In dev, React StrictMode
      // runs this effect twice (mount → cleanup → mount); marking the ref
      // up front made the second, surviving invocation think the work was
      // already done while the first invocation's result got thrown away
      // by `cancelled`, so it never completed at all.
      if (cancelled) return;
      seenSignatureRef.current = signature;

      const seeded = withDurations.map((c) => ({
        ...c,
        trimStart: 0,
        trimEnd: c.duration,
      }));
      setClips(seeded);
      setDirty(false);
      if (finalUrlRef.current) URL.revokeObjectURL(finalUrlRef.current);

      if (isCurrentStitchUrl(existingFullVideoUrl)) {
        // Current-format cached stitch: show it as-is and skip re-render.
        finalUrlRef.current = null; // not a blob URL, nothing to revoke later
        setFinalUrl(existingFullVideoUrl);
        setSaved(true);
        autoRenderedRef.current = true;
      } else {
        finalUrlRef.current = null;
        setFinalUrl(null);
        setSaved(false);
        autoRenderedRef.current = false;
      }
      savedJobIdRef.current = null;
      setSaveError(null);
    })();

    return () => { cancelled = true; };
  }, [sceneClips, existingFullVideoUrl]);

  const render = useCallback(async () => {
    if (!clips.length) return;
    setStitching(true);
    setRenderError(null);
    setSaveError(null);
    setSaved(false);
    setProgress(0);
    try {
      const clipList = clips.map((c) => ({ url: c.videoUrl, trimStart: c.trimStart, trimEnd: c.trimEnd }));

      const planCode = await getCurrentPlanCode();
      if (planCode && WATERMARKED_PLAN_CODES.has(planCode)) {
        clipList.push({ url: ENDWATERMARK_URL, trimStart: 0, trimEnd: ENDWATERMARK_DURATION });
      }

      const { blob, url } = await stitchClips(clipList, setProgress);
      if (finalUrlRef.current) URL.revokeObjectURL(finalUrlRef.current);
      finalUrlRef.current = url;
      setFinalUrl(url);
      setDirty(false);
      setStitching(false);

      // Save to the user's account — separate from render success/failure,
      // since they already have a working local preview/download either way.
      setSaving(true);
      try {
        const resultUrl = await uploadFinalVideo(blob);
        const job = await saveFullVideo({
          resultUrl,
          prompt: "Nationality Swap — full video",
          existingId: savedJobIdRef.current,
        });
        savedJobIdRef.current = job.id;

        if (generationIdRef.current) {
          await updateFootballerNationalitySwapFullVideo({ id: generationIdRef.current, fullVideoUrl: resultUrl });
        }
        onSavedRef.current?.(resultUrl);

        setSaved(true);
      } catch (e) {
        console.error("[FootballerSwap] save final video failed:", e);
        setSaveError("Rendered, but couldn't save it to your account. You can still download it below.");
      } finally {
        setSaving(false);
      }
    } catch (e) {
      console.error("[FootballerSwap] stitch failed:", e, "stage:", e?.stage, "cause:", e?.cause);
      setRenderError(renderErrorMessage(e));
      setStitching(false);
      // Without this, a failed auto-render (dirty starts false, and nothing
      // else sets it) leaves the Ready button permanently disabled — there'd
      // be no way to retry short of reloading the page.
      setDirty(true);
    }
  }, [clips]);

  // Auto-render exactly once, the first time we have clips and no final video
  // yet — skipped entirely when existingFullVideoUrl already seeded finalUrl.
  useEffect(() => {
    if (autoRenderedRef.current) return;
    if (clips.length === 0 || finalUrl || stitching) return;
    autoRenderedRef.current = true;
    render();
  }, [clips.length, finalUrl, stitching, render]);

  const reorder = useCallback((fromIndex, toIndex) => {
    setClips((prev) => {
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return prev;
      if (fromIndex >= prev.length || toIndex >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    setDirty(true);
  }, []);

  const setTrim = useCallback((id, patch) => {
    setClips((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    setDirty(true);
  }, []);

  const deleteClip = useCallback((id) => {
    setClips((prev) => prev.filter((c) => c.id !== id));
    setDirty(true);
  }, []);

  return {
    clips,
    dirty,
    finalUrl,
    stitching,
    progress,
    renderError,
    saving,
    saveError,
    saved,
    render,
    reorder,
    setTrim,
    deleteClip,
  };
}
