import { supabase } from "../supabaseClient";

/**
 * Converts blob: URLs to public Supabase URLs
 */
export async function uploadBlobRefsToPublicUrls(
  blobUrls: string[]
): Promise<string[]> {
  const uploaded: string[] = [];

  for (const blobUrl of blobUrls) {
    // fetch blob
    const res = await fetch(blobUrl);
    const blob = await res.blob();

    const ext = blob.type.split("/")[1] || "png";
    const fileName = `ref-${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage
      .from("reference-images")
      .upload(fileName, blob, {
        contentType: blob.type,
        upsert: false,
      });

    if (error) {
      console.error("Ref upload failed:", error);
      continue;
    }

    const { data } = supabase.storage
      .from("reference-images")
      .getPublicUrl(fileName);

    if (data?.publicUrl) {
      uploaded.push(data.publicUrl);
    }
  }

  return uploaded;
}
