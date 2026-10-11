import { supabase } from "./supabaseClient";

// Images saved by an account on the free plan carry a small "Made with Zyvo AI"
// mark in the bottom-right corner. Paid plans save without it (the Pricing page
// says so: "Watermark-free exports" on the paid plans only).
//
// The mark is drawn when the image is saved or shared (lib/downloadMedia.ts),
// so the file on the visitor's device has it. The stored original has no mark.
export const FREE_MARK_TEXT = "Made with Zyvo AI";

const TTL_MS = 60_000; // an upgrade made in this tab is picked up within a minute
let cached = { at: 0, userId: null, free: false };

/** True when a signed-in account is on the free plan (profiles.plan_code, what every server gate reads). */
export async function isFreePlanAccount() {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id ?? null;
  if (!userId) return false;
  if (cached.userId === userId && Date.now() - cached.at < TTL_MS) return cached.free;
  const { data: profile, error } = await supabase.from("profiles").select("plan_code").eq("id", userId).maybeSingle();
  if (error) return cached.userId === userId ? cached.free : false; // never mark a paying account because a lookup failed
  const free = String(profile?.plan_code || "free").toLowerCase().trim() === "free";
  cached = { at: Date.now(), userId, free };
  return free;
}

/** Where and how big the mark is for an image of this size: one place, so the preview and the file agree. */
export function freeMarkLayout(width, height) {
  const fontSize = Math.round(Math.min(56, Math.max(12, width * 0.016)));
  const padX = Math.round(fontSize * 0.75);
  const padY = Math.round(fontSize * 0.42);
  const margin = Math.round(Math.max(8, Math.min(width, height) * 0.02));
  return { fontSize, padX, padY, margin, radius: Math.round(fontSize * 0.6) };
}

/** The same image with the mark drawn in its bottom-right corner. The original blob comes back if drawing is not possible. */
export async function addFreeMark(blob) {
  if (typeof document === "undefined" || !/^image\/(png|jpeg|webp)$/.test(blob.type)) return blob;
  let bitmap;
  try { bitmap = await createImageBitmap(blob); } catch { return blob; }
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return blob;
  ctx.drawImage(bitmap, 0, 0);
  const { fontSize, padX, padY, margin, radius } = freeMarkLayout(canvas.width, canvas.height);
  ctx.font = `600 ${fontSize}px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
  ctx.textBaseline = "middle";
  const boxWidth = Math.ceil(ctx.measureText(FREE_MARK_TEXT).width) + padX * 2;
  const boxHeight = fontSize + padY * 2;
  const x = canvas.width - margin - boxWidth;
  const y = canvas.height - margin - boxHeight;
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, boxWidth, boxHeight, radius); else ctx.rect(x, y, boxWidth, boxHeight);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
  ctx.fillText(FREE_MARK_TEXT, x + padX, y + boxHeight / 2 + 1);
  const marked = await new Promise((resolve) => canvas.toBlob(resolve, blob.type, 0.92));
  return marked ?? blob;
}

/** For lib/downloadMedia.ts: marks an image when the account is on the free plan, otherwise returns it untouched. */
export async function markForFreePlan(blob) {
  if (!/^image\//.test(blob.type)) return blob;
  try { return (await isFreePlanAccount()) ? await addFreeMark(blob) : blob; } catch { return blob; }
}
