// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assertProductPhotoPayload } from "./payloads.ts";

/* ============== CORS ============== */
function cors(req: Request): Headers {
  const origin = req.headers.get("Origin") || "*";
  const hdrs =
    req.headers.get("Access-Control-Request-Headers") ||
    "authorization, x-client-info, apikey, content-type";

  return new Headers({
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": hdrs,
    "access-control-max-age": "86400",
    "content-type": "application/json",
    vary: "Origin",
  });
}

const ok = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors(req) });

const err = (req: Request, message: string, status = 400) =>
  ok(req, { ok: false, error: message }, status);

/* ============== ENV / CONSTANTS ============== */

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? Deno.env.get("PROJECT_URL") ?? "";
const SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SERVICE_ROLE_KEY") ??
  "";

const RUNWARE_API_KEY = Deno.env.get("RUNWARE_API_KEY") ?? "";
const RUNWARE_BASE =
  (Deno.env.get("RUNWARE_BASE_URL") || "https://api.runware.ai").replace(
    /\/+$/,
    "",
  );
const AIR_TASKS = `${RUNWARE_BASE}/v1/air/tasks`;

const MODEL_BG_REMOVE =
  Deno.env.get("RUNWARE_BGREMOVE_MODEL") || "runware:110@1";
const MODEL_KONTEXT =
  Deno.env.get("RUNWARE_KONTEXT_MODEL") || "bfl:4@1";

type Ref = { url: string; weight?: number };

function safe(e: unknown) {
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

/* ============== Upload helpers ============== */

async function uploadToPublicAssets(
  sbAdmin: ReturnType<typeof createClient>,
  fileUrl: string,
  path: string,
) {
  const res = await fetch(fileUrl);
  if (!res.ok) throw new Error(`download failed ${res.status}`);
  const blob = await res.blob();

  const { error } = await sbAdmin.storage
    .from("public-assets")
    .upload(path, blob, {
      upsert: true,
      cacheControl: "3600",
      contentType: blob.type || "image/jpeg",
    });

  if (error) throw error;

  const { data } = sbAdmin.storage
    .from("public-assets")
    .getPublicUrl(path);

  return data.publicUrl;
}

async function ensurePublicUrl(
  sbAdmin: ReturnType<typeof createClient>,
  url: string,
  pathPrefix: string,
) {
  if (url.startsWith("https://")) return url;

  const name = crypto.randomUUID() + ".jpg";
  return await uploadToPublicAssets(
    sbAdmin,
    url,
    `${pathPrefix}/${name}`,
  );
}

/* ============== Runware calls ============== */

async function runRemoveBackgroundOnce(inputImageUrl: string): Promise<string> {
  const taskUUID = crypto.randomUUID();

  const body = [
    {
      taskType: "removeBackground",
      taskUUID,
      model: MODEL_BG_REMOVE,
      inputImage: inputImageUrl,
      outputType: "URL",
      outputFormat: "PNG",
      deliveryMethod: "sync",
    },
  ];

  const r = await fetch(AIR_TASKS, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RUNWARE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await r.text();
  if (!r.ok) {
    throw new Error(`[${MODEL_BG_REMOVE}] ${r.status}: ${text}`);
  }

  const parsed = JSON.parse(text);
  const first = parsed?.data?.[0] ?? parsed?.[0];
  const url = first?.imageURL ?? first?.result?.imageURL;

  if (!url) throw new Error("No cutout imageURL");

  return url;
}

async function runKontextOnce(input: {
  prompt: string;
  seed: number;
  width: number;
  height: number;
  bgUrl: string;
  productCutoutUrl: string;
}): Promise<string> {
  const taskUUID = crypto.randomUUID();

  const body = [
    {
      taskType: "imageInference",
      taskUUID,
      model: MODEL_KONTEXT,
      outputType: "URL",
      numberResults: 1,
      positivePrompt: input.prompt,
      width: input.width,
      height: input.height,
      seed: input.seed,
      referenceImages: [input.bgUrl, input.productCutoutUrl],
      referenceImageWeights: [0.75, 0.25],
    },
  ];

  const r = await fetch(AIR_TASKS, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RUNWARE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await r.text();
  if (!r.ok) {
    throw new Error(`[${MODEL_KONTEXT}] ${r.status}: ${text}`);
  }

  const parsed = JSON.parse(text);
  const first = parsed?.data?.[0] ?? parsed?.[0];
  const url = first?.imageURL ?? first?.result?.imageURL;

  if (!url) throw new Error("No final imageURL");

  return url;
}

/* ============== HANDLER ============== */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(req) });
  }

  try {
    if (req.method !== "POST") {
      return err(req, "Method not allowed", 405);
    }

    const body: any = await req.json();
    assertProductPhotoPayload(body);

    const sbAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const productUrl = await ensurePublicUrl(
      sbAdmin,
      body.refs[0].url,
      `tmp/runware/products/${body.userId}`,
    );

    const bgUrl = await ensurePublicUrl(
      sbAdmin,
      body.refs[1].url,
      `tmp/runware/backgrounds`,
    );

    const seed =
      typeof body.seed === "number"
        ? body.seed
        : Math.floor(Math.random() * 1e9);

    const cutoutUrl = await runRemoveBackgroundOnce(productUrl);

 let prompt = body.prompt.trim() + " ";
prompt +=
  "Use the FIRST reference image strictly as the background scene. " +
  "Use the SECOND reference image ONLY for the product. " +

  "The product must be standing upright vertically, resting on its base. " +
  "The product must NOT be tilted, rotated, or laying down. " +
  "Center the product on the surface. " +

  "Add realistic contact shadows directly under the product. " +
  "Do not change the product’s orientation, proportions, or shape. " +
  "Do not rotate or reposition the product unnaturally.";


    const finalUrl = await runKontextOnce({
      prompt,
      seed,
      width: body.width,
      height: body.height,
      bgUrl,
      productCutoutUrl: cutoutUrl,
    });

    const name = crypto.randomUUID() + ".jpg";
    const base = `published/${body.userId}/product-renders/${body.productId || "loose"}`;
    const publicUrl = await uploadToPublicAssets(
      sbAdmin,
      finalUrl,
      `${base}/${name}`,
    );

    return ok(req, { ok: true, url: publicUrl, seed });
  } catch (e) {
    console.error("[runware-product-photo]", e);
    return err(req, safe(e), 400);
  }
});
