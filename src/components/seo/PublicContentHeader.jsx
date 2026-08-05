import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { Menu, X } from "lucide-react";
import Logo from "../../assets/Logo.png";
import { CREATE_TOOLS } from "../workspace/CreateMenu.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import AuthModal from "../AuthModal.jsx";
import { trackSeoEvent } from "../../lib/seoAnalytics.js";

/**
 * Header shown ONLY on public SEO landing pages and blog posts. Visually
 * distinct from — and completely independent of — the authenticated
 * workspace ToolShell/TopRow. Navigation destinations and the Login/Sign up
 * mechanism (AuthModal) are the exact same ones ToolShell/TopRow use.
 */
export default function PublicContentHeader({ templateId, slug }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authModal, setAuthModal] = useState(null); // "login" | "signup" | null
  const menuButtonRef = useRef(null);
  const drawerRef = useRef(null);
  const wasMobileOpen = useRef(false);

  const createPath = CREATE_TOOLS.find((tool) => tool.id === templateId)?.path || "/workspace/home";

  const navItems = [
    { label: "Home", to: "/workspace/home" },
    { label: "Create", to: createPath },
  ];

  const openAuth = (mode) => {
    trackSeoEvent(mode === "signup" ? "seo_signup_clicked" : "seo_login_clicked", { slug, templateId });
    setMobileOpen(false);
    setAuthModal(mode);
  };

  // Close on route navigation from within the drawer, Escape key, and body scroll lock.
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  // Focus management: move focus into the drawer on open, return it to the
  // hamburger button on close (existing mobile-menu patterns in the repo
  // don't do this, so it's added fresh here).
  useEffect(() => {
    if (mobileOpen) {
      wasMobileOpen.current = true;
      drawerRef.current?.querySelector("a,button")?.focus();
    } else if (wasMobileOpen.current) {
      menuButtonRef.current?.focus();
      wasMobileOpen.current = false;
    }
  }, [mobileOpen]);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#0B0D0F]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4 sm:px-6">
          <Link
            to="/workspace/home"
            className="flex shrink-0 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9F5CFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0D0F]"
            aria-label="Zyvo home"
          >
            <img src={Logo} alt="" className="h-8 w-8 object-contain" />
            <span className="text-[18px] font-black tracking-[-0.03em] text-white">Zyvo</span>
          </Link>

          <nav className="hidden items-center gap-7 lg:flex">
            {navItems.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className="rounded text-[14px] font-medium text-white/60 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9F5CFF]"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            {user ? (
              <button
                type="button"
                onClick={() => navigate("/workspace/home")}
                className="rounded-lg bg-gradient-to-r from-[#7A3BFF] to-[#9F5CFF] px-5 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Go to Workspace
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => openAuth("login")}
                  className="rounded-lg bg-[#2A1660] px-5 py-1.5 text-sm font-medium text-[#B794FF] transition hover:bg-[#331B78]"
                >
                  Log in
                </button>
                <button
                  type="button"
                  onClick={() => openAuth("signup")}
                  className="rounded-lg bg-gradient-to-r from-[#7A3BFF] to-[#9F5CFF] px-5 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  Sign up
                </button>
              </>
            )}
          </div>

          {/* Mobile: show auth actions when there's room, otherwise just the hamburger */}
          <div className="flex items-center gap-2 lg:hidden">
            {user ? (
              <button
                type="button"
                onClick={() => navigate("/workspace/home")}
                className="hidden min-[420px]:block rounded-lg bg-gradient-to-r from-[#7A3BFF] to-[#9F5CFF] px-3.5 py-1.5 text-[13px] font-semibold text-white"
              >
                Workspace
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => openAuth("login")}
                  className="hidden min-[420px]:block rounded-lg bg-[#2A1660] px-3.5 py-1.5 text-[13px] font-medium text-[#B794FF]"
                >
                  Log in
                </button>
                <button
                  type="button"
                  onClick={() => openAuth("signup")}
                  className="hidden min-[420px]:block rounded-lg bg-gradient-to-r from-[#7A3BFF] to-[#9F5CFF] px-3.5 py-1.5 text-[13px] font-semibold text-white"
                >
                  Sign up
                </button>
              </>
            )}
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              aria-expanded={mobileOpen}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-white/70"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {mobileOpen &&
        createPortal(
          <div className="fixed inset-0 z-[200] lg:hidden" role="presentation">
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <div
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-label="Site menu"
              className="absolute inset-x-0 top-0 max-h-[100dvh] overflow-y-auto rounded-b-[24px] border-b border-white/10 bg-[#0E1016] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.6)]"
            >
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src={Logo} alt="" className="h-7 w-7 object-contain" />
                  <span className="text-[16px] font-black text-white">Zyvo</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close menu"
                  className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-white/60"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav className="flex flex-col gap-1">
                {navItems.map((item) => (
                  <Link
                    key={item.label}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className="min-h-[44px] rounded-xl px-3 py-3 text-left text-[15px] font-semibold text-white/85 transition hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9F5CFF]"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>

              <div className="my-4 h-px bg-white/10" />

              <div className="flex flex-col gap-2.5">
                {user ? (
                  <Link
                    to="/workspace/home"
                    onClick={() => setMobileOpen(false)}
                    className="min-h-[44px] rounded-xl bg-gradient-to-r from-[#7A3BFF] to-[#9F5CFF] px-4 py-3 text-[15px] font-semibold text-white"
                  >
                    Go to Workspace
                  </Link>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => openAuth("login")}
                      className="min-h-[44px] rounded-xl bg-[#2A1660] px-4 py-3 text-[15px] font-semibold text-[#B794FF]"
                    >
                      Log in
                    </button>
                    <button
                      type="button"
                      onClick={() => openAuth("signup")}
                      className="min-h-[44px] rounded-xl bg-gradient-to-r from-[#7A3BFF] to-[#9F5CFF] px-4 py-3 text-[15px] font-semibold text-white"
                    >
                      Sign up
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}

      {authModal && <AuthModal mode={authModal} onClose={() => setAuthModal(null)} />}
    </>
  );
}
