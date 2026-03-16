import Logo from "../../assets/Logo.png";
import { Link, NavLink } from "react-router-dom";
import { AuthProvider, useAuth } from "../../context/AuthContext";
import { Plus } from "lucide-react";

export default function TopRow({ title, onMenuClick }) {
    const { user, loading } = useAuth();
      if (loading) return null; // prevents flicker

     const initials = user
    ? (
        user.user_metadata?.full_name ||
        user.email ||
        ""
      )
        .slice(0, 2)
        .toUpperCase()
    : null;



  return (
    <section className="bg-[#12141A] ">
      <div className="flex lg:hidden items-center justify-between px-6 py-3 md:py-4">

        {/* LEFT SIDE */}
        <div className="flex items-center gap-6 sm:gap-10 md:gap-12 ">
          
          {/* Hamburger (mobile only) */}
          <button onClick={onMenuClick} className="lg:hidden flex flex-col gap-[3px] cursor-pointer">
            <div className="bg-white/40  w-5 h-[2px] md:h-[3px] rounded-lg" />
            <div className="bg-white/40  w-5 h-[2px] md:h-[3px] rounded-lg" />
            <div className="bg-white/40 w-5 h-[2px] md:h-[3px] rounded-lg" />
          </button>

          {/* Logo */}
          <div className="flex  items-center gap-2">
            <p className="text-[#7A3BFF] font-bold text-[20px] md:text-[22px] cursor-default">ZyvoAI</p>
            <div className="hidden sm:flex ">
         
            </div>
          </div>

      

        </div>

        {/* RIGHT SIDE */}
        <div className="flex items-center gap-4 sm:gap-4  xl:gap-[clamp(39px,15vw,40px)] xl:px-[clamp(15px,15vw,100px)]">


       <div className="flex items-center gap-3 py-3">

  {/* Add Credits */}
<Link
  to="/workspace/pricing"
  className="
    flex items-center gap-2
    px-4 py-3
    rounded-lg
    text-[15px] font-semibold
    text-purple-300
    bg-purple-500/10
    border border-purple-400/20
    hover:bg-purple-500/15
    hover:border-purple-400/30
    transition-all duration-200
  "
>
  <Plus className="w-4 h-4" />
  Add Credits
</Link>

  {/* Pricing */}
  <Link
    className="text-[#E6E8EE] bg-[#1A1D2B] border border-[#2A2F45] py-3 px-8 rounded-md text-[16px] cursor-pointer hover:bg-[#20243A] hover:text-white/90 transition"
    to="/workspace/pricing"
  >
    Pricing
  </Link>

</div>

     
          {/* Plan */}
          <div className="sm:block hidden border border-[#2A2F45] bg-[#7A3BFF] px-3 sm:px-7 md:px-10 py-3  rounded-lg  hover:bg-[#8F5BFF]">
            <Link className="text-[#FFFFFF] text-[16px] cursor-pointer"
            to="/support/contact"
            >Contact Us</Link>
          </div>

        




        </div>

      </div>
    </section>
  );
}
