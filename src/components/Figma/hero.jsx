import { Link } from "react-router-dom";
import { motion } from "framer-motion";

export default function Hero() {
  return (
    <section className="w-full bg-[#F7F5FA] py-28 px-6 overflow-hidden">
      <div className="max-w-5xl mx-auto text-center">

        {/* HEADLINE */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-5xl md:text-6xl font-semibold text-gray-900 leading-tight"
        >
          Turn ideas into{" "}
          
          {/* 🔥 GRADIENT WORD */}
          <span className="relative inline-block">
            <span className="mr-1 bg-gradient-to-r from-[#7A3BFF] via-[#9D4EDD] to-[#C77DFF] bg-clip-text text-transparent">
              viral content
            </span>

            {/* glow */}
            <span className="absolute inset-0 blur-xl opacity-30 bg-gradient-to-r from-[#7A3BFF] to-[#C77DFF]" />
          </span>

          <br className="hidden md:block " />

          with AI
        </motion.h1>

        {/* SUBTEXT */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6 }}
          className="mt-6 text-lg text-gray-600 max-w-2xl mx-auto"
        >
          Generate scroll-stopping videos and images in seconds using{" "}
          <span className="font-semibold text-gray-900">25+ AI models</span>{" "}
          built for creators who want to grow.
        </motion.p>

        {/* BUTTONS */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="mt-10 flex flex-col sm:flex-row justify-center gap-4"
        >

          {/* Google Button */}
          <Link
            to="/signup"
            className="flex items-center justify-center gap-3 px-6 py-3 rounded-xl bg-white border border-gray-200 shadow-sm hover:shadow-md hover:scale-[1.02] transition font-medium text-gray-800"
          >
            <img
              src="https://www.svgrepo.com/show/475656/google-color.svg"
              alt="Google"
              className="w-5 h-5"
            />
            Start Free with Google
          </Link>

          {/* Main CTA */}
          <Link
            to="/signup"
            className="px-8 py-3 rounded-xl bg-gradient-to-r from-[#7A3BFF] to-[#6F3AE6] text-white font-medium shadow-lg shadow-purple-500/30 hover:scale-[1.05] hover:shadow-purple-500/50 transition"
          >
            Start Creating Free
          </Link>

        </motion.div>

      </div>
    </section>
  );
}