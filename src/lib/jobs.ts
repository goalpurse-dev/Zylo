import { supabase } from "./supabaseClient";
import {
  TIER_TO_QUALITY,
  creditsForImage,
  creditsForTextToVideoFixed,
} from "./pricing";
import { uploadUserFile, publishToPublic } from "./storage";
import { getProviderLink, type ToolKey } from "./providers";
import { enhancePrompt } from "./promptEnhancer";
import { CREATION_TYPES } from "./creations";

/* ======================= Types ======================= */

export type JobType =
  | "video"
  | "reddit-video"
  | "image"
  | "thumbnail"
  | "logo"
  | "irl"
  | "upscaler";

export type JobStatus =
  | "queued"
  | "running"
  | "processing"
  | "succeeded"
  | "failed"
  | "canceled";

export interface CreateJobInput {
  id?: string;
  type: JobType;
  project_id?: string | null;
  prompt?: string | null;
  settings?: Record<string, any> | null;
  input?: Record<string, any> | null;
}

export interface JobRow {
  id: string;
  user_id: string;
  project_id: string | null;
  type: JobType;
  status: JobStatus;
  prompt: string | null;
  settings: Record<string, any> | null;
  input: Record<string, any> | null;
  output?: Record<string, any> | null;
  result_url?: string | null;
  error?: string | null;
  progress: number | null;
  created_at: string;
  updated_at: string;
}

export const STOP_STATUSES: JobStatus[] = [
  "succeeded",
  "failed",
  "canceled",
];

export const isDone = (s?: JobStatus | null) =>
  s ? STOP_STATUSES.includes(s) : false;

/* ======================= UI caps ======================= */

export type TierId = "zylo-v1" | "zylo-v2" | "zylo-v3" | "zylo-v4";

export const T2V_UI_BY_TIER: Record<
  TierId,
  { durations: number[]; needsImage: boolean }
> = {
  "zylo-v1": {
    durations: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    needsImage: false,
  },
  "zylo-v2": {
    durations: [5, 10],
    needsImage: false,
  },
  "zylo-v3": {
    durations: [5, 10],
    needsImage: false,
  },
  "zylo-v4": {
    durations: [8],
    needsImage: false,
  },
};

/* ======================= IMAGE tool ======================= */

export interface ImageInput {
  tool: "image";
  subject: string;
  style?: string | null;
  mood?: string | null;
  extras?: string | null;
  output_goal?: string | null;
  composition?: string | null;
  color_theme?: string | null;
  ref_images?: string[];
  negative?: string | null;
  brand?: { id: string | null; use_palette: boolean } | null;
  seed?: number | null;
  init_image_url?: string | null;
  // tagging for library routing
  creation_type?: string | null;
}

export interface ImageSettings {
  tier: TierId;
  size: string;
  price: number;
  provider_hint?: {
    engine: "runware";
    mode: "t2i" | "upscale" | "product";
    edgeFn: string;
    airTag: string;
    settings?: Record<string, any>;
  };
  // tagging for library routing
  creation_type?: string | null;
}

export const DEFAULT_NEGATIVE_IMAGE =
  "text, letters, watermark, logo, caption, blurry, low-res, oversharpen, artifact";

export function buildImagePreviewPrompt(i: ImageInput): string {
  const parts: string[] = [];
  if (i.subject) parts.push(i.subject);
  if (i.style) parts.push(`${i.style} style`);
  if (i.mood) parts.push(i.mood);
  if (i.extras) parts.push(i.extras);
  parts.push("clean composition, sharp focus, high detail");
  return parts.join(", ");
}

/* ======================= CRUD ======================= */

export async function createJob(
  payload: CreateJobInput,
): Promise<JobRow> {
  const { data: userData, error: uerr } = await supabase.auth.getUser();
  if (uerr || !userData?.user) throw new Error("Must be signed in");

  const insertPayload = {
    ...(payload.id ? { id: payload.id } : {}),
    user_id: userData.user.id,
    type: payload.type,
    project_id: payload.project_id ?? null,
    prompt: payload.prompt ?? null,
    settings: payload.settings ?? {},
    input: payload.input ?? {},
    status: "queued" as JobStatus,
    progress: 0,
  };

  const { data, error } = await supabase
    .from("jobs")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error) throw error;
  return data as JobRow;
}

export async function listJobs(
  status?: JobStatus,
): Promise<JobRow[]> {
  const { data: userData, error: uerr } = await supabase.auth.getUser();
  if (uerr || !userData?.user) throw new Error("Must be signed in");

  let q = supabase
    .from("jobs")
    .select("*")
    .eq("user_id", userData.user.id)
    .order("created_at", { ascending: false });

  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as JobRow[];
}

export async function getJob(id: string): Promise<JobRow> {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Job not found");
  return data as JobRow;
}

