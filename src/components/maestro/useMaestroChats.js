import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { MAESTRO_MOCK, listChats } from "../../lib/maestro";

// the user's recent Maestro chats, shared by the side menu and the Maestro page (one load, refreshed on demand)
let cache = null;
const listeners = new Set();
async function load() {
  try { cache = (await listChats()).chats ?? []; } catch { cache = cache ?? []; }
  listeners.forEach((l) => l(cache));
}
/** call after a chat is created or deleted */
export function refreshMaestroChats() { load(); }

export function useMaestroChats(limit = 5) {
  const { user } = useAuth() ?? {};
  const [chats, setChats] = useState(cache ?? []);
  useEffect(() => {
    if (!user && !MAESTRO_MOCK) { setChats([]); return undefined; }
    listeners.add(setChats);
    if (!cache) load();
    return () => listeners.delete(setChats);
  }, [user]);
  return chats.slice(0, limit);
}
