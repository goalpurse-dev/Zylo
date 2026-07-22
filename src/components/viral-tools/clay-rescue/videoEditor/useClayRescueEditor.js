import { useCallback, useEffect, useRef, useState } from "react";
import { stitchClips, probeDuration } from "./ffmpegStitcher";
import { supabase } from "../../../../lib/supabaseClient";
import { saveFullVideo } from "../../../../lib/jobs";

let nextClipId = 1;

const STAGE_MESSAGES = {
  engine: "Video editing isn't available right now — the in-browser video engine couldn't load. Refresh the page and try again.",
  fetch: "Couldn't download one of your clips. Check your connection and try again.",
  render: "Couldn't render the final video. Try again.",
};

function renderErrorMessage(e) {
  return STAGE_MESSAGES[e?.stage] ?? "Couldn't render the final video. Try again.";
}

function revokeLocalPreview(url) {
  if (typeof url === "string" && url.startsWith("blob:")) URL.revokeObjectURL(url);
}

// "published" (referenced by PostModal's custom-upload flow) isn't a real
// bucket in this project — confirmed via `supabase storage ls`, only
// user-assets/public-assets/avatars/products/generated/reference-images/
// public-images/public-reference/video-refs/viral-score-videos/
// lipsync-outputs/lipsync-inputs exist. "public-assets" is the real bucket
// meant for this: src/lib/storage.ts's `publishToPublic()` already uploads
// there under a `published/<uid>/...` path with documented RLS support for
// authenticated inserts, so reusing that exact convention.
const PUBLIC_BUCKET = "public-assets";

/** Uploads the stitched blob to Storage and returns its public URL. */
async function uploadFinalVideo(blob) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const path = `published/${user.id}/clay-rescue-final/${Date.now()}.mp4`;
  const { error: uploadErr } = await supabase.storage
    .from(PUBLIC_BUCKET)
    .upload(path, blob, { cacheControl: "3600", upsert: false, contentType: "video/mp4" });
  if (uploadErr) throw uploadErr;

  const { data: { publicUrl } } = supabase.storage.from(PUBLIC_BUCKET).getPublicUrl(path);
  return publicUrl;
}

/**
 * Manages the "stitch all clips into one final video" editor step for
 * Clay Rescue: clip order, per-clip trim range, deletions, and the
 * rendered final video. Auto-renders once when clips first arrive, then
 * only lights up "Ready" again once the user actually changes something.
 *
 * After every successful render, also uploads the result to Storage and
 * upserts a `jobs` row (tool_key: full-video) so it shows up in the Publish
 * picker's "My Exports" list — separately from render errors, since a save
 * failure shouldn't block the user from previewing/downloading the video
 * they already got.
 */
export default function useClayRescueEditor(
  sceneClips,
  { initialFinalUrl = null, onFinalVideoSaved } = {},
) {
  // sceneClips: [{ sceneIndex, videoUrl }] — only scenes with a finished video
  const [clips, setClips] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [finalUrl, setFinalUrl] = useState(initialFinalUrl);
  const [stitching, setStitching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [renderError, setRenderError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saved, setSaved] = useState(Boolean(initialFinalUrl));

  const seenSignatureRef = useRef("");
  const finalUrlRef = useRef(initialFinalUrl);
  const savedJobIdRef = useRef(null);
  const autoRenderedSignatureRef = useRef("");

  // Seed / reset clip list whenever the underlying set of finished scene
  // videos changes (new generation, retried scene, etc.) — but not on every
  // render, so in-progress trims/reorders aren't clobbered.
  useEffect(() => {
    const signature = sceneClips.map((c) => `${c.sceneIndex}:${c.videoUrl}`).join("|");
    if (signature === seenSignatureRef.current) {
      // The generation row can arrive after the clips. Adopt its persisted
      // final URL only when there is no local render already on screen.
      if (
        initialFinalUrl &&
        (!finalUrlRef.current || !String(finalUrlRef.current).startsWith("blob:"))
      ) {
        finalUrlRef.current = initialFinalUrl;
        setFinalUrl(initialFinalUrl);
        setSaved(true);
      }
      return;
    }

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
      revokeLocalPreview(finalUrlRef.current);
      finalUrlRef.current = initialFinalUrl;
      setFinalUrl(initialFinalUrl);
      savedJobIdRef.current = null;
      setSaved(Boolean(initialFinalUrl));
      setSaveError(null);
    })();

    return () => { cancelled = true; };
  }, [sceneClips, initialFinalUrl]);

  useEffect(() => () => revokeLocalPreview(finalUrlRef.current), []);

  const render = useCallback(async () => {
    if (!clips.length) return;
    setStitching(true);
    setRenderError(null);
    setSaveError(null);
    setSaved(false);
    setProgress(0);
    try {
      const { blob, url } = await stitchClips(
        clips.map((c) => ({ url: c.videoUrl, trimStart: c.trimStart, trimEnd: c.trimEnd })),
        setProgress,
      );
      revokeLocalPreview(finalUrlRef.current);
      finalUrlRef.current = url;
      setFinalUrl(url);
      setDirty(false);
      setStitching(false);

      // Save to the user's account — separate from render success/failure,
      // since they already have a working local preview/download either way.
      setSaving(true);
      try {
        const resultUrl = await uploadFinalVideo(blob);
        onFinalVideoSaved?.(resultUrl);
        const job = await saveFullVideo({
          resultUrl,
          prompt: "Clay Rescue — full rescue video",
          existingId: savedJobIdRef.current,
        });
        savedJobIdRef.current = job.id;
        setSaved(true);
      } catch (e) {
        console.error("[ClayRescue] save final video failed:", e);
        setSaveError("Rendered, but couldn't save it to your account. You can still download it below.");
      } finally {
        setSaving(false);
      }
    } catch (e) {
      console.error("[ClayRescue] stitch failed:", e, "stage:", e?.stage, "cause:", e?.cause);
      setRenderError(renderErrorMessage(e));
      setStitching(false);
    }
  }, [clips, onFinalVideoSaved]);

  // Auto-render exactly once, the first time we have clips and no final video yet.
  useEffect(() => {
    if (clips.length === 0 || finalUrl || stitching) return;
    const signature = clips.map((c) => `${c.sceneIndex}:${c.videoUrl}`).join("|");
    if (autoRenderedSignatureRef.current === signature) return;
    autoRenderedSignatureRef.current = signature;
    render();
  }, [clips, finalUrl, stitching, render]);

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
