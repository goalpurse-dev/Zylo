import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Clock, Plus } from "lucide-react";
import { DISPLAY, FOCUS } from "../../components/studio-kit/studioKitShared";
import { mcpTemplatePath } from "../../data/studioKit";
import { MCP_TEMPLATES } from "../../data/mcpTemplates";

/** MCP > Templates (/workspace/mcp/templates): one card per template (data/mcpTemplates.js); a card opens its tutorial. */
export default function McpTemplates() {
  useEffect(() => { document.title = "Templates | MCP | Zyvo"; }, []);
  return (
    <div className="mt-8">
      <h2 style={DISPLAY} className="text-[34px] font-extrabold uppercase leading-[0.95] text-white sm:text-[46px]">Templates</h2>
      <p className="mt-1 text-[15px] text-white/70">Pick one. Each has a free kit and a step-by-step guide.</p>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="mcp-template-grid">
        {MCP_TEMPLATES.map((t) => (
          <li key={t.id}>
            <Link to={mcpTemplatePath(t.id)} data-testid={`mcp-template-${t.id}`}
              className={`group flex h-full flex-col overflow-hidden rounded-2xl border-2 border-white/10 bg-white/[0.03] transition hover:-translate-y-0.5 hover:border-lime-300/60 ${FOCUS}`}>
              {/* phone: a short 2:1 strip (the sign) so the title and the arrow show on the first screen; the tall frame from sm up */}
              <div className="relative aspect-[2/1] overflow-hidden bg-black sm:aspect-[4/5]">
                <img src={t.thumb} alt={t.thumbAlt} className="h-full w-full object-cover object-[center_12%] sm:object-top transition duration-500 group-hover:scale-[1.03]" loading="lazy" />
                <span className="absolute left-3 top-3 rounded-full bg-lime-300 px-3 py-1 text-[12.5px] font-black uppercase tracking-wide text-[#11150D] shadow-lg">{t.badge}</span>
                <span className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/85 to-transparent" aria-hidden="true" />
                <span className="absolute bottom-3 left-3 flex items-center gap-1.5 text-[12.5px] font-bold text-white/85"><Clock className="h-3.5 w-3.5" aria-hidden="true" />{t.time}</span>
              </div>
              <div className="flex flex-1 items-start justify-between gap-3 p-4">
                <div>
                  <p style={DISPLAY} className="text-[28px] font-extrabold uppercase leading-none text-white group-hover:text-lime-200">{t.title}</p>
                  <p className="mt-1.5 text-[14.5px] leading-relaxed text-white/70">{t.pitch}</p>
                </div>
                <span className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-lime-300 text-[#11150D] transition group-hover:translate-x-0.5"><ArrowRight className="h-5 w-5" aria-hidden="true" /></span>
              </div>
            </Link>
          </li>
        ))}
        <li className="flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/12 p-6 text-center" aria-label="More templates coming">
          <span className="grid h-11 w-11 place-items-center rounded-full border border-white/15 text-white/45"><Plus className="h-5 w-5" aria-hidden="true" /></span>
          <p className="text-[15px] font-black text-white/60">More templates coming</p>
        </li>
      </ul>
    </div>
  );
}
