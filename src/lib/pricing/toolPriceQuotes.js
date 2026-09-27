// Server price quotes for browser-created jobs.
//
// Every job's price is decided by the database (public.tool_prices via
// compute_tool_price — see supabase/migrations/20261008100000 and
// 20261010100000). The UI must show that exact number, so it asks the same
// function through the quote_tool_prices RPC instead of keeping its own
// price tables.
//
// Quotes are keyed by the inputs that can change a price (tool_key,
// duration, sound, width×height, resolution), batched into one RPC per tick,
// de-duplicated while in flight, and cached for a few minutes (memory +
// sessionStorage) so the UI stays instant after the first load.
import { supabase } from "../supabaseClient";

const TTL_MS = 10 * 60 * 1000;
const STORAGE_KEY = "zyvo_price_quotes_v1";
const BATCH_DELAY_MS = 12;
const MAX_BATCH = 150;

const cache = new Map();     // signature -> { credits, at }
const inflight = new Map();  // signature -> Promise<credits>
let queue = [];              // [{ signature, item, resolve, reject }]
let flushTimer = null;

/** The only input fields that can affect a price (mirrors compute_tool_price). */
function priceInput(input = {}) {
  const out = {};
  if (input.durationSec != null) out.durationSec = Number(input.durationSec);
  if (input.withSound != null) out.withSound = Boolean(input.withSound);
  if (input.width != null) out.width = Number(input.width);
  if (input.height != null) out.height = Number(input.height);
  if (input.resolution != null) out.resolution = String(input.resolution);
  return out;
}

export function priceSignature(toolKey, input = {}) {
  const p = priceInput(input);
  return [toolKey, p.durationSec ?? "-", p.withSound ?? "-", `${p.width ?? "-"}x${p.height ?? "-"}`, p.resolution ?? "-"].join("|");
}

function loadStorage() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const now = Date.now();
    for (const [sig, entry] of Object.entries(JSON.parse(raw))) {
      if (entry && now - entry.at < TTL_MS && Number.isFinite(entry.credits)) cache.set(sig, entry);
    }
  } catch {
    // Storage unavailable (private mode, quota) — memory cache still works.
  }
}

function saveStorage() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(cache)));
  } catch {
    // non-fatal
  }
}

loadStorage();

/** A fresh cached quote, or null. */
export function getCachedQuote(toolKey, input) {
  const entry = cache.get(priceSignature(toolKey, input));
  return entry && Date.now() - entry.at < TTL_MS ? entry.credits : null;
}

async function flush() {
  flushTimer = null;
  const batch = queue.splice(0, MAX_BATCH);
  if (queue.length) flushTimer = setTimeout(flush, 0);
  if (!batch.length) return;

  const { data, error } = await supabase.rpc("quote_tool_prices", {
    p_items: batch.map(({ signature, item }) => ({ id: signature, tool_key: item.tool_key, input: priceInput(item.input) })),
  });

  const byId = new Map((Array.isArray(data) ? data : []).map((row) => [row.id, row]));
  for (const { signature, resolve, reject } of batch) {
    inflight.delete(signature);
    const row = byId.get(signature);
    if (error || !row) {
      reject(new Error(error?.message || "PRICE_QUOTE_FAILED"));
    } else if (row.error || !Number.isFinite(row.credits)) {
      reject(new Error(row.error || "NO_SERVER_PRICE"));
    } else {
      cache.set(signature, { credits: row.credits, at: Date.now() });
      resolve(row.credits);
    }
  }
  saveStorage();
}

/** Quote one { tool_key, input }. Resolves to credits; rejects on failure. */
export function quoteToolPrice(toolKey, input = {}, { fresh = false } = {}) {
  const signature = priceSignature(toolKey, input);
  if (!fresh) {
    const cached = getCachedQuote(toolKey, input);
    if (cached != null) return Promise.resolve(cached);
    if (inflight.has(signature)) return inflight.get(signature);
  }
  const promise = new Promise((resolve, reject) => {
    queue.push({ signature, item: { tool_key: toolKey, input }, resolve, reject });
    if (!flushTimer) flushTimer = setTimeout(flush, BATCH_DELAY_MS);
  });
  inflight.set(signature, promise);
  return promise;
}

/** Quote many at once; resolves to credits[] in the same order (rejects if any fails). */
export function quoteToolPrices(items, options) {
  return Promise.all(items.map((item) => quoteToolPrice(item.tool_key, item.input, options)));
}
