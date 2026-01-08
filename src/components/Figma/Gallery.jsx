import Library from "../../assets/Library.mp4";

{/*BG GALLERY IMAGES */}
import bg1 from "../../assets/gallery/bg-1.jpg";
import bg2 from "../../assets/gallery/bg-2.jpg";
import bg3 from "../../assets/gallery/bg-3.jpg";
import bg4 from "../../assets/gallery/bg-4.jpg";
import bg5 from "../../assets/gallery/bg-5.jpg";
import bg6 from "../../assets/gallery/bg-6.jpg";
import bg7 from "../../assets/gallery/bg-7.jpg";
import bg8 from "../../assets/gallery/bg-8.jpg";
import bg9 from "../../assets/gallery/bg-9.jpg";
import bg10 from "../../assets/gallery/bg-10.jpg";
import bg11 from "../../assets/gallery/bg-11.jpg";
import bg12 from "../../assets/gallery/bg-12.jpg";
import bg13 from "../../assets/gallery/bg-13.jpg";
import bg14 from "../../assets/gallery/bg-14.jpg";
import bg15 from "../../assets/gallery/bg-15.jpg";
import bg16 from "../../assets/gallery/bg-16.jpg";
import bg17 from "../../assets/gallery/bg-17.jpg";
import bg18 from "../../assets/gallery/bg-18.jpg";
import bg19 from "../../assets/gallery/bg-19.jpg";
import bg20 from "../../assets/gallery/bg-20.jpg";
import bg21 from "../../assets/gallery/bg-21.jpg";

import { Link, NavLink } from "react-router-dom";



const galleryImages = [
    bg1, bg2, bg3, bg4, bg5, bg6, bg7, bg8, bg9, bg10, 
    bg11, bg12, bg13, bg14, bg15, bg16, bg16, bg17, bg18, bg19, bg20, bg21
];


