import Logo from "../../assets/Logo.png";
import Credit from "/icons/credits.png";

import { useAuth } from "../../context/AuthContext";
import { useProfileCredits } from "../../hooks/useProfileCredits";
import { supabase } from "../../lib/supabaseClient";
import AuthModal from "../AuthModal.jsx";
import CreatorRewardsModal from "../CreatorRewardsModal.jsx";

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";

import {
  Settings,
  CreditCard,
  LogOut,
  HelpCircle,
  ChevronDown,
  User,
  Gift,
  History,
} from "lucide-react";

const ANNOUNCEMENTS = [
  {
    title: "Clay Rescue is Live",
    date: "2026.06.01",
    desc: "Giant hands save tiny clay worlds from fires, floods, blocked roads, and more. Built for satisfying rescue videos.",
  },
  {
    title: "😮 Face ASMR is Live",
    date: "2026.05.24",
    desc: "Upload a face, pick a scene, and generate viral ASMR videos. Trending content in minutes.",
  },
  {
    title: "🍊 AI Fruit Story is Live",
    date: "2026.05.10",
    desc: "Create viral fruit character stories — drama, comedy, betrayal. All AI, all fire.",
  },
  {
    title: "🦴 Viral Skeleton — New Presets",
    date: "2026.04.22",
    desc: "Fresh skeleton styles added. Scroll-stopping content in one click.",
  },
  {
    title: "🎬 Video Generator V2",
    date: "2026.04.01",
    desc: "Faster cinematic video generation powered by MiniMax Hailou 2.3 and Runway Gen-4.",
  },
];

