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
          <p className="text-[#4A4A55] text-[10px] ">9.01/2026</p>
          </div>
          </div>
          </Link> 

             
        {/* Blog Card 2 */}
         <Link to="/blog/product-photos-for-shopify-store" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">Product Photos with AI for Shopify stores</h1>

          <p className="text-[#4A4A55] text-[12px] ">Create clean, professional Shopify product photos instantly using AI.</p>
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

          <p className="text-[#4A4A55] text-[12px] ">See how better visuals boost clicks, trust, and sales.</p>
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

          <p className="text-[#4A4A55] text-[12px] ">Top AI tools to create high-quality ecommerce product images fast.</p>
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

          <p className="text-[#4A4A55] text-[12px] ">Proven product image guidelines for higher Shopify conversions.</p>
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

          <p className="text-[#4A4A55] text-[12px] ">Compare AI and traditional photoshoots for ecommerce brands.</p>
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

          <p className="text-[#4A4A55] text-[12px] ">How strong visuals influence buying decisions more than ads.</p>
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

          <p className="text-[#4A4A55] text-[12px] ">High-converting background styles for modern product photos.</p>
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

          <p className="text-[#4A4A55] text-[12px] ">Build trust and credibility with better product imagery.</p>
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

          <p className="text-[#4A4A55] text-[12px] ">Common product photo mistakes that hurt sales and engagement.</p>
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

          <p className="text-[#4A4A55] text-[12px] ">Why consistent visuals increase brand recognition and sales.</p>
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

          <p className="text-[#4A4A55] text-[12px] ">Remove backgrounds instantly for clean, professional product images.</p>
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

          <p className="text-[#4A4A55] text-[12px] ">Create and scale product visuals without costly photoshoots.</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">19.01/2026</p>
          </div>
          </div>
          </Link> 

                                      {/* Blog Card 14*/}
                <Link to="/blog/converting-product-images-for-shopify-stores" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">High-Converting Product Images for Shopify</h1>

          <p className="text-[#4A4A55] text-[12px] ">Product image strategies that increase Shopify conversions.</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">20.01/2026</p>
          </div>
          </div>
          </Link> 

                                             {/* Blog Card 15*/}
                <Link to="/blog/ai-product-photography-for-small-businesses" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">AI Product Photography for Small Businesses</h1>

          <p className="text-[#4A4A55] text-[12px] ">Affordable AI product photos for growing small brands.</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">20.01/2026</p>
          </div>
          </div>
          </Link> 

                                                    {/* Blog Card 16*/}
                <Link to="/blog/how-better-images-reduce-bounce-rate" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">How Better Images Reduce Bounce Rate</h1>

          <p className="text-[#4A4A55] text-[12px] ">Use better visuals to keep visitors engaged longer.</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">20.01/2026</p>
          </div>
          </div>
          </Link> 

          

                                                           {/* Blog Card 17*/}
                <Link to="/blog/ecommerce-visual-consistency-explained" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">Ecommerce Visual Consistency Explained</h1>

          <p className="text-[#4A4A55] text-[12px] ">How to stay consistent with visuals explained.</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">22.01/2026</p>
          </div>
          </div>
          </Link> 
        
                                                            {/* Blog Card 18*/}
                <Link to="/blog/ai-productphotos-for-dropshipping" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">AI Product Photos for Dropshipping Stores</h1>

          <p className="text-[#4A4A55] text-[12px] ">How product photos help dropshipping stores</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">23.01/2026</p>
          </div>
          </div>
          </Link> 

              
                                                            {/* Blog Card 19*/}
                <Link to="/blog/how-visual-quality-impacts-seo" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">How Visual Quality Impacts SEO</h1>

          <p className="text-[#4A4A55] text-[12px] ">Learn how important visual quality is for SEO</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">23.01/2026</p>
          </div>
          </div>
          </Link> 

                                                                  {/* Blog Card 20*/}
                <Link to="/blog/product-images-that-conver-full-guide" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">Product Images That Convert: A Complete Guide</h1>

          <p className="text-[#4A4A55] text-[12px] ">Full guide on what kind of product images convert</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">24.01/2026</p>
          </div>
          </div>
          </Link>
                                                                  {/* Blog Card 21*/}
                <Link to="/blog/ai-tools-every-shopify-store-owner-should-know" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">AI Tools Every Shopify Store Owner Should Know</h1>

          <p className="text-[#4A4A55] text-[12px] ">Every shopify store owner must know these AI tools</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">24.01/2026</p>
          </div>
          </div>
          </Link> 

                                                                   {/* Blog Card 22*/}
                <Link to="/blog/how-to-launch-products-faster-with-ai" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">How to Launch Products Faster with AI</h1>

          <p className="text-[#4A4A55] text-[12px] ">Complite guide on how to launch products faster with AI</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">24.01/2026</p>
          </div>
          </div>
          </Link> 
                                                                  {/* Blog Card 23*/}
                <Link to="/blog/studio-quality-product-photos" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">Studio-Quality Product Photos Without a Studio
