import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Glow from "../../components/workspace/Glow.jsx";
import Features from "../../components/workspace/features.jsx";
import ViralShowcase from "../../components/workspace/ViralShowcase.jsx";
import JumpBackIn from "../../components/workspace/JumpBackIn.jsx";
import WhatsHot from "../../components/workspace/WhatsHot.jsx";
import LatestModels from "../../components/workspace/LatestModels.jsx";
import PopularStyles from "../../components/workspace/popularstyles.jsx";
import PublishPromo from "../../components/workspace/PublishPromo.jsx";
import PublicGallery from "../../components/public-gallery/gallery.jsx";
import { useEffect } from "react";

/* ── Big hero card data ─────────────────────────────────────────── */
const SUITE_HERO = {
  name: "AI Fruit Story",
  desc: "Characters, stories, viral content & more",
  badge: "NEW",
  image: "/viral-builder/ai-fruit/presets/kicked-out.webp",
  path: "/workspace/ai-fruit-story",
};

/* ── Right grid cards ───────────────────────────────────────────── */
const SUITE_GRID = [
  { name: "Face ASMR",        desc: "Viral face reveal ASMR videos",     typeLabel: "Video",  trending: true,  image: "/face/neypreview.png",                              path: "/workspace/face-asmr"           },
  { name: "Micro Camera",    desc: "Animal bodycam goes underground",   typeLabel: "Video",  isNew: true,     image: "/viral-builder/micro-camera/preview1.png",          path: "/workspace/micro-camera-animal" },
  { name: "Video Generator", desc: "Create cinematic videos in seconds", typeLabel: "Video",  trending: false, image: "/home/videogen.png",                               path: "/workspace/video-generator"     },
  { name: "Viral Skeleton",  desc: "Scroll-stopping skeleton content",   typeLabel: null,     trending: true,  image: "/home/skeleton.png",                               path: "/workspace/skeleton-shorts"     },
  { name: "Clay Rescue",     desc: "Giant hands save tiny clay worlds",  typeLabel: "Video",  isNew: true,     image: "/clayrescue/smallpreview.webp",                   path: "/workspace/clay-rescue"         },
];

/* ── Big left card ──────────────────────────────────────────────── */
function BigSuiteCard({ tool, navigate, mobile }) {
  return (
    <motion.button
      onClick={() => navigate(tool.path)}
      initial={{ opacity: 0, x: -16 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={`group relative overflow-hidden rounded-2xl text-left focus:outline-none w-full ${
        mobile ? "h-[200px]" : "h-full"
      }`}
    >
      {/* background image */}
      <img
        src={tool.image}
        alt={tool.name}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
      />
      {/* dark overlay — very heavy at bottom for text legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/65 to-black/15" />
      {/* extra bottom punch so title/desc always pop */}
      <div className="absolute bottom-0 left-0 right-0 h-[55%] bg-gradient-to-t from-black/80 to-transparent" />

      {/* content */}
      <div className="relative z-10 flex flex-col h-full p-5 md:p-6">
        {tool.badge && (
          <span className="self-start px-2 py-0.5 rounded-md bg-[#7A3BFF] text-white text-[9px] font-black tracking-widest uppercase">
            {tool.badge}
          </span>
        )}
        <div className="mt-auto">
          <h3 className="text-white font-black text-[20px] md:text-[26px] leading-tight tracking-tight drop-shadow-lg">
            {tool.name}
          </h3>
          <p className="mt-1.5 text-white/70 text-[12px] md:text-[13px] leading-relaxed">
            {tool.desc}
          </p>
          <div className="mt-4 inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-white hover:bg-white/90 transition-all shadow-lg shadow-black/40">
            <span className="text-[#0a0a0c] text-[13px] font-bold tracking-tight">Try now ↗</span>
          </div>
        </div>
      </div>
    </motion.button>
  );
}

/* ── Small grid card ────────────────────────────────────────────── */
function SmallSuiteCard({ tool, i, navigate }) {
  return (
    <motion.button
      onClick={() => navigate(tool.path)}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: i * 0.06, duration: 0.4, ease: "easeOut" }}
      className="group relative overflow-hidden rounded-xl text-left focus:outline-none w-full h-[170px] md:h-full"
    >
      {/* background image — eager + high priority so it never shows black */}
      <img
        src={tool.image}
        alt={tool.name}
        fetchpriority="high"
        decoding="async"
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.07]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-transparent" />

      {/* content */}
      <div className="relative z-10 flex flex-col h-full p-3 md:p-3.5">
        {/* top-right badge */}
        <div className="flex justify-end">
          {tool.isNew ? (
            <span className="px-2 py-0.5 rounded-md bg-emerald-400 text-black text-[9px] font-black tracking-wide uppercase">
              New
            </span>
          ) : tool.trending ? (
            <span className="px-2 py-0.5 rounded-md bg-[#f7c948] text-black text-[9px] font-black tracking-wide uppercase">
              Trending
            </span>
          ) : tool.typeLabel ? (
            <span className="px-2 py-0.5 rounded-md bg-black/50 backdrop-blur-sm border border-white/15 text-white/80 text-[9px] font-semibold">
              {tool.typeLabel}
            </span>
          ) : null}
        </div>
        {/* bottom text */}
        <div className="mt-auto">
          <p className="text-white font-bold text-[13px] md:text-[14px] leading-tight drop-shadow">
            {tool.name}
          </p>
          <p className="mt-0.5 text-white/55 text-[11px] leading-snug line-clamp-2">
            {tool.desc}
          </p>
        </div>
      </div>
    </motion.button>
  );
}