export async function cancelJob(id: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("jobs")
    .update({ status: "canceled" as JobStatus })
    .eq("id", id)
    .eq("user_id", userData?.user?.id ?? "")
    .in("status", ["queued", "running"]);
  if (error) throw error;
}

/* ======================= REALTIME + POLL PROGRESS ======================= */

export function subscribeJob(
  id: string,
  onChange: (row: JobRow) => void,
) {
  const ch = supabase
    .channel(`job-${id}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "jobs",
        filter: `id=eq.${id}`,
      },
      (payload) => onChange(payload.new as JobRow),
    )
    .subscribe();
  return () => supabase.removeChannel(ch);
}

/** Combines realtime + polling to prevent stuck 10% bug. */
export function watchJob(
  id: string,
  onChange: (row: JobRow) => void,
  pollMs = 1500,
) {
  let stopped = false;
  const unsub = subscribeJob(id, (row) => !stopped && onChange(row));
  (async function pollLoop() {
    while (!stopped) {
      await new Promise((r) => setTimeout(r, pollMs));
      try {
        const row = await getJob(id);
        if (!stopped) onChange(row);
        if (isDone(row.status)) break;
      } catch {
        // ignore polling errors
      }
    }
  })();
  return () => {
    stopped = true;
    try {
      unsub();
    } catch {
      // ignore
    }
  };
}

/* ======================= WORKER INVOKER ======================= */

export async function runWorkerForJob(jobId: string) {
  const { data, error } = await supabase.functions.invoke("job-worker", {
    body: { jobId },
  });

  if (error) {
    console.error("runWorkerForJob error:", error);
    throw error;
  }

  return data;
}

/** Insert a job, then trigger worker */
export async function simulateJob(
  payload: CreateJobInput,
): Promise<JobRow> {
  const job = await createJob(payload);
  runWorkerForJob(job.id).catch(() => {});
  return job;
}

/* ======================= IMAGE CREATION ======================= */

export async function createImageJobSimple(params: {
  id?: string;
  subject: string;
  style?: string;
  mood?: string;
  extras?: string;
  output_goal?: string;
  composition?: string;
  color_theme?: string;
  ref_images?: string[];
  negative?: string;
  seed?: number | null;
  tier?: TierId;
  size?: string;
  project_id?: string | null;
  init_image_url?: string | null;
  initImageFile?: File | null;
  initImageUrls?: string[];
  providerHint?: ImageSettings["provider_hint"];
}): Promise<JobRow> {
  const tier: TierId = params.tier ?? "zylo-v2";
  const size = params.size ?? "1024x1024";

  let initUrl = params.init_image_url ?? null;

  if (
    !initUrl &&
    Array.isArray(params.initImageUrls) &&
    params.initImageUrls.length
  ) {
    initUrl = params.initImageUrls[0];
  }

  if (!initUrl && params.initImageFile) {
    const up = await uploadUserFile(params.initImageFile, {
      prefix: "ti-init",
    });
    const pub = await publishToPublic(up.path);
    initUrl = pub.publicUrl;
  }

  const input: ImageInput = {
    tool: "image",
    creation_type: CREATION_TYPES.PHOTO, // <- normal images = Photos
    subject: (params.subject || "").trim(),
    style: params.style?.trim() || null,
    mood: params.mood?.trim() || null,
    extras: params.extras?.trim() || null,
    output_goal: params.output_goal?.trim() || "Art piece",
    composition: params.composition?.trim() || "center",
    color_theme: params.color_theme?.trim() || null,
    ref_images: params.ref_images ?? [],
    negative:
      (params.negative && params.negative.trim()) ||
      DEFAULT_NEGATIVE_IMAGE,
    brand: { id: null, use_palette: false },
    seed: params.seed ?? null,
    init_image_url: initUrl,
  };

  if (!input.subject) throw new Error("Please provide a subject.");

  const quality = TIER_TO_QUALITY[tier] ?? "basic";
  const price = creditsForImage({ quality, size });

  const settings: ImageSettings = {
    tier,
    size,
    price,
    creation_type: CREATION_TYPES.PHOTO, // <- tag in settings too
  };

  if (params.providerHint) {
    settings.provider_hint = params.providerHint;
  }

  const preview = buildImagePreviewPrompt(input);

  return await simulateJob({
    id: params.id,
    type: "product-photo",
    project_id: params.project_id ?? null,
    prompt: preview,
    settings,
    input,
  });
}

/* ============== PRODUCT PHOTO (Runware Kontext via Edge Function) ============== */

export async function createProductPhotoJob(params: {
  brandId: string;
  userId: string;
  productId?: string;
  kind: "catalog" | "macro" | "lifestyle" | "other";
  prompt: string;
  negative_prompt?: string;
  seed?: number | null;
  width?: number;
  height?: number;
  refs?: Array<{ url: string; weight?: number }>;
}): Promise<JobRow> {
  const width = params.width ?? 1024;
  const height = params.height ?? 1024;

  // ------------------------------------------------------------------
  // 1️⃣ Provider config = single source of truth
  // ------------------------------------------------------------------
  const link = getProviderLink("product-photo");
  if (!link) throw new Error("product-photo tool not configured");

  const CREDIT_COST = link.credits;   // e.g. 12
  const PRICE_USD = link.retailUSD;   // e.g. 0.20

  // ------------------------------------------------------------------
  // 2️⃣ ATOMIC credit deduction (race-safe)
  // ------------------------------------------------------------------
  const { error: creditErr } = await supabase.rpc("deduct_credits", {
    uid: params.userId,
    amount: CREDIT_COST,
  });

  if (creditErr) {
    if (creditErr.message.includes("INSUFFICIENT_CREDITS")) {
      throw new Error("INSUFFICIENT_CREDITS");
    }
    throw creditErr;
  }

  // ------------------------------------------------------------------
  // 3️⃣ Prepare refs
  // ------------------------------------------------------------------
  const orderedRefs =
    (params.refs ?? [])
      .filter((r) => r && r.url)
      .map((r) => ({ url: r.url }))
      .slice(0, 4);

  // ------------------------------------------------------------------
  // 4️⃣ Job input
  // ------------------------------------------------------------------
  const input = {
    tool: "photos" as const,
    creation_type: CREATION_TYPES.PRODUCT_PHOTO,
    brandId: params.brandId,
    userId: params.userId,
    productId: params.productId ?? null,
    kind: params.kind,
    prompt: params.prompt,
    negative_prompt: params.negative_prompt ?? "",
    seed: params.seed ?? null,
    width,
    height,
    refs: orderedRefs,
  };

  // ------------------------------------------------------------------
  // 5️⃣ Job settings (credits + USD persisted)
  // ------------------------------------------------------------------
  const settings = {
    tool: "photos" as const,
    creation_type: CREATION_TYPES.PRODUCT_PHOTO,
    tier: "zylo-v4" as TierId,
    size: `${width}x${height}`,
    credits: CREDIT_COST,
    priceUSD: PRICE_USD,
    provider_hint: {
      engine: link.provider, // "runware"
      mode: "product",
      edgeFn: link.edgeFn,
      airTag: link.airTag, // bfl:4@1
      settings: {},
    },
  };

  const preview = `${params.prompt} • product photo ${width}x${height}`;

  // ------------------------------------------------------------------
  // 6️⃣ Create job + trigger worker
  // ------------------------------------------------------------------
  return await simulateJob({
    type: "image",
    project_id: null,
    prompt: preview,
    settings,
    input,
  });
}



/* ============== 3D spin GIF wrapper (uses image tool) ============== */

export async function createGifJobSimple(params: {
  subject: string;
  aspect?: "16:9" | "9:16" | "1:1";
  resolution?: string;
  initImageUrls?: string[];
  project_id?: string | null;
  size?: string;
}): Promise<JobRow> {
  function deriveSize(): string {
    if (params.size) return params.size;

    const aspect = params.aspect ?? "1:1";
    const res = (params.resolution ?? "1024").toLowerCase();

    const toNum = (v: string) => {
      const m = v.match(/\d+/);
      return m ? parseInt(m[0], 10) : 1024;
    };

    if (aspect === "1:1") {
      const n = toNum(res);
      return `${n}x${n}`;
    }

    const h = toNum(res);

    if (aspect === "16:9") {
      return `${Math.round((16 / 9) * h)}x${h}`;
    }

    if (aspect === "9:16") {
      return `${Math.round((9 / 16) * h)}x${h}`;
    }

    return "1024x1024";
  }

  const size = deriveSize();

  return await createImageJobSimple({
    subject: params.subject.trim(),
    output_goal: "3D spin GIF",
    extras:
      "360-degree turntable spin, smooth rotation, clean simple background",
    size,
    project_id: params.project_id ?? null,
    initImageUrls: params.initImageUrls ?? [],
  });
}

/* ======================= VIDEO CREATION ======================= */

const VIDEO_TOOLKEY_BY_TIER: Record<TierId, ToolKey> = {
  "zylo-v1": "t2v:v2",
  "zylo-v2": "t2v:v2",
  "zylo-v3": "t2v:v3",
  "zylo-v4": "t2v:v4",
};

const VALID_TIERS = ["zylo-v1", "zylo-v2", "zylo-v3", "zylo-v4"] as const;
type AnyTier = (typeof VALID_TIERS)[number];

function mapUiModelToTier(tierOrModel: string): TierId {
  if ((VALID_TIERS as readonly string[]).includes(tierOrModel as AnyTier)) {
    return tierOrModel as TierId;
  }
  switch (tierOrModel) {
    case "veo-3.1-fast":
      return "zylo-v4";
    case "sora-v5":
      return "zylo-v4";
    default:
      return "zylo-v4";
  }
}

export async function createVideoJobSimple(params: {
  id?: string;
  tool_key?: string;
  subject: string;
  tier: string | TierId;
  aspect: "16:9" | "9:16" | "1:1";
  resolution: "720p" | "1080p";
  durationSec: number;
  audio?: boolean;
  initImageUrl?: string | null;
  project_id?: string | null;

  ad?: any;
  product?: any;
  avatar_ref?: string | null;
  avatar_meta?: any | null;
}): Promise<JobRow> {
  // must be signed in
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Must be signed in");

  const tier: TierId = mapUiModelToTier(params.tier);

  // ---- call your Edge Function ----
const { data, error } = await supabase.functions.invoke("runware-video", {
  headers: {
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
  },
  body: {
    subject: params.subject,
    tier,
    aspect: params.aspect,
    resolution: params.resolution,
    durationSec: params.durationSec,
    audio: params.audio ?? false,
    initImageUrl: params.initImageUrl ?? null,
    userId: user.id,
  },
});


  if (error) {
    console.error("runware-video invoke error:", error);
    throw new Error(error.message || "Failed to start video job");
  }

  const payload: any = data || {};

  // ---- accept ANY possible jobId key ----
  const jobId =
    payload.jobId ||
    payload.job_id ||
    payload.id;

  if (!jobId) {
    console.error("runware-video bad response (no jobId):", payload);
    throw new Error(payload.error || "Video launch failed");
  }

  // ---- provider job id (optional) ----
  const providerJobId =
    payload.providerJobId ||
    payload.provider_job_id ||
    null;

  // ---- minimal return row (real job already inserted by edge fn) ----
  return {
    id: jobId,
    user_id: user.id,
    project_id: params.project_id ?? null,
    type: "video",
    status: "queued",
    progress: 0,
    prompt: params.subject,
    settings: {
      tier,
      providerJobId,
      creation_type: CREATION_TYPES.VIDEO, // <- plain videos
    },
    input: {
      subject: params.subject,
      aspect: params.aspect,
      resolution: params.resolution,
      durationSec: params.durationSec,
      audio: !!params.audio,
      initImageUrl: params.initImageUrl ?? null,
      creation_type: CREATION_TYPES.VIDEO,
    },
    error: null,
    result_url: null,
    output: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/* ============================================================
   AD VIDEO — dedicated job creator (OPTION A)
   Clean, isolated, does NOT touch other flows.
   Maps your UI models → provider configs in providers.ts
============================================================ */

export async function createAdVideoJob(params: {
  subject: string;
  ad: any;
  product: any;
  avatar_meta?: any;
  project_id?: string | null;
}) {
  const baseModel = params.ad?.model || "v4-pixverse-v5";

  // ---------------- map UI model -> providers.ts toolKey ----------------
  // These MUST match your providers.ts keys exactly:
  // "ad-video:v4" → PixVerse v5 (pixverse:l95)
  // "ad-video:v5" → Veo 3.1 Fast (google:3e9)
  let toolKey: ToolKey = "ad-video:v4";

  if (baseModel === "v5-veo-3.1-fast") {
    toolKey = "ad-video:v5";
  } else {
    toolKey = "ad-video:v4";
  }

  // ---------------- get provider info ----------------
  const link = getProviderLink(toolKey);
  if (!link) throw new Error("Provider not configured for this ad model");

  // ---------------- settings (provider_hint drives AIR tag) ----------------
  const settings: Record<string, any> = {
    tool_key: toolKey,
    tier: "zylo-v4", // all ads treated as top tier
    creation_type: CREATION_TYPES.PRODUCT_AD, // <- tag as Product Ad
    provider_hint: {
      engine: "runware",
      mode: "ad-video",
      airTag: link.airTag, // ← Pixverse or Veo
      lipSyncAirTag: link.lipSyncAirTag, // ← pixverse:lipsync@1
      audioMuxAirTag: link.audioMuxAirTag, // runware:muxer
      settings: {},
    },
    // correct credit cost from providers.ts mapping:
    priceUSD: link.retailUSD,
    credits: link.credits,
  };

  // ---------------- input payload ----------------
  const input: Record<string, any> = {
    subject: params.subject,
    ad: params.ad,
    product: params.product,
    avatar_meta: params.avatar_meta ?? null,
    creation_type: CREATION_TYPES.PRODUCT_AD,
  };

  // ---------------- write job + run worker ----------------
  return await simulateJob({
    type: "video",
    project_id: params.project_id ?? null,
    prompt: params.subject,
    settings,
    input,
  });
}
