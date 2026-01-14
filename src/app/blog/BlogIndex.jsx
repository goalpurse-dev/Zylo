import { Link } from "react-router-dom";
import Footer from "../../components/workspace/footer.jsx";
import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useEffect } from "react";

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

    <div className="max-w-2xl mx-auto ">
    <p className="text-[#110829] font-semibold text-[16px]">All the blogs</p>


    <div className="py-4 "> 
    <div className=" border-[#110829] border-[1px]  py-10 bg-white rounded-md px-10 flex flex-col gap-6 ">
        
        <Link className="text-[#110829] underline hover:text-[#7A3BFF] text-[16px]" to="/blog/product-photos-with-ai-for-shopify">Product Photos with AI for Shopify</Link>
         <Link className="text-[#110829] underline hover:text-[#7A3BFF] text-[16px]" to="/blog/product-photos-for-shopify-store">Product Photos with AI for Shopify stores</Link>
          <Link className="text-[#110829] underline hover:text-[#7A3BFF] text-[16px]" to="/blog/AI-product-photos-increase-conversion-rates">How AI Product Photos Increase Conversion Rates</Link>
          <Link className="text-[#110829] underline hover:text-[#7A3BFF] text-[16px]" to="/blog/best-ai-tools-for-ecommerce">Best AI Tools for Ecommerce Product Photography</Link>
          <Link className="text-[#110829] underline hover:text-[#7A3BFF] text-[16px]" to="/blog/shopify-product-photo-best-practices">Shopify Product Photo Best Practices</Link>
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
