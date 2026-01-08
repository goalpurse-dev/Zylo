// src/pages/brands/BrandHome.jsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { getCurrentBrand, setCurrentBrand } from "../../lib/brandSession";
import { ArrowRight, Sparkles, Wand2, Megaphone, Image as ImageIcon, Stars, MessageSquare } from "lucide-react";

const wrap = "mx-auto w-full max-w-[1180px] px-4 lg:px-2";

/* PREVIEWS (trimmed to 1 per tool visually) */
import av1 from "../../assets/grid/01_talker_front_9x16.jpg";
import pr2 from "../../assets/grid/product/headphone.jpg";
import en1 from "../../assets/grid/image/astronaut.jpg";
import ws1 from "../../assets/grid/01_talker_front_9x16.jpg";
import ad1 from "../../assets/grid/01_talker_front_9x16.jpg";
import img3 from "../../assets/home/hero2.png";

const AVATAR_PREV    = [av1];
const WORKSPACE_PREV = [ws1];
const AD_PREV        = [ad1];
const PRODUCT_PREV   = [img3];
const ENH_PREV       = [en1];

function isVideo(src = "") { return /\.(mp4|webm|mov)(\?.*)?$/i.test(src); }

function MediaPane({ src, ratio = "9 / 16", alt = "" }) {
  const baseWidth = ratio === "1 / 1" ? 320 : 280;
  const smWidth   = ratio === "1 / 1" ? 280 : 260;

  return (
    <div className="relative group">
      <div
        className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.6)] transition-transform duration-300 group-hover:-translate-y-0.5"
        style={{ aspectRatio: ratio, width: baseWidth }}
      >
        {isVideo(src)
          ? <video src={src} className="h-full w-full object-cover" muted playsInline loop autoPlay />
          : <img src={src} alt={alt} className="h-full w-full object-cover" />
        }
      </div>
      <div
        className="pointer-events-none absolute -inset-2 rounded-3xl opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-30"
        style={{ background: "radial-gradient(800px 200px at 100% 0%, rgba(122,59,255,0.25), rgba(8,12,18,0))" }}
      />
      <style>{`@media (max-width:640px){[style*="aspect-ratio"]{width:${smWidth}px!important;}}`}</style>
    </div>
  );
}

function TinyBadge({ icon: Icon, children }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-medium text-white/80">
      {Icon ? <Icon size={14} className="opacity-90" /> : null}
      {children}
    </span>
  );
}

