// src/pages/settings/Billing.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import Toast from "../../components/ui/Toast";
import { useNavigate } from "react-router-dom";
import { CreditCard, RotateCcw } from "lucide-react";
import CancelFeedbackModal from "../../components/billing/CancelFeedbackModal";

const card = "rounded-2xl border border-[#1F2230] bg-[#141622] p-5 text-white";
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
  const [loading, setLoading] = useState(null); // "cancel" | "resume" | "portal"
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const navigate = useNavigate();

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

function cancelSubscription() {
  if (!summary?.plan) { Toast.error("No active subscription"); return; }
  setShowCancelModal(true);
}

async function confirmCancel() {
  setShowCancelModal(false);
  try {
    setLoading("cancel");
    const { error } = await supabase.functions.invoke("cancel-subscription", { method: "POST" });
    if (error) throw error;
    Toast.success(`Access continues until ${formatDate(summary.plan.current_period_end)}`);
    await loadSummary();
  } catch (e) {
    Toast.error(e.message || "Failed to cancel subscription");
  } finally {
    setLoading(null);
  }
}

async function resumeSubscription() {
  if (!summary?.plan) {
    Toast.error("No active subscription");
    return;
  }

  try {
    setLoading("resume");

    const { error } = await supabase.functions.invoke(
      "resume-subscription",
      { method: "POST" }
    );

    if (error) throw error;

    Toast.success("Your subscription is active again");

    await loadSummary();
  } catch (e) {
    Toast.error(e.message);
  } finally {
    setLoading(null);
  }
}

  async function openPortal(flow) {
    try {
      setLoading("portal");
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
    Toast.error(e.message || "Failed to open billing portal.");
    } finally {
      setLoading(null);
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
    <>
    <CancelFeedbackModal
      open={showCancelModal}
      onClose={() => setShowCancelModal(false)}
      onConfirmCancel={confirmCancel}
      onResume={() => { setShowCancelModal(false); resumeSubscription(); }}
      periodEnd={formatDate(summary?.plan?.current_period_end)}
      planCode={summary?.plan?.nickname}
      isProcessing={loading === "cancel" || loading === "resume"}
    />
    <div className="grid gap-4">
      {/* Current plan */}
      <div className={card}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[11px] uppercase text-[#F4F6FB]">Current plan</div>
            <div className="text-lg text-[#F4F6FB] font-bold">
              {summary?.plan?.nickname || "—"}
            </div>
           <div className="text-sm text-[#B7BBC6]">{planLabel}</div>
{planStatusBadge}

{summary?.plan && (
  <div className="text-xs text-[#B7BBC6] mt-1">
    {summary.plan.cancel_at_period_end
      ? `Your plan ends on ${formatDate(summary.plan.current_period_end)}`
      : "Active • Auto-renews"}
  </div>
)}
          </div>

<div className="flex gap-2 flex-wrap items-center justify-end">

  {/* PRIMARY ACTION */}
<button
  onClick={() => openPortal("update")}
  disabled={loading === "portal"}
  className="rounded-full bg-[#7A3BFF] px-4 py-2 text-sm font-semibold text-white hover:opacity-95 hover:shadow-lg hover:shadow-purple-500/20 disabled:opacity-60"
>
  <span className="flex items-center gap-1">
    <CreditCard className={`w-4 h-4 ${loading === "portal" ? "animate-spin" : ""}`} />
    {loading === "portal" ? "Opening…" : "Update"}
  </span>
</button>

  {/* PLAN ACTION */}
  {summary?.plan?.cancel_at_period_end ? (
    /* ── Cancelled — big green Continue button ── */
    <button
      onClick={resumeSubscription}
      disabled={loading === "resume"}
      className="flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white shadow-[0_4px_20px_rgba(34,197,94,0.35)] transition hover:bg-emerald-400 active:scale-[0.97] disabled:opacity-60"
    >
      <RotateCcw className={`h-4 w-4 ${loading === "resume" ? "animate-spin" : ""}`} />
      {loading === "resume" ? "Resuming…" : "Continue plan"}
    </button>
  ) : summary?.plan ? (
    /* ── Active — subtle cancel ── */
    <button
      onClick={cancelSubscription}
      disabled={loading === "cancel"}
      className="rounded-full border border-white/10 bg-transparent px-3 py-1.5 text-xs font-medium text-[#8F95A3] transition hover:border-red-400/25 hover:bg-red-500/5 hover:text-red-300 disabled:opacity-60"
    >
      {loading === "cancel" ? "Processing…" : "Cancel plan"}
    </button>
  ) : (
    <button
      onClick={() => navigate("/workspace/pricing")}
      className="rounded-full border border-[#1F2230] bg-[#141622] px-4 py-2 text-sm font-semibold text-[#B7BBC6] hover:bg-[#1A1D2B]"
    >
      Get plan
    </button>
  )}

</div>
        </div>
      </div>

      {/* Payment method */}
      <div className={card}>
        <div className="mb-3 text-sm font-semibold text-[#F4F6FB]">Payment method</div>
        <div className="flex items-center justify-between rounded-lg bg-[#1A1D2B] p-3">
          <div className="text-sm text-[#E6E8EE]">
            {pm
              ? `${pm.brand || "Card"} •••• ${pm.last4 || "••••"} — exp ${pm.exp || "••/••"}`
              : "—"}
          </div>
        <button
  onClick={() => openPortal("update")}
  disabled={loading === "portal"}
  className="rounded-lg border border-[#1F2230] text-[#B7BBC6] bg-[#141622] px-5 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-60"
>
  {loading === "portal" ? "Opening…" : "Edit"}
</button>
        </div>
      </div>

      {/* Invoices */}
      <div className={card}>
        <div className="mb-3 text-sm font-semibold text-[#F4F6FB]">Invoices</div>

        {invoices.length === 0 ? (
          <div className="flex items-center justify-between rounded-lg bg-[#1A1D2B] p-4 text-sm text-[#B7BBC6] ring-1 ring-white/10">
            <span>View and download your invoices in the billing portal.</span>
        <button
  onClick={() => openPortal("invoices")}
  disabled={loading === "portal"}
  className="rounded-full border border-[#1F2230] bg-[#141622] px-3 py-1.5 text-sm font-semibold text-[#B7BBC6] hover:bg-gray-50 disabled:opacity-60"
>
  {loading === "portal" ? "Opening…" : "See invoices"}
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
    </>
  );
}
