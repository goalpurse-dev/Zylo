// Shared between advance-long-form-research (Phase 1c verify calls) and
// advance-long-form-script (Phase 1d claim verification) — both need to
// prove a model-supplied URL is real without trusting free-text and without
// relying on OpenAI's url_citation annotations, which come back EMPTY on any
// response that combines web_search with strict json_schema structured
// output (confirmed via a raw-API smoke test, scripts/smokeTestMergedVerify.mjs
// — tool_usage.web_search.num_requests confirmed a real search happened, but
// content[].annotations was []). A live fetch is the substitute proof.
//
// A first version of this function required a clean 2xx/3xx and rejected 5
// of 9 real model-found URLs in one diagnostic run (tests/fixtures/stickman/research/why-don-t-we-eat-lions.json,
// meta.stickmanVerifyDiag): sciencedirect.com, a doi.org/PNAS link,
// researchgate.net, cites.org, and a SAFLII case-law page — all real,
// well-known domains that just block plain bot HEAD/GET requests (403/999)
// or time out against their anti-bot layer. A fabricated/hallucinated URL
// fails completely differently: the domain doesn't resolve or the
// connection is refused, near-instantly. So the actual proof-of-realness
// signal is "a real server answered at all" — any HTTP response, even a
// block page — not "the response was successful." Only a DNS/connection
// failure (the domain doesn't exist) or an explicit 404/410 (this specific
// page doesn't exist on a real domain) count as evidence the URL is fake;
// everything else, including 403/429/999 anti-bot blocks and a timeout
// after the request was actually sent, is treated as "a real destination
// exists, just not one this fetch can prove the content of" and passes.
const URL_VERIFY_TIMEOUT_MS = 5000;

export async function urlIsLive(url: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  for (const method of ["HEAD", "GET"] as const) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), URL_VERIFY_TIMEOUT_MS);
    try {
      const res = await fetch(url, { method, redirect: "follow", signal: controller.signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; ZyvoResearchBot/1.0)" } });
      clearTimeout(timeout);
      if (res.status === 404 || res.status === 410) {
        if (method === "HEAD") continue; // some servers mis-report HEAD as 404 for a page that GETs fine — confirm with GET before rejecting
        return false;
      }
      return true; // any other real HTTP response (2xx, redirects already followed, 401/403/429/999 blocks, 5xx) proves a real server exists
    } catch {
      clearTimeout(timeout);
      if (method === "HEAD") continue; // give GET one chance before treating this as a DNS/connection-level failure
    }
  }
  return false;
}
