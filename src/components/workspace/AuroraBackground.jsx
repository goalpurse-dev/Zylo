export default function GlowHeader() {
  return (
    <section className="relative w-full py-24 bg-[#12141A] overflow-hidden">
      
      {/* GLOW LAYER */}
      <div className="pointer-events-none absolute inset-0 flex justify-center items-center">
        <div
          className="
            w-[700px] h-[300px]
            bg-[radial-gradient(circle_at_center,
              rgba(122,59,255,0.35),
              rgba(122,59,255,0.15) 30%,
              rgba(20,22,30,0) 70%
            )]
            blur-[80px]
          "
        />
        <div
          className="
            absolute
            w-[600px] h-[260px]
            bg-[radial-gradient(circle_at_center,
              rgba(80,200,255,0.25),
              rgba(20,22,30,0) 70%
            )]
            blur-[90px]
          "
        />
      </div>

      {/* CONTENT */}
      <div className="relative z-10 text-center">
        <h1 className="text-white text-[32px] md:text-[40px] font-semibold">
          Hi Upward,<br />
          what will you create?
        </h1>
      </div>

    </section>
  );
}
