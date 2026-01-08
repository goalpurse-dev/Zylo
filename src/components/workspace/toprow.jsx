import Logo from "../../assets/Logo.png";
import { Link, NavLink } from "react-router-dom";
import { AuthProvider, useAuth } from "../../context/AuthContext";


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
    <section className="bg-white ">
      <div className="flex items-center justify-between px-6 py-3 md:py-4">

        {/* LEFT SIDE */}
        <div className="flex items-center gap-6 sm:gap-10 md:gap-12 ">
          
          {/* Hamburger (mobile only) */}
          <button onClick={onMenuClick} className="lg:hidden flex flex-col gap-[3px] cursor-pointer">
            <div className="bg-[#492399]  w-5 h-[2px] md:h-[3px] rounded-lg" />
            <div className="bg-[#492399]  w-5 h-[2px] md:h-[3px] rounded-lg" />
            <div className="bg-[#492399]  w-5 h-[2px] md:h-[3px] rounded-lg" />
          </button>

          {/* Logo */}
          <div className="flex lg:hidden items-center gap-2">
            <p className="text-[#7A3BFF] font-bold text-[20px] md:text-[22px] cursor-default">ZyloAI</p>
            <img src={Logo} className="h-10 w-10 md:h-12 md:w-12" />
          </div>

          <div className="lg:flex hidden  items-center gap-2 lg:px-[clamp(24px,4vw,64px)]">
           <p className="text-[#110829] font-semibold text-[22px] 2xl:text-[26px] cursor-default ">
            {title}
            </p> 
          </div>

        </div>

        {/* RIGHT SIDE */}
        <div className="flex items-center gap-4 sm:gap-10  xl:gap-[clamp(39px,15vw,40px)] xl:px-[clamp(15px,15vw,100px)]">


        <div className="hidden lg:block">
         <Link className="text-[#110829] text-[18px] cursor-pointer hover:text-[#7A3BFF] "
         to="/pricing"
         >Pricing</Link>   
        </div>

     
          {/* Plan */}
          <div className="border border-[#7A3BFF] bg-white px-3 sm:px-7 md:px-10 py-1 md:py-3 rounded-lg  hover:bg-[#ECE8F2]">
            <Link className="text-[#7A3BFF] cursor-pointer hover:bg-gray-50"
            to="/contact"
            >Contact Us</Link>
          </div>

          {/* Profile */}
       {!user ? (
        /* NOT SIGNED IN */
        <button
          className="bg-[#C9B8FF] px-6 py-4 text-[#492399] text-[16px] rounded-md hover:opacity-90 transition"
          onClick={() => navigate("/signup")}
        >
          Sign Up Now
        </button>
      ) : (
        /* SIGNED IN */
        <Link className="bg-[#ECE8F2] rounded-full w-10 h-10 md:w-12 md:h-12 flex items-center justify-center cursor-pointer"
        to="/settings"
        >
          <p className="text-[#110829] text-[16px] font-semibold">
            {initials}
          </p>
        </Link>
      )}

        </div>

      </div>
    </section>
  );
}
