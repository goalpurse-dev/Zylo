// Reference videos in the browser (owner 2026-11-26): upload (or paste a link), start the scan, follow it to the
// breakdown. The scan runs on our server (reference-api + a scan machine). Local dev with ?mock=1: a fake scan that
// answers with the three real test breakdowns in content/reference-tests (never part of a production build).
import { supabase } from "./supabaseClient";
import { uploadUserFile } from "./storage";
import { REFERENCE, guessImageRole, referenceLink } from "../../supabase/functions/_shared/reference/breakdown.js";
import { LIVE } from "../../supabase/functions/_shared/liveFeatures.js";

export const REFERENCE_MOCK = Boolean(import.meta.env?.DEV) && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mock") === "1";
/** the reference inputs are shown only once the scanner is live (_shared/liveFeatures.js), or in the localhost mock */
export const REFERENCE_UI = LIVE.referenceScan || REFERENCE_MOCK;
/** reference pictures (plain uploads with a role) need no scanner */
export const REFERENCE_IMAGES_UI = LIVE.referenceImages || REFERENCE_MOCK;

export class ReferenceUploadError extends Error {}

async function call(body) {
  // (the literal import.meta.env.DEV lets a production build drop this branch and the test data with it)
  if (import.meta.env.DEV && REFERENCE_MOCK) { const m = await import("./referenceMock.dev.js"); return m.mockReference(body); }
  const { data, error } = await supabase.functions.invoke("reference-api", { body });
  if (error) {
    let message = "The scanner didn't answer. Try again in a minute.";
    try { const j = await error.context.json(); if (j?.error) message = j.error; } catch { /* no body */ }
    throw new ReferenceUploadError(message);
  }
  return data;
}

/** sha256 of a file (the server reuses a finished scan of the same file: instant and free) */
export async function fileSha256(file) {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** checks a picked video before uploading: type, size and length (read from the file itself) */
export async function checkVideoFile(file) {
  if (!REFERENCE.videoTypes.includes(file.type) && !/\.(mp4|mov|webm)$/i.test(file.name)) throw new ReferenceUploadError("Use an MP4, MOV or WebM video.");
  if (file.size > REFERENCE.maxVideoBytes) throw new ReferenceUploadError("That video is over 100 MB.");
  const seconds = await new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { resolve(v.duration); URL.revokeObjectURL(v.src); };
    v.onerror = () => resolve(null);
    v.src = URL.createObjectURL(file);
  });
  if (seconds != null && seconds > REFERENCE.maxVideoSec + 1) throw new ReferenceUploadError("Use a video up to 3 minutes long.");
  return { seconds };
}

/** upload + start; returns the scan ({ id, status, pct, label, card, breakdown? }) */
export async function scanVideoFile(file) {
  await checkVideoFile(file);
  if (REFERENCE_MOCK) return (await call({ action: "start", path: `mock/${file.name}` })).scan;
  const [sha256, up] = await Promise.all([fileSha256(file), uploadUserFile(file, { prefix: "references" })]);
  return (await call({ action: "start", path: up.path, sha256 })).scan;
}

/** a pasted public link; returns the scan */
export async function scanVideoLink(raw) {
  const link = referenceLink(raw);
  if (!link) throw new ReferenceUploadError("Paste a public TikTok, YouTube Shorts or Instagram link.");
  return (await call({ action: "start", link: link.url })).scan;
}

export const scanStatus = async (id) => (await call({ action: "status", id })).scan;

/** follows a scan until it is done or failed; onUpdate(scan) on every change */
export function followScan(id, onUpdate, { everyMs = 2000 } = {}) {
  let stop = false;
  (async () => {
    while (!stop) {
      try {
        const s = await scanStatus(id);
        onUpdate(s);
        if (s.status === "done" || s.status === "failed") return;
      } catch { /* keep trying */ }
      await new Promise((r) => setTimeout(r, everyMs));
    }
  })();
  return () => { stop = true; };
}

/** what a picked image looks like to the role guess: its size and whether it has see-through pixels */
export async function imageFacts(file) {
  try {
    const bmp = await createImageBitmap(file);
    const c = document.createElement("canvas");
    c.width = Math.min(64, bmp.width); c.height = Math.min(64, bmp.height);
    const g = c.getContext("2d");
    g.drawImage(bmp, 0, 0, c.width, c.height);
    const px = g.getImageData(0, 0, c.width, c.height).data;
    let clear = 0;
    for (let i = 3; i < px.length; i += 4) if (px[i] < 200) clear++;
    return { width: bmp.width, height: bmp.height, hasAlpha: clear > (px.length / 4) * 0.05, name: file.name };
  } catch { return { name: file.name }; }
}

/** one reference image: uploaded to the user's own folder, its role guessed (the user can change it) */
export async function uploadReferenceImage(file) {
  if (!/^image\//.test(file.type)) throw new ReferenceUploadError("Use an image file.");
  if (file.size > 10 * 1024 * 1024) throw new ReferenceUploadError("Each image up to 10 MB.");
  const [facts, up] = await Promise.all([imageFacts(file), uploadUserFile(file, { prefix: "director" })]);
  return { path: up.path, url: up.signedUrl, name: file.name, role: guessImageRole(facts) };
}
