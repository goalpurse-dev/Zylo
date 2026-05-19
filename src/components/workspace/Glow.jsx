import { motion } from "framer-motion";

export default function GlowHeader() {
  return (
    <section className="relative w-full pt-6 md:pt-10 pb-1 overflow-hidden bg-[#090A0A]">
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 text-center px-5 md:px-8"
      >
        <h1 className="text-[30px] md:text-[50px] lg:text-[58px] font-black leading-[1.15] tracking-tight">
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
            <span className="bg-gradient-to-r from-[#c084fc] via-[#e879f9] to-[#f472b6] bg-clip-text text-transparent">
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

        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="mt-5 h-px w-20 mx-auto bg-gradient-to-r from-transparent via-white/20 to-transparent"
        />
      </motion.div>
    </section>
  );
}
