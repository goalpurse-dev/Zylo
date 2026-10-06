import { useCallback, useEffect, useState } from "react";
import { listCharacters } from "../api/fruitStoryV2Api";

const cache = new Map(); // template → Promise<Character[]>, shared by every component

/**
 * The character library of one template: { status, characters, byId(id), retry }.
 * niche: what the API is told (niches.js#apiNiche): nothing = AI Fruit Story.
 */
export default function useCharacters(niche) {
  const [state, setState] = useState({ status: "loading", characters: [] });
  const [attempt, setAttempt] = useState(0);
  const key = niche ?? "fruit";

  useEffect(() => {
    let active = true;
    if (!cache.has(key)) cache.set(key, listCharacters({ niche }));
    cache.get(key).then(
      (characters) => { if (active) setState({ status: "ready", characters }); },
      () => { cache.delete(key); if (active) setState({ status: "error", characters: [] }); },
    );
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, key]);

  const byId = useCallback((id) => state.characters.find((c) => c.id === id) ?? null, [state.characters]);
  const retry = useCallback(() => { setState({ status: "loading", characters: [] }); setAttempt((n) => n + 1); }, []);
  return { ...state, byId, retry };
}
