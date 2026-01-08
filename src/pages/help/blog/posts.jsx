import React from "react";

// Lazy-loaded post components
const WelcomeToZyloHelp = React.lazy(() => import("./WelcomeToZyloHelp.jsx"));
const BillingAndCredits = React.lazy(() => import("./BillingAndCredits.jsx"));

export const POSTS = [
  {
    slug: "welcome-to-zylo-help",
    title: "Welcome to Zylo Help",
    summary: "Where to find FAQs, contact options, and release notes.",
    date: "2025-11-05",
    searchText:
      "help center overview navigation faq blog contact support categories search release notes",
    Component: WelcomeToZyloHelp,
  },
  {
    slug: "billing-and-credits",
    title: "Billing, plans & credits",
    summary: "How subscriptions, top-ups, and the credit wallet work.",
    date: "2025-11-05",
    searchText:
      "billing stripe plans top-up topups credits wallet portal upgrade downgrade webhook invoices",
    Component: BillingAndCredits,
  },
];

export function getPostBySlug(slug) {
  return POSTS.find((p) => p.slug === slug);
}
