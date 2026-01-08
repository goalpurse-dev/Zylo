// src/lib/ads.ts
// Create + types for Ads with embedded product & avatar snapshots

import { supabase } from "./supabaseClient";

/* ======================== Types ======================== */
export type TierId = "zylo-v2" | "zylo-v3" | "zylo-v4";
export type Aspect = "9:16" | "16:9" | "1:1";
export type Resolution = "720p" | "1080p";

export type Product = {
  id: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  brand?: string | null;
  material?: string | null;
  category?: string | null;
  ad_keywords?: string[] | null;
  source?: string | null;
};

export type Avatar = {
  id: string;
  display_name: string;
  thumbnail_path?: string | null;
  voice?: {
    provider: string;
    id: string;
    style?: string;
    tags?: string[];
  };
  descriptor?: Record<string, any>;
  engine_variants?: Record<string, any>;
  activity_packs?: Array<{ id: string; label: string; poses?: string[] }>;
  default_activity_id?: string;
  version?: string;
  source?: string;
};

export type AdScene = {
  id: string;
  time: { start: number; end: number };
  shot?: string | null;
  visuals?: string | null;
  dialogue?: string | null;
  on_screen_text?: string | null;
  camera?: string | null;
  lighting?: string | null;
  sfx?: string | null;
  notes?: string | null;
};

export type AdCreative = {
  style: string;
  script_tone: string;
  music: string;
  language: string; // e.g., 'en'
  scenes: AdScene[];
  constraints?: string[];
};

export type AdRecord = {
  id: string; // ads.id in DB (ad_...)
  user_id: string; // from auth
  brand_id: string;
  product_id?: string | null;
  avatar_id?: string | null;
  tier: TierId;
  aspect: Aspect;
  resolution: Resolution;
  duration_sec: number;
  creative: AdCreative;
  product_snapshot?: Product | null;
  avatar_snapshot?: Avatar | null;
  tracking: Record<string, any>;
  status?: "draft" | "queued" | "rendering" | "succeeded" | "failed";
  created_at?: string;
  updated_at?: string;
};

/* ======================== Helpers ======================== */
export function lastSceneEnd(creative: AdCreative): number {
  const arr = creative?.scenes ?? [];
  if (!arr.length) return 0;
  return Number(arr[arr.length - 1].time.end || 0);
}

export function ensureDurationMatches(
  creative: AdCreative,
  durationSec: number
) {
  const end = lastSceneEnd(creative);
  // Keep the client resilient: adjust duration to match scenes.
  if (Math.abs(durationSec - end) > 0.001) return end;
  return durationSec;
}

/* ======================== CRUD ======================== */
export async function createAd(params: {
  id: string; // ad_...
  brand_id: string;
  tier: TierId;
  aspect: Aspect;
  resolution: Resolution;
  duration_sec: number;
  creative: AdCreative;
  tracking: Record<string, any>;

  // Snapshots to embed for deterministic renders:
  product?: Product | null;
  avatar?: Avatar | null;

  // Optional canonical FK ids (if you also store refs):
  product_id?: string | null;
  avatar_id?: string | null;

  status?: AdRecord["status"]; // default 'draft'
}) {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error("Not authenticated");

  const safeDuration = ensureDurationMatches(params.creative, params.duration_sec);

  const { data, error } = await supabase
    .from("ads")
    .insert({
      id: params.id,
      user_id: user.id,
      brand_id: params.brand_id,
      product_id: params.product_id ?? params.product?.id ?? null,
      avatar_id: params.avatar_id ?? params.avatar?.id ?? null,
      tier: params.tier,
      aspect: params.aspect,
      resolution: params.resolution,
      duration_sec: safeDuration,
      creative: params.creative as any,
      product_snapshot: params.product ? (params.product as any) : null,
      avatar_snapshot: params.avatar ? (params.avatar as any) : null,
      tracking: params.tracking as any,
      status: params.status ?? "draft",
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as AdRecord;
}

export async function updateAd(id: string, patch: Partial<AdRecord>) {
  // Strip non-updatable or server-managed fields
  const { id: _id, user_id, created_at, updated_at, ...clean } = patch as any;

  // If creative is updated, keep duration consistent
  if (clean.creative && clean.duration_sec != null) {
    clean.duration_sec = ensureDurationMatches(clean.creative, clean.duration_sec);
  }

  const { data, error } = await supabase
    .from("ads")
    .update(clean)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as AdRecord;
}

export async function getAd(id: string) {
  const { data, error } = await supabase
    .from("ads")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as AdRecord;
}

export async function listAdsByBrand(brandId: string) {
  const { data, error } = await supabase
    .from("ads")
    .select(
      "id, brand_id, product_id, avatar_id, tier, aspect, resolution, duration_sec, creative, status, created_at, updated_at"
    )
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Partial<AdRecord>[];
}

/* ======================== Presets ======================== */
export function seedUgcTestimonialPreset(): AdCreative {
  return {
    style: "UGC Testimonial",
    script_tone: "friendly, trustworthy, concise",
    music: "uplifting acoustic pop",
    language: "en",
    scenes: [
      {
        id: "s1",
        time: { start: 0.0, end: 2.0 },
        shot: "Macro close-up hero shot",
        visuals: "Natural daylight, soft bokeh; gentle dolly-in.",
        dialogue: null,
        on_screen_text: "Instant glow",
        camera: "macro, slow dolly-in",
        lighting: "soft daylight",
        sfx: "soft whoosh at 1.8s",
        notes: "Keep label clear and centered",
      },
      {
        id: "s2",
        time: { start: 2.0, end: 6.0 },
        shot: "On-camera testimonial",
        visuals: "Presenter at arm’s length, subtle hand-held motion.",
        dialogue:
          "I've been using this every morning—it instantly brightens my skin!",
        on_screen_text: null,
        camera: "handheld, eye-level",
        lighting: "window light, soft fill",
        sfx: null,
        notes: "Natural smile; clear enunciation",
      },
      {
        id: "s3",
        time: { start: 6.0, end: 9.0 },
        shot: "B-roll application montage",
        visuals: "Close-up applying; smooth pan; shallow depth of field.",
        dialogue: null,
        on_screen_text: "Vitamin C radiance",
        camera: "gimbal pan, slow",
        lighting: "soft, warm",
        sfx: "subtle shimmer at 8.7s",
        notes: "Maintain realistic skin texture",
      },
      {
        id: "s4",
        time: { start: 9.0, end: 10.0 },
        shot: "Hero + CTA",
        visuals: "Clean white background; logo centered.",
        dialogue: null,
        on_screen_text: "Glow starts here",
        camera: "locked-off",
        lighting: "even studio",
        sfx: "button tap",
        notes: "End on crisp, legible logo",
      },
    ],
    constraints: [
      "No label/text distortion",
      "Keep colors bright and natural",
      "Avoid heavy filters or overly cinematic grading",
    ],
  };
}
