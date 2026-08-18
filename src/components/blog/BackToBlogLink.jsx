import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function BackToBlogLink() {
  return (
    <div className="mt-12 text-center">
      <Link to="/blog" className="inline-flex items-center gap-2 text-[14px] font-semibold text-[#7A3BFF] hover:underline">
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        Back to Zyvo Blog
      </Link>
    </div>
  );
}
