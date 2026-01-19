// src/pages/settings/Billing.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const card = "rounded-2xl border border-black/30 bg-[#ECE8F2] p-5 text-white";
const FUNCTION_PORTAL = "create-portal-session";  // your existing function
const FUNCTION_SUMMARY = "billing-summary";       // your summary function

function formatDate(unixSeconds) {
  if (!unixSeconds) return "—";
  try {
    return new Date(unixSeconds * 1000).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export default function Billing() {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState(null);

  const planLabel = useMemo(() => {
    if (!summary?.plan) return "—";
    const p = summary.plan;
    const amt = (p.amount || 0) / 100;
    const intl = p.interval === "year" ? "/yr" : "/mo";
    return `${p.nickname || "Plan"} — $${amt}${intl}`;
  }, [summary]);

  const planStatusBadge = useMemo(() => {
    const p = summary?.plan;
    if (!p) return null;

    // If user has scheduled cancellation
    if (p.cancel_at_period_end && p.current_period_end) {
      return (
        <div className="mt-1 inline-flex items-center rounded-full bg-yellow-500/15 px-2 py-0.5 text-xs text-yellow-200 ring-1 ring-yellow-500/30">
          Cancels {formatDate(p.current_period_end)}
        </div>
      );
    }

    // If already canceled
    if (p.status === "canceled") {
      return (
        <div className="mt-1 inline-flex items-center rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-200 ring-1 ring-red-500/30">
          Canceled
        </div>
      );
    }

    // Otherwise show next renewal when available
    if (p.current_period_end) {
      return (
        <div className="mt-1 inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/70 ring-1 ring-white/15">
          Renews {formatDate(p.current_period_end)}
        </div>
      );
    }

    return null;
  }, [summary]);

  async function openPortal(flow) {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke(FUNCTION_PORTAL, {
        method: "POST",
        body: {
          flow,
          returnPath: "/settings/billing?from=portal",
        },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("No portal URL returned.");
      window.location.href = data.url;
    } catch (e) {
      console.error("Open portal failed:", e);
      alert(e.message || "Failed to open billing portal.");
    } finally {
      setLoading(false);
    }
  }

  async function loadSummary() {
    try {
      setRefreshing(true);
      const { data, error } = await supabase.functions.invoke(FUNCTION_SUMMARY, {
        method: "POST",
        body: {},
      });
      if (error) throw error;
      setSummary(data || null);
    } catch (e) {
      console.error("Load billing summary failed:", e);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadSummary();

    // auto-refresh when returning from portal
    const params = new URLSearchParams(window.location.search);
    if (params.get("from") === "portal" || params.has("from=portal")) {
      loadSummary();
      const url = new URL(window.location.href);
      url.searchParams.delete("from");
      history.replaceState({}, "", url.toString());
    }
  }, []);

  const pm = summary?.payment_method;
  const invoices = summary?.invoices || [];

  return (
    <div className="grid gap-4">
      {/* Current plan */}
      <div className={card}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[11px] uppercase text-[#110829]">Current plan</div>
            <div className="text-lg text-[#110829] font-bold">
              {summary?.plan?.nickname || "—"}
            </div>
            <div className="text-sm text-[#110829]">{planLabel}</div>
            {planStatusBadge}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => openPortal("change_plan")}
              disabled={loading}
              className="rounded-full border border-black/30 bg-white px-4 py-2 text-sm font-semibold text-[#110829] hover:bg-gray-50 disabled:opacity-60"
            >
              {loading ? "Opening…" : "Change plan"}
            </button>
            <button
              onClick={() => openPortal("update")}
              disabled={loading}
              className="rounded-full bg-[#7A3BFF] px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
            >
              {loading ? "Opening…" : "Update payment"}
            </button>
            <button
              onClick={loadSummary}
              disabled={refreshing}
              className="rounded-full border border-black/30 bg-white px-4 py-2 text-sm font-semibold text-[#110829] hover:bg-gray-50 disabled:opacity-60"
              title="Refresh from Stripe"
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      {/* Payment method */}
      <div className={card}>
        <div className="mb-3 text-sm font-semibold text-[#110829]">Payment method</div>
        <div className="flex items-center justify-between rounded-lg bg-[#F7F5FA] p-3">
          <div className="text-sm text-[#110829]">
            {pm
              ? `${pm.brand || "Card"} •••• ${pm.last4 || "••••"} — exp ${pm.exp || "••/••"}`
              : "—"}
          </div>
          <button
            onClick={() => openPortal("update")}
            disabled={loading}
            className="rounded-lg border border-black/30 text-[#110829] bg-white px-5 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-60"
          >
            {loading ? "Opening…" : "Edit"}
          </button>
        </div>
      </div>

      {/* Invoices */}
      <div className={card}>
        <div className="mb-3 text-sm font-semibold text-[#110829]">Invoices</div>

        {invoices.length === 0 ? (
          <div className="flex items-center justify-between rounded-lg bg-[#F7F5FA] p-4 text-sm text-[#110829] ring-1 ring-white/10">
            <span>View and download your invoices in the billing portal.</span>
            <button
              onClick={() => openPortal("invoices")}
              disabled={loading}
              className="rounded-full border border-black/30 bg-white px-3 py-1.5 text-sm font-semibold text-[#110829] hover:bg-gray-50 disabled:opacity-60"
            >
              {loading ? "Opening…" : "See invoices"}
            </button>
          </div>
        ) : (
          <div className="rounded-lg bg-white/5 p-2 ring-1 ring-white/10">
            {invoices.map((inv) => (
              <a
                key={inv.id}
                href={inv.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-white/10"
              >
                <span>
                  {new Date(inv.created * 1000).toLocaleDateString()} — $
                  {(inv.amount_paid / 100).toFixed(2)} ({inv.status})
                </span>
                <span className="text-white">Open</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
