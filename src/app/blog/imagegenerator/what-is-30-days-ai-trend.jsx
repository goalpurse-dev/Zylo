import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import Footer from "../../../components/workspace/footer.jsx";
import RelatedArticles from "../RelatedArticles";

const related = [
  {
    title: "50 30 Days Universe Ideas: What World Should You Spend 30 Days In?",
    description: "Fifty fictional universes to try, grouped by mood.",
    date: "24.08.2026",
    slug: "/blog/30-days-universe-ideas",
  },
  {
    title: "How to Turn One 30 Days Story Into a Series",
    description: "A simple structure for turning one 30-day story into an ongoing world you keep returning to.",
    date: "24.08.2026",
    slug: "/blog/30-days-video-series",
  },
  {
    title: "How to Write a Viral 30 Days Premise (Formula + Examples)",
    description: "A four-part formula for a stronger premise, with weak-vs-strong examples.",
    date: "25.08.2026",
    slug: "/blog/30-days-premise-formula",
  },
];

const STEPS = [
  { n: "01", title: "Name any universe", desc: "LEGO Ninjago, Pokémon, Hogwarts, Naruto, One Piece, Minecraft — or type in any fictional world you want to spend 30 days inside." },
  { n: "02", title: "Set the premise", desc: "Write your own, or let AI write a viral-shaped one. You're always the protagonist, even when the premise is a world-level crisis." },
  { n: "03", title: "Zyvo locks a consistent world", desc: "Before any scene is generated, Zyvo builds 4 to 6 reference images — the key locations and canon characters — so every scene stays visually consistent." },
  { n: "04", title: "Eight scenes across four milestone days", desc: "Zyvo generates 8 scene images — two for each of Day 1, 10, 20, and 30 — and animates each into a 5-second clip, with you compositionally central and named characters interacting with you rather than replacing you." },
  { n: "05", title: "AI narrates the real footage", desc: "Once the clips are done, Zyvo watches them and writes one continuous hook and narration story from what actually happens on screen — not a generic script written blind." },
  { n: "06", title: "Pick a voice, export", desc: "Choose from 12 voice options and export one stitched, narrated vertical video — about 40 seconds total." },
];

export default function WhatIs30DaysAiTrend() {
  return (
    <div className="min-h-screen bg-[#080A0E] text-white">
      <div className="mx-auto max-w-4xl px-6 py-24">

        <nav className="mb-8 text-[13px] text-white/40">
          <Link to="/blog" className="hover:text-violet-300">Blog</Link>
          <span className="mx-2">/</span>
          <span className="text-white/60">30 Days</span>
        </nav>

        <header className="mb-14">
          <span className="inline-flex items-center rounded-full border border-violet-300/20 bg-violet-300/[0.07] px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-violet-200 mb-6">
            Explained
          </span>
          <h1 className="text-[38px] sm:text-[46px] font-black leading-[1.05] tracking-[-0.02em] mb-6">
            What Is the 30 Days AI Video Trend? Enter Any Fictional World for a Month
          </h1>
          <p className="text-[18px] text-white/58 leading-relaxed">
            Name a universe, describe a premise, and watch an eight-scene story unfold across four milestone days, with you as the protagonist — narrated by AI that actually watched your finished footage.
          </p>
          <p className="text-[13px] text-white/35 mt-5">Aug 24, 2026 · 6 min read · Explained</p>
        </header>

        <div className="mb-16 grid gap-4 sm:grid-cols-2">
          <figure className="overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
            <img
              src="/community-posters/lg-1.jpg"
              alt="A real 30 Days generation showing you standing beside LEGO Ninjago characters in a neon city street at night"
              width={640}
              height={800}
              className="aspect-[4/5] w-full rounded-[18px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
          <figure className="overflow-hidden rounded-[24px] border border-white/10 bg-[#111318] p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
            <img
              src="/community-posters/lg-2.jpg"
              alt="A real 30 Days generation showing a dramatic LEGO Ninjago battle scene with glowing energy effects"
              width={640}
              height={800}
              className="aspect-[4/5] w-full rounded-[18px] object-cover"
              loading="eager"
              fetchPriority="high"
            />
          </figure>
        </div>

        <div className="max-w-3xl space-y-4 text-white/68">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
              <div className="mb-2 flex items-center gap-3">
                <span className="text-[22px] font-black text-white/15 leading-none">{s.n}</span>
                <h2 className="text-[17px] font-bold text-white m-0">{s.title}</h2>
              </div>
              <p className="text-[14px] leading-relaxed text-white/55">{s.desc}</p>
            </div>
          ))}

          <section className="pt-8">
            <h2 className="text-[26px] font-black text-white mb-4 tracking-[-0.01em]">Why it's different from a one-off image trend</h2>
            <p className="text-[16px] leading-relaxed mb-6">
              Most AI image trends produce a single striking still. 30 Days produces a real eight-beat story across four milestone days with a locked visual world and a narration written from your actual footage — closer to a short film than a filter. See{" "}
              <Link to="/blog/30-days-universe-ideas" className="text-violet-300 hover:underline font-semibold">fifty universe ideas</Link>{" "}
              to find your first world.
            </p>
            <Link
              to="/30-days-video-maker"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-300 to-fuchsia-300 px-7 py-3.5 text-[14px] font-black text-[#160b20] transition hover:brightness-110"
            >
              Explore 30 Days
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </section>
        </div>

        <div className="mt-20 -mx-6 rounded-[24px] bg-[#F7F5FA] py-10 sm:mx-0">
          <RelatedArticles articles={related} />
        </div>
      </div>
      <Footer />
    </div>
  );
}