</h1>

          <p className="text-[#4A4A55] text-[12px] ">Full guide on how to create studio quality product photos wihtout studio</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">25.01/2026</p>
          </div>
          </div>
          </Link> 
                                                                        {/* Blog Card 24*/}
                <Link to="/blog/why-clean-product-photos-build-trust" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">Why Clean Product Photos Build Trust
</h1>

          <p className="text-[#4A4A55] text-[12px] ">Learn how clean product photos build trust</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">25.01/2026</p>
          </div>
          </div>
          </Link> 

                                                                                  {/* Blog Card 25*/}
                <Link to="/blog/visual-optimization-for-mobile-ecommerce" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">Visual Optimization for Mobile Ecommerce
</h1>

          <p className="text-[#4A4A55] text-[12px] ">How optimize visuals for mobile ecommerce</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">26.01/2026</p>
          </div>
          </div>
          </Link> 
                                                                                           {/* Blog Card 26*/}
                <Link to="/blog/how-ai-helps-ecommerce-brands-scale-faster" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">How AI Helps Ecommerce Brands Scale Faster
</h1>

          <p className="text-[#4A4A55] text-[12px] ">Learn how AI helps ecommerce brands to scale faster</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">26.01/2026</p>
          </div>
          </div>
          </Link> 

                                                                                               {/* Blog Card 27*/}
                <Link to="/blog/product-photography-trends-for-ecommerce" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">Product Photography Trends for Ecommerce
</h1>

          <p className="text-[#4A4A55] text-[12px] ">Learn what kind of trends help ecommerce brands to scale faster</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">28.01/2026</p>
          </div>
          </div>
          </Link> 

                                                                                                      {/* Blog Card 28*/}
                <Link to="/blog/ai-product-photos-for-fashion-stores" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">AI Product Photos for Fashion Stores
</h1>

          <p className="text-[#4A4A55] text-[12px] ">Learn how AI product photos help fashion stores to grow faster</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">28.01/2026</p>
          </div>
          </div>
          </Link> 

               {/* Blog Card 29*/}
                <Link to="/blog/ai-product-photos-for-beaty-and-skincare" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">AI Product Photos for Beauty & Skincare Brands
</h1>

          <p className="text-[#4A4A55] text-[12px] ">Learn how AI product photos work for Beaty & Skincare brands</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">29.01/2026</p>
          </div>
          </div>
          </Link> 

                         {/* Blog Card 30*/}
                <Link to="/blog/how-visual-branding-seperates-winners-from-losers" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">How Visual Branding Separates Winners from Losers
</h1>

          <p className="text-[#4A4A55] text-[12px] ">Learn how visuals seperates winners from losers.</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">29.01/2026</p>
          </div>
          </div>
          </Link>

                                  {/*Images*/}

                                  {/* Blog Card 31*/}

                <Link to="/blog/viral-ai-images-tiktok" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">These AI Images Are Going Viral on TikTok

</h1>

          <p className="text-[#4A4A55] text-[12px] ">Learn how to go viral on Tiktok with AI images</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">01.02/2026</p>
          </div>
          </div>
          </Link>

                                            {/* Blog Card 32*/}

                <Link to="/blog/creators-blowingup-with-ai" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">How Creators Are Blowing Up Using AI Image Generators

