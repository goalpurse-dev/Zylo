// Shared provider-bound reference URL validation. Keep this dependency-free so
// every Edge Function can run the same gate immediately before an external call.
export type ReferenceErrorCode =
  | "REFERENCE_IMAGE_NOT_ACCESSIBLE"
  | "REFERENCE_IMAGE_EXPIRED"
  | "REFERENCE_IMAGE_FORBIDDEN";

export class ProviderReferenceError extends Error {
  readonly code: ReferenceErrorCode;
  constructor(code: ReferenceErrorCode) {
    super(code);
    this.code = code;
    this.name = "ProviderReferenceError";
  }
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127);
}

function expirySeconds(url: URL): number | null {
  for (const key of ["expires", "Expires", "expiresAt"]) {
    const raw = url.searchParams.get(key);
    if (raw && /^\d+$/.test(raw)) {
      const value = Number(raw);
      return value > 10_000_000_000 ? Math.floor(value / 1000) : value;
    }
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

export function redactUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return "[malformed-url]";
  }
}

export function assertProviderAccessibleImageUrl(value: string): string {
  let url: URL;
  try { url = new URL(String(value || "")); } catch { throw new ProviderReferenceError("REFERENCE_IMAGE_NOT_ACCESSIBLE"); }
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (url.protocol !== "https:" || !hostname || hostname === "localhost" || hostname.endsWith(".localhost") ||
      isPrivateIpv4(hostname) || hostname === "::1" || hostname.startsWith("fc") || hostname.startsWith("fd") || hostname.startsWith("fe80:")) {
    throw new ProviderReferenceError("REFERENCE_IMAGE_NOT_ACCESSIBLE");
  }
  const expiresAt = expirySeconds(url);
  if (expiresAt !== null && expiresAt <= Math.floor(Date.now() / 1000)) {
    throw new ProviderReferenceError("REFERENCE_IMAGE_EXPIRED");
  }
  return url.toString();
}

const REFERENCE_KEYS = new Set([
  "referenceimage", "referenceimages", "refimage", "refimages", "initimageurl", "initimageurls",
  "imageurl", "imageurls", "firstframe", "lastframe", "startimage", "endimage", "frameimages",
  "productcutouturl", "avatarurl", "inputimage", "refs",
]);

export const GENERATION_REFERENCE_BUCKET = "generation-references";
export const PROVIDER_REFERENCE_TTL_SECONDS = 2 * 60 * 60;

type StorageSigner = {
  storage: {
    from: (bucket: string) => {
      createSignedUrl: (path: string, expiresIn: number) => Promise<{
        data: { signedUrl?: string } | null;
        error: { message?: string } | null;
      }>;
    };
  };
};

function parseStorageReference(value: string): { bucket: string; path: string } | null {
  const match = /^storage:\/\/([^/]+)\/(.+)$/i.exec(value.trim());
  if (!match) return null;
  try {
    return { bucket: decodeURIComponent(match[1]), path: decodeURIComponent(match[2]) };
  } catch {
    throw new ProviderReferenceError("REFERENCE_IMAGE_NOT_ACCESSIBLE");
  }
}

/**
 * Resolve private storage references immediately before provider dispatch.
 * The returned signed URLs must never be written back to jobs/generation_queue.
 */
export async function materializeReferencePayload<T>(
  sb: StorageSigner,
  value: T,
  expectedUserId: string,
): Promise<{ value: T; references: string[] }> {
  const references: string[] = [];

  async function visit(node: unknown, key = "", insideReference = false): Promise<unknown> {
    const normalizedKey = key.replace(/[-_]/g, "").toLowerCase();
    const isReference = insideReference || REFERENCE_KEYS.has(normalizedKey);
    if (typeof node === "string" && isReference) {
      const storageRef = parseStorageReference(node);
      if (!storageRef) {
        const url = assertProviderAccessibleImageUrl(node);
        references.push(url);
        return url;
      }
      const firstFolder = storageRef.path.split("/")[0];
      if (storageRef.bucket !== GENERATION_REFERENCE_BUCKET || firstFolder !== expectedUserId) {
        throw new ProviderReferenceError("REFERENCE_IMAGE_FORBIDDEN");
      }
      const { data, error } = await sb.storage
        .from(storageRef.bucket)
        .createSignedUrl(storageRef.path, PROVIDER_REFERENCE_TTL_SECONDS);
      if (error || !data?.signedUrl) throw new ProviderReferenceError("REFERENCE_IMAGE_NOT_ACCESSIBLE");
      const signedUrl = assertProviderAccessibleImageUrl(data.signedUrl);
      references.push(signedUrl);
      return signedUrl;
    }
    if (Array.isArray(node)) return Promise.all(node.map((item) => visit(item, key, isReference)));
    if (node && typeof node === "object") {
      const copy: Record<string, unknown> = {};
      for (const [childKey, child] of Object.entries(node as Record<string, unknown>)) {
        copy[childKey] = await visit(child, childKey, isReference);
      }
      return copy;
    }
    return node;
  }

  return { value: await visit(value) as T, references };
}

export function validateReferencePayload(value: unknown): string[] {
  const found: string[] = [];
  function visit(node: unknown, key = "", insideReference = false): void {
    const normalizedKey = key.replace(/[-_]/g, "").toLowerCase();
    const isReference = insideReference || REFERENCE_KEYS.has(normalizedKey);
    if (typeof node === "string" && isReference) {
      found.push(assertProviderAccessibleImageUrl(node));
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) visit(item, key, isReference);
      return;
    }
    if (node && typeof node === "object") {
      for (const [childKey, child] of Object.entries(node as Record<string, unknown>)) visit(child, childKey, isReference);
    }
  }
  visit(value);
  return found;
}

export function friendlyReferenceMessage(code: ReferenceErrorCode): string {
  if (code === "REFERENCE_IMAGE_FORBIDDEN") return "This reference image doesn't belong to this account.";
  return code === "REFERENCE_IMAGE_EXPIRED"
    ? "This reference image is no longer available. Please select it again."
    : "This reference image isn't accessible. Please select it again.";
}
