import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "8 AI Fruit Story Fan Theories That Are Probably True",
    description: "Playful lore theories connecting the recurring cast into one shared universe.",
    date: "17.08.2026",
    slug: "/blog/ai-fruit-story-fan-theories",
  },
  {
    title: "The Most Iconic AI Fruit Story Lines Ever Written (Ranked)",
    description: "Eight lines the format lives and dies on, and the structural reason each one works.",
    date: "17.08.2026",
    slug: "/blog/ai-fruit-story-best-lines",
  },
  {
    title: "Which AI Fruit Story Character Are You? Take the Quiz",
    description: "Five questions, one very specific fruit personality waiting on the other side.",
    date: "17.08.2026",
    slug: "/blog/ai-fruit-story-quiz",
  },
];

const THREADS = [
  {
    title: "the aftermath",
    subtitle: "Orange Mom, Banana Dad, Ananas Girl",
    messages: [
      { from: "Orange Mom", text: "did everyone see what just happened at the wedding", side: "left" },
      { from: "Banana Dad", text: "see it? I'm still holding the papers", side: "right" },
      { from: "Ananas Girl", text: "I tried to warn you three episodes ago", side: "left" },
      { from: "Orange Mom", text: "THREE EPISODES AGO", side: "left" },
      { from: "Banana Dad", text: "wait she called it??", side: "right" },
    ],
  },
  {
    title: "villain support group",
    subtitle: "Gangster Pineapple, Avocado",
    messages: [
      { from: "Gangster Pineapple", text: "everyone thinks I sabotaged the food cart", side: "left" },
      { from: "Avocado", text: "did you", side: "right" },
      { from: "Gangster Pineapple", text: "I was buying her unsold stock every night", side: "left" },
      { from: "Avocado", text: "that's not sabotage that's the opposite of sabotage", side: "right" },
      { from: "Gangster Pineapple", text: "yeah nobody's going to believe that until episode 9", side: "left" },
    ],
  },
  {
    title: "reunion planning committee",
    subtitle: "Cherry, Blueberry, Hot Peach",
    messages: [
      { from: "Cherry", text: "so are we telling everyone there are two grandmas or", side: "left" },
      { from: "Blueberry", text: "absolutely not, let them find out live", side: "right" },
      { from: "Hot Peach", text: "I just got here what's happening", side: "left" },
      { from: "Cherry", text: "there might be two grandmas", side: "left" },
      { from: "Hot Peach", text: "I came back from nothing for THIS", side: "left" },
    ],
  },
];

export default function AIFruitStoryGroupChat() {
  return (
    <div className="w-full bg-[#F7F5FA]">
      <div className="mx-auto max-w-6xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-[#888]">
          <Link to="/blog" className="hover:text-[#7A3BFF]">Blog</Link>
          <span className="mx-2">/</span>
          <Link to="/blog" className="hover:text-[#7A3BFF]">Go Viral</Link>
          <span className="mx-2">/</span>
          <span>AI Fruit Story Group Chat</span>
        </nav>

        <header className="mb-16 max-w-4xl">
          <span className="inline-block bg-purple-100 text-purple-700 text-[12px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-5">
            Highly Entertaining
          </span>
          <h1 className="text-[42px] font-bold text-[#110829] leading-tight mb-6">
            If AI Fruit Story Characters Had a Group Chat
          </h1>
          <p className="text-[19px] text-[#4A4A55] leading-relaxed">
            What the cast is definitely saying to each other in between episodes. Completely unofficial. Extremely accurate.
          </p>
          <p className="text-[13px] text-[#999] mt-5">Aug 17, 2026 · 5 min read · Highly Entertaining</p>
        </header>

        <figure className="mb-16 max-w-4xl overflow-hidden rounded-[28px] border border-[#241b38] bg-[#090a0d] p-1.5 shadow-[0_24px_70px_rgba(35,20,72,.16)] sm:p-2">
          <img
            src="/blog-assets/ai-fruit-story-group-chat-hero.png"
            alt="Three stylized 3D cartoon fruit characters huddled together looking down at glowing phone screens with mischievous expressions"
            width={1024}
            height={576}
            className="aspect-[16/9] w-full rounded-[22px] object-cover"
            loading="eager"
            fetchPriority="high"
          />
        </figure>

        <div className="max-w-3xl space-y-14">

          <p className="text-[17px] leading-relaxed text-[#374151]">
            Every fruit-drama season has an off-screen life the audience never sees — the group chat where the cast processes what just happened to them. Here's what three of those threads would probably look like.
          </p>

          {THREADS.map((thread) => (
            <section key={thread.title}>
              <div className="mb-4">
                <h2 className="text-[20px] font-bold text-[#110829]">{thread.title}</h2>
                <p className="text-[13px] text-[#9ca3af]">{thread.subtitle}</p>
              </div>
              <div className="space-y-2.5 rounded-2xl border border-[#E5E0F5] bg-white p-6 shadow-sm">
                {thread.messages.map((m, i) => (
                  <div key={i} className={`flex ${m.side === "right" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] ${m.side === "right" ? "items-end" : "items-start"} flex flex-col`}>
                      <span className="mb-0.5 px-1 text-[10px] font-bold text-[#9ca3af]">{m.from}</span>
                      <div
                        className={`rounded-2xl px-4 py-2.5 text-[14px] leading-snug ${
                          m.side === "right"
                            ? "rounded-tr-sm bg-gradient-to-r from-[#7A3BFF] to-[#A855F7] text-white"
                            : "rounded-tl-sm bg-[#F1EEF9] text-[#110829]"
                        }`}
                      >
                        {m.text}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}

          <section>
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Why this works as a bonus format</h2>
            <p className="text-[17px] leading-relaxed text-[#374151]">
              The group chat gag is a good companion piece to a real episode — post it the day after a big reveal drops, in-character, referencing what just happened on screen. It costs nothing to make (it's just text), and it keeps the storyline alive in the feed on days you're not posting a new generated scene.
            </p>
          </section>

          <section className="pt-4">
            <h2 className="text-[26px] font-bold text-[#110829] mb-4">Give Your Cast Something to Text About</h2>
            <p className="text-[16px] leading-relaxed mb-6 text-[#374151]">
              Write the episode first, then let the group chat write itself as the reaction. Generate the actual scene in{" "}
              <Link to="/ai-fruit-story-maker" className="text-[#7A3BFF] hover:underline font-semibold">Zyvo's AI Fruit Story maker</Link>.
            </p>
            <Link
              to="/ai-fruit-story-maker"
              className="inline-block bg-gradient-to-r from-[#7A3BFF] to-[#A855F7] text-white font-bold text-[15px] px-8 py-4 rounded-[14px] hover:opacity-90 transition"
            >
              Open the AI Fruit Story Tool →
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
