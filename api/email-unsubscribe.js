// api/email-unsubscribe.js — the one-click unsubscribe address on our own domain
// (www.tryzyvo.com/api/email-unsubscribe?u=…&t=…), the target of every email's List-Unsubscribe
// header (owner, 2026-10-29: no supabase.co address in our emails). It passes the request on,
// unchanged, to the Supabase function email-unsubscribe, which checks the signed link:
//   POST — unsubscribe (RFC 8058: Gmail/Yahoo post "List-Unsubscribe=One-Click"; the page posts JSON)
//   GET  — changes nothing (link scanners prefetch): the function sends the reader to /unsubscribe
export const config = {
  api: { bodyParser: false },
};

const FUNCTION_URL = `${process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://ilpiwoxubnevmxxikyvx.supabase.co"}/functions/v1/email-unsubscribe`;

async function rawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const query = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  try {
    const upstream = await fetch(FUNCTION_URL + query, {
      method: req.method,
      redirect: "manual",
      headers: { "content-type": req.headers["content-type"] || "application/x-www-form-urlencoded" },
      body: req.method === "POST" ? await rawBody(req) : undefined,
    });
    const location = upstream.headers.get("location");
    if (location) res.setHeader("Location", location);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");
    return res.status(upstream.status).send(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    return res.status(502).json({ error: "Couldn't reach the unsubscribe service. Try again." });
  }
}
