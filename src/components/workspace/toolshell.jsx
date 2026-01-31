import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import Arrow from "../../assets/symbols/arrow1.png"


import { AuthProvider, useAuth } from "../../context/AuthContext";
import { useProfileCredits } from "../../hooks/useProfileCredits";
HomeIcon
ToolCase
Folder
BadgeQuestionMark
SettingsIcon
Plus
Box
Image

ArrowBigDownDashIcon
import Logo from "../../assets/Logo.png"

import { QuestionMarkCircleIcon, QueueListIcon, XMarkIcon } from "@heroicons/react/24/solid";


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



import { ArrowBigDown, ArrowBigDownDashIcon, BadgeQuestionMark, Box, CreativeCommonsIcon, FileQuestionMark, Folder, HomeIcon, Image, Plus, SettingsIcon, ToolCase } from "lucide-react"




export default function ToolShell({ activePage, setActivePage, onClose, activePanel, setActivePanel }) {

  const { user } = useAuth();
  const homePath = user ? "/workspace" : "/home";

  const location = useLocation();
const isToolsOpen = activePanel === "tools";
const isHomeActive =
  location.pathname === "/workspace" && !isToolsOpen;

const isLibraryActive =
  location.pathname.startsWith("/workspace/library") && !isToolsOpen;

const isCreationsActive =
  location.pathname.startsWith("/workspace/creations") && !isToolsOpen;


  const credits = useProfileCredits();
const formattedCredits = Intl.NumberFormat().format(credits);

 const closePanels = () => setActivePanel?.(null);
 const [openSection, setOpenSection] = useState(null);
// null | "image" | "video" | "product"

function toggleSection(name) {
  setOpenSection(prev => (prev === name ? null : name));
}

  const toggleTools = () =>
    setActivePanel?.((prev) => (prev === "tools" ? null : "tools"));


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
      <div className="gap-2 flex flex-col">

   
             
 <NavLink
 to={homePath}
  onClick={() => {
    setActivePage("Home");
    onClose?.(); // closes sidebar on mobile
  }}
  className={`flex items-center px-8 cursor-pointer
    ${activePage === "Home" ? "bg-[#7A3BFF]/20 py-1 rounded-lg" : ""}
  `}
 
>

  <img src={Home} className="h-6 w-6" />
  <p className="text-[#110829] px-3 text-[20px]">Home</p>
  
</NavLink>  

              




              
<button
  onClick={() => toggleSection("productphoto")}
  className="flex w-full items-center justify-between px-8 py-[6px] text-left"
>
  <div className="flex items-center gap-3">
    <img src={Product} className="h-6 w-6" />
    <p className="text-[#110829] text-[20px]">Product photos</p>
  </div>

<span
  className={`
    inline-flex items-center justify-center
    w-7 h-7
    rounded-full
    font-semibold
    transition-transform duration-300 ease-out
    origin-center
    ${openSection === "productphoto" ? "rotate-180" : ""}
  `}
>
   <img src={Arrow} className="h-3 w-3 text-[#4A4A55]"></img>
</span>
</button>


{openSection === "productphoto" && (
  <div className="ml-12  flex flex-col gap-1">

 <NavLink
  to="/workspace/productphoto"
  onClick={onClose}
  className={({ isActive }) =>
    `flex items-center px-2 py-1 rounded-lg cursor-pointer
     ${isActive ? "bg-[#7A3BFF]/20" : ""}`
  }
>
  <Plus  className="h-5 w-5 text-[#4A4A55]" />
  <p className="text-[#110829] px-3 text-[16px]">Create</p>
</NavLink>

<NavLink
  to="/workspace/myproduct"
  onClick={onClose}
  className={({ isActive }) =>
    `flex items-center px-2 py-1 rounded-lg cursor-pointer
     ${isActive ? "bg-[#7A3BFF]/20" : ""}`
  }
>
  <Box className="h-5 w-5 text-[#4A4A55]" />
  <p className="text-[#110829] px-3 text-[16px]">My Product</p>
</NavLink>


    <NavLink
  to="/workspace/library"
  onClick={onClose}
  className={({ isActive }) =>
    `flex items-center px-2 py-1 rounded-lg cursor-pointer
     ${isActive ? "bg-[#7A3BFF]/20" : ""}`
  }
>
  <img src={Gallery} className="h-5 w-5" />
  <p className="text-[#110829] px-3 text-[16px]">Backgrounds</p>
</NavLink>

  </div>
)}

<button
  onClick={() => toggleSection("image")}
  className="flex w-full items-center justify-between px-8 py-2 text-left"
>
  <div className="flex items-center gap-3">
    <Image className="h-6 w-6 text-[#4A4A55]" />
    <p className="text-[#110829] text-[20px]">Image</p>
  </div>

<span
  className={`
    inline-flex items-center justify-center
    w-7 h-7
    rounded-full
    
    font-semibold
    transition-transform duration-300 ease-out
    origin-center
    ${openSection === "image" ? "rotate-180" : ""}
  `}
>
  <img src={Arrow} className="h-3 w-3 text-[#4A4A55]"></img>
</span>
</button>


{openSection === "image" && (
  <div className="ml-12  flex flex-col gap-1">

 <NavLink
  to="/image-generator"
  onClick={onClose}
  className={({ isActive }) =>
    `flex items-center px-2 py-1 rounded-lg cursor-pointer
     ${isActive ? "bg-[#7A3BFF]/20" : ""}`
  }
>
  <Plus  className="h-5 w-5 text-[#4A4A55]" />
  <p className="text-[#110829] px-3 text-[16px]">Create</p>
</NavLink>


  </div>
)}

<NavLink
  to="/workspace/creations"
  onClick={onClose}
  className={({ isActive }) =>
    `flex items-center px-8 py-2 rounded-lg cursor-pointer
     ${isActive ? "bg-[#7A3BFF]/20" : ""}`
  }
>
  <Folder src={Creations} className=" text-[#4A4A55] h-6 w-6" />
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

              <Link className="flex flex-row items-center px-8 "
              to="/support"
              >
              <img src={Help} className="h-6 w-6 "/>
              <p className="text-[#110829] hover:text-[#4A4A55] px-3 text-[20px] cursor-pointer ">Help</p>  
                </Link>  

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

          <div className="flex flex-row items-center py-8">
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

            <div className="flex flex-col gap-2 ">

                {/* Tools */}
       
             
<NavLink
  to={homePath}
  end
  onClick={onClose}
  className={({ isActive }) =>
    `flex items-center px-4 py-2 rounded-lg cursor-pointer
     ${isActive ? "bg-[#7A3BFF]/20" : ""}`
  }
>
  <img src={Home} className="h-6 w-6" />
  <p className="text-[#110829] px-3 text-[18px]">Home</p>
</NavLink>





<button
  onClick={() => toggleSection("productphoto")}
  className="flex w-full items-center justify-between px-4 py-[6px] text-left"
>
  <div className="flex items-center gap-3">
    <img src={Product} className="h-6 w-6" />
    <p className="text-[#110829] text-[18px]">Product photos</p>
  </div>

<span
  className={`
    inline-flex items-center justify-center
    w-7 h-7
    rounded-full
    font-semibold
    transition-transform duration-300 ease-out
    origin-center
    ${openSection === "productphoto" ? "rotate-180" : ""}
  `}
>
   <img src={Arrow} className="h-3 w-3 text-[#4A4A55]"></img>
</span>
</button>



{openSection === "productphoto" && (
  <div className="ml-4  flex flex-col gap-1">

 <NavLink
  to="/workspace/productphoto"
  onClick={onClose}
  className={({ isActive }) =>
    `flex items-center px-2 py-1 rounded-lg cursor-pointer
     ${isActive ? "bg-[#7A3BFF]/20" : ""}`
  }
>
  <Plus  className="h-5 w-5 text-[#4A4A55]" />
  <p className="text-[#110829] px-3 text-[14px]">Create</p>
</NavLink>

<NavLink
  to="/workspace/myproduct"
  onClick={onClose}
  className={({ isActive }) =>
    `flex items-center px-2 py-2 rounded-lg cursor-pointer
     ${isActive ? "bg-[#7A3BFF]/20" : ""}`
  }
>
  <Box className="h-5 w-5 text-[#4A4A55]" />
  <p className="text-[#110829] px-3 text-[14px]">My Product</p>
</NavLink>


    <NavLink
  to="/workspace/library"
  onClick={onClose}
  className={({ isActive }) =>
    `flex items-center px-2 py-2 rounded-lg cursor-pointer
     ${isActive ? "bg-[#7A3BFF]/20" : ""}`
  }
>
  <img src={Gallery} className="h-5 w-5" />
  <p className="text-[#110829] px-3 text-[14px]">Backgrounds</p>
</NavLink>

  </div>
)}

<button
  onClick={() => toggleSection("image")}
  className="flex w-full items-center justify-between px-4 py-2 text-left"
>
  <div className="flex items-center gap-3">
    <Image className="h-6 w-6 text-[#4A4A55]" />
    <p className="text-[#110829] text-[18px]">Image</p>
  </div>

<span
  className={`
    inline-flex items-center justify-center
    w-7 h-7
    rounded-full
    
    font-semibold
    transition-transform duration-300 ease-out
    origin-center
    ${openSection === "image" ? "rotate-180" : ""}
  `}
>
  <img src={Arrow} className="h-3 w-3 text-[#4A4A55]"></img>
</span>
</button>


{openSection === "image" && (
  <div className="ml-4  flex flex-col gap-1">

 <NavLink
  to="/image-generator"
  onClick={onClose}
  className={({ isActive }) =>
    `flex items-center px-2 py-1 rounded-lg cursor-pointer
     ${isActive ? "bg-[#7A3BFF]/20" : ""}`
  }
>
  <Plus  className="h-5 w-5 text-[#4A4A55]" />
  <p className="text-[#110829] px-3 text-[14px]">Create</p>
</NavLink>


  </div>
)}
 

<NavLink
  to="/workspace/creations"
  onClick={onClose}
  className={({ isActive }) =>
    `flex items-center px-4 py-2 rounded-lg cursor-pointer
     ${isActive ? "bg-[#7A3BFF]/20" : ""}`
  }
>
  <img src={Creations} className="h-6 w-6" />
  <p className="text-[#110829] px-3 text-[18px]">Creations</p>
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

              <Link className="flex flex-row items-center px-8 "
              to="/support"
              >
              <img src={Help} className="h-6 w-6 "/>
              <p className="text-[#110829] hover:text-[#4A4A55] px-3 text-[18px] cursor-pointer ">Help</p>  
                </Link>  
                
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
  <p className="text-[#110829] px-3 text-[18px]">
    Pricing
  </p>
</NavLink>
               
                  <Link className="flex flex-row items-center px-8"
                  to="/settings"
                  >

                    

              <img src={Settings} className="h-6 w-6 "/>
              <p className="text-[#110829] hover:text-[#4A4A55] px-3 text-[18px] cursor-pointer  ">Settings</p>  
                </Link>
           

               </div>   
           </div>
            </div> 



            {/* Lg and higher */}


            
          <div className="bg-white w-[90px] h-screen hidden md:hidden lg:flex sticky top-0 self-stat  flex-col overflow-hidden">
 
           {/*Start */}
         
          

          <div className="flex flex-row justify-center items-center pt-6 mb-6">
          
           <img src={Logo} className="h-12 w-12"/>
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
    pb-2
    border-r border-[#ECE8F2]


  "
>

            <div className="flex flex-col gap-2 ">
              

                {/* Tools */}
           

             
<NavLink
  to={homePath}
  onClick={() => {
    setActivePanel(null);
    onClose?.();
  }}
  className={`
    flex flex-col gap-1 items-center px-8 py-2 rounded-lg cursor-pointer
    ${isHomeActive ? "bg-[#7A3BFF]/20" : ""}
  `}
>
   <HomeIcon className="text-[#4A4A55] h-6 w-6"></HomeIcon>
  <p className="text-[#110829] text-[12px]">Home</p>
</NavLink>



    <button
  onClick={() =>
    setActivePanel(prev => (prev === "tools" ? null : "tools"))
  }
 className={`
  flex flex-col gap-1 items-center px-8 py-2 rounded-lg
  transition-all duration-200 ease-out
  hover:bg-[#7A3BFF]/10
  active:scale-95
  ${activePanel === "tools" ? "bg-[#7A3BFF]/20 scale-[1.04]" : ""}
`}
>
     <ToolCase className="text-[#4A4A55] h-6 w-6"></ToolCase>
  <p className="text-[#110829] text-[12px]">Tools</p>
</button>

       

<NavLink
  to="/workspace/creations"
  onClick={() => {
    setActivePanel(null);
    onClose?.();
  }}
  className={`
    flex flex-col gap-1 items-center px-8 py-2 rounded-lg cursor-pointer
    ${isCreationsActive ? "bg-[#7A3BFF]/20" : ""}
  `}
>

 <Folder className="text-[#4A4A55] h-6 w-6"></Folder>
  <p className="text-[#110829] text-[12px]">Creations</p>
</NavLink>


           
            </div>

            <div className="px-2">
            <div className="bg-[#ECE8F2] w-full py-[1px]  mt-6"> </div>

            </div>

             <div className="flex flex-col gap-2 mt-10">

 <Link
  to="/workspace/pricing"
  onClick={onClose}
  className="flex flex-col px-8  items-center gap-1 hover:opacity-80 transition "
  title="View / buy credits"
>
  <div className="bg-[#ECE8F2] rounded-lg h-10 w-10">
    <div className="flex justify-center items-center h-10">
      <img src={Credit} className="h-6 w-6" />
    </div>
  </div>

  <p className="text-[#110829] font-semibold text-[12px]">
    {formattedCredits}
  </p>
</Link>

              <Link className="flex flex-col gap-1 items-center px-8  mt-4"
              to="/support"
              >
             <BadgeQuestionMark className="text-[#110829]"></BadgeQuestionMark>
              <p className="text-[#110829] hover:text-[#4A4A55] px-3 text-[12px] cursor-pointer ">Help</p>  
                </Link>  


                
               
                  <Link className="flex flex-col gap-1 items-center px-8 mt-4"
                  to="/settings"
                  >
                          <SettingsIcon className="text-[#110829]"></SettingsIcon>
              <p className="text-[#110829] hover:text-[#4A4A55] px-3 text-[12px] cursor-pointer">Settings</p>  
                </Link>
           

               </div>   
           </div>
            </div> 




        </section>
        
    
    );
}