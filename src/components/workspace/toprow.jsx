import Logo from "../../assets/Logo.png";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Plus } from "lucide-react";

export default function TopRow({ title, onMenuClick }) {
  const { user, loading } = useAuth();

  if (loading) return null;

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
   <section className="
  fixed top-0 left-0 right-0
  z-[60]
  backdrop-blur-xl
  bg-[#12141A]/90
  border-b border-white/5
">
      <div className="flex lg:hidden items-center justify-between px-6 py-3 md:py-4">

        {/* LEFT SIDE */}
        <div className="flex items-center gap-6 sm:gap-10 md:gap-12">

          {/* Hamburger */}
          <button
            onClick={onMenuClick}
            className="lg:hidden flex flex-col gap-[3px]"
          >
            <div className="bg-white/40 w-5 h-[2px] md:h-[3px] rounded-lg" />
            <div className="bg-white/40 w-5 h-[2px] md:h-[3px] rounded-lg" />
            <div className="bg-white/40 w-5 h-[2px] md:h-[3px] rounded-lg" />
          </button>

          {/* Logo (optional add back later) */}
          {/* <img src={Logo} className="h-6" /> */}

        </div>

        {/* RIGHT SIDE */}
        <div className="flex items-center gap-3 ml-auto sm:gap-4">

          <div className="flex items-center gap-2">

            {/* Add Credits */}
            <Link
              to="/workspace/pricing"
              className="
                flex items-center gap-2
                h-[42px]
                px-3
                rounded-lg
                text-[14px] font-semibold
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
              to="/workspace/pricing"
              className="
                flex items-center justify-center
                h-[42px]
                px-4
                rounded-lg
                text-[14px]
                text-[#E6E8EE]
                bg-[#1A1D2B]
                border border-[#2A2F45]
                hover:bg-[#20243A]
                hover:text-white
                transition
              "
            >
              Pricing
            </Link>

          </div>

          {/* Contact */}
          <Link
            to="/support/contact"
            className="
              hidden sm:flex
              items-center justify-center
              h-[42px]
              px-4
              rounded-lg
              text-[14px] font-semibold
              text-purple-200
              bg-[#7A3BFF]/25
              border border-purple-400/30
              hover:bg-purple-500/20
              hover:border-purple-400/40
              transition-all duration-200
            "
          >
            Contact Us
          </Link>

        </div>
      </div>
    </section>
  );
}