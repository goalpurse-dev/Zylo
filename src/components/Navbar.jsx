// src/components/Navbar.jsx
import React, { useRef, useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { signOut } from "../lib/auth";
import { useCredits } from "../hooks/useCredits";
import ZyloMark from "../assets/zylo.png";

/* ------------------- Tiny icons ------------------- */
const ChevronDown = ({ className = "" }) => (
  <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SettingsIcon = ({ className = "" }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09c.7 0 1.31-.4 1.51-1a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06c.51.51 1.25.67 1.82.33.45-.26.73-.74.73-1.26V3a2 2 0 1 1 4 0v.09c0 .52.28 1 .73 1.26.57.34 1.31.18 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06c-.36.36-.49.92-.33 1.82.26.45.74.73 1.26.73H21a2 2 0 1 1 0 4h-.09c-.52 0-1 .28-1.26.73z" />
  </svg>
);

/* ------------------- Crisp credit glyph (inline SVG) ------------------- */
const CreditGlyph = ({ className = "" }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true" width="16" height="16">
    <g fill="#2F57EB">
      <rect x="10" y="2" width="4" height="4" rx="1" transform="rotate(45 12 4)" />
      <rect x="18" y="10" width="4" height="4" rx="1" transform="rotate(45 20 12)" />
      <rect x="2" y="10" width="4" height="4" rx="1" transform="rotate(45 4 12)" />
      <rect x="10" y="18" width="4" height="4" rx="1" transform="rotate(45 12 20)" />
    </g>
  </svg>
);

/* ------------------- Credit chip + popover (hover + click-to-pin) ------------------- */
function CreditChip() {
  const credits = useCredits();

  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false); // click to pin/unpin
  const ref = useRef(null);
  const timer = useRef(null);

  const show = () => {
    clearTimeout(timer.current);
    setOpen(true);
  };

  const scheduleClose = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!pinned) setOpen(false);
    }, 120);
  };

  // close on outside click
  useEffect(() => {
    const onDocClick = (e) => {
      if (!ref.current?.contains(e.target)) {
        setPinned(false);
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={show}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        onClick={() => {
          setPinned((v) => !v);
          setOpen(true);
        }}
        className="inline-flex items-center gap-2 rounded-full bg-gray-50 ring-1 ring-black/5 shadow-sm px-3 py-1 text-sm font-semibold text-black hover:bg-gray-100 transition"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="View credits"
      >
        <CreditGlyph className="h-4 w-4" />
        {credits ?? "—"}
      </button>

      {open && (
        <div
          className="absolute right-0 top-[calc(100%+8px)] z-40 w-80 rounded-2xl border border-black/10 bg-white p-4 shadow-xl"
          role="dialog"
          aria-label="Credits panel"
        >
          <div className="mb-2 flex items-center gap-2">
            <CreditGlyph className="h-4 w-4" />
            <div className="text-sm font-semibold">Credits</div>
          </div>

          <div className="mb-1 text-lg font-bold">You have {credits ?? 0} credits</div>
          <p className="mb-3 text-sm text-black/70">
            Credits are used to run AI jobs (images, videos, avatars, etc.).
          </p>

          <div className="flex items-center justify-between">
            <Link to="/credits" className="text-sm font-semibold text-blue-600 hover:underline">
              Learn more about credits
            </Link>
            <Link
              to="/pricing"
              className="flex w-40 items-start justify-start rounded-full
                         bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2
                         text-sm font-semibold text-white shadow-sm hover:opacity-95
                         text-left leading-tight"
            >
              Buy more credits
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------- Studios Mega Menu --------------------------- */
const STUDIOS = [
  { title: "Brand home", to: "/brands", desc: "Overview & assets hub" },
  { title: "Brand workspace", to: "/brand-kit", desc: "Name, products, logos" },
  { title: "Avatar studio", to: "/avatar-studio", desc: "Talking avatars & portraits" },
  { title: "Ad studio", to: "/ad-studio", desc: "Ready-to-run ads" },
  { title: "Product photos", to: "/product-photos", desc: "Packshots & lifestyle" },
  { title: "Enhancements", to: "/enhancements", desc: "Upscale, BG remove, retouch" },
];

const POPULAR = [
  { title: "Text to Image",to: "/textimage", },
  {  title: "Text to Video",to: "/textvideo", },
  { title: "Library",to:"/library",}
 
];

function StudiosDropdown() {
  const [open, setOpen] = useState(false);
  const timer = useRef(null);
  const location = useLocation();

  const show = () => { clearTimeout(timer.current); setOpen(true); };
  const hide = () => { timer.current = setTimeout(() => setOpen(false), 120); };
  const closeNow = () => { clearTimeout(timer.current); setOpen(false); };
  useEffect(() => { closeNow(); }, [location.pathname]);

  return (
    <div className="relative" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      <button
        type="button"
        className="flex items-center gap-1 text-black hover:text-[#7c3aed] transition"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Studios <ChevronDown className="text-gray-500" />
      </button>

      {open && (
        <div className="absolute left-1/2 z-40 mt-3 w-[820px] -translate-x-1/2 rounded-2xl border border-black/10 bg-white shadow-xl" role="menu">
          <div className="grid grid-cols-2">
            {/* Left column */}
            <div className="p-5 sm:p-6 flex flex-col justify-between">
              <div>
                <div className="mb-3 text-[11px] font-bold uppercase tracking-widest text-blue-600">Studios</div>
                <ul className="space-y-2.5">
                  {STUDIOS.map((s) => (
                    <li key={s.to}>
                      <Link
                        to={s.to}
                        onClick={closeNow}
                        className="block rounded-lg px-2 py-2 hover:bg-black/[0.035] focus:bg-black/[0.045] focus:outline-none"
                      >
                        <div className="text-[15px] font-semibold text-black">{s.title}</div>
                        <div className="text-sm text-black/60">{s.desc}</div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-4">
                <Link
                  to="/library"
                  onClick={closeNow}
                  className="inline-flex items-center rounded-full bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95"
                >
                  Explore all studios
                  <svg className="ml-2 h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10.293 15.707a1 1 0 010-1.414L13.586 11H5a1 1 0 110-2h8.586l-3.293-3.293a1 1 0 111.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z" />
                  </svg>
                </Link>
              </div>
            </div>
            {/* Right column */}
            <div className="p-5 sm:p-6 flex flex-col justify-between border-l border-black/10">
              <div>
                <div className="mb-3 text-[11px] font-bold uppercase tracking-widest text-purple-600">Other tools</div>
                <ul className="space-y-2">
                  {POPULAR.map((t) => (
                    <li key={t.to}>
                      <Link
                        to={t.to}
                        onClick={closeNow}
                        className="group flex items-center justify-between rounded-lg px-2 py-2 hover:bg-black/[0.035] focus:bg-black/[0.045] focus:outline-none"
                      >
                        <span className="text-[15px] font-medium text-black group-hover:text-purple-700">
                          {t.title}
                        </span>
                        <svg className="h-4 w-4 text-black/40 group-hover:text-purple-700" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 111.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" />
                        </svg>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-4">
                <Link
                  to="/create"
                  onClick={closeNow}
                  className="inline-flex items-center rounded-full bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95"
                >
                  Explore all tools
                  <svg className="ml-2 h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10.293 15.707a1 1 0 010-1.414L13.586 11H5a1 1 0 110-2h8.586l-3.293-3.293a1 1 0 111.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------- Navbar -------------------------------- */
export default function Navbar() {
  const auth = useAuth();
  const user = auth?.user ?? auth?.session?.user ?? null;

  return (
    <>
      {/* Made sticky -> fixed; keeps on screen while scrolling */}
      <header className="fixed top-0 z-50 w-full bg-white text-black border-b border-gray-100">
        <nav className="mx-auto max-w-6xl px-6 sm:px-8 h-16 flex items-center justify-between">
          {/* Brand */}
         <div className="flex items-center gap-3">
  <Link to="/" className="inline-flex items-center gap-2">
    <img
      src={ZyloMark}
      alt="Zylo logo"
      className="h-7 w-7 object-contain select-none"
      draggable="false"
    />
    <span className="text-xl font-extrabold tracking-tight">
      <span className="text-[#007BFF]">Zylo</span>
      <span className="text-violet-gradient">AI</span>
    </span>
  </Link>
</div>

          {/* Links */}
          <ul className="hidden md:flex items-center gap-8 text-[15px] font-semibold">
            <li><Link to="/" className="text-black hover:text-[#007BFF] transition">Home</Link></li>
            <li className="relative"><StudiosDropdown /></li>
            <li>
              <Link to="/help" className="flex items-center gap-1 text-black hover:text-[#007BFF] transition">
                Help <ChevronDown className="text-gray-500" />
              </Link>
            </li>
            <li><Link to="/community" className="text-black hover:text-[#007BFF] transition">Community</Link></li>
            <li><Link to="/pricing" className="text-black hover:text-[#007BFF] transition">Pricing</Link></li>
          </ul>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-6">
            {user ? (
              <>
                <CreditChip />
                <Link to="/settings" className="text-gray-600 hover:text-[#007BFF] transition">
                  <SettingsIcon />
                </Link>
                <button
                  onClick={() => signOut()}
                  className="text-sm font-semibold text-black hover:text-[#007BFF] transition"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold border-2 border-[#007BFF] text-[#007BFF] bg-white hover:bg-[#F2F7FF] active:scale-[0.98] transition"
                >
                  Sign up
                </Link>
                <Link to="/login" className="text-sm font-semibold text-black hover:text-[#007BFF] transition">
                  Login
                </Link>
                <Link to="/settings" className="text-gray-600 hover:text-[#007BFF] transition">
                  <SettingsIcon />
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <div className="md:hidden">
            <button
              aria-label="Open menu"
              className="inline-flex items-center justify-center w-9 h-9 rounded-md border border-gray-200"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </nav>
      </header>

      {/* Spacer to avoid content jump under fixed header (same height as nav) */}
      <div className="h-16" />
    </>
  );
}
