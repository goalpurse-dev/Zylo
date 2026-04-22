import React from "react";

const WelcomeToZyloHelp     = React.lazy(() => import("./WelcomeToZyloHelp.jsx"));
const BillingAndCredits     = React.lazy(() => import("./BillingAndCredits.jsx"));
const HowToWriteAViralScript = React.lazy(() => import("./HowToWriteAViralScript.jsx"));
const ViralScriptStyles     = React.lazy(() => import("./ViralScriptStyles.jsx"));

export const CATEGORIES = [
  { id: "all",     label: "All" },
  { id: "script",  label: "Script" },
  { id: "guide",   label: "Guide" },
  { id: "billing", label: "Billing" },
];

export const POSTS = [
  {
    slug: "how-to-write-a-viral-script",
    title: "How to Write a Viral Script: Hook, Structure & Style",
    summary: "The exact framework behind viral TikTok, Reels, and YouTube scripts — hook formulas, scene structure, retention devices, and CTAs that convert.",
    date: "2026-04-22",
    category: "script",
    readTime: "8 min read",
    searchText:
      "viral script how to write viral video tiktok script youtube script hook structure cta scene retention format template creator",
    Component: HowToWriteAViralScript,
  },
  {
    slug: "8-viral-script-styles",
    title: "The 8 Viral Script Styles (And When to Use Each)",
    summary: "MrBeast Mode, TikTok Viral, Story Arc, Comedy Skit, Finance Edu — a complete breakdown of every creator script style and the structural principles behind them.",
    date: "2026-04-22",
    category: "script",
    readTime: "10 min read",
    searchText:
      "viral script styles mrbeast tiktok reels story arc comedy skit finance edu tutorial product drop viral skeleton creator format niche",
    Component: ViralScriptStyles,
  },
  {
    slug: "welcome-to-zylo-help",
    title: "Welcome to Zylo Help",
    summary: "Where to find FAQs, contact options, and release notes.",
    date: "2025-11-05",
    category: "guide",
    readTime: "2 min read",
    searchText:
      "help center overview navigation faq blog contact support categories search release notes",
    Component: WelcomeToZyloHelp,
  },
  {
    slug: "billing-and-credits",
    title: "Billing, plans & credits",
    summary: "How subscriptions, top-ups, and the credit wallet work.",
    date: "2025-11-05",
    category: "billing",
    readTime: "3 min read",
    searchText:
      "billing stripe plans top-up topups credits wallet portal upgrade downgrade webhook invoices",
    Component: BillingAndCredits,
  },
];

export function getPostBySlug(slug) {
  return POSTS.find((p) => p.slug === slug);
}
