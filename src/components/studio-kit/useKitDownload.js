// The free kit download (signed-in users only, each download counted by /account/kit): one hook for the MCP template
// page. A guest gets the sign-up modal first (needSignUp), then comes back to the same page.
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { CONNECTOR_MOCK, connector } from "../../lib/zyvoConnector";

export function useKitDownload() {
  const { user } = useAuth() ?? {};
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [needSignUp, setNeedSignUp] = useState(false);
  const download = async () => {
    if (!CONNECTOR_MOCK && !user) { setNeedSignUp(true); return; }
    setBusy(true); setNotice(null);
    try {
      const r = await connector("/account/kit", { method: "POST" });
      if (CONNECTOR_MOCK) setNotice(`Test mode: the real button downloads ${r.fileName}.`);
      else window.location.assign(r.url);
    } catch (e) { setNotice(e.message); }
    finally { setBusy(false); }
  };
  return { download, busy, notice, needSignUp, closeSignUp: () => setNeedSignUp(false) };
}
