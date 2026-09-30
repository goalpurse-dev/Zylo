// Live plan and top-up prices for the pricing page, from the plan-prices edge
// function (Stripe, cached). Every price, saving and per-day figure on the
// page is computed from those amounts (lib/pricingMath): nothing is typed in.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

const TTL_MS = 10 * 60 * 1000;
const STORAGE_KEY = "zyvo_plan_prices_v1";
let memory = null; // { at, data }

function readStored() {
  if (memory && Date.now() - memory.at < TTL_MS) return memory.data;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const entry = raw ? JSON.parse(raw) : null;
    if (entry && Date.now() - entry.at < TTL_MS && entry.data?.plans) { memory = entry; return entry.data; }
  } catch { /* storage unavailable */ }
  return null;
}

function store(data) {
  memory = { at: Date.now(), data };
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(memory)); } catch { /* non-fatal */ }
}

export async function fetchPlanPrices({ fresh = false } = {}) {
  if (!fresh) { const hit = readStored(); if (hit) return hit; }
  const { data, error } = await supabase.functions.invoke("plan-prices", { body: {} });
  if (error || !data?.plans) throw new Error(error?.message || data?.error || "PRICES_UNAVAILABLE");
  store(data);
  return data;
}

/** { status: "loading" | "ready" | "error", prices, retry } */
export function usePlanPrices() {
  const [state, setState] = useState(() => {
    const hit = readStored();
    return hit ? { status: "ready", prices: hit } : { status: "loading", prices: null };
  });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (attempt === 0 && state.status === "ready") return undefined;
    let cancelled = false;
    fetchPlanPrices({ fresh: attempt > 0 })
      .then((prices) => { if (!cancelled) setState({ status: "ready", prices }); })
      .catch(() => { if (!cancelled) setState({ status: "error", prices: null }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);
  const retry = useCallback(() => { setState({ status: "loading", prices: null }); setAttempt((n) => n + 1); }, []);
  return { ...state, retry };
}

export { formatMoney, planPriceView, maxSavingPercent } from "./pricingMath";
