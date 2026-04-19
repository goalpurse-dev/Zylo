import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const GoogleIcon = () => (
  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

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
            <GoogleIcon />
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