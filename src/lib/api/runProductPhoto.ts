// src/lib/api/runProductPhoto.ts
import { supabase } from "../supabaseClient";
import { publishToPublic, uploadUserFile } from "../storage";
import { simulateJob, type JobRow } from "../jobs";

export type ProductPhotoKind = "catalog" | "macro" | "lifestyle" | "other";

type RefInput = string | File | { url: string; weight?: number };

async function toHttpsUrl(ref: RefInput): Promise<{ url: string; weight?: number }> {
  // Already structured
  if (typeof ref === "object" && !(ref instanceof File) && "url" in ref) {
    // must be https or data:; the Edge Fn will re-check
    return { url: String(ref.url), weight: ref.weight };
  }

  // Plain string
  if (typeof ref === "string") {
    // If already https or data URI, pass through
    if (/^https:\/\//i.test(ref) || /^data:image\//i.test(ref)) {
      return { url: ref };
    }
    // Local paths (vite /public) become http://localhost in dev -> upload so we get https
    const res = await fetch(ref).catch(() => null);
    if (!res?.ok) throw new Error(`Failed to fetch ref: ${ref}`);
    const blob = await res.blob();
    const fakeFile = new File([blob], `ref-${crypto.randomUUID()}.jpg`, { type: blob.type || "image/jpeg" });
    const up = await uploadUserFile(fakeFile, { prefix: "ti-refs" });
    const pub = await publishToPublic(up.path);
    return { url: pub.publicUrl };
  }

  // File
  const up = await uploadUserFile(ref, { prefix: "ti-refs" });
  const pub = await publishToPublic(up.path);
  return { url: pub.publicUrl };
}

export async function runProductPhoto({
  brandId,
  userId,
  productId,            // optional (when “use brand product” flow is on)
  kind,
  prompt,
  negative_prompt,
  seed,
  width = 1024,
  height = 1024,
  // Accept files or strings coming from your picker
  refs = [],
}: {
  brandId: string;
  userId: string;
  productId?: string;
  kind: ProductPhotoKind;
  prompt: string;
  negative_prompt?: string;
  seed?: number;
  width?: number;
  height?: number;
  refs?: RefInput[];
}): Promise<JobRow> {
  // Normalize refs to public https/data URIs (cap 4)
  const norm = await Promise.all(refs.slice(0, 4).map(toHttpsUrl));
  if (norm.length === 0) {
    throw new Error("This model requires at least one reference image.");
  }

  // Build settings so the worker knows to route this to product-photo Edge Fn
  const settings = {
    tier: "zylo-v4",
    size: `${width}x${height}`,
    price: 0,
    provider_hint: {
      engine: "runware" as const,
      mode: "product" as const,
      edgeFn: "/functions/v1/runware-product-photo",
      airTag: "bfl:4@1",
      settings: {},
    },
  };

  const input = {
    tool: "image" as const,
    brandId,
    userId,
    productId: productId ?? null,
    kind,
    prompt,
    negative_prompt: negative_prompt ?? "",
    seed: seed ?? null,
    width,
    height,
    refs: norm,
  };

  // enqueue job so you see it in `jobs`
  const preview = `${prompt} • product ${width}x${height}`;
  return await simulateJob({
    type: "image",
    project_id: null,
    prompt: preview,
    settings,
    input,
  });
}
