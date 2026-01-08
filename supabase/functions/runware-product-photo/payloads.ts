// Shared types + lightweight validation for Edge Functions
// No external deps to keep cold starts tiny.

export type ProductPhotoPayload = {
  toolKey: "product-photo";
  brandId: string;        // uuid
  userId: string;         // uuid (session user)
  productId?: string;     // uuid (only for “use brand’s product” flow)
  kind: "catalog" | "macro" | "lifestyle" | "other";

  prompt: string;
  negative_prompt?: string;
  seed?: number;
  width: number;          // e.g. 1024
  height: number;         // e.g. 1024
  cfg?: number;           // default 4.2
  steps?: number;         // default 36
  conditioning_strength?: number; // default 0.7

  // 0..4 refs, we only require url:string here;
  // HTTPS / data / UUID etc are validated later in index.ts (looksPublic).
  refs: Array<{ url: string; weight?: number }>;
};

export function assertProductPhotoPayload(p: any): asserts p is ProductPhotoPayload {
  const fail = (m: string) => {
    throw new Error(`bad payload: ${m}`);
  };

  if (!p || typeof p !== "object") fail("not an object");

  if (p.toolKey !== "product-photo") {
    fail("toolKey must be 'product-photo'");
  }

  if (!isUuid(p.brandId)) fail("brandId must be uuid");
  if (!isUuid(p.userId)) fail("userId must be uuid");
  if (p.productId && !isUuid(p.productId)) {
    fail("productId must be uuid when present");
  }

  const KINDS = new Set(["catalog", "macro", "lifestyle", "other"]);
  if (!KINDS.has(p.kind)) fail("kind invalid");

  if (!p.prompt || typeof p.prompt !== "string" || p.prompt.length < 3) {
    fail("prompt too short");
  }

  if (!isIntInRange(p.width, 512, 2048)) fail("width 512..2048");
  if (!isIntInRange(p.height, 512, 2048)) fail("height 512..2048");

  if (p.cfg != null && !isNumInRange(p.cfg, 1, 10)) {
    fail("cfg 1..10");
  }
  if (p.steps != null && !isIntInRange(p.steps, 10, 80)) {
    fail("steps 10..80");
  }
  if (
    p.conditioning_strength != null &&
    !isNumInRange(p.conditioning_strength, 0, 1)
  ) {
    fail("conditioning_strength 0..1");
  }

  if (!Array.isArray(p.refs)) fail("refs must be array");
  if (p.refs.length > 4) fail("max 4 refs");

  for (const r of p.refs) {
    if (!r || typeof r !== "object") fail("ref must be object");

    if (typeof r.url !== "string" || !r.url.trim()) {
      fail("ref.url must be string");
    }

    if (r.weight != null && !isNumInRange(r.weight, 0, 1)) {
      fail("ref.weight 0..1");
    }
  }
}

/* ========== helpers ========== */

function isUuid(s: any) {
  return (
    typeof s === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      s,
    )
  );
}

function isIntInRange(n: any, lo: number, hi: number) {
  return Number.isInteger(n) && n >= lo && n <= hi;
}

function isNumInRange(n: any, lo: number, hi: number) {
  return typeof n === "number" && isFinite(n) && n >= lo && n <= hi;
}
