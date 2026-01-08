
import Bg from "../../assets/soon/bg.png"
import { Link, NavLink } from "react-router-dom";




export default function middle() {
    return (
        <section className="mt-10 py-10">

        <div className=" hidden md:block ">

        <div className="relative h-[200px]  w-full overflow-hidden rounded-xl z-20">

        <img 
        src={Bg}
        className="absolute inset-0 object-cover w-full h-full z-10 "
        />

         <div className="absolute inset-0 bg-[#110829]/40 z-10" />

         
  <div className="absolute inset-0 z-20 flex items-center justify-between px-10 xl:px-20 2xl:px-28">
  <p className="font-bold text-[23px] text-white cursor-default">
    100+ New Backgrounds has just dropped
  </p>

  <Link className="py-3 2xl:py-4 px-6 2xl:px-8 border-[#7A3BFF] border-2 rounded-lg bg-white text-[#7A3BFF] font-medium cursor-pointer"
  to="/workspace/library"
  >
    Browse them now
  </Link>
</div>

         

        </div>

        </div>

        </section>
        
    
    );
}