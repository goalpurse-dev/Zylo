// Content Machine: files from the private bucket, with a FRESH signed link at the moment of use (owner, 2026-10-19).
// Links made when the page rendered expire (15 min) before the owner clicks: the storage then answers
// {"error":"InvalidJWT","message":"\"exp\" claim timestamp check failed"}. So:
//   DownloadButton  asks the server for a 5-minute link on click, then starts the download (named file)
//   OpenFileButton  the same, opening the file in a new tab (a pasted stats screenshot)
//   FreshImg / FreshVideo  previews: when their link has expired (load error), they fetch a fresh one once
// When the server can't make a link, the button shows the error instead of opening a broken page.
import React, { useState } from "react";
import { freshUrl } from "./cmApi";

function startDownload(url) {
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function DownloadButton({ path, filename, className, children, testid }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const click = async () => {
    setBusy(true); setNote(null);
    try { startDownload(await freshUrl(path, filename)); } catch (e) { setNote(e.message || "The download failed. Try again."); }
    setBusy(false);
  };
  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" onClick={click} disabled={busy || !path} className={`${className} disabled:opacity-50`} data-testid={testid}>{busy ? "Preparing…" : children}</button>
      {note && <span role="alert" className="max-w-[260px] text-[12px] text-red-200">{note}</span>}
    </span>
  );
}

export function OpenFileButton({ path, className, children }) {
  const [note, setNote] = useState(null);
  const click = async () => {
    setNote(null);
    // Open the tab now (a tab opened after waiting for the server is blocked as a pop-up), then point it at the file.
    const tab = window.open("", "_blank");
    try {
      const url = await freshUrl(path);
      if (tab) tab.location.href = url; else window.location.href = url;
    } catch (e) {
      tab?.close();
      setNote(e.message || "Couldn't open the file.");
    }
  };
  return (
    <span className="inline-flex flex-col">
      <button type="button" onClick={click} className={className}>{children}</button>
      {note && <span role="alert" className="text-[12px] text-red-200">{note}</span>}
    </span>
  );
}

/** A preview image whose page-time link may have expired: on a load error, one fresh link is fetched. */
export function FreshImg({ src, path, ...rest }) {
  const [url, setUrl] = useState(src);
  const [tried, setTried] = useState(false);
  const onError = async () => {
    if (tried || !path) return;
    setTried(true);
    try { setUrl(await freshUrl(path)); } catch { /* the broken image stays; nothing to open */ }
  };
  return <img src={url} onError={onError} {...rest} />;
}

export function FreshVideo({ src, path, ...rest }) {
  const [url, setUrl] = useState(src);
  const [tried, setTried] = useState(false);
  const onError = async () => {
    if (tried || !path) return;
    setTried(true);
    try { setUrl(await freshUrl(path)); } catch { /* keep the error state */ }
  };
  return <video src={url} onError={onError} {...rest} />;
}
