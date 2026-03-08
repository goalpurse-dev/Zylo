import React from "react";

const images = [
  "/assets/showcase/image5.webp",
  "/assets/showcase/image4.webp",
  "/assets/showcase/image2.webp",
  "/assets/showcase/image3.webp",
  "/assets/showcase/image6.webp",
];

export default function ZyvoShowcase() {
  return (
    <section className="w-full bg-[#F7F5FA] py-24 px-6 overflow-hidden">
      <div className="max-w-6xl mx-auto text-center">

       

        <div className="flex justify-center items-end gap-6">

          {images.map((src, index) => {
            const middle = Math.floor(images.length / 2);
            const distance = Math.abs(index - middle);

            return (
              <div
                key={index}
                className={`
                  relative transition-all duration-500
                  ${
                    distance === 0
                      ? "scale-100 translate-y-0 z-30"
                      : distance === 1
                      ? "scale-95 translate-y-5 z-20"
                      : "scale-90 translate-y-10 z-10"
                  }
                  hover:scale-105 hover:-translate-y-3
                `}
              >
                <div className="w-[160px] md:w-[180px] aspect-[9/16] rounded-2xl overflow-hidden shadow-lg shadow-black/10">
                  <img
                    src={src}
                    alt="Zyvo create"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            );
          })}

        </div>

      </div>
    </section>
  );
}