import { motion } from "framer-motion";

export default function GlowHeader() {
  return (
    <section className="relative w-full mt-10 md:mt-16 overflow-hidden bg-[#090A0A]">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 text-center px-6"
      >
        <h1 className="text-[34px] md:text-[56px] font-bold leading-[1.15]">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="block text-white"
          >
            Would You Like To
          </motion.span>
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="block"
          >
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
              Go Viral
            </span>{" "}
            <span className="text-white">Today?</span>
          </motion.span>
        </h1>

        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="mt-6 h-px w-24 mx-auto bg-gradient-to-r from-transparent via-white/20 to-transparent"
        />
      </motion.div>
    </section>
  );
}