/* Text → Image → Buttons (buttons centered vertically & horizontally) */
function FeatureRow({
  title,
  description,
  to,
  img,
  ratio = "9 / 16",
  badge,
  bullets = [],
}) {
  const mediaWidth = ratio === "1 / 1" ? 320 : 280;
  const mediaWidthSm = ratio === "1 / 1" ? 280 : 260;

  return (
    <section className="relative grid grid-cols-1 items-center gap-6 rounded-2xl border border-white/10 bg-[#10151d] p-6 md:grid-cols-[1fr_auto_auto] md:gap-8 md:p-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* Left: text */}
      <div>
        <div className="mb-3 flex items-center gap-2">{badge}</div>
        <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">{title}</h2>
        <p className="mt-3 text-[15px] leading-6 text-white/80">{description}</p>
        {bullets?.length ? (
          <ul className="mt-4 space-y-2 text-white/80">
            {bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-[6px] inline-block h-1.5 w-1.5 rounded-full bg-white/50" />
                <span className="text-sm leading-6">{b}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* Middle: image */}
      <div className="flex justify-center md:justify-end">
        <MediaPane src={img} ratio={ratio} alt={title} />
      </div>

      {/* Right: centered buttons */}
      <div
        className="flex w-full flex-col gap-2 md:h-full md:justify-center md:items-center"
        style={{ maxWidth: mediaWidth }}
      >
        <Link
          to={to}
          className="group inline-flex justify-center items-center gap-2 rounded-xl bg-[#7A3BFF] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-12px_rgba(122,59,255,0.6)] transition-colors hover:bg-[#6a2fff] focus:outline-none focus:ring-2 focus:ring-[#7A3BFF] focus:ring-offset-2 focus:ring-offset-[#10151d]"
        >
          Open {title}
          <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
        </Link>

        <Link
          to={`/help/feedback?for=${encodeURIComponent(title)}`}
          className="inline-flex justify-center items-center gap-2 rounded-xl border border-white/15 bg-white/[.04] px-5 py-2.5 text-sm font-semibold text-white/90 hover:bg-white/10"
        >
          <MessageSquare size={16} className="opacity-90" />
          Give feedback for {title}
        </Link>
      </div>

      <style>{`@media (max-width:640px){section .actions-width{max-width:${mediaWidthSm}px!important;}}`}</style>
    </section>
  );
}

export default function BrandHome() {
  const navigate = useNavigate();
  const { id: routeId } = useParams();
  const [brand, setBrandState] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const effectiveId = routeId || getCurrentBrand()?.id;
        if (!effectiveId) { navigate("/brands", { replace: true }); return; }

        const { data, error } = await supabase
          .from("brands")
          .select("id,name")
          .eq("id", effectiveId)
          .maybeSingle();

        if (error || !data) { navigate("/brands", { replace: true }); return; }

        setCurrentBrand({ id: data.id, name: data.name });
        setBrandState(data);
      } finally { setLoading(false); }
    })();
  }, [routeId, navigate]);

  if (loading || !brand) return null;

  return (
    <main className="w-full bg-[#0b0f14] text-white py-8 md:py-10 min-h-screen">
      <div className={wrap}>
        <div className="mb-7 md:mb-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">{brand.name || "Untitled brand"}</h1>
            <p className="mt-2 text-white/70 text-sm">Your command center for avatars, ads, photos, and brand-safe enhancements.</p>
          </div>

          <Link to="/brands" className="rounded-xl border border-white/15 bg-white/[.04] px-4 py-2.5 text-sm font-semibold text-white/90 hover:bg-white/10">
            Switch brand
          </Link>
        </div>

        <div className="space-y-6 md:space-y-7">
          <FeatureRow
            title="Brand Workspace"
            description="Plan campaigns, keep assets consistent, and spin up brand-safe content in one unified flow."
            to="/brand"
            img={WORKSPACE_PREV[0]}
            ratio="9 / 16"
            badge={<TinyBadge icon={Sparkles}>Core hub</TinyBadge>}
            bullets={["Centralize palettes, voice & logo usage","Quick starts for common brand tasks","One place for teams to ship fast"]}
          />
          <FeatureRow
            title="Avatar Studio"
            description="Create on-brand talking avatars for explainers, product walk-throughs, support snippets, and more."
            to="/avatar-studio"
            img={AVATAR_PREV[0]}
            ratio="9 / 16"
            badge={<TinyBadge icon={Wand2}>On-brand faces</TinyBadge>}
            bullets={["9:16 ready for Shorts/Reels/TikTok","Script → avatar in minutes","Keep character styling consistent"]}
          />
          <FeatureRow
            title="Ad Studio"
            description="Generate scroll-stopping ad creatives with hooks that match your brand’s tone, products, and offers."
            to="/ad-studio"
            img={AD_PREV[0]}
            ratio="9 / 16"
            badge={<TinyBadge icon={Megaphone}>Performance ready</TinyBadge>}
            bullets={["Hook + angle templates included","UGC & motion-first formats","Export variations for rapid testing"]}
          />
          <FeatureRow
            title="Product Photos"
            description="Shoot perfect product photos without the studio: consistent lighting, clean shadows, and on-brand scenes."
            to="/product-photos"
            img={PRODUCT_PREV[0]}
            ratio="1 / 1"
            badge={<TinyBadge icon={ImageIcon}>1:1 showcase</TinyBadge>}
            bullets={["Lifestyle & silo shots","Scene swaps, reflections, shadows","Batch render variants in one go"]}
          />
          <FeatureRow
            title="Enhancements"
            description="Upscale, relight, remove backgrounds, or stylize to match your campaign look — in a single click."
            to="/enhancements"
            img={ENH_PREV[0]}
            ratio="1 / 1"
            badge={<TinyBadge icon={Stars}>Polish & style</TinyBadge>}
            bullets={["Remove/replace backgrounds","Tone & relight for brand fit","Super-resolution upscales"]}
          />
        </div>
      </div>
    </main>
  );
}
  