export default function Gallery() {
    return (
        <section>
            
       
       {/*Mobile*/}
       
         <div className=" h-[140vw] max-h-[580px] min-h-[500px] w-full bg-[#F4F2FB] sm:hidden  ">
          
            {/*H1, Description */}
        <div className="flex justify-center flex-col items-center  "> 
            <h1 className=" mt-10 text-[#110829] font-bold text-[6vw] cursor-default  ">
                Background <span className="text-[#7A3BFF] cursor-default">Gallery</span> 
            </h1>

            <p className="text-[#4A4A55] text-[3vw]   mt-4 flex text-center max-w-[400px] cursor-default">
              Stunning, ready-to-use backgrounds crafted for high-quality results
            </p>
        </div>



        {/*Backgrounds*/}
       <div className="relative bg-[#ECE8F2] w-full overflow-hidden h-[250px] mt-10 shadow-lg">

         {/* CONTENT */}
  <div className="relative h-full w-full overflow-hidden flex items-center gallery-mask">
        
         <div className="scroll-loop gallery-container">

         
  <div className="flex  justify-center items-center gap-3 h-full relative z-10 mx-auto ">
    
    <img 

    src={bg16} 
    className=" w-[35vw] h-[50vw] max-w-[175px] max-h-[220px] rounded-lg object-cover hover:scale-105 transition ease-out delay-75"/>  
    
    
    <img 
 
    src={bg17} 
    className=" w-[35vw] h-[50vw] max-w-[175px] max-h-[220px] rounded-lg object-cover  hover:scale-105 transition ease-out delay-75"/>
    
    
    <img
   
    src={bg21} 
    className="w-[35vw] h-[50vw] max-w-[175px] max-h-[220px] rounded-lg object-cover  hover:scale-105 transition ease-out delay-75"/>
    
   
</div>




 <div className="flex  justify-center items-center gap-3 h-full relative z-10 mx-auto ml-3 ">
    
    <img 

    src={bg3} 
    className=" w-[35vw] h-[50vw] max-w-[175px] max-h-[220px] rounded-lg object-cover hover:scale-105 transition ease-out delay-75"/>  
    
    
    <img 
 
    src={bg9} 
    className=" w-[35vw] h-[50vw] max-w-[175px] max-h-[220px] rounded-lg object-cover  hover:scale-105 transition ease-out delay-75"/>
    
    
    <img
   
    src={bg15} 
    className="w-[35vw] h-[50vw] max-w-[175px] max-h-[220px] rounded-lg object-cover  hover:scale-105 transition ease-out delay-75"/>
    
   
</div>

</div>

  


    </div>

  {/* LEFT FADE */}
  <div className="absolute inset-y-0 left-0 w-[120px] 
    bg-[linear-gradient(to_right,#ECE8F2_23%,#F8F4FE00_63%)] 
    pointer-events-none z-20">
  </div>

  {/* RIGHT FADE */}
  <div className="absolute inset-y-0 right-0 w-[120px] 
    bg-[linear-gradient(to_left,#ECE8F2_23%,#F8F4FE00_63%)] 
    pointer-events-none z-20">
  </div>




    </div>

<div className="flex justify-center mt-7">
 <Link className="flex justify-center items-center mb-3 text-white w-[40vw] h-[12vw] max-w-[200px] max-h-[60px] scale-90 bg-[linear-gradient(90deg,#7A3BFF_0%,#492399_100%)] rounded-md shadow-lg "
 to="/workspace/library"
 >Explore Gallery</Link>   
</div>

</div>






                         {/*Sm and Bigger */}


                          <div className="  h-[140vw] max-h-[580px] sm:min-h-[550px] sm:max-h-[640px] min-h-[500px] lg:max-h-[730px] xl:max-h-[710px] w-full bg-[#ECE8F2]  hidden sm:block sm:scale-105 md:scale-105 lg:scale-110 xl:scale-125 xl:mt-52 xl:mb-72 ">
          
            {/*H1, Description */}
        <div className="flex justify-center flex-col items-center  "> 
            <h1 className=" mt-10 text-[#110829] font-bold sm:text-[clamp(25px,6vw,36px)] sm:max-w-[360px] cursor-default  ">
                Background <span className="text-[#7A3BFF] cursor-default">Gallery</span> 
            </h1>

            <p className="text-[#4A4A55] sm:text-[clamp(10px,3vw,16px)]   mt-4 flex text-center max-w-[400px] cursor-default">
              Stunning, ready-to-use backgrounds crafted for high-quality results
            </p>
        </div>



        {/*Backgrounds*/}
       <div className="relative bg-[#F8F4FE] w-full overflow-hidden h-[250px] sm:h-[300px] lg:h-[400px] xl:h-[28vw] xl:max-h-[400px] mt-10 shadow-lg">

         {/* CONTENT */}
        <div className="relative h-full w-full overflow-hidden flex items-center gallery-mask">
        
         <div className="scroll-loop gallery-track">

  <div className="flex  justify-center items-center gap-3 h-full relative z-10 mx-auto xl:gap-6 gallery-container">
    
    <img 

    src={bg3} 
    className="carousel-img grow w-[35vw] h-[50vw] max-w-[175px] sm:max-w-[200px] sm:max-h-[260px]  lg:max-w-[210px] lg:max-h-[320px] xl:max-h-[380px] xl:h-[24vw] lg:h-[28vw] max-h-[220px] md:max-w-[200px]  md:max-h-[270px] md:w-[20vw] rounded-lg object-cover hover:scale-105 transition ease-out delay-75"/>  
    
    
    <img 
 
    src={bg9} 
    className="carousel-img grow w-[35vw] h-[50vw] max-w-[175px] sm:max-w-[200px] sm:max-h-[260px] lg:max-w-[210px] lg:max-h-[320px] xl:max-h-[380px] xl:h-[24vw] lg:h-[28vw] max-h-[220px] md:max-w-[200px] md:max-h-[270px] md:w-[20vw] rounded-lg object-cover  hover:scale-105 transition ease-out delay-75"/>
    
    
    <img
   
    src={bg15} 
    className="carousel-img grow w-[35vw] h-[50vw] max-w-[175px]   max-h-[220px] sm:max-h-[260px] lg:max-w-[210px] lg:max-h-[320px] xl:max-h-[380px] xl:h-[24vw] lg:h-[28vw] md:max-w-[200px] md:max-h-[270px] rounded-lg object-cover md:w-[20vw]  hover:scale-105 transition ease-out delay-75"/>

   
    <img
   
    src={bg16} 
    className="carousel-img grow hidden md:block w-[35vw] h-[50vw] max-w-[175px]  lg:max-w-[210px] lg:max-h-[320px] max-h-[220px] xl:max-h-[380px] xl:h-[24vw] lg:h-[28vw] md:max-w-[200px] md:max-h-[270px]  md:w-[20vw] rounded-lg object-cover  hover:scale-105 transition ease-out delay-75"/>


     <img
   
    src={bg17} 
    className="carousel-img grow hidden md:block w-[35vw] h-[50vw] max-w-[175px] lg:max-w-[210px] lg:max-h-[320px]  max-h-[220px] xl:max-h-[380px] xl:h-[24vw] lg:h-[28vw] md:max-w-[200px] md:max-h-[270px]  md:w-[20vw] rounded-lg object-cover  hover:scale-105 transition ease-out delay-75"/>
 

     <img 
 
    src={bg21} 
    className="carousel-img grow hidden xl:block w-[35vw] h-[50vw] max-w-[175px] lg:max-w-[210px] lg:max-h-[320px] max-h-[220px] xl:max-h-[380px] xl:h-[24vw] lg:h-[28vw] md:max-w-[200px] md:max-h-[270px] md:w-[20vw] rounded-lg object-cover  hover:scale-105 transition ease-out delay-75"/>


    <img 
 
    src={bg20} 
    className="carousel-img grow hidden 3xl:block w-[35vw] h-[50vw] max-w-[175px] lg:max-w-[210px] lg:max-h-[320px] max-h-[220px] xl:max-h-[380px] xl:h-[24vw] lg:h-[28vw] md:max-w-[200px] md:max-h-[270px] md:w-[20vw] rounded-lg object-cover  hover:scale-105 transition ease-out delay-75"/>

    <img 
 
    src={bg12} 
    className="carousel-img grow hidden 3xl:block w-[35vw] h-[50vw] max-w-[175px] lg:max-w-[210px] lg:max-h-[320px] max-h-[220px] xl:max-h-[380px] xl:h-[24vw] lg:h-[28vw] md:max-w-[200px] md:max-h-[270px] md:w-[20vw] rounded-lg object-cover  hover:scale-105 transition ease-out delay-75"/>

     <img 
 
    src={bg10} 
    className="carousel-img grow hidden 4xl:block w-[35vw] h-[50vw] max-w-[175px] lg:max-w-[210px] lg:max-h-[320px] max-h-[220px] xl:max-h-[380px] xl:h-[24vw] lg:h-[28vw] md:max-w-[200px] md:max-h-[270px] md:w-[20vw] rounded-lg object-cover  hover:scale-105 transition ease-out delay-75"/>

    </div>

    
    
    
    
    
    <div className=" xl:ml-6 ml-3 flex  justify-center items-center gap-3 h-full relative z-10 mx-auto xl:gap-6 gallery-container">
    
    <img 

    src={bg2} 
    className="carousel-img grow w-[35vw] h-[50vw] max-w-[175px] sm:max-w-[200px] sm:max-h-[260px]  lg:max-w-[210px] lg:max-h-[320px] xl:max-h-[380px] xl:h-[24vw] lg:h-[28vw] max-h-[220px] md:max-w-[200px]  md:max-h-[270px] md:w-[20vw] rounded-lg object-cover hover:scale-105 transition ease-out delay-75"/>  
    
    
    <img 
 
    src={bg3} 
    className="carousel-img grow w-[35vw] h-[50vw] max-w-[175px] sm:max-w-[200px] sm:max-h-[260px] lg:max-w-[210px] lg:max-h-[320px] xl:max-h-[380px] xl:h-[24vw] lg:h-[28vw] max-h-[220px] md:max-w-[200px] md:max-h-[270px] md:w-[20vw] rounded-lg object-cover  hover:scale-105 transition ease-out delay-75"/>
    
    
    <img
   
    src={bg5} 
    className="carousel-img grow w-[35vw] h-[50vw] max-w-[175px]   max-h-[220px] sm:max-h-[260px] lg:max-w-[210px] lg:max-h-[320px] xl:max-h-[380px] xl:h-[24vw] lg:h-[28vw] md:max-w-[200px] md:max-h-[270px] rounded-lg object-cover md:w-[20vw]  hover:scale-105 transition ease-out delay-75"/>

   
    <img
   
    src={bg6} 
    className="carousel-img grow hidden md:block w-[35vw] h-[50vw] max-w-[175px]  lg:max-w-[210px] lg:max-h-[320px] max-h-[220px] xl:max-h-[380px] xl:h-[24vw] lg:h-[28vw] md:max-w-[200px] md:max-h-[270px]  md:w-[20vw] rounded-lg object-cover  hover:scale-105 transition ease-out delay-75"/>


     <img
   
    src={bg18} 
    className="carousel-img grow hidden md:block w-[35vw] h-[50vw] max-w-[175px] lg:max-w-[210px] lg:max-h-[320px]  max-h-[220px] xl:max-h-[380px] xl:h-[24vw] lg:h-[28vw] md:max-w-[200px] md:max-h-[270px]  md:w-[20vw] rounded-lg object-cover  hover:scale-105 transition ease-out delay-75"/>
 

     <img 
 
    src={bg9} 
    className="carousel-img grow hidden xl:block w-[35vw] h-[50vw] max-w-[175px] lg:max-w-[210px] lg:max-h-[320px] max-h-[220px] xl:max-h-[380px] xl:h-[24vw] lg:h-[28vw] md:max-w-[200px] md:max-h-[270px] md:w-[20vw] rounded-lg object-cover  hover:scale-105 transition ease-out delay-75"/>


    <img 
 
    src={bg5} 
    className="carousel-img grow hidden 3xl:block w-[35vw] h-[50vw] max-w-[175px] lg:max-w-[210px] lg:max-h-[320px] max-h-[220px] xl:max-h-[380px] xl:h-[24vw] lg:h-[28vw] md:max-w-[200px] md:max-h-[270px] md:w-[20vw] rounded-lg object-cover  hover:scale-105 transition ease-out delay-75"/>

    <img 
 
    src={bg8} 
    className="carousel-img grow hidden 3xl:block w-[35vw] h-[50vw] max-w-[175px] lg:max-w-[210px] lg:max-h-[320px] max-h-[220px] xl:max-h-[380px] xl:h-[24vw] lg:h-[28vw] md:max-w-[200px] md:max-h-[270px] md:w-[20vw] rounded-lg object-cover  hover:scale-105 transition ease-out delay-75"/>

     <img 
 
    src={bg16} 
    className="carousel-img grow hidden 4xl:block w-[35vw] h-[50vw] max-w-[175px] lg:max-w-[210px] lg:max-h-[320px] max-h-[220px] xl:max-h-[380px] xl:h-[24vw] lg:h-[28vw] md:max-w-[200px] md:max-h-[270px] md:w-[20vw] rounded-lg object-cover  hover:scale-105 transition ease-out delay-75"/>

    </div>



    

  </div>

</div>  

   

  {/* LEFT FADE */}
  <div className="absolute inset-y-0 left-0 w-[120px] md:w-[150px] lg:w-[350px] xl:w-[250px] 3xl:w-[700px] 4xl:w-[800px] 
    bg-[linear-gradient(to_right,#ECE8F2_23%,#F8F4FE00_63%)] 
    pointer-events-none z-20">
  </div>

  {/* RIGHT FADE */}
  <div className="absolute inset-y-0 right-0 w-[120px] md:w-[150px] lg:w-[350px] xl:w-[250px] 3xl:w-[700px] 4xl:w-[800px] 
    bg-[linear-gradient(to_left,#ECE8F2_23%,#F8F4FE00_63%)] 
    pointer-events-none z-20">
  </div>




    </div>

<div className="flex justify-center mt-7">
 <Link className="flex justify-center items-center b-3 text-white w-[40vw] h-[12vw] max-w-[200px] max-h-[60px] scale-90 bg-[linear-gradient(90deg,#7A3BFF_0%,#492399_100%)] rounded-md shadow-lg "
  to="/workspace/library"
>Explore Gallery</Link>   
</div>

</div>






            
            </section>
    );
}                    