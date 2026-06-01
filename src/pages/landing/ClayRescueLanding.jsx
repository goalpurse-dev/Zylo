/**
 * /clay-rescue-maker - SEO landing page
 *
 * Target keywords:
 * clay rescue ai, clay rescue video maker, ai clay animation video generator,
 * giant hand rescue videos, viral clay rescue videos, clay people video maker
 */

import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Check } from "lucide-react";

const EXAMPLES = [
  { title: "Tiny village fire", image: "/clayrescue/scene1fix.webp", label: "Water rescue" },
  { title: "Flooded clay street", image: "/clayrescue/scene2fix.webp", label: "Sponge fix" },
  { title: "Disaster solved", image: "/clayrescue/scene3fix.webp", label: "Happy ending" },
];

const STEPS = [
  { n: "01", title: "Choose a rescue length", desc: "Pick a short or longer Clay Rescue sequence. Zyvo creates multiple scenes with a clear problem, a giant hand fix, and a satisfying reaction." },
  { n: "02", title: "AI plans the disaster", desc: "Each scene gets a simple visual crisis: fire, flood, blocked road, stuck train, giant food object, broken bridge, storm, or another tiny-world problem." },
  { n: "03", title: "The giant hand fixes it", desc: "The hand applies a visible cause-and-effect solution. Water extinguishes fire, a sponge removes flood water, a fingertip stops the rolling object." },
  { n: "04", title: "Clay people react", desc: "Only after the problem is visibly solved, the tiny clay people celebrate. That reaction is what makes the rescue feel magical and rewatchable." },
];

const FAQS = [
  { q: "What is Clay Rescue?", a: "Clay Rescue is an AI video format where tiny clay people face a giant problem, then a realistic human hand enters the miniature world and fixes it. The clear rescue and emotional reaction make it ideal for TikTok, Reels, and Shorts." },
  { q: "How is this different from normal AI video generation?", a: "Clay Rescue is structured for a specific viral format. Zyvo plans the crisis, the hand action, the actual visible fix, and the final celebration so the video has a strong cause-and-effect story instead of a random animation." },
  { q: "Can I choose different disasters?", a: "Yes. Clay Rescue supports many scenarios, from fires and floods to giant objects blocking roads, broken bridges, stuck trains, bubbles, honey spills, boulders, storms, and other miniature-world problems." },
  { q: "Why do Clay Rescue videos perform well?", a: "They create instant curiosity: a tiny world is in danger, a massive hand appears, and the viewer watches to see whether the fix works. The payoff is visual and simple, which helps retention and rewatch rate." },
  { q: "Do I need animation skills?", a: "No. Zyvo generates the clay scenes, rescue images, and videos for you. You just start the tool and download the finished vertical clips." },
  { q: "Can I post these videos commercially?", a: "Yes. Paid plan exports are watermark-free and can be used on TikTok, Instagram Reels, YouTube Shorts, and other social channels." },
];

