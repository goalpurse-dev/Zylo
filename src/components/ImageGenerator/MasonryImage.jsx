export const MasonryImage = ({ src, prompt, onUse }) => {
  return (
    <div className="relative mb-3 break-inside-avoid overflow-hidden rounded-xl group cursor-pointer">
      
      {/* Image */}
      <img
        src={src}
        alt=""
        className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        loading="lazy"
      />

      {/* Hover overlay */}
      <div className="
        absolute inset-0 
        bg-black/0 
        group-hover:bg-black/30 
        transition
        flex flex-col justify-end
        p-3
      ">
        
        {/* Prompt preview */}
        <p className="
          text-white font-semibold text-sm leading-snug
          opacity-0 group-hover:opacity-100
          transition
          line-clamp-3
        ">
          {prompt}
        </p>

        {/* Button */}
     <button
  onClick={(e) => {
    e.stopPropagation();
    console.log("USE THIS CLICKED", prompt);
    onUse?.(prompt);
  }}
  className="mt-2 w-fit
    bg-gradient-to-tr from-[#7A3BFF] to-[#492399]
    text-white text-xs font-semibold
    px-3 py-1.5 rounded-lg
    opacity-0 group-hover:opacity-100
    transition
  "
>
  Use this
</button>
      </div>
    </div>
  );
};
