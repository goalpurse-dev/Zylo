import Instagram from "./../../assets/footer/instagram.png";
import Pinterest from "./../../assets/footer/pinterest.png";
import X from "./../../assets/footer/x.png";
import Youtube from "./../../assets/footer/youtube.png";
import Reddit from "./../../assets/footer/reddit.png";

import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <section className="w-full bg-[#090A0A] text-[#B8BAC5]">

      <div className="w-full h-24 bg-[linear-gradient(to_bottom,rgba(14,16,22,0)_0%,#0E1016_100%)]" />


      {/* MOBILE */}
      <div className="block sm:hidden">

        <div className="w-full h-auto p-2 bg-[#0E1016] pb-6">

          <div className="flex flex-row flex-wrap justify-center gap-8">

            {/* Zylo */}
            <div className="flex flex-col gap-3 mt-10 mr-4">
              <h3 className="cursor-default text-[22px] font-extrabold text-white">Tools</h3>

              <Link to="/workspace/image-generator" className="text-[12px] hover:underline">
                Image Generator
              </Link>

               <Link to="/workspace/video-generator" className="text-[12px] hover:underline">
                Video Generator
              </Link>

              <Link to="/workspace/creations" className="text-[12px] hover:underline">
                Creations
              </Link>
            </div>

            {/* Templates */}
            <div className="flex flex-col gap-3 mt-10 mr-4">
              <h3 className="cursor-default text-[22px] font-extrabold text-white">Templates</h3>

              <Link to="/2am-worlds-ai-generator" className="text-[12px] hover:underline">
                2AM Worlds
              </Link>
              <Link to="/cartoon-drive-by-video-maker" className="text-[12px] hover:underline">
                Cartoon Drive-By
              </Link>
              <Link to="/footballer-nationality-swap-ai" className="text-[12px] hover:underline">
                Nationality Swap
              </Link>
              <Link to="/ai-fruit-story-maker" className="text-[12px] hover:underline">
                AI Fruit Story
              </Link>
              <Link to="/face-asmr-maker" className="text-[12px] hover:underline">
                Face ASMR
              </Link>
              <Link to="/clay-rescue-maker" className="text-[12px] hover:underline">
                Clay Rescue
              </Link>
              <Link to="/micro-camera-animal-maker" className="text-[12px] hover:underline">
                Micro Camera Animal
              </Link>
            </div>

            {/* Pricing + Help */}
            <div className="flex flex-col">

              <div className="flex flex-col">
                <h3 className="mt-10 cursor-default text-[22px] font-extrabold text-white">
                  Pricing
                </h3>
                <Link to="/workspace/pricing" className="text-[12px] mt-2 hover:underline">
                  Plans
                </Link>
              </div>

              <div className="flex flex-col mt-10">
                <h3 className="cursor-default text-[22px] font-extrabold text-white">Help</h3>

                <Link to="/support/contact" className="text-[12px] mt-2 hover:underline">
                  Contact Us
                </Link>
                <Link to="/support" className="text-[12px] mt-2 hover:underline">
                  Support Center
                </Link>
                <Link to="/help/feedback" className="text-[12px] mt-2 hover:underline">
                  Feedback
                </Link>
                <Link to="/blog" className="text-[12px] mt-2 hover:underline">
                  Blog
                </Link>
              </div>

            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 bg-[#0E1016] h-[100px] flex items-center">

          <div className="flex gap-2 ml-4 w-[150px]">
            <img src={Instagram} alt="" aria-hidden="true" className="h-3 w-3" />
            <img src={X} alt="" aria-hidden="true" className="h-3 w-3" />
            <img src={Youtube} alt="" aria-hidden="true" className="h-3 w-3" />
            <img src={Pinterest} alt="" aria-hidden="true" className="h-3 w-3" />
            <img src={Reddit} alt="" aria-hidden="true" className="h-3 w-3" />
          </div>

          <div className="flex flex-1 justify-center gap-4 text-[#868687] text-[12px]">
            <Link to="/support/policies/privacy" className="hover:underline">Privacy Policy</Link>
            <Link to="/support/policies/tos" className="hover:underline">Terms & Conditions</Link>
          </div>
        </div>
      </div>

      {/* SM AND UP */}
      <div className="hidden sm:block bg-[#0E1016]">

        <div className="w-full h-auto p-2 pb-10">

          <div className="flex flex-wrap justify-center gap-16 lg:gap-24 mt-14">

            <div className="flex flex-col gap-3">
              <h3 className="cursor-default text-xl font-extrabold text-white">Tools</h3>

               <Link to="/workspace/image-generator" className="hover:underline">
                Image Generator
              </Link>
               <Link to="/workspace/video-generator" className="hover:underline">
                Video Generator
              </Link>

              <Link to="/workspace/creations" className="hover:underline">
                Creations
              </Link>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="cursor-default text-xl font-extrabold text-white">Templates</h3>

              <Link to="/2am-worlds-ai-generator" className="hover:underline">
                2AM Worlds
              </Link>
              <Link to="/cartoon-drive-by-video-maker" className="hover:underline">
                Cartoon Drive-By
              </Link>
              <Link to="/footballer-nationality-swap-ai" className="hover:underline">
                Nationality Swap
              </Link>
              <Link to="/ai-fruit-story-maker" className="hover:underline">
                AI Fruit Story
              </Link>
              <Link to="/face-asmr-maker" className="hover:underline">
                Face ASMR
              </Link>
              <Link to="/clay-rescue-maker" className="hover:underline">
                Clay Rescue
              </Link>
              <Link to="/micro-camera-animal-maker" className="hover:underline">
                Micro Camera Animal
              </Link>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="cursor-default text-xl font-extrabold text-white">Pricing</h3>
              <Link to="/workspace/pricing" className="hover:underline">
                Plans
              </Link>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="cursor-default text-xl font-extrabold text-white">Help</h3>

              <Link to="/support/contact" className="hover:underline">
                Contact Us
              </Link>
              <Link to="/support" className="hover:underline">
                Support Center
              </Link>
              <Link to="/help/feedback" className="hover:underline">
                Feedback
              </Link>
              <Link to="/blog" className="hover:underline">
                Blog
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 h-[100px] flex items-center bg-[#0E1016]">

          <div className="flex gap-3 ml-6 w-[150px]">
            <img src={Instagram} alt="" aria-hidden="true" className="h-4 w-4 md:h-5 md:w-5" />
            <img src={X} alt="" aria-hidden="true" className="h-4 w-4 md:h-5 md:w-5" />
            <img src={Youtube} alt="" aria-hidden="true" className="h-4 w-4 md:h-5 md:w-5" />
            <img src={Pinterest} alt="" aria-hidden="true" className="h-4 w-4 md:h-5 md:w-5" />
            <img src={Reddit} alt="" aria-hidden="true" className="h-4 w-4 md:h-5 md:w-5" />
          </div>

          <div className="flex flex-1 justify-center gap-4 text-[#868687]">
            <Link to="/support/policies/privacy" className="hover:underline">Privacy Policy</Link>
            <Link to="/support/policies/tos" className="hover:underline">Terms & Conditions</Link>
          </div>

          <div className="w-[150px]" />
        </div>
      </div>
    </section>
  );
}
