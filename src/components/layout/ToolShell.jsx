import React, { useEffect, useState } from "react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  Home,
  Images,
  GalleryVerticalEnd,
  Wand2,
  Palette,
  Package,
  Sparkles,
  Settings,
  Video,
  CreditCard,
  CircleHelp,
  Menu,
  X,
  Globe,
  MessageCircle,
  Wrench,
  ChevronDown,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import { getCurrentBrand } from "../../lib/brandSession";
import ZyloLogo from "../../assets/zylo.png";

/* ---------- credits: read from Supabase + realtime ---------- */
function useProfileCredits() {
  const [credits, setCredits] = useState(0);

  useEffect(() => {
    let mounted = true;
    let channel;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        mounted && setCredits(0);
        return;
      }

      // initial fetch
      const { data } = await supabase
        .from("profiles")
        .select("credit_balance")
        .eq("id", user.id)
        .single();
      if (mounted) setCredits(data?.credit_balance ?? 0);

      // realtime updates for this profile row
      channel = supabase
        .channel(`credits_${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${user.id}`,
          },
          (payload) => {
            const next = payload?.new?.credit_balance;
            if (typeof next === "number") setCredits(next);
          },
        )
        .subscribe();
    })();

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return credits;
}

/* ---------- tiny credit glyph ---------- */
function CreditGlyph({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <g fill="#2F57EB">
        <rect
          x="10"
          y="2"
          width="4"
          height="4"
          rx="1"
          transform="rotate(45 12 4)"
        />
        <rect
          x="18"
          y="10"
          width="4"
          height="4"
          rx="1"
          transform="rotate(45 20 12)"
        />
        <rect
          x="2"
          y="10"
          width="4"
          height="4"
          rx="1"
          transform="rotate(45 4 12)"
        />
        <rect
          x="10"
          y="18"
          width="4"
          height="4"
          rx="1"
          transform="rotate(45 12 20)"
        />
      </g>
    </svg>
  );
}

/* ---------- small credit chip (sidebar) ---------- */
function CreditChipSmall() {
  const credits = useProfileCredits();
  const formatted = Intl.NumberFormat().format(credits);
  return (
    <Link
      to="/pricing"
      className="zylo-credit-chip w-full sm:w-auto"
      title="View / buy credits"
    >
      <CreditGlyph className="h-4 w-4" />
      {formatted}
    </Link>
  );
}

/* ---------- brand detection ---------- */
function useHasBrand() {
  const { user } = useAuth();
  const [hasBrand, setHasBrand] = useState(null);
  useEffect(() => {
    let mounted = true;
    async function run() {
      if (!user?.id) {
        mounted && setHasBrand(false);
        return;
      }
      const { data, error } = await supabase
        .from("brands")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      mounted && setHasBrand(!error && !!data);
    }
    run();
    return () => {
      mounted = false;
    };
  }, [user?.id]);
  return hasBrand;
}

/* ---------- brand-gate helpers ---------- */
function isGateUnlocked() {
  return !!getCurrentBrand();
}
function markPendingRoute(intendedRoute) {
  try {
    if (intendedRoute)
      localStorage.setItem("pendingBrandRoute", intendedRoute);
  } catch {}
}
function consumePendingIfReady(pathname, navigate) {
  try {
    const pending = localStorage.getItem("pendingBrandRoute");
    const cur = getCurrentBrand();
    if (!pending || !cur?.id) return;
    const target = pending === "/brand" ? `/brand/${cur.id}` : pending;
    if (pathname !== target) {
      localStorage.removeItem("pendingBrandRoute");
      navigate(target, { replace: true });
    } else {
      localStorage.removeItem("pendingBrandRoute");
    }
  } catch {}
}
const BRAND_ROUTES = new Set([
  "/brand",
  "/avatar-studio",
  "/ad-studio",
  "/product-photos",
  "/enhancements",
]);

/* ---------- sidebar base ---------- */
const sidebarBase =
  "md:fixed md:inset-y-0 md:left-0 md:h-screen md:w-64 " +
  "w-64 shrink-0 flex flex-col gap-2 overflow-y-auto " +
  "zylo-sidebar-card px-3 py-4 z-40";

