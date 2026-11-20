// "loading" | "open" | "closed": may this visitor see the Studio Kit / MCP bits? (the public flag, or the server says
// yes; cached per user for the browser session). Its own small file so the sidebar and the phone menu can use it.
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { CONNECTOR_MOCK, studioOpenFor } from "../../lib/zyvoConnector";
import { STUDIO_KIT_PUBLIC } from "../../data/studioKit";

export function useStudioOpen() {
  const { user, loading } = useAuth() ?? {};
  const [state, setState] = useState(STUDIO_KIT_PUBLIC || CONNECTOR_MOCK ? "open" : "loading");
  useEffect(() => {
    if (STUDIO_KIT_PUBLIC || CONNECTOR_MOCK) return undefined;
    if (loading) return undefined;
    let on = true;
    studioOpenFor(user?.id ?? "guest").then((open) => { if (on) setState(open ? "open" : "closed"); });
    return () => { on = false; };
  }, [user?.id, loading]);
  return state;
}
