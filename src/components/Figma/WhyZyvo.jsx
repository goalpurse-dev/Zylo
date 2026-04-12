import { motion } from "framer-motion";
import { Target, Rocket, Zap } from "lucide-react";

const cards = [
  {
    icon: Target,
    title: "Built for Growth",
    body: "Every tool inside Zyvo is designed to maximize attention, engagement, and viral potential — not just aesthetics.",
    gradient: "from-[#7A3BFF] to-[#9D6BFF]",
    glow: "rgba(122,59,255,0.25)",
    accent: "#C084FC",
  },
  {
    icon: Rocket,
    title: "Viral Engine",
    body: "Advanced AI models trained to generate scroll-stopping visuals that perform on modern social platforms.",
    gradient: "from-[#9D6BFF] to-[#C084FC]",
    glow: "rgba(157,107,255,0.25)",
    accent: "#7A3BFF",
    featured: true,
  },
  {
    icon: Zap,
    title: "Fast Content Factory",
    body: "Go from idea → finished post in under 60 seconds. No complex editing. No wasted time.",
    gradient: "from-[#C084FC] to-[#E879F9]",
    glow: "rgba(192,132,252,0.25)",
    accent: "#9D6BFF",
  },
];

export default function WhyZyvo() {
  return (
    <section className="w-full bg-[#F7F5FA] py-12 md:py-20 px-6 overflow-hidden">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="text-center mb-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-3.5 py-1.5 text-xs font-bold text-[#7A3BFF] uppercase tracking-widest mb-5"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#7A3BFF]" />
            Why Creators Choose Us
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6 }}
            className="text-4xl md:text-6xl font-bold text-gray-900 leading-tight tracking-tight mb-5"
          >
            Why Zyvo is{" "}
            <span className="bg-gradient-to-r from-[#7A3BFF] via-[#9D6BFF] to-[#C084FC] bg-clip-text text-transparent">
              Different
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="text-lg md:text-xl text-gray-500 max-w-2xl mx-auto"
          >
            Built for creators who care about growth — not just generating content.
          </motion.p>
        </div>

        {/* Cards */}
        <div className="mt-16 grid md:grid-cols-3 gap-5 md:gap-6">
          {cards.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: i * 0.13, duration: 0.6, ease: "easeOut" }}
              whileHover={{ y: -10, transition: { duration: 0.22 } }}
              className={`group relative rounded-3xl p-8 md:p-10 cursor-default overflow-hidden ${
                card.featured
                  ? "bg-gradient-to-br from-[#1A0533] to-[#2D1060] border border-[#7A3BFF]/50"
                  : "bg-white border border-purple-100 hover:border-purple-300"
              }`}
              style={{
                boxShadow: card.featured
                  ? `0 20px 60px ${card.glow}, 0 0 0 1px rgba(122,59,255,0.2)`
                  : `0 4px 24px rgba(0,0,0,0.06)`,
              }}
            >
              {/* Background glow for featured */}
              {card.featured && (
                <div className="absolute -top-20 -right-20 w-64 h-64 bg-[#7A3BFF]/20 rounded-full blur-[60px] pointer-events-none" />
              )}

              {/* Hover glow for regular cards */}
              {!card.featured && (
                <div
                  className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition duration-500 pointer-events-none"
                  style={{ background: `radial-gradient(circle at 30% 30%, ${card.glow}, transparent 70%)` }}
                />
              )}

              {/* Icon */}
              <div className="relative mb-7">
                <div
                  className={`inline-flex p-4 rounded-2xl ${
                    card.featured ? "bg-white/10" : "bg-purple-50 group-hover:bg-purple-100 transition"
                  }`}
                >
                  <card.icon
                    className="w-7 h-7"
                    style={{ color: card.featured ? "#C084FC" : "#7A3BFF" }}
                  />
                </div>
              </div>

              {/* Text */}
              <h3
                className={`text-xl md:text-2xl font-bold mb-3 ${
                  card.featured ? "text-white" : "text-gray-900"
                }`}
              >
                {card.title}
              </h3>

              <p
                className={`leading-relaxed text-sm md:text-base ${
                  card.featured ? "text-white/60" : "text-gray-500"
                }`}
              >
                {card.body}
              </p>

              {/* Bottom accent line */}
              <div
                className={`absolute bottom-0 left-8 right-8 h-[2px] rounded-full bg-gradient-to-r ${card.gradient} opacity-0 group-hover:opacity-100 transition duration-500`}
              />
              {card.featured && (
                <div className={`absolute bottom-0 left-8 right-8 h-[2px] rounded-full bg-gradient-to-r ${card.gradient}`} />
              )}
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
