import { AnimatePresence, motion } from "framer-motion";
import Credit from "/icons/whitecredit.png";

// Roblox-style "credits refunded" popup — fires when a tier fails and the
// hook automatically steps down to a cheaper one. Stacks if multiple scenes
// downgrade around the same time; each toast auto-dismisses on its own timer
// (see FootballerNationalitySwap.jsx).
export default function CreditRefundToast({ toasts }) {
  return (
    <div className="fixed top-20 right-3 sm:right-6 z-[400] flex flex-col items-end gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, scale: 0.3, x: 60, rotate: 8 }}
            animate={{ opacity: 1, scale: 1, x: 0, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.4, x: 30, transition: { duration: 0.2 } }}
            transition={{ type: "spring", stiffness: 480, damping: 20 }}
            className="pointer-events-auto flex items-center gap-2.5 rounded-2xl border border-emerald-300/50 bg-gradient-to-b from-emerald-400 to-emerald-600 px-3.5 py-2.5 shadow-[0_10px_28px_rgba(16,185,129,0.5)]"
          >
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: [0, -12, 12, -8, 0] }}
              transition={{ duration: 0.5, delay: 0.05 }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/25 ring-1 ring-white/40"
            >
              <img src={Credit} alt="" className="h-4 w-4 object-contain brightness-125" />
            </motion.div>
            <div className="leading-tight">
              <motion.div
                initial={{ y: 4, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="text-[15px] font-black text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]"
              >
                +{t.refundedCredits} credits
              </motion.div>
              {t.message && (
                <div className="text-[10.5px] font-semibold text-white/90">{t.message}</div>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
