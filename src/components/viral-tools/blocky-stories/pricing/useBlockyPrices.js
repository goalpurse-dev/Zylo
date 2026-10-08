import { useMemo } from "react";
import useToolPriceQuotes from "../../../../hooks/useToolPriceQuotes";
import { SCRIPT_TOOL_KEY, priceItems } from "./blockyEstimates";

const SCRIPT_ITEMS = [{ id: "script", tool_key: SCRIPT_TOOL_KEY, input: {} }];

/**
 * Server quotes for Blocky Stories at one aspect.
 *   status/retry come straight from useToolPriceQuotes;
 *   prices is { image, "clip:v2", "clip:v3", "clip:v4", script } for blockyEstimates.
 *
 * script is the script's share of the picture step, asked for on its own: when the server has no price for
 * it, there is no share (0), and the server charges none either, because it reads the same row.
 */
export default function useBlockyPrices(aspect = "9:16") {
  const items = useMemo(() => priceItems(aspect), [aspect]);
  const quotes = useToolPriceQuotes(items);
  const share = useToolPriceQuotes(SCRIPT_ITEMS);
  const noShare = share.errors.script === "NO_SERVER_PRICE";
  const script = noShare ? 0 : share.prices.script ?? null;
  const status = quotes.status !== "ready" || noShare ? quotes.status : share.status;
  const { retry: retryQuotes } = quotes;
  const { retry: retryShare } = share;
  return useMemo(
    () => ({ ...quotes, status, prices: { ...quotes.prices, script }, retry: () => { retryQuotes(); retryShare(); } }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [quotes.prices, quotes.errors, status, script, retryQuotes, retryShare],
  );
}

/** { status, value, onRetry } for PrimaryButton / QuotedCredits from a quotes result. */
export function quoteFor(quotes, value) {
  if (quotes.status === "error") return { status: "error", value: null, onRetry: quotes.retry };
  if (value == null) return { status: "loading", value: null, onRetry: quotes.retry };
  return { status: "ready", value, onRetry: quotes.retry };
}
