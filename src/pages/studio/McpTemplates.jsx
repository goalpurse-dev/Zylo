import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Clock, Plus } from "lucide-react";
import { DISPLAY, FOCUS, MCP_H2, MCP_H3 } from "../../components/studio-kit/studioKitShared";
import TemplateVideo from "../../components/studio-kit/TemplateVideo";
import { mcpTemplatePath } from "../../data/studioKit";
import { MCP_TEMPLATES } from "../../data/mcpTemplates";

/** MCP > Templates (/workspace/mcp/templates): one card per template (data/mcpTemplates.js); a card opens its tutorial. */
export default function McpTemplates() {
  useEffect(() => { document.title = "Templates | MCP | Zyvo"; }, []);
  return (
    <div className="mt-6">
      <h2 style={DISPLAY} className={MCP_H2}>Templates</h2>
      <p className="mt-1.5 text-[14px] text-white/65">Pick one. Each has a free kit and a step-by-step guide.</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="mcp-template-grid">
        {MCP_TEMPLATES.map((t) => (
          <li key={t.id}>
            <Link to={mcpTemplatePath(t.id)} data-testid={`mcp-template-${t.id}`}
              className={`group flex h-full flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition hover:-translate-y-0.5 hover:border-lime-300/60 ${FOCUS}`}>
              {/* phone: a short 2:1 strip (the sign) so the title and the arrow show on the first screen; the tall frame from sm up */}
              <div className="relative aspect-[2/1] overflow-hidden bg-black sm:aspect-[4/5]">
                <img src={t.thumb} alt={t.thumbAlt} className="h-full w-full object-cover object-[center_12%] sm:object-top transition duration-500 group-hover:scale-[1.03]" loading="lazy" />
                <span className="absolute left-2.5 top-2.5 flex gap-1.5">
                  <span className="rounded-full bg-lime-300 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide text-[#11150D] shadow-lg">{t.badge}</span>
                  {t.beta && <span className="rounded-full border border-white/30 bg-black/70 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide text-white shadow-lg">Beta</span>}
                </span>
                <span className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/85 to-transparent" aria-hidden="true" />
                <span className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 text-[11.5px] font-bold text-white/85"><Clock className="h-3 w-3" aria-hidden="true" />{t.time}</span>
              </div>
              <div className="flex flex-1 items-start justify-between gap-3 p-3.5">
                <div>
                  <p style={DISPLAY} className="text-[21px] font-extrabold uppercase leading-none text-white group-hover:text-lime-200">{t.title}</p>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-white/65">{t.pitch}</p>
                </div>
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-lime-300 text-[#11150D] transition group-hover:translate-x-0.5"><ArrowRight className="h-4 w-4" aria-hidden="true" /></span>
              </div>
            </Link>
          </li>
        ))}
        <li className="flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 p-5 text-center" aria-label="More templates coming">
          <span className="grid h-9 w-9 place-items-center rounded-full border border-white/15 text-white/45"><Plus className="h-4 w-4" aria-hidden="true" /></span>
          <p className="text-[13.5px] font-bold text-white/60">More templates coming</p>
        </li>
      </ul>
      {/* the templates' video tutorials (the owner's YouTube videos) */}
      {MCP_TEMPLATES.filter((t) => t.video).map((t) => (
        <TemplateVideo key={t.id} id={t.video} slug="mcp-templates" heading={`Watch: ${t.title} tutorial`} headingClass={MCP_H3} className="mt-8" />
      ))}
    </div>
  );
}
