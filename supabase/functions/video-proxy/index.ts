import { assertProviderAccessibleImageUrl } from "../_shared/referenceImages.ts";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
};

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    let url: string | null = null;

    if (req.method === "POST") {
      const body = await req.json();
      url = body.url ?? null;
    } else {
      const { searchParams } = new URL(req.url);
      url = searchParams.get("url");
    }

    if (!url) {
      return new Response("Missing URL", { status: 400, headers: CORS });
    }

    const safeUrl = assertProviderAccessibleImageUrl(url);
    const upstream = await fetch(safeUrl);

    if (!upstream.ok) {
      return new Response("Failed to fetch media", { status: 502, headers: CORS });
    }

    const contentType =
      upstream.headers.get("content-type") || "video/mp4";

    return new Response(upstream.body, {
      headers: {
        ...CORS,
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (err) {
    return new Response("Server error", { status: 500, headers: CORS });
  }
});
