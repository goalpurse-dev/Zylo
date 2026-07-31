import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Credit from "/icons/credits.png";
import { onCreditSpend, onCreditRefund } from "../../lib/creditPopEvents";

// Roblox-style credit pop — slides in from the right, sits under the credit
// counter for a couple seconds, then fades out. Mounted once inside TopRow
// so it works from every tool without per-page wiring. Red "-N" fires once
// per Generate click (see emitCreditSpend callers in each workspace page);
// green "+N" fires on a refund (see emitCreditRefund).
export default function CreditSpendPopup() {
  const [pops, setPops] = useState([]);
  const idRef = useRef(0);

  useEffect(() => {
    const unsubSpend = onCreditSpend(({ amount, message }) => {
      const id = ++idRef.current;
      setPops((prev) => [...prev, { id, amount, message, kind: "spend" }]);
      setTimeout(() => setPops((prev) => prev.filter((p) => p.id !== id)), 2600);
    });
    const unsubRefund = onCreditRefund(({ amount, message }) => {
      const id = ++idRef.current;
      setPops((prev) => [...prev, { id, amount, message, kind: "refund" }]);
      setTimeout(() => setPops((prev) => prev.filter((p) => p.id !== id)), 4000);
    });
    return () => { unsubSpend(); unsubRefund(); };
  }, []);

  return (
    <div className="pointer-events-none absolute right-0 top-[calc(100%+8px)] z-[70] flex flex-col items-end gap-1.5">
      <AnimatePresence>
        {pops.map((p) => {
          const isRefund = p.kind === "refund";
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, x: 110, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.9, transition: { duration: 0.25 } }}
              transition={{ type: "spring", stiffness: 420, damping: 26 }}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 shadow-lg ${
                isRefund
                  ? "border-emerald-300/40 bg-gradient-to-b from-emerald-500 to-emerald-600 shadow-[0_6px_18px_rgba(16,185,129,0.45)]"
                  : "border-red-300/40 bg-gradient-to-b from-red-500 to-red-600 shadow-[0_6px_18px_rgba(239,68,68,0.45)]"
              }`}
            >
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 bg-white"
                style={{
                  WebkitMaskImage: `url(${Credit})`,
                  maskImage: `url(${Credit})`,
                  WebkitMaskPosition: "center",
                  maskPosition: "center",
                  WebkitMaskRepeat: "no-repeat",
                  maskRepeat: "no-repeat",
                  WebkitMaskSize: "contain",
                  maskSize: "contain",
                }}
              />
              <span className="leading-tight">
                <span className="block text-[11px] font-black text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)] whitespace-nowrap">
                  {isRefund ? "+" : "-"}{p.amount} credits
                </span>
                {p.message && (
                  <span className="block text-[9.5px] font-semibold text-white/85 whitespace-nowrap">{p.message}</span>
                )}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
