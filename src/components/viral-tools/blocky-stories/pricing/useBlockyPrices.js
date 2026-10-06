import { useMemo } from "react";
import useToolPriceQuotes from "../../../../hooks/useToolPriceQuotes";
import { priceItems } from "./blockyEstimates";

/**
 * Server quotes for Blocky Stories at one aspect.
 *   status/retry come straight from useToolPriceQuotes;
 *   prices is { image, "clip:v2", "clip:v3", "clip:v4" } for blockyEstimates.
 */
export default function useBlockyPrices(aspect = "9:16") {
  const items = useMemo(() => priceItems(aspect), [aspect]);
  return useToolPriceQuotes(items);
}

/** { status, value, onRetry } for PrimaryButton / QuotedCredits from a quotes result. */
export function quoteFor(quotes, value) {
  if (quotes.status === "error") return { status: "error", value: null, onRetry: quotes.retry };
  if (value == null) return { status: "loading", value: null, onRetry: quotes.retry };
  return { status: "ready", value, onRetry: quotes.retry };
}
