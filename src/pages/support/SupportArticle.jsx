import React from "react";
import { Link, useParams } from "react-router-dom";

const ring = "ring-1 ring-white/10";
const card = `rounded-2xl bg-[#111] ${ring}`;

const ARTICLES = {
  "getting-started": {
    title: "Getting started",
    updated: "2025-08-01",
    body: [
      "Welcome to ZyloAI! This guide walks you through creating your first project, picking a tool, and rendering a preview.",
      "1) Go to Studios → AI Video Generator.",
      "2) Choose a template or open a tool; configure settings.",
      "3) Click **Generate my video** to render a preview.",
    ],
    related: ["video-overview", "account"],
  },
  "video-overview": {
    title: "Video tools overview",
    updated: "2025-08-01",
    body: [
      "Our video suite includes: 3D Cartoon, Talking Avatar, UGC/Ad, Viral Short.",
      "Templates are available in **Templates** and flow browser.",
    ],
    related: ["troubleshooting", "billing"],
  },
  "image-overview": {
    title: "Image tools overview",
    updated: "2025-08-01",
    body: ["Enhance, upscale, retouch faces, and fix blur/noise from the Image Studio."],
    related: ["getting-started"],
  },
  "billing": {
    title: "Billing & plans",
    updated: "2025-08-01",
    body: [
      "Pay monthly or yearly. You can update your payment method in Settings → Billing & plans.",
      "Refunds follow our Refund Policy in Policies.",
    ],
    related: ["policies", "account"],
  },
  "account": {
    title: "Manage your account",
    updated: "2025-08-01",
    body: ["Change display name, email and avatar in Settings → Account."],
    related: ["privacy"],
  },
  "troubleshooting": {
    title: "Troubleshooting",
    updated: "2025-08-01",
    body: [
      "If a render stalls, refresh the page and try again.",
      "Clear cache or switch network if uploads hang.",
      "Still stuck? Contact support with logs and steps to reproduce."
    ],
    related: ["contact"],
  },
  "policies": {
    title: "Policies & Legal",
    updated: "2025-08-01",
    body: ["See all policies on the Policies page."],
    related: ["billing", "privacy"],
  },
};

export default function SupportArticle() {
  const { slug } = useParams();
  const article = ARTICLES[slug];

  if (!article) {
    return (
      <div className={card + " p-5"}>
        <div className="text-lg font-extrabold mb-2">Article not found</div>
        <Link className="underline text-white/80" to="/support">Back to Support</Link>
      </div>
    );
  }

  return (
    <article className="grid gap-4 lg:grid-cols-[1fr,300px]">
      <div className={card + " p-5"}>
        <h1 className="text-xl font-extrabold mb-1">{article.title}</h1>
        <div className="text-xs text-white/50 mb-4">Last updated {article.updated}</div>
        <div className="prose prose-invert max-w-none">
          {article.body.map((p, i) => (
            <p key={i} className="text-white/80">{p}</p>
          ))}
        </div>
      </div>

      <aside className="grid gap-4">
        <div className={card + " p-4"}>
          <div className="text-sm font-semibold mb-2">Was this helpful?</div>
          <div className="flex gap-2">
            <button className="rounded-full bg-white/10 px-3 py-1.5 text-xs hover:bg-white/15">Yes</button>
            <button className="rounded-full bg-white/10 px-3 py-1.5 text-xs hover:bg-white/15">No</button>
          </div>
        </div>
        {!!article.related?.length && (
          <div className={card + " p-4"}>
            <div className="text-sm font-semibold mb-2">Related articles</div>
            <ul className="text-sm space-y-1">
              {article.related.map((r) => (
                <li key={r}><Link className="text-white/80 hover:underline" to={`/support/article/${r}`}>{ARTICLES[r]?.title || r}</Link></li>
              ))}
            </ul>
          </div>
        )}
        <div className={card + " p-4"}>
          <div className="text-sm font-semibold mb-1">Need more help?</div>
          <Link className="underline text-white/80" to="/support/contact">Contact support</Link>
        </div>
      </aside>
    </article>
  );
}
