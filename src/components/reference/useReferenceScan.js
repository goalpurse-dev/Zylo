import { useEffect, useRef, useState } from "react";
import { defaultCopy } from "../../../supabase/functions/_shared/reference/breakdown.js";
import { ReferenceUploadError, followScan, scanVideoFile, scanVideoLink } from "../../lib/references";
import { trackCreate } from "../create/useCatalog";

/** one reference video's scan: start from a file or a link, follow it, the breakdown card's copy toggles */
export function useReferenceScan(placement = "create") {
  const [scan, setScan] = useState(null); // { id, status, pct, label, card, error }
  const [error, setError] = useState(null);
  const [copy, setCopy] = useState(defaultCopy);
  const stop = useRef(null);
  useEffect(() => () => stop.current?.(), []);
  const follow = (s) => {
    setScan(s);
    stop.current?.();
    if (s.status === "done" || s.status === "failed") return;
    stop.current = followScan(s.id, setScan);
  };
  const run = async (fn) => {
    setError(null);
    setScan({ id: null, status: "uploading", pct: 2, label: "Uploading your video" });
    try { follow(await fn()); trackCreate("reference_scan_started", { placement }); }
    catch (e) { setScan(null); setError(e instanceof ReferenceUploadError ? e.message : "That didn't upload. Try again."); }
  };
  return {
    scan, error, copy, setCopy,
    fromFile: (file) => run(() => scanVideoFile(file)),
    fromLink: (url) => run(() => scanVideoLink(url)),
    clear: () => { stop.current?.(); setScan(null); setError(null); setCopy(defaultCopy()); },
    ready: scan?.status === "done" ? { id: scan.id, copy } : null,
  };
}

