// editApi.js — Phase 6d-1. The Edit step's server calls (long-form-edit) + the
// Scenes step's per-scene actions the editor reuses (update-long-form-scene).
import { supabase } from "../../../../lib/supabaseClient";

async function invoke(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const payload = await (error.context && typeof error.context.json === "function" ? error.context.json().catch(() => null) : null);
    return { ok: false, status: error.context?.status ?? 500, code: payload?.code ?? null, message: payload?.error ?? "Something went wrong. Try again." };
  }
  return { ok: true, ...data };
}

export const loadEdit = (projectId) => invoke("long-form-edit", { projectId, action: "get" });
export const saveEdit = (projectId, doc, baseVersion) => invoke("long-form-edit", { projectId, action: "save", doc, baseVersion });
export const sceneStatus = (projectId, args) => invoke("long-form-edit", { projectId, action: "scene_status", ...args });
export const splitGenerate = (projectId, args) => invoke("long-form-edit", { projectId, action: "split_generate", ...args });
export const sceneAction = (projectId, action, args = {}) => invoke("update-long-form-scene", { projectId, action, ...args });

export async function uploadFile(projectId, kind, file, extra = {}) {
  const data = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsDataURL(file); });
  return invoke("long-form-edit", { projectId, action: "upload", kind, data, contentType: file.type, name: file.name, ...extra });
}

// Small WebP thumbnails through Supabase image transforms (16:9, never cropped).
// The cache key carries the image version, so a redrawn picture is never served from a stale cache.
export const thumbOf = (url, w = 320, v = null) => (url && url.includes("/storage/v1/object/public/") ? `${url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/")}?width=${w}&height=${Math.round((w * 9) / 16)}&resize=contain&quality=70${v != null ? `&v=${v}` : ""}` : url);
