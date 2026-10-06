import { useCallback, useEffect, useState } from "react";
import { listCharacters } from "../api/blockyStoriesApi";

let cache = null; // Promise<Character[]> shared by every component

/** The character library: { status, characters, byId(id), retry }. */
export default function useCharacters() {
  const [state, setState] = useState({ status: "loading", characters: [] });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    if (!cache) cache = listCharacters();
    cache.then(
      (characters) => { if (active) setState({ status: "ready", characters }); },
      () => { cache = null; if (active) setState({ status: "error", characters: [] }); },
    );
    return () => { active = false; };
  }, [attempt]);

  const byId = useCallback((id) => state.characters.find((c) => c.id === id) ?? null, [state.characters]);
  const retry = useCallback(() => { setState({ status: "loading", characters: [] }); setAttempt((n) => n + 1); }, []);
  return { ...state, byId, retry };
}
