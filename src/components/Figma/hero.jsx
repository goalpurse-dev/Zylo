import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  FileText,
  Image as ImageIcon,
  Library,
  Share2,
  Sparkles,
  Video,
} from "lucide-react";

const heroTools = [
  { label: "Images", detail: "20+ styles", to: "/workspace/image-generator", icon: ImageIcon },
  { label: "Videos", detail: "10+ models", to: "/workspace/video-generator", icon: Video },
  { label: "Viral scripts", detail: "Write in seconds", to: "/workspace/viral-script", icon: FileText, badge: "POPULAR" },
  { label: "Publish", detail: "Post everywhere", to: "/workspace/publish", icon: Share2, badge: "NEW" },
  { label: "Analytics", detail: "Track growth", to: "/workspace/stats", icon: BarChart3 },
  { label: "Creations", detail: "Your library", to: "/workspace/creations", icon: Library },
];

const fadeUp = {
  initial: { opacity: 0, y: 22 },
  animate: { opacity: 1, y: 0 },
};

export default function Hero() {
  return (
    <section className="relative isolate min-h-[720px] overflow-hidden bg-[#090610] px-4 pb-16 pt-28 text-white sm:px-6 md:min-h-[760px] md:pb-20 md:pt-36">
      {/* Replace these files with the final 16:9 exports. Video is intentionally
          disabled below md to protect mobile load time and battery. */}
      <video
        className="absolute inset-0 -z-30 hidden h-full w-full object-cover md:block"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster="/hero/zyvo-hero-poster.webp"
        aria-hidden="true"
      >
        <source src="/hero/zyvo-hero.webm" type="video/webm" />
        <source src="/hero/zyvo-hero.mp4" type="video/mp4" />
      </video>

      {/* Branded fallback for mobile, reduced-motion users, and while video loads. */}
      <div className="absolute inset-0 -z-40 bg-[radial-gradient(circle_at_50%_20%,#4b2478_0%,#171020_38%,#090610_72%)]" />
      <div className="absolute inset-0 -z-20 bg-[linear-gradient(180deg,rgba(5,3,9,.3)_0%,rgba(7,4,12,.22)_38%,#090610_100%)]" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_42%,transparent_0%,rgba(5,3,9,.16)_48%,rgba(5,3,9,.72)_100%)]" />
      <div className="pointer-events-none absolute left-1/2 top-28 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-[#8a49ff]/20 blur-[110px] md:h-[420px] md:w-[420px]" />

      <div className="mx-auto flex max-w-7xl flex-col items-center text-center">
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.5 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/20 px-3.5 py-1.5 text-xs font-semibold text-white/80 shadow-lg backdrop-blur-md"
        >
          <Sparkles className="h-3.5 w-3.5 text-[#c7a9ff]" />
          The AI creation suite built for going viral
        </motion.div>

        <motion.h1
          {...fadeUp}
          transition={{ delay: 0.08, duration: 0.6 }}
          className="max-w-5xl text-balance text-4xl font-bold leading-[1.02] tracking-[-0.045em] text-white sm:text-6xl md:text-7xl lg:text-[82px]"
        >
          What will you create
          <span className="block bg-gradient-to-r from-white via-[#e8dbff] to-[#a970ff] bg-clip-text text-transparent">
            and make viral today?
          </span>
        </motion.h1>

        <motion.p
          {...fadeUp}
          transition={{ delay: 0.16, duration: 0.6 }}
          className="mt-6 max-w-2xl text-pretty text-base leading-relaxed text-white/65 sm:text-lg"
        >
          Turn one idea into scroll-stopping images, videos, scripts, and posts with the latest AI models in one creative workspace.
        </motion.p>

        <motion.div
          {...fadeUp}
          transition={{ delay: 0.24, duration: 0.6 }}
          className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row"
        >
          <Link
            to="/signup"
            className="group flex w-full items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-bold text-[#160c24] shadow-[0_12px_38px_rgba(255,255,255,.16)] transition hover:-translate-y-0.5 hover:bg-[#f3edff] sm:w-auto"
          >
            Start creating free
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            to="/workspace/creations"
            className="flex w-full items-center justify-center rounded-full border border-white/20 bg-white/[0.07] px-7 py-3.5 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/[0.12] sm:w-auto"
          >
            Explore what&apos;s possible
          </Link>
        </motion.div>

        <motion.nav
          {...fadeUp}
          transition={{ delay: 0.34, duration: 0.65 }}
          aria-label="Create with Zyvo"
          className="mt-12 w-full max-w-6xl overflow-hidden rounded-[28px] border border-white/[0.13] bg-[#100d14]/80 p-2 shadow-[0_24px_80px_rgba(0,0,0,.42)] backdrop-blur-2xl sm:mt-16"
        >
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-6">
            {heroTools.map(({ label, detail, to, icon: Icon, badge }) => (
              <Link
                key={to}
                to={to}
                className="group flex min-h-[76px] items-center gap-3 rounded-[21px] px-3 py-3 text-left transition hover:bg-white/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a970ff]"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-white/75 transition group-hover:border-[#a970ff]/40 group-hover:bg-[#7a3bff]/20 group-hover:text-white">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
                    {label}
                    {badge && (
                      <span className="rounded-full bg-[#7a3bff] px-1.5 py-0.5 text-[8px] font-extrabold tracking-wide text-white">
                        {badge}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-white/45">{detail}</span>
                </span>
              </Link>
            ))}
          </div>
        </motion.nav>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.65, duration: 0.5 }}
          className="mt-5 text-xs font-medium text-white/45"
        >
          10 free generations · No credit card required
        </motion.p>
      </div>
    </section>
  );
}
