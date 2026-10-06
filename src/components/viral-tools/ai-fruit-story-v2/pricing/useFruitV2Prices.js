import { useMemo } from "react";
import useToolPriceQuotes from "../../../../hooks/useToolPriceQuotes";
import { priceItems } from "./fruitV2Estimates";

/**
 * Server quotes for AI Fruit Story v2 at one aspect.
 *   status/retry come straight from useToolPriceQuotes;
 *   prices is { image, "clip:v2", "clip:v3", "clip:v4" } for fruitV2Estimates.
 */
export default function useFruitV2Prices(aspect = "9:16") {
  const items = useMemo(() => priceItems(aspect), [aspect]);
  return useToolPriceQuotes(items);
}

/** { status, value, onRetry } for PrimaryButton / QuotedCredits from a quotes result. */
export function quoteFor(quotes, value) {
  if (quotes.status === "error") return { status: "error", value: null, onRetry: quotes.retry };
  if (value == null) return { status: "loading", value: null, onRetry: quotes.retry };
  return { status: "ready", value, onRetry: quotes.retry };
}
