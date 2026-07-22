import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { motion } from "framer-motion";
import { ArrowRight, Plus, Wand2 } from "lucide-react";

/* ─── Config ─────────────────────────────────────────────── */
const CACHE_PREFIX = "zyvo_jbi_";
const UID_KEY      = "zyvo_uid";
const LIMIT        = 8;

/* ─── Helpers ────────────────────────────────────────────── */
function timeAgo(dateStr) {
  const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (s < 60)    return "just now";
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function readCache() {
  try {
    const uid = localStorage.getItem(UID_KEY);
    if (!uid) return null;
    const raw = localStorage.getItem(CACHE_PREFIX + uid);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch { return null; }
}

function writeCache(uid, data) {
  try {
    localStorage.setItem(UID_KEY, uid);
    localStorage.setItem(CACHE_PREFIX + uid, JSON.stringify(data));
  } catch {}
}

/* ─── Main ───────────────────────────────────────────────── */
export default function JumpBackIn() {
  const [items, setItems] = useState(readCache);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: auth } = await supabase.auth.getSession();
      const uid = auth?.session?.user?.id;

      // No active session → clear anything that was shown from cache
      if (!uid) {
        if (!cancelled) setItems([]);
        return;
      }

      // Warm from uid-specific cache instantly
      try {
        const raw = localStorage.getItem(CACHE_PREFIX + uid);
        if (raw) {
          const p = JSON.parse(raw);
          if (Array.isArray(p) && p.length > 0 && !cancelled) setItems(p);
        }
      } catch {}

      // Background fetch — minimal fields for speed
      const { data } = await supabase
        .from("jobs")
        .select("id, result_url, prompt, created_at")
        .eq("user_id", uid)
        .eq("type", "image")
        .not("result_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(LIMIT);

      if (cancelled) return;

      const fresh = (data ?? []).filter((j) => j.result_url);
      setItems(fresh.length > 0 ? fresh : []);
      if (fresh.length > 0) writeCache(uid, fresh);
    }

    load();

    // Clear immediately on logout so cached images never persist to the next user
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") setItems([]);
      if (event === "SIGNED_IN") load();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  if (!items || items.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="w-full px-5 md:px-[50px] mt-6"
    >
      {/* ── Card container ── */}
      <div className="relative rounded-[22px]  p-4 md:p-5 overflow-hidden">

        {/* ambient purple glow */}
        <div className="pointer-events-none absolute -top-10 -left-10 w-56 h-56 rounded-full bg-[#7A3BFF]/10 blur-3xl" />

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            {/* glowing dot */}
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#7A3BFF] opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#7A3BFF]" />
            </span>
            <h2 className="text-white text-[17px] md:text-[19px] font-bold tracking-tight">
              Jump Back In
            </h2>
          </div>
          <button
            onClick={() => navigate("/workspace/creations")}
            className="flex items-center gap-1 text-white/35 hover:text-white/65 text-[13px] font-medium transition-colors duration-200"
          >
            See all <ArrowRight size={13} />
          </button>
        </div>

        {/* ── Strip ── */}
        <div className="relative">
          {/* right edge fade hint */}
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-[#0D0F14] to-transparent z-10" />

          <div className="flex gap-2.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {items.map((item, i) => (
              <Thumb key={item.id} item={item} i={i} navigate={navigate} />
            ))}
            <NewTile count={items.length} navigate={navigate} />
          </div>
        </div>
      </div>
    </motion.section>
  );
}

/* ─── Thumbnail card ─────────────────────────────────────── */
function Thumb({ item, i, navigate }) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.button
      type="button"
      onClick={() => navigate("/workspace/image-generator")}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      initial={{ opacity: 0, scale: 0.82, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{
        delay: i * 0.045,
        duration: 0.38,
        ease: [0.34, 1.4, 0.64, 1], // spring overshoot
      }}
      className="group relative flex-shrink-0 w-[112px] h-[112px] md:w-[130px] md:h-[130px] rounded-[16px] overflow-hidden bg-[#141416] focus:outline-none"
      style={{
        boxShadow: hovered
          ? "0 0 0 1.5px rgba(122,59,255,0.7), 0 8px 32px rgba(122,59,255,0.22)"
          : "0 0 0 1px rgba(255,255,255,0.06)",
        transition: "box-shadow 0.25s ease",
      }}
      title={item.prompt || undefined}
    >
      {/* image */}
      <img
        src={item.result_url}
        alt=""
        loading={i < 4 ? "eager" : "lazy"}
        decoding="async"
        className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.08]"
      />

      {/* time badge — always on */}
      <div className="absolute top-1.5 left-1.5 px-1.5 py-[2px] rounded-md bg-black/65 backdrop-blur-sm">
        <span className="text-white/55 text-[9px] font-semibold tracking-wide leading-none">
          {timeAgo(item.created_at)}
        </span>
      </div>

      {/* prompt overlay — hover */}
      <motion.div
        initial={false}
        animate={{ opacity: hovered ? 1 : 0, y: hovered ? 0 : 6 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="absolute inset-0 flex flex-col justify-end p-2.5"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.96) 0%, rgba(0,0,0,0.55) 60%, transparent 100%)",
        }}
      >
        {item.prompt && (
          <p className="text-white/90 text-[10px] leading-[1.3] line-clamp-2 font-medium mb-1.5">
            {item.prompt}
          </p>
        )}
        <div className="flex items-center gap-1 text-[#a78bfa] text-[9px] font-bold tracking-wide">
          <Wand2 size={9} />
          <span>Use this prompt</span>
        </div>
      </motion.div>
    </motion.button>
  );
}

/* ─── "Create new" tile ──────────────────────────────────── */
function NewTile({ count, navigate }) {
  return (
    <motion.button
      type="button"
      onClick={() => navigate("/workspace/image-generator")}
      initial={{ opacity: 0, scale: 0.82, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{
        delay: count * 0.045,
        duration: 0.38,
        ease: [0.34, 1.4, 0.64, 1],
      }}
      className="group relative flex-shrink-0 w-[112px] h-[112px] md:w-[130px] md:h-[130px] rounded-[16px] overflow-hidden bg-[#111316] focus:outline-none flex flex-col items-center justify-center gap-2"
      style={{
        border: "1.5px dashed rgba(255,255,255,0.1)",
        transition: "border-color 0.25s ease, box-shadow 0.25s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(122,59,255,0.5)";
        e.currentTarget.style.boxShadow   = "0 0 24px rgba(122,59,255,0.12)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
        e.currentTarget.style.boxShadow   = "none";
      }}
    >
      {/* shimmer on hover */}
      <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: "radial-gradient(circle at 50% 40%, rgba(122,59,255,0.12) 0%, transparent 70%)" }}
      />

      <div className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300"
        style={{ background: "rgba(122,59,255,0.1)", border: "1px solid rgba(122,59,255,0.2)" }}
      >
        <Plus size={16} className="text-[#7A3BFF] opacity-60 group-hover:opacity-100 transition-opacity duration-300" />
      </div>
      <span className="text-[11px] font-semibold text-white/25 group-hover:text-white/55 transition-colors duration-300">
        Create new
      </span>
    </motion.button>
  );
}
