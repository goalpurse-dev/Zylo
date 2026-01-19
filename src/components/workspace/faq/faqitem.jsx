import { useState } from "react";
import Arrow from "../../../assets/home/arrow.png";

export default function FaqItem({ question, answer }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      onClick={() => setOpen(!open)}
      className="bg-[#ECE8F2] rounded-md w-full max-w-[450px] lg:max-w-[700px] mx-auto
                 px-6 py-8 cursor-pointer transition-all duration-200 "
    >
      {/* Top Row */}
      <div className="flex justify-between items-center">
        <p className="text-[#110829] text-[12px] md:text-[14px] lg:text-[16px] font-semibold whitespace-nowrap">
          {question}
        </p>

        <img
          src={Arrow}
          className={`h-3 w-3 transition-transform duration-300 
                      ${open ? "-rotate-180" : "-rotate-90"}`}
        />
      </div>

      {/* Opened content */}
      <div
        className={`overflow-hidden transition-all duration-300 
                   ${open ? "max-h-[200px] mt-4" : "max-h-0"}`}
      >
        <p className="text-[#4A4A55] text-[12px] md:text-[14px] lg:text-[15px] leading-relaxed">
          {answer}
        </p>
      </div>
    </div>
  );
}
