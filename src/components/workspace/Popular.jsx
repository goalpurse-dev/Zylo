import { useEffect } from "react";
import Image from "../../assets/tools/image-gen.png"
import Image1 from "../../assets/tools/image-gen1.png"
import Productphoto from "../../assets/tools/productphoto.png"
import Productphoto1 from "../../assets/tools/productphoto1.png"
import Background from "../../assets/tools/background.png"
import Background1 from "../../assets/tools/background1.png"
import Blog from "../../assets/tools/blog.png"
import Blog1 from "../../assets/tools/blog2.png"


function PopularCard({ title, image, hoverImage }) {
  return (
    <div
      className="
        group
        relative
        rounded-xl
        overflow-hidden
        aspect-[16/9]
        md:aspect-[1/1]
        flex
        items-center
        justify-center
        md:items-start
        md:justify-start
        cursor-pointer
        max-w-[350px] max-h-[350px] ¨
        shadow-lg
      "
    >
      {/* DEFAULT IMAGE */}
      <img
        src={image}
        alt={title}
        className="
          absolute inset-0
          w-full h-full object-cover
          transition-opacity duration-300
          group-hover:opacity-0
        "
      />

      {/* HOVER IMAGE */}
      <img
        src={hoverImage}
        alt={`${title} hover`}
        className="
          absolute inset-0
          w-full h-full object-cover
          opacity-0
          transition-opacity duration-300
          group-hover:opacity-100
        "
      />
<div
  className=" block md:hidden
    absolute  bottom-0 left-0 right-0
    p-10 md:p-5
    bg-gradient-to-t from-black/50 via-black/30 to-transparent
    transition-all duration-300
    group-hover:pb-1
  "
></div>

<div
  className=" hidden md:block
    absolute  top-0 left-0 right-0
    p-10 md:p-5
    bg-gradient-to-b from-black/50 via-black/20 to-transparent
    transition-all duration-300
    group-hover:pb-1
  "
></div>
      {/* TITLE */}
      <p
        className="
          absolute
          left-1/2 -translate-x-1/2

          bottom-[6%]
          text-[clamp(12px,3vw,20px)]
          whitespace-nowrap
          backdrop-blur-sm p-1 

          md:left-4 md:translate-x-0
          md:top-1 md:bottom-auto
          md:text-[16px]
        md:backdrop-blur-sm md:p-1
          text-white 
          font-semibold
          pointer-events-none
        "
      >
        {title}
      </p>

      {/* BUTTON (md+) */}
      <button
        className="
          hidden md:flex
          absolute bottom-4 left-6 right-6
          mx-auto max-w-[300px]

          items-center justify-center
          backdrop-blur-md
          bg-gradient-to-r from-[#7A3BFF] to-[#7A3BFF]/60

          text-white font-semibold
          text-sm md:text-[15px] lg:text-[16px] xl:text-[17px]
          py-2 md:py-2.5 lg:py-3
          rounded-md

          transition-all duration-200
          hover:opacity-90
        "
      >
        Try now
      </button>
      <div/>
      <div/>

    </div>
  );
}

export default function Popular() {
  useEffect(() => {}, []);

  return (
    <section className="w-full px-4">
      <h1 className="font-semibold text-[#110829] text-[26px]">
        Popular 
      </h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-4 max-w-[1500px] ">
        <PopularCard
          title="Image Generator"
          image={Image}
          hoverImage={Image1}
        />

        <PopularCard
          title="Product Photos"
          image={Productphoto}
          hoverImage={Productphoto1}
        />

        <PopularCard
          title="Background Library"
          image={Background}
          hoverImage={Background1}
        />

        <PopularCard
          title="Blogs"
          image={Blog}
          hoverImage={Blog1}
        />
      </div>
    </section>
  );
}
