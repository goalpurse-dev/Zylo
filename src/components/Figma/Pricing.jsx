import { CheckIcon } from "@heroicons/react/24/solid";

import { Link, NavLink } from "react-router-dom";

export default function proof() {
    return (
        <section className="w-full py-32 bg-[#ECE8F2] ">

            <div className="md:hidden">

            <div className="flex flex-col justify-center items-center gap-3 "> 
             <h1 className="text-[#7A3BFF] font-bold text-[24px] cursor-default">Fast Content, Faster Results</h1>
             <h2 className="text-[#110829] text-[18px] font-bold px-20 text-center cursor-default ">Pricing Built to 10x Your Brand's Growth</h2>   
            </div>

            <div className="grid grid-cols-1 place-items-center mt-10  ">

                  {/*Left */}
                
            <div className="bg-white rounded-xl w-[clamp(250px,80vw,400px)] sm:w-[clamp(400px,70vw,500px)]  max-w-xl h-[660px] shadow-lg">
             <h1 className="text-[#110829] font-bold text-[20px] py-4 pt-8 px-6 cursor-default">Starter Plan</h1> 
             <h2 className="text-[#4A4A55] px-6 font-semibold text-lg cursor-default">Perfect for:</h2> 
             <p className="text-[#4A4A55] text-sm font-normal px-6 pt-2 cursor-default">-early-stage dropshippers </p> 
             <p className="text-[#4A4A55] text-sm font-normal px-6 pt-2 cursor-default">-Content creators  </p> 
             
             <div className="flex flex-row">
             <h3 className="text-[40px] font-semibold text-[#110829] pt-4 pl-6 cursor-default">$25</h3>
             <p className="text-[#4A4A55] text-base pt-10 px-2 cursor-default">/month </p>
             </div>

             <div className="w-full bg-[#F9F7FB] flex justify-center mt-3 py-2">
                <p className="text-[#110829] font-semibold cursor-default">Benefits</p>
             </div>

             <div>

                <div className="flex flex-row items-center  mt-3 ml-2">
                <CheckIcon className="h-4 w-4 text-[#4A4A55] " />    
                <p className="text-[#4A4A55] underline px-2 cursor-default ">1200 monthly credits</p>
                </div>

                    <div className="flex flex-row items-center  mt-3 ml-2">
                <CheckIcon className="h-4 w-4 text-[#4A4A55] " />    
                <p className="text-[#4A4A55] underline px-2 cursor-default ">AI product photo generator</p>
                </div>

                    <div className="flex flex-row items-center  mt-3 ml-2">
                <CheckIcon className="h-4 w-4 text-[#4A4A55] " />    
                <p className="text-[#4A4A55] underline px-2 cursor-default ">30 Product Backgrounds</p>
                </div>

                    <div className="flex flex-row items-center  mt-3 ml-2">
                <CheckIcon className="h-4 w-4 text-[#4A4A55] " />    
                <p className="text-[#4A4A55] underline px-2 cursor-default">2 My Products</p>
                </div>

                    <div className="flex flex-row items-center  mt-3 ml-2">
                <CheckIcon className="h-4 w-4 text-[#4A4A55] " />    
                <p className="text-[#4A4A55] underline px-2 cursor-default ">Standard generation speed</p>
                </div>

             
                    <div className="flex flex-row items-center  mt-3 ml-2">
                <CheckIcon className="h-4 w-4 text-[#4A4A55] " />    
                <p className="text-[#4A4A55] underline px-2 cursor-default">Watermark-free exports</p>
                </div>

             </div>

             <div className="flex flex-col justify-center items-center mt-6">
              <Link className="bg-[linear-gradient(90deg,#7A3BFF_0%,#492399_100%)] px-10 sm:px-14 py-3 rounded-lg text-white font-semibold shadow-lg cursor-default"
              to="/pricing"
              >
                
                Get now</Link>  
           

                <p className="text-[#4A4A55]  py-3 text-[13px] font-semibold cursor-default">Billed monthly</p>
                  </div>


            </div>

            


                                {/*Middle */}      

               <div className="bg-[linear-gradient(90deg,#7A3BFF_0%,#492399_100%)] py-1 px-10 rounded-tr-xl rounded-tl-xl mt-6 rounded-bl-none rounded-br-none text-[12px]  ">Most popular</div>
              <div className="bg-white rounded-xl w-[clamp(250px,80vw,400px)] sm:w-[clamp(400px,70vw,500px)] max-w-xl h-[660px] border-[#7A3BFF] border-2 shadow-lg">
             <h1 className="text-[#110829] font-bold text-[20px] py-4 pt-8 px-6 cursor-default">Pro Plan</h1> 
             <h2 className="text-[#4A4A55] px-6 font-semibold text-lg cursor-default">Perfect for:</h2> 
             <p className="text-[#4A4A55] text-sm font-normal px-6 pt-2 cursor-default">- Brands </p> 
             <p className="text-[#4A4A55] text-sm font-normal px-6 pt-2 cursor-default">- Seller  </p> 
             
             <div className="flex flex-row">
             <h3 className="text-[40px] font-semibold text-[#110829] pt-4 pl-6 cursor-default">$50</h3>
             <p className="text-[#4A4A55] text-base pt-10 px-2 cursor-default">/month </p>
             </div>

             <div className="w-full bg-[#F9F7FB] flex justify-center mt-3 py-2">
                <p className="text-[#110829] font-semibold">Benefits</p>
             </div>

             <div>

                <div className="flex flex-row items-center  mt-3 ml-2">
                <CheckIcon className="h-4 w-4 text-[#4A4A55] " />    
                <p className="text-[#4A4A55] underline px-2 cursor-default">2500 monthly credits</p>
                </div>

                    <div className="flex flex-row items-center  mt-3 ml-2">
                <CheckIcon className="h-4 w-4 text-[#4A4A55] " />    
                <p className="text-[#4A4A55] underline px-2 cursor-default ">Advanced product photo realism</p>
                </div>

                    <div className="flex flex-row items-center  mt-3 ml-2">
                <CheckIcon className="h-4 w-4 text-[#4A4A55] " />    
                <p className="text-[#4A4A55] underline px-2 cursor-default ">100 Product Backgrounds</p>
                </div>

                    <div className="flex flex-row items-center  mt-3 ml-2">
                <CheckIcon className="h-4 w-4 text-[#4A4A55] " />    
                <p className="text-[#4A4A55] underline px-2 cursor-default ">5 My Products</p>
                </div>

                    <div className="flex flex-row items-center  mt-3 ml-2">
                <CheckIcon className="h-4 w-4 text-[#4A4A55] " />    
                <p className="text-[#4A4A55] underline px-2 cursor-default ">Priority generation speed</p>
                </div>

                    <div className="flex flex-row items-center  mt-3 ml-2">
                <CheckIcon className="h-4 w-4 text-[#4A4A55] " />    
                <p className="text-[#4A4A55] underline px-2 cursor-default ">Commercial use license</p>
                </div>

             </div>

             <div className="flex flex-col justify-center items-center mt-6">
              <Link className="bg-[linear-gradient(90deg,#7A3BFF_0%,#492399_100%)] px-10 sm:px-14 py-3 rounded-lg text-white font-semibold shadow-lg cursor-pointer"
              to="/pricing"
              >Get now</Link>  
           

                <p className="text-[#4A4A55]  py-3 text-[13px] font-semibold cursor-default">Billed monthly</p>
                  </div>


            </div>


                    {/*Right */}
               
                <div className="bg-white rounded-xl w-[clamp(250px,80vw,400px)] sm:w-[clamp(400px,70vw,500px)]  max-w-xl h-[660px] mt-12 shadow-lg">
             <h1 className="text-[#110829] font-bold text-[20px] py-4 pt-8 px-6 cursor-default">Generative Plan</h1> 
             <h2 className="text-[#4A4A55] px-6 font-semibold text-lg cursor-default">Perfect for:</h2> 
             <p className="text-[#4A4A55] text-sm font-normal px-6 pt-2 cursor-default">-power users </p> 
             <p className="text-[#4A4A55] text-sm font-normal px-6 pt-2 cursor-default">-teams  </p> 
             
             <div className="flex flex-row">
             <h3 className="text-[40px] font-semibold text-[#110829] pt-4 pl-6 cursor-default">$90</h3>
             <p className="text-[#4A4A55] text-base pt-10 px-2 cursor-default">/month </p>
             </div>

             <div className="w-full bg-[#F9F7FB] flex justify-center mt-3 py-2">
                <p className="text-[#110829] font-semibold cursor-default">Benefits</p>
             </div>

             <div>

                <div className="flex flex-row items-center  mt-3 ml-2">
                <CheckIcon className="h-4 w-4 text-[#4A4A55] " />    
                <p className="text-[#4A4A55] underline px-2 cursor-default">5000 monthly credits</p>
                </div>

                    <div className="flex flex-row items-center  mt-3 ml-2">
                <CheckIcon className="h-4 w-4 text-[#4A4A55] " />    
                <p className="text-[#4A4A55] underline px-2 cursor-default ">Ultra-realistic product photos</p>
                </div>

                    <div className="flex flex-row items-center  mt-3 ml-2">
                <CheckIcon className="h-4 w-4 text-[#4A4A55] " />    
                <p className="text-[#4A4A55] underline px-2 cursor-default ">Full access to all 210+ backgrounds</p>
                </div>

                    <div className="flex flex-row items-center  mt-3 ml-2">
                <CheckIcon className="h-4 w-4 text-[#4A4A55] " />    
                <p className="text-[#4A4A55] underline px-2 cursor-default ">High-volume batch generation</p>
                </div>

                    <div className="flex flex-row items-center  mt-3 ml-2">
                <CheckIcon className="h-4 w-4 text-[#4A4A55] " />    
                <p className="text-[#4A4A55] underline px-2 cursor-default ">Fast-lane generation priority</p>
                </div>

                    <div className="flex flex-row items-center  mt-3 ml-2">
                <CheckIcon className="h-4 w-4 text-[#4A4A55] " />    
                <p className="text-[#4A4A55] underline px-2 cursor-default ">Extended commercial rights</p>
                </div>

             </div>

             <div className="flex flex-col justify-center items-center mt-6">
              <Link className="bg-[linear-gradient(90deg,#7A3BFF_0%,#492399_100%)] px-10 sm:px-14 py-3 rounded-lg text-white font-semibold shadow-lg cursor-pointer"
              to="/pricing"
              >Get now</Link>  
           

                <p className="text-[#4A4A55]  py-3 text-[13px] font-semibold cursor-default">Billed monthly</p>
                  </div>


            </div>


              
            </div>

            </div>



               {/*Md and higher */}

           <div className="hidden md:block">


            <div className="flex flex-col justify-center items-center gap-3 "> 
             <h1 className="text-[#7A3BFF] font-bold text-[24px] lg:text-[28px] xl:text-[32px] 2xl:text-[36px] cursor-default ">Fast Content, Faster Results</h1>
             <h2 className="text-[#110829] text-[18px] lg:text-[22px] xl:text-[26px] 2xl:text-[30px]  font-bold px-20 text-center cursor-default ">Pricing Built to 10x Your Brand's Growth</h2>   
            </div>

            <div className="flex justify-center mt-12 xl:scale-105 2xl:scale-110 xl:mb-4 2xl:mb-8">
             <div className="bg-[linear-gradient(90deg,#7A3BFF_0%,#492399_100%)] w-[160px] py-1 px-10 rounded-tr-xl rounded-tl-xl  rounded-bl-none rounded-br-none text-[12px] ">Most popular</div>   
            </div>

          
          <div className="mx-auto max-w-7xl">
            <div className="grid grid-cols-3 place-items-center xl:scale-105 2xl:scale-110  ">

                  {/*Left */}
                
            <div className="bg-white rounded-xl md:w-[clamp(250px,30vw,400px)] h-[680px]">
             <h1 className="text-[#110829] font-bold text-[20px] py-4 pt-8 px-6 cursor-default">Starter Plan</h1> 
             <h2 className="text-[#4A4A55] px-6 font-semibold text-lg cursor-default">Perfect for:</h2> 
             <p className="text-[#4A4A55] text-sm font-normal px-6 pt-2 cursor-default">-early-stage dropshippers </p> 
             <p className="text-[#4A4A55] text-sm font-normal px-6 pt-2 cursor-default">-Content creators  </p> 
             
             <div className="flex flex-row">
             <h3 className="text-[40px] font-semibold text-[#110829] pt-4 pl-6 cursor-default">$25</h3>
             <p className="text-[#4A4A55] text-base pt-10 px-2 cursor-default">/month </p>
             </div>

             <div className="w-full bg-[#F9F7FB] flex justify-center mt-3 py-2">
                <p className="text-[#110829] font-semibold cursor-default">Benefits</p>
             </div>

             <div>

                     <div className="flex flex-row items-center  mt-3 ml-2">
                <CheckIcon className="h-4 w-4 text-[#4A4A55] " />    
                <p className="text-[#4A4A55] underline px-2 cursor-default ">1200 monthly credits</p>
                </div>

                    <div className="flex flex-row items-center  mt-3 ml-2">
                <CheckIcon className="h-4 w-4 text-[#4A4A55] " />    
                <p className="text-[#4A4A55] underline px-2 cursor-default ">AI product photo generator</p>
                </div>

                    <div className="flex flex-row items-center  mt-3 ml-2">
                <CheckIcon className="h-4 w-4 text-[#4A4A55] " />    
                <p className="text-[#4A4A55] underline px-2 cursor-default ">30 Product Backgrounds</p>
                </div>

                    <div className="flex flex-row items-center  mt-3 ml-2">
                <CheckIcon className="h-4 w-4 text-[#4A4A55] " />    
                <p className="text-[#4A4A55] underline px-2 cursor-default">2 My Products</p>
                </div>

                    <div className="flex flex-row items-center  mt-3 ml-2">
                <CheckIcon className="h-4 w-4 text-[#4A4A55] " />    
                <p className="text-[#4A4A55] underline px-2 cursor-default ">Standard generation speed</p>
                </div>

             
                    <div className="flex flex-row items-center  mt-3 ml-2">
                <CheckIcon className="h-4 w-4 text-[#4A4A55] " />    
                <p className="text-[#4A4A55] underline px-2 cursor-default">Watermark-free exports</p>
                </div>

             </div>

             <div className="flex flex-col justify-center items-center mt-6">
              <Link className="bg-[linear-gradient(90deg,#7A3BFF_0%,#492399_100%)] px-10 sm:px-14 py-3 rounded-lg text-white font-semibold cursor-pointer"
              to="/pricing"
              >Get now</Link>  
           

                <p className="text-[#4A4A55]  py-3 text-[13px] font-semibold cursor-default">Billed monthly</p>
                  </div>


            </div>

            


                                {/*Middle */}      

             
           
              <div className="bg-white rounded-xl md:w-[clamp(250px,30vw,400px)]   h-[680px] border-[#7A3BFF] border-[3px]">
                  
             <h1 className="text-[#110829] font-bold text-[20px] py-4 pt-8 px-6 cursor-default">Pro Plan</h1> 
             <h2 className="text-[#4A4A55] px-6 font-semibold text-lg cursor-default">Perfect for:</h2> 
             <p className="text-[#4A4A55] text-sm font-normal px-6 pt-2 cursor-default">- Brands </p> 
             <p className="text-[#4A4A55] text-sm font-normal px-6 pt-2 cursor-default">- Seller  </p> 
             
             <div className="flex flex-row">
             <h3 className="text-[40px] font-semibold text-[#110829] pt-4 pl-6 cursor-default">$50</h3>
             <p className="text-[#4A4A55] text-base pt-10 px-2 cursor-default">/month </p>
             </div>

             <div className="w-full bg-[#F9F7FB] flex justify-center mt-3 py-2">
                <p className="text-[#110829] font-semibold cursor-default">Benefits</p>
             </div>

             <div>

                 <div className="flex flex-row items-center  mt-3 ml-2">
                <CheckIcon className="h-4 w-4 text-[#4A4A55] " />    
                <p className="text-[#4A4A55] underline px-2 cursor-default">2500 monthly credits</p>
                </div>

                    <div className="flex flex-row items-center  mt-3 ml-2">
                <CheckIcon className="h-4 w-4 text-[#4A4A55] " />    
                <p className="text-[#4A4A55] underline px-2 cursor-default ">Advanced product photo realism</p>
                </div>

                    <div className="flex flex-row items-center  mt-3 ml-2">
                <CheckIcon className="h-4 w-4 text-[#4A4A55] " />    
                <p className="text-[#4A4A55] underline px-2 cursor-default ">100 Product Backgrounds</p>
                </div>

                    <div className="flex flex-row items-center  mt-3 ml-2">
                <CheckIcon className="h-4 w-4 text-[#4A4A55] " />    
                <p className="text-[#4A4A55] underline px-2 cursor-default ">5 My Products</p>
                </div>

                    <div className="flex flex-row items-center  mt-3 ml-2">
                <CheckIcon className="h-4 w-4 text-[#4A4A55] " />    
                <p className="text-[#4A4A55] underline px-2 cursor-default ">Priority generation speed</p>
                </div>

                    <div className="flex flex-row items-center  mt-3 ml-2">
                <CheckIcon className="h-4 w-4 text-[#4A4A55] " />    
                <p className="text-[#4A4A55] underline px-2 cursor-default ">Commercial use license</p>
                </div>

             </div>

             <div className="flex flex-col justify-center items-center mt-6">
              <Link className="bg-[linear-gradient(90deg,#7A3BFF_0%,#492399_100%)] px-10 sm:px-14 py-3 rounded-lg text-white font-semibold cursor-pointer"
              to="/pricing"
              >Get now</Link>  
           

                <p className="text-[#4A4A55]  py-3 text-[13px] font-semibold ">Billed monthly</p>
                  </div>


            </div>


                    {/*Right */}
               
                <div className="bg-white rounded-xl md:w-[clamp(250px,30vw,400px)]   h-[680px] ">
             <h1 className="text-[#110829] font-bold text-[20px] py-4 pt-8 px-6 cursor-default">Generative Plan</h1> 
             <h2 className="text-[#4A4A55] px-6 font-semibold text-lg cursor-default">Perfect for:</h2> 
             <p className="text-[#4A4A55] text-sm font-normal px-6 pt-2 cursor-default">-power users </p> 
             <p className="text-[#4A4A55] text-sm font-normal px-6 pt-2 cursor-default">-teams  </p> 
             
             <div className="flex flex-row">
             <h3 className="text-[40px] font-semibold text-[#110829] pt-4 pl-6 cursor-default">$90</h3>
             <p className="text-[#4A4A55] text-base pt-10 px-2 cursor-default">/month </p>
             </div>

             <div className="w-full bg-[#F9F7FB] flex justify-center mt-3 py-2">
                <p className="text-[#110829] font-semibold cursor-default">Benefits</p>
             </div>

             <div>

              <div className="flex flex-row items-center  mt-3 ml-2">
                <CheckIcon className="h-4 w-4 text-[#4A4A55] " />    
                <p className="text-[#4A4A55] underline px-2 cursor-default">5000 monthly credits</p>
                </div>

                    <div className="flex flex-row items-center  mt-3 ml-2">
                <CheckIcon className="h-4 w-4 text-[#4A4A55] " />    
                <p className="text-[#4A4A55] underline px-2 cursor-default ">Ultra-realistic product photos</p>
                </div>

                    <div className="flex flex-row items-center  mt-3 ml-2">
                <CheckIcon className="h-4 w-4 text-[#4A4A55] " />    
                <p className="text-[#4A4A55] underline px-2 cursor-default ">Full access to all 210+ backgrounds</p>
                </div>

                    <div className="flex flex-row items-center  mt-3 ml-2">
                <CheckIcon className="h-4 w-4 text-[#4A4A55] " />    
                <p className="text-[#4A4A55] underline px-2 cursor-default ">High-volume batch generation</p>
                </div>

                    <div className="flex flex-row items-center  mt-3 ml-2">
                <CheckIcon className="h-4 w-4 text-[#4A4A55] " />    
                <p className="text-[#4A4A55] underline px-2 cursor-default ">Fast-lane generation priority</p>
                </div>

                    <div className="flex flex-row items-center  mt-3 ml-2">
                <CheckIcon className="h-4 w-4 text-[#4A4A55] " />    
                <p className="text-[#4A4A55] underline px-2 cursor-default ">Extended commercial rights</p>
                </div>

             </div>

             <div className="flex flex-col justify-center items-center md:mt-8 lg:mt-8">
              <Link className="bg-[linear-gradient(90deg,#7A3BFF_0%,#492399_100%)] px-10 sm:px-14 py-3 rounded-lg text-white font-semibold cursor-pointer"
              to="/pricing"
              >
                Get now</Link>  
           

                <p className="text-[#4A4A55]  py-3 text-[13px] font-semibold cursor-default">Billed monthly</p>
                  </div>


            </div>


              
            </div>

            </div>

            <div className="flex justify-center mt-10 xl:scale-105 2xl:scale-110 xl:mt-16 2xl:mt-20 ">
            <Link className="bg-white shadow-lg py-4 px-12 rounded-lg text-[#7A3BFF] font-semibold border-[#7A3BFF] border-[1px]  "
            to="/pricing"
            >See All Plans</Link>
            </div>

            </div>

            
              </section>
        
    
    );
}