export default function TopRow({ onMenuClick, title }) {
  const { user, loading } = useAuth();
  const credits = useProfileCredits();
  const navigate = useNavigate();

  const [planCode, setPlanCode] = useState("free");
  const [profileOpen, setProfileOpen] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [giftPos, setGiftPos] = useState({ top: 60, left: 0 });
  const [authModal, setAuthModal] = useState(null); // "login" | "signup" | null
  const [rewardsModalOpen, setRewardsModalOpen] = useState(false);

  const profileRef = useRef(null);
  const menuRef = useRef(null);
  const giftRef = useRef(null);
  const giftMenuRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("plan_code")
      .eq("id", user.id)
      .single()
      .then(({ data }) => setPlanCode((data?.plan_code || "free").toLowerCase()));
  }, [user]);

  useEffect(() => {
    if (!profileOpen) return;
    const close = (e) => {
      if (!profileRef.current?.contains(e.target) && !menuRef.current?.contains(e.target))
        setProfileOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [profileOpen]);

  useEffect(() => {
    if (!giftOpen) return;
    const close = (e) => {
      if (!giftRef.current?.contains(e.target) && !giftMenuRef.current?.contains(e.target))
        setGiftOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [giftOpen]);

  if (loading) return null;

  const formattedCredits = Intl.NumberFormat().format(credits);
  const initials = user
    ? (user.user_metadata?.full_name || user.email || "").slice(0, 2).toUpperCase()
    : null;
  const displayName = user?.user_metadata?.full_name
    ? `${user.user_metadata.full_name.split(" ")[0]}'s home`
    : "My home";

  return (
    <>
    <section className="z-[60] w-full bg-[#090A0A]">
      <div className="flex items-center justify-between px-4 lg:px-6 py-3">

        {/* ── LEFT ── */}
        <div className="flex items-center gap-3">
          {/* mobile logo / hamburger */}
          <button onClick={onMenuClick} className="lg:hidden">
            <img src={Logo} className="w-9 h-9 object-contain" />
          </button>

          {/* desktop: workspace label when logged in */}
          {user ? (
            <div className="hidden lg:flex items-center gap-2 text-sm">
              <span className="text-white/70 font-medium">{displayName}</span>
              <ChevronDown className="w-3.5 h-3.5 text-white/30" />
              <span className="text-white/20">|</span>
              <span className="text-white/60">{title || "Home"}</span>
            </div>
          ) : (
            /* not-logged-in: just show page label */
            <span className="text-white text-sm font-medium hidden lg:block">
              {title || "Home"}
            </span>
          )}
        </div>

        {/* ── RIGHT ── */}
        <div className="flex items-center gap-2">

          {/* ══ NOT LOGGED IN ══ */}
          {!user && (
            <>
              {/* Help */}
              <button
                onClick={() => navigate("/support")}
                className="hidden lg:flex items-center gap-1.5 text-white/45 text-sm hover:text-white/80 transition"
              >
                <HelpCircle className="w-4 h-4" />
                Help
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>

              {/* Gift notification button */}
              <div className="relative hidden lg:block" ref={giftRef}>
                <button
                  onClick={() => {
                    if (giftRef.current) {
                      const r = giftRef.current.getBoundingClientRect();
                      setGiftPos({ top: r.bottom + 8, left: Math.max(8, r.right - 340) });
                    }
                    setGiftOpen((v) => !v);
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-white/40 hover:text-white/70 hover:bg-white/5 transition"
                >
                  <Gift className="w-4 h-4" />
                </button>

                {/* portal rendered further down, shared with logged-in */}
              </div>

              {/* Pricing */}
              <button
                onClick={() => navigate("/workspace/pricing")}
                className="hidden lg:block text-white/45 text-sm hover:text-white/80 transition"
              >
                Pricing
              </button>

              {/* Divider */}
              <div className="hidden lg:block h-4 w-px bg-white/10 mx-1" />

              {/* Login */}
              <button
                onClick={() => setAuthModal("login")}
                className="text-[#B794FF] text-sm font-medium bg-[#2A1660] hover:bg-[#331B78] rounded-lg px-5 py-1.5 transition"
              >
                Login
              </button>

              {/* Start for Free */}
              <button
                onClick={() => setAuthModal("signup")}
                className="flex items-center gap-1 bg-gradient-to-r from-[#7A3BFF] to-[#9F5CFF] text-white text-sm font-semibold rounded-lg px-5 py-1.5 hover:opacity-90 transition"
              >
                Start for Free
                <span className="text-base leading-none">›</span>
              </button>
            </>
          )}

          {/* ══ LOGGED IN ══ */}
          {user && (
            <>
              {/* Credits + Upgrade grouped */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => navigate("/workspace/pricing")}
                  className="flex items-center gap-1.5 rounded-full border border-lime-400/20 bg-gradient-to-r from-lime-300/[0.10] to-lime-500/[0.07] px-3 py-1.5 shadow-[inset_0_1px_0_rgba(217,249,157,0.04)] transition hover:border-lime-400/35 hover:from-lime-300/[0.14] hover:to-lime-500/[0.10]"
                >
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 bg-lime-300"
                    style={{
                      WebkitMaskImage: `url(${Credit})`,
                      maskImage: `url(${Credit})`,
                      WebkitMaskPosition: "center",
                      maskPosition: "center",
                      WebkitMaskRepeat: "no-repeat",
                      maskRepeat: "no-repeat",
                      WebkitMaskSize: "contain",
                      maskSize: "contain",
                    }}
                  />
                  <span className="text-sm font-semibold text-lime-300">
                    {formattedCredits}
                  </span>
                </button>

                {/* Upgrade right next to credits — free users only */}
                {planCode === "free" && (
                  <button
                    onClick={() => navigate("/workspace/pricing")}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-[#7A3BFF] to-[#9F5CFF] text-white text-sm font-semibold hover:opacity-90 transition"
                  >
                    Upgrade
                  </button>
                )}
              </div>

              {/* Add Credits — shown when user has credits to top up */}
              {credits > 1 && (
                <button
                  onClick={() => navigate("/workspace/pricing")}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#14161C] border border-white/10 hover:border-[#7A3BFF]/50 hover:bg-[#181A22] text-white/70 hover:text-white text-sm font-medium transition"
                >
                  Add Credits
                </button>
              )}

              {/* Gift — always visible when logged in */}
              <div className="relative hidden sm:block" ref={giftRef}>
                <button
                  onClick={() => {
                    if (giftRef.current) {
                      const r = giftRef.current.getBoundingClientRect();
                      setGiftPos({ top: r.bottom + 8, left: Math.max(8, r.right - 340) });
                    }
                    setGiftOpen((v) => !v);
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-[#191B1C] border border-white/10 hover:border-purple-500/40 transition"
                >
                  <Gift className="w-4 h-4 text-white/60" />
                </button>
              </div>

              {/* Help */}
              <button
                onClick={() => navigate("/support")}
                className="hidden sm:flex w-8 h-8 rounded-full bg-[#191B1C] border border-white/10 items-center justify-center hover:border-purple-500/40 transition"
              >
                <HelpCircle className="w-4 h-4 text-white/60" />
              </button>

              {/* Profile avatar */}
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen((v) => !v)}
                  className="w-9 h-9 rounded-full bg-[#B7BBC6] flex items-center justify-center hover:ring-2 hover:ring-[#7A3BFF]/50 transition"
                >
                  <span className="text-[#110829] text-sm font-bold">{initials}</span>
                </button>

                {profileOpen &&
                  createPortal(
                    <div
                      ref={menuRef}
                      className="fixed right-4 top-[60px] w-[250px] bg-[#141620] border border-white/10 rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.6)] p-3 z-[9999]"
                    >
                      {/* user info */}
                      <div className="flex items-center gap-3 pb-3 border-b border-white/8 mb-2">
                        <div className="w-9 h-9 rounded-full bg-[#B7BBC6] flex items-center justify-center shrink-0">
                          <span className="text-[#110829] text-sm font-bold">{initials}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-white text-[13px] font-semibold truncate">
                            {user.user_metadata?.full_name || "User"}
                          </p>
                          <p className="text-white/40 text-[11px] truncate">{user.email}</p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-0.5 text-[13px]">
                        <MenuItem icon={User} label="View Profile" onClick={() => { setProfileOpen(false); navigate("/settings"); }} />
                        <MenuItem icon={CreditCard} label="Subscriptions" onClick={() => { setProfileOpen(false); navigate("/workspace/pricing"); }} />
                        <MenuItem icon={Settings} label="Manage Account" onClick={() => { setProfileOpen(false); navigate("/settings"); }} />
                        <div className="border-t border-white/8 my-1.5" />

                        <button
                          onClick={async () => {
                            setProfileOpen(false);
                            await supabase.auth.signOut();
                            navigate("/");
                          }}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-red-500/10 text-red-400 transition w-full text-left"
                        >
                          <LogOut className="w-4 h-4 shrink-0" />
                          Sign Out
                        </button>
                      </div>
                    </div>,
                    document.body
                  )}
              </div>
            </>
          )}
        </div>
      </div>
    </section>

    {/* ── Gift dropdown portal — shared for both auth states ── */}
    {giftOpen && createPortal(
      <div
        ref={giftMenuRef}
        className="fixed w-[340px] bg-[#1B1D1F] border border-white/[0.06] rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.7)] overflow-hidden z-[9999]"
        style={{ top: giftPos.top, left: giftPos.left }}
      >
        {/* Live Now */}
        <div className="px-4 pt-4 pb-2">
          <p className="text-white/40 text-[11px] font-bold tracking-widest uppercase mb-3">Live Now</p>

          <PromoCard
            emoji="🔥"
            title="Earn Free Zyvo Credits"
            description="Post about Zyvo on socials — earn up to 1,500 credits."
            onClick={() => { setGiftOpen(false); setRewardsModalOpen(true); }}
          />

          <PromoCard
            emoji="🎁"
            title="Pro Plan — 25% Off"
            description="Limited time. Upgrade now and save."
            onClick={() => { setGiftOpen(false); navigate("/workspace/pricing"); }}
          />
        </div>

        {/* What's New */}
        <div className="px-4 pb-4 pt-1">
          <p className="text-white/40 text-[11px] font-bold tracking-widest uppercase mb-3">What's New</p>
          <div className="flex flex-col divide-y divide-white/5">
            {ANNOUNCEMENTS.map((item) => (
              <div key={item.title} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-white/90 text-[13px] font-semibold leading-tight">{item.title}</span>
                  <span className="text-white/30 text-[11px] shrink-0">{item.date}</span>
                </div>
                <p className="text-white/45 text-[12px] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>,
      document.body
    )}

    {authModal && (
      <AuthModal mode={authModal} onClose={() => setAuthModal(null)} />
    )}

    {rewardsModalOpen && (
      <CreatorRewardsModal onClose={() => {
        if (user) localStorage.setItem(`zyvo_creator_rewards_seen:${user.id}`, "1");
        setRewardsModalOpen(false);
      }} />
    )}
    </>
  );
}

function PromoCard({ emoji, title, description, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group relative w-full overflow-hidden text-left rounded-2xl border border-white/10 bg-[#090A0A] transition-all duration-300 hover:border-purple-400/50 hover:shadow-[0_0_24px_rgba(168,85,247,0.16)] mb-2 last:mb-0"
    >
      <div className="pointer-events-none absolute inset-0 rounded-2xl">
        <div className="absolute left-0 top-0 h-[1.5px] w-16 bg-gradient-to-r from-purple-500 via-fuchsia-400 to-transparent" />
        <div className="absolute left-0 top-0 h-12 w-[1.5px] bg-gradient-to-b from-purple-500 via-fuchsia-400 to-transparent" />
        <div className="absolute bottom-0 right-0 h-[1.5px] w-16 bg-gradient-to-l from-purple-500 via-fuchsia-400 to-transparent" />
        <div className="absolute bottom-0 right-0 h-12 w-[1.5px] bg-gradient-to-t from-purple-500 via-fuchsia-400 to-transparent" />
      </div>
      <div className="pointer-events-none absolute -left-6 -top-6 h-20 w-20 rounded-full bg-purple-500/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-6 -right-6 h-20 w-20 rounded-full bg-fuchsia-500/10 blur-2xl" />

      <div className="relative z-10 flex items-center gap-3 p-3.5">
        <div className="shrink-0 w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-xl">
          {emoji}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold leading-tight bg-gradient-to-r from-white via-purple-100 to-purple-400 bg-clip-text text-transparent">
            {title}
          </p>
          <p className="text-white/45 text-[11px] mt-0.5 leading-snug">{description}</p>
        </div>
        <span className="text-white/30 group-hover:text-purple-300 text-[11px] font-bold shrink-0 transition-colors">→</span>
      </div>
    </button>
  );
}

function MenuItem({ icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/5 text-white/75 hover:text-white transition w-full text-left"
    >
      <Icon className="w-4 h-4 text-white/40 shrink-0" />
      {label}
    </button>
  );
}
