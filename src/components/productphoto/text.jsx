import { ThumbsDown, ThumbsUp } from "lucide-react";

ThumbsUp, ThumbsDown

export default function text() {
    return (
        <div className=" ">

        <div className="flex justify-center ">
        <div className="bg-white w-[240px] h-[64px] rounded-lg shadow-lg">

        <div className="flex justify-center px-4 pt-2">
         <h1 className="text-[#110829] text-center text-[12px]">Give Feedback For <span className="font-semibold">Product Photos</span></h1>   
        </div>

        <div className="py-3  ">
         <div className="border-[#4A4A55] border-[1px] py-1 w-full flex justify-center gap-10">
                <ThumbsDown className="text-[#110829] hover:text-[#4A4A55] h-4 w-4"></ThumbsDown>
                <ThumbsUp className="text-[#110829] hover:text-[#4A4A55] h-4 w-4"></ThumbsUp>
            </div>   
        </div>

        </div>
        </div>


        </div>
        
    
    );
}