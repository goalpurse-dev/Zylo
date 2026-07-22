import { motion } from "framer-motion";

export default function GlowHeader() {
  return (
    <section className="relative w-full overflow-hidden pt-4 sm:pt-7 md:pt-10">
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 px-3 text-center sm:px-5 md:px-8"
      >
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 hidden items-center gap-2 rounded-full border border-white/10 bg-[#110d16]/45 px-3.5 py-1.5 text-[11px] font-bold text-white/75 shadow-[0_8px_30px_rgba(0,0,0,.2)] backdrop-blur-xl md:inline-flex"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[#a970ff] shadow-[0_0_10px_#a970ff]" />
          AI creation suite for viral content
        </motion.div>
        <h1 className="mx-auto max-w-4xl text-[30px] font-black leading-[1.04] tracking-[-0.045em] sm:text-[36px] md:text-[52px] lg:text-[58px] xl:text-[64px]">
          <motion.span
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.5 }}
            className="block text-white"
          >
            What would you like to
          </motion.span>
          <motion.span
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="block"
          >
            <span className="bg-gradient-to-r from-[#d8c1ff] via-[#a970ff] to-[#e879f9] bg-clip-text text-transparent">
              create
            </span>
            <span className="text-white"> today?</span>
            <img
              src="/home/click.png"
              alt=""
              className="inline-block ml-2 md:ml-3 w-8 h-8 md:w-11 md:h-11 align-middle -mt-2 select-none pointer-events-none"
            />
          </motion.span>
        </h1>

      </motion.div>
    </section>
  );
}
