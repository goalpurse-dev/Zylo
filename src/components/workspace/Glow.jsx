import { useEffect, useState } from "react";

export default function GlowHeader() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <section className="relative w-full mt-10 md:mt-16 overflow-hidden bg-[#090A0A]">
      
      <div
        className={`
          relative z-10 text-center px-6
          transform transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]
          ${visible ? "translate-y-0 opacity-100" : "-translate-y-10 opacity-0"}
        `}
      >
        
       <h1 className="text-[34px] md:text-[56px] font-bold leading-[1.15]">
  
  {/* LINE 1 */}
  <span className="block text-white">
    Would You Like To
  </span>

  {/* LINE 2 */}
  <span className="block">
    <span className="
      bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400
      bg-clip-text text-transparent
    ">
      Go Viral
    </span>{" "}
    <span className="text-white">Today?</span>
  </span>

</h1>
        

        {/* divider */}
        <div className="mt-6 h-px w-24 mx-auto bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      </div>
    </section>
  );
}