function Section({ title, children }) {
  return (
    <div className="mt-2">
      {title && <div className="px-2 pb-1 zylo-section-title">{title}</div>}
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

export default function ToolShell({ children, noSidebar = false }) {
  useHasBrand();

  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const isAuthed = !!user?.id;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (BRAND_ROUTES.has(pathname) && !isGateUnlocked()) {
      markPendingRoute(pathname);
      navigate("/brands", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    const tryConsume = () => consumePendingIfReady(pathname, navigate);
    tryConsume();
    const onFocus = () => tryConsume();
    const onStorage = (e) => {
      if (e.key === "curBrand" || e.key === "activeBrandId") tryConsume();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
    };
  }, [pathname, navigate]);

  useEffect(() => {
    if (mobileOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const Item = ({ to, icon: Icon, label }) => (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `${isActive ? "zylo-navitem zylo-navitem-active" : "zylo-navitem"}`
      }
      onClick={() => setMobileOpen(false)}
    >
      <Icon className="zylo-navicon" />
      <span>{label}</span>
    </NavLink>
  );

  const BrandItem = ({ to, icon: Icon, label }) => {
    const target = isGateUnlocked() ? to : "/brands";
    return (
      <NavLink
        to={target}
        end
        onClick={(e) => {
          if (!isGateUnlocked()) {
            e.preventDefault();
            markPendingRoute(to);
            navigate("/brands");
          } else {
            setMobileOpen(false);
          }
        }}
        className={({ isActive }) =>
          `${isActive ? "zylo-navitem zylo-navitem-active" : "zylo-navitem"}`
        }
      >
        <Icon className="zylo-navicon" />
        <span>{label}</span>
      </NavLink>
    );
  };

  const BrandHomeItem = () => {
    const cur = getCurrentBrand();
    const to = cur?.id ? `/brand/${cur.id}` : "/brands";
    return (
      <NavLink
        to={to}
        end
        onClick={(e) => {
          if (!cur?.id) {
            e.preventDefault();
            markPendingRoute("/brand");
            navigate("/brands");
          } else {
            setMobileOpen(false);
          }
        }}
        className={({ isActive }) =>
          `${isActive ? "zylo-navitem zylo-navitem-active" : "zylo-navitem"}`
        }
      >
        <Home className="zylo-navicon" />
        <span>Brand home</span>
      </NavLink>
    );
  };

  const btnPrimary =
    "inline-flex items-center justify-center w-full rounded-xl bg-gradient-to-r from-[#7A3BFF] via-[#9B4DFF] to-[#FF57B2] text-white font-semibold px-4 py-2 text-sm shadow-lg hover:opacity-95 active:scale-[.99] transition";
  const btnGhost =
    "inline-flex items-center justify-center w-full rounded-xl border border-white/15 bg-white/10 text-white px-4 py-2 text-sm hover:bg-white/15 transition";

  function SidebarContent() {
    return (
      <>
        {/* logo row */}
        <div className="mb-2 flex items-center justify-between px-2">
          <Link
            to="/"
            className="flex items-center gap-2 py-1.5"
            onClick={() => setMobileOpen(false)}
          >
            <img
              src={ZyloLogo}
              alt="Zylo logo"
              className="h-6 w-6 object-contain"
              draggable="false"
            />
            <span className="font-extrabold tracking-tight">Zylo</span>
          </Link>
        </div>

        {/* POPULAR tools */}
        <Section title="Popular">
          <Item to="/Figma" icon={Home} label="Home" />
          {/* <Item to="/chat" icon={MessageCircle} label="Zylo Chat" /> */}

          <Item to="/library" icon={GalleryVerticalEnd} label="Library" />
          <Item to="/textimage" icon={Images} label="Image to Text" />
          <Item to="/textvideo" icon={Video} label="Text to Video" />

          {/* More dropdown under Text to Video */}
          {/* 
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className="zylo-navitem justify-between mt-1"
          >
            <div className="flex items-center gap-2">
              <Wrench className="zylo-navicon" />
              <span>More tools</span>
            </div>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${
                moreOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {moreOpen && (
            <div className="mt-1 pl-6 flex flex-col gap-1">
              <NavLink
                to="/text-to-voice"
                end
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `${
                    isActive
                      ? "zylo-navitem zylo-navitem-active"
                      : "zylo-navitem"
                  } text-sm`
                }
              >
                <Sparkles className="zylo-navicon" />
                <span>Text to Voice</span>
              </NavLink>
            </div>
          )}
          */}
        </Section>

        <Section title="Brand tools">
          <BrandHomeItem />
          <BrandItem
            to="/brand/workspace"
            icon={Palette}
            label="Brand workspace"
          />
          <BrandItem to="/ad-studio" icon={Wand2} label="Ad studio" />
          <BrandItem
            to="/product-photos"
            icon={Package}
            label="Product photos"
          />
        </Section>

        {/* Coming soon block */}
        <Section title="COMING SOON">
          <div
            className="zylo-navitem opacity-60 cursor-not-allowed select-none"
            aria-disabled="true"
            title="Coming soon"
          >
            <Globe className="zylo-navicon" />
            <span>WEBSITE GENERATOR (PRO→)</span>
          </div>
        </Section>

        {/* spacer before footer (mobile mainly) */}
        <div className="mt-5 md:mt-2" />

        {/* Footer zone */}
        <div className="mt-auto flex flex-col gap-2 px-2 pb-2">
          <Item to="/pricing" icon={CreditCard} label="Pricing" />
          <Item to="/help" icon={CircleHelp} label="Help" />
          <Item to="/zylo" icon={Sparkles} label="Zylo" />
          <Item to="/settings" icon={Settings} label="Settings" />

          <div className="border-t border-white/10 pt-3 grid gap-2">
            {isAuthed ? (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <CreditChipSmall />
              </div>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  className={btnPrimary}
                >
                  Log in
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setMobileOpen(false)}
                  className={btnGhost}
                >
                  Create account
                </Link>
              </>
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="tool-shell min-h-screen bg-[#0b0f14] text-white md:flex">
      {!noSidebar && (
        <aside className={["hidden md:flex", sidebarBase].join(" ")}>
          <SidebarContent />
        </aside>
      )}
      {!noSidebar && <div className="hidden md:block md:w-64" aria-hidden />}
      {!noSidebar && (
        <button
          type="button"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
          className="fixed right-4 top-4 z-50 md:hidden inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 hover:bg-white/15 active:scale-95 transition"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      )}
      {!noSidebar && (
        <div
          className={`md:hidden fixed inset-0 z-40 transition-opacity duration-200 ${
            mobileOpen
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0"
          }`}
          aria-hidden={!mobileOpen}
          onClick={() => setMobileOpen(false)}
        >
          <div className="absolute inset-0 bg-black/60" />
          <aside
            className={`absolute inset-0 overflow-y-auto ${sidebarBase} w-full bg-[#0d1117] border-r-0`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="max-w-[640px] mx-auto w-full">
              <SidebarContent />
            </div>
          </aside>
        </div>
      )}
      <main className="w-full min-w-0 flex-1">{children}</main>
    </div>
  );
}
