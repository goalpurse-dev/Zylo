
import { useState } from "react";
import Logo from "../../../assets/Logo.png"
import Google from "../../../assets/google.png"
import { ChevronDown, X } from "lucide-react";

import { Link, NavLink } from "react-router-dom";



const navLink =
  "text-[#110829] font-normal text-base lg:text-xl hover:text-[#7A3BFF] transition hover:underline";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
const [featuresOpen, setFeaturesOpen] = useState(false);

  return (
    <section className="flex justify-center mx-auto bg-transparent" >
     <div className="bg-white py-3 md:py-4  lg:py-3 w-full  lg:mx-14 shadow-lg rounded-xl mx-6 md:mx-6 xl:max-w-7xl 2xl:max-w-[1500px] lg:max-w-[1000px]">
       
        <div className="flex justify-between  gap-2 lg:gap-10">
           <div className=" ml-1 md:ml-4 lg:ml-4 flex flex-row gap-1 lg:gap-1 items-center">
            <p className="hidden sm:flex sm:ml-4 text-[#7A3BFF] md:text-xl lg:text-2xl font-bold cursor-default ">ZyvoAI</p>
            <img src={Logo} alt="Logo" className=" h-10 lg:h-10 w-10 lg:w-10 ml-4 md:ml-2 mr-2 lg:mr-4"/>
            </div>

       
       <div className="relative lg:flex lg:flex-row     gap-2 lg:gap-12 items-center mr-2 lg:mr-12 lg:ml-4 hidden ">
      <Link
  className="text-[#110829] font-normal text-base lg:text-xl hover:text-[#7A3BFF] transition hover:underline flex items-center gap-2 "
  
  onClick={() => setOpen(!open)}
  >
    
  Tools
    <ChevronDown   className={`w-4 h-4 transition-transform ${
      open ? "rotate-180" : ""
    }`} ></ChevronDown>
</Link>

{open && (
  <div className="absolute top-full mt-3 w-[280px] bg-white rounded-xl shadow-lg border border-[#7A3BFF]/30 p-2   z-20">
    <p className="text-[#7A3BFF] font-semibold mb-2">Tools</p>


    <div className="border-[#7A3BFF] border-[2px] p-2 rounded-lg">
    
    
    <ul className="space-y-2 text-[#4A4A55] text-[14px]">
      <li>
      <Link className="hover:text-[#7A3BFF] cursor-pointer hover:underline"
      to="/workspace/productphoto"
      >
        Product Photos
      </Link>
      </li>
     
     <li>
      <Link className="hover:text-[#7A3BFF] cursor-pointer hover:underline"
      to="/workspace/myproduct"
      >
        My Product
      </Link>
        </li>

        <li>
      <Link className="hover:text-[#7A3BFF] cursor-pointer hover:underline"
      to="/workspace/library"
      >
      
        Background Library
      </Link>
        </li>

      <li>
      <Link className="hover:text-[#7A3BFF] cursor-pointer hover:underline"
      to="/workspace/creations"
      >
        Creations
      </Link>
        </li>
    </ul>
  </div>
  </div>

)}

     <Link
  to="/pricing"
  className="text-[#110829] font-normal text-base lg:text-xl hover:text-[#7A3BFF] transition hover:underline"
>
  Pricing
</Link>
      <Link className="text-[#110829] font-normal text-base lg:text-xl hover:text-[#7A3BFF] transition hover:underline cursor-pointer"
      to="/contact"
      >Help</Link>


      <Link className="text-[#110829] font-normal text-base lg:text-xl hover:text-[#7A3BFF] transition hover:underline cursor-pointer"
      to="/login"
      >Login</Link>
      </div> 



       <div className="flex flex-row h-full gap-1 lg:gap-4 ml-1  ">
      <Link className="
      bg-[#C9B8FF] hover:bg-[#b8a1ff] lg:whitespace-nowrap mr-2 py-2 px-6  rounded-md text-[#492399] font-semibold transition text-sm cursor-default
      lg:py-3  lg:px-8 lg:flex-shrink-0 flex items-center"
     to="/signup"
     >Sign Up Now</Link>


      
      <Link className=" lg:whitespace-nowrap hidden bg-white hover:bg-gray-100 py-1  px-1 md:px-4 md:items-center rounded-md text-[#110829]  border  border-gray-500  mr-12 md:mr-2 transition cursor-default
      md:flex 
      lg:py-3 lg:px-3 lg:flex-shrink-0 lg:mr-16 "
      to="/signup"
      >Start Free With  
      <img src={Google} alt="Google" className="inline-block h-4 md:h-6  lg:h-8 w-4 md:w-8 lg:w-10 "/>
      </Link>
   
<button
  onClick={() => setMenuOpen(true)}
  className="lg:hidden mr-3 h-12 w-10 bg-[#ECE8F2] rounded-md flex flex-col justify-center items-center gap-[3px]"
>
  <span className="h-[2px] w-5 bg-[#110829]" />
  <span className="h-[2px] w-5 bg-[#110829]" />
  <span className="h-[2px] w-5 bg-[#110829]" />
</button>
      </div>

        
{menuOpen && (
  <div className="fixed inset-0 z-50 bg-white px-6 py-6 lg:hidden  ">
    
    {/* Top row */}
    <div className="flex justify-between items-center mb-8">
      <p className="text-[#7A3BFF] text-xl font-bold">ZyvoAI</p>
      <X className="text-[#110829] h- w-5" onClick={() => setMenuOpen(false)}></X>
    </div>

    {/* Menu items */}
    <div className="space-y-4">
      
      {/* Features (EXPANDING CARD) */}
<div className="w-full bg-[#F4F1FA] rounded-xl overflow-hidden transition-all">
  
  <button
    onClick={() => setFeaturesOpen(!featuresOpen)}
    className="w-full px-4 py-4 flex justify-between items-center"
  >
    <span className="text-[#110829]">Features</span>
    <ChevronDown
      className={`text-[#110829]/60 transition-transform ${
        featuresOpen ? "rotate-180" : ""
      }`}
    />
  </button>

  {featuresOpen && (
    <div className="px-4 pb-4 space-y-3 ">
      <Link
        to="/workspace/myproduct"
        className="block bg-white rounded-lg px-4 py-3 shadow text-[#110829] hover:border-[#7A3BFF] border-[1px]"
      >
        My Product
      </Link>

      <Link
        to="/workspace/productphoto"
        className="block bg-white rounded-lg px-4 py-3 shadow text-[#110829] hover:border-[#7A3BFF] border-[1px]"
      >
        Product Photos
      </Link>
    </div>
  )}
</div>


      {/* Other links */}
      <Link className="block bg-[#F4F1FA] rounded-xl px-4 py-4 text-[#110829]" to="/pricing">
        Pricing
      </Link>

      <Link className="block bg-[#F4F1FA] rounded-xl px-4 py-4 text-[#110829]" to="/contact">
        Help
      </Link>

      <Link className="block bg-[#F4F1FA] rounded-xl px-4 py-4 text-[#110829]" to="/login">
        Login
      </Link>
    </div>

    <div className=" py-10">
    <div className="bg-[#4A4A55]/40 w-full  h-[1px]"></div>  
    </div>

    {/* CTA buttons */}
 

   <div className="mt-6 flex flex-col gap-4">
  
  <Link
    to="/signup"
    className="
      w-full bg-[#7A3BFF] hover:bg-[#6A2EFF]
      text-white font-semibold
      py-3 rounded-xl text-center
      transition
    "
  >
    Sign Up Now
  </Link>

<div className="flex h-full items-center">
  <Link
    to="/signup"
    className="
      w-full flex items-center justify-center gap-1
      bg-white hover:bg-gray-100
      border border-gray-400
      text-[#110829] 
      py-3 rounded-xl
      transition
    "
  >
    Start Free With
    <img
      src={Google}
      alt="Google"
      className="h-6 w-8 "
    />
  </Link>
  </div>

</div>
    </div>

)}
     
     
      </div>  
      



     </div>
    </section>
  );
}