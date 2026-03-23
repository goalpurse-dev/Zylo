// /functions/video-proxy/index.ts

export default async (req: Request) => {
  const { url } = await req.json();

  const res = await fetch(url);
  const blob = await res.arrayBuffer();

 return new Response(blob, {
  headers: {
    "Content-Type": "video/mp4",
    "Cache-Control": "public, max-age=31536000",
  },
});
};