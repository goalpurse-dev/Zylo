import { Link } from "react-router-dom";
import { useEffect } from "react";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";
import Img1 from "../../../assets/inspiration/2.png";
import Img2 from "../../../assets/inspiration/5.png";
import Img3 from "../../../assets/inspiration/8.png";
import Img4 from "../../../assets/inspiration/11.png";
import Img5 from "../../../assets/inspiration/14.png";
import Img6 from "../../../assets/inspiration/17.png";

const related = [
  {
    title: "How to Write a Viral Script in 2026: The AI Framework That Gets Millions of Views",
    description: "The exact anatomy of viral scripts and why most creators get it wrong.",
    date: "21.04.2026",
    slug: "/blog/how-to-write-a-viral-script",
  },
  {
    title: "How to Go Viral With AI in 2026: The Complete Strategy",
    description: "The full playbook creators are using to dominate every platform with AI.",
    date: "16.04.2026",
    slug: "/blog/how-to-go-viral-with-ai",
  },
  {
    title: "AI Video Is the New Viral Currency — Here's How to Use It",
    description: "How creators are hitting millions of views with AI-generated short-form video.",
    date: "16.04.2026",
    slug: "/blog/ai-video-new-viral-currency",
  },
];

export default function AIScriptGeneratorViralVideos() {
  useEffect(() => {
    document.title = "AI Script Generator: Write Viral TikTok & YouTube Scripts in 60 Seconds (2026) | Zyvo";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute(
        "content",
        "The best AI script generator for TikTok, YouTube Shorts, and Instagram Reels in 2026. Generate complete viral video scripts — with image and video prompts per scene — in under 60 seconds. Free to try."
      );
    }
  }, []);

  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        {/* Breadcrumb */}
        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <Link to="/blog" className="hover:text-[#7A3BFF]">Go Viral</Link>
          <span className="mx-2">/</span>
          <span>AI Script Generator</span>
        </nav>

        {/* Header */}
        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Go Viral
          </span>
          <h1 className="text-[44px] font-bold text-[#110829] leading-tight mb-6">
            AI Script Generator: Write Viral TikTok & YouTube Scripts in 60 Seconds (2026)
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            The fastest-growing creators on TikTok, YouTube Shorts, and Instagram Reels aren't spending
            hours writing scripts. They're using AI script generators to produce platform-optimised,
            hook-engineered content in under a minute — then repeating that process five times a day.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Apr 21, 2026 · 8 min read · AI Tools</p>
        </header>

        {/* Hero image */}
        <div className="mb-24 w-full h-[420px] rounded-2xl overflow-hidden border border-[#ECE8F2]">
          <img src={Img1} alt="AI script generator for viral TikTok and YouTube videos" className="w-full h-full object-cover" />
        </div>

        {/* Intro */}
        <section className="mb-20 max-w-3xl">
          <p className="text-[17px] text-[#4A4A55] mb-5 leading-relaxed">
            In 2026, the content volume game is over. You can't win by posting more if your competitors
            are using AI to post better. An AI script generator doesn't just save time — it applies
            psychological engineering, platform-specific pacing, and viral hook frameworks that most
            creators spend years learning manually.
          </p>
          <p className="text-[17px] text-[#4A4A55] mb-5 leading-relaxed">
            This guide covers how AI script generators actually work, what separates the good ones from
            the useless ones, and how{" "}
            <Link to="/workspace/viral-script" className="text-[#7A3BFF] font-semibold hover:underline">
              Zyvo's Viral Script Builder
            </Link>{" "}
            goes beyond basic script generation to give you image and video prompts for every scene —
            turning one idea into a fully production-ready asset in a single step.
          </p>
        </section>

        {/* Section 1 */}
        <section className="mb-32 grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div className="w-full h-[360px] rounded-2xl border border-[#ECE8F2] bg-white overflow-hidden">
            <img src={Img2} alt="How AI script generators work for viral content" className="w-full h-full object-cover" />
          </div>
          <div>
            <span className="text-[#7A3BFF] text-[13px] font-bold uppercase tracking-widest mb-4 block">How It Works</span>
            <h2 className="text-[32px] font-semibold text-[#110829] mb-6 leading-tight">
              What an AI Script Generator Actually Does
            </h2>
            <p className="text-[#4A4A55] text-[16px] leading-relaxed mb-5">
              A basic AI script generator takes your topic and outputs text. A good one applies
              platform-specific viral frameworks — understanding that a 15-second TikTok needs a
              completely different structure than a 10-minute YouTube video.
            </p>
            <p className="text-[#4A4A55] text-[16px] leading-relaxed mb-5">
              The best AI script generators in 2026 don't just write — they engineer. They calculate
              per-scene duration based on your video length, select the optimal hook type for your
              niche, and auto-generate a CTA tuned to the engagement mechanics of your target platform.
            </p>
            <p className="text-[#4A4A55] text-[16px] leading-relaxed">
              Zyvo's script builder adds one more layer: every scene comes with an image prompt (for
              Midjourney or DALL-E 3) and a video prompt (for Runway or Kling) — so you can move from
              script to fully produced content without switching tools.
            </p>
          </div>
        </section>

        {/* Feature comparison */}
        <section className="mb-32">
          <h2 className="text-[34px] font-semibold text-[#110829] mb-8 max-w-3xl leading-tight">
            What to Look for in an AI Script Generator (2026)
          </h2>
          <p className="text-[#4A4A55] text-[16px] leading-relaxed mb-10 max-w-3xl">
            Most AI writing tools weren't built for short-form video scripts. Here's what separates a
            purpose-built viral script generator from a generic AI writer:
          </p>
          <div className="overflow-x-auto mb-10">
            <table className="w-full text-[14px] border-collapse">
              <thead>
                <tr className="border-b border-[#ECE8F2]">
                  <th className="text-left py-3 px-4 text-[#110829] font-semibold text-[15px]">Feature</th>
                  <th className="text-center py-3 px-4 text-[#7A3BFF] font-semibold text-[15px]">Zyvo Script Builder</th>
                  <th className="text-center py-3 px-4 text-[#888] font-semibold text-[15px]">Generic AI Writer</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Platform-specific scripts (TikTok, YT, Reels)", true, false],
                  ["Hook variants (3 different angles)", true, false],
                  ["Per-scene duration calculation", true, false],
                  ["Image prompt per scene (Midjourney/DALL-E)", true, false],
                  ["Video prompt per scene (Runway/Kling)", true, false],
                  ["Style presets (MrBeast, TikTok Viral, Story Arc…)", true, false],
                  ["Niche-aware writing", true, false],
                  ["Auto-optimised CTA per platform", true, false],
                  ["Copy-to-clipboard per scene", true, false],
                  ["Script download as .txt", true, true],
                ].map(([feat, zyvo, generic], i) => (
                  <tr key={i} className={`border-b border-[#ECE8F2] ${i % 2 === 0 ? "bg-white" : "bg-[#F7F5FA]"}`}>
                    <td className="py-3 px-4 text-[#4A4A55]">{feat}</td>
                    <td className="py-3 px-4 text-center">{zyvo ? <span className="text-[#7A3BFF] font-bold text-[16px]">✓</span> : <span className="text-[#DDD]">—</span>}</td>
                    <td className="py-3 px-4 text-center">{generic ? <span className="text-[#10B981] font-bold text-[16px]">✓</span> : <span className="text-[#DDD]">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3 - Style presets */}
        <section className="mb-32 grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div>
            <span className="text-[#7A3BFF] text-[13px] font-bold uppercase tracking-widest mb-4 block">Style Presets</span>
            <h2 className="text-[32px] font-semibold text-[#110829] mb-6 leading-tight">
              The 7 Viral Script Styles (And Which One You Need)
            </h2>
            <p className="text-[#4A4A55] text-[16px] leading-relaxed mb-5">
              Not all viral scripts use the same formula. A finance educator script is fundamentally
              different from a MrBeast-style challenge script. Zyvo's script builder has 7 engineered
              presets, each with a distinct psychological framework:
            </p>
            <div className="space-y-3">
              {[
                { icon: "💥", name: "MrBeast Mode", desc: "Escalating stakes, insane premise, specific numbers, cliffhanger endings." },
                { icon: "📱", name: "TikTok Viral", desc: "Pattern interrupts every 10s, value-first, sound-off friendly." },
                { icon: "📈", name: "Finance Educator", desc: "Counterintuitive stats, credibility signals, one actionable takeaway." },
                { icon: "📖", name: "Story Arc", desc: "3-act structure, specific sensory details, transformation narrative." },
                { icon: "😂", name: "Comedy Skit", desc: "Rule of threes, last-word punchlines, relatable situations exaggerated." },
                { icon: "🛍️", name: "Product Drop", desc: "Transformation-first, social proof, objection handled mid-script." },
                { icon: "🎓", name: "Tutorial Pro", desc: "End result in sentence 1, numbered steps, micro-wins throughout." },
              ].map((item) => (
                <div key={item.name} className="flex items-start gap-3 bg-white rounded-xl border border-[#ECE8F2] px-4 py-3">
                  <span className="text-[18px] mt-0.5 shrink-0">{item.icon}</span>
                  <div>
                    <span className="text-[#110829] font-semibold text-[14px]">{item.name}: </span>
                    <span className="text-[#4A4A55] text-[13px]">{item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="w-full h-[520px] rounded-2xl border border-[#ECE8F2] bg-white overflow-hidden">
            <img src={Img3} alt="AI script style presets for viral video content" className="w-full h-full object-cover" />
          </div>
        </section>

        {/* Section 4 - Image + Video prompts */}
        <section className="mb-32">
          <h2 className="text-[34px] font-semibold text-[#110829] mb-8 max-w-3xl leading-tight">
            The Feature Most AI Script Generators Are Missing: Media Prompts
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
            <div>
              <p className="text-[#4A4A55] text-[16px] leading-relaxed mb-6">
                Writing a great script is only half the production problem. The other half is visuals.
                Most creators finish their script and then have to figure out what images or B-roll to
                use for each scene — a process that can take as long as writing the script itself.
              </p>
              <p className="text-[#4A4A55] text-[16px] leading-relaxed mb-6">
                Zyvo's script builder generates image and video prompts for every scene alongside the script.
                Each image prompt is written to Midjourney v6 / DALL-E 3 spec — with subject, lighting,
                camera angle, mood, and composition specified. Each video prompt is written for Runway Gen-3
                or Kling — with duration, camera motion, subject action, and audio direction.
              </p>
              <p className="text-[#4A4A55] text-[16px] leading-relaxed">
                This means the output of one script generation session is not just a script — it's a
                complete production brief. You can take it directly into Zyvo's image or video generator
                and produce every visual in the same platform.
              </p>
            </div>
            <div className="space-y-4">
              <div className="bg-[#07080F] rounded-2xl p-5 border border-white/10">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Scene 1 — Hook</span>
                </div>
                <p className="text-white/75 text-[14px] leading-relaxed mb-4 font-medium">
                  "You've been doing this wrong for years. Here's what the top 1% of creators actually do..."
                </p>
                <div className="space-y-3">
                  <div className="bg-white/[0.04] rounded-xl p-3 border border-white/[0.07]">
                    <p className="text-[10px] text-violet-300/70 font-bold uppercase tracking-wider mb-1.5">🖼 Image Prompt</p>
                    <p className="text-white/50 text-[12px] font-mono leading-relaxed">Hyper-realistic close-up of hands typing on a laptop, golden hour light, shallow depth of field, cinematic grain, 9:16 vertical, shot on Sony A7IV, moody editorial tone</p>
                  </div>
                  <div className="bg-white/[0.04] rounded-xl p-3 border border-white/[0.07]">
                    <p className="text-[10px] text-cyan-300/70 font-bold uppercase tracking-wider mb-1.5">🎬 Video Prompt</p>
                    <p className="text-white/50 text-[12px] font-mono leading-relaxed">3s, slow push-in on hands typing, soft focus pull to reveal screen glow, ambient keyboard sounds fading to silence, anticipatory mood</p>
                  </div>
                </div>
              </div>
              <p className="text-[#888] text-[12px] text-center">Example output from Zyvo Script Builder — ready to use in any AI image or video generator</p>
            </div>
          </div>
        </section>

        {/* Step by step guide */}
        <section className="mb-32 grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div className="w-full h-[360px] rounded-2xl border border-[#ECE8F2] bg-white overflow-hidden">
            <img src={Img4} alt="Step by step guide to using AI script generator" className="w-full h-full object-cover" />
          </div>
          <div>
            <span className="text-[#7A3BFF] text-[13px] font-bold uppercase tracking-widest mb-4 block">Quick Start</span>
            <h2 className="text-[32px] font-semibold text-[#110829] mb-6 leading-tight">
              How to Generate a Viral Script in 60 Seconds
            </h2>
            <div className="space-y-5">
              {[
                { step: "1", title: "Choose a style preset", desc: "Pick from MrBeast, TikTok Viral, Story Arc, Tutorial Pro, and more. Each preset applies a different psychological framework." },
                { step: "2", title: "Set your duration and scene count", desc: "Choose your target video length (15 seconds to 20 minutes). The AI automatically calculates per-scene duration." },
                { step: "3", title: "Describe your idea and niche", desc: "Give the AI a brief description of your topic and optionally your creator niche for more personalised output." },
                { step: "4", title: "Generate and review", desc: "Your complete script — hook, scenes with media prompts, CTA, and two alternate hooks — is ready in under 60 seconds." },
                { step: "5", title: "Copy and produce", desc: "Copy any section with one click. Use the image and video prompts directly in Zyvo's generators to produce all your visuals." },
              ].map((item) => (
                <div key={item.step} className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-[#7A3BFF]/15 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[#7A3BFF] font-bold text-[13px]">{item.step}</span>
                  </div>
                  <div>
                    <p className="text-[#110829] font-semibold text-[15px] mb-1">{item.title}</p>
                    <p className="text-[#4A4A55] text-[14px] leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Platform guide */}
        <section className="mb-32">
          <h2 className="text-[34px] font-semibold text-[#110829] mb-8 max-w-3xl leading-tight">
            Platform-by-Platform Script Guide for 2026
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              {
                platform: "TikTok",
                color: "#EC4899",
                bg: "bg-pink-50",
                border: "border-pink-100",
                specs: ["Duration: 15–60s for max reach", "Hook: Must land in first 2 words", "Scenes: 3–5 tight scenes, 8–12s each", "Pattern interrupt every 10 seconds", "CTA: Comment or duet prompt"],
              },
              {
                platform: "YouTube Shorts",
                color: "#EF4444",
                bg: "bg-red-50",
                border: "border-red-100",
                specs: ["Duration: 45–59s for max distribution", "Hook: Clear value promise in first 3s", "Scenes: 3–4 scenes with visual variety", "End screen overlay in final 5s", "CTA: Watch full video (link in description)"],
              },
              {
                platform: "Instagram Reels",
                color: "#8B5CF6",
                bg: "bg-purple-50",
                border: "border-purple-100",
                specs: ["Duration: 30–60s performs best", "Hook: Strong visual + one-liner", "Scenes: Aspirational visuals essential", "Save-worthy information per scene", "CTA: Save this post"],
              },
              {
                platform: "YouTube Long-Form",
                color: "#F59E0B",
                bg: "bg-amber-50",
                border: "border-amber-100",
                specs: ["Duration: 8–20 min for algorithm push", "Hook: Tease the best moment in first 30s", "Scenes: 7–15 scenes with developed content", "Retention hook at minute 2 and minute 7", "CTA: Subscribe + watch next video"],
              },
            ].map((p) => (
              <div key={p.platform} className={`${p.bg} rounded-2xl border ${p.border} p-6`}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="font-bold text-[16px]" style={{ color: p.color }}>{p.platform}</span>
                </div>
                <ul className="space-y-2">
                  {p.specs.map((spec, i) => (
                    <li key={i} className="flex items-start gap-2 text-[14px] text-[#4A4A55]">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: p.color }} />
                      {spec}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Social proof / stats */}
        <section className="mb-32">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div className="w-full h-[340px] rounded-2xl border border-[#ECE8F2] bg-white overflow-hidden">
              <img src={Img5} alt="Creators using AI script generators in 2026" className="w-full h-full object-cover" />
            </div>
            <div>
              <h2 className="text-[32px] font-semibold text-[#110829] mb-6 leading-tight">
                Why the Best Creators Are Switching to AI Script Generation
              </h2>
              <div className="space-y-5">
                {[
                  { stat: "87%", label: "of top-performing TikToks in 2026 use a structured hook framework" },
                  { stat: "5x", label: "more content per week produced by creators using AI script tools vs manual writing" },
                  { stat: "60s", label: "average time to generate a complete script with hook variants and media prompts" },
                  { stat: "3–4x", label: "higher engagement rate for scripts built with platform-specific AI frameworks" },
                ].map((item) => (
                  <div key={item.stat} className="flex items-center gap-5">
                    <div className="text-[#7A3BFF] font-extrabold text-[32px] w-20 shrink-0 leading-none">{item.stat}</div>
                    <p className="text-[#4A4A55] text-[15px] leading-snug">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Try it CTA */}
        <section className="mb-32">
          <div className="rounded-3xl p-10 md:p-14 text-center"
            style={{ background: "linear-gradient(135deg, #0E0821 0%, #1A0840 50%, #0E0821 100%)" }}>
            <span className="inline-block bg-[#7A3BFF]/20 text-[#C084FC] text-[12px] font-bold px-4 py-1.5 rounded-full uppercase tracking-wider mb-5">
              Free to Start
            </span>
            <h2 className="text-white text-[32px] md:text-[38px] font-bold mb-4 leading-tight">
              The AI Script Generator Built for Viral Content
            </h2>
            <p className="text-white/50 text-[16px] mb-8 max-w-xl mx-auto leading-relaxed">
              7 style presets. Platform-specific pacing. Image and video prompts for every scene.
              Hook variants. Copy-ready output. All in under 60 seconds.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/workspace/viral-script"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-white text-[15px] transition-all hover:opacity-90 active:scale-[0.98]"
                style={{ background: "linear-gradient(135deg, #7A3BFF, #9D6BFF)", boxShadow: "0 8px 32px rgba(122,59,255,0.4)" }}
              >
                ✍️ Try Script Builder Free →
              </Link>
              <Link
                to="/blog/how-to-write-a-viral-script"
                className="text-white/40 text-[14px] hover:text-white/70 transition-colors"
              >
                Read: How to Write a Viral Script →
              </Link>
            </div>
            <p className="text-white/20 text-[12px] mt-5">No card required · First script in 60 seconds</p>
          </div>
        </section>

        {/* Closing */}
        <section className="mb-32 grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-[32px] font-semibold text-[#110829] mb-6 leading-tight">
              The Bottom Line on AI Script Generators in 2026
            </h2>
            <p className="text-[#4A4A55] text-[16px] leading-relaxed mb-5">
              AI script generators are no longer a novelty — they're a competitive necessity. The creators
              who are dominating short-form in 2026 are using these tools to maintain posting consistency,
              apply proven viral frameworks, and produce content that the algorithm actually distributes.
            </p>
            <p className="text-[#4A4A55] text-[16px] leading-relaxed mb-5">
              The gap between creators who use AI and those who don't is widening every month. Not because
              AI writes better than humans — but because it's consistent, fast, and structurally optimised
              in ways that are hard to replicate manually at scale.
            </p>
            <p className="text-[#4A4A55] text-[16px] leading-relaxed">
              If you're serious about growing in 2026, start with the script. Everything else — visuals,
              editing, distribution — comes after you've nailed the framework that makes people stop
              scrolling. Use{" "}
              <Link to="/workspace/viral-script" className="text-[#7A3BFF] font-semibold hover:underline">
                Zyvo's Viral Script Builder
              </Link>{" "}
              to build that framework in seconds, not hours.
            </p>
          </div>
          <div className="w-full h-[360px] rounded-2xl border border-[#ECE8F2] bg-white overflow-hidden">
            <img src={Img6} alt="AI script generator results and viral content creation" className="w-full h-full object-cover" />
          </div>
        </section>

        <RelatedArticles articles={related} />
      </div>
      <Footer />
    </div>
  );
}
