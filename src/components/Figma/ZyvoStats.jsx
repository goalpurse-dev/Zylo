import React, { useEffect, useState, useRef } from "react";

function Stat({ value, label, suffix = "%" }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.5 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;

    let start = 0;
    const duration = 1200;
    const increment = value / (duration / 16);

    const counter = setInterval(() => {
      start += increment;
      if (start >= value) {
        setCount(value);
        clearInterval(counter);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(counter);
  }, [visible, value]);

  return (
    <div
      ref={ref}
      className="group relative bg-white p-12 rounded-3xl shadow-lg shadow-black/5 hover:shadow-xl hover:-translate-y-2 transition-all duration-300 text-center"
    >
      {/* Soft glow */}
      <div className="absolute -z-10 inset-0 bg-purple-200/30 blur-3xl opacity-0 group-hover:opacity-100 transition duration-500 rounded-3xl" />

      <div className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-[#7A3BFF] to-[#9F7AEA] bg-clip-text text-transparent mb-4">
        {count}{suffix}
      </div>

      <div className="w-10 h-[2px] bg-purple-200 mx-auto mb-6" />

      <p className="text-gray-600 text-lg">{label}</p>
    </div>
  );
}

export default function ZyvoStats() {
  return (
    <section className="relative w-full bg-[#F7F5FA] py-10 px-6 overflow-hidden cursor-default">

      {/* Subtle radial background accent */}
      <div className="absolute top-1/2 left-1/2 w-[700px] h-[700px] -translate-x-1/2 -translate-y-1/2 bg-purple-100/40 blur-3xl rounded-full -z-10" />

      <div className="max-w-6xl mx-auto text-center">

        <h2 className="text-4xl md:text-5xl font-semibold text-gray-900 mb-6 cursor-default">
          Benefits You Get From Zyvo
        </h2>

        <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-10 cursor-default">
          Real advantages that help you grow faster and stand out online.
        </p>

        <div className="grid md:grid-cols-3 gap-10">

          <Stat value={99} label="More Views on Average" />
          <Stat value={85} label="Faster Content Creation" />
          <Stat value={300} label="Higher Engagement Growth" suffix="%" />

        </div>

      </div>
    </section>
  );
}