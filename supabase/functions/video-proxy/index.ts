Deno.serve(async (req: Request) => {
  try {
    let url: string | null = null;

    if (req.method === "POST") {
      const body = await req.json();
      url = body.url ?? null;
    } else {
      const { searchParams } = new URL(req.url);
      url = searchParams.get("url");
    }

    if (!url) {
      return new Response("Missing URL", { status: 400 });
    }

    const upstream = await fetch(url);

    if (!upstream.ok) {
      return new Response("Failed to fetch video", { status: 502 });
    }

    const contentType =
      upstream.headers.get("content-type") || "video/mp4";

    const data = await upstream.arrayBuffer();

    return new Response(data, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (err) {
    return new Response("Server error", { status: 500 });
  }
});