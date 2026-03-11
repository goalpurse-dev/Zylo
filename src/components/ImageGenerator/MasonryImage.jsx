import { supabase } from "../../lib/supabaseClient";

export const MasonryImage = ({ src, prompt, onUse }) => {

  const handlePublish = async (e) => {
    e.stopPropagation();

    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return;

    await supabase.from("public_images").insert({
      user_id: user.user.id,
      image_url: src,
      prompt: prompt
    });
  };

  return (
    <div className="relative mb-3 break-inside-avoid overflow-hidden rounded-xl group cursor-pointer">

      {/* Image */}
      <img
        src={src}
        alt=""
        className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        loading="lazy"
      />

      {/* Watermark */}
      <div className="absolute top-2 left-2 text-[10px] bg-black/50 text-white px-2 py-[2px] rounded">
        Created with Zyvo
      </div>

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

        {/* Buttons */}
        <div className="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 transition">

          {/* Use Prompt */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUse?.(prompt);
            }}
            className="bg-gradient-to-tr from-[#7A3BFF] to-[#492399]
              text-white text-xs font-semibold
              px-3 py-1.5 rounded-lg
            "
          >
            Use
          </button>

          {/* Post to gallery */}
          <button
            onClick={handlePublish}
            className="bg-white/90 text-black text-xs font-semibold px-3 py-1.5 rounded-lg"
          >
            Post
          </button>

        </div>

      </div>
    </div>
  );
};