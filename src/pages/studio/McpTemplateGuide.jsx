import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Clock, Copy, Download, ExternalLink, Folder, FileText, Loader2, MonitorPlay, Plug, Wrench } from "lucide-react";
import AuthModal from "../../components/AuthModal";
import BeforeAfter from "../../components/studio-kit/BeforeAfter";
import { CARD, DISPLAY, FOCUS, PRIMARY, SECONDARY } from "../../components/studio-kit/studioKitShared";
import { useKitDownload } from "../../components/studio-kit/useKitDownload";
import { FREE_VS_FINISH, MCP_CONNECT_PATH, MCP_STUDIO_PATH, MCP_TEMPLATES_PATH, REQUIREMENTS, mcpTemplatePath } from "../../data/studioKit";
import { getMcpTemplate } from "../../data/mcpTemplates";
import "../../components/studio-kit/studioKit.css";

/**
 * MCP > Templates > <template> (/workspace/mcp/templates/:id): one template's tutorial, top to bottom: what you need,
 * the kit download (sign-in needed), the steps in order (real pictures where we have them, our own click diagrams
 * elsewhere), common problems and the free-vs-Zyvo slider. Everything comes from data/mcpTemplates.js.
 */
export default function McpTemplateGuide() {
  const { id } = useParams();
  const t = getMcpTemplate(id);
  const kit = useKitDownload();
  useEffect(() => { if (t) document.title = `${t.title} template | MCP | Zyvo`; }, [t]);
  if (!t) return <Navigate to={MCP_TEMPLATES_PATH} replace />;

  return (
    <div className="mt-6">
      <Link to={MCP_TEMPLATES_PATH} className={`inline-flex min-h-11 items-center gap-1.5 text-[14px] font-bold text-white/70 hover:text-white ${FOCUS}`}><ArrowLeft className="h-4 w-4" aria-hidden="true" />All templates</Link>

      {/* the hero: the template, the free kit, the time */}
      <section className="mt-2 grid gap-6 rounded-[26px] border-2 border-lime-300/20 bg-gradient-to-b from-[#121a0d] to-[#0B0D0F] p-5 sm:p-8 md:grid-cols-[minmax(0,1fr)_220px] md:items-center">
        <div>
          <span className="rounded-full bg-lime-300 px-3 py-1 text-[12.5px] font-black uppercase tracking-wide text-[#11150D]">{t.badge}</span>
          <h2 style={DISPLAY} className="mt-3 text-[44px] font-extrabold uppercase leading-[0.9] text-white sm:text-[60px]">{t.title}</h2>
          <p className="mt-2 max-w-[560px] text-[16px] leading-7 text-white/75">{t.pitch}</p>
          <p className="mt-2 flex items-center gap-1.5 text-[14px] font-bold text-white/60"><Clock className="h-4 w-4" aria-hidden="true" />{t.time} · {t.steps.length} steps</p>
          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
            <KitButton kit={kit} big />
            <a href="#steps" className={`${SECONDARY} min-h-14 px-6 text-[16px]`}>See the steps<ChevronDown className="h-5 w-5" aria-hidden="true" /></a>
          </div>
          {kit.notice && <p className="mt-2 text-[13.5px] text-amber-200" role="status">{kit.notice}</p>}
        </div>
        <img src={t.thumb} alt={t.thumbAlt} className="mx-auto hidden aspect-[9/16] w-[220px] rounded-2xl border border-white/10 object-cover md:block" />
      </section>

      {/* what you need */}
      <section className="mt-10" aria-labelledby="g-needs">
        <h3 id="g-needs" style={DISPLAY} className="text-[30px] font-extrabold uppercase leading-none text-white">What you need</h3>
        <ul className="mt-4 grid gap-3 md:grid-cols-3">
          {t.needs.map((n) => (
            <li key={n.title} className={`${CARD} flex flex-col p-5`}>
              <p className="flex items-center gap-2 text-[16.5px] font-black text-white"><Check className="h-5 w-5 shrink-0 text-lime-300" aria-hidden="true" />{n.title}</p>
              <p className="mt-1.5 flex-1 text-[14.5px] leading-relaxed text-white/65">{n.text}</p>
              {n.link && <a href={n.link.href} target="_blank" rel="noreferrer" className={`mt-3 inline-flex items-center gap-1.5 text-[14px] font-bold text-lime-200 underline underline-offset-4 ${FOCUS}`}>{n.link.label}<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></a>}
            </li>
          ))}
        </ul>
        <details className="group mt-3">
          <summary className={`inline-flex min-h-11 cursor-pointer list-none items-center gap-1 text-[14px] font-bold text-white/70 hover:text-white ${FOCUS}`}>The full system check<ChevronDown className="h-4 w-4 transition group-open:rotate-180" aria-hidden="true" /></summary>
          <ul className="mt-1 space-y-1.5 text-[14px] leading-relaxed text-white/65">
            {REQUIREMENTS.map((r) => <li key={r} className="flex gap-2"><Check className="mt-1 h-3.5 w-3.5 shrink-0 text-lime-300" aria-hidden="true" />{r}</li>)}
          </ul>
        </details>
      </section>

      {/* the steps */}
      <section id="steps" className="mt-12 scroll-mt-6" aria-labelledby="g-steps">
        <h3 id="g-steps" style={DISPLAY} className="text-[30px] font-extrabold uppercase leading-none text-white">Step by step</h3>
        <ol className="mt-5 space-y-5">
          {t.steps.map((s, i) => <StepCard key={s.id} s={s} n={i + 1} kit={kit} />)}
        </ol>
      </section>

      {/* common problems */}
      <section className="mt-12" aria-labelledby="g-problems">
        <h3 id="g-problems" style={DISPLAY} className="text-[30px] font-extrabold uppercase leading-none text-white">Common problems</h3>
        <div className="mt-4 grid gap-3">
          {t.problems.map(({ q, a }) => (
            <details key={q} className="group rounded-2xl border-2 border-white/10 bg-white/[0.03] px-5 py-4 open:border-lime-300/40">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[16px] font-black text-white">
                <span className="flex items-center gap-2.5"><Wrench className="h-4 w-4 shrink-0 text-lime-300" aria-hidden="true" />{q}</span><span className="text-[22px] text-lime-300 transition group-open:rotate-45" aria-hidden="true">+</span>
              </summary>
              <p className="pt-3 text-[15px] leading-7 text-white/75">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* free vs Zyvo */}
      <section className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center" aria-labelledby="g-compare">
        <div>
          <h3 id="g-compare" style={DISPLAY} className="text-[30px] font-extrabold uppercase leading-none text-white">Free kit vs Finish in Zyvo</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-white/70">The same 14 seconds of our Bedtime Story. Drag the handle.</p>
          <FreeVsFinish />
        </div>
        <BeforeAfter />
      </section>

      {kit.needSignUp && <AuthModal mode="signup" title="Get the free kit" subtitle="A free Zyvo account is all you need." returnTo={mcpTemplatePath(t.id)} onClose={kit.closeSignUp} />}
    </div>
  );
}

function KitButton({ kit, big = false }) {
  return (
    <button type="button" onClick={kit.download} disabled={kit.busy} className={`${PRIMARY} ${big ? "min-h-14 px-6 text-[17px]" : "min-h-12 px-5 text-[16px]"}`} data-testid="kit-download">
      {kit.busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Download className="h-5 w-5" aria-hidden="true" />}Download the free kit
    </button>
  );
}

function FreeVsFinish() {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <div className="rounded-2xl border-2 border-white/10 bg-white/[0.03] p-4">
        <p className="text-[12px] font-black uppercase tracking-[0.14em] text-white/55">Free kit</p>
        <ul className="mt-2 space-y-1.5 text-[14px] text-white/75">{FREE_VS_FINISH.free.map((x) => <li key={x} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-white/50" aria-hidden="true" />{x}</li>)}</ul>
      </div>
      <div className="rounded-2xl border-2 border-lime-300/30 bg-lime-300/[0.05] p-4">
        <p className="text-[12px] font-black uppercase tracking-[0.14em] text-lime-300">Finish in Zyvo adds</p>
        <ul className="mt-2 space-y-1.5 text-[14px] text-lime-50/90">{FREE_VS_FINISH.finish.map((x) => <li key={x} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-lime-300" aria-hidden="true" />{x}</li>)}</ul>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- one step
function StepCard({ s, n, kit }) {
  const visual = s.shots?.length || s.diagram;
  return (
    <li id={`step-${s.id}`} className={`${CARD} scroll-mt-6 overflow-hidden`}>
      <div className={`grid gap-5 p-5 sm:p-6 ${visual && !s.shots ? "lg:grid-cols-[minmax(0,1fr)_400px]" : ""}`}>
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-lime-300 text-[22px] font-black text-[#11150D] shadow-[0_0_26px_-6px_rgba(190,242,100,0.7)]">{n}</span>
            <p className="text-[21px] font-black leading-tight text-white sm:text-[23px]">{s.title}</p>
          </div>
          <p className="mt-3 text-[15.5px] leading-7 text-white/80">{s.text}</p>
          {s.bullets && (
            <ul className="mt-3 space-y-2">
              {s.bullets.map((b) => <li key={b} className="flex gap-2.5 text-[15px] leading-relaxed text-white/80"><Check className="mt-1 h-4 w-4 shrink-0 text-lime-300" aria-hidden="true" /><span className="min-w-0 break-words">{b}</span></li>)}
            </ul>
          )}
          {s.commands && (
            <div className="mt-3 space-y-2.5">
              {s.commands.map((c) => <CopyLine key={c.label} label={c.label} value={c.value} />)}
            </div>
          )}
          {s.after && <p className="mt-3 text-[15px] leading-7 text-white/80">{s.after}</p>}
          {s.prompt && <div className="mt-3"><CopyLine label={s.promptLabel ?? "The prompt"} value={s.prompt} big /></div>}
          {s.download && <div className="mt-4"><KitButton kit={kit} />{kit.notice && <p className="mt-2 text-[13.5px] text-amber-200" role="status">{kit.notice}</p>}</div>}
          {s.connectZyvo && (
            <Link to={MCP_CONNECT_PATH} className={`mt-4 flex items-center justify-between gap-3 rounded-xl border-2 border-dashed border-white/15 px-4 py-3 transition hover:border-lime-300/50 ${FOCUS}`}>
              <span className="flex items-center gap-2.5"><Plug className="h-5 w-5 shrink-0 text-lime-300" aria-hidden="true" /><span><span className="block text-[15px] font-black text-white">Optional: connect Zyvo too</span><span className="text-[13.5px] text-white/60">For story ideas, our voice and Finish my video</span></span></span>
              <ArrowRight className="h-5 w-5 shrink-0 text-lime-300" aria-hidden="true" />
            </Link>
          )}
          {s.finish && <FinishChoices />}
        </div>
        {s.diagram && !s.shots && <Diagram d={s.diagram} />}
      </div>
      {s.shots && <Shots shots={s.shots} />}
    </li>
  );
}

/** real pictures from the Bedtime Story test: a row of four, the wide one (the contact sheet) under them */
function Shots({ shots }) {
  const small = shots.filter((x) => !x.wide), wide = shots.filter((x) => x.wide);
  return (
    <div className="border-t border-white/[0.07] bg-black/30 p-4 sm:p-5">
      <p className="mb-3 text-[12px] font-black uppercase tracking-[0.14em] text-white/50">From our Bedtime Story test</p>
      <ul className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {small.map((x) => (
          <li key={x.src}><figure className="overflow-hidden rounded-xl border border-white/10"><img src={x.src} alt={x.alt} loading="lazy" className="aspect-[880/713] w-full object-cover" /><figcaption className="bg-black/60 px-2.5 py-1.5 text-[12.5px] font-black text-white">{x.caption}</figcaption></figure></li>
        ))}
      </ul>
      {wide.map((x) => (
        <figure key={x.src} className="mt-2.5 overflow-hidden rounded-xl border border-white/10"><img src={x.src} alt={x.alt} loading="lazy" className="w-full" /><figcaption className="bg-black/60 px-2.5 py-1.5 text-[12.5px] font-black text-white">{x.caption}: every shot, checked before you record</figcaption></figure>
      ))}
    </div>
  );
}

/** our own drawings of the clicks (not another app's screen): a folder path, a click path + switch, a terminal, a prompt, a chat, a checklist */
function Diagram({ d }) {
  const frame = "rounded-2xl border border-white/12 bg-[#0f1214] p-4 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.8)]";
  if (d.kind === "chat") {
    return (
      <div className={`${frame} space-y-2`} aria-hidden="true">
        {d.lines.map((l, i) => (
          l.who === "you"
            ? <p key={i} className={`ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-lime-300 px-3.5 py-2 text-[14.5px] font-bold text-[#11150D] ${l.t.startsWith("/") ? "font-mono" : ""}`}>{l.t}</p>
            : <p key={i} className="w-fit max-w-[90%] whitespace-pre-line rounded-2xl rounded-bl-md border border-white/12 bg-white/[0.06] px-3.5 py-2 text-[14px] leading-relaxed text-white/90">{l.t}</p>
        ))}
      </div>
    );
  }
  if (d.kind === "folders") {
    return (
      <div className={frame} aria-hidden="true">
        <p className="mb-3 flex flex-wrap items-center gap-1 font-mono text-[13px] text-white/70">{d.path.map((p, i) => <span key={p} className="flex items-center gap-1">{i > 0 && <span className="text-white/30">/</span>}<span className={i === d.path.length - 1 ? "rounded bg-lime-300 px-1.5 font-bold text-[#11150D]" : ""}>{p}</span></span>)}</p>
        <ul className="space-y-1.5">
          {d.files.map((f) => <li key={f} className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-2 font-mono text-[13px] text-white/80">{/\./.test(f) ? <FileText className="h-4 w-4 text-white/45" /> : <Folder className="h-4 w-4 text-lime-300/80" />}{f}</li>)}
        </ul>
      </div>
    );
  }
  if (d.kind === "clicks") {
    return (
      <div className={frame} aria-hidden="true">
        <div className="flex flex-wrap items-center gap-1.5">
          {d.path.map((p, i) => <span key={p} className="flex items-center gap-1.5">{i > 0 && <ArrowRight className="h-4 w-4 text-white/35" />}<span className="rounded-lg border border-white/15 bg-white/[0.06] px-2.5 py-1.5 text-[13.5px] font-bold text-white">{p}</span></span>)}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border-2 border-lime-300/50 bg-lime-300/[0.07] px-4 py-3">
          <span className="text-[14.5px] font-bold text-white">{d.toggle}</span>
          <span className="relative h-7 w-12 shrink-0 rounded-full bg-lime-300"><span className="absolute right-1 top-1 h-5 w-5 rounded-full bg-[#11150D]" /></span>
        </div>
      </div>
    );
  }
  if (d.kind === "terminal") {
    return (
      <div className={`${frame} font-mono text-[13.5px]`} aria-hidden="true">
        <div className="mb-3 flex gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-white/20" /><span className="h-2.5 w-2.5 rounded-full bg-white/20" /><span className="h-2.5 w-2.5 rounded-full bg-white/20" /></div>
        {d.lines.map((l) => <p key={l.t} className="flex items-center justify-between gap-3 py-1 text-white/85">{l.t}{l.ok && <span className="flex items-center gap-1 font-bold text-lime-300"><Check className="h-4 w-4" />{l.ok}</span>}</p>)}
      </div>
    );
  }
  if (d.kind === "prompt") {
    return (
      <div className={frame} aria-hidden="true">
        <p className="text-[12px] font-black uppercase tracking-[0.14em] text-white/45">Example</p>
        <p className="mt-2 rounded-xl border border-white/12 bg-black/40 px-3.5 py-3 text-[14.5px] leading-relaxed text-white">{d.example}</p>
      </div>
    );
  }
  return (
    <div className={frame} aria-hidden="true">
      <ul className="space-y-2">
        {d.items.map((x) => <li key={x} className="flex items-center gap-2.5 rounded-lg bg-white/[0.04] px-3 py-2.5 text-[14.5px] font-bold text-white"><span className="grid h-6 w-6 place-items-center rounded-md bg-lime-300 text-[#11150D]"><Check className="h-4 w-4" /></span>{x}</li>)}
      </ul>
    </div>
  );
}

function FinishChoices() {
  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <div className="rounded-2xl border-2 border-white/10 bg-white/[0.03] p-4">
        <p className="text-[12px] font-black uppercase tracking-[0.14em] text-white/55">Free, in the kit</p>
        <p className="mt-1.5 text-[16px] font-black text-white">final_free.mp4</p>
        <p className="mt-1 text-[14.5px] leading-relaxed text-white/70">Your voice and simple white one-word captions, ready to post.</p>
      </div>
      <Link to={MCP_STUDIO_PATH} className={`group rounded-2xl border-2 border-lime-300/35 bg-lime-300/[0.06] p-4 transition hover:border-lime-300 ${FOCUS}`}>
        <p className="text-[12px] font-black uppercase tracking-[0.14em] text-lime-300">Or Finish in Zyvo</p>
        <p className="mt-1.5 flex items-center gap-2 text-[16px] font-black text-white"><MonitorPlay className="h-5 w-5 text-lime-300" aria-hidden="true" />MCP Studio</p>
        <p className="mt-1 text-[14.5px] leading-relaxed text-lime-50/85">Our voice, coloured captions, sound effects and music. Your first finish is free.</p>
        <span className="mt-2 inline-flex items-center gap-1 text-[14px] font-bold text-lime-200">Open MCP Studio<ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" /></span>
      </Link>
    </div>
  );
}

function CopyLine({ label, value, big = false }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1600); } catch { /* selectable */ } };
  return (
    <div className={`overflow-hidden rounded-xl border ${big ? "border-lime-300/40" : "border-white/15"} bg-black/40`}>
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-1.5">
        <span className="text-[12px] font-black uppercase tracking-[0.12em] text-white/55">{label}</span>
        <button type="button" onClick={copy} className={`flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13.5px] font-bold ${copied ? "text-lime-200" : "text-white"} hover:bg-white/10 ${FOCUS}`}>
          {copied ? <Check className="h-4 w-4 text-lime-300" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}{copied ? "Copied" : "Copy"}
        </button>
      </div>
      <code className={`block select-all break-all px-3 py-2.5 font-mono leading-relaxed text-lime-100 ${big ? "text-[15px]" : "text-[13px]"}`}>{value}</code>
    </div>
  );
}
