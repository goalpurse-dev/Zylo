import Good2 from "../../assets/blog/productphoto/good.2.png";
import Before1 from "../../assets/blog/productphoto/before1.png";
import Before2 from "../../assets/blog/productphoto/before2.png";
import i1 from "../../assets/inspiration/1.png";
import i2 from "../../assets/inspiration/2.png";
import i3 from "../../assets/inspiration/3.png";
import i4 from "../../assets/inspiration/4.png";
import i5 from "../../assets/inspiration/5.png";
import i6 from "../../assets/inspiration/6.png";
import i7 from "../../assets/inspiration/7.png";
import i8 from "../../assets/inspiration/8.png";
import i9 from "../../assets/inspiration/9.png";
import i10 from "../../assets/inspiration/10.png";
import i11 from "../../assets/inspiration/11.png";
import i12 from "../../assets/inspiration/12.png";
import i13 from "../../assets/inspiration/13.png";
import i14 from "../../assets/inspiration/14.png";
import i15 from "../../assets/inspiration/15.png";
import i16 from "../../assets/inspiration/16.png";


import BeforeAfter3 from "../../assets/blog/productphoto/beforeafter3.png";
import Same from "../../assets/blog/productphoto/same.png";

import { MasonryImage } from "./../ImageGenerator/MasonryImage";

const createdImages = [
  {
    src: Good2,
    prompt: "Create a breathtaking ultra-realistic cinematic scene of a gigantic nuclear facility on the moon, dramatic lighting, astronauts in foreground"
  },
 
  {
    src: i1,
    prompt: "Create a breathtaking ultra-realistic cinematic scene of a gigantic nuclear facility on the moon, dramatic lighting, astronauts in foreground, cinematic lighting, dramatic composition, ultra-realistic"
  },

    {
    src: i2,
    prompt: "Professional product photo with soft studio lighting, clean background, luxury ecommerce look"
  },
  {
    src: i3,
    prompt: "Professional product photo with soft studio lighting, clean background, luxury ecommerce look, cinematic lighting, dramatic composition, ultra-realistic"
  },
  {
    src: i4,
    prompt: "Minimalistic illustration style, flat design, warm colors, modern brand feel, cinematic lighting, dramatic composition, ultra-realistic"
  },
  {
    src: i5,
    prompt: "create me image of cute dogs playing in a park, cinematic lighting, dramatic composition, ultra-realistic"
  },
  {
    src: i6,
    prompt: "create image of confident man next to corvette c7, cinematic lighting, dramatic composition, ultra-realistic"
  },
  {
    src: i7,
    prompt: "A confident future businessman in his late 20s standing beside a black Chevrolet Corvette C7 at golden hour, luxury lifestyle scene. He is wearing a tailored dark suit with a modern minimalist watch, calm and focused"
  },
  {
    src: i8,
    prompt: "Create a breathtaking ultra-realistic cinematic scene of a gigantic nuclear facility on the moon, dramatic lighting, astronauts in foreground, cinematic lighting, dramatic composition, ultra-realistic"
  },
    {
    src: i9,
    prompt: "Create image of coolest car ever, cinematic lighting, dramatic composition, ultra-realistic"
  },

    {
    src: i10,
    prompt: "create image of card, anime illustration style, expressive features, clean linework, clean composition, sharp focus, high detail"
  },

    {
    src: i11,
    prompt: "create me image of minecraft villager which is a elf, Disney-inspired animation style, soft shading, friendly proportions, clean composition, sharp focus, high detail"
  },

    {
    src: i12,
    prompt: "create me image of cool guy with great car, comic book style, bold outlines, high contrast colors, clean composition, sharp focus, high detail"
  },

   {
    src: i13,
    prompt: "create image of robot, cinematic lighting, dramatic composition, ultra-realistic, clean composition, sharp focus, high detail"
  },
    {
    src: i14,
    prompt: "Create image of girls dream barbie house, dynamic motion, energetic composition, sharp focus, clean composition, sharp focus, high detail"
  },
    {
    src: i15,
    prompt: "create me image of old jaguar, cinematic lighting, dramatic composition, ultra-realistic, clean composition, sharp focus, high detail"
  },

    {
    src: i16,
    prompt: "create me image of movie indiano jones scene, cinematic lighting, dramatic composition, ultra-realistic, clean composition, sharp focus, high detail"
  },


  
  
];



export const Inspiration = ({ setPrompt }) => {
  return (
    <section className="w-full px-2">
      <h1 className="text-[#110829] font-bold text-[26px] mb-4">
        Created with <span className="text-[#7A3BFF]">Zyvo</span>
      </h1>

      <div className="columns-2 md:columns-3 lg:columns-4 gap-3">
        {createdImages.map((item, i) => (
          <MasonryImage
            key={i}
            src={item.src}
            prompt={item.prompt}
            onUse={(p) => setPrompt(p)}
          />
        ))}
      </div>
    </section>
  );
};


export default Inspiration;
