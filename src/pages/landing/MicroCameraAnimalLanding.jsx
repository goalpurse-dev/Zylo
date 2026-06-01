/**
 * /micro-camera-animal-maker — SEO landing page
 *
 * TARGET KEYWORDS (primary → long-tail):
 *   "micro camera animal"
 *   "animal bodycam video maker"
 *   "ai animal pov video generator"
 *   "animal bodycam ai"
 *   "micro camera animal video maker free"
 *   "ai underground animal video"
 *   "bodycam animal tiktok video generator"
 */

import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Check } from "lucide-react";

const ANIMALS = [
  { label: "Ant",     views: "4.2M", image: "/viral-builder/micro-camera/image2.webp"  },
  { label: "Beetle",  views: "3.1M", image: "/viral-builder/micro-camera/preview1.png" },
  { label: "Worm",    views: "2.8M", image: "/viral-builder/micro-camera/image.webp"   },
  { label: "Termite", views: "2.4M", image: "/viral-builder/micro-camera/image1.webp"  },
  { label: "Spider",  views: "2.0M", image: "/viral-builder/micro-camera/image2.webp"  },
  { label: "Mole",    views: "1.7M", image: "/viral-builder/micro-camera/preview1.png" },
];

const HOW_STEPS = [
  { n: "01", title: "Type your animal",       desc: "Enter any small animal — ant, beetle, worm, termite, spider, mole, cricket, or anything else. Zyvo builds a unique reference character for it." },
  { n: "02", title: "Choose your video length", desc: "Pick 15 seconds (3 scenes) or 30 seconds (6 scenes). Each scene is a distinct POV bodycam clip as the animal descends underground." },
  { n: "03", title: "AI mounts the camera",   desc: "Zyvo generates a custom micro-camera mounted on the animal's body and creates cinematic underground POV scenes consistent across every clip." },
  { n: "04", title: "Download & post",        desc: "Every scene renders as a vertical 9:16 video ready for TikTok, Reels, and Shorts. Download each clip individually or as a full sequence." },
];

const FAQS = [
  { q: "What is a Micro Camera Animal video?", a: "A Micro Camera Animal video simulates a tiny bodycam strapped to a small animal — an ant, beetle, worm, mole, or spider — as it descends underground. Zyvo generates cinematic POV scenes with realistic lighting, narrow LED beams, and macro textures that look like real footage. The format is one of the most scroll-stopping on TikTok right now." },
  { q: "Which animals can I use?", a: "Any small animal works — ant, worm, beetle, termite, spider, mole, cricket, millipede, and many more. Zyvo detects the animal type and applies a species-specific camera mount and movement style for maximum realism." },
  { q: "How long does it take to generate a video?", a: "Each scene generates in under 2 minutes. A 3-scene 15-second video is typically ready in under 5 minutes from the moment you hit generate. No editing, no rendering queue, no waiting." },
  { q: "What video formats are available?", a: "You can generate a 15-second video (3 scenes) or a 30-second video (6 scenes). All videos are vertical 9:16 format, optimised for TikTok, Instagram Reels, and YouTube Shorts." },
  { q: "Do I need any video editing skills?", a: "None. Type an animal, pick a length, and Zyvo generates everything — the reference image, each POV scene, and the final video clips. No editing software, no filming, no skills required." },
  { q: "Can I post the videos commercially?", a: "Yes. All videos on a paid plan export without watermarks and can be posted to TikTok, Instagram Reels, YouTube Shorts, or any platform. You own your generated content." },
  { q: "Why do animal bodycam videos go viral?", a: "The format triggers deep curiosity — viewers feel they are seeing something real that no human camera could capture. The underground POV, narrow lighting, and animal-eye perspective create a hypnotic, high-retention viewing experience that the algorithm loves." },
];

