/**
 * /face-asmr-maker — SEO landing page
 *
 * TARGET KEYWORDS (primary → long-tail):
 *   "face asmr maker"
 *   "face asmr video generator"
 *   "ai face asmr creator"
 *   "viral face asmr tiktok"
 *   "face asmr video maker free"
 *   "ai asmr video maker online"
 *   "face reveal asmr video generator"
 */

import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Check } from "lucide-react";

const BACKGROUNDS = [
  { preview: "/face/cleanwhitemarbe.png",   label: "White Marble",    views: "3.2M" },
  { preview: "/face/black marbe.png",       label: "Black Marble",    views: "2.8M" },
  { preview: "/face/lightoakwood.png",      label: "Light Oak Wood",  views: "1.9M" },
  { preview: "/face/darkwalnutwood.png",    label: "Dark Walnut",     views: "1.6M" },
  { preview: "/face/frostedglass.png",      label: "Frosted Glass",   views: "1.4M" },
  { preview: "/face/polishedconcrete.png",  label: "Polished Concrete", views: "1.1M" },
];

const CELEBRITIES = [
  { src: "/face/messi.png",    name: "Messi" },
  { src: "/face/ronaldo.png",  name: "Ronaldo" },
  { src: "/face/neymar.png",   name: "Neymar" },
  { src: "/face/mbappe.png",   name: "Mbappé" },
  { src: "/face/ariana.png",   name: "Ariana" },
  { src: "/face/billie.png",   name: "Billie" },
  { src: "/face/taylor.png",   name: "Taylor" },
  { src: "/face/haaland.png",  name: "Haaland" },
];

const HOW_STEPS = [
  { n: "01", title: "Upload any face",        desc: "Upload a photo of any face — a celebrity, athlete, friend, or yourself. A clear front-facing photo works best." },
  { n: "02", title: "Pick your scenes",       desc: "Write a short scene description for each clip, or use one of our trending ASMR prompts. Choose 3, 6, or 9 scenes." },
  { n: "03", title: "Choose a background",    desc: "Select from 10 premium texture backgrounds — white marble, black marble, frosted glass, walnut wood, and more." },
  { n: "04", title: "Generate & download",    desc: "Zyvo generates every scene, places the face into each one with AI, and renders a full vertical video ready to post." },
];

const FAQS = [
  { q: "What is a Face ASMR video?", a: "A Face ASMR video places a real face into satisfying ASMR scenes — marble textures, carved soap, frosted glass, polished wood — creating a hypnotic, high-retention short video. The format is one of the fastest-growing on TikTok and Instagram Reels, combining the viral power of ASMR with the intrigue of a recognizable face." },
  { q: "Whose face can I use?", a: "You can upload any face photo — a celebrity, athlete, public figure, friend, or your own face. For best results, use a clear front-facing photo with good lighting and a plain background." },
  { q: "How long does it take to generate a Face ASMR video?", a: "From upload to a ready-to-post video in under 5 minutes. Upload the face, pick your scenes and background, and Zyvo generates every clip automatically. No editing required." },
  { q: "What video lengths are available?", a: "You can generate 15-second (3 scenes), 30-second (6 scenes), or 45-second (9 scenes) videos. Each scene is a short, seamlessly edited ASMR clip with the uploaded face placed into the texture background." },
  { q: "Do I need video editing skills?", a: "None at all. Zyvo handles the entire production pipeline — face placement, scene rendering, and video assembly. You upload a photo, pick settings, and download a finished vertical video." },
  { q: "Can I use the videos commercially?", a: "Yes. All videos generated on a paid plan are watermark-free and can be posted to TikTok, Instagram Reels, YouTube Shorts, or any other platform. You own your content." },
];

