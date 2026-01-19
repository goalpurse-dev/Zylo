import { Link } from "react-router-dom";
import { ArrowRight, Calendar } from "lucide-react";

import B1 from "../../assets/tools/1.png";
import B2 from "../../assets/tools/2.png";
import B3 from "../../assets/tools/3.png";
import B4 from "../../assets/tools/4.png";

const TOOLS = [
  {
    title: "Product Photos",
    image: B1,
    to: "/workspace/productphoto",
    updated: "10/12/2025",
  },
  {
    title: "Background Library",
    image: B2,
    to: "/workspace/library",
    updated: "17/12/2025",
  },
  {
    title: "Products",
    image: B3,
    to: "/workspace/myproduct",
    updated: "1/12/2025",
  },
  {
    title: "Creations",
    image: B4,
    to: "/workspace/creations",
    updated: "1/12/2025",
  },
];

export default function Tools() {
  return (
    <section className="w-full overflow-x-hidden">
      
      {/* Header */}
      <div className="px-6 sm:px-10 py-10">
        <h1 className="text-[#110829] font-bold text-[25px]">Tools</h1>
      </div>

      {/* Grid */}
      <div className="mx-auto max-w-[1100px] px-4 sm:px-10 grid grid-cols-1 xl:grid-cols-2 gap-6">
        {TOOLS.map((tool) => (
          <Link
            key={tool.title}
            to={tool.to}
            className="
              group
              relative
              flex
              h-[150px]
              overflow-hidden
              rounded-lg
              bg-[#ECE8F2]
              transition
              hover:shadow-md
            "
          >
            {/* Left content */}
            <div className="flex flex-col justify-between p-4 z-10">
              <div className="flex">
                <div className="bg-white border border-[#7A3BFF] h-6 w-6 rounded-full flex items-center justify-center">
                  <ArrowRight className="h-4 w-4 -rotate-45 text-[#110829]" />
                </div>
              </div>

              <div>
                <h3 className="text-[#110829] font-semibold text-[16px] whitespace-nowrap">
                  {tool.title}
                </h3>

                <div className="flex items-center mt-2 text-[#4A4A55] text-[11px]">
                  <Calendar className="h-4 w-4 mr-1" />
                  Updated: {tool.updated}
                </div>
              </div>
            </div>

            {/* Right image */}
            <img
              src={tool.image}
              alt={tool.title}
              className="
                absolute
                right-0
                top-0
                h-full
                w-[40%]
                object-cover
                transition-transform
                group-hover:scale-105
              "
            />
          </Link>
        ))}
      </div>
    </section>
  );
}