export default function ClayRescueLanding() {
  const navigate = useNavigate();
  const videoRef = useRef(null);

  useEffect(() => {
    document.title = "Clay Rescue AI Video Maker - Create Viral Giant Hand Rescue Videos | Zyvo";

    const setMeta = (name, content) => {
      let el = document.querySelector(`meta[name="${name}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("name", name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };
    const setOg = (prop, content) => {
      let el = document.querySelector(`meta[property="${prop}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("property", prop);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    setMeta("description", "Create viral Clay Rescue videos with AI. Tiny clay people face fires, floods, broken bridges, and giant objects while a realistic human hand applies a simple visible fix. No editing needed.");
    setMeta("keywords", "clay rescue ai, clay rescue video maker, ai clay animation video generator, giant hand rescue videos, viral clay rescue videos, clay people video maker, miniature rescue ai video");
    setOg("og:title", "Clay Rescue AI Video Maker - Create Viral Giant Hand Rescue Videos");
    setOg("og:description", "Generate tiny clay-world rescue videos with visible cause-and-effect fixes and emotional clay people reactions.");
    setOg("og:type", "website");
    setOg("og:url", "https://tryzyvo.com/clay-rescue-maker");
    setOg("og:image", "https://tryzyvo.com/clayrescue/smallpreview.webp");

    const schema = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Zyvo Clay Rescue",
      description: "AI video maker for viral Clay Rescue videos featuring tiny clay people, giant hand fixes, and satisfying miniature rescue scenes.",
      url: "https://tryzyvo.com/clay-rescue-maker",
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Web",
      offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    };
    let schemaEl = document.querySelector("#ld-json-clay-rescue");
    if (!schemaEl) {
      schemaEl = document.createElement("script");
      schemaEl.id = "ld-json-clay-rescue";
      schemaEl.type = "application/ld+json";
      document.head.appendChild(schemaEl);
    }
    schemaEl.textContent = JSON.stringify(schema);

    videoRef.current?.play().catch(() => {});
    return () => {
      document.title = "Zyvo - Go Viral With AI Content Creation";
      schemaEl?.remove();
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#08080a] text-white">
      <section className="relative overflow-hidden pt-16 pb-16 md:pt-24 md:pb-24">
        <div className="relative mx-auto max-w-6xl px-4 md:px-6">
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-purple-400/30 bg-purple-500/10 px-4 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-300 animate-pulse" />
                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-purple-200">New viral AI video format</span>
              </div>

              <h1 className="max-w-3xl text-[38px] font-black leading-[1.03] tracking-tight sm:text-[54px] lg:text-[64px]">
                Clay Rescue AI Video Maker
              </h1>
              <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-white/58 sm:text-[18px]">
                Generate tiny clay-world rescue videos where miniature people face a clear disaster, a giant human hand applies a simple fix, and the clay people celebrate only after the problem is solved.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  onClick={() => navigate("/workspace/clay-rescue")}
                  className="rounded-[16px] px-8 py-4 text-[16px] font-black text-white shadow-[0_12px_40px_rgba(122,59,255,0.45)] transition hover:opacity-90 active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg,#7A3BFF,#A855F7)" }}
                >
                  Create Clay Rescue Video
                </button>
                <span className="text-[13px] text-white/35">Free to start. No editing skills needed.</span>
              </div>

              <div className="mt-8 grid gap-2 sm:grid-cols-2">
                {["Visible problem and fix", "Giant hand rescue action", "Tiny clay people reactions", "9:16 TikTok-ready videos"].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-[13px] text-white/50">
                    <Check size={14} className="text-purple-300" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[340px]">
              <div className="absolute -inset-8 rounded-full bg-purple-500/15 blur-3xl" />
              <div className="relative overflow-hidden rounded-[34px] border border-white/15 bg-black shadow-[0_32px_90px_rgba(0,0,0,0.85)]">
                <div className="aspect-[9/16] overflow-hidden">
                  <video ref={videoRef} src="/clayrescue/homevideo.mp4" className="h-full w-full object-cover" autoPlay muted loop playsInline preload="none" />
                </div>
              </div>
              <div className="mx-auto mt-2 h-1 w-16 rounded-full bg-white/15" />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#0d0d11] py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="mb-10 text-center">
            <h2 className="text-[28px] font-black tracking-tight sm:text-[38px]">Built for Cause-and-Effect Rescue Stories</h2>
            <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-relaxed text-white/45">
              The format works because the viewer sees a problem, then sees the fix actually remove it. No random celebration while the disaster is still visible.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {EXAMPLES.map((item) => (
              <button
                key={item.title}
                onClick={() => navigate("/workspace/clay-rescue")}
                className="group relative overflow-hidden rounded-[22px] border border-white/[0.08] bg-white/[0.03] text-left"
              >
                <div className="aspect-[9/13] overflow-hidden">
                  <img src={item.image} alt={item.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.05]" loading="lazy" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <span className="rounded-full bg-white/12 px-2.5 py-1 text-[10px] font-bold text-white/75 backdrop-blur">{item.label}</span>
                  <h3 className="mt-3 text-[16px] font-black text-white">{item.title}</h3>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className="mx-auto max-w-5xl px-4 md:px-6">
          <div className="mb-10 text-center">
            <h2 className="text-[28px] font-black tracking-tight sm:text-[36px]">How Clay Rescue Works</h2>
            <p className="mt-3 text-[15px] text-white/45">From disaster idea to viral-ready rescue video in minutes.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.n}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: i * 0.06 }}
                className="rounded-[20px] border border-white/[0.07] bg-white/[0.03] p-6"
              >
                <div className="mb-3 text-[32px] font-black leading-none text-white/[0.08]">{step.n}</div>
                <h3 className="mb-2 text-[16px] font-bold text-white">{step.title}</h3>
                <p className="text-[13px] leading-relaxed text-white/45">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#0d0d11] py-16 md:py-20">
        <div className="mx-auto max-w-5xl px-4 md:px-6">
          <h2 className="mb-10 text-center text-[28px] font-black tracking-tight sm:text-[36px]">Why Creators Use Clay Rescue</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { title: "Instant hook", desc: "A tiny town in danger creates an immediate question: how will it be saved?" },
              { title: "Satisfying payoff", desc: "The viewer watches the fix happen on screen, then gets the emotional celebration." },
              { title: "Endless scenarios", desc: "Fires, floods, stuck trains, giant food, broken bridges, storms, bubbles, boulders, and more." },
              { title: "Faceless content", desc: "No camera, no voice, no filming setup. The format is built for faceless short-form channels." },
              { title: "Shorts ready", desc: "Vertical 9:16 clips are ready for TikTok, Instagram Reels, and YouTube Shorts." },
              { title: "Repeatable niche", desc: "The same structure supports hundreds of rescue ideas while still feeling fresh." },
            ].map((item) => (
              <div key={item.title} className="rounded-[18px] border border-white/[0.07] bg-white/[0.02] p-5">
                <h3 className="mb-2 text-[15px] font-bold text-white">{item.title}</h3>
                <p className="text-[13px] leading-relaxed text-white/42">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className="mx-auto max-w-4xl px-4 md:px-6">
          <h2 className="mb-8 text-center text-[26px] font-black tracking-tight sm:text-[34px]">Clay Rescue Guides</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { title: "Clay Rescue AI Video Maker: How It Works", desc: "A complete breakdown of the Clay Rescue format, the scene structure, and why the fix must visibly solve the crisis.", slug: "/blog/clay-rescue-ai-video-maker" },
              { title: "Why Giant Hand Rescue Videos Go Viral", desc: "The retention psychology behind tiny-world disasters, simple fixes, and clay people reactions.", slug: "/blog/why-giant-hand-rescue-videos-go-viral" },
            ].map((post) => (
              <button key={post.slug} onClick={() => navigate(post.slug)} className="rounded-[18px] border border-white/[0.07] bg-white/[0.03] p-6 text-left transition hover:border-purple-400/30 hover:bg-white/[0.05]">
                <h3 className="mb-2 text-[16px] font-bold text-white">{post.title}</h3>
                <p className="text-[13px] leading-relaxed text-white/42">{post.desc}</p>
                <span className="mt-4 inline-block text-[12px] font-bold text-purple-300">Read article</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#0d0d11] py-16 md:py-20">
        <div className="mx-auto max-w-3xl px-4 md:px-6">
          <h2 className="mb-10 text-center text-[26px] font-black tracking-tight sm:text-[34px]">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {FAQS.map((faq) => (
              <details key={faq.q} className="group cursor-pointer rounded-[16px] border border-white/[0.07] bg-white/[0.03] p-5">
                <summary className="flex items-center justify-between gap-4 text-[14px] font-bold text-white list-none">
                  {faq.q}
                  <span className="text-white/35 transition group-open:rotate-180">v</span>
                </summary>
                <p className="mt-3 text-[13px] leading-relaxed text-white/50">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className="mx-auto max-w-2xl px-4 text-center md:px-6">
          <h2 className="text-[30px] font-black leading-tight tracking-tight sm:text-[42px]">Create Your First Clay Rescue Video</h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-white/45">
            Build a miniature disaster, show the giant hand fix, and let the clay people celebrate after the rescue works.
          </p>
          <button
            onClick={() => navigate("/workspace/clay-rescue")}
            className="mt-8 rounded-[16px] px-10 py-4 text-[16px] font-black text-white shadow-[0_12px_40px_rgba(122,59,255,0.45)] transition hover:opacity-90 active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg,#7A3BFF,#A855F7)" }}
          >
            Try Clay Rescue Free
          </button>
        </div>
      </section>
    </div>
  );
}
