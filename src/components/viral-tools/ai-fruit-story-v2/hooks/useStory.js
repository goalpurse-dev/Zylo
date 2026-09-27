import { useCallback, useEffect, useState } from "react";
import { getStory, subscribeStory } from "../api/fruitStoryV2Api";

/**
 * Live story by id: loads it, then follows every change.
 *   { story, status: "idle" | "loading" | "ready" | "error", error, replace, reload }
 * replace(story) applies a story returned by an action right away.
 */
export default function useStory(storyId) {
  const [state, setState] = useState({ story: null, status: storyId ? "loading" : "idle", error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!storyId) {
      setState({ story: null, status: "idle", error: null });
      return undefined;
    }
    let active = true;
    setState((s) => (s.story?.id === storyId ? s : { story: null, status: "loading", error: null }));
    const off = subscribeStory(storyId, (story) => { if (active) setState({ story, status: "ready", error: null }); });
    getStory(storyId).then(
      (story) => { if (active) setState((s) => (s.story && s.story.id === storyId ? s : { story, status: "ready", error: null })); },
      (error) => { if (active) setState({ story: null, status: "error", error }); },
    );
    return () => { active = false; off(); };
  }, [storyId, attempt]);

  const replace = useCallback((story) => {
    if (story?.id === storyId) setState({ story, status: "ready", error: null });
  }, [storyId]);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, replace, reload };
}
