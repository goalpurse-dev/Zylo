// publishApi.js — Phase 6f. The Publish page's server calls.
import { supabase } from "../../../../lib/supabaseClient";

async function invoke(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const payload = await (error.context && typeof error.context.json === "function" ? error.context.json().catch(() => null) : null);
    return { ok: false, status: error.context?.status ?? 500, message: payload?.error ?? "Something went wrong. Try again." };
  }
  return { ok: true, ...data };
}
export const renderStatus = (projectId) => invoke("long-form-render", { projectId, action: "status" });
export const startRender = (projectId, resolution) => invoke("long-form-render", { projectId, action: "start", resolution });
export const downloadRender = (projectId, jobId) => invoke("long-form-render", { projectId, action: "download", jobId });
export const listThumbnails = (projectId) => invoke("long-form-thumbnails", { projectId, action: "list" });
export const startThumbnails = (projectId, regenerate = false) => invoke("long-form-thumbnails", { projectId, action: "start", regenerate });
export const setThumbnailHeadline = (projectId, id, headline) => invoke("long-form-thumbnails", { projectId, action: "headline", id, headline });
export const selectThumbnail = (projectId, id) => invoke("long-form-thumbnails", { projectId, action: "select", id });
export const getYoutubeText = (projectId) => invoke("long-form-youtube-text", { projectId, action: "get" });
export const generateYoutubeText = (projectId) => invoke("long-form-youtube-text", { projectId, action: "generate" });
export const saveYoutubeText = (projectId, patch) => invoke("long-form-youtube-text", { projectId, action: "save", ...patch });
// Publish autopilot: the render (if this edit version has none), the YouTube text and the 3 thumbnails, server-side.
export const startPublish = (projectId) => invoke("long-form-publish-start", { projectId });
export const retryThumbnails = (projectId, id) => invoke("long-form-thumbnails", { projectId, action: "retry", ...(id ? { id } : {}) });
