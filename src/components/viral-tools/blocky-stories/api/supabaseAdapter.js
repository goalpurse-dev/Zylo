// Blocky Stories — the backend. Implements the adapter contract in
// ./blockyStoriesApi.js on top of the blocky-story-api edge function. The
// browser never writes Blocky tables: every action goes through the function,
// which checks the switch and the plan, and prices and charges on the server.
//
// Live updates: Supabase realtime on this story's row and scenes (owner-read
// RLS), re-reading the story through the API on any change. A slow poll
// covers dropped realtime connections while something is in progress.
import { supabase } from "../../../../lib/supabaseClient";

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/blocky-story-api`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const BUSY = new Set(["pictures", "animating", "building"]);
const POLL_MS = 12_000;

class BlockyApiError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/** guestOk: a signed-out visitor may ask too (the avatar library only; the server decides). */
async function call(action, body = {}, { guestOk = false } = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token && !guestOk) throw new BlockyApiError("UNAUTHORIZED", "Sign in to continue.");
  let res;
  try {
    res = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ANON_KEY}`, apikey: ANON_KEY },
      body: JSON.stringify({ action, ...body }),
    });
  } catch {
    throw new BlockyApiError("NETWORK_FAILED", "We couldn't reach the server. Check your connection and try again.");
  }
  const json = await res.json().catch(() => null);
  if (!json?.ok) throw new BlockyApiError(json?.code ?? "SERVER_FAILED", json?.message ?? "Something went wrong on our side. Try again.");
  return json.data;
}

/** @returns {import("./blockyStoriesApi.js").BlockyStoriesAdapter} */
export function createSupabaseAdapter() {
  return {
    listCharacters: () => call("listCharacters", {}, { guestOk: true }),
    getIdeas: ({ seed } = {}) => call("getIdeas", { seed }),
    createStory: (input) => call("createStory", { input }),
    startDraft: (input) => call("startDraft", { input }),
    writeVersion: (draftId, n) => call("writeVersion", { draftId, n }),
    getDraft: (draftId) => call("getDraft", { draftId }),
    pickVersion: (draftId, n) => call("pickVersion", { draftId, n }),
    generateScenePictures: (storyId) => call("generateScenePictures", { storyId }),
    editScene: (sceneId, instruction) => call("editScene", { sceneId, instruction }),
    regenerateScene: (sceneId, prompt) => call("regenerateScene", { sceneId, prompt }),
    regenerateSceneFree: (sceneId) => call("regenerateSceneFree", { sceneId }),
    animateAll: (storyId) => call("animateAll", { storyId }),
    regenerateClip: (sceneId) => call("regenerateClip", { sceneId }),
    buildFinal: (storyId, { captions, partLabel, endCard } = {}) => call("buildFinal", { storyId, captions: captions !== false, partLabel, endCard }),
    uploadPackage: (storyId) => call("uploadPackage", { storyId }),
    getStory: (storyId) => call("getStory", { storyId }),

    subscribeStory(storyId, onChange) {
      let closed = false;
      let timer = null;
      let lastStatus = null;
      const refresh = () => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
          try {
            const story = await call("getStory", { storyId });
            if (closed) return;
            lastStatus = story.status;
            onChange(story);
          } catch { /* the next event or poll tries again */ }
        }, 300);
      };
      const channel = supabase
        .channel(`blocky-story-${storyId}-${Math.random().toString(36).slice(2, 8)}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "blocky_stories", filter: `id=eq.${storyId}` }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "blocky_story_scenes", filter: `story_id=eq.${storyId}` }, refresh)
        .subscribe();
      // Safety net while work is running: realtime can drop on sleep/offline.
      const poll = setInterval(() => { if (lastStatus === null || BUSY.has(lastStatus)) refresh(); }, POLL_MS);
      return () => {
        closed = true;
        clearTimeout(timer);
        clearInterval(poll);
        supabase.removeChannel(channel);
      };
    },

    listSeries: () => call("listSeries"),
    createSeriesPlan: (input) => call("createSeriesPlan", { input }),
    getSeries: (seriesId) => call("getSeries", { seriesId }),

    listRecent: ({ type } = {}) => call("listRecent", { type: type === "series" ? "series" : "single" }),
  };
}
