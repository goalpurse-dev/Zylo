import React, { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Clock, Flame } from "lucide-react";

const benefits = [
  {
    icon: TrendingUp,
    stat: 99,
    suffix: "%",
    label: "More Views on Average",
    description: "Zyvo-generated content consistently outperforms manually created posts across TikTok, Reels, and YouTube Shorts.",
    color: "#7A3BFF",
    bg: "from-[#7A3BFF]/10 to-transparent",
  },
  {
    icon: Clock,
    stat: 85,
    suffix: "%",
    label: "Faster Content Creation",
    description: "Go from idea to publish-ready post in under 60 seconds. No editing skills needed. No team required.",
    color: "#9D6BFF",
    bg: "from-[#9D6BFF]/10 to-transparent",
  },
  {
    icon: Flame,
    stat: 300,
    suffix: "%",
    label: "Higher Engagement Growth",
    description: "Creators using Zyvo report 3× more likes, shares, and follows compared to their previous content.",
    color: "#C084FC",
    bg: "from-[#C084FC]/10 to-transparent",
  },
];

function AnimatedStat({ target, suffix }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const duration = 1400;
          const steps = duration / 16;
          const inc = target / steps;
          let cur = 0;
          const t = setInterval(() => {
            cur += inc;
            if (cur >= target) { setCount(target); clearInterval(t); }
            else setCount(Math.floor(cur));
          }, 16);
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return <span ref={ref} className="tabular-nums">{count}{suffix}</span>;
}

export default function ZyvoStats() {
  return (
    <section className="relative w-full bg-[#F7F5FA] py-12 md:py-20 px-6 overflow-hidden cursor-default">

      {/* Background accent */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-100/50 blur-[100px] rounded-full" />
      </div>

      <div className="relative max-w-6xl mx-auto">

        {/* Header */}
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-3.5 py-1.5 text-xs font-bold text-[#7A3BFF] uppercase tracking-widest mb-5"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#7A3BFF]" />
            Real Results
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-4xl md:text-6xl font-bold text-gray-900 leading-tight tracking-tight mb-4"
          >
            Benefits You Get
            <span className="block bg-gradient-to-r from-[#7A3BFF] via-[#9D6BFF] to-[#C084FC] bg-clip-text text-transparent">
              From Zyvo
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="text-lg text-gray-500 max-w-xl mx-auto"
          >
            Real advantages that help you grow faster and stand out online.
          </motion.p>
        </div>

        {/* Benefit cards */}
        <div className="grid md:grid-cols-3 gap-5 md:gap-7">
          {benefits.map((b, i) => (
            <motion.div
              key={b.label}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: i * 0.12, duration: 0.6, ease: "easeOut" }}
              whileHover={{ y: -8, transition: { duration: 0.2 } }}
              className="group relative bg-white rounded-3xl p-8 md:p-10 border border-purple-100 hover:border-purple-300 overflow-hidden"
              style={{ boxShadow: "0 4px 30px rgba(0,0,0,0.06)" }}
            >
              {/* Radial glow */}
              <div
                className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${b.bg} opacity-0 group-hover:opacity-100 transition duration-500 pointer-events-none`}
              />

              {/* Icon */}
              <div
                className="inline-flex p-3.5 rounded-2xl mb-6"
                style={{ background: `${b.color}15` }}
              >
                <b.icon className="w-6 h-6" style={{ color: b.color }} />
              </div>

              {/* Big stat */}
              <div
                className="text-5xl md:text-6xl font-extrabold mb-2 tracking-tight"
                style={{ color: b.color }}
              >
                <AnimatedStat target={b.stat} suffix={b.suffix} />
              </div>

              {/* Divider */}
              <div
                className="w-8 h-[3px] rounded-full mb-4 transition-all duration-300 group-hover:w-16"
                style={{ background: b.color }}
              />

              {/* Label */}
              <h3 className="text-lg font-bold text-gray-900 mb-3">{b.label}</h3>

              {/* Description */}
              <p className="text-gray-500 text-sm leading-relaxed">{b.description}</p>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
