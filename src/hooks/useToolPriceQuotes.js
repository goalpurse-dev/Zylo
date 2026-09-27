import { useCallback, useEffect, useMemo, useState } from "react";
import { getCachedQuote, quoteToolPrice } from "../lib/pricing/toolPriceQuotes";

/**
 * Server price quotes for a set of priced job shapes.
 *
 *   const quotes = useToolPriceQuotes([
 *     { id: "image", tool_key: "image:fruit-v2", input: { width: 720, height: 1280 } },
 *     { id: "clip",  tool_key: "video:fruit-v2", input: { durationSec: 5, withSound: true, width: 496, height: 864 } },
 *   ]);
 *   quotes.status          // "loading" | "ready" | "error"
 *   quotes.price("clip")   // credits, or null until loaded
 *   quotes.retry()         // re-request everything that failed
 *
 * Pass the whole option grid a screen can show (every tier × length × size)
 * so switching options never waits on the network. Items already in the
 * client cache resolve synchronously, so revisits render with no skeleton.
 */
export default function useToolPriceQuotes(items) {
  const list = useMemo(() => (items ?? []).filter((it) => it && it.id != null && it.tool_key), [items]);
  const itemsKey = useMemo(
    () => JSON.stringify(list.map((it) => [it.id, it.tool_key, it.input ?? {}])),
    [list],
  );

  const readCache = useCallback(() => {
    const out = {};
    for (const it of list) {
      const cached = getCachedQuote(it.tool_key, it.input);
      if (cached != null) out[it.id] = cached;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey]);

  const [prices, setPrices] = useState(readCache);
  const [errors, setErrors] = useState({});
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const initial = readCache();
    setPrices(initial);
    setErrors({});
    const missing = list.filter((it) => initial[it.id] == null);
    if (!missing.length) return undefined;

    Promise.allSettled(missing.map((it) => quoteToolPrice(it.tool_key, it.input, { fresh: attempt > 0 })))
      .then((results) => {
        if (cancelled) return;
        const nextPrices = {};
        const nextErrors = {};
        results.forEach((r, i) => {
          if (r.status === "fulfilled") nextPrices[missing[i].id] = r.value;
          else nextErrors[missing[i].id] = r.reason?.message || "PRICE_QUOTE_FAILED";
        });
        setPrices((prev) => ({ ...prev, ...nextPrices }));
        setErrors(nextErrors);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey, attempt]);

  const hasErrors = Object.keys(errors).length > 0;
  const allLoaded = list.every((it) => prices[it.id] != null);
  const status = hasErrors ? "error" : allLoaded ? "ready" : "loading";

  const price = useCallback((id) => (prices[id] ?? null), [prices]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { status, prices, errors, price, retry };
}
