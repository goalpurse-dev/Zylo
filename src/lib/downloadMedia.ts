export type SaveMediaResult = {
  method: "share" | "download" | "opened" | "cancelled";
};

const EXTENSION_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};
const MIME_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export function mediaMimeType(filename: string, receivedType?: string): string {
  const cleanType = String(receivedType ?? "").split(";")[0].trim().toLowerCase();
  if (/^(image|video)\//.test(cleanType)) return cleanType;
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_MIME[extension] ?? "application/octet-stream";
}

export function isMobileSaveEnvironment(): boolean {
  if (typeof navigator === "undefined") return false;
  const userAgent = navigator.userAgent ?? "";
  const touchMac = /Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent) || touchMac ||
    (typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches);
}

function safeFilename(filename: string): string {
  return filename.replace(/[\\/:*?"<>|]+/g, "-").replace(/^\.+/, "").slice(0, 160) || "zyvo-media";
}

function filenameForMime(filename: string, type: string): string {
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  if (EXTENSION_MIME[extension] === type || !MIME_EXTENSION[type]) return filename;
  const base = extension && filename.includes(".") ? filename.slice(0, -(extension.length + 1)) : filename;
  return `${base}.${MIME_EXTENSION[type]}`;
}

async function fetchMedia(url: string, proxyUrl?: string): Promise<Blob> {
  const fetchBlob = async (target: string, init?: RequestInit) => {
    const response = await fetch(target, init);
    if (!response.ok) throw new Error(`MEDIA_DOWNLOAD_FAILED_${response.status}`);
    const blob = await response.blob();
    if (!blob.size) throw new Error("MEDIA_DOWNLOAD_EMPTY");
    return blob;
  };

  try {
    return await fetchBlob(url, { mode: "cors", credentials: "omit" });
  } catch (directError) {
    if (!proxyUrl) throw directError;
    const { supabase } = await import("./supabaseClient");
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) throw directError;
    return fetchBlob(proxyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
        "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ url }),
    });
  }
}

function triggerAnchorDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking synchronously breaks larger downloads in Safari.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

function openMediaFallback(url: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function saveMediaToDevice(options: {
  url: string;
  filename: string;
  title?: string;
  proxyUrl?: string;
  preferShare?: boolean;
}): Promise<SaveMediaResult> {
  let filename = safeFilename(options.filename);
  const configuredProxy = import.meta.env.VITE_SUPABASE_URL
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/video-proxy`
    : undefined;
  let blob: Blob;
  try {
    blob = await fetchMedia(options.url, options.proxyUrl ?? configuredProxy);
  } catch {
    openMediaFallback(options.url);
    return { method: "opened" };
  }
  const type = mediaMimeType(filename, blob.type);
  filename = filenameForMime(filename, type);
  const typedBlob = blob.type === type ? blob : new Blob([blob], { type });
  const file = new File([typedBlob], filename, { type, lastModified: Date.now() });
  const shouldShare = options.preferShare ?? isMobileSaveEnvironment();

  if (shouldShare && typeof navigator !== "undefined" && typeof navigator.share === "function") {
    const shareData: ShareData = { files: [file], title: options.title ?? filename };
    let canShareFiles = typeof navigator.canShare !== "function";
    try { canShareFiles = canShareFiles || navigator.canShare(shareData); } catch { canShareFiles = false; }
    if (canShareFiles) {
      try {
        await navigator.share(shareData);
        return { method: "share" };
      } catch (error) {
        if ((error as DOMException)?.name === "AbortError") return { method: "cancelled" };
        // Continue to a regular download when file sharing is unsupported or fails.
      }
    }
  }

  triggerAnchorDownload(typedBlob, filename);
  return { method: "download" };
}

export async function shareMediaFile(options: {
  url: string;
  filename: string;
  title?: string;
  proxyUrl?: string;
}): Promise<SaveMediaResult> {
  return saveMediaToDevice({ ...options, preferShare: true });
}
