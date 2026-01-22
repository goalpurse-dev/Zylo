import { Box, Frame, Image, PaintBucket, Pin, Plus } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useEffect, useRef, useState } from "react";

Pin
Plus
Box
Frame
PaintBucket
export default function ToolsPanel({ isActive,  }) {
  return (
    <div className=" h-full w-full bg-[#110829] flex justify-center animate-[panelIn_0.25s_ease-out]">
      <div className="" >

        <div className="mt-1">
          <h1 className="font-semibold text-[#EDE9FF] text-[24px] ">Tools</h1>
        </div>

        <p className="text-[10px] font-bold text-[#4A4A55] mb-1 mt-3">
          Workspace </p>

        <div className="bg-white rounded-2xl  shadow-md">
          <div className="flex justify-between  ">
          <p className=" text-[16px] bg-[#7A3BFF] font-semibold text-white w-full text-center rounded-2xl py-1 shadow-lg">Business</p>
        </div>
        </div>

        {/* White line */}
        <div className=" mt-4">
        <div className="bg-white/30 h-[1px]"></div>  
        </div>

        <div className="flex flex-col  justify-center mt-3 gap-1">
          <div className="flex items-center gap-1">
            <Image className="text-[#EDE9FF] w-4 h-4"></Image>
         <p className="text-[#EDE9FF] font-semibold text-[18px] cursor-default">Product Photos </p>
         </div>

      <div className="px-2 mt-1 gap-2 flex flex-col">
         {/* Smaller ones */}
<NavLink
  to="/workspace/productphoto"
  className={({ isActive }) =>
    `group relative flex items-center gap-2 px-5 py-1 rounded-md cursor-pointer transition-colors duration-150 w-full
     ${isActive ? "bg-white/20" : "hover:bg-white/15 "}`
  }
>
  <span
    className={`
      absolute left-0 top-1/2 -translate-y-1/2
      h-6 w-[3px] rounded-full bg-[#7A3BFF]
      ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}
    `}
  />

  <Plus
    className={`h-4 w-4 transition-colors
      ${isActive ? "text-[#7A3BFF]" : "text-[#d4d4da] "}
    `}
  />

  <span
    className={`text-[17px]
      ${isActive ? "text-white font-semibold " : "text-[#d4d4da]"}
    `}
  >
    Create
  </span>

  <span
    className={`
      ml-auto text-[#d4d4da]
      transition-all duration-150
      ${isActive ? "opacity-100 translate-x-0" : "opacity-0 translate-x-[-4px] group-hover:opacity-100 group-hover:translate-x-0"}
    `}
  >
    →
  </span>
</NavLink>

               {/* Smaller ones */}
<NavLink
  to="/workspace/myproduct"
  className={({ isActive }) =>
    `group relative flex items-center gap-2 px-5 py-1 rounded-md cursor-pointer transition-colors duration-150
     ${isActive ? "bg-white/20" : "hover:bg-white/15"}`
  }
>
  <span
    className={`
      absolute left-0 top-1/2 -translate-y-1/2
      h-6 w-[3px] rounded-full bg-[#7A3BFF]
      ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}
    `}
  />

  <Box
    className={`h-4 w-4 transition-colors
      ${isActive ? "text-[#7A3BFF]" : "text-[#d4d4da] "}
    `}
  />

  <span
    className={`text-[17px]
      ${isActive ? "text-white font-semibold" : "text-[#d4d4da]"}
    `}
  >
    My Products
  </span>
</NavLink>

         {/* Smaller ones */}
              {/* Smaller ones */}
     <NavLink
  to="/workspace/library"
  className={({ isActive }) =>
    `group relative flex items-center gap-2 px-5 py-1 rounded-md cursor-pointer transition-colors duration-150
     ${isActive ? "bg-white/20" : "hover:bg-white/15"}`
  }
>
  <span
    className={`
      absolute left-0 top-1/2 -translate-y-1/2
      h-5 w-[3px] rounded-full bg-[#7A3BFF]
      ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}
    `}
  />

  <PaintBucket
    className={`h-4 w-4 transition-colors
      ${isActive ? "text-[#7A3BFF]" : "text-[#d4d4da]"}
    `}
  />

  <span
    className={`text-[17px]
      ${isActive ? "text-white font-semibold" : "text-[#d4d4da]"}
    `}
  >
    Backgrounds
  </span>
</NavLink>

        </div>
        </div>

 {/* White line */}
        <div className=" mt-4">
        <div className="bg-white/30 h-[1px]"></div>  
        </div>
      
      </div>
    </div>
  );
}