export default function WorkspaceHome() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Create Visuals Faster";
  }, []);

  return (
    <div className="flex-1 pb-24 lg:pb-12">

      {/* 1 — HERO */}
      <Glow />

      {/* 2 — CATEGORY TABS */}
      <Features />

      {/* 3 — SHOWCASE CARDS */}
      <ViralShowcase />

      {/* 4 — ZYVO SUITE */}
      <section className="w-full max-w-7xl mx-auto px-5 md:px-8 mt-8">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white text-[20px] md:text-[26px] font-bold tracking-tight">
            Zyvo Suite
          </h2>
          <button
            onClick={() => navigate("/workspace/image-generator")}
            className="text-white/50 hover:text-white text-sm font-semibold transition-colors"
          >
            More →
          </button>
        </div>

        {/* DESKTOP — big card left + 3×2 grid right, fixed height so both sides are equal */}
        <div className="hidden md:flex gap-4 h-[300px] lg:h-[340px] xl:h-[360px] max-h-[380px]">
          <div className="w-[36%] xl:w-[40%] shrink-0 h-full">
            <BigSuiteCard tool={SUITE_HERO} navigate={navigate} />
          </div>
          <div className="flex-1 h-full grid grid-cols-3 grid-rows-2 gap-3">
            {SUITE_GRID.map((tool, i) => (
              <SmallSuiteCard key={tool.name} tool={tool} i={i} navigate={navigate} />
            ))}
          </div>
        </div>

        {/* MOBILE — stacked: big card then 2-col grid */}
        <div className="md:hidden flex flex-col gap-3">
          <BigSuiteCard tool={SUITE_HERO} navigate={navigate} mobile />
          <div className="grid grid-cols-2 gap-3">
            {SUITE_GRID.map((tool, i) => (
              <SmallSuiteCard key={tool.name} tool={tool} i={i} navigate={navigate} />
            ))}
          </div>
        </div>
      </section>

      {/* 5 — PUBLISH */}
      <PublishPromo />

      {/* 6 — JUMP BACK IN */}
      <JumpBackIn />

     

      {/* 7 — LATEST AI MODELS */}
      <LatestModels />

      {/* 8 — POPULAR STYLES */}
      <PopularStyles />

      {/* 9 — WHAT'S HOT */}
      <WhatsHot />

      {/* 10 — INSPIRATION GALLERY */}
      <div className="mt-8">
        <PublicGallery />
      </div>

    </div>
  );
}
