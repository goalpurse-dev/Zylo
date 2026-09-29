// scenes.js — Phase 6c client for the Stickman Scenes step: start the
// server-side chain (bible -> beat director -> draw every scene), poll its
// progress + the scene list, and the per-scene actions. Display only: every
// step runs and recovers on the server.
import { supabase } from "../../../lib/supabaseClient";

export const SCENES_POLL_MS = 3000;

async function invoke(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const payload = await (error.context && typeof error.context.json === "function" ? error.context.json().catch(() => null) : null);
    return { ok: false, status: error.context?.status ?? 500, message: payload?.error ?? "Something went wrong. Try again." };
  }
  return { ok: true, ...data };
}

export const startScenes = (projectId, { retry = false } = {}) => invoke("start-long-form-autopilot", { projectId, scenes: true, retry });
export const fetchScenes = (projectId) => invoke("get-long-form-scenes", { projectId });
export const updateScene = (projectId, action, args = {}) => invoke("update-long-form-scene", { projectId, action, ...args });

export function formatSceneTime(ms) {
  const s = Math.max(0, Math.floor((ms ?? 0) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// The scene playing at audio time t (seconds): the last scene that started at or before it.
export function sceneAt(scenes, t) {
  const ms = t * 1000;
  let lo = 0, hi = scenes.length - 1, found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (scenes[mid].startMs <= ms) { found = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return found;
}

// Flatten sections + scenes into one list of fixed-height rows for the virtual list.
export const HEADER_H = 48;
export const ROW_H = 150;
export function flattenRows(scenes) {
  const rows = [];
  let last = null;
  let y = 0;
  scenes.forEach((s, i) => {
    if (s.section !== last) { rows.push({ type: "header", title: s.section, y, h: HEADER_H }); y += HEADER_H; last = s.section; }
    rows.push({ type: "scene", index: i, y, h: ROW_H }); y += ROW_H;
  });
  return { rows, height: y };
}
export function visibleRange(rows, scrollTop, viewH, overscan = 600) {
  const top = scrollTop - overscan, bottom = scrollTop + viewH + overscan;
  let a = 0, b = rows.length;
  while (a < rows.length && rows[a].y + rows[a].h < top) a++;
  let e = a;
  while (e < rows.length && rows[e].y < bottom) e++;
  return [a, Math.min(b, e)];
}
