import { Check } from "lucide-react";

Check


export default function tips() {
    return (
        <section>

        <div className="flex justify-center mt-10">
        <h1 className="text-[#110829] text-[16px] font-semibold cursor-default">Tips For Better Result</h1>    
        </div>

        <div className="max-w-4xl mx-auto  ">
        <div className="grid grid-cols-1 md:grid-cols-2 place-items-center gap-4 mt-4 ">
        <div className="bg-white h-[70px] w-full max-w-sm border-[#110829] border-[1px] rounded-xl   ">

         <div className="h-full flex items-center justify-between gap-4   px-4">
          <p className="text-[#110829] text-[14px] font-semibold cursor-default">Use a clean product image</p>
          <Check className="text-green-400 h-5 w-5"> </Check>
         </div>

        </div>

             <div className="bg-white h-[70px] w-full max-w-sm border-[#110829] border-[1px] rounded-xl ">

         <div className="h-full flex items-center justify-between gap-4 px-4">
          <p className="text-[#110829] text-[14px] font-semibold cursor-default">Center the product</p> 
         <Check className="text-green-400 h-5 w-5"> </Check> 
         </div>

        </div>

             <div className="bg-white h-[70px] w-full max-w-sm border-[#110829] border-[1px] rounded-xl ">

         <div className="h-full flex items-center justify-between gap-4 px-4">
          <p className="text-[#110829] text-[14px] font-semibold cursor-default">Avoid cluttered backgrounds</p> 
         <Check className="text-green-400 h-5 w-5"> </Check> 
         </div>

        </div>

             <div className="bg-white h-[70px] w-full max-w-sm border-[#110829] border-[1px] rounded-xl ">

         <div className="h-full flex items-center justify-between gap-4 px-4">
          <p className="text-[#110829] text-[14px] font-semibold cursor-default">Match lighting to product</p>
       <Check className="text-green-400 h-5 w-5"> </Check> 
         </div>

        </div>

             <div className="bg-white h-[70px] w-full max-w-sm border-[#110829] border-[1px] rounded-xl ">

         <div className="h-full flex items-center gap-4 justify-between  px-4">
          <p className="text-[#110829] text-[14px] font-semibold cursor-default">Keep shadows subtle</p>
         <Check className="text-green-400 h-5 w-5"> </Check>  
         </div>

        </div>

             <div className="bg-white h-[70px] w-full max-w-sm border-[#110829] border-[1px] rounded-xl ">

         <div className="h-full flex items-center justify-between gap-4 px-4">
          <p className="text-[#110829] text-[14px] font-semibold cursor-default">Stay consistent across shots</p> 
           <Check className="text-green-400 h-5 w-5"> </Check> 
         </div>

        </div>
        </div>


        </div>

        </section>
        
    
    );
}