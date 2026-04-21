import { Link } from "react-router-dom";
import { useEffect } from "react";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";
import Img1 from "../../../assets/inspiration/1.png";
import Img2 from "../../../assets/inspiration/4.png";
import Img3 from "../../../assets/inspiration/7.png";
import Img4 from "../../../assets/inspiration/11.png";
import Img5 from "../../../assets/inspiration/14.png";
import Img6 from "../../../assets/inspiration/18.png";

const related = [
  {
    title: "AI Script Generator: Write Viral TikTok & YouTube Scripts in 60 Seconds",
    description: "How AI script generators are replacing hours of writing with one click.",
    date: "21.04.2026",
    slug: "/blog/ai-script-generator-viral-videos",
  },
  {
    title: "How to Go Viral With AI in 2026: The Complete Strategy",
    description: "The exact playbook creators are using to dominate TikTok, Instagram, and YouTube.",
    date: "16.04.2026",
    slug: "/blog/how-to-go-viral-with-ai",
  },
  {
    title: "These AI Images Are Going Viral on TikTok",
    description: "The visual styles dominating TikTok feeds right now.",
    date: "01.02.2026",
    slug: "/blog/viral-ai-images-tiktok",
  },
];

export default function HowToWriteAViralScript() {
  useEffect(() => {
    document.title = "How to Write a Viral Script in 2026: The AI Framework That Gets Millions of Views | Zyvo";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute(
        "content",
        "Learn exactly how to write a viral script for TikTok, YouTube Shorts, and Instagram Reels. The proven AI-powered framework used by creators getting millions of views — with a free script builder included."
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
          <span>How to Write a Viral Script</span>
        </nav>

        {/* Header */}
        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Go Viral
          </span>
          <h1 className="text-[44px] font-bold text-[#110829] leading-tight mb-6">
            How to Write a Viral Script in 2026: The AI Framework That Gets Millions of Views
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            Most creators spend hours writing scripts that get 200 views. The ones hitting a million
            views aren't smarter or more talented — they use a different framework. Here's the exact
            structure behind every viral video in 2026, and how AI makes it repeatable in 60 seconds.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Apr 21, 2026 · 9 min read · Content Strategy</p>
        </header>

        {/* Hero image */}
        <div className="mb-24 w-full h-[420px] rounded-2xl overflow-hidden border border-[#ECE8F2]">
          <img src={Img1} alt="Viral script writing framework for TikTok and YouTube" className="w-full h-full object-cover" />
        </div>

        {/* Intro */}
        <section className="mb-20 max-w-3xl">
          <p className="text-[17px] text-[#4A4A55] mb-5 leading-relaxed">
            Writing a viral script isn't a creative lottery. It's an engineering problem. Every video that
            breaks through to millions of views has the same structural DNA — a hook that stops the scroll,
            a body that builds tension, and a CTA that feels earned. The difference between 200 views and
            2 million views is almost always the script.
          </p>
          <p className="text-[17px] text-[#4A4A55] mb-5 leading-relaxed">
            In 2026, the fastest-growing creators aren't writing scripts from scratch. They're using AI
            to generate platform-optimised, psychologically engineered scripts in under a minute — then
            spending their time on visuals and distribution instead.
          </p>
          <p className="text-[17px] text-[#4A4A55] leading-relaxed">
            This guide breaks down the exact anatomy of a viral script, the most common mistakes that kill
            reach, and how tools like{" "}
            <Link to="/workspace/viral-script" className="text-[#7A3BFF] font-semibold hover:underline">
              Zyvo's Viral Script Builder
            </Link>{" "}
            make the entire process instant for any platform or niche.
          </p>
        </section>

        {/* Section 1 */}
        <section className="mb-32 grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div className="w-full h-[360px] rounded-2xl border border-[#ECE8F2] bg-white overflow-hidden">
            <img src={Img2} alt="The anatomy of a viral video script" className="w-full h-full object-cover" />
          </div>
          <div>
            <span className="text-[#7A3BFF] text-[13px] font-bold uppercase tracking-widest mb-4 block">Part 1</span>
            <h2 className="text-[32px] font-semibold text-[#110829] mb-6 leading-tight">
              The Anatomy of a Viral Script
            </h2>
            <p className="text-[#4A4A55] text-[16px] leading-relaxed mb-5">
              Every viral video — regardless of platform, niche, or creator — follows the same three-part
              structure: Hook (0–3 seconds), Body (scenes that build tension or value), and CTA. Mess up
              any one of these and the algorithm won't push it.
            </p>
            <p className="text-[#4A4A55] text-[16px] leading-relaxed mb-5">
              The hook is where 80% of scripts fail. If you don't stop the scroll in the first two words —
              not the first sentence, the first <em>two words</em> — viewers are gone. The algorithm sees
              this as a rejection signal and stops distributing your content.
            </p>
            <p className="text-[#4A4A55] text-[16px] leading-relaxed">
              The body needs to keep delivering on whatever promise the hook made. Every scene should either
              raise a new question, reveal new information, or escalate tension. The moment a viewer feels
              they've got everything they came for, they leave.
            </p>
          </div>
        </section>

        {/* Section 2 */}
        <section className="mb-32">
          <h2 className="text-[34px] font-semibold text-[#110829] mb-8 max-w-3xl leading-tight">
            The 5 Hook Types That Consistently Go Viral
          </h2>
          <p className="text-[#4A4A55] text-[16px] leading-relaxed mb-10 max-w-3xl">
            The hook is the highest-leverage part of any script. Spend 80% of your writing time here.
            These are the five hook structures that drive the most watch-time retention across TikTok,
            Instagram Reels, and YouTube Shorts in 2026:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            {[
              {
                num: "01",
                title: "The Curiosity Gap",
                desc: `"The one thing no one tells you about..." — Creates an open loop the brain physically needs to close. Works on every platform. The most shared hook format on TikTok.`,
              },
              {
                num: "02",
                title: "The Counterintuitive Statement",
                desc: `"Stop doing X" or "X is actually killing your..." — Violates an assumption the viewer holds. The brain treats it as high-priority information and pauses scrolling automatically.`,
              },
              {
                num: "03",
                title: "The Specific Number",
                desc: `"I made $47,231 in 30 days doing this" — Specificity signals truth. Vague claims like "I made a lot of money" are ignored. Specific numbers create credibility and curiosity simultaneously.`,
              },
              {
                num: "04",
                title: "The Direct Call-Out",
                desc: `"If you're a [specific person], stop scrolling" — People self-identify with categories. A direct call-out feels personal. Engagement rates on call-out hooks are typically 3–4x higher.`,
              },
              {
                num: "05",
                title: "The Shocking Visual or Claim",
                desc: `Something that makes the viewer say "wait, what?" — Can be visual (used with image/video prompts) or textual. Creates a pattern interrupt that resets attention from whatever came before.`,
              },
              {
                num: "06",
                title: "The Before/After Promise",
                desc: `"In 60 seconds, you'll know exactly how to..." — Sets up a psychological contract. Once started, viewers feel compelled to finish because their brain treats incomplete contracts as unresolved tasks.`,
              },
            ].map((item) => (
              <div key={item.num} className="bg-white rounded-2xl border border-[#ECE8F2] p-6">
                <div className="text-[#7A3BFF] font-bold text-[13px] mb-2">{item.num}</div>
                <h3 className="text-[#110829] font-semibold text-[18px] mb-3">{item.title}</h3>
                <p className="text-[#4A4A55] text-[14px] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3 */}
        <section className="mb-32 grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div>
            <span className="text-[#7A3BFF] text-[13px] font-bold uppercase tracking-widest mb-4 block">Part 2</span>
            <h2 className="text-[32px] font-semibold text-[#110829] mb-6 leading-tight">
              Scene Structure: How to Keep Viewers Watching Until the End
            </h2>
            <p className="text-[#4A4A55] text-[16px] leading-relaxed mb-5">
              Each scene in your script has one job: make the viewer need to see the next scene.
              The most effective way to do this is the open loop — raise a question, then don't answer
              it until the following scene. This creates a chain of micro-commitments that the viewer
              doesn't consciously notice but can't resist.
            </p>
            <p className="text-[#4A4A55] text-[16px] leading-relaxed mb-5">
              For short-form content (15–60 seconds), aim for 3–5 scenes. Each scene should be 2–4
              sentences max. No filler. No "So as I was saying..." Every word that doesn't add value
              is a word that adds a watch-time drop.
            </p>
            <p className="text-[#4A4A55] text-[16px] leading-relaxed">
              For long-form content (5–20 minutes), the principle is the same but the scenes are longer.
              The AI Script Builder on Zyvo calculates per-scene duration based on your total video
              length — so the pacing is automatically optimised for the format you're targeting.
            </p>
          </div>
          <div className="w-full h-[360px] rounded-2xl border border-[#ECE8F2] bg-white overflow-hidden">
            <img src={Img3} alt="Scene structure for viral video scripts" className="w-full h-full object-cover" />
          </div>
        </section>

        {/* Section 4 - CTA writing */}
        <section className="mb-32">
          <h2 className="text-[34px] font-semibold text-[#110829] mb-8 max-w-3xl leading-tight">
            Writing CTAs That Actually Convert
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
            <div>
              <p className="text-[#4A4A55] text-[16px] leading-relaxed mb-6">
                The CTA is the most neglected part of most scripts. Creators either skip it entirely
                or tack on a generic "follow me for more!" that nobody acts on. A great CTA isn't a
                demand — it's the natural conclusion of what just happened in the video.
              </p>
              <p className="text-[#4A4A55] text-[16px] leading-relaxed mb-6">
                Platform-native CTAs dramatically outperform generic ones. On TikTok, "comment your
                answer below" drives 4–6x more engagement than "follow for more." On YouTube Shorts,
                "watch the full breakdown (link in bio)" gets far more clicks than "subscribe."
              </p>
              <p className="text-[#4A4A55] text-[16px] leading-relaxed">
                When using Zyvo's script builder, the AI automatically selects the highest-converting
                CTA for your specific platform and audience — or you can write your own and have the
                AI integrate it seamlessly into the flow of the script.
              </p>
            </div>
            <div className="space-y-4">
              {[
                { platform: "TikTok", cta: "Comment [X] if this happened to you", why: "Comment-driven engagement signals tell the algorithm this post has community value." },
                { platform: "Instagram Reels", cta: "Save this before you forget it", why: "Saves are the most powerful ranking signal on Instagram in 2026." },
                { platform: "YouTube Shorts", cta: "Watch my full [X] breakdown", why: "Cross-links to long-form content — drives subscribers and session time." },
                { platform: "LinkedIn", cta: "Repost this if your team needs to see it", why: "Reposts extend organic reach further than any paid promotion on LinkedIn." },
              ].map((item) => (
                <div key={item.platform} className="bg-white rounded-xl border border-[#ECE8F2] px-5 py-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[11px] font-bold text-[#7A3BFF] uppercase tracking-wider">{item.platform}</span>
                  </div>
                  <p className="text-[#110829] font-medium text-[14px] mb-1">"{item.cta}"</p>
                  <p className="text-[#888] text-[13px]">{item.why}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 5 - Platform differences */}
        <section className="mb-32 grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div className="w-full h-[360px] rounded-2xl border border-[#ECE8F2] bg-white overflow-hidden">
            <img src={Img4} alt="Platform differences in viral script writing" className="w-full h-full object-cover" />
          </div>
          <div>
            <span className="text-[#7A3BFF] text-[13px] font-bold uppercase tracking-widest mb-4 block">Part 3</span>
            <h2 className="text-[32px] font-semibold text-[#110829] mb-6 leading-tight">
              Scripts Are Platform-Specific — Most Creators Get This Wrong
            </h2>
            <p className="text-[#4A4A55] text-[16px] leading-relaxed mb-5">
              The single biggest mistake creators make when writing viral scripts is reusing the same
              script across platforms. A TikTok script and a YouTube Shorts script are fundamentally
              different documents — even for identical content.
            </p>
            <p className="text-[#4A4A55] text-[16px] leading-relaxed mb-5">
              TikTok rewards pattern interrupts every 8–12 seconds. YouTube Shorts rewards a clear
              value promise in the first 3 seconds. Instagram Reels rewards aspirational visuals and
              save-worthy information. LinkedIn rewards authority and specificity. Each algorithm reads
              different signals from viewer behaviour.
            </p>
            <p className="text-[#4A4A55] text-[16px] leading-relaxed">
              Zyvo's script builder has platform-specific modes for TikTok, YouTube (short and long form),
              Instagram Reels, and more — each generating scripts tuned to the native language and pacing
              of that specific platform.
            </p>
          </div>
        </section>

        {/* Section 6 - AI Script Writing */}
        <section className="mb-32">
          <h2 className="text-[34px] font-semibold text-[#110829] mb-8 max-w-3xl leading-tight">
            How AI Changes the Script Writing Game in 2026
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-start">
            <div>
              <p className="text-[#4A4A55] text-[16px] leading-relaxed mb-6">
                The traditional script writing process — brainstorm, outline, draft, revise, test — takes
                hours per video. For creators posting daily or multiple times a week, this bottleneck kills
                consistency, and consistency is what the algorithm rewards above everything else.
              </p>
              <p className="text-[#4A4A55] text-[16px] leading-relaxed mb-6">
                AI script generators remove that bottleneck entirely. Input your idea, choose your platform
                and duration, and get a complete, structurally optimised script — including hook variations,
                per-scene breakdowns, and a platform-native CTA — in under 60 seconds.
              </p>
              <p className="text-[#4A4A55] text-[16px] leading-relaxed">
                The best AI script tools also generate image and video prompts for each scene, so you can
                go from script to fully produced content without leaving a single platform. That's the
                workflow top creators are using to post 5–7 times per week without burning out.
              </p>
            </div>
            <div className="w-full h-[340px] rounded-2xl border border-[#ECE8F2] bg-white overflow-hidden">
              <img src={Img5} alt="AI script generator for viral video creation" className="w-full h-full object-cover" />
            </div>
          </div>
        </section>

        {/* Common mistakes */}
        <section className="mb-32">
          <h2 className="text-[34px] font-semibold text-[#110829] mb-8 max-w-3xl leading-tight">
            7 Script Writing Mistakes That Are Killing Your Reach
          </h2>
          <div className="space-y-4 max-w-4xl">
            {[
              { n: "1", title: "Starting with your name or channel intro", fix: "Nobody cares who you are until after you've given them a reason to care. Lead with the hook, earn the introduction later." },
              { n: "2", title: "Burying the hook in the second sentence", fix: "The hook must be the FIRST thing out of your mouth. Not after a greeting. Not after context-setting. The first words." },
              { n: "3", title: "Treating all platforms the same", fix: "Rewrite for each platform or use a platform-specific script generator. A TikTok script posted on LinkedIn will underperform by 80%+." },
              { n: "4", title: "Writing more than you can say in your target duration", fix: "Time your script out loud. At natural speaking pace, 150 words ≈ 60 seconds. Most scripts are 40% too long." },
              { n: "5", title: "Ending scenes with complete resolution", fix: "End every scene with an open loop — a question, a partial reveal, a raised stake. Give viewers a reason to stay." },
              { n: "6", title: "Using the same CTA every time", fix: "Rotate CTA types: comment, save, follow, watch more. The same CTA creates diminishing returns after 3–4 consecutive uses." },
              { n: "7", title: "Writing the CTA as an afterthought", fix: "Write the CTA first. Know what action you want, then build the script backwards from that goal." },
            ].map((item) => (
              <div key={item.n} className="bg-white rounded-2xl border border-[#ECE8F2] px-6 py-5 flex gap-5">
                <div className="text-[#7A3BFF] font-extrabold text-[22px] shrink-0 w-8">{item.n}</div>
                <div>
                  <p className="text-[#110829] font-semibold text-[15px] mb-1.5">{item.title}</p>
                  <p className="text-[#4A4A55] text-[14px] leading-relaxed">{item.fix}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Try it CTA */}
        <section className="mb-32">
          <div className="rounded-3xl p-10 md:p-14 text-center"
            style={{ background: "linear-gradient(135deg, #0E0821 0%, #1A0840 50%, #0E0821 100%)" }}>
            <span className="inline-block bg-[#7A3BFF]/20 text-[#C084FC] text-[12px] font-bold px-4 py-1.5 rounded-full uppercase tracking-wider mb-5">
              Try It Free
            </span>
            <h2 className="text-white text-[32px] md:text-[38px] font-bold mb-4 leading-tight">
              Write Your First Viral Script in 60 Seconds
            </h2>
            <p className="text-white/50 text-[16px] mb-8 max-w-xl mx-auto leading-relaxed">
              Pick a style preset, describe your idea, and get a complete script with hook variants,
              per-scene breakdowns, and image & video prompts — ready to shoot.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/workspace/viral-script"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-white text-[15px] transition-all hover:opacity-90 active:scale-[0.98]"
                style={{ background: "linear-gradient(135deg, #7A3BFF, #9D6BFF)", boxShadow: "0 8px 32px rgba(122,59,255,0.4)" }}
              >
                ✍️ Open Script Builder →
              </Link>
              <Link
                to="/blog/ai-script-generator-viral-videos"
                className="text-white/40 text-[14px] hover:text-white/70 transition-colors"
              >
                Read: AI Script Generator Guide →
              </Link>
            </div>
          </div>
        </section>

        {/* Final section */}
        <section className="mb-32 grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-[32px] font-semibold text-[#110829] mb-6 leading-tight">
              The Script Writing Workflow Top Creators Use in 2026
            </h2>
            <p className="text-[#4A4A55] text-[16px] leading-relaxed mb-5">
              The most prolific creators in 2026 don't have bigger teams or longer hours. They have a
              repeatable system. Input idea → generate script → review and edit → generate visuals →
              post. The entire process from idea to ready-to-film takes under 10 minutes.
            </p>
            <p className="text-[#4A4A55] text-[16px] leading-relaxed mb-5">
              The key insight is that AI handles the structural work — hook engineering, pacing, platform
              optimisation, CTA selection — while the creator handles the performance and distribution.
              This is how one person can realistically post high-quality content five times per week.
            </p>
            <p className="text-[#4A4A55] text-[16px] leading-relaxed">
              If you're still writing scripts from scratch, you're competing at a significant disadvantage.
              Use{" "}
              <Link to="/workspace/viral-script" className="text-[#7A3BFF] font-semibold hover:underline">
                Zyvo's Viral Script Builder
              </Link>{" "}
              to close the gap — it's free to try, and the first script takes less than a minute.
            </p>
          </div>
          <div className="w-full h-[360px] rounded-2xl border border-[#ECE8F2] bg-white overflow-hidden">
            <img src={Img6} alt="Viral script writing workflow in 2026" className="w-full h-full object-cover" />
          </div>
        </section>

        <RelatedArticles articles={related} />
      </div>
      <Footer />
    </div>
  );
}
