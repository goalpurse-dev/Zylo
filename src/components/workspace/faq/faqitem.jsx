import { useState } from "react";
import Arrow from "../../../assets/home/arrow.png";
import { ChevronRight } from "lucide-react";
ChevronRight
export default function FaqItem({ question, answer }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      onClick={() => setOpen(!open)}
      className="bg-[#141622] rounded-md w-full max-w-[450px] lg:max-w-[700px] mx-auto border border-[#1F2230]
                 px-6 py-8 cursor-pointer transition-all duration-200 hover:bg-[#1A1D2B] "
    >
      {/* Top Row */}
      <div className="flex justify-between items-center">
        <p className="text-[#F4F6FB] text-[12px] md:text-[14px] lg:text-[16px] font-semibold whitespace-nowrap">
          {question}
        </p>

        <ChevronRight
        
          className={`h-4 w-4 transition-transform duration-300  text-white
                      ${open ? "rotate-90" : "rotate-0"}`}
        />
      </div>

      {/* Opened content */}
      <div
        className={`overflow-hidden transition-all duration-300 
                   ${open ? "max-h-[200px] mt-4" : "max-h-0"}`}
      >
        <p className="text-[#B7BBC6] text-[12px] md:text-[14px] lg:text-[15px] leading-relaxed">
          {answer}
        </p>
      </div>
    </div>
  );
}
