// AI Fruit Story v2 — the real backend (stage 3h). Implements the adapter
// contract in ./fruitStoryV2Api.js on top of the fruit-story-api edge
// function. The browser never writes Fruit tables: every action goes through
// the function, which checks the plan, prices and charges on the server.
//
// Live updates: Supabase realtime on this story's row and scenes (owner-read
// RLS), re-reading the story through the API on any change. A slow poll
// covers dropped realtime connections while something is in progress.
import { supabase } from "../../../../lib/supabaseClient";
import { isLegacyId, isShowable, legacyRecent, legacyRowId, legacyStory } from "./legacyStories";

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fruit-story-api`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const BUSY = new Set(["pictures", "animating", "building"]);
const POLL_MS = 12_000;

class FruitApiError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

async function call(action, body = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new FruitApiError("UNAUTHORIZED", "Sign in to continue.");
  let res;
  try {
    res = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}`, apikey: ANON_KEY },
      body: JSON.stringify({ action, ...body }),
    });
  } catch {
    throw new FruitApiError("NETWORK_FAILED", "We couldn't reach the server. Check your connection and try again.");
  }
  const json = await res.json().catch(() => null);
  if (!json?.ok) throw new FruitApiError(json?.code ?? "SERVER_FAILED", json?.message ?? "Something went wrong on our side. Try again.");
  return json.data;
}

/** Names the template in a request. AI Fruit Story sends nothing: its requests are the same as before there were templates. */
const template = (niche) => (niche && niche !== "fruit" ? { niche } : {});

async function getLegacy(id) {
  const { data, error } = await supabase.from("fruit_story_generations").select("*").eq("id", legacyRowId(id)).maybeSingle();
  if (error || !data) throw new FruitApiError("NOT_FOUND", "This video doesn't exist anymore.");
  return legacyStory(data);
}

async function legacyRecents() {
  const { data, error } = await supabase.from("fruit_story_generations").select("id, title, scene_count, scene_aspect, animation_model, scenes, created_at")
    .order("created_at", { ascending: false }).limit(20);
  if (error) return [];   // old history is a bonus; never block Recent on it
  return (data ?? []).filter(isShowable).map(legacyRecent);
}

/** @returns {import("./fruitStoryV2Api").FruitStoryV2Adapter} */
export function createSupabaseAdapter() {
  return {
    isMock: false,

    listCharacters: ({ niche } = {}) => call("listCharacters", template(niche)),
    getIdeas: ({ seed, niche } = {}) => call("getIdeas", { seed, ...template(niche) }),
    createStory: (input) => call("createStory", { input }),   // input.niche: the template, when it isn't Fruit
    generateScenePictures: (storyId) => call("generateScenePictures", { storyId }),
    editScene: (sceneId, instruction) => call("editScene", { sceneId, instruction }),
    regenerateScene: (sceneId, prompt) => call("regenerateScene", { sceneId, prompt }),
    regenerateSceneFree: (sceneId) => call("regenerateSceneFree", { sceneId }),
    animateAll: (storyId) => call("animateAll", { storyId }),
    regenerateClip: (sceneId) => call("regenerateClip", { sceneId }),
    buildFinal: (storyId, { captions, partLabel, endCard } = {}) => call("buildFinal", { storyId, captions: captions !== false, partLabel, endCard }),
    uploadPackage: (storyId) => call("uploadPackage", { storyId }),
    getStory: (storyId) => (isLegacyId(storyId) ? getLegacy(storyId) : call("getStory", { storyId })),

    subscribeStory(storyId, onChange) {
      if (isLegacyId(storyId)) return () => {};
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
        .channel(`fruit-story-${storyId}-${Math.random().toString(36).slice(2, 8)}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "fruit_stories", filter: `id=eq.${storyId}` }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "fruit_story_scenes", filter: `story_id=eq.${storyId}` }, refresh)
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

    listSeries: ({ niche } = {}) => call("listSeries", template(niche)),
    createSeriesPlan: (input) => call("createSeriesPlan", { input }),
    getSeries: (seriesId, { niche } = {}) => call("getSeries", { seriesId, ...template(niche) }),

    async listRecent({ type, niche } = {}) {
      if (type === "series") return call("listRecent", { type: "series", ...template(niche) });
      // Stories from the first AI Fruit Story are Fruit's history only.
      const [mine, old] = await Promise.all([call("listRecent", { type: "single", ...template(niche) }), template(niche).niche ? [] : legacyRecents()]);
      return [...mine, ...old].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    },
  };
}
