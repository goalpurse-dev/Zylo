import { NavLink } from "react-router-dom";

const TOOLS = [
  {
    id: "image-generator",
    title: "Image Generator",
    description:
      "Generate high-quality AI images from simple prompts with full creative control.",
    to: "/workspace/image-generator",
    glow: "rgba(122,59,255,0.6)", // purple
  },
  {
    id: "product-photos",
    title: "Product Photos",
    description:
      "Create studio-quality product images without expensive photoshoots.",
    to: "/workspace/productphoto",
    glow: "rgba(56,189,248,0.6)", // cyan
  },
  {
    id: "background-library",
    title: "Background Library",
    description:
      "Browse and apply premium AI-generated backgrounds instantly and efficiently.",
    to: "/workspace/library",
    glow: "rgba(52,211,153,0.6)", // green
  },
  {
    id: "my-product",
    title: "My Products",
    description:
      "Manage your saved products and reuse them across generations.",
    to: "/workspace/myproduct",
    glow: "rgba(244,114,182,0.6)", // pink
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
              "
            >
              {/* STACK */}
              <div className="relative h-28 mb-6">
                <div className="absolute left-0 top-0 w-28 h-20 rounded-xl bg-white/10 rotate-[-10deg] transition-transform group-hover:-translate-x-1" />
                <div className="absolute left-4 top-2 w-28 h-20 rounded-xl bg-white/15 rotate-[-4deg] transition-transform group-hover:translate-y-1" />
                <div className="absolute left-8 top-4 w-28 h-20 rounded-xl bg-white/20 transition-transform group-hover:translate-x-1" />
              </div>

              <h3 className="text-white text-lg font-semibold">
                {tool.title}
              </h3>
              <p className="text-white/60 text-sm mt-2 leading-relaxed">
                {tool.description}
              </p>
            </div>
          </NavLink>
        ))}
      </div>
    </section>
  );
}
