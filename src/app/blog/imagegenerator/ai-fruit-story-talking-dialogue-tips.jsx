import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "AI Fruit Story Maker: Create Viral Fruit Drama Videos in 2026",
    description: "How Zyvo's AI Fruit Story maker turns a prompt into a multi-scene vertical video workflow.",
    date: "14.05.2026",
    slug: "/ai-fruit-story-maker",
  },
  {
    title: "AI Fruit Drama Videos: Story Structure and Workflow",
    description: "Inside the AI fruit drama format — what makes it work and why it dominates TikTok.",
    date: "14.05.2026",
    slug: "/blog/viral-ai-fruit-drama-videos",
  },
  {
    title: "50 AI Fruit Story Prompts and Viral Drama Ideas",
    description: "Fifty fruit-drama prompts with adaptable ideas and an explanation of why each works.",
    date: "15.05.2026",
    slug: "/blog/best-ai-fruit-story-ideas",
  },
];

const TECHNIQUES = [
  {
    title: "Write lines a viewer could quote back",
    example: '"I unlocked your phone. I didn\'t even have to look far."',
    why: "Short, quotable lines get typed into comment sections. If a line survives being copy-pasted as a caption, it's doing its job.",
  },
  {
    title: "Let the reaction interrupt the line",
    example: '"I can explain—" "You don\'t need to. I already know."',
    why: "Cutting a character off mid-sentence reads as confidence and creates a sharp emotional beat without needing extra scenes.",
  },
  {
    title: "Give the accused a real defense, not a confession",
    example: '"It\'s not what it looks like." "It never is."',
    why: "A weak, deniable excuse keeps tension alive longer than an instant confession — and gives the other character a stronger comeback line.",
  },
  {
    title: "End the scene on a question, not an answer",
    example: '"So who is she?"',
    why: "A closing question functions like a mini cliffhanger inside the video itself, not just at the very end — it pulls viewers into the next scene.",
  },
  {
    title: "Match line length to the character's status",
    example: "Powerful characters get short lines. Nervous characters get run-on lines.",
    why: "Dialogue rhythm communicates power dynamics before the viewer consciously registers who's in control of the scene.",
  },
];

