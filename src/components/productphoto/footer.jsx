import Logo from "./../../assets/Logo.png"
import Instagram from "./../../assets/footer/instagram.png"
import Pinterest from "./../../assets/footer/pinterest.png"
import X from "./../../assets/footer/x.png"
import Youtube from "./../../assets/footer/youtube.png"
import Reddit from "./../../assets/footer/reddit.png"





export default function footer() {
    return (
        
        <section className="">
       
       {/*Mobile*/}
       
       
      <div className="block sm:hidden">

    <div className="bg-[linear-gradient(to_bottom,rgba(236,232,242,0)_20%,#110829_100%)] w-full h-32 mx-auto"></div>
                   
        
     <div className="bg-[#110829] w-full h-[370px] p-2 ">

     
        
        <div className="flex flex-row justify-center gap-8 sm:gap-16 md:gap-24 ">

      

        <div className="flex flex-col gap-3  mt-10 mr-4">
        <h3 className="text-[22px] font-inter font-extrabold  cursor-default ">Zylo</h3>
        <p className="text-[12px] font-normal font-inter sm:whitespace-nowrap cursor-pointer hover:underline ">Product Photos</p> 
        <p className="text-[12px] font-normal font-inter sm:whitespace-nowrap cursor-pointer hover:underline">Own Product</p>
        <p className="text-[12px] font-normal font-inter sm:whitespace-nowrap  cursor-pointer hover:underline">Background Library</p>
        <p className="text-[12px] font-normal font-inter sm:whitespace-nowrap cursor-pointer hover:underline">Creations</p>
        
        </div>

          
          <div className="flex flex-col ">
          
          <div className="flex flex-col gap-1  ">
        <h3 className="text-[22px] font-inter font-extrabold mt-10 w-[110px] cursor-default ">Pricing</h3>
        <p className="text-[12px] font-normal font-inter mt-2 cursor-pointer hover:underline">Plans</p> 
    
         </div>


         <div className="flex flex-col gap-2  ">
        <h3 className="text-[22px] font-inter font-extrabold mt-10 cursor-default">Help </h3>
        <p className="text-[12px] font-normal font-inter mt-2 cursor-pointer hover:underline sm:whitespace-nowrap">Contact Us</p> 
        <p className="text-[12px] font-normal font-inter mt-2 cursor-pointer hover:underline sm:whitespace-nowrap">Support Center</p>
        <p className="text-[12px] font-normal font-inter mt-2 cursor-pointer hover:underline sm:whitespace-nowrap">Blog</p>
        
        </div>

        </div>

        

     </div>

     </div>

        <div className="bg-[#575757] h-[1px] w-full  "></div>

        <div className="bg-[#110829] w-full h-[100px] flex items-center">

         
         
         
    <div className="flex gap-2 ml-4 w-[150px] ">
         <img src={Instagram} className="h-3 w-3 "/>
         <img src={X} className="h-3 w-3 "/>   
         <img src={Youtube} className="h-3 w-3 "/>   
         <img src={Pinterest} className="h-3 w-3 "/>
         <img src={Reddit} className="h-3 w-3 "/>   
          </div>
         

        <div className="flex flex-1 justify-center gap-4 sm:whitespace-nowrap ml-14 ">
           <p className=" text-[12px] cursor-pointer hover:underline text-[#868687]">Privacy Policy</p>
           <p className=" text-[12px] cursor-pointer hover:underline text-[#868687]">Terms & Conditions</p></div>

         
             
      </div>


      </div>



       {/*SM AND HIGHER*/}

     <div className="sm:block hidden">
     
      <div className="bg-[linear-gradient(to_bottom,rgba(17,8,41,0)_20%,#110829_100%)] w-full h-20 mx-auto lg:h-28 ">   </div>
        
     <div className="bg-[#110829] w-full h-[370px]  lg:h-[400px] p-2 ">

        
        
        <div className="flex flex-row justify-center gap-40 sm:gap-20 sm:mt-10 md:mt-12 lg:mt-14">

      

        <div className="flex flex-col gap-3  ">
        <h3 className="text-xl font-inter font-extrabold mt-10 cursor-default ">Zylo</h3>
        <p className="text-sm font-normal font-inter mt-2 cursor-pointer hover:underline ">Product Photos</p> 
        <p className="text-sm font-normal font-inter mt-2 cursor-pointer hover:underline">Own Product</p>
        <p className="text-smn font-normal font-inter mt-2 cursor-pointer hover:underline">Background Library</p>
        <p className="text-sm font-normal font-inter mt-2 cursor-pointer hover:underline">Creations</p>
        
        </div>

          <div className="flex flex-col gap-3  ">
        <h3 className="text-xl font-inter font-extrabold mt-10 w-[110px] cursor-default ">Pricing</h3>
        <p className="text-sm font-normal font-inter mt-2 cursor-pointer hover:underline">Plans</p> 
    
         </div>


         <div className="flex flex-col gap-3 ">
        <h3 className="text-xl font-inter font-extrabold mt-10 cursor-default">Help </h3>
        <p className="text-sm font-normal font-inter mt-2 cursor-pointer hover:underline">Contact Us</p> 
        <p className="text-sm font-normal font-inter mt-2 cursor-pointer hover:underline">Support Center</p>
        <p className="text-smn font-normal font-inter mt-2 cursor-pointer hover:underline">Blog</p>
        
        </div>

        

     </div>

     </div>

        <div className="bg-[#575757] h-[1px] w-full  "></div>

        <div className="bg-[#110829] w-full h-[100px] flex items-center">

         
         
         
    <div className="flex gap-3 ml-6 w-[150px]">
         <img src={Instagram} className="h-4 w-4 md:h-5 md:w-5"/>
         <img src={X} className="h-4 w-4 md:h-5 md:w-5 "/>   
         <img src={Youtube} className="h-4 w-4 md:h-5 md:w-5 "/>   
         <img src={Pinterest} className="h-4 w-4 md:h-5 md:w-5"/>
         <img src={Reddit} className="h-4 w-4 md:h-5 md:w-5"/>   
          </div>
         

        <div className="flex flex-1 justify-center gap-4">
           <p className=" text-sm md:text-base cursor-pointer hover:underline text-[#868687]">Privacy Policy</p>
           <p className=" text-sm md:text-base cursor-pointer hover:underline text-[#868687]">Terms & Conditions</p></div>


           <div className="w-[150px]"></div>
             
      </div>

      </div>


        </section>
        
    
    );
}