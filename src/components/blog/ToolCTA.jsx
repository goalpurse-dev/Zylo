import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export default function ToolCTA({ relatedTool }) {
  if (!relatedTool) return null;

  return (
    <section className="mt-16 rounded-2xl border border-purple-200 bg-purple-50 p-8 text-center">
      <p className="text-[13px] font-bold uppercase tracking-wide text-[#7A3BFF] mb-2">Create This With Zyvo</p>
      <p className="text-[17px] text-[#110829] font-semibold mb-6">Turn this idea into content with Zyvo.</p>
      <Link
        to={relatedTool.href}
        className="inline-flex items-center gap-2 bg-gradient-to-r from-[#7A3BFF] to-[#A855F7] text-white font-bold text-[15px] px-8 py-4 rounded-[14px] hover:opacity-90 transition"
      >
        Try {relatedTool.name}
        <ArrowRight className="w-4 h-4" aria-hidden="true" />
      </Link>
    </section>
  );
}
