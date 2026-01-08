import React from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Search, Home } from "lucide-react";

const wrap = "min-h-screen bg-[#0b0b0b] text-white";
const ring = "ring-1 ring-white/10";
const card = `rounded-2xl bg-[#111] ${ring}`;

export default function SupportLayout() {
  const loc = useLocation();
  const crumbs = buildCrumbs(loc.pathname);

  return (
    <div className={wrap}>
      <header className="border-b border-white/10 bg-[#0c0c0d]">
        <div className="mx-auto max-w-6xl px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/support" className="inline-flex items-center gap-2 font-extrabold">
            <Home className="h-5 w-5" />
            Support Center
          </Link>

          {/* global search (client-only; wire later) */}
          <div className={`flex items-center gap-2 rounded-full bg-[#0b0b0b] px-3 py-2 w-full sm:w-[420px] ${ring}`}>
            <Search className="h-4 w-4 text-white/50" />
            <input
              placeholder="Search help, policies, or topics…"
              className="bg-transparent outline-none w-full placeholder:text-white/40 text-sm"
            />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6">
        <nav className="mb-4 text-xs text-white/60 flex items-center gap-2">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-2">
              {i > 0 && <span className="opacity-40">/</span>}
              {c.href ? (
                <Link to={c.href} className="hover:text-white">{c.label}</Link>
              ) : (
                <span className="text-white">{c.label}</span>
              )}
            </span>
          ))}
        </nav>

        <main className="grid gap-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function buildCrumbs(path) {
  const parts = path.split("/").filter(Boolean);
  const crumbs = [{ label: "Support", href: "/support" }];
  if (parts.length <= 1) return crumbs;

  if (parts[1] === "article") crumbs.push({ label: "Article" });
  if (parts[1] === "policies") crumbs.push({ label: "Policies" });
  if (parts[1] === "contact") crumbs.push({ label: "Contact" });
  return crumbs;
}
