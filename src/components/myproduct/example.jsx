import Good from "../../assets/example/good.png"
import Bad from "../../assets/example/bad.png"


import { ArrowRight, Check, X } from "lucide-react"; 
Check
X
ArrowRight


export default function Example() {
    return (
        <section className="px-10 ">

        <div>
            <div className="flex justify-center" >
             <h1 className="text-[#110829] font-semibold text-[16px] md:text-[18px] xl:text-[20px] text-center py-5 cursor-default">Difference between bad and a good photo of product</h1>   
            </div>


        <div className="bg-white py-2 w-full shadow-lg rounded-xl max-w-xl xl:max-w-3xl mx-auto mt-4">

       <div className="flex justify-center gap-1 ">

             <div className="flex flex-col items-center  h-full  gap-2 py-6 ">
       
     
        <h2 className="text-red-500 font-bold cursor-default  ">Bad  </h2>
      
             <div className="">
    <img src={Bad} className="w-[100px] sm:w-[150px] md:w-[180px] xl:w-[200px] h-[150px] sm:h-[200px] md:h-[230px] xl:h-[280px]  rounded-lg"/> 
        </div>
      
        </div>

        <div className="flex items-center">
        <ArrowRight className="w-10 h-10 text-[#110829]"></ArrowRight>    
        </div>
       
         <div className="flex flex-col items-center  h-full  gap-2 py-6 ">
        <h2 className="text-green-500 font-bold cursor-default">Good</h2>
             <div className="">
     <img src={Good} className="w-[100px] sm:w-[150px] md:w-[180px] xl:w-[200px] h-[150px] sm:h-[200px] md:h-[230px] xl:h-[280px]  rounded-lg"/>  
        </div>
      
        </div>   

        </div>
            
        </div>    
        </div>

        </section>
        
    
    );
}