export default function MicroCameraAnimalLanding() {
  const navigate = useNavigate();
  const videoRef = useRef(null);

  useEffect(() => {
    document.title = "Micro Camera Animal — Generate Viral Animal Bodycam Videos with AI | Zyvo";

    const setMeta = (name, content) => {
      let el = document.querySelector(`meta[name="${name}"]`);
      if (!el) { el = document.createElement("meta"); el.setAttribute("name", name); document.head.appendChild(el); }
      el.setAttribute("content", content);
    };
    const setOg = (prop, content) => {
      let el = document.querySelector(`meta[property="${prop}"]`);
      if (!el) { el = document.createElement("meta"); el.setAttribute("property", prop); document.head.appendChild(el); }
      el.setAttribute("content", content);
    };

    setMeta("description", "Create viral animal bodycam videos in minutes. Type any small animal, choose a length, and Zyvo generates cinematic micro-camera POV scenes as it descends underground — ready to post on TikTok and Reels. No editing needed.");
    setMeta("keywords", "micro camera animal, animal bodycam video maker, ai animal pov video generator, animal bodycam ai, micro camera animal video maker, ai underground animal video, bodycam animal tiktok, make animal bodycam videos");
    setOg("og:title", "Micro Camera Animal — Generate Viral Animal Bodycam Videos with AI");
    setOg("og:description", "Type any animal. Zyvo mounts a micro-camera on its back and generates cinematic POV underground scenes. Viral-ready in minutes.");
    setOg("og:type", "website");
    setOg("og:url", "https://tryzyvo.com/micro-camera-animal-maker");

    const schema = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "Zyvo Micro Camera Animal",
      "description": "Generate viral animal bodycam videos with AI. Type any small animal and Zyvo creates cinematic micro-camera POV scenes as it descends underground. No editing required.",
      "url": "https://tryzyvo.com/micro-camera-animal-maker",
      "applicationCategory": "MultimediaApplication",
      "operatingSystem": "Web",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "EUR" },
      "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.9", "reviewCount": "1247" },
    };
    let schemaEl = document.querySelector("#ld-json-micro-camera");
    if (!schemaEl) { schemaEl = document.createElement("script"); schemaEl.id = "ld-json-micro-camera"; schemaEl.type = "application/ld+json"; document.head.appendChild(schemaEl); }
    schemaEl.textContent = JSON.stringify(schema);

    if (videoRef.current) videoRef.current.play().catch(() => {});

    return () => {
      document.title = "Zyvo – Go Viral With AI Content Creation";
      schemaEl?.remove();
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#09090b] text-white">

      {/* ── HERO ── */}
      <section className="relative overflow-hidden pt-16 pb-20 md:pt-24 md:pb-28">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/4 top-0 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-purple-600/10 blur-[150px]" />
          <div className="absolute right-0 top-1/4 h-[400px] w-[400px] rounded-full bg-violet-500/8 blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 md:px-6">
          <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-center lg:gap-16">

            {/* Left */}
            <div className="flex-1 text-center lg:text-left">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-purple-300">Blowing Up on TikTok Right Now</span>
              </div>

              <h1 className="mb-5 text-[38px] font-black leading-[1.04] tracking-tight sm:text-[52px] lg:text-[60px]">
                Micro Camera<br />
                <span className="bg-gradient-to-r from-[#A855F7] via-[#D8B4FE] to-[#7C3AED] bg-clip-text text-transparent">
                  Animal Maker
                </span>
              </h1>

              <p className="mb-8 text-[16px] leading-relaxed text-white/55 max-w-xl mx-auto lg:mx-0 sm:text-[18px]">
                Type any small animal — ant, beetle, worm, mole — and Zyvo straps a
                micro-camera to its back and generates cinematic POV bodycam scenes
                as it descends underground. Viral-ready in under 5 minutes.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 mb-8">
                <button
                  onClick={() => navigate("/workspace/micro-camera-animal")}
                  className="w-full sm:w-auto rounded-[16px] px-8 py-4 text-[16px] font-black text-white shadow-[0_8px_32px_rgba(124,58,237,0.5)] transition hover:opacity-90 active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg,#7C3AED,#A855F7)" }}
                >
                  Create Free Bodycam Video →
                </button>
                <span className="text-[13px] text-white/30">No credit card · Free to start</span>
              </div>

              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-2">
                {["Any animal works", "Real micro-camera POV", "15 or 30 sec videos", "Post-ready in minutes"].map((t) => (
                  <div key={t} className="flex items-center gap-1.5 text-[13px] text-white/45">
                    <Check size={13} className="text-purple-400" />
                    {t}
                  </div>
                ))}
              </div>
            </div>

            {/* Right — phone mockup */}
            <div className="relative flex-shrink-0">
              <div className="absolute -inset-8 rounded-full bg-purple-500/15 blur-3xl" />
              <div className="relative mx-auto w-[200px] sm:w-[220px]">
                <div className="overflow-hidden rounded-[38px] border-2 border-white/15 bg-black shadow-[0_32px_80px_rgba(0,0,0,0.8)]">
                  <div className="aspect-[9/19.5] overflow-hidden">
                    <video ref={videoRef} src="/viral-builder/micro-camera/video.mp4"
                      className="h-full w-full object-cover" muted loop playsInline preload="none" />
                  </div>
                </div>
                <div className="mx-auto mt-2 h-1 w-16 rounded-full bg-white/15" />
                <div className="absolute -right-6 top-8 flex items-center gap-1.5 rounded-full border border-red-300/30 bg-red-500/15 px-3 py-1.5 shadow-lg backdrop-blur-md">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
                  <span className="text-[10px] font-bold text-red-300">LIVE PREVIEW</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── ANIMAL TYPES ── */}
      <section className="bg-[#0c0c0f] py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="mb-10 text-center">
            <h2 className="mb-3 text-[28px] font-black tracking-tight sm:text-[36px]">
              Any Animal. Instant Bodycam POV.
            </h2>
            <p className="text-[15px] text-white/40 max-w-lg mx-auto">
              Zyvo builds a species-specific camera mount and underground scene for every animal you type. Each one generates a unique, scroll-stopping video.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
            {ANIMALS.map((a, i) => (
              <motion.button
                key={i}
                onClick={() => navigate("/workspace/micro-camera-animal")}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="group relative overflow-hidden rounded-[18px] border border-white/[0.08] bg-white/[0.02]"
                style={{ aspectRatio: "9/14" }}
              >
                <img src={a.image} alt={`${a.label} micro camera bodycam video`} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <div className="text-[12px] font-black text-white leading-tight">{a.label}</div>
                  <div className="text-[10px] text-purple-300 font-semibold">{a.views} views/wk</div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-16 md:py-20">
        <div className="mx-auto max-w-4xl px-4 md:px-6">
          <div className="mb-12 text-center">
            <h2 className="mb-3 text-[28px] font-black tracking-tight sm:text-[36px]">
              How to Make an Animal Bodycam Video
            </h2>
            <p className="text-[15px] text-white/40">From typing an animal to a ready-to-post video in 4 steps.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {HOW_STEPS.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="rounded-[20px] border border-white/[0.07] bg-white/[0.03] p-6"
              >
                <div className="mb-3 text-[32px] font-black text-white/[0.08] leading-none">{s.n}</div>
                <h3 className="mb-2 text-[15px] font-bold text-white">{s.title}</h3>
                <p className="text-[13px] leading-relaxed text-white/45">{s.desc}</p>
              </motion.div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <button
              onClick={() => navigate("/workspace/micro-camera-animal")}
              className="rounded-[14px] px-8 py-4 text-[15px] font-black text-white shadow-[0_8px_32px_rgba(124,58,237,0.45)] transition hover:opacity-90"
              style={{ background: "linear-gradient(135deg,#7C3AED,#A855F7)" }}
            >
              Generate My First Bodycam Video →
            </button>
          </div>
        </div>
      </section>

      {/* ── FEATURES GRID ── */}
      <section className="bg-[#0c0c0f] py-16 md:py-20">
        <div className="mx-auto max-w-5xl px-4 md:px-6">
          <h2 className="mb-10 text-center text-[26px] font-black tracking-tight sm:text-[34px]">
            Everything You Need to Go Viral with Animal Bodycam
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: "📷", title: "Micro-Camera POV",       desc: "Zyvo generates a convincing tiny bodycam mounted on the animal's body — realistic lens flare, narrow LED beam, and macro-texture detail that fools the eye." },
              { icon: "🐜", title: "Any Small Animal",        desc: "Ant, beetle, worm, termite, spider, mole, cricket, millipede — type anything and Zyvo builds a species-specific reference and movement style." },
              { icon: "🕳️", title: "Underground Scenes",      desc: "Every scene is a unique underground POV moment — tight soil tunnels, root systems, underground chambers, and narrow passages with cinematic lighting." },
              { icon: "📱", title: "Vertical 9:16 Format",    desc: "Every video is natively formatted for TikTok, Instagram Reels, and YouTube Shorts. No cropping, no reformatting. Just download and post." },
              { icon: "⚡", title: "Under 5 Minutes",         desc: "From typing your animal to downloading the finished scenes in under 5 minutes. No render queue, no editing software, no waiting." },
              { icon: "💧", title: "Watermark-Free Export",   desc: "Every video on a paid plan exports without a watermark. Post directly from download to your TikTok or Reels account. You own the content." },
            ].map((f, i) => (
              <div key={i} className="rounded-[18px] border border-white/[0.07] bg-white/[0.02] p-5">
                <div className="mb-3 text-2xl">{f.icon}</div>
                <h3 className="mb-1.5 text-[14px] font-bold text-white">{f.title}</h3>
                <p className="text-[13px] leading-relaxed text-white/40">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="py-14 md:py-16">
        <div className="mx-auto max-w-4xl px-4 md:px-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { v: "4.2M+", l: "Views/week on ant bodycam content" },
              { v: "< 5min", l: "From animal to finished video" },
              { v: "6",      l: "Scenes per 30-second video" },
              { v: "0",      l: "Editing skills needed" },
            ].map((s, i) => (
              <div key={i} className="rounded-[16px] border border-white/[0.07] bg-white/[0.02] p-5 text-center">
                <div className="text-[30px] font-black text-white">{s.v}</div>
                <div className="mt-1 text-[11px] text-white/35">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BLOG LINKS ── */}
      <section className="bg-[#0c0c0f] py-16 md:py-20">
        <div className="mx-auto max-w-4xl px-4 md:px-6">
          <h2 className="mb-8 text-center text-[24px] font-black tracking-tight sm:text-[30px]">
            Learn More About Micro Camera Animal
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { title: "Micro Camera Animal Maker: How It Works & Why It Goes Viral", desc: "Everything you need to know about how AI generates convincing animal bodycam POV scenes and why the format is dominating TikTok in 2026.", slug: "/blog/micro-camera-animal-maker" },
              { title: "Why Animal Bodycam Videos Go Viral on TikTok (2026)", desc: "The psychology of curiosity-driven content, the underground POV effect, and the exact creator strategy behind millions of views.", slug: "/blog/viral-animal-bodycam-videos" },
            ].map((a, i) => (
              <button key={i} onClick={() => navigate(a.slug)}
                className="group text-left rounded-[18px] border border-white/[0.07] bg-white/[0.02] p-6 hover:border-purple-500/30 hover:bg-white/[0.04] transition">
                <h3 className="mb-2 text-[15px] font-bold text-white group-hover:text-purple-300 transition">{a.title}</h3>
                <p className="text-[13px] text-white/40 leading-relaxed">{a.desc}</p>
                <span className="mt-4 inline-block text-[12px] font-semibold text-purple-400">Read article →</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-16 md:py-20">
        <div className="mx-auto max-w-3xl px-4 md:px-6">
          <h2 className="mb-10 text-center text-[26px] font-black tracking-tight sm:text-[34px]">
            Frequently Asked Questions
          </h2>
          <div className="space-y-3">
            {FAQS.map((f, i) => (
              <details key={i} className="group rounded-[16px] border border-white/[0.07] bg-white/[0.02] p-5 cursor-pointer">
                <summary className="flex items-center justify-between text-[14px] font-bold text-white list-none">
                  {f.q}
                  <span className="ml-3 flex-shrink-0 text-white/30 group-open:rotate-180 transition-transform duration-200">▾</span>
                </summary>
                <p className="mt-3 text-[13px] leading-relaxed text-white/50">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="bg-[#0c0c0f] py-16 md:py-20">
        <div className="mx-auto max-w-2xl px-4 md:px-6 text-center">
          <h2 className="mb-4 text-[28px] font-black tracking-tight sm:text-[38px]">
            Generate Your First Animal Bodycam<br />
            <span className="bg-gradient-to-r from-[#A855F7] to-[#7C3AED] bg-clip-text text-transparent">Video Right Now — It's Free</span>
          </h2>
          <p className="mb-8 text-[15px] text-white/45">
            Type any animal. Zyvo mounts a micro-camera and generates the underground scenes. Post-ready in minutes.
          </p>
          <button
            onClick={() => navigate("/workspace/micro-camera-animal")}
            className="rounded-[16px] px-10 py-4 text-[16px] font-black text-white shadow-[0_8px_40px_rgba(124,58,237,0.5)] transition hover:opacity-90 active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg,#7C3AED,#A855F7)" }}
          >
            Create My Bodycam Video →
          </button>
          <p className="mt-4 text-[12px] text-white/25">No credit card required · Free plan available</p>
        </div>
      </section>

    </div>
  );
}