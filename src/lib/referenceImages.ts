import { supabase } from "./supabaseClient";
import { normalizeReferencePayloadWith } from "./referencePayload";

export const REFERENCE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const REFERENCE_URL_MIN_LIFETIME_SECONDS = 24 * 60 * 60;
export const REFERENCE_IMAGE_BUCKET = "generation-references";

export type ReferenceInput = File | Blob | string;
export type UploadedReference = {
  /** A durable storage reference. It is intentionally not a public/signed URL. */
  url: string;
  storagePath?: string;
  originalName?: string;
};

export class ReferenceImageError extends Error {
  readonly code: "REFERENCE_UPLOAD_FAILED" | "REFERENCE_IMAGE_NOT_ACCESSIBLE" | "REFERENCE_IMAGE_EXPIRED";
  constructor(
    code: "REFERENCE_UPLOAD_FAILED" | "REFERENCE_IMAGE_NOT_ACCESSIBLE" | "REFERENCE_IMAGE_EXPIRED",
    message?: string,
  ) {
    super(message ?? (
      code === "REFERENCE_UPLOAD_FAILED"
        ? "We couldn't upload your reference image. Please try uploading it again."
        : code === "REFERENCE_IMAGE_EXPIRED"
          ? "This reference image is no longer available. Please select it again."
          : "This reference image isn't accessible. Please select it again."
    ));
    this.code = code;
    this.name = "ReferenceImageError";
  }
}

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function expirySeconds(url: URL): number | null {
  for (const key of ["expires", "Expires", "expiresAt", "X-Amz-Expires"]) {
    const raw = url.searchParams.get(key);
    if (!raw || !/^\d+$/.test(raw)) continue;
    const value = Number(raw);
    if (key === "X-Amz-Expires") {
      const date = url.searchParams.get("X-Amz-Date");
      if (date && /^\d{8}T\d{6}Z$/.test(date)) {
        const started = Date.UTC(+date.slice(0, 4), +date.slice(4, 6) - 1, +date.slice(6, 8), +date.slice(9, 11), +date.slice(11, 13), +date.slice(13, 15));
        return Math.floor(started / 1000) + value;
      }
      continue;
    }
    return value > 10_000_000_000 ? Math.floor(value / 1000) : value;
  }
  const token = url.searchParams.get("token");
  if (token) {
    try {
      const encoded = token.split(".")[1];
      if (!encoded) return null;
      const payload = encoded.replace(/-/g, "+").replace(/_/g, "/");
      const parsed = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, "=")));
      if (Number.isFinite(Number(parsed.exp))) return Number(parsed.exp);
    } catch { /* malformed/non-JWT token */ }
  }
  return null;
}

export function assertLongLivedHttpsReference(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new ReferenceImageError("REFERENCE_IMAGE_NOT_ACCESSIBLE"); }
  if (url.protocol !== "https:") throw new ReferenceImageError("REFERENCE_IMAGE_NOT_ACCESSIBLE");
  const expiresAt = expirySeconds(url);
  if (expiresAt !== null && expiresAt - Math.floor(Date.now() / 1000) < REFERENCE_URL_MIN_LIFETIME_SECONDS) {
    throw new ReferenceImageError("REFERENCE_IMAGE_EXPIRED");
  }
  return url.toString();
}

function sniffImageType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes.slice(0, 8).every((v, i) => v === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][i])) return "image/png";
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

async function inputToBlob(input: ReferenceInput): Promise<{ blob: Blob; originalName?: string }> {
  if (typeof input !== "string") return { blob: input, originalName: input instanceof File ? input.name : undefined };
  if (input.startsWith("file:")) throw new ReferenceImageError("REFERENCE_IMAGE_NOT_ACCESSIBLE");
  if (input.startsWith("data:") && !/^data:image\/(?:jpeg|png|webp);base64,/i.test(input)) {
    throw new ReferenceImageError("REFERENCE_IMAGE_NOT_ACCESSIBLE");
  }
  try {
    const response = await fetch(input);
    if (!response.ok) throw new Error("unreadable local reference");
    return { blob: await response.blob() };
  } catch {
    throw new ReferenceImageError("REFERENCE_UPLOAD_FAILED");
  }
}

export async function ensureUploadedReference(
  input: ReferenceInput,
  options: { userId?: string; jobId?: string; index?: number } = {},
): Promise<UploadedReference> {
  if (typeof input === "string" && /^https:\/\//i.test(input)) {
    try {
      return { url: assertLongLivedHttpsReference(input) };
    } catch (error) {
      if (!(error instanceof ReferenceImageError) || error.code !== "REFERENCE_IMAGE_EXPIRED") throw error;
      const expiresAt = expirySeconds(new URL(input));
      if (expiresAt !== null && expiresAt <= Math.floor(Date.now() / 1000)) throw error;
      // Still fetchable but too short-lived for queue + retries: copy it into
      // generation-reference storage to give the provider a stable URL.
    }
  }

  const { blob, originalName } = await inputToBlob(input);
  if (blob.size <= 0 || blob.size > REFERENCE_IMAGE_MAX_BYTES) throw new ReferenceImageError("REFERENCE_UPLOAD_FAILED");
  const bytes = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  const mime = sniffImageType(bytes);
  if (!mime) throw new ReferenceImageError("REFERENCE_UPLOAD_FAILED");

  const userId = options.userId ?? (await supabase.auth.getUser()).data.user?.id;
  if (!userId) throw new ReferenceImageError("REFERENCE_UPLOAD_FAILED");
  const jobId = options.jobId ?? crypto.randomUUID();
  const path = `${userId}/${jobId}/${crypto.randomUUID()}.${MIME_EXTENSIONS[mime]}`;

  console.info("reference_upload_started", { userId, jobId, index: options.index });
  const { error } = await supabase.storage.from(REFERENCE_IMAGE_BUCKET).upload(path, blob, {
    contentType: mime,
    cacheControl: "86400",
    upsert: false,
  });
  if (error) {
    console.warn("reference_upload_failed", { userId, jobId, index: options.index, code: error.name });
    throw new ReferenceImageError("REFERENCE_UPLOAD_FAILED");
  }
  console.info("reference_upload_completed", { userId, jobId, index: options.index, storagePath: path });
  return {
    url: `storage://${REFERENCE_IMAGE_BUCKET}/${path}`,
    storagePath: path,
    originalName,
  };
}

export async function normalizeReferencePayload<T>(
  value: T,
  options: { userId: string; jobId: string },
): Promise<{ value: T; uploads: UploadedReference[] }> {
  return normalizeReferencePayloadWith(value, (input, index) =>
    ensureUploadedReference(input, { ...options, index })
  );
}

export async function cleanupUploadedReferences(uploads: UploadedReference[]): Promise<void> {
  const paths = uploads.flatMap((item) => item.storagePath ? [item.storagePath] : []);
  if (paths.length) await supabase.storage.from(REFERENCE_IMAGE_BUCKET).remove(paths);
}

export function referenceErrorMessage(code: string): string {
  if (code === "REFERENCE_UPLOAD_FAILED") return "We couldn't upload your reference image. Please try uploading it again.";
  if (code === "REFERENCE_IMAGE_EXPIRED") return "This reference image is no longer available. Please select it again.";
  if (code === "PROVIDER_SAFETY_REJECTION") return "The provider couldn't generate this request because of its safety rules. Try changing the prompt or image.";
  return "This reference image isn't accessible. Please select it again.";
}
