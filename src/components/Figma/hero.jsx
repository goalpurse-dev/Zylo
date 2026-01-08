import Google from "./../../assets/google.png";
import Product1 from "../../assets/product/product1.jpg";
import Product2 from "../../assets/product/product2.jpg";
import Product6 from "../../assets/product/product6.jpg";
import Logo from "../../assets/Logo.png"
 import Bg from "../../assets/symbols/bg.mp4"

import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";

export default function Hero() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <section className="flex justify-center items-center mx-auto ">

      {/* ========================================================
                       MOBILE VERSION ONLY
      ======================================================== */}
      <div className="flex flex-col md:hidden bg-[#ECE8F2] p-8 rounded-md  md:justify-center ">

        
         <div className="relative w-[400px] h-[230px] mx-auto mt-5 sm:scale-125 ">
         {/* Images */}
       
          <img
            src={Product2}
            className="absolute top-[-5px] flex left-[90px]  w-[220px] rounded-xl   z-20 hover:scale-105
             hover:brightness-90 transition"
          />

          <img
            src={Product6}
            
            className="absolute top-0 flex left-0 w-[220px] rounded-xl z-10  brightness-50 mx-10 -rotate-3 hover:scale-105 hover:-rotate-6"
          />

          <img
            src={Product1}
           
            className="absolute top-0 right-0 w-[220px] rounded-xl  z-10 rotate-3 brightness-50 mx-10 hover:scale-105 hover:rotate-6 "
          />
      


        <div className="absolute bottom-0 left-0 top-32 w-full h-[120px] bg-gradient-to-b from-[#ECE8F2]/0 from-0% via-[#ECE8F2] via-[50%] to-[#ECE8F2] to-100% z-20 pointer-events-none "></div>

           </div>


        {/* Text */}
        <h1 className="text-[#110829] font-bold text-2xl py-6 max-w-[350px] ml-16 sm:scale-110 sm:max-w-[450px] text-center">
          Turn Any Idea Into Stunning Visuals with{" "}
          <span className="text-[#7A3BFF]">Zylo AI.</span>
        </h1>

        <p className="text-[#4A4A55] text-base max-w-[350px] mt-3 sm:scale-110 sm:max-[400px] mx-16 text-center sm:mx-24 ">
          From <span className="font-bold mx-1">product images</span> to ad videos — 
          create polished, ready-to-use content in one click. 
        </p>

        {/* Testimonial */}
        <div className="flex mt-10 gap-1 ml-10 justify-center mr-6 scale-95">
          <div className="rounded-full px-3 bg-white"></div>
          <div className="rounded-full px-3 bg-white"></div>
          <div className="rounded-full px-3 bg-white mr-3"></div>

          <h3 className="text-[#110829] text-sm font-normal whitespace-nowrap mr-4">
            Supporting over <span className="font-bold px-1">+100,00 users</span> worldwide
          </h3>
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-6 mt-10 justify-center " >
          
          <Link className="shadow-lg  text-[#110829] text-base rounded-lg bg-white w-[250px] mx-28 sm:mx-36 px-4 py-4  flex flex-row items-center hover:bg-gray-100 transition"
          to="/signup"
          >
            Start Free With Google
            <img src={Google} className="inline-block h-8 w-10 ml-2" />
          </Link>

          <Link className="shadow-lg bg-[linear-gradient(90deg,#7A3BFF_0%,#492399_100%)] w-[250px] mx-28 sm:mx-36 text-white whitespace-nowrap text-base rounded-lg px-8 py-4 flex flex-row items-center"
          to="/workspace/productphoto"
          >

            Start Generating Now
            <img src={Logo} className="h-10 w-10 ml-2 object-cover"/>
            
          </Link>
        </div>

      </div>     

       
   

      {/* ========================================================
                       DESKTOP / TABLET VERSION
      ======================================================== */}
      <div className="hidden md:flex justify-center items-center gap-6 md:scale-75 ml-16 lg:scale-95 xl:scale-100 2xl:scale-110">

        {/* LEFT SIDE (unchanged) */}
        <div className="bg-[#ECE8F2] p-8 rounded-2xl shadow-xl scale-90 ">
          <h1 className="text-[#110829] font-bold text-3xl py-10 max-w-[450px] cursor-default">
            Turn Any Idea Into Stunning Visuals with{" "}
            <span className="text-[#7A3BFF]">Zylo AI.</span>
          </h1>

          <p className="text-[#4A4A55] text-lg max-w-[450px] mt-5 cursor-default">
            From <span className="font-bold">product images</span> to ad videos — 
            create polished, ready-to-use content in one click. Perfect for 
            e-commerce, agencies, and fast-growing brands.
          </p>

          {/* Testimonial */}
          <div className="flex mt-24 gap-1 ml-3 ">
            <div className="rounded-full px-3 bg-white"></div>
            <div className="rounded-full px-3 bg-white"></div>
            <div className="rounded-full px-3 bg-white mr-3"></div>

            <h3 className="text-[#110829] text-base font-normal whitespace-nowrap cursor-default ">
              Supporting over <span className="font-bold px-1">+100,00 users</span> worldwide
            </h3>
          </div>

          {/* Buttons */}
          <div className="flex flex-row gap-4 mt-10 mb-10">
            <Link className=" whitespace-nowrap shadow-lg text-[#110829] bg-white px-6 py-4 rounded-lg flex items-center hover:bg-gray-100 transition cursor-pointer"
            to="/signup"
            >
              Start Free With Google
              <img src={Google} className="inline-block h-8 w-10 ml-2" />
            </Link>

            <Link className=" shadow-lg bg-[linear-gradient(90deg,#7A3BFF_0%,#492399_100%)] text-white rounded-lg p-5 px-8 whitespace-nowrap flex flex-row items-center cursor-pointer"
            to="/workspace/productphoto"
            >
              Start Generating Now
              <img src={Logo} className="h-8 w-8 ml-2"/>
            </Link>
          </div>
        </div>

        {/* RIGHT SIDE IMAGES (unchanged) */}
        <div className="relative w-[525px] h-[400px]  md:scale-90 md:mr-4">

          <div style={{ transform: `translateY(${scrollY * 0.12}px)` }}>
            <img
              src={Product6}
              className="absolute top-5 right-[50px]  w-[320px] rounded-xl shadow-xl z-10 rotate-2 brightness-75"
            />
          </div>

          <img
            src={Product2}
            className="absolute top-0 left-[-20px] w-[340px] rounded-xl shadow-xl z-20"
          />

          <div style={{ transform: `translateY(${scrollY * 0.12}px)` }}>
            <img
              src={Product1}
              className="absolute top-5 left-[-120px] w-[320px] rounded-xl shadow-xl -rotate-2 brightness-75"
            />
          </div>
        </div>
      </div>

    </section>
  );
}
