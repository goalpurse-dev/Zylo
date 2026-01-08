import React from "react";
import { Link } from "react-router-dom";

const ring = "ring-1 ring-white/10";
const card = `rounded-2xl bg-[#111] ${ring}`;

const POLICIES = [
  { title: "Terms of Service", slug: "tos" },
  { title: "Privacy Policy", slug: "privacy" },
  { title: "Cookie Policy", slug: "cookies" },
  { title: "Acceptable Use Policy", slug: "aup" },
  { title: "Refund & Cancellation Policy", slug: "refunds" },
  { title: "Copyright / DMCA", slug: "dmca" },
  { title: "Data Processing Addendum (DPA)", slug: "dpa" },
];

export default function SupportPolicies() {
  return (
    <div className="grid gap-4">
      <div className={card + " p-5"}>
        <h1 className="text-xl font-extrabold mb-1">Policies & Legal</h1>
        <p className="text-sm text-white/70">
          This page lists our key legal documents. Each policy includes an effective date and version.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {POLICIES.map((p) => (
          <Link key={p.slug} to={`/support/article/policies`} className={card + " p-4 hover:bg-[#121212]"}>
            <div className="font-semibold">{p.title}</div>
            <div className="text-xs text-white/60 mt-1">Last updated: 2025-08-01 • v1.0</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
