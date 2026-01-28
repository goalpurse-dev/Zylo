import { supabase } from "./supabaseClient";

import { uploadUserFile, publishToPublic } from "./storage";
import { getProviderLink, type ToolKey } from "./providers";

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
  tool_key?: ToolKey;        // ✅ ADD THIS
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


export type ImageToolKey =
  | "image:nano"
  | "image:juggernaut"
  | "image:hidream"
  | "image:spark"
  | "image:prime";

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
  tool_key: ImageToolKey;   // ← THIS IS THE SOURCE OF TRUTH
  size: string;
  credits: number;
  priceUSD: number;
  provider_hint?: {
    engine: "runware";
    mode: "t2i" | "upscale" | "product";
    edgeFn: string;
    airTag: string;
    settings?: Record<string, any>;
  };
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
  tool_key: payload.tool_key ?? null, // 🔥 REQUIRED
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
  subject: string;
  toolKey: ImageToolKey;
  size?: string;
  style?: string;        // ✅ ADD
  project_id?: string | null;
  init_image_url?: string | null;
  initImageFile?: File | null;
  initImageUrls?: string[];
  providerHint?: ImageSettings["provider_hint"];
})
: Promise<JobRow> {

const link = getProviderLink(params.toolKey);
if (!link) {
  throw new Error(`Image provider not configured for ${params.toolKey}`);
}

const credits = link.credits;
const priceUSD = link.retailUSD;


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
  subject: (params.subject || "").trim(),
  style: params.style ?? null, // ✅ STYLE LIVES HERE
  creation_type: CREATION_TYPES.PHOTO,
  negative: DEFAULT_NEGATIVE_IMAGE,
  brand: { id: null, use_palette: false },
  init_image_url: initUrl,
};


  if (!input.subject) throw new Error("Please provide a subject.");



const settings: ImageSettings = {
  tool_key: params.toolKey,
  size,
  credits,
  priceUSD,
  creation_type: CREATION_TYPES.PHOTO,
  provider_hint: {
    engine: "runware",
    mode: "t2i",
    edgeFn: link.edgeFn,
    airTag: link.airTag,
    settings: {},
  },
};


  if (params.providerHint) {
    settings.provider_hint = params.providerHint;
  }

  const preview = buildImagePreviewPrompt(input);

return await simulateJob({
  id: params.id,
  type: "image",
  tool_key: params.toolKey,   // 🔥 THIS IS REQUIRED
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




