import { ensureUploadedReference } from "../referenceImages";

/**
 * Converts blob: URLs to public Supabase URLs
 */
export async function uploadBlobRefsToPublicUrls(
  blobUrls: string[]
): Promise<string[]> {
  const uploaded = await Promise.all(
    blobUrls.map((value, index) => ensureUploadedReference(value, { index })),
  );
  return uploaded.map((item) => item.url);
}
