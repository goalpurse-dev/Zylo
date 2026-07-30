import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Credit from "/icons/credits.png";
import { onCreditSpend } from "../../lib/creditPopEvents";

// Roblox-style "credits spent" pop — slides in from the right, sits under
// the credit counter for a couple seconds, then fades out. Mounted once
// inside TopRow so it works from every tool without per-page wiring; see
// emitCreditSpend() in jobs.ts for what triggers it.
export default function CreditSpendPopup() {
  const [pops, setPops] = useState([]);
  const idRef = useRef(0);

  useEffect(() => {
    return onCreditSpend(({ amount }) => {
      const id = ++idRef.current;
      setPops((prev) => [...prev, { id, amount }]);
      setTimeout(() => {
        setPops((prev) => prev.filter((p) => p.id !== id));
      }, 2600);
    });
  }, []);

  return (
    <div className="pointer-events-none absolute right-0 top-[calc(100%+8px)] z-[70] flex flex-col items-end gap-1.5">
      <AnimatePresence>
        {pops.map((p) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, x: 110, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.9, transition: { duration: 0.25 } }}
            transition={{ type: "spring", stiffness: 420, damping: 26 }}
            className="flex items-center gap-1 rounded-full border border-red-300/40 bg-gradient-to-b from-red-500 to-red-600 px-2 py-1 shadow-[0_6px_18px_rgba(239,68,68,0.45)]"
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
            <span className="text-[11px] font-black text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)] whitespace-nowrap">
              -{p.amount} credits
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
