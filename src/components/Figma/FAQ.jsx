import Arrow from "../../assets/home/arrow.png"
import FaqItem from "./FaqItem";


import { Link, NavLink } from "react-router-dom";

export default function Faq() {
  return (
    <section className="pb-40">
    <div className="sm:scale-105 md:scale-110 xl:scale-125">

    <div className=" flex justify-center ">

     <h1 className="text-[30px] text-[#110829] font-bold">FAQ</h1>  

    </div>


    <div className="mt-10 flex flex-col gap-5 mx-2  ">
        


        <FaqItem 
    question="What makes Zyvo different from other AI tools?"
    answer="Zyvo focuses on product-first content, giving brands polished visuals that match their exact style and industry."
/>
        
        <FaqItem 
    question="How fast does Zyvo generate an image?"
    answer="Typically 2-6 seconds, depending on the scene complexity."
/>

 <FaqItem 
    question="Can I use Zyvo for TikTok, Reels, and YouTube Shorts?"
    answer="Yes! Zyvo lets you generate visuals in vertical 9:16 format perfect for TikTok, Reels, Shorts, and ads."
/>

 <FaqItem 
    question="Do I need any editing experience to use Zyvo?"
    answer="Yes! Zyvo lets you generate visuals in vertical 9:16 format perfect for TikTok, Reels, Shorts, and ads."
/>


 <FaqItem 
    question="Can I upload my own product photos?"
    answer="Absolutely. Zyvo allows you to upload your product and automatically place it in professional backgrounds and scenes."
/>


 <FaqItem 
    question="Are the generated images safe for commercial use?"
    answer="Yes. All output is commercial-use friendly and belongs to you once generated."
/>


 <FaqItem 
    question="Does Zyvo work for e-commerce sellers?"
    answer="Yes. It's designed to help sellers create high-converting product photos without hiring photographers."
/>


 <FaqItem 
    question="What is credit used for"
    answer="Credits are used to generate content inside Zyvo. Each time you create a new result, one or more credits are used depending on the tool. "
/>


        </div>





        <div className="flex justify-center mt-12">
        <Link className="rounded-md bg-[linear-gradient(90deg,#7A3BFF_0%,#492399_100%)] h-14 px-12 flex justify-center items-center cursor-pointer "
        to="/support/contact"
        >More Questions?</Link>    
        </div>


        


       

        
        

    </div>

    </section>

      );
}
