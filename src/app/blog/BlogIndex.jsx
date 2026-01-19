import { Link } from "react-router-dom";
import Footer from "../../components/workspace/footer.jsx";
import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useEffect } from "react";
import { Calendar } from "lucide-react";
Calendar



export default function BlogIndex() {

    useEffect(() => {
  document.title = "AI Product Growth Insights";
}, []);


   const [suggestion, setSuggestion] = useState("");
const [loading, setLoading] = useState(false);
 
  return (
    <section className="bg-[#F7F5FA] min-h-screen  ">
    <div className="flex justify-center py-10 md:py-12 xl:py-16">
    <h1 className="text-[#110829] font-extrabold text-[24px] md:text-[26px] xl:text-[30px]">Zyvo <span className="bg-gradient-to-r from-[#7A3BFF] to-[#492399] bg-clip-text text-transparent ">Blogs</span>
    </h1>  
    </div>

    <div className="max-w-4xl mx-auto px-10 ">
    <p className="text-[#110829] font-semibold text-[16px]">All the blogs</p>


    <div className="py-4 "> 
    <div className=" border-[#110829] border-[1px]  py-10 bg-white rounded-md px-10 flex flex-col gap-6 ">
        
        <div className="grid grid-cols-1 md:grid-cols-2  gap-4 ">
         
        {/* Blog Card 1 */}
         <Link to="/blog/product-photos-with-ai-for-shopify" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">Product Photos with AI for Shopify</h1>

          <p className="text-[#4A4A55] text-[12px] ">Learn how product photos with ai work for shopify</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">14.01/2026</p>
          </div>
          </div>
          </Link> 

             
        {/* Blog Card 2 */}
         <Link to="/blog/product-photos-for-shopify-store" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">Product Photos with AI for Shopify stores</h1>

          <p className="text-[#4A4A55] text-[12px] ">Learn how product photos with ai work for shopify</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">10.01/2026</p>
          </div>
          </div>
          </Link> 


               {/* Blog Card 3 */}
         <Link to="/blog/AI-product-photos-increase-conversion-rates" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">How AI Product Photos Increase Conversion Rates</h1>

          <p className="text-[#4A4A55] text-[12px] ">Learn how product photos with ai work for shopify</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">10.01/2026</p>
          </div>
          </div>
          </Link> 

                    {/* Blog Card 4 */}
         <Link to="/blog/best-ai-tools-for-ecommerce" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">Best AI Tools for Ecommerce Product Photography</h1>

          <p className="text-[#4A4A55] text-[12px] ">Learn how product photos with ai work for shopify</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">10.01/2026</p>
          </div>
          </div>
          </Link> 

          
                    {/* Blog Card 5 */}
         <Link to="/blog/shopify-product-photo-best-practices" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">Shopify Product Photo Best Practices</h1>

          <p className="text-[#4A4A55] text-[12px] ">Learn how product photos with ai work for shopify</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">10.01/2026</p>
          </div>
          </div>
          </Link> 

                    
                    {/* Blog Card 6 */}
         <Link to="/blog/ai-vs-traditional-product-photography" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">AI vs Traditional Product Photography</h1>

          <p className="text-[#4A4A55] text-[12px] ">Learn how product photos with ai work for shopify</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">15.01/2026</p>
          </div>
          </div>
          </Link> 


                    {/* Blog Card 7 */}
                <Link to="/blog/why-product-photos-matter-for-ecommerce-success" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">Why Product Images Matter More Than Ads </h1>

          <p className="text-[#4A4A55] text-[12px] ">When the visuals feel high-end, shoppers assume the product is
            high-end — and they feel safe buying.</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">16.01/2026</p>
          </div>
          </div>
          </Link> 

          
                    {/* Blog Card 8*/}
                <Link to="/blog/best-ai-product-backgrounds-to-use" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">Best AI Product Backgrounds to use </h1>

          <p className="text-[#4A4A55] text-[12px] ">When the visuals feel high-end, shoppers assume the product is
            high-end — and they feel safe buying.</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">16.01/2026</p>
          </div>
          </div>
          </Link> 

                         {/* Blog Card 9*/}
                <Link to="/blog/how-to-improve-ecommerce-visual-trust" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">How to Improve Ecommerce Visual Trust </h1>

          <p className="text-[#4A4A55] text-[12px] ">When the visuals feel high-end, shoppers assume the product is
            high-end — and they feel safe buying.</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">17.01/2026</p>
          </div>
          </div>
          </Link> 

                             {/* Blog Card 10*/}
                <Link to="/blog/product-photography-mistakes-ecommerce-brands-make" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">Product Photography Mistakes Ecommerce Brands Make </h1>

          <p className="text-[#4A4A55] text-[12px] ">When the visuals feel high-end, shoppers assume the product is
            high-end — and they feel safe buying.</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">18.01/2026</p>
          </div>
          </div>
          </Link> 

                                   {/* Blog Card 11*/}
                <Link to="/blog/how-visual-branding-impacts-online-sales" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">How Visual Branding Impacts Online Sales </h1>

          <p className="text-[#4A4A55] text-[12px] ">When the visuals feel high-end, shoppers assume the product is
            high-end — and they feel safe buying.</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">18.01/2026</p>
          </div>
          </div>
          </Link> 

                                  {/* Blog Card 12*/}
                <Link to="/blog/ai-background-removal-for-product-photos" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">AI Background Removal for Product Photos </h1>

          <p className="text-[#4A4A55] text-[12px] ">When the visuals feel high-end, shoppers assume the product is
            high-end — and they feel safe buying.</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">18.01/2026</p>
          </div>
          </div>
          </Link> 

                                      {/* Blog Card 13*/}
                <Link to="/blog/how-to-scale-ecommerce-content-creation-with-ai" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">How to Scale Ecommerce Content Without Photoshoots</h1>

          <p className="text-[#4A4A55] text-[12px] ">When the visuals feel high-end, shoppers assume the product is
            high-end — and they feel safe buying.</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">19.01/2026</p>
          </div>
          </div>
          </Link> 
        
        
        
  
          
        </div>
        

        
        </div>    
    </div>    
    </div>

     
      
    


    {/* Help */}
    <div className="mt-10">
    <div className="flex items-center flex-col max-w-2xl mx-auto ">
    <h1 className="text-[#110829] font-semibold text-[18px]">Do you have improvement suggestions for zylo?</h1> 
    <div className="bg-white border-[#110829] border-[1px] p-4 w-full mt-4 rounded-md  ">
     
    {/* Textarea */   }
    <textarea
  value={suggestion}
  onChange={(e) => setSuggestion(e.target.value)}
  className="mt-2 w-full h-24 p-2 border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-[#7A3BFF] text-[#110829]"
  placeholder="Your suggestions..."
/>
    



      <div className="flex justify-end mt-2">
<button
  onClick={async () => {
    if (!suggestion.trim()) return;

    setLoading(true);

    const { error } = await supabase
      .from("suggestions")
      .insert([{ message: suggestion }]);

    // Silently fail (optional: log to monitoring later)
    if (!error) {
      setSuggestion("");
    }

    setLoading(false);
  }}
  disabled={loading}
  className="bg-[#7A3BFF] text-white px-6 py-2 rounded-md shadow-md hover:opacity-90 disabled:opacity-50"
>
  {loading ? "Sending..." : "Submit"}
</button>


     </div>    
        </div>   
    </div>

    </div>
        <div className="mt-auto flex flex-col">
       <Footer />
        </div>  
        

        
    </section>
  );
}
