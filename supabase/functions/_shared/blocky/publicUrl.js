// The address the outside world reaches this backend at.
//
// On the real project that is SUPABASE_URL itself, and nothing here changes a
// URL. On the local stack (docs/blocky-local.md) the functions run inside
// Docker, where SUPABASE_URL is an inside-only address (http://kong:8000): a
// stored picture's URL built from it can't be opened by the browser, fetched
// by Runware or OpenAI, or called back by a webhook. BLOCKY_PUBLIC_URL is the
// outside address of the same backend (http://127.0.0.1:54321, or a tunnel's
// https address when a provider has to reach it).

/**
 * @param {string} internalUrl SUPABASE_URL as the function sees it
 * @param {string} [publicUrl] BLOCKY_PUBLIC_URL; empty on the real project
 * @returns {{base: string, toPublic: (url: string|null|undefined) => string|null|undefined}}
 *   base: where a provider calls us back; toPublic: a storage URL as the outside world must see it
 */
export function publicAddress(internalUrl, publicUrl = "") {
  const inside = String(internalUrl ?? "").replace(/\/+$/, "");
  const outside = String(publicUrl ?? "").trim().replace(/\/+$/, "");
  if (!outside || outside === inside) return { base: inside, toPublic: (url) => url };
  return {
    base: outside,
    toPublic: (url) => (typeof url === "string" && url.startsWith(`${inside}/`) ? `${outside}${url.slice(inside.length)}` : url),
  };
}
