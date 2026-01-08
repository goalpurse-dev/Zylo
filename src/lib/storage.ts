// src/lib/storage.ts
import { supabase } from "./supabaseClient";

/** Buckets:
 *  - user-assets: private (RLS on). Users read/write only their own folder.
 *  - public-assets: public reads allowed. Auth users can write to their own subfolder.
 */
export const BUCKET_USER = "user-assets";
export const BUCKET_PUBLIC = "public-assets";

/* ------------------------ small helpers ------------------------ */
function uid() {
  // Browser-safe UUID
  // @ts-ignore
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}
function cleanName(name: string) {
  return name.trim().replace(/\s+/g, "-").toLowerCase();
}
async function requireUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Must be signed in");
  return data.user.id;
}

/* --------------------------- types ----------------------------- */
export type UploadOpts = {
  projectId?: string; // optionally nest under a project
  prefix?: string;    // defaults to "uploads"
};

/* ------------------------ main functions ----------------------- */

/** Upload a file to the private user bucket.
 * Returns the storage path and a signed URL suitable for immediate external fetch.
 * Default TTL is 1 hour (3600s); tweak if you want longer/shorter.
 */
export async function uploadUserFile(file: File, opts: UploadOpts = {}) {
  const userId = await requireUserId();
  const prefix = opts.prefix ?? "uploads";

  const base = [userId, opts.projectId ? `projects/${opts.projectId}` : null, prefix]
    .filter(Boolean)
    .join("/");

  const filename = `${uid()}-${cleanName(file.name)}`;
  const path = `${base}/${filename}`;

  const { error } = await supabase.storage
    .from(BUCKET_USER)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "application/octet-stream",
    });

  if (error) throw error;

  // Signed URL (1h). Increase if your jobs might queue longer.
  const signed = await getSignedUrl(path, 3600);
  return { path, signedUrl: signed };
}

/** Create a signed URL to a file in the private bucket. */
export async function getSignedUrl(path: string, expiresInSec = 3600) {
  const { data, error } = await supabase.storage
    .from(BUCKET_USER)
    .createSignedUrl(path, expiresInSec);
  if (error) throw error;
  return data.signedUrl;
}

/** Delete a file in the private bucket. */
export async function deleteUserFile(path: string) {
  const { error } = await supabase.storage.from(BUCKET_USER).remove([path]);
  if (error) throw error;
}

/** List files under the current user's prefix. */
export async function listUserFiles(prefix = "", limit = 100, offset = 0) {
  const userId = await requireUserId();
  const base = [userId, prefix].filter(Boolean).join("/");

  const { data, error } = await supabase.storage.from(BUCKET_USER).list(base, {
    limit,
    offset,
    sortBy: { column: "updated_at", order: "desc" },
  });
  if (error) throw error;

  return (data || []).map((obj) => ({
    ...obj,
    path: `${base}/${obj.name}`,
  }));
}

/** Copy a private file into the public bucket under a user-scoped path.
 * Requires Storage RLS policies that allow:
 *  - public read on `public-assets`
 *  - authenticated insert/update under `published/<uid>/...`
 */
export async function publishToPublic(pathInUserBucket: string) {
  // Download private object (browser returns a Blob here)
  const { data, error } = await supabase.storage
    .from(BUCKET_USER)
    .download(pathInUserBucket);
  if (error) throw error;

  const blob: Blob = data as Blob;

  const userId = await requireUserId();
  const name = pathInUserBucket.split("/").pop()!;
  const publicPath = `published/${userId}/${name}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET_PUBLIC)
    .upload(publicPath, blob, {
      upsert: true,
      contentType: (blob as any).type || "application/octet-stream",
      cacheControl: "3600",
    });
  if (upErr) throw upErr;

  const { data: pub } = supabase.storage
    .from(BUCKET_PUBLIC)
    .getPublicUrl(publicPath);

  return { publicPath, publicUrl: pub.publicUrl };
}

/* -------------------- convenience (optional) ------------------- */
/** Upload then return a URL safe for third-party fetch.
 * - If `tryPublic` is true, we attempt to copy to `public-assets` and return the public URL.
 * - If publishing fails (RLS), we fall back to a 1h signed URL.
 */
export async function uploadForExternalFetch(
  file: File,
  opts: UploadOpts = {},
  tryPublic = false,
) {
  const up = await uploadUserFile(file, opts);
  if (!tryPublic) return { url: up.signedUrl, wasPublic: false, path: up.path };

  try {
    const pub = await publishToPublic(up.path);
    return { url: pub.publicUrl, wasPublic: true, path: up.path, publicPath: pub.publicPath };
  } catch {
    // Fall back to signed URL if publishing is blocked by RLS
    return { url: up.signedUrl, wasPublic: false, path: up.path };
  }
}

export const isStoragePath = (s?: string) => !!s && !/^https?:\/\//i.test(s);

export async function signProductsUrl(path: string, expiresInSec = 3600) {
  const { data, error } = await supabase
    .storage.from("products")
    .createSignedUrl(path, expiresInSec);
  if (error) return null;
  return data?.signedUrl ?? null;
}

// convenient helper for product rows
export async function getProductRenderUrl(p: { thumb?: string|null; image_url?: string|null }) {
  const pathOrUrl = p.thumb || p.image_url || null;
  if (!pathOrUrl) return null;
  return isStoragePath(pathOrUrl) ? await signProductsUrl(pathOrUrl) : pathOrUrl;
}