import { Link } from "react-router-dom";
import { motion } from "framer-motion";

export default function Hero() {
  return (
    <section className="w-full bg-[#F7F5FA] pt-20 pb-12 md:pt-28 md:pb-20 px-5 overflow-hidden">
      <div className="max-w-5xl mx-auto text-center">

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-3.5 py-1.5 text-xs font-semibold text-[#7A3BFF] mb-6"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#7A3BFF] animate-pulse" />
          25+ AI models · 10 free generations
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6 }}
          className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 leading-[1.1] tracking-tight"
        >
          Turn ideas into{" "}
          <span className="relative inline-block">
            <span className="bg-gradient-to-r from-[#7A3BFF] via-[#9D4EDD] to-[#C77DFF] bg-clip-text text-transparent">
              viral content
            </span>
            <span className="absolute inset-0 blur-2xl opacity-20 bg-gradient-to-r from-[#7A3BFF] to-[#C77DFF] pointer-events-none" />
          </span>
          <span className="block">with AI</span>
        </motion.h1>

        {/* Subtext */}
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="mt-5 text-base sm:text-lg text-gray-500 max-w-xl mx-auto leading-relaxed"
        >
          Generate scroll-stopping videos and images in seconds using{" "}
          <span className="font-semibold text-gray-800">25+ AI models</span>{" "}
          built for creators who want to grow.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 px-2"
        >
          {/* Google */}
          <Link
            to="/signup"
            className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-white border border-gray-200 shadow-sm hover:shadow-md hover:scale-[1.02] transition font-medium text-gray-800 text-sm"
          >
            <img
              src="https://www.svgrepo.com/show/475656/google-color.svg"
              alt="Google"
              className="w-5 h-5 shrink-0"
            />
            Start Free with Google
          </Link>

          {/* Main CTA */}
          <Link
            to="/signup"
            className="w-full sm:w-auto flex items-center justify-center px-8 py-3.5 rounded-xl bg-gradient-to-r from-[#7A3BFF] to-[#6F3AE6] text-white font-semibold text-sm shadow-lg shadow-purple-500/25 hover:scale-[1.03] hover:shadow-purple-500/40 transition"
          >
            Start Creating Free →
          </Link>
        </motion.div>

        {/* Social proof */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="mt-8 flex flex-col items-center gap-2"
        >
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <svg key={i} className="h-4 w-4 fill-yellow-400" viewBox="0 0 20 20">
                  <path d="M10 15.27l-5.18 3.05 1.4-5.98L1 7.97l6.05-.52L10 2l2.95 5.45 6.05.52-5.22 4.37 1.4 5.98L10 15.27z" />
                </svg>
              ))}
            </div>
            <span className="font-semibold text-gray-700">4.9/5</span>
            <span className="text-gray-300">·</span>
            <span>4,200+ creators</span>
          </div>
          <p className="text-xs text-gray-400">No credit card required · Cancel anytime</p>
        </motion.div>

      </div>
    </section>
  );
}