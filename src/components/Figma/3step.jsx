import Arrow from "../../assets/symbols/arrow.png"
import Zylo from "../../assets/symbols/zylo.png"
import Bg1 from "../../assets/icons/Bg1.png"
import Bg2 from "../../assets/icons/Bg2.png"
 import Bg from "../../assets/symbols/bg.mp4"



import bg20 from "../../assets/gallery/bg-20.jpg";
import bg21 from "../../assets/gallery/bg-21.jpg";


export default function Proof() {
  return (
    <section className="flex justify-center px-[clamp(16px,5vw,80px)]">
      
      <div className="
        flex flex-col items-center
        bg-[#ECE8F2]
        w-full
        max-w-[600px] md:max-w-6xl
        py-12 lg:py-20
        px-6
        rounded-lg
        overflow-hidden
      ">

        {/* Title */}
        <h1 className="text-[#110829] font-bold text-2xl sm:text-3xl font-inter mb-8 lg:mb-14 lg:text-4xl cursor-default">
          How Zylo Works
        </h1>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 place-items-center w-full">


            {/*left*/}

          <div className="bg-white w-[260px] h-[330px] rounded-lg md:w-[210px] lg:w-[260px] lg:h-[360px]">

            <div className="flex mt-10 justify-center sm:justify-center"> 
                <div className="bg-[#ECE8F2] h-28 w-28 rounded-lg lg:w-36 lg:h-36 ">
                 
                    <div className="flex justify-center mt-5">
                        <div className="bg-white rounded-lg h-16 w-16 lg:h-24 lg:w-24">

                            <div className="flex flex-col justify-end h-full items-center gap-2 ">
                                <img src={Arrow} className="h-6 lg:h-8 w-6 lg:w-8 "/>    
                                <div className="bg-[#ECE8F2] h-4 w-14 lg:h-6 lg:w-20 rounded-lg mb-2 "></div>    
                            </div>
                        </div>

                    </div> 

                </div>

            </div>
  <div className="flex flex-col items-center justify-center gap-3 px-6 md:px-3 lg:px-6 text-center flex-1 mt-14 md:mt-12 lg:mt-14">
    <h2 className="text-[#110829] font-semibold text-xl md:text-lg lg:text-xl font-inter cursor-default">
      Upload Your Product
    </h2>
    <p className="text-[#4A4A55] font-semibold font-inter cursor-default">
      Add any product photo -- no studio needed
    </p>
  </div>

          </div>

          {/*Middle*/}

           <div className="bg-white w-[260px] h-[330px] rounded-lg md:w-[210px] lg:w-[260px] lg:h-[360px] ">

            <div className="flex mt-6 justify-center sm:justify-center relative h-full w-full"> 
                <div className="absolute top-0  z-20 bg-[#ECE8F2] h-32 w-24  rounded-lg shadow-lg border-gray-200 border-2">
                 <div className="flex flex-row justify-center items-center h-full">
                  <div className="relative  h-full w-20"> 
                    <img src={Zylo} className="absolute  left-0 py-2 aspect-[9/16] z-20"/> 
                
          
                  </div> 
                    </div>
                 </div>

                  <div className="absolute top-0 right-5 z-10 bg-[#ECE8F2] h-32 w-24 rounded-lg scale-90">
                 <div className="flex flex-row justify-center items-center w-full h-full">
                  <div className="  "> 
                    <img src={Bg1} className=" w-full pt-6 mt-3 h-full  aspect-[9/16] z-20 object-cover"/> 
                
          
                  </div> 
                    </div>
                 </div>

                  <div className="absolute top-0 left-5 z-10 bg-[#ECE8F2] h-32 w-24 rounded-lg scale-90">
                 <div className="flex flex-row justify-center items-center h-full">
                  <div className=""> 
                    <img src={Bg2} className=" aspect-[9/16] z-20 object-cover pt-6 mt-3"/> 
                
                    
                  </div> 
                  
                    </div>

             

                 </div>

                              <div className="flex flex-col items-center justify-center gap-3 px-6 md:px-2 lg:px-6 text-center flex-1 mt-32 md:mt-28 lg:mt-32">
    <h2 className="text-[#110829] font-semibold text-xl md:text-lg lg:text-xl font-inter cursor-default">
     Choose a Background
    </h2>
    <p className="text-[#4A4A55] font-semibold font-inter md:px-2 cursor-default">
      Pick from our curated AI background library
    </p>
  </div> 

            </div>


            

            

          </div>

          {/*Right*/}

          <div className="bg-white w-[260px] h-[330px] rounded-lg flex flex-col md:w-[210px] lg:w-[260px] lg:h-[360px] ">

  {/* VISUAL SLOT */}
  <div className="relative h-[160px] flex justify-center items-start mt-6">

    {/* Product preview */}
    <div className="bg-[#ECE8F2] h-28 w-28 lg:h-36 lg:w-36 rounded-lg flex justify-center items-center relative">
      <img src={Zylo} className="py-3 scale-75 aspect-[9/16]" />
   

    {/* CHECK BADGE */}
    <div className="absolute -top-2 -right-4 h-10 w-10 rounded-full bg-[#7A3BFF] flex items-center justify-center">
      <svg
        className="h-6 w-6 text-white"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </div>
     </div>

  </div>

  {/* TEXT SLOT */}
  <div className="flex flex-col items-center justify-center gap-3 px-6 md:px-2 lg:px-6 text-center flex-1">
    <h2 className="text-[#110829] font-semibold text-xl md:text-lg lg:text-xl font-inter cursor-default">
      Generate & Download
    </h2>
    <p className="text-[#4A4A55] font-semibold font-inter cursor-default">
      Get a clean, market-ready product photo in seconds
    </p>
  </div>

</div>
          

        </div>



      </div>




    </section>
  );
}
