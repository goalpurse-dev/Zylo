import { useEffect, useState } from "react";

const TEMPLATES = [
  {
    id: "dogSkeletonXray",
    rank: "#1",
    title: "Dog Skeleton X-Ray",
    description: "Viral TikTok science animal style",
    img: "/thumbs/x-raydog.webp",
    uses: "18,423 generations this week",
  },
  {
    id: "viralSkeleton",
    rank: "#2",
    title: "Viral Skeleton",
    description: "Cinematic viral science character",
    img: "/images/thumbs/viralskeleton.webp",
    uses: "12,991 generations this week",
  },
];

export default function ViralTemplatesSection() {
  const [time, setTime] = useState({ d: 0, h: 0, m: 0 });

useEffect(() => {
  const update = () => {
    const now = new Date();
    const next = new Date();

    next.setDate(now.getDate() + (7 - now.getDay()));
    next.setHours(0, 0, 0, 0);

    const diff = next - now;

    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const m = Math.floor((diff / (1000 * 60)) % 60);
    const s = Math.floor((diff / 1000) % 60);

    setTime({ d, h, m, s });
  };

  update();

  const i = setInterval(update, 1000);

  return () => clearInterval(i);
}, []);

  return (
    <section className="mt-16">

      {/* HEADER */}
      <div className="text-center mb-8">

        <h2 className="text-2xl font-bold tracking-tight">
          🔥 This Week's Viral Templates
        </h2>

        <p className="text-white/60 text-sm mt-2">
          Updated weekly based on creator performance
        </p>

        {/* countdown blocks */}
        <div className="flex justify-center gap-3 mt-4">

          <TimerBlock value={time.d} label="Days" />
          <TimerBlock value={time.h} label="Hours" />
         <TimerBlock value={time.m} label="Min" />
<TimerBlock value={time.s} label="Sec" />

        </div>
      </div>

      {/* CARDS */}
      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">

        {TEMPLATES.map((t) => (
          <div
            key={t.id}
            className="group bg-[#111] rounded-xl border border-white/10 hover:border-purple-500/40 transition overflow-hidden"
          >

            {/* IMAGE */}
            <div className="relative w-full aspect-[16/9] bg-black overflow-hidden">

             <img
  src={t.img}
  alt={t.title}
  className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
/>

<div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>

              <div className="absolute top-3 left-3 bg-purple-600 text-xs px-2 py-1 rounded">
                {t.rank}
              </div>

            </div>

            {/* CONTENT */}
            <div className="p-4">

              <h3 className="font-semibold text-lg">
                {t.title}
              </h3>

              <p className="text-sm text-white/60">
                {t.description}
              </p>

              <p className="text-xs text-white/40 mt-1">
                {t.uses}
              </p>

           <button
  className="
  mt-3 w-full
  bg-gradient-to-r from-purple-500 to-fuchsia-500/30
  backdrop-blur-md
  border border-purple-400/30
  text-white
  font-semibold
  py-2
  rounded-lg
  transition
  hover:from-purple-500/40
  hover:to-fuchsia-500/40
  hover:border-purple-400/50
  shadow-[0_0_20px_rgba(168,85,247,0.35)]
  "
>
  Generate Now
</button>

            </div>

          </div>
        ))}
      </div>
    </section>
  );
}

function TimerBlock({ value, label }) {
  return (
    <div className="bg-[#111] border border-white/10 rounded-lg px-4 py-2 w-20 text-center">
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs text-white/50">{label}</div>
    </div>
  );
}