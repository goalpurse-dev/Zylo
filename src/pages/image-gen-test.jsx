import { Video, Image, Package, ImageDownIcon, ChevronRight } from "lucide-react"
import { useState } from "react"

export default function ImageGenTest() {
  const [active, setActive] = useState("Image")

 const items = [
  { label: "Image", icon: Image, color: "from-purple-500/30 via-purple-500/10" },
  { label: "Video", icon: Video, color: "from-indigo-500/30 via-indigo-500/10" },
  { label: "Product", icon: Package, color: "from-emerald-500/30 via-emerald-500/10" },
]

  return (
    <section className="w-full min-h-screen bg-[#0F1117] flex justify-center pt-12 px-4">

      <div className="w-full max-w-md bg-[#151822] border border-[#1F2230] rounded-3xl p-6 space-y-6 shadow-2xl">

      {/* MODE SELECTOR */}
<div className="grid grid-cols-3 gap-3">
  {items.map((item, i) => {
    const Icon = item.icon
    const isActive = active === item.label

    return (
      <div
        key={i}
        onClick={() => setActive(item.label)}
        className={`relative overflow-hidden cursor-pointer
                    flex flex-col items-center justify-center
                    rounded-2xl py-2
                    border transition-all duration-300
                    ${
                      isActive
                        ? "border-white/20 bg-[#1A1E2A]"
                        : "border-[#232635] bg-[#141722]"
                    }`}
      >
        {/* CLOUD BACKGROUND (inside only) */}
        <div
          className={`absolute bottom-0 left-0 w-full h-full
                      bg-gradient-to-t ${item.color} to-transparent
                      opacity-70 transition duration-300`}
        />

        <Icon className="w-6 h-6 mb-2 text-white relative z-10" />
        <p className="text-sm text-white relative z-10">
          {item.label}
        </p>
      </div>
    )
  })}
</div>


     {/* PROMPT */}
<div
  className="relative rounded-2xl p-[1px]
             bg-gradient-to-br from-purple-500/20 to-transparent
             hover:from-purple-500/30
             transition-all duration-300"
>
  <div
    className="bg-[#1A1E2A] border border-[#232635]
               rounded-2xl p-4
               transition-all duration-300
               hover:border-purple-500/40
               focus-within:border-purple-500/60
               focus-within:shadow-lg
               focus-within:shadow-purple-500/20"
  >
    <textarea
      placeholder="Describe what you want to create..."
      className="w-full bg-transparent outline-none
                 text-sm text-white
                 placeholder-[#6B7280]
                 resize-none"
      rows={3}
    />
  </div>
</div>


        {/* IMPORT */}
        <div className="border border-dashed border-[#2A2E3C] rounded-2xl p-6 bg-[#141722] hover:bg-[#171A24] transition">
          <div className="flex flex-col items-center">
            <ImageDownIcon className="w-6 h-6 text-[#9CA3AF] mb-2" />
            <p className="text-[#9CA3AF] text-xs">Add visual references</p>
          </div>
        </div>

        {/* SETTINGS */}
        <div className="space-y-3">

          {/* MODEL */}
          <div className="flex justify-between items-center 
                          bg-gradient-to-br from-[#1A1E2A] to-[#161923]
                          border border-[#232635]
                          rounded-xl px-4 py-3
                          hover:border-white/20 transition">
            <div>
              <p className="text-xs text-[#6B7280]">Model</p>
              <p className="text-sm text-white font-medium">Kling 2.1</p>
            </div>
            <ChevronRight className="w-4 h-4 text-[#6B7280]" />
          </div>

          {/* STYLE */}
          <div className="flex justify-between items-center 
                          bg-gradient-to-br from-[#1A1E2A] to-[#161923]
                          border border-[#232635]
                          rounded-xl px-4 py-3
                          hover:border-white/20 transition">
            <div>
              <p className="text-xs text-[#6B7280]">Style</p>
              <p className="text-sm text-white font-medium">Realistic</p>
            </div>
            <ChevronRight className="w-4 h-4 text-[#6B7280]" />
          </div>

          {/* SIZE */}
          <div className="flex justify-between items-center 
                          bg-gradient-to-br from-[#1A1E2A] to-[#161923]
                          border border-[#232635]
                          rounded-xl px-4 py-3
                          hover:border-white/20 transition">
            <div>
              <p className="text-xs text-[#6B7280]">Size</p>
              <p className="text-sm text-white font-medium">1024 × 1024</p>
            </div>
            <ChevronRight className="w-4 h-4 text-[#6B7280]" />
          </div>

        </div>

        {/* GENERATE */}
        <button
          className="w-full py-3 rounded-2xl font-medium text-white
                     bg-gradient-to-r from-[#7A3BFF] to-[#7444F5]
                     hover:scale-[1.02] transition
                     shadow-lg shadow-purple-600/30"
        >
          Generate
        </button>

      </div>
    </section>
  )
}
