export default function GlowHeader() {
  return (
    <section
  className="relative w-full py-20  overflow-hidden"
  style={{
    backgroundColor: "#12141A",
    maskImage:
      "linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%)",
    WebkitMaskImage:
      "linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%)",
  }}
>

      {/* GLOWS */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        
        {/* Purple glow */}
        <div
          className="absolute"
          style={{
            width: 520,
            height: 260,
            background:
              "radial-gradient(circle, rgba(122,59,255,0.35), rgba(122,59,255,0.15), rgba(18,20,26,0) 70%)",
            filter: "blur(60px)",
          }}
        />

        {/* Blue glow */}
        <div
          className="absolute"
          style={{
            width: 420,
            height: 220,
            transform: "translate(-120px, 20px)",
            background:
              "radial-gradient(circle, rgba(56,189,248,0.25), rgba(56,189,248,0.12), rgba(18,20,26,0) 70%)",
            filter: "blur(70px)",
          }}
        />
      </div>

      {/* CONTENT */}
      <div className="relative z-10 text-center">
        <h1 className="text-white text-[28px] md:text-[40px] font-semibold">
          Let's Generate Something Viral
        </h1>
      </div>
    </section>
  );
}