export default function FaceAsmrLanding() {
  const navigate = useNavigate();
  const videoRef = useRef(null);

  useEffect(() => {
    document.title = "Face ASMR Maker — Generate Viral Face ASMR Videos with AI | Zyvo";

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

    setMeta("description", "Create viral Face ASMR videos in minutes. Upload any face, pick a satisfying texture background, and Zyvo generates a full vertical ASMR video with AI face placement — ready to post on TikTok and Reels. No editing needed.");
    setMeta("keywords", "face asmr maker, face asmr video generator, ai face asmr creator, viral face asmr tiktok, face asmr video maker, ai asmr video maker online, face reveal asmr video generator, make face asmr videos");
    setOg("og:title", "Face ASMR Maker — Generate Viral Face ASMR Videos with AI");
    setOg("og:description", "Upload any face. Pick a texture scene. Get a full viral ASMR video in minutes. AI handles every clip. Ready to post on TikTok and Reels.");
    setOg("og:type", "website");
    setOg("og:url", "https://tryzyvo.com/face-asmr-maker");

    const schema = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "Zyvo Face ASMR Maker",
      "description": "Create viral Face ASMR videos with AI. Upload any face, pick a scene, and generate a full vertical ASMR video in minutes. No editing required.",
      "url": "https://tryzyvo.com/face-asmr-maker",
      "applicationCategory": "MultimediaApplication",
      "operatingSystem": "Web",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "EUR" },
      "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.9", "reviewCount": "1843" },
    };
    let schemaEl = document.querySelector("#ld-json-face-asmr");
    if (!schemaEl) { schemaEl = document.createElement("script"); schemaEl.id = "ld-json-face-asmr"; schemaEl.type = "application/ld+json"; document.head.appendChild(schemaEl); }
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
                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-purple-300">Trending Format on TikTok Right Now</span>
              </div>

              <h1 className="mb-5 text-[38px] font-black leading-[1.04] tracking-tight sm:text-[52px] lg:text-[60px]">
                Face ASMR<br />
                <span className="bg-gradient-to-r from-[#A855F7] via-[#D8B4FE] to-[#7C3AED] bg-clip-text text-transparent">
                  Video Maker
                </span>
              </h1>

              <p className="mb-8 text-[16px] leading-relaxed text-white/55 max-w-xl mx-auto lg:mx-0 sm:text-[18px]">
                Upload any face, pick a satisfying ASMR texture scene, and Zyvo
                generates a full vertical video with AI — ready to post on TikTok
                and Reels in under 5 minutes. No editing. No skills.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 mb-8">
                <button
                  onClick={() => navigate("/workspace/face-asmr")}
                  className="w-full sm:w-auto rounded-[16px] px-8 py-4 text-[16px] font-black text-white shadow-[0_8px_32px_rgba(124,58,237,0.5)] transition hover:opacity-90 active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg,#7C3AED,#A855F7)" }}
                >
                  Create Free Face ASMR Video →
                </button>
                <span className="text-[13px] text-white/30">No credit card · Free to start</span>
              </div>

              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-2">
                {["Any face works", "10 premium textures", "Up to 9 scenes", "Post-ready in minutes"].map((t) => (
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
                    <video ref={videoRef} src="/face/preview.mp4"
                      className="h-full w-full object-cover" muted loop playsInline preload="auto" />
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

      {/* ── TEXTURE BACKGROUNDS — H2 ── */}
      <section className="bg-[#0c0c0f] py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="mb-10 text-center">
            <h2 className="mb-3 text-[28px] font-black tracking-tight sm:text-[36px]">
              Choose Your ASMR Texture Scene
            </h2>
            <p className="text-[15px] text-white/40 max-w-lg mx-auto">
              Every background is a premium texture that generates a hypnotic, high-retention ASMR video. Pick one and Zyvo handles the rest.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
            {BACKGROUNDS.map((bg, i) => (
              <motion.button
                key={i}
                onClick={() => navigate("/workspace/face-asmr")}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="group relative overflow-hidden rounded-[18px] border border-white/[0.08] bg-white/[0.02]"
                style={{ aspectRatio: "9/14" }}
              >
                <img src={bg.preview} alt={`${bg.label} face asmr background`} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <div className="text-[12px] font-black text-white leading-tight">{bg.label}</div>
                  <div className="text-[10px] text-purple-300 font-semibold">{bg.views} views/wk</div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS — H2 ── */}
      <section className="py-16 md:py-20">
        <div className="mx-auto max-w-4xl px-4 md:px-6">
          <div className="mb-12 text-center">
            <h2 className="mb-3 text-[28px] font-black tracking-tight sm:text-[36px]">
              How to Make a Face ASMR Video
            </h2>
            <p className="text-[15px] text-white/40">From a face photo to a ready-to-post ASMR video in 4 steps.</p>
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
              onClick={() => navigate("/workspace/face-asmr")}
              className="rounded-[14px] px-8 py-4 text-[15px] font-black text-white shadow-[0_8px_32px_rgba(124,58,237,0.45)] transition hover:opacity-90"
              style={{ background: "linear-gradient(135deg,#7C3AED,#A855F7)" }}
            >
              Start Making Your Face ASMR Video →
            </button>
          </div>
        </div>
      </section>

      {/* ── CELEBRITY FACES — H2 ── */}
      <section className="bg-[#0c0c0f] py-14 md:py-16">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="mb-8 text-center">
            <h2 className="mb-2 text-[24px] font-black tracking-tight sm:text-[32px]">
              Any Face. Any Scene.
            </h2>
            <p className="text-[14px] text-white/40">Upload any public figure, athlete, artist — or upload your own photo.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            {CELEBRITIES.map((c, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="h-[72px] w-[58px] overflow-hidden rounded-[16px] border border-white/10 bg-[#111315]">
                  <img src={c.src} alt={`${c.name} face asmr`} className="h-full w-full object-cover object-top" loading="lazy" />
                </div>
                <span className="text-[10px] font-semibold text-white/35">{c.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES — H2 ── */}
      <section className="py-16 md:py-20">
        <div className="mx-auto max-w-5xl px-4 md:px-6">
          <h2 className="mb-10 text-center text-[26px] font-black tracking-tight sm:text-[34px]">
            Everything You Need to Go Viral with Face ASMR
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: "😮", title: "Any Face Works",          desc: "Upload any face photo and Zyvo places it into each ASMR scene with AI. Celebrities, athletes, creators, or yourself — all look great." },
              { icon: "🎨", title: "10 Premium Textures",     desc: "White marble, black marble, frosted glass, dark walnut, brushed steel, polished concrete, and more. Each one is engineered for ASMR virality." },
              { icon: "📐", title: "9-Scene Videos",          desc: "Generate up to 9 individual ASMR scenes assembled into a single 45-second vertical video. More scenes = more retention = more reach." },
              { icon: "📱", title: "Vertical 9:16 Format",    desc: "Every video is natively formatted for TikTok, Instagram Reels, and YouTube Shorts. No cropping, no reformatting. Just post." },
              { icon: "⚡", title: "Under 5 Minutes",         desc: "From photo upload to downloadable video in under 5 minutes. No waiting for a render farm. No export queue. Near-instant generation." },
              { icon: "💧", title: "Watermark-Free Export",   desc: "Every video on a paid plan exports without a watermark. Post directly from download to your TikTok or Reels account." },
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
      <section className="bg-[#0c0c0f] py-14 md:py-16">
        <div className="mx-auto max-w-4xl px-4 md:px-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { v: "3.2M+", l: "Views/week on ASMR face content" },
              { v: "< 5min", l: "From upload to video" },
              { v: "10",    l: "Premium texture backgrounds" },
              { v: "0",     l: "Editing skills needed" },
            ].map((s, i) => (
              <div key={i} className="rounded-[16px] border border-white/[0.07] bg-white/[0.02] p-5 text-center">
                <div className="text-[30px] font-black text-white">{s.v}</div>
                <div className="mt-1 text-[11px] text-white/35">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BLOG LINKS — internal linking for SEO ── */}
      <section className="py-16 md:py-20">
        <div className="mx-auto max-w-4xl px-4 md:px-6">
          <h2 className="mb-8 text-center text-[24px] font-black tracking-tight sm:text-[30px]">
            Learn More About Face ASMR
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { title: "Face ASMR Maker: How It Works & Why It Goes Viral", desc: "Everything you need to know about how AI face ASMR videos are made and what makes them hit millions of views.", slug: "/blog/face-asmr-maker" },
              { title: "Why Face ASMR Videos Go Viral on TikTok (2026)", desc: "The psychology behind ASMR virality, the face reveal element, and the exact strategy creators use to grow fast.", slug: "/blog/viral-face-asmr-videos" },
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

      {/* ── FAQ — H2 ── */}
      <section className="bg-[#0c0c0f] py-16 md:py-20">
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
      <section className="py-16 md:py-20">
        <div className="mx-auto max-w-2xl px-4 md:px-6 text-center">
          <h2 className="mb-4 text-[28px] font-black tracking-tight sm:text-[38px]">
            Make Your First Face ASMR Video<br />
            <span className="bg-gradient-to-r from-[#A855F7] to-[#7C3AED] bg-clip-text text-transparent">Right Now — It's Free</span>
          </h2>
          <p className="mb-8 text-[15px] text-white/45">
            Upload a face. Pick a texture. Get a viral-ready ASMR video in minutes.
          </p>
          <button
            onClick={() => navigate("/workspace/face-asmr")}
            className="rounded-[16px] px-10 py-4 text-[16px] font-black text-white shadow-[0_8px_40px_rgba(124,58,237,0.5)] transition hover:opacity-90 active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg,#7C3AED,#A855F7)" }}
          >
            Generate My Face ASMR Video →
          </button>
          <p className="mt-4 text-[12px] text-white/25">No credit card required · Free plan available</p>
        </div>
      </section>

    </div>
  );
}
