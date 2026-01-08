import I1 from "../../assets/soon/1.png"
import I2 from "../../assets/soon/2.png"
import I3 from "../../assets/soon/3.png"

import { Link, NavLink } from "react-router-dom";

export default function soon() {
    return (
        <section className="hidden md:block">

        <div className="py-8 px-6 ">
        <h1 className="font-semibold text-[#110829] text-[30px] cursor-default">What's coming in the future</h1>    
        </div>

        <div className="grid grid-cols-3 place-items-center max-w-5xl">

            {/*First */}
         <div className="h-[350px] w-[240px] bg-white border-[1px] border-[#4A4A55]">
          <img 
          src={I1}
          className="w-full"
          /> 
       <div className="flex flex-col px-4 py-3">
        <h2 className="text-[#110829] text-lg font-semibold py-1 cursor-default">Text to Image</h2>
        <p className="text-[#4A4A55] text-[14px] cursor-default">Precision-driven image generation with real creative control. We’re refining every pixel.</p>
       </div>

         </div>
         

         {/*Second */}

                 <div className="h-[350px] w-[240px] bg-white border-[1px] border-[#4A4A55]">
          <img 
          src={I2}
          className="w-full"
          /> 
       <div className="flex flex-col px-4 py-3">
        <h2 className="text-[#110829] text-lg font-semibold py-1 cursor-default">Text to Video</h2>
        <p className="text-[#4A4A55] text-[14px] cursor-default ">Cinematic motion, cleaner transitions, and consistent scenes. Built for real content creators. </p>
       </div>

         </div>


         {/*Third */}

              <div className="h-[350px] w-[240px] bg-white border-[1px] border-[#4A4A55]">
          <img 
          src={I3}
          className="w-full"
          /> 
       <div className="flex flex-col px-4 py-3">
        <h2 className="text-[#110829] text-lg font-semibold py-1 cursor-default">3D Product Video</h2>
        <p className="text-[#4A4A55] text-[14px] cursor-default">Studio-quality 3D product visuals from text. Real depth. Real presence. </p>
       </div>

         </div>


        </div>

        </section>
        
    
    );
}