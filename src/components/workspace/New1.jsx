import { NavLink } from "react-router-dom";

const TOOLS = [
  {
    id: "image-generator",
    title: "Viral Image Generator",
    description:
      "Generate high-quality Viral AI images from simple prompts with full control.",
    to: "/workspace/image-generator",
    glow: "rgba(122,59,255,0.6)",
    preview: "/assets/previews/fenix.webp",
  },
  {
    id: "video-generator",
    title: "Viral Video Generator",
    description:
      "Create viral videos without expensive costs.",
    to: "/workspace/image-generator",
    glow: "rgba(56,189,248,0.6)",
    preview: "/assets/previews/rome.mp4",
  },
];

export default function New1() {
  return (
    <section className="w-full px-4 md:px-8 py-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
        {TOOLS.map((tool) => (
          <NavLink key={tool.id} to={tool.to} className="group relative">
            
            {/* GLOW LAYER (OUTSIDE CARD) */}
            <div
              className="
                pointer-events-none
                absolute inset-0
                opacity-0 group-hover:opacity-100
                transition-opacity duration-300
              "
            >
              <div
                className="
                  absolute -top-16 -left-16
                  w-[320px] h-[320px]
                  rounded-full blur-[100px]
                "
                style={{ background: tool.glow }}
              />
            </div>

            {/* CARD */}
           <div
  className="
    relative z-10
    rounded-2xl
    bg-[#0E1016]
    border border-white/10
    p-6
    overflow-hidden
    transition-all duration-300
    group-hover:border-white/20
    group-hover:shadow-[0_0_60px_rgba(0,0,0,0.6)]
    flex flex-col
    h-full
  "
>

{/* PREVIEW IMAGE */}
<div className="relative w-full aspect-video mb-6 overflow-hidden rounded-xl">

  {/* IMAGE PREVIEW */}
  {!tool.preview.endsWith(".mp4") && (
    <img
      src={tool.preview}
      alt={tool.title}
      className="
        w-full h-full object-cover
        transition-transform duration-500
        group-hover:scale-105
      "
    />
  )}

  {/* VIDEO PREVIEW */}
  {tool.preview.endsWith(".mp4") && (
    <video
      src={tool.preview}
      autoPlay
      loop
      muted
      playsInline
      preload="none"
      className="
        w-full h-full object-cover
        transition-transform duration-500
        group-hover:scale-105
      "
    />
  )}

  {/* Overlay */}
  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
</div>

             <div className="flex flex-col flex-1">

  <h3 className="text-white text-lg font-semibold group-hover:text-white">
    {tool.title}
  </h3>

  <p className="text-white/60 text-sm mt-2 leading-relaxed line-clamp-2">
    {tool.description}
  </p>

</div>
            </div>
          </NavLink>
        ))}
      </div>
    </section>
  );
}
