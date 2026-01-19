import { useState } from "react";
import { Link, NavLink } from "react-router-dom";

import { AuthProvider, useAuth } from "../../context/AuthContext";
import { useProfileCredits } from "../../hooks/useProfileCredits";


import Logo from "../../assets/Logo.png"

import { XMarkIcon } from "@heroicons/react/24/solid";


import Gallery from "./../../assets/toolshell/gallery.png"
import Home from "../../assets/toolshell/home.png"
import Product from "../../assets/toolshell/product.png"
import Creations from "../../assets/toolshell/creations.png"
import Out from "../../assets/toolshell/out.png"
import Settings from "../../assets/toolshell/settings.png"
import Shut from "../../assets/toolshell/shut.png"
import Credit from "../../assets/toolshell/credit.png"
import Help from "../../assets/toolshell/help.png"
import Add from "../../assets/toolshell/add.png"
import Credit1 from "../../assets/toolshell/credit1.png"



import { CreativeCommonsIcon } from "lucide-react"




export default function ToolShell({ activePage, setActivePage, onClose }) {

  const { user } = useAuth();
  const homePath = user ? "/workspace" : "/home";


  const credits = useProfileCredits();
const formattedCredits = Intl.NumberFormat().format(credits);



    return (
        <section>
          <div className="bg-white w-full h-screen md:hidden flex flex-col overflow-hidden ">

            
           {/*Start */}
         
            <div className="flex justify-between items-center">

          <div className="flex flex-row items-center py-10">
           <p className="text-[#7A3BFF] font-bold text-[20px] px-3 pl-8 cursor-default">ZyvoAI</p> 
           <img src={Logo} className="h-10 w-10"/>
             </div>


            <div className="flex justify-end px-4">
           <XMarkIcon
           onClick={onClose}
           className="h-6 w-6 text-[#110829]" />

            </div>

            </div> 



                {/* Tools */}

                        <div
  className="
    flex-1
    min-h-0
    overflow-y-auto
    overflow-x-hidden
    pb-32
    scrollbar-thin
    scrollbar-thumb-gray-400
    scrollbar-track-transparent
      border-r border-[#ECE8F2]
  "
>
      <div className="gap-4 flex flex-col">

   
             
 <NavLink
 to={homePath}
  onClick={() => {
    setActivePage("Home");
    onClose?.(); // closes sidebar on mobile
  }}
  className={`flex items-center px-8 cursor-pointer
    ${activePage === "Home" ? "bg-[#7A3BFF]/20 py-2 rounded-lg" : ""}
  `}
 
>

  <img src={Product} className="h-6 w-6" />
  <p className="text-[#110829] px-3 text-[20px]">Home</p>
  
</NavLink>  

              

<NavLink
  to="/workspace/myproduct"
  onClick={onClose}
  className={({ isActive }) =>
    `flex items-center px-8 py-2 rounded-lg cursor-pointer
     ${isActive ? "bg-[#7A3BFF]/20" : ""}`
  }
>
  <img src={Add} className="h-6 w-6" />
  <p className="text-[#110829] px-3 text-[20px]">Product</p>
</NavLink>


              
<NavLink
  to="/workspace/productphoto"
  onClick={onClose}
  className={({ isActive }) =>
    `flex items-center px-8 py-2 rounded-lg cursor-pointer
     ${isActive ? "bg-[#7A3BFF]/20" : ""}`
  }
>
  <img src={Product} className="h-6 w-6" />
  <p className="text-[#110829] px-3 text-[20px]">Product Photos</p>
</NavLink>
 

<NavLink
  to="/workspace/library"
  onClick={onClose}
  className={({ isActive }) =>
    `flex items-center px-8 py-2 rounded-lg cursor-pointer
     ${isActive ? "bg-[#7A3BFF]/20" : ""}`
  }
>
  <img src={Gallery} className="h-6 w-6" />
  <p className="text-[#110829] px-3 text-[20px]">Bg Library</p>
</NavLink>

   

<NavLink
  to="/workspace/creations"
  onClick={onClose}
  className={({ isActive }) =>
    `flex items-center px-8 py-2 rounded-lg cursor-pointer
     ${isActive ? "bg-[#7A3BFF]/20" : ""}`
  }
>
  <img src={Creations} className="h-6 w-6" />
  <p className="text-[#110829] px-3 text-[20px]">Creations</p>
</NavLink>
   
       </div>      
           

            <div>
            <div className="bg-[#ECE8F2] w-full py-[1px] mt-20">
     
            </div>

            </div>

             <div className="flex flex-col gap-8 mt-10">
       <Link
  to="/workspace/pricing"
  className="flex px-8 flex-row items-center gap-2 hover:opacity-80 transition"
  title="View / buy credits"
>
  <div className="bg-[#ECE8F2] rounded-lg h-10 w-10">
    <div className="flex justify-center items-center h-10">
      <img src={Credit} className="h-6 w-6" />
    </div>
  </div>

  <p className="text-[#110829] font-semibold text-[16px]">
    {formattedCredits}
  </p>
</Link>

              <div className="flex flex-row items-center px-8 ">
              <img src={Help} className="h-6 w-6 "/>
              <p className="text-[#110829] hover:text-[#4A4A55] px-3 text-[20px] cursor-pointer ">Help</p>  
                </div>  

              <NavLink
  to="/workspace/pricing"
  end
  onClick={onClose}
  className={({ isActive }) =>
    `flex items-center px-8 py-2 rounded-lg cursor-pointer
     ${isActive ? "bg-[#7A3BFF]/20" : ""}`
  }
>
  <img src={Credit1} className="h-6 w-6" />
  <p className="text-[#110829] px-3 text-[20px]">
    Pricing
  </p>
</NavLink>
                
               
                  <div className="flex flex-row items-center px-8">
              <img src={Settings} className="h-6 w-6 "/>
              <p className="text-[#110829] hover:text-[#4A4A55] px-3 text-[20px] cursor-pointer ">Settings</p>  
                </div>
           

               </div> 

               </div>   
               
           
            </div> 





            {/*md*/}
         

          <div className="bg-white w-[250px] h-screen hidden md:flex lg:hidden flex-col overflow-hidden">


            
           {/*Start */}
         
            <div className="flex justify-between items-center">

          <div className="flex flex-row items-center py-10">
           <p className="text-[#7A3BFF] font-bold text-[20px] px-3 pl-8">ZyvoAI</p> 
           <img src={Logo} className="h-10 w-10"/>
             </div>


            <div className="flex justify-end px-4">
              
           <XMarkIcon 
           onClick={onClose}
           className="h-5 w-5 text-[#110829]" />

            </div>

            </div> 
                  <div
  className="
    flex-1
    min-h-0
    overflow-y-auto
    overflow-x-hidden
    scrollbar-thin
    scrollbar-thumb-gray-400
    scrollbar-track-transparent
    pb-24
      border-r border-[#ECE8F2]
  "
>

            <div className="flex flex-col gap-8 ">

                {/* Tools */}
       
             
<NavLink
  to={homePath}
  end
  onClick={onClose}
  className={({ isActive }) =>
    `flex items-center px-8 py-2 rounded-lg cursor-pointer
     ${isActive ? "bg-[#7A3BFF]/20" : ""}`
  }
>
  <img src={Home} className="h-6 w-6" />
  <p className="text-[#110829] px-3 text-[20px]">Home</p>
</NavLink>


<NavLink
  to="/workspace/myproduct"
  onClick={onClose}
  className={({ isActive }) =>
    `flex items-center px-8 py-2 rounded-lg cursor-pointer
     ${isActive ? "bg-[#7A3BFF]/20" : ""}`
  }
>
  <img src={Add} className="h-6 w-6" />
  <p className="text-[#110829] px-3 text-[20px]">Product</p>
</NavLink>


<NavLink
  to="/workspace/productphoto"
  onClick={onClose}
  className={({ isActive }) =>
    `flex items-center px-8 py-2 rounded-lg cursor-pointer
     ${isActive ? "bg-[#7A3BFF]/20" : ""}`
  }
>
  <img src={Product} className="h-6 w-6" />
  <p className="text-[#110829] px-3 text-[20px]">Product Photos</p>
</NavLink>


<NavLink
  to="/workspace/library"
  onClick={onClose}
  className={({ isActive }) =>
    `flex items-center px-8 py-2 rounded-lg cursor-pointer
     ${isActive ? "bg-[#7A3BFF]/20" : ""}`
  }
>
  <img src={Gallery} className="h-6 w-6" />
  <p className="text-[#110829] px-3 text-[20px]">Bg Library</p>
</NavLink>

 

<NavLink
  to="/workspace/creations"
  onClick={onClose}
  className={({ isActive }) =>
    `flex items-center px-8 py-2 rounded-lg cursor-pointer
     ${isActive ? "bg-[#7A3BFF]/20" : ""}`
  }
>
  <img src={Creations} className="h-6 w-6" />
  <p className="text-[#110829] px-3 text-[20px]">Creations</p>
</NavLink>

           
            </div>

            <div>
            <div className="bg-[#ECE8F2] w-full py-[1px] mt-20">
     
            </div>

            </div>

             <div className="flex flex-col gap-8 mt-10">

<Link
  to="/workspace/pricing"

  className="flex px-8 flex-row items-center gap-2 hover:opacity-80 transition"
  title="View / buy credits"
>
  <div className="bg-[#ECE8F2] rounded-lg h-10 w-10">
    <div className="flex justify-center items-center h-10">
      <img src={Credit} className="h-6 w-6" />
    </div>
  </div>

  <p className="text-[#110829] font-semibold text-[16px]">
    {formattedCredits}
  </p>
</Link>

              <div className="flex flex-row items-center px-8 ">
              <img src={Help} className="h-6 w-6 "/>
              <p className="text-[#110829] hover:text-[#4A4A55] px-3 text-[20px] cursor-pointer ">Help</p>  
                </div>  
                
               <NavLink
  to="/workspace/pricing"
  end
  onClick={onClose}
  className={({ isActive }) =>
    `flex items-center px-8 py-2 rounded-lg cursor-pointer
     ${isActive ? "bg-[#7A3BFF]/20" : ""}`
  }
>
  <img src={Credit1} className="h-6 w-6" />
  <p className="text-[#110829] px-3 text-[20px]">
    Pricing
  </p>
</NavLink>
               
                  <Link className="flex flex-row items-center px-8"
                  to="/settings"
                  >

                    

              <img src={Settings} className="h-6 w-6 "/>
              <p className="text-[#110829] hover:text-[#4A4A55] px-3 text-[20px] cursor-pointer  ">Settings</p>  
                </Link>
           

               </div>   
           </div>
            </div> 



            {/* Lg and higher */}


            
          <div className="bg-white w-[clamp(250px,20vw,400px)] h-screen hidden md:hidden lg:flex sticky top-0 self-start  flex-col overflow-hidden">




            
           {/*Start */}
         
            <div className="flex justify-between items-center">

          <div className="flex flex-row items-center py-10">
           <p className="text-[#7A3BFF]  font-bold text-[20px] px-3 pl-8">ZyvoAI</p> 
           <img src={Logo} className="h-10 w-10"/>
             </div>


            <div className="flex justify-end px-4">
        

            </div>

            </div> 
                              <div
  className="
    flex-1
    min-h-0
    overflow-y-auto
    overflow-x-hidden
    scrollbar-thin
    scrollbar-thumb-gray-400
    scrollbar-track-transparent
    pb-24
    border-r border-[#ECE8F2]


  "
>

            <div className="flex flex-col gap-8 ">
              

                {/* Tools */}
           

             
<NavLink
  to={homePath}
  end
  onClick={onClose}
  className={({ isActive }) =>
    `flex items-center px-8 py-2 rounded-lg cursor-pointer
     ${isActive ? "bg-[#7A3BFF]/20" : ""}`
  }
>
  <img src={Home} className="h-6 w-6" />
  <p className="text-[#110829] px-3 text-[20px]">Home</p>
</NavLink>


<NavLink
  to="/workspace/myproduct"
  end
  onClick={onClose}
  className={({ isActive }) =>
    `flex items-center px-8 py-2 rounded-lg cursor-pointer
     ${isActive ? "bg-[#7A3BFF]/20" : ""}`
  }
>
  <img src={Add} className="h-6 w-6" />
  <p className="text-[#110829] px-3 text-[20px]">Product</p>
</NavLink>
       

<NavLink
  to="/workspace/productphoto"
  end
  onClick={onClose}
  className={({ isActive }) =>
    `flex items-center px-8 py-2 rounded-lg cursor-pointer
     ${isActive ? "bg-[#7A3BFF]/20" : ""}`
  }
>
  <img src={Product} className="h-6 w-6" />
  <p className="text-[#110829] px-3 text-[20px]">Product Photos</p>
</NavLink>


<NavLink
  to="/workspace/library"
  onClick={onClose}
  className={({ isActive }) =>
    `flex items-center px-8 py-2 rounded-lg cursor-pointer
     ${isActive ? "bg-[#7A3BFF]/20" : ""}`
  }
>
  <img src={Gallery} className="h-6 w-6" />
  <p className="text-[#110829] px-3 text-[20px]">Bg Library</p>
</NavLink>


<NavLink
  to="/workspace/creations"
  onClick={onClose}
  className={({ isActive }) =>
    `flex items-center px-8 py-2 rounded-lg cursor-pointer
     ${isActive ? "bg-[#7A3BFF]/20" : ""}`
  }
>
  <img src={Creations} className="h-6 w-6" />
  <p className="text-[#110829] px-3 text-[20px]">Creations</p>
</NavLink>
  
           
            </div>

            <div>
            <div className="bg-[#ECE8F2] w-full py-[1px] mt-20">
     
            </div>

            </div>

             <div className="flex flex-col gap-8 mt-10">

 <Link
  to="/workspace/pricing"
  onClick={onClose}
  className="flex px-8 flex-row items-center gap-2 hover:opacity-80 transition"
  title="View / buy credits"
>
  <div className="bg-[#ECE8F2] rounded-lg h-10 w-10">
    <div className="flex justify-center items-center h-10">
      <img src={Credit} className="h-6 w-6" />
    </div>
  </div>

  <p className="text-[#110829] font-semibold text-[16px]">
    {formattedCredits}
  </p>
</Link>

              <div className="flex flex-row items-center px-8 ">
              <img src={Help} className="h-6 w-6 "/>
              <p className="text-[#110829] hover:text-[#4A4A55] px-3 text-[20px] cursor-pointer ">Help</p>  
                </div>  

             <NavLink
  to="/workspace/pricing"
  end
  onClick={onClose}
  className={({ isActive }) =>
    `flex items-center px-8 py-2 rounded-lg cursor-pointer
     ${isActive ? "bg-[#7A3BFF]/20" : ""}`
  }
>
  <img src={Credit1} className="h-6 w-6" />
  <p className="text-[#110829] px-3 text-[20px]">
    Pricing
  </p>
</NavLink>
                
               
                  <Link className="flex flex-row items-center px-8"
                  to="/settings"
                  >
              <img src={Settings} className="h-6 w-6 "/>
              <p className="text-[#110829] hover:text-[#4A4A55] px-3 text-[20px] cursor-pointer">Settings</p>  
                </Link>
           

               </div>   
           </div>
            </div> 



        </section>
        
    
    );
}