import { useEffect, useState, isValidElement } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronRight, Clapperboard, Home, Folder, HandCoins, LayoutGrid, Menu, Plug, Sparkles, X } from "lucide-react";
import { useStudioOpen } from "../studio-kit/useStudioOpen";
import { MCP_PATH } from "../../data/studioKit";
import EarnBadge from "../affiliate/EarnBadge.jsx";
import { AFFILIATE_PATH } from "../../lib/affiliate";
import { createPortal } from "react-dom";
import MobileCreateMenu, { WORKSPACE_TOOLS } from "./CreateMenu";
import { BLOCKY_STORIES_PATH } from "../../data/blockyStories";
import { isLongFormNew, trackLaunch } from "../launch/launch";

/* ─── Workspace pop-up menu (image + video) ──────────────────────────────── */
function CenteredActionMenu({ open, onClose, title, items, columns = 3 }) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const go = (path) => { onClose(); navigate(path); };

  return createPortal(
    <div className="fixed inset-0 z-[190]" role="presentation">
      <button
        type="button"
        aria-label={`Close ${title} menu`}
        className="absolute inset-0 bg-black/70 backdrop-blur-[7px]"
        onClick={onClose}
      />

      <section
        aria-label={`${title} menu`}
        className="absolute left-1/2 w-[calc(100%-28px)] max-w-[380px] -translate-x-1/2 overflow-hidden rounded-[24px] border border-white/[0.11] bg-[#121416]/[0.97] p-3.5 shadow-[0_22px_70px_rgba(0,0,0,.58),inset_0_1px_0_rgba(255,255,255,.06)]"
        style={{
          bottom: "calc(78px + env(safe-area-inset-bottom) + 14px)",
          animation: "zyvoMobileMenuIn 180ms cubic-bezier(.2,.8,.2,1) both",
        }}
      >
        <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-lime-300/60 to-transparent" />

        <div className="mb-3 flex items-center justify-between px-1">
          <div>
            <p className="text-[15px] font-bold tracking-[-0.02em] text-white">{title}</p>
            <p className="mt-0.5 text-[10px] font-medium text-white/35">Choose where you want to go</p>
          </div>
          <button
            type="button"
            aria-label={`Close ${title} menu`}
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full border border-white/[0.08] bg-white/[0.05] text-white/55 transition active:scale-90 active:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className={`grid gap-2 ${columns === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
          {items.map((item, index) => {
            const active = location.pathname.startsWith(item.path);

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => go(item.path)}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-[96px] flex-col items-center justify-center gap-2 overflow-hidden rounded-[18px] border px-2 py-3 text-center transition active:scale-[0.96] ${
                  active
                    ? "border-lime-300/40 bg-lime-300/[0.09] text-lime-300 shadow-[inset_0_1px_0_rgba(255,255,255,.08),0_0_24px_rgba(190,242,100,.08)]"
                    : "border-white/[0.08] bg-white/[0.035] text-white hover:border-white/[0.14] hover:bg-white/[0.06]"
                }`}
                style={{
                  animation: `zyvoMobileItemIn 200ms ${index * 35}ms cubic-bezier(.2,.8,.2,1) both`,
                }}
              >
                <span
                  className={`grid h-11 w-11 place-items-center rounded-[14px] border transition ${
                    active
                      ? "border-lime-300/25 bg-lime-300/[0.10] text-lime-300"
                      : "border-white/[0.09] bg-black/20 text-white"
                  }`}
                >
                  {item.preview ? (
                    <img
                      src={item.preview}
                      alt=""
                      className="h-7 w-7 object-contain"
                    />
                  ) : item.icon}
                </span>
                <span className={`text-[11px] font-semibold leading-[14px] ${active ? "text-lime-300" : "text-white/80"}`}>
                  {item.label}
                </span>
                {active && <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-lime-300 shadow-[0_0_8px_#bef264]" />}
              </button>
            );
          })}
        </div>

        <style>{`
          @keyframes zyvoMobileMenuIn {
            from { opacity: 0; transform: translate(-50%, 12px) scale(.98); }
            to { opacity: 1; transform: translate(-50%, 0) scale(1); }
          }
          @keyframes zyvoMobileItemIn {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </section>
    </div>,
    document.body
  );
}

/* ─── More: a bottom sheet with large rows ───────────────────────────────── */
const MORE_ITEMS = [
  { id: "creations", label: "Creations", sub: "Everything you've made", path: "/workspace/creations", icon: Folder },
  { id: "affiliate", label: "Affiliate", sub: "Share your code, get paid", path: AFFILIATE_PATH, icon: HandCoins, earn: true },
];
// owner-only until STUDIO_KIT_PUBLIC: shown only when the server says MCP is open for this account
const MCP_ITEM = { id: "mcp", label: "MCP", sub: "Claude + Roblox Studio templates", path: MCP_PATH, icon: Plug };
const useMoreItems = () => (useStudioOpen() === "open" ? [MORE_ITEMS[0], MCP_ITEM, ...MORE_ITEMS.slice(1)] : MORE_ITEMS);

function MoreSheet({ open, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const items = useMoreItems();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    // Above the bottom nav (z-100), which stays visible with More lit up; the backdrop stops at the nav too.
    <div className="fixed inset-x-0 top-0 z-[99] lg:hidden" style={{ bottom: "calc(78px + env(safe-area-inset-bottom))" }} role="presentation">
      <button type="button" aria-label="Close More menu" className="absolute inset-0 bg-black/70 backdrop-blur-[7px]" onClick={onClose} />
      <section
        role="dialog"
        aria-label="More"
        className="absolute inset-x-0 bottom-0 overflow-hidden rounded-t-[26px] border-t border-white/[0.1] bg-[#121416] px-4 pb-4 pt-2.5 shadow-[0_-22px_70px_rgba(0,0,0,.55)]"
        style={{ animation: "zyvoMoreSheetIn 220ms cubic-bezier(.2,.8,.2,1) both" }}
        data-testid="more-sheet"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15" aria-hidden="true" />
        <div className="mb-3 flex items-center justify-between px-1">
          <p className="text-[16px] font-bold tracking-[-0.02em] text-white">More</p>
          <button type="button" aria-label="Close More menu" onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full border border-white/[0.08] bg-white/[0.05] text-white/60 transition active:scale-90">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-2">
          {items.map((item) => {
            const active = location.pathname.startsWith(item.path);
            const Icon = item.icon;
            return (
              <button key={item.id} type="button" onClick={() => { onClose(); navigate(item.path); }} aria-current={active ? "page" : undefined} data-testid={`more-${item.id}`}
                className={`flex min-h-[68px] w-full items-center gap-3.5 rounded-[18px] border px-3.5 py-3 text-left transition active:scale-[0.98] ${active ? "border-lime-300/40 bg-lime-300/[0.08]" : "border-white/[0.08] bg-white/[0.035]"}`}>
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-[14px] border ${active ? "border-lime-300/30 bg-lime-300/[0.1] text-lime-300" : "border-white/[0.09] bg-black/20 text-white"}`}>
                  <Icon className="h-[22px] w-[22px]" strokeWidth={1.9} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-[15.5px] font-bold text-white">{item.label}{item.earn && <EarnBadge />}</span>
                  <span className="mt-0.5 block text-[12.5px] text-white/45">{item.sub}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-white/25" />
              </button>
            );
          })}
        </div>
        <style>{`@keyframes zyvoMoreSheetIn { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
      </section>
    </div>,
    document.body,
  );
}

/* ─── Nav item ───────────────────────────────────────────────────────────── */
function NavItem({ name, icon: Icon, iconSrc, active, onClick, expanded, badge }) {
  return (
    <button
      type="button"
      onClick={onClick || undefined}
      aria-expanded={expanded}
      className="ftg-nav-item flex w-[60px] shrink-0 flex-col items-center gap-1 rounded-xl py-1 transition active:scale-95"
    >
      <span className={`relative grid h-6 w-6 place-items-center transition-colors ${
        active ? "text-lime-300" : "text-white"
      }`}>
        {iconSrc ? (
          <span
            aria-hidden="true"
            className="block h-[25px] w-[25px] bg-current"
            style={{
              WebkitMaskImage: `url("${iconSrc}")`,
              maskImage: `url("${iconSrc}")`,
              WebkitMaskPosition: "center",
              maskPosition: "center",
              WebkitMaskRepeat: "no-repeat",
              maskRepeat: "no-repeat",
              WebkitMaskSize: "contain",
              maskSize: "contain",
            }}
          />
        ) : isValidElement(Icon) ? Icon : <Icon size={23} strokeWidth={1.9} />}
        {badge && <span aria-label="New" className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-lime-300 ring-2 ring-[#1a1c1e]" data-testid="nav-new-dot" />}
      </span>
      <span className={`w-full whitespace-nowrap text-center text-[11px] font-medium leading-4 tracking-[0.1px] ${
        active ? "text-lime-300" : "text-white/55"
      }`}>
        {name}
      </span>
    </button>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────── */
export default function MobileBottomNav({ hidden }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);

  const NAV_HEIGHT = 78;
  const createActive =
    location.pathname.startsWith("/workspace/two-am") ||
    location.pathname.startsWith("/workspace/thirty-days") ||
    location.pathname.startsWith("/workspace/cartoon-drive-by") ||
    location.pathname.startsWith("/workspace/ai-fruit-story") ||
    location.pathname.startsWith(BLOCKY_STORIES_PATH) ||
    location.pathname.startsWith("/workspace/face-asmr") ||
    location.pathname.startsWith("/workspace/micro-camera-animal") ||
    location.pathname.startsWith("/workspace/clay-rescue") ||
    location.pathname.startsWith("/workspace/ai-cooking-matic") ||
    location.pathname.startsWith("/workspace/kit-swap") ||
    location.pathname.startsWith("/workspace/behind-the-scenes");
  const [moreOpen, setMoreOpen] = useState(false);
  const anyMenuOpen = createOpen || workspaceOpen || moreOpen;
  const moreItems = useMoreItems();
  const moreRouteActive = moreItems.some((item) => location.pathname.startsWith(item.path));
  const workspaceRouteActive =
    location.pathname.startsWith("/workspace/image-generator") ||
    location.pathname.startsWith("/workspace/video-generator");

  useEffect(() => {
    const openCreate = () => {
      if (window.matchMedia("(min-width: 1024px)").matches) return;
      setWorkspaceOpen(false);
      setMoreOpen(false);
      setCreateOpen(true);
    };
    window.addEventListener("zyvo:open-create-menu", openCreate);
    return () => window.removeEventListener("zyvo:open-create-menu", openCreate);
  }, []);

  return (
    <>
      <MobileCreateMenu
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        anchorBottom={NAV_HEIGHT}
      />
      <CenteredActionMenu
        open={workspaceOpen}
        onClose={() => setWorkspaceOpen(false)}
        title="Tools"
        items={WORKSPACE_TOOLS}
        columns={2}
      />
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
      <div
        className={`ftg-bottom-nav fixed bottom-0 left-0 right-0 z-[100] border-t border-white/[0.08] bg-[linear-gradient(180deg,#1b1d1f_0%,#17191b_100%)] shadow-[0_-18px_45px_rgba(0,0,0,.28)] transition-opacity duration-300 lg:hidden ${
          hidden ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
        style={{
          height: `calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom))`,
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {/*
          RESTORE LATER: the Home-only raised Create treatment is temporarily
          disabled while Publish is hidden. It used `useRaisedCreateItem`, a
          split top border, a 92px curved notch, and a 48px lime/cyan gradient
          Create orb positioned at -mt-[23px]. The flat NavItem below replaces it.
        */}

        <div className="relative z-[1] flex items-start justify-between px-4 pt-[12px]" style={{ height: NAV_HEIGHT }}>

          {/* Home */}
          <NavItem
            name="Home"
            icon={Home}
            active={!anyMenuOpen && location.pathname === "/"}
            onClick={() => { setMoreOpen(false); setCreateOpen(false); setWorkspaceOpen(false); navigate("/"); }}
          />

          {/* Short Form — same orb everywhere, raised only on Home */}
          <NavItem
            name="Short"
            icon={Sparkles}
            active={createOpen || (!anyMenuOpen && createActive)}
            expanded={createOpen}
            onClick={() => { setMoreOpen(false); setWorkspaceOpen(false); setCreateOpen((value) => !value); }}
          />

          {/* Long Form */}
          <NavItem
            name="Long"
            icon={Clapperboard}
            active={!anyMenuOpen && location.pathname.startsWith("/long-form")}
            badge={isLongFormNew()}
            onClick={() => { setMoreOpen(false); setCreateOpen(false); setWorkspaceOpen(false); if (!location.pathname.startsWith("/long-form")) trackLaunch("nav_long_form", { placement: "mobile_nav" }); navigate("/long-form"); }}
          />

          {/* Tools */}
          <NavItem
            name="Tools"
            icon={LayoutGrid}
            active={workspaceOpen || (!anyMenuOpen && workspaceRouteActive)}
            onClick={() => { setMoreOpen(false); setCreateOpen(false); setWorkspaceOpen((value) => !value); }}
          />

          {/* More: Creations and Affiliate, in a bottom sheet */}
          <NavItem
            name="More"
            icon={Menu}
            active={moreOpen || (!anyMenuOpen && moreRouteActive)}
            expanded={moreOpen}
            onClick={() => { setCreateOpen(false); setWorkspaceOpen(false); setMoreOpen((value) => !value); }}
          />

        </div>
      </div>
    </>
  );
}
