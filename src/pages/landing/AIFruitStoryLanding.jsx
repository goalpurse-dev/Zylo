/**
 * /ai-fruit-story-maker — SEO landing page
 *
 * TARGET KEYWORDS (primary → long-tail):
 *   "ai fruit story"
 *   "ai fruit story generator"
 *   "fruit drama video maker"
 *   "create viral fruit videos online"
 *   "ai tiktok fruit drama video"
 *    *   "make ai fruit drama videos"
 */

import { useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import Footer from "../../components/workspace/footer.jsx";

const PRESETS = [
  { src: "/viral-builder/ai-fruit/presets/cheating.webp",    label: "Cheating Reveal", note: "Reveal story" },
  { src: "/viral-builder/ai-fruit/presets/baby.webp",        label: "Baby Surprise", note: "Family twist" },
  { src: "/viral-builder/ai-fruit/presets/secret-twin.webp", label: "Secret Twin", note: "Identity twist" },
  { src: "/viral-builder/ai-fruit/presets/cheats-back.webp", label: "Revenge Comeback", note: "Comeback story" },
  { src: "/viral-builder/ai-fruit/presets/kicked-out.webp",  label: "Kicked Out", note: "Conflict story" },
  { src: "/viral-builder/ai-fruit/presets/custom.webp",      label: "Your Own Story", note: "Custom prompt" },
];

const CHARACTERS = [
  { src: "/viral-builder/ai-fruit/characters/bossmango.png",       name: "Boss Mango" },
  { src: "/viral-builder/ai-fruit/characters/orangemom.png",       name: "Orange Mom" },
  { src: "/viral-builder/ai-fruit/characters/hotpeach.webp",       name: "Hot Peach" },
  { src: "/viral-builder/ai-fruit/characters/banana.png",          name: "Banana" },
  { src: "/viral-builder/ai-fruit/characters/strawberrymom.png",   name: "Strawberry Mom" },
  { src: "/viral-builder/ai-fruit/characters/gangsterpineapple.png", name: "Gangster Pineapple" },
  { src: "/viral-builder/ai-fruit/characters/ananasgirl.png",      name: "Ananas Girl" },
  { src: "/viral-builder/ai-fruit/characters/orangekid.webp",      name: "Orange Kid" },
];

const HOW_STEPS = [
  { n: "01", title: "Write one sentence", desc: "Describe the fruit-drama premise, conflict, and desired outcome. Zyvo uses the idea to plan the story." },
  { n: "02", title: "Pick your characters", desc: "Choose 2–3 fruit characters. Each selectable character has a consistent visual identity across the generated scenes." },
  { n: "03", title: "Generate the story", desc: "Zyvo plans a multi-scene arc, writes dialogue, and generates the cinematic 3D scenes for your selected story length." },
  { n: "04", title: "Animate and review", desc: "Animate the generated scenes, review the result, and download the video when generation is complete." },
];

const FAQS = [
  { q: "What is an AI Fruit Story?", a: "An AI Fruit Story is a short-form fictional drama video in which stylized 3D fruit characters act out a simple conflict, reveal, or surprise across multiple scenes." },
  { q: "How long does it take to make a fruit drama video?", a: "Generation time varies with story length, scene count, selected models, and queue conditions. Zyvo shows progress in the workspace while the story is being created." },
  { q: "Do I need editing or design skills?", a: "No timeline editing or design software is required for the core workflow. You provide the idea, choose characters and settings, then review the generated scenes and video." },
  { q: "Can I make 1-minute long fruit videos?", a: "Yes. The tool supports a 60-second option with up to 10 scenes, subject to the settings available in the workspace." },
  { q: "What drama styles can I create?", a: "You can start with cheating-reveal, baby-surprise, secret-twin, revenge, and kicked-out presets, or describe a custom fictional story." },
  { q: "Do the characters speak in the videos?", a: "Yes. Animated scenes can include AI-generated English dialogue with mouth-synced character animation." },
];

export default function AIFruitStoryLanding() {
  const navigate  = useNavigate();
  const videoRef  = useRef(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.play().catch(() => {});
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
            <div className="w-full min-w-0 flex-1 text-center lg:text-left">
              <div className="mb-5 inline-flex max-w-full items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 sm:px-4">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-[0.11em] text-purple-300 sm:text-[11px] sm:tracking-[0.15em]">AI Fruit Story Video Workflow</span>
              </div>

              {/* H1 — primary keyword */}
              <h1 className="mb-5 max-w-full text-[36px] font-black leading-[1.04] tracking-tight sm:text-[52px] lg:text-[60px]">
                AI Fruit Story<br />
                <span className="bg-gradient-to-r from-[#A855F7] via-[#D8B4FE] to-[#7C3AED] bg-clip-text text-transparent">
                  Video Generator
                </span>
              </h1>

              <p className="mb-8 text-[16px] leading-relaxed text-white/55 max-w-xl mx-auto lg:mx-0 sm:text-[18px]">
                Generate a multi-scene cinematic fruit drama video from one idea.
                Zyvo plans the story, creates each scene, and animates talking characters in a vertical video you can review and download.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 mb-8">
                <button
                  onClick={() => navigate("/workspace/ai-fruit-story")}
                  className="w-full sm:w-auto rounded-[16px] px-8 py-4 text-[16px] font-black text-white shadow-[0_8px_32px_rgba(124,58,237,0.5)] transition hover:opacity-90 active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg,#7C3AED,#A855F7)" }}
                >
                  Open AI Fruit Story Tool →
                </button>
                <span className="text-[13px] text-white/30">Account and paid plan required</span>
              </div>

              {/* Trust signals */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-2">
                {["One prompt → full video", "Talking characters", "60-second stories", "Vertical 9:16 output"].map((t) => (
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
                    <video ref={videoRef} src="/viral-builder/ai-fruit/result.mp4"
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

      <section className="border-y border-white/[0.07] bg-[#0c0c0f] py-14 md:py-16">
        <div className="mx-auto max-w-4xl px-4 md:px-6">
          <h2 className="text-center text-[28px] font-black tracking-tight sm:text-[36px]">What Is the Zyvo AI Fruit Story Maker?</h2>
          <p className="mx-auto mt-4 max-w-3xl text-center text-[15px] leading-relaxed text-white/50">
            Zyvo&apos;s AI Fruit Story Maker is a guided video workflow for creating fictional vertical stories with consistent fruit characters. It combines story planning, dialogue, scene generation, and animation in one workspace; the public page explains the tool, while generation happens on the paid application route.
          </p>
        </div>
      </section>
      {/* ── STORY PRESETS — H2 ── */}
      <section className="bg-[#0c0c0f] py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="mb-10 text-center">
            {/* H2 — secondary keyword */}
            <h2 className="mb-3 text-[28px] font-black tracking-tight sm:text-[36px]">
              Choose Your Fruit Drama Style
            </h2>
            <p className="text-[15px] text-white/40 max-w-lg mx-auto">
              Choose a starting structure or use your own fictional story idea. Zyvo uses the selection to plan the multi-scene workflow.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
            {PRESETS.map((p, i) => (
              <motion.button
                key={i}
                onClick={() => navigate("/workspace/ai-fruit-story")}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="group relative overflow-hidden rounded-[18px] border border-white/[0.08] bg-white/[0.02]"
                style={{ aspectRatio: "9/14" }}
              >
                <img src={p.src} alt={`${p.label} AI fruit drama video`} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <div className="text-[12px] font-black text-white leading-tight">{p.label}</div>
                  <div className="text-[10px] text-purple-300 font-semibold">{p.note}</div>
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
              How to Make an AI Fruit Story Video
            </h2>
            <p className="text-[15px] text-white/40">From your idea to a video you can review and download in four steps.</p>
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
              onClick={() => navigate("/workspace/ai-fruit-story")}
              className="rounded-[14px] px-8 py-4 text-[15px] font-black text-white shadow-[0_8px_32px_rgba(124,58,237,0.45)] transition hover:opacity-90"
              style={{ background: "linear-gradient(135deg,#7C3AED,#A855F7)" }}
            >
              Start Making Your Fruit Story →
            </button>
          </div>
        </div>
      </section>

      <section className="border-y border-white/[0.07] bg-[#0c0c0f] py-14 md:py-16">
        <div className="mx-auto max-w-5xl px-4 md:px-6">
          <h2 className="text-center text-[26px] font-black tracking-tight sm:text-[34px]">AI Fruit Story Prompt Examples</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-[14px] text-white/45">Use these as structural examples, then adapt the characters, setting, conflict, and ending.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              "A proud mango café owner discovers that a close friend has opened a rival shop across the street, ending with an unexpected partnership.",
              "An orange parent finds a mysterious family photo, follows the clue through three locations, and meets a long-lost twin.",
              "A banana is blamed for ruining a celebration, gathers evidence across several scenes, and reveals who caused the mistake.",
            ].map((prompt) => (
              <div key={prompt} className="rounded-[18px] border border-purple-400/15 bg-purple-500/[0.05] p-5 text-[13px] leading-relaxed text-white/60">{prompt}</div>
            ))}
          </div>
        </div>
      </section>
      {/* ── CHARACTERS — H2 ── */}
      <section className="bg-[#0c0c0f] py-14 md:py-16">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="mb-8 text-center">
            <h2 className="mb-2 text-[24px] font-black tracking-tight sm:text-[32px]">
              Meet the AI Fruit Characters
            </h2>
            <p className="text-[14px] text-white/40">Each character has a locked visual identity — they look the same in every scene.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            {CHARACTERS.map((c, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="h-[72px] w-[58px] overflow-hidden rounded-[16px] border border-white/10 bg-[#111315]">
                  <img src={c.src} alt={`${c.name} AI fruit character`} className="h-full w-full object-cover object-top" loading="lazy" />
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
            AI Fruit Story Generator Features
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: "🎬", title: "Full 1-Minute Stories", desc: "Up to 10 scenes. Complete dramatic arc. Hook → escalation → shocking payoff. Zyvo plans the entire story structure." },
              { icon: "🎤", title: "Talking Characters", desc: "Every scene is animated with mouth-synced English dialogue. Your characters speak the exact lines AI wrote for them." },
              { icon: "✍️", title: "AI-Written Scripts", desc: "Zyvo writes the story, dialogue, and scene-by-scene descriptions from your premise and selected settings." },
              { icon: "🖼️", title: "Cinematic 3D Images", desc: "Each scene is generated as a cinematic 3D image based on your selected characters and story." },
              { icon: "📱", title: "Vertical 9:16 Format", desc: "Every video is built natively for TikTok, Instagram Reels, and YouTube Shorts. No cropping or reformatting needed." },
              { icon: "⚡", title: "No Editing Required", desc: "The core workflow does not require a video-editing timeline or manual keyframes. Generate, review, and download in one workspace." },
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
              { v: "9:16", l: "Vertical video format" },
              { v: "60 sec", l: "Maximum story length" },
              { v: "Up to 10", l: "Scenes per story" },
              { v: "English", l: "Generated dialogue" },
            ].map((s, i) => (
              <div key={i} className="rounded-[16px] border border-white/[0.07] bg-white/[0.02] p-5 text-center">
                <div className="text-[30px] font-black text-white">{s.v}</div>
                <div className="mt-1 text-[11px] text-white/35">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ — H2 (great for SEO) ── */}
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

      <section className="border-y border-white/[0.07] bg-[#0c0c0f] py-14 md:py-16">
        <div className="mx-auto max-w-4xl px-4 md:px-6">
          <h2 className="text-center text-[26px] font-black tracking-tight sm:text-[34px]">More AI Fruit Story Guides</h2>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              ["AI Fruit Story Ideas", "/blog/best-ai-fruit-story-ideas"],
              ["Fruit Drama Video Guide", "/blog/viral-ai-fruit-drama-videos"],
              ["TikTok Fruit Drama Strategy", "/blog/how-to-go-viral-tiktok-fruit-drama"],
              ["Character Ideas & Storylines", "/blog/ai-fruit-story-character-ideas"],
              ["Talking Character Dialogue Tips", "/blog/ai-fruit-story-talking-dialogue-tips"],
              ["AI vs Traditional Animation", "/blog/ai-fruit-story-vs-traditional-animation"],
              ["Prompt Formula + Examples", "/blog/ai-fruit-story-prompt-formula"],
              ["Post to Reels & Shorts Too", "/blog/ai-fruit-story-instagram-youtube-shorts"],
            ].map(([label, to]) => (
              <Link key={to} to={to} className="rounded-[16px] border border-white/[0.08] bg-white/[0.03] px-5 py-5 text-sm font-bold text-white/75 transition hover:border-purple-400/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400">
                {label} →
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-16 md:py-20">
        <div className="mx-auto max-w-2xl px-4 md:px-6 text-center">
          <h2 className="mb-4 text-[28px] font-black tracking-tight sm:text-[38px]">
            Make Your First AI Fruit Story<br />
            <span className="bg-gradient-to-r from-[#A855F7] to-[#7C3AED] bg-clip-text text-transparent">in the Zyvo Workspace</span>
          </h2>
          <p className="mb-8 text-[15px] text-white/45">
            Describe the story, select characters, generate the scenes, and review the finished vertical video.
          </p>
          <button
            onClick={() => navigate("/workspace/ai-fruit-story")}
            className="rounded-[16px] px-10 py-4 text-[16px] font-black text-white shadow-[0_8px_40px_rgba(124,58,237,0.5)] transition hover:opacity-90 active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg,#7C3AED,#A855F7)" }}
          >
            Open AI Fruit Story Tool →
          </button>
          <p className="mt-4 text-[12px] text-white/25">Account and paid plan required; credit use depends on your selected settings.</p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
