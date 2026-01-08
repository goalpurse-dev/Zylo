import Product1 from "../../assets/product/product1.jpg";
import Product2 from "../../assets/product/product2.jpg";
import Product6 from "../../assets/product/product6.jpg";

import { Link, NavLink } from "react-router-dom";


export default function ProductPhoto() {
    return (
        <section>
         
         {/* Title */}
         
         <div className="">


         <div className="flex flex-col justify-center  ">
             <h1 className="font-bold text-[#110829] text-xl text-center  mx-8 md:text-xl xl:text-[30px] lg:text-[25px] cursor-default ">
                Turn Any Bad <span className="text-[#7A3BFF] mx-1 cursor-default">Product Picture </span>Into a Stunning, Market-Ready Photo.
                </h1>


             <p className="text-[#4A4A55] font-semibold text-base mt-5 text-center md:text-lg  md:mb-10 mx-8 xl:text-xl cursor-default">
            Transform simple product shots into polished, high-impact visuals. 
            </p>   
         </div>

        {/* Product Photos */}
            <div className="relative h-[300px] w-[270px] mx-auto flex justiify-center mt-20 scale-105  sm:scale-110  
            
            md:scale-125 md:max-h-[400px] md:h-[32vw] md:min-h-[350px] md:max-w-[500px] md:w-[35vw] 
            
            ">

          {/* Left Image */} 
            <img src={Product1} 
            alt="Left" 
            className=" absolute left-[-20px] top-[0px] w-[120px]  aspect-[9/16]  object-cover rounded-xl shadow-lg shadow-gray-400 z-10 -rotate-6 
            hover:-rotate-12 hover:brightness-95 transition backdrop-blur-[1px]
            
              md:w-[clamp(120px,15vw,150px)]
              lg:w-[clamp(150px,15vw,180px)]
              xl:w-[clamp(180px,15vw,200px)]


            "
            />
            
           {/* Middle Image */}
            <img src={Product2} 
            alt="Middle" 
            className=" absolute top-[-7px] rounded-md left-1/2 -translate-x-1/2 w-[120px] aspect-[9/16] object-cover shadow-lg  z-30 
            hover:scale-105 hover:brightness-95 transition backdrop-blur-[1px]
            
            md:w-[clamp(120px,15vw,150px)] 
            lg:w-[clamp(150px,15vw,180px)]
            xl:w-[clamp(180px,15vw,200px)]


            "    
            />
          
          {/* Right Image */}
          <img src={Product6} 
          alt="Right"
           className=" absolute top-[0px] right-[-20px] w-[120px] aspect-[9/16] object-cover rounded-xl shadow-lg shadow-gray-400 z-10 rotate-6 
           hover:rotate-12 hover:brightness-95 transition backdrop-blur-[1px]
           
       
             md:w-[clamp(120px,15vw,150px)]
              lg:w-[clamp(150px,15vw,180px)]
              xl:w-[clamp(180px,15vw,200px)]

           
           "           />
    
            </div>


        {/*Button*/}
        <div className="flex justify-center scale-90 md:mt-10">
             <Link className="shadow-lg  bg-[linear-gradient(90deg,#7A3BFF_0%,#492399_100%)] text-white text-base rounded-lg p-5 px-10 cursor-pointer"
             to="/workspace/productphoto"
             >
      
             Create Product Photos Now
          
            </Link> 
        </div>


        </div>
            
        </section>
    );
}