</h1>

          <p className="text-[#4A4A55] text-[12px] ">Learn to make images that current creators are using to blow up</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">01.02/2026</p>
          </div>
          </div>
          </Link>

                                                {/* Blog Card 33*/}

                <Link to="/blog/i-test-viral-prompts" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">I Tested 10 Viral AI Image Prompts — Here Are the Results

</h1>

          <p className="text-[#4A4A55] text-[12px] ">Here are the results of 10 Viral AI Image Prompts</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">02.02/2026</p>
          </div>
          </div>
          </Link>

                                                       {/* Blog Card 34*/}

                <Link to="/blog/all-image-styles-everyone-obsessed-with" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">The AI Image Styles Everyone Is Obsessed With Right Now

</h1>

          <p className="text-[#4A4A55] text-[12px] ">Learn what kind of images are trending right now</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">02.02/2026</p>
          </div>
          </div>
          </Link>

                                                                 {/* Blog Card 35*/}

                <Link to="/blog/scroll-stopping-images-no-design-skills" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">How to Create Scroll-Stopping Images With AI (No Design Skills)

</h1>

          <p className="text-[#4A4A55] text-[12px] ">Learn how to create scroll-stopping images with AI without any design skills</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">04.02/2026</p>
          </div>
          </div>
          </Link>
 
                                                                  {/* Blog Card 36*/}

                <Link to="/blog/why-ai-images-outperform-real-photos" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">Why AI Images Outperform Real Photos

</h1>

          <p className="text-[#4A4A55] text-[12px] ">Learn why AI images outperform real photos in terms of quality, consistency, and creative control</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">04.02/2026</p>
          </div>
          </div>
          </Link>

           
                                                                  {/* Blog Card 37*/}

                <Link to="/blog/the-secret-prompts-behind-viral-ai-images" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">The Secret Prompts Behind Viral AI Images

</h1>

          <p className="text-[#4A4A55] text-[12px] ">Learn the secret prompts that make AI images go viral</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">05.02/2026</p>
          </div>
          </div>
          </Link>

                                                                  {/* Blog Card 38*/}

                <Link to="/blog/how-to-turn-any-idea-into-a-viral-image-using-ai" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">How to Turn Any Idea Into a Viral Image Using AI

</h1>

          <p className="text-[#4A4A55] text-[12px] ">Learn how to turn any idea into a viral image using AI</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">05.02/2026</p>
          </div>
          </div>
          </Link>

          
                                                                  {/* Blog Card 39*/}

                <Link to="/blog/all-ai-image-trends-you-need-to-jump-on" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">All AI Image Trends You Need to Jump On

</h1>

          <p className="text-[#4A4A55] text-[12px] ">Learn all the AI image trends you need to jump on in 2026</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">10.02/2026</p>
          </div>
          </div>
          </Link>

                                                                            {/* Blog Card 40*/}

                <Link to="/blog/why-your-posts-dont-go-viral" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">Why Your Posts Don't Go Viral

</h1>

          <p className="text-[#4A4A55] text-[12px] ">Learn why your posts don't go viral and how to fix it</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">10.02/2026</p>
          </div>
          </div>
          </Link>

                                                                                      {/* Blog Card 41*/}

                <Link to="/blog/best-ai-image-generator-for-social-media" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">Best AI Image Generator for Social Media Content

</h1>

          <p className="text-[#4A4A55] text-[12px] ">Learn how to choose the best AI image generator for social media content in 2026</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">11.02/2026</p>
          </div>
          </div>
          </Link>

                                                {/* Blog Card 42*/}

                <Link to="/blog/how-to-generate-high-quality-images-with-ai" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">How to Generate High-Quality Images With AI in Seconds

</h1>

          <p className="text-[#4A4A55] text-[12px] ">Learn how to generate high-quality images with AI in seconds</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">11.02/2026</p>
          </div>
          </div>
          </Link>

                                                          {/* Blog Card 43*/}

                <Link to="/blog/ai-image-generator-beginners-guide-2026" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">AI Image Generator: Complete Beginner’s Guide (2026)

</h1>

          <p className="text-[#4A4A55] text-[12px] ">Learn everything you need to know about AI image generators in 2026</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">12.02/2026</p>
          </div>
          </div>
          </Link>

                                                                    {/* Blog Card 44*/}

                <Link to="/blog/create-professional-images-with-ai" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">Create Professional Images with AI

</h1>

          <p className="text-[#4A4A55] text-[12px] ">Learn everything you need to know about creating professional images with AI in 2026</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">12.02/2026</p>
          </div>
          </div>
          </Link>

                                                                       {/* Blog Card 45*/}

                <Link to="/blog/ai-image-generator-vs-traditional-design" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">AI Image Generator vs Traditional Design: What Works Better?</h1>

          <p className="text-[#4A4A55] text-[12px] ">Learn how AI image generators compare to traditional design in 2026</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">15.02/2026</p>
          </div>
          </div>
          </Link>

                                                                                 {/* Blog Card 46*/}

                <Link to="/blog/top-ai-image-generator-features-that-matter" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">Top AI Image Generator Features That Actually Matter</h1>

          <p className="text-[#4A4A55] text-[12px] ">Learn about the most important features of AI image generators in 2026</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">15.02/2026</p>
          </div>
          </div>
          </Link>
        {/* Blog Card 47*/}

                <Link to="/blog/generate-images-for-ads-using-ai" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">How to Generate Images for Ads Using AI</h1>

          <p className="text-[#4A4A55] text-[12px] ">Lear how you can create high quality ads with the help of AI images</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">16.02/2026</p>
          </div>
          </div>
          </Link>

                  {/* Blog Card 48*/}

                <Link to="/blog/ai-image-generator-for-content-creators" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">AI Image Generator for Content Creators</h1>

          <p className="text-[#4A4A55] text-[12px] ">Learn which AI image generators are best for content creators and how to take advance of them</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">16.02/2026</p>
          </div>
          </div>
          </Link>

          
                  {/* Blog Card 49*/}

                <Link to="/blog/how-ai-image-generators-work" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">How AI Image Generators Work (Explained Simply)</h1>

          <p className="text-[#4A4A55] text-[12px] ">Learn how AI Image Generators work and take advantage of them right away</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">02.03/2026</p>
          </div>
          </div>
          </Link>

             
                  {/* Blog Card 50*/}

                <Link to="/blog/is-ai-image-generation-worth-it-for-creators" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">Is AI Image Generation Worth It for Creators?</h1>

          <p className="text-[#4A4A55] text-[12px] ">Learn how worth it Image Generation really is and what are the benefits with it.</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">02.03/2026</p>
          </div>
          </div>
          </Link>

                            {/* Blog Card 51*/}

                <Link to="/blog/top-ai-image-styles-that-go-viral-on-social-media" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">Top AI Image Styles That Go Viral on Social Media</h1>

          <p className="text-[#4A4A55] text-[12px] ">Learn the best styles that go viral on Social Media and how to benefit from them.</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">05.03/2026</p>
          </div>
          </div>
          </Link>

                                  {/* Blog Card 52*/}

                <Link to="/blog/how-to-create-minimalist-images-using-ai" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">How to Create Minimalist Images Using AI</h1>

          <p className="text-[#4A4A55] text-[12px] ">Learn how to create the best minimalist images using ai and how to benefit from them</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">05.03/2026</p>
          </div>
          </div>
          </Link>

          
                                  {/* Blog Card 53*/}

                <Link to="/blog/how-to-create-movie-style-visuals" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">Cinematic AI Images: How to Create Movie-Style Visuals</h1>

          <p className="text-[#4A4A55] text-[12px] ">Learn how to create the best movie style images using ai and how to benefit from them</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">11.03/2026</p>
          </div>
          </div>
          </Link>

              
                                  {/* Blog Card 54*/}

                <Link to="/blog/why-3d-ai-images-perform-better" className="p-4 rounded-md border-[#110829] border-[1px] hover:bg-black/5 transition-colors hover:border-[#7A3BFF]">
         
         <div className="gap-2 flex flex-col">
          <h1 className="text-black">3D AI Images: Why They Perform Better on Social Platforms</h1>

          <p className="text-[#4A4A55] text-[12px] ">Learn why 3D AI images perform way better on social platforms.</p>
          <div className="flex">
            <Calendar className="text-[#4A4A55] w-3 h-3 mr-1 "/>
          <p className="text-[#4A4A55] text-[10px] ">11.03/2026</p>
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
