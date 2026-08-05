import { useEffect } from "react";
import Image from "../../assets/tools/image-gen.png"
import Image1 from "../../assets/tools/image-gen1.png"
import Productphoto from "../../assets/tools/productphoto.png"
import Productphoto1 from "../../assets/tools/productphoto1.png"
import Background from "../../assets/tools/background.png"
import Background1 from "../../assets/tools/background1.png"
import Blog from "../../assets/tools/blog.png"
import Blog1 from "../../assets/tools/blog2.png"
import { Link, NavLink } from "react-router-dom";

function PopularCard({ title, image, hoverImage, to }) {
  return (
    <Link
  to={to}
  className="
    group
    relative
    w-full
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
    max-w-[350px]
    shadow-lg
    justify-self-center
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

      {/* MOBILE GRADIENT */}
      <div
        className="
          block md:hidden
          absolute bottom-0 left-0 right-0
          p-10
          bg-gradient-to-t from-black/50 via-black/30 to-transparent
        "
      />

      {/* DESKTOP GRADIENT */}
      <div
        className="
          hidden md:block
          absolute top-0 left-0 right-0
          p-5
          bg-gradient-to-b from-black/50 via-black/20 to-transparent
        "
      />

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
          text-white
          font-semibold
          pointer-events-none
        "
      >
        {title}
      </p>

      {/* BUTTON (md+) */}
      <div
        className="
          hidden md:flex
          absolute bottom-4 left-6 right-6
          mx-auto max-w-[300px]
          items-center justify-center
          backdrop-blur-md
          bg-gradient-to-r from-[#7A3BFF] to-[#7A3BFF]/60
          text-white font-semibold
          text-sm md:text-[15px] lg:text-[16px]
          py-2 md:py-2.5 lg:py-3
          rounded-md
          transition-all duration-200
          group-hover:opacity-90
        "
      >
        Try now
      </div>
    </Link>
  );
}


export default function Popular() {
  useEffect(() => {}, []);

  return (
    <section className="w-full text-center px-4">
      <h1 className="font-semibold text-[#110829] text-[26px]">
        Popular 
      </h1>


    <div className="mx-auto max-w-[1500px] mt-4">
      <div className="grid grid-cols-2 md:grid-cols-4  gap-6 mt-4  mx-auto">
  <PopularCard
    title="Image Generator"
    image="/assets/tools/image-gen.webp"
    hoverImage="/assets/tools/image-gen1.webp"
    to="/image-generator"
  />

  <PopularCard
    title="Product Photos"
    image="/assets/tools/productphoto.webp"
    hoverImage="/assets/tools/productphoto1.webp"
    to="/workspace/image-generator"
  />

  <PopularCard
    title="Background Library"
    image="/assets/tools/background.webp"
    hoverImage="/assets/tools/background1.webp"
    to="/workspace/library"
  />

  <PopularCard
    title="Blogs"
    image="/assets/tools/blog.webp"
    hoverImage="/assets/tools/blog2.webp"
    to="/blog"
  />
</div>
    </div>

    </section>
  );
}
