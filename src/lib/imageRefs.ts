// src/lib/imageRefs.ts
import { uploadForExternalFetch } from "./storage";

export async function filesToRefUrls(files: File[], brandId: string) {
  const capped = files.slice(0, 4);
  const urls: string[] = [];
  for (const f of capped) {
    const up = await uploadForExternalFetch(
      f,
      { projectId: brandId, prefix: "product-refs" },
      true
    );
    urls.push(up.url); // public if published; otherwise signed
  }
  // Edge function accepts {url, weight?}
  return urls.map((u) => ({ url: u }));
}
