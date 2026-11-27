import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import { DIRECTOR_MOCK, listDrafts } from "../../lib/director";
import { directorPath, styleById } from "../../data/styles";
import { THUMBNAIL_IMAGE_TOOL_KEY } from "../../lib/longFormIdeaThumbnails";

const JOB_LIMIT = 8;
const DRAFT_LIMIT = 6;
let cache = null; // one load shared by the side menu and the page (refreshed every 30 s at most)
let cacheAt = 0;
const listeners = new Set();

const statusOf = (s) => (s === "succeeded" ? "done" : s === "failed" || s === "error" || s === "canceled" ? "failed" : "making");

async function load(userId) {
  const [jobs, drafts] = await Promise.all([
    DIRECTOR_MOCK ? Promise.resolve({ data: [] }) : supabase
      .from("jobs")
      .select("id, created_at, status, type, result_url, prompt, tool_key, input")
      .eq("user_id", userId)
      .in("type", ["image", "video"])
      .is("settings->>long_form_internal", null)
      // Long Form's idea-grid thumbnails are part of a Long Form draft, not something the user made here
      .or(`tool_key.is.null,tool_key.neq.${THUMBNAIL_IMAGE_TOOL_KEY}`)
      .order("created_at", { ascending: false })
      .limit(JOB_LIMIT),
    listDrafts().then((r) => r.drafts ?? []).catch(() => []),
  ]);
  const items = [
    ...(jobs.data ?? []).map((j) => ({
      id: `job:${j.id}`, kind: j.type, at: j.created_at, status: statusOf(j.status),
      title: String(j.input?.subject ?? j.prompt ?? (j.type === "video" ? "Video" : "Image")).slice(0, 80),
      thumb: j.type === "image" && j.status === "succeeded" ? j.result_url : null,
      video: j.type === "video" && j.status === "succeeded" ? j.result_url : null,
      to: "/workspace/creations",
    })),
    ...drafts.slice(0, DRAFT_LIMIT).map((d) => ({
      id: `plan:${d.id}`, kind: "plan", at: d.updated_at, status: d.status === "draft" ? "plan" : d.made_where === "claude" ? "claude" : "sent",
      title: d.title || d.idea || "Untitled plan", thumb: styleById(d.style_id)?.poster ?? null, to: directorPath(d.id),
    })),
  ];
  return items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

/** the user's latest plans + image / video generations, newest first (shared, refreshed at most every 30 s) */
export function useRecent(limit = 6) {
  const { user } = useAuth() ?? {};
  const [items, setItems] = useState(cache ?? []);
  useEffect(() => {
    if (!user && !DIRECTOR_MOCK) { setItems([]); return undefined; }
    const on = (next) => setItems(next);
    listeners.add(on);
    if (!cache || Date.now() - cacheAt > 30_000) {
      cacheAt = Date.now();
      load(user?.id).then((next) => { cache = next; listeners.forEach((l) => l(next)); }).catch(() => {});
    }
    return () => listeners.delete(on);
  }, [user]);
  return items.slice(0, limit);
}

/** call after starting something, so Recent shows it straight away */
export function refreshRecent() { cacheAt = 0; cache = null; }
