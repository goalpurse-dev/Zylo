export default function ReferenceImageModal({
  open,
  onClose,
  images,
  selected,
  onUpload,
  onToggle,
  maxSelectable,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-[900px] h-[600px] rounded-2xl bg-[#0B0E1A]/95 border border-white/10 shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#110829]/80">
          <h2 className="text-white text-lg font-semibold">
            Select Images for Guidance
          </h2>
          <button onClick={onClose} className="text-white/60 hover:text-white">✕</button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="grid grid-cols-5 gap-4">
            
            {/* Upload card */}
            <label className="cursor-pointer rounded-xl border border-dashed border-white/20 flex flex-col items-center justify-center text-center h-[120px] md:h-[200px] text-white/60 hover:border-purple-500">
              <input type="file" hidden onChange={onUpload} />
              <span className="text-sm  ">Upload image</span>
            </label>

            {images.map((img) => {
              const isSelected = selected.includes(img);

              return (
                <button
                  key={img.id}
                  onClick={() => onToggle(img)}
                  className={`relative rounded-xl overflow-hidden border
                    ${isSelected ? "border-purple-500" : "border-white/10"}
                  `}
                >
                  <img src={img.url} className="w-full h-full object-cover" />

                  {isSelected && (
                    <div className="absolute inset-0 bg-black/50 border-[2px] border-[#7A3BFF] flex items-center justify-center text-white font-bold ">
                    <div className="p-2 flex justify-center items-center">
                     <div className="rounded-full bg-gradient-to-bl from-[#7A3BFF] to-[#492399] py-1 px-2 sm:py-2 sm:px-3 md:py-3 md:px-4">
                     <p className="">✓</p>  
                        </div>   
                    </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between bg-[#110829]/80">
          <span className="text-white/60 text-sm">
            {selected.length}/{maxSelectable} selected
          </span>

          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-xl bg-white/5 text-white">
              Cancel
            </button>
        <button
  disabled={!selected.length}
  onClick={onClose}
  className="px-6 py-2 rounded-xl bg-gradient-to-r from-[#7A3BFF] to-[#492399] text-white disabled:opacity-40"
>
  Confirm
</button>
          </div>
        </div>

      </div>
    </div>
  );
}
