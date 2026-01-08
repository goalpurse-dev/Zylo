import { XMarkIcon } from "@heroicons/react/24/solid";

export default function cta({onClose}) {


    return (
        <div className="bg-[linear-gradient(90deg,#7A3BFF_0%,#492399_100%)] w-full py-3 lg:py-5 shadow-lg" >

        <div className="flex justify-between items-center">
        <h1 className="text-white font-semibold px-5 text-[14px] sm:text-[15px] md:text-[16px] lg:text-[18px] xl:text-[20px] cursor-default">Product Photos 2.1 is here!</h1>

       

           
           <div className="px-5 ">

            <XMarkIcon
            onClick={onClose}
            className="h-6 w-6 md:h-8 md:w-8 text-white cursor-pointer "
            />

            </div>

        </div>

        </div>
        
    
    );
}