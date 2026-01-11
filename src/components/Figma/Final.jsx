 import Lighting from "../../assets/symbols/lighting.png"
 import Viral from "../../assets/symbols/Viral.png"
 import Consistent from "../../assets/symbols/consistent.png"
 import Bg from "../../assets/symbols/bg.mp4"

import { Link, NavLink } from "react-router-dom";

 
 export default function proof() {
    return (
        <section className="w-full bg-[#ECE8F2] h-[450px]  md:h-[550px] lg:h-[750px] xl:h-[850px]">
            
         <div className="w-[clump(200px,40vw,400px)] bg-[linear-gradient(90deg,#7A3BFF_0%,#492399_100%)] h-2 rounded-md"></div>  

         <div className="bg-[#F7F5FA] w-[clump(200px,40vw,400px)] h-[430px] sm:h-[440px] md:h-[470px] lg:h-[650px] xl:h-[760px]">

        <div className="flex justify-center py-5">
        <h1 className="text-[#110829] font-semibold text-[20px] md:text-[25px] lg:text-[35px] xl:text-[40px] cursor-default">Why Creators Switch to <span className="font-bold text-[#7A3BFF]">Zyvo?</span></h1>
        </div>  


            <div className="flex flex-row justify-center py-5 gap-10 lg:mt-6 xl:mt-10">

                {/*Left*/}

             <div className=" bg-[#ECE8F2] w-[170px] h-[230px] sm:w-[180px] sm:h-[240px] md:w-[200px] md:h-[260px] lg:w-[250px] lg:h-[360px] xl:w-[300px] xl:h-[400px]  rounded-xl shadow-lg">
              <h2 className="-rotate-1 text-[#4A4A55] p-3 text-[12px] md:text-[13px] lg:text-[15px] xl:text-[17px] font-semibold cursor-default xl:mt-2 " >Reason <span className="rounded-full font-normal  h-6 px-2 bg-[#110829] text-white ">1</span></h2>

              <div className="">
              <h3 className="flex items-center  text-[#110829] font-semibold p-3 text-[13px] sm:text-[15px] md:text-[17px] lg:text-[19px] xl:text-[21px] cursor-default">
              <img src={Lighting} className="h-5 w-5 "/> 
              Built for Speed 
              </h3> 


              <p className="text-[#4A4A55] font-semibold text-[10px] md:text-[14px] lg:text-[16px] sm:text-[12px] xl:text-[18px] px-5 xl:mt-3 cursor-default ">Create ads and visuals 10× faster with zero editing.</p>
             </div> 

             </div>

             
                {/*Middle*/}
             
              <div className="  bg-[#ECE8F2] w-[170px] h-[230px] sm:w-[180px] sm:h-[240px] md:w-[200px] md:h-[260px] lg:w-[250px] lg:h-[360px] xl:w-[300px] xl:h-[400px] rounded-lg shadow-lg z-20">
              <h2 className=" text-[#4A4A55] p-3 text-[12px] md:text-[13px] font-semibold cursor-default lg:text-[15px] xl:text-[17px] xl:mt-2" >Reason <span className="rounded-full font-normal  h-6 px-2 bg-[#110829] text-white ">2</span></h2>

              <div className="flex flex-row items-center">
                <img src={Viral} className="h-5 w-5  ml-2 lg:ml-4"/> 
              <h3 className="flex items-center  text-[#110829] font-semibold py-3 px-1 text-[13px] sm:text-[15px] md:text-[17px] lg:text-[19px] xl:text-[21px] cursor-default ">
                 Built for Virality
                </h3> 
              
             
              
                </div> 

              <p className="text-[#4A4A55] font-semibold text-[10px] sm:text-[12px] md:text-[14px] lg:text-[16px] xl:text-[18px] px-5 cursor-default">Zyvo tools use visuals optimized to go viral on Social Media</p>
             

             </div>

                    {/*Right*/}

              <div className=" bg-[#ECE8F2] w-[170px] h-[230px] sm:w-[180px] sm:h-[240px] md:w-[200px] md:h-[260px] lg:w-[250px] lg:h-[360px] xl:w-[300px] xl:h-[400px]  rounded-xl shadow-lg">
              <h2 className="rotate-1 text-[#4A4A55] p-3 text-[12px] md:text-[13px] lg:text-[15px] xl:text-[17px] font-semibold cursor-default xl:mt-2 " >Reason <span className="rounded-full font-normal  h-6 px-2 bg-[#110829] text-white ">3</span></h2>

              <div className="flex flex-row items-center">
                 <img src={Consistent} className="h-5 w-5 ml-2 lg:ml-4 "/> 
              <h3 className="flex items-center  text-[#110829] font-semibold py-3 px-1 text-[13px] sm:text-[15px] md:text-[17px] lg:text-[19px] xl:text-[21px] cursor-default  ">
             
              Built for Consistency
              </h3> 
              </div> 

              <p className="flex justify-center text-[#4A4A55] font-semibold text-[10px] sm:text-[12px] md:text-[14px] lg:text-[16px] xl:text-[18px] px-5  cursor-default">Your brand colors, style, visuals — perfectly matched every time.</p>
             

             </div>

            


            </div>

          <div className="flex justify-center mt-6 xl:mt-12">
  <Link
    className="
      relative overflow-hidden
      px-4 sm:px-6 md:px-10 lg:px-14 xl:px-16
      py-3 lg:py-4
      rounded-lg
      text-white
      text-[10px] sm:text-[13px] md:text-[15px] lg:text-[17px] xl:text-[19px]
      shadow-lg
      cursor-pointer
    "
    to="/workspace"
  >
    {/* VIDEO BACKGROUND */}
    <video
      src={Bg}
      autoPlay
      muted
      loop
      playsInline
      className="absolute inset-0 w-full h-full object-cover"
    />

    {/* OVERLAY (darken / gradient) */}
    <div className="absolute inset-0 bg-[#7A3BFF] opacity-80" />

    {/* BUTTON TEXT */}
    <span className="relative z-10 font-semibold">
      Brand Workspace
    </span>
  </Link>
</div>

         </div>

          <div className="w-[clump(200px,50vw,400px)] bg-[linear-gradient(90deg,#7A3BFF_0%,#492399_100%)] rounded-md h-2">
           
            
            </div>  


        </section>
        
    
    );
}