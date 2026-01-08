import { Link, NavLink } from "react-router-dom";

import B1 from "../../assets/tools/1.png"
import B2 from "../../assets/tools/2.png"
import B3 from "../../assets/tools/3.png"
import B4 from "../../assets/tools/4.png"



import { ArrowRight, Calendar } from "lucide-react";
ArrowRight

Calendar


export default function tools() {
    return (
        <section>

        <div className="flex justify-center sm:justify-start sm:px-10 py-10 ">
            
         <h1 className="text-[#110829] font-bold text-[25px] cursor-default">Tools</h1>

            </div>  

            <div className="flex flex-col sm:grid sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2  items-center max-w-[2000px]   ">


                        {/* First */}
               
        
        
              <img src={B1} className="object-cover w-[clamp(350px,90vw,600px)] h-[150px] rounded-tr-lg rounded-tl-lg sm:hidden "></img>

               
               <div className="pb-5 sm:px-3 md:px-10">
               <Link className=" block relative bg-[#ECE8F2] w-[clamp(350px,90vw,600px)] sm:w-[clamp(150px,40vw,300px)] md:w-[clamp(250px,40vw,500px)] lg:w-[clamp(700px,70vw,900px)] xl:w-[clamp(250px,39vw,900px)] h-[150px] rounded-bl-lg rounded-br-lg md:rounded-lg  overflow-hidden cursor-pointer "
              to="/workspace/productphoto"
              >

               
               <div className="flex justify-end  sm:justify-center px-3 pt-1 ">
                <div className="bg-white border-[1px] border-[#7A3BFF] py-1 w-[20px] rounded-full flex justify-center items-center  ">
                <ArrowRight className="h-4 w-4 -rotate-45 text-[#110829]"/>
                </div>
               </div> 

               <div className="py-3 pb-3 px-3">
                <h3 className="text-[#110829] font-semibold text-[16px] cursor-default">Product Photos</h3>
                </div>

                <div className="flex flex-row items-center mx-2">
                <Calendar className="h-4 w-4 text-[#4A4A55]"/>    
                <p className="text-[#4A4A55] text-[11px] px-1 cursor-default">Updated: 10/12/20255</p>    
                </div>

                   <div className="absolute inset-0 justify-end  z-20 hidden sm:flex pl-4">
                   <img  src={B1} className="object-cover w-[clamp(100px,16vw,350px)] lg:w-[clamp(300px,40vw,400px)] xl:w-[clamp(100px,16vw,490px)] h-full "></img>
                   </div>

                </Link>

                </div>


                
                        {/* Second */}
                <img src={B2} className="object-cover w-[clamp(350px,90vw,600px)] h-[150px] rounded-tr-lg rounded-tl-lg sm:hidden "></img>

               
               <div className="pb-5 sm:px-3 md:px-10">
               <Link className="block relative bg-[#ECE8F2] w-[clamp(350px,90vw,600px)] sm:w-[clamp(150px,40vw,300px)] md:w-[clamp(250px,40vw,500px)] lg:w-[clamp(700px,70vw,900px)] xl:w-[clamp(250px,39vw,900px)] h-[150px] rounded-bl-lg rounded-br-lg md:rounded-lg  overflow-hidden cursor-pointer "
               to="/workspace/library"
               >

               
               <div className="flex justify-end  sm:justify-center px-3 pt-1 ">
                <div className="bg-white border-[1px] border-[#7A3BFF] py-1 w-[20px] rounded-full flex justify-center items-center  ">
                <ArrowRight className="h-4 w-4 -rotate-45 text-[#110829]"/>
                </div>
               </div> 

               <div className="py-3 pb-3 px-3">
                <h3 className="text-[#110829] font-semibold text-[16px] cursor-default">Background Library</h3>
                </div>

                <div className="flex flex-row items-center mx-2">
                <Calendar className="h-4 w-4 text-[#4A4A55]"/>    
                <p className="text-[#4A4A55] text-[11px] px-1 cursor-default">Updated: 17/12/20255</p>    
                </div>

                   <div className="absolute inset-0 justify-end  z-20 hidden sm:flex pl-4">
                   <img src={B2} className=" object-cover w-[clamp(100px,16vw,350px)] lg:w-[clamp(300px,40vw,400px)] xl:w-[clamp(100px,16vw,490px)] h-full "></img>
                   </div>

                </Link>

                </div>


                
                        {/* Third */}
               
                 <img src={B3} className="object-cover w-[clamp(350px,90vw,600px)] h-[150px] rounded-tr-lg rounded-tl-lg sm:hidden " ></img>

               
               <div className="pb-5 sm:px-3 md:px-10">
               <Link className="block relative bg-[#ECE8F2] w-[clamp(350px,90vw,600px)] sm:w-[clamp(150px,40vw,300px)] md:w-[clamp(250px,40vw,500px)] lg:w-[clamp(700px,70vw,900px)] xl:w-[clamp(250px,39vw,900px)] h-[150px] rounded-bl-lg rounded-br-lg md:rounded-lg  overflow-hidden  cursor-pointer "
               to="/workspace/myproduct"
               >

               
               <div className="flex justify-end  sm:justify-center px-3 pt-1 ">
                <div className="bg-white border-[1px] border-[#7A3BFF] py-1 w-[20px] rounded-full flex justify-center items-center  ">
                <ArrowRight className="h-4 w-4 -rotate-45 text-[#110829]"/>
                </div>
               </div> 

               <div className="py-3 pb-3 px-3">
                <h3 className="text-[#110829] font-semibold text-[16px]">Products</h3>
                </div>

                <div className="flex flex-row items-center mx-2">
                <Calendar className="h-4 w-4 text-[#4A4A55]"/>    
                <p className="text-[#4A4A55] text-[11px] px-1">Updated: 1/12/20255</p>    
                </div>

                   <div className="absolute inset-0 justify-end  z-20 hidden sm:flex pl-4">
                   <img src={B3} className=" object-cover w-[clamp(100px,16vw,350px)] lg:w-[clamp(300px,40vw,400px)] xl:w-[clamp(100px,16vw,490px)] h-full "></img>
                   </div>

                </Link>

                </div>


                
                        {/* Fourth */}
               
                 <img src={B4} className=" object-cover w-[clamp(350px,90vw,600px)] h-[150px] rounded-tr-lg rounded-tl-lg sm:hidden "></img>

               
               <div className="pb-5 sm:px-3 md:px-10">
               <Link className="block relative bg-[#ECE8F2] w-[clamp(350px,90vw,600px)] sm:w-[clamp(150px,40vw,300px)] md:w-[clamp(250px,40vw,500px)] lg:w-[clamp(700px,70vw,900px)] xl:w-[clamp(250px,39vw,900px)] h-[150px] rounded-bl-lg rounded-br-lg md:rounded-lg  overflow-hidden cursor-pointer   "
               to="/workspace/creations"
               >

               
               <div className="flex justify-end  sm:justify-center px-3 pt-1 ">
                <div className="bg-white border-[1px] border-[#7A3BFF] py-1 w-[20px] rounded-full flex justify-center items-center  ">
                <ArrowRight className="h-4 w-4 -rotate-45 text-[#110829]"/>
                </div>
               </div> 

               <div className="py-3 pb-3 px-3">
                <h3 className="text-[#110829] font-semibold text-[16px]">Creations</h3>
                </div>

                <div className="flex flex-row items-center mx-2">
                <Calendar className="h-4 w-4 text-[#4A4A55]"/>    
                <p className="text-[#4A4A55] text-[11px] px-1">Updated: 1/12/20255</p>    
                </div>

                   <div className="absolute inset-0 justify-end  z-20 hidden sm:flex pl-4">
                   <img src={B4} className="object-cover  w-[clamp(100px,16vw,350px)] lg:w-[clamp(300px,40vw,400px)] xl:w-[clamp(100px,16vw,490px)] h-full "></img>
                   </div>

                </Link>

                </div>

                




        

              

              

              
                
                
                </div> 

        </section>
        
    
    );
}