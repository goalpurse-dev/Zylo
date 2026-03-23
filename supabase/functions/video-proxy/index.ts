export default async (req: Request) => {
  let url;

  if (req.method === "POST") {
    const body = await req.json();
    url = body.url;
  } else {
    const { searchParams } = new URL(req.url);
    url = searchParams.get("url");
  }

  if (!url) {
    return new Response("Missing URL", { status: 400 });
  }

  const res = await fetch(url);
  const blob = await res.arrayBuffer();

  return new Response(blob, {
    headers: {
      "Content-Type": "video/mp4",
      "Cache-Control": "public, max-age=31536000",
    },
  });
};