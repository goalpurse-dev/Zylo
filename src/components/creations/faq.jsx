import Arrow from "./../../assets/home/arrow.png"
import FaqItem from "../workspace/faq/FaqItem";

export default function Faq() {
  return (
    <section className="pb-20">
    <div className="">

    <div className=" flex justify-center ">

     <h1 className="text-[30px] text-[#110829]  font-bold">FAQ</h1>  

    </div>


    <div className="mt-10 flex flex-col gap-5   ">
        


        <FaqItem 
    question="Do I need professional product photos to use this?"
    answer="No. You can upload any clear product image — even a phone photo works perfectly."
/>
        
        <FaqItem 
    question="Will my product look realistic after generation?"
    answer="Yes. Zylo preserves lighting, proportions, and shadows to keep results natural and realistic."
/>

 <FaqItem 
    question="Can I reuse the same product with different backgrounds?"
    answer="Absolutely. Upload once, then generate unlimited variations with different backgrounds."
/>

 <FaqItem 
    question="Are the generated images ready for ads and stores?"
    answer="Yes! Zylo lets you generate visuals in vertical 9:16 format perfect for TikTok, Reels, Shorts, and ads."
/>


 <FaqItem 
    question="Who owns the generated product photos?"
    answer="You do. Every image you generate is fully yours to use commercially."
/>

 
     </div>



        <div className="flex justify-center mt-12">
        <button className="rounded-md bg-[linear-gradient(90deg,#7A3BFF_0%,#492399_100%)] h-14 px-12 ">More Questions?</button>    
        </div>


        


    </div>

    </section>

      );
}
