// src/components/video/CreationOverlay.jsx
import React, { useEffect, useRef, useState } from "react";

export default function CreationOverlay({
  onDone,
  messages = [
    "Warming up the edit engine…",
    "Prepping scenes and captions…",
    "Syncing beats and cuts…",
  ],
  durationMs = 1100,
}) {
  const [msgIndex, setMsgIndex] = useState(0);
  const doneRef = useRef(onDone);
  useEffect(() => { doneRef.current = onDone; }, [onDone]);

  // Run timers once; do not restart on every render
  useEffect(() => {
    const stepper = setInterval(
      () => setMsgIndex((i) => (i + 1) % messages.length),
      420
    );
    const timer = setTimeout(() => doneRef.current?.(), durationMs);
    return () => {
      clearInterval(stepper);
      clearTimeout(timer);
    };
  }, [durationMs, messages.length]);

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-white">
        <div className="h-12 w-12 rounded-full border-4 border-white/25 border-t-white animate-spin" />
        <div className="text-lg font-semibold">Starting your project…</div>
        <div className="text-sm text-white/70">{messages[msgIndex]}</div>
      </div>
    </div>
  );
}
