import { useState, useEffect } from "react";
import Logo from "../../../assets/Logo.png";
import { ChevronDown, X, Menu } from "lucide-react";
import { Link } from "react-router-dom";

const tools = [
  { label: "Image Generator", to: "/workspace/image-generator", desc: "20+ AI styles" },
  { label: "Video Generator",  to: "/workspace/video-generator",  desc: "10+ video models" },
  { label: "Creations",        to: "/workspace/creations",        desc: "Your saved work" },
];

const GoogleIcon = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

export default function Navbar() {
  const [toolsOpen, setToolsOpen] = useState(false);
  const [menuOpen, setMenuOpen]   = useState(false);
  const [mobileTools, setMobileTools] = useState(false);

  // close tools dropdown on outside click
  useEffect(() => {
    if (!toolsOpen) return;
    const close = () => setToolsOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [toolsOpen]);

  // lock body scroll when mobile menu open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  return (
    <>
      <header className="sticky top-0 z-50 w-full bg-white border-b border-gray-200/80 shadow-sm">
        <div className="max-w-7xl mx-auto px-5 lg:px-10 h-16 flex items-center justify-between gap-6">

          {/* LOGO */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src={Logo} alt="Zyvo" className="h-8 w-8" />
            <span className="text-[#7A3BFF] font-bold text-xl tracking-tight">ZyvoAI</span>
          </Link>

          {/* DESKTOP NAV */}
          <nav className="hidden lg:flex items-center gap-8">
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setToolsOpen((o) => !o); }}
                className="flex items-center gap-1.5 text-gray-700 font-semibold text-[15px] hover:text-[#7A3BFF] transition"
              >
                Tools
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${toolsOpen ? "rotate-180" : ""}`} />
              </button>

              {toolsOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-full left-0 mt-3 w-64 bg-white rounded-2xl shadow-xl shadow-black/10 border border-gray-100 p-2 z-50"
                >
                  {tools.map((t) => (
                    <Link
                      key={t.to}
                      to={t.to}
                      onClick={() => setToolsOpen(false)}
                      className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-purple-50 group transition"
                    >
                      <span className="text-sm font-semibold text-gray-800 group-hover:text-[#7A3BFF] transition">{t.label}</span>
                      <span className="text-xs text-gray-400">{t.desc}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <Link to="/workspace/pricing" className="text-[15px] font-semibold text-gray-700 hover:text-[#7A3BFF] transition">Pricing</Link>
            <Link to="/support"           className="text-[15px] font-semibold text-gray-700 hover:text-[#7A3BFF] transition">Help</Link>
            <Link to="/login"             className="text-[15px] font-semibold text-gray-700 hover:text-[#7A3BFF] transition">Login</Link>
          </nav>

          {/* DESKTOP CTAs */}
          <div className="hidden lg:flex items-center gap-3">
            <Link
              to="/signup"
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-[15px] font-semibold text-gray-700 transition"
            >
              <GoogleIcon />
              Continue with Google
            </Link>
            <Link
              to="/signup"
              className="px-5 py-2.5 rounded-xl text-white text-[15px] font-bold transition hover:opacity-90"
              style={{
                background: "linear-gradient(135deg, #7A3BFF, #9D6BFF)",
                boxShadow: "0 4px 16px rgba(122,59,255,0.4)",
              }}
            >
              Sign Up Free
            </Link>
          </div>

          {/* MOBILE RIGHT */}
          <div className="lg:hidden flex items-center gap-2">
            <Link
              to="/signup"
              className="px-4 py-2 rounded-xl text-white text-sm font-bold"
              style={{ background: "linear-gradient(135deg, #7A3BFF, #9D6BFF)" }}
            >
              Sign Up
            </Link>
            <button
              onClick={() => setMenuOpen(true)}
              className="p-2 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

        </div>
      </header>

      {/* MOBILE MENU — rendered outside header to guarantee full-screen */}
      {menuOpen && (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col">

          {/* Top bar */}
          <div className="flex items-center justify-between px-6 h-16 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2">
              <img src={Logo} alt="Zyvo" className="h-7 w-7" />
              <span className="text-[#7A3BFF] font-bold text-lg">ZyvoAI</span>
            </div>
            <button
              onClick={() => setMenuOpen(false)}
              className="p-2 rounded-xl hover:bg-gray-100 transition"
            >
              <X className="w-5 h-5 text-gray-700" />
            </button>
          </div>

          {/* Links — scrollable middle */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-2">

            {/* Tools accordion */}
            <button
              onClick={() => setMobileTools((o) => !o)}
              className="w-full flex items-center justify-between px-4 py-4 rounded-2xl bg-gray-50 text-gray-800 font-semibold text-sm"
            >
              Tools
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${mobileTools ? "rotate-180" : ""}`} />
            </button>

            {mobileTools && (
              <div className="pl-2 space-y-1.5">
                {tools.map((t) => (
                  <Link
                    key={t.to}
                    to={t.to}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center justify-between px-4 py-3.5 rounded-xl bg-white border border-gray-100 hover:border-[#7A3BFF]/40 transition"
                  >
                    <span className="text-sm font-semibold text-gray-800">{t.label}</span>
                    <span className="text-xs text-gray-400">{t.desc}</span>
                  </Link>
                ))}
              </div>
            )}

            {[
              { label: "Pricing", to: "/workspace/pricing" },
              { label: "Help",    to: "/support" },
              { label: "Login",   to: "/login" },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                className="block px-4 py-4 rounded-2xl bg-gray-50 text-sm font-semibold text-gray-800 hover:bg-gray-100 transition"
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Bottom CTAs — always visible */}
          <div className="px-6 py-6 border-t border-gray-100 space-y-3 shrink-0">
            <Link
              to="/signup"
              onClick={() => setMenuOpen(false)}
              className="flex items-center justify-center w-full py-4 rounded-2xl text-white font-bold text-sm"
              style={{
                background: "linear-gradient(135deg, #7A3BFF, #9D6BFF)",
                boxShadow: "0 4px 20px rgba(122,59,255,0.35)",
              }}
            >
              Sign Up Free
            </Link>
            <Link
              to="/signup"
              onClick={() => setMenuOpen(false)}
              className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-white border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
            >
              <GoogleIcon />
              Continue with Google
            </Link>
          </div>

        </div>
      )}
    </>
  );
}
