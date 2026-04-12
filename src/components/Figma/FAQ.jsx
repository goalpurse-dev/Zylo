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
    question="What can I create with Zyvo?"
    answer="Zyvo gives you two core tools: an AI Image Generator and an AI Video Generator. Use the image generator to create scroll-stopping visuals in 20+ styles, and the video generator to produce short-form videos ready for TikTok, Reels, and YouTube Shorts — all in seconds."
/>

        <FaqItem
    question="How many free generations do I get?"
    answer="Every new account gets 10 free generations to try Zyvo. These reset monthly and work across both the image and video generators. No credit card required to start."
/>

        <FaqItem
    question="What are credits and how do they work?"
    answer="Credits are the currency used inside Zyvo. Each generation consumes credits depending on the tool and model used — some models cost more than others. You can earn credits through your free monthly allowance or by upgrading to a paid plan."
/>

        <FaqItem
    question="Are credits refundable if I don't like the result?"
    answer="No. Once credits are used to generate content — whether you keep the result or not — they are non-refundable. This covers the cost of running the AI models. We recommend using your free generations first to get a feel for the tool before purchasing."
/>

        <FaqItem
    question="Can I use Zyvo for TikTok, Reels, and YouTube Shorts?"
    answer="Yes, that's exactly what it's built for. Both generators produce content optimized for modern social platforms. The video generator supports short-form vertical formats so you can post directly without any editing."
/>

        <FaqItem
    question="Do I need any design or editing experience?"
    answer="None at all. Just type a prompt, pick a style, and Zyvo handles the rest. Most creators go from idea to finished post in under 60 seconds."
/>

        <FaqItem
    question="Are the images and videos I generate mine to use commercially?"
    answer="Yes. Everything you generate on Zyvo belongs to you and is cleared for commercial use — including social media ads, branded content, and product promotions."
/>

        <FaqItem
    question="What's the difference between the free plan and paid plans?"
    answer="The free plan gives you 10 generations per month with access to standard models. Paid plans unlock more credits, faster and higher-quality AI models, priority generation, and access to the full model library including premium video models like Runway Gen-4."
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