export default function AIFruitStoryTalkingDialogueTips() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <Link to="/blog" className="hover:text-[#7A3BFF]">Go Viral</Link>
          <span className="mx-2">/</span>
          <span>Talking Character Dialogue</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Feature Guide
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            How to Write Talking, Lip-Synced Dialogue for AI Fruit Story Videos
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            Every AI Fruit Story scene can speak — mouth-synced, in English, with lines Zyvo writes from your premise. Here's how the dialogue feature actually works, and five techniques for writing lines that make viewers stop scrolling.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 8, 2026 · 8 min read · Feature Guide</p>
        </header>

        <figure className="mb-16 max-w-4xl overflow-hidden rounded-[28px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)] sm:p-2">
          <img
            src="/blog-assets/ai-fruit-story-dialogue-hero.png"
            alt="A stylized 3D cartoon fruit character mid-speech with a speech bubble and sound wave icons"
            width={1024}
            height={576}
            className="aspect-[16/9] w-full rounded-[22px] object-cover"
            loading="eager"
            fetchPriority="high"
          />
        </figure>

        {/* Characters showcase */}
        <div className="mb-16 flex flex-wrap justify-center gap-3">
          {[
            { src: "/viral-builder/ai-fruit/characters/orangemom.png",        name: "Orange Mom" },
            { src: "/viral-builder/ai-fruit/characters/bossmango.png",        name: "Boss Mango" },
            { src: "/viral-builder/ai-fruit/characters/hotpeach.webp",        name: "Hot Peach" },
            { src: "/viral-builder/ai-fruit/characters/gangsterpineapple.png",name: "Gangster Pineapple" },
            { src: "/viral-builder/ai-fruit/characters/strawberrymom.png",    name: "Strawberry Mom" },
            { src: "/viral-builder/ai-fruit/characters/banana.png",           name: "Banana" },
          ].map((c, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <div className="h-[68px] w-[54px] overflow-hidden rounded-[14px] border border-[#ECE8F2] bg-white shadow-sm">
                <img src={c.src} alt={`${c.name} AI fruit story character`} className="h-full w-full object-cover object-top" loading="lazy" />
              </div>
              <span className="text-[10px] text-[#9ca3af]">{c.name}</span>
            </div>
          ))}
        </div>

        <div className="prose-custom max-w-3xl space-y-10 text-[#374151]">

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">Why Dialogue Is the Emotional Engine of the Format</h2>
            <p className="text-[17px] leading-relaxed mb-4">
              A fruit drama video has no real actors, no facial micro-expressions, no vocal performance beyond what the AI generates. That means dialogue carries more of the emotional weight than it would in a live-action video — the line itself has to do the work a raised eyebrow or a trembling voice would normally do.
            </p>
            <p className="text-[17px] leading-relaxed">
              That's also why it's the single highest-leverage part of your prompt. Two videos with identical characters, identical settings, and identical scene count can perform completely differently based on whether the dialogue lands.
            </p>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">How Talking Characters Work in Zyvo</h2>
            <p className="text-[17px] leading-relaxed mb-4">
              You don't write full scripts line by line. You describe the premise and the characters; Zyvo's story planner writes the scene-by-scene dialogue and animates each character with mouth-synced English speech.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { title: "You provide the premise", desc: "One sentence describing the conflict, reveal, or twist is enough for the planner to work from." },
                { title: "Zyvo writes the lines", desc: "Dialogue is generated per scene, matched to the drama style and characters you selected." },
                { title: "Scenes are animated", desc: "Selected scenes are rendered with mouth-synced character animation once you hit Animate." },
                { title: "You review before download", desc: "You can review the generated dialogue and scenes and regenerate before finalizing the video." },
              ].map((item) => (
                <div key={item.title} className="rounded-xl border border-[#ECE8F2] bg-white p-5">
                  <div className="text-[13px] font-bold text-[#110829] mb-2">{item.title}</div>
                  <p className="text-[13px] text-[#6b7280] leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-5">5 Dialogue Techniques That Make Fruit Drama Hit Harder</h2>
            <p className="text-[17px] leading-relaxed mb-6">
              Your premise shapes the dialogue Zyvo generates. Steering the premise toward these patterns tends to produce stronger, more shareable lines.
            </p>
            <div className="space-y-4">
              {TECHNIQUES.map((t, i) => (
                <div key={t.title} className="rounded-xl border border-purple-200 bg-purple-50 p-5">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-[#9ca3af] mb-2">{i + 1}. {t.title}</div>
                  <p className="text-[15px] font-semibold text-[#110829] leading-relaxed italic mb-2">{t.example}</p>
                  <p className="text-[13px] text-[#6b7280] leading-relaxed">{t.why}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">Common Dialogue Mistakes to Avoid</h2>
            <div className="space-y-4">
              {[
                { title: "Explaining instead of confronting", desc: "Lines that narrate the backstory (\"I found out you've been lying for weeks\") read slower than lines that confront directly (\"Three weeks. That's how long you've been lying.\"). Favor confrontation over exposition in your premise." },
                { title: "Too many characters talking in one scene", desc: "Dialogue lands hardest with two characters per exchange. A crowded scene dilutes the emotional focus — keep side characters reacting rather than speaking in the same beat." },
                { title: "Resolving everything in the final line", desc: "A tidy, fully-resolved final line closes the door on a Part 2. Leaving one open thread keeps the account's audience coming back." },
              ].map((item) => (
                <div key={item.title} className="rounded-xl border border-[#ECE8F2] bg-white p-5">
                  <div className="text-[14px] font-bold text-[#110829] mb-2">{item.title}</div>
                  <p className="text-[13px] text-[#6b7280] leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-[28px] font-bold text-[#110829] mb-4">Generate Talking Characters in Minutes</h2>
            <p className="text-[17px] leading-relaxed mb-6">
              Describe your premise in <Link to="/ai-fruit-story-maker" className="text-[#7A3BFF] hover:underline font-semibold">Zyvo's AI Fruit Story maker</Link>, choose your characters, and generate a scene set with mouth-synced dialogue already written for you.
            </p>
            <Link
              to="/ai-fruit-story-maker"
              className="inline-block bg-gradient-to-r from-[#7A3BFF] to-[#A855F7] text-white font-bold text-[15px] px-8 py-4 rounded-[14px] hover:opacity-90 transition"
            >
              Open the Paid AI Fruit Story Tool →
            </Link>
          </section>

        </div>

        <div className="mt-20">
          <RelatedArticles articles={related} />
        </div>
      </div>
      <Footer />
    </div>
  );
}
