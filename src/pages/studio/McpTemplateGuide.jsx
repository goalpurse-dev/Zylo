import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Clock, Copy, Download, ExternalLink, Folder, FileText, Film, Loader2, MonitorPlay, Plug, Wrench } from "lucide-react";
import AuthModal from "../../components/AuthModal";
import BeforeAfter from "../../components/studio-kit/BeforeAfter";
import { DISPLAY, FOCUS, MCP_CARD as CARD, MCP_H3, MCP_PRIMARY as PRIMARY, MCP_SECONDARY as SECONDARY } from "../../components/studio-kit/studioKitShared";
import { useKitDownload } from "../../components/studio-kit/useKitDownload";
import { FREE_VS_FINISH, MCP_CONNECT_PATH, MCP_STUDIO_PATH, MCP_TEMPLATES_PATH, REQUIREMENTS, mcpTemplatePath } from "../../data/studioKit";
import { END_CARD, getMcpTemplate } from "../../data/mcpTemplates";
import "../../components/studio-kit/studioKit.css";

/**
 * MCP > Templates > <template> (/workspace/mcp/templates/:id): one template's tutorial, top to bottom: what you need,
 * the kit download (sign-in needed), the steps in order (real pictures where we have them, our own click diagrams
 * elsewhere), common problems and the free-vs-Zyvo slider. Everything comes from data/mcpTemplates.js. Sized like the
 * rest of the dashboard (owner 2026-11-20, item 15); no hidden steps (item 17).
 */
export default function McpTemplateGuide() {
  const { id } = useParams();
  const t = getMcpTemplate(id);
  const kit = useKitDownload();
  useEffect(() => { if (t) document.title = `${t.title} template | MCP | Zyvo`; }, [t]);
  if (!t) return <Navigate to={MCP_TEMPLATES_PATH} replace />;

  return (
    <div className="mt-4">
      <Link to={MCP_TEMPLATES_PATH} className={`inline-flex min-h-10 items-center gap-1.5 text-[13px] font-bold text-white/65 hover:text-white ${FOCUS}`}><ArrowLeft className="h-4 w-4" aria-hidden="true" />All templates</Link>

      {/* the hero: the template, the free kit, the time */}
      <section className="mt-1 grid gap-5 rounded-2xl border border-lime-300/20 bg-gradient-to-b from-[#121a0d] to-[#0B0D0F] p-4 sm:p-6 md:grid-cols-[minmax(0,1fr)_150px] md:items-center">
        <div>
          <span className="rounded-full bg-lime-300 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide text-[#11150D]">{t.badge}</span>
          {t.beta && <span className="ml-1.5 rounded-full border border-white/30 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide text-white">Beta</span>}
          <h2 style={DISPLAY} className="mt-2.5 text-[30px] font-extrabold uppercase leading-none text-white sm:text-[34px]">{t.title}</h2>
          <p className="mt-1.5 max-w-[560px] text-[14px] leading-relaxed text-white/75">{t.pitch}</p>
          <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] font-bold text-white/55"><Clock className="h-3.5 w-3.5" aria-hidden="true" />{t.time} · {t.steps.length} steps</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <KitButton kit={kit} />
            <a href="#steps" className={SECONDARY}>See the steps<ChevronDown className="h-4 w-4" aria-hidden="true" /></a>
          </div>
          {kit.notice && <p className="mt-2 text-[13px] text-amber-200" role="status">{kit.notice}</p>}
        </div>
        <img src={t.thumb} alt={t.thumbAlt} className="mx-auto hidden aspect-[9/16] w-[150px] rounded-xl border border-white/10 object-cover md:block" />
      </section>

      {/* what you need */}
      <section className="mt-8" aria-labelledby="g-needs">
        <h3 id="g-needs" style={DISPLAY} className={MCP_H3}>What you need</h3>
        <ul className="mt-3 grid gap-2.5 md:grid-cols-3">
          {t.needs.map((n) => (
            <li key={n.title} className={`${CARD} flex flex-col p-4`}>
              <p className="flex items-center gap-2 text-[14.5px] font-bold text-white"><Check className="h-4 w-4 shrink-0 text-lime-300" aria-hidden="true" />{n.title}</p>
              <p className="mt-1 flex-1 text-[13.5px] leading-relaxed text-white/65">{n.text}</p>
              {n.link && <a href={n.link.href} target="_blank" rel="noreferrer" className={`mt-2.5 inline-flex items-center gap-1.5 text-[13px] font-bold text-lime-200 underline underline-offset-4 ${FOCUS}`}>{n.link.label}<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></a>}
            </li>
          ))}
        </ul>
        <details className="group mt-2">
          <summary className={`inline-flex min-h-10 cursor-pointer list-none items-center gap-1 text-[13px] font-bold text-white/65 hover:text-white ${FOCUS}`}>The full system check<ChevronDown className="h-4 w-4 transition group-open:rotate-180" aria-hidden="true" /></summary>
          <ul className="mt-1 space-y-1.5 text-[13px] leading-relaxed text-white/65">
            {REQUIREMENTS.map((r) => <li key={r} className="flex gap-2"><Check className="mt-1 h-3.5 w-3.5 shrink-0 text-lime-300" aria-hidden="true" />{r}</li>)}
          </ul>
        </details>
      </section>

      {/* the steps */}
      <section id="steps" className="mt-8 scroll-mt-6" aria-labelledby="g-steps">
        <h3 id="g-steps" style={DISPLAY} className={MCP_H3}>Step by step</h3>
        <ol className="mt-3 space-y-3">
          {t.steps.map((s, i) => <StepCard key={s.id} s={s} n={i + 1} kit={kit} />)}
        </ol>
      </section>

      {/* common problems */}
      <section className="mt-8" aria-labelledby="g-problems">
        <h3 id="g-problems" style={DISPLAY} className={MCP_H3}>Common problems</h3>
        <div className="mt-3 grid gap-2">
          {t.problems.map(({ q, a }) => (
            <details key={q} className="group rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 open:border-lime-300/40">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[14px] font-bold text-white">
                <span className="flex items-center gap-2"><Wrench className="h-3.5 w-3.5 shrink-0 text-lime-300" aria-hidden="true" />{q}</span><span className="text-[18px] leading-none text-lime-300 transition group-open:rotate-45" aria-hidden="true">+</span>
              </summary>
              <p className="break-words pt-2 text-[13.5px] leading-relaxed text-white/75">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* free vs Zyvo */}
      <section className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-center" aria-labelledby="g-compare">
        <div>
          <h3 id="g-compare" style={DISPLAY} className={MCP_H3}>Free kit vs Finish in Zyvo</h3>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/65">The same 14 seconds of our Bedtime Story. Drag the handle.</p>
          <FreeVsFinish />
        </div>
        <BeforeAfter />
      </section>

      {kit.needSignUp && <AuthModal mode="signup" title="Get the free kit" subtitle="A free Zyvo account is all you need." returnTo={mcpTemplatePath(t.id)} onClose={kit.closeSignUp} />}
    </div>
  );
}

function KitButton({ kit }) {
  return (
    <button type="button" onClick={kit.download} disabled={kit.busy} className={PRIMARY} data-testid="kit-download">
      {kit.busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}Download the free kit
    </button>
  );
}

function FreeVsFinish() {
  return (
    <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/55">Free kit</p>
        <ul className="mt-2 space-y-1.5 text-[13px] text-white/75">{FREE_VS_FINISH.free.map((x) => <li key={x} className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/50" aria-hidden="true" />{x}</li>)}</ul>
      </div>
      <div className="rounded-xl border border-lime-300/30 bg-lime-300/[0.05] p-3.5">
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-lime-300">Finish in Zyvo adds</p>
        <ul className="mt-2 space-y-1.5 text-[13px] text-lime-50/90">{FREE_VS_FINISH.finish.map((x) => <li key={x} className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lime-300" aria-hidden="true" />{x}</li>)}</ul>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- one step
function StepCard({ s, n, kit }) {
  const diagrams = s.diagram ? [].concat(s.diagram) : [];
  const side = diagrams.length > 0 && !s.shots;
  return (
    <li id={`step-${s.id}`} className={`${CARD} scroll-mt-6 overflow-hidden`}>
      <div className={`grid gap-4 p-4 sm:p-5 ${side ? "lg:grid-cols-[minmax(0,1fr)_330px]" : ""}`}>
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-lime-300 text-[14px] font-black text-[#11150D]">{n}</span>
            <p className="text-[16px] font-black leading-tight text-white sm:text-[17px]">{s.title}</p>
          </div>
          <p className="mt-2.5 text-[14px] leading-relaxed text-white/80">{s.text}</p>
          {s.download && <div className="mt-3"><KitButton kit={kit} />{kit.notice && <p className="mt-2 text-[13px] text-amber-200" role="status">{kit.notice}</p>}</div>}
          {s.prompt && <div className="mt-2.5"><CopyLine label={s.promptLabel ?? "The prompt"} value={s.prompt} big /></div>}
          {s.bullets && (
            <ul className="mt-2.5 space-y-1.5">
              {s.bullets.map((b) => <li key={b} className="flex gap-2 text-[13.5px] leading-relaxed text-white/80"><Check className="mt-1 h-3.5 w-3.5 shrink-0 text-lime-300" aria-hidden="true" /><span className="min-w-0 break-words">{b}</span></li>)}
            </ul>
          )}
          {s.between && <p className="mt-2.5 text-[14px] leading-relaxed text-white/80">{s.between}</p>}
          {s.commands && (
            <div className="mt-2.5 space-y-2">
              {s.commands.map((c) => <CopyLine key={c.label} label={c.label} value={c.value} />)}
            </div>
          )}
          {s.after && <p className="mt-2.5 text-[14px] leading-relaxed text-white/80">{s.after}</p>}
          {s.alt && <div className="mt-2.5"><CopyLine label={s.alt.label} value={s.alt.value} quiet /></div>}
          {s.connectHelp && (
            <Link to={MCP_CONNECT_PATH} className={`mt-3 flex items-center justify-between gap-3 rounded-lg border border-dashed border-white/15 px-3.5 py-2.5 transition hover:border-lime-300/50 ${FOCUS}`}>
              <span className="flex items-center gap-2.5"><Plug className="h-4 w-4 shrink-0 text-lime-300" aria-hidden="true" /><span><span className="block text-[13.5px] font-bold text-white">The Connect tab</span><span className="text-[12.5px] text-white/55">Copy buttons, both ways and Test my connection</span></span></span>
              <ArrowRight className="h-4 w-4 shrink-0 text-lime-300" aria-hidden="true" />
            </Link>
          )}
          {s.finish && <FinishChoices />}
          {s.endCard && <EndCard />}
        </div>
        {side && <div className="space-y-3">{diagrams.map((d, i) => <Diagram key={i} d={d} />)}</div>}
      </div>
      {s.shots && <Shots shots={s.shots} />}
    </li>
  );
}

/** real pictures from the Bedtime Story test: a row of four, the wide one (the contact sheet) under them */
function Shots({ shots }) {
  const small = shots.filter((x) => !x.wide), wide = shots.filter((x) => x.wide);
  return (
    <div className="border-t border-white/[0.07] bg-black/30 p-3.5 sm:p-4">
      <p className="mb-2.5 text-[11px] font-black uppercase tracking-[0.14em] text-white/50">From our Bedtime Story test</p>
      <ul className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {small.map((x) => (
          <li key={x.src}><figure className="overflow-hidden rounded-lg border border-white/10"><img src={x.src} alt={x.alt} loading="lazy" className="aspect-[880/713] w-full object-cover" /><figcaption className="bg-black/60 px-2 py-1 text-[11.5px] font-bold text-white">{x.caption}</figcaption></figure></li>
        ))}
      </ul>
      {wide.map((x) => (
        <figure key={x.src} className="mt-2 overflow-hidden rounded-lg border border-white/10"><img src={x.src} alt={x.alt} loading="lazy" className="w-full" /><figcaption className="bg-black/60 px-2 py-1 text-[11.5px] font-bold text-white">{x.caption}: every shot, checked before you record</figcaption></figure>
      ))}
    </div>
  );
}

/** our own drawings of the clicks (not another app's screen): a folder path, a click path + switch or fields, a terminal, a prompt, a chat, a checklist */
function Diagram({ d }) {
  const frame = "rounded-xl border border-white/12 bg-[#0f1214] p-3.5 shadow-[0_14px_40px_-20px_rgba(0,0,0,0.8)]";
  if (d.kind === "chat") {
    return (
      <div className={`${frame} space-y-2`} aria-hidden="true">
        {d.lines.map((l, i) => (
          l.who === "you"
            ? <p key={i} className={`ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-lime-300 px-3 py-1.5 text-[13px] font-bold text-[#11150D] ${l.t.startsWith("/") ? "font-mono" : ""}`}>{l.t}</p>
            : <p key={i} className="w-fit max-w-[90%] whitespace-pre-line rounded-2xl rounded-bl-md border border-white/12 bg-white/[0.06] px-3 py-1.5 text-[13px] leading-relaxed text-white/90">{l.t}</p>
        ))}
      </div>
    );
  }
  if (d.kind === "folders") {
    return (
      <div className={frame} aria-hidden="true">
        <p className="mb-2.5 flex flex-wrap items-center gap-1 font-mono text-[12px] text-white/70">{d.path.map((p, i) => <span key={p} className="flex items-center gap-1">{i > 0 && <span className="text-white/30">/</span>}<span className={i === d.path.length - 1 ? "rounded bg-lime-300 px-1.5 font-bold text-[#11150D]" : ""}>{p}</span></span>)}</p>
        <ul className="space-y-1">
          {d.files.map((f) => <li key={f} className="flex items-center gap-2 rounded-md bg-white/[0.04] px-2.5 py-1.5 font-mono text-[12px] text-white/80">{/\./.test(f) ? <FileText className="h-3.5 w-3.5 text-white/45" /> : <Folder className="h-3.5 w-3.5 text-lime-300/80" />}{f}</li>)}
        </ul>
      </div>
    );
  }
  if (d.kind === "clicks") {
    return (
      <div className={frame} aria-hidden="true">
        <div className="flex flex-wrap items-center gap-1.5">
          {d.path.map((p, i) => <span key={p} className="flex items-center gap-1.5">{i > 0 && <ArrowRight className="h-3.5 w-3.5 text-white/35" />}<span className="rounded-md border border-white/15 bg-white/[0.06] px-2 py-1 text-[12.5px] font-bold text-white">{p}</span></span>)}
        </div>
        {d.toggle && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-lime-300/50 bg-lime-300/[0.07] px-3 py-2.5">
            <span className="text-[13px] font-bold text-white">{d.toggle}</span>
            <span className="relative h-6 w-10 shrink-0 rounded-full bg-lime-300"><span className="absolute right-1 top-1 h-4 w-4 rounded-full bg-[#11150D]" /></span>
          </div>
        )}
        {d.fields && (
          <div className="mt-3 space-y-1.5 rounded-lg border border-lime-300/50 bg-lime-300/[0.07] p-2.5">
            {d.fields.map(([k, v]) => <p key={k} className="flex min-w-0 items-center gap-2 text-[12.5px]"><span className="w-10 shrink-0 font-bold text-white/55">{k}</span><span className="min-w-0 flex-1 truncate rounded-md border border-white/15 bg-black/40 px-2 py-1 font-mono text-lime-100">{v}</span></p>)}
          </div>
        )}
      </div>
    );
  }
  if (d.kind === "terminal") {
    return (
      <div className={`${frame} font-mono text-[12.5px]`} aria-hidden="true">
        <div className="mb-2 flex gap-1.5"><span className="h-2 w-2 rounded-full bg-white/20" /><span className="h-2 w-2 rounded-full bg-white/20" /><span className="h-2 w-2 rounded-full bg-white/20" /></div>
        {d.lines.map((l) => <p key={l.t} className="flex items-center justify-between gap-3 py-0.5 text-white/85">{l.t}{l.ok && <span className="flex items-center gap-1 font-bold text-lime-300"><Check className="h-3.5 w-3.5" />{l.ok}</span>}</p>)}
      </div>
    );
  }
  if (d.kind === "prompt") {
    return (
      <div className={frame} aria-hidden="true">
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/45">Example</p>
        <p className="mt-2 rounded-lg border border-white/12 bg-black/40 px-3 py-2.5 text-[13px] leading-relaxed text-white">{d.example}</p>
      </div>
    );
  }
  return (
    <div className={frame} aria-hidden="true">
      <ul className="space-y-1.5">
        {d.items.map((x) => <li key={x} className="flex items-center gap-2 rounded-md bg-white/[0.04] px-2.5 py-2 text-[13px] font-bold text-white"><span className="grid h-5 w-5 place-items-center rounded bg-lime-300 text-[#11150D]"><Check className="h-3.5 w-3.5" /></span>{x}</li>)}
      </ul>
    </div>
  );
}

function FinishChoices() {
  return (
    <div className="mt-3 grid gap-2.5 md:grid-cols-2">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/55">Free, in the kit</p>
        <p className="mt-1 text-[14.5px] font-black text-white">final_free.mp4</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-white/70">The kit's own captions file: your voice and simple white one-word captions, ready to post.</p>
      </div>
      <Link to={MCP_STUDIO_PATH} className={`group rounded-xl border border-lime-300/35 bg-lime-300/[0.06] p-3.5 transition hover:border-lime-300 ${FOCUS}`}>
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-lime-300">Or Finish in Zyvo</p>
        <p className="mt-1 flex items-center gap-1.5 text-[14.5px] font-black text-white"><MonitorPlay className="h-4 w-4 text-lime-300" aria-hidden="true" />MCP Studio</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-lime-50/85">Our voice, coloured captions, sound effects and music. Your first finish is free.</p>
        <span className="mt-1.5 inline-flex items-center gap-1 text-[13px] font-bold text-lime-200">Open MCP Studio<ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden="true" /></span>
      </Link>
    </div>
  );
}

/** the end card (owner 2026-11-20): Free and Starter videos end with it, Pro and higher don't */
function EndCard() {
  return (
    <div className="mt-3 flex gap-3 rounded-xl border border-white/10 bg-black/25 p-3.5" data-testid="end-card-note">
      <span className="grid h-14 w-9 shrink-0 place-items-center rounded-md border border-white/15 bg-gradient-to-b from-[#1a2412] to-[#0B0D0F]" aria-hidden="true"><Film className="h-4 w-4 text-lime-300/80" /></span>
      <div className="min-w-0">
        <p className="text-[13.5px] font-bold text-white">The {END_CARD.seconds}-second end card</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-white/70">{END_CARD.text}</p>
      </div>
    </div>
  );
}

function CopyLine({ label, value, big = false, quiet = false }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1600); } catch { /* selectable */ } };
  return (
    <div className={`overflow-hidden rounded-lg border ${big ? "border-lime-300/40" : quiet ? "border-dashed border-white/15" : "border-white/15"} bg-black/40`}>
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-1">
        <span className="text-[11px] font-black uppercase tracking-[0.12em] text-white/55">{label}</span>
        <button type="button" onClick={copy} className={`flex min-h-8 items-center gap-1.5 rounded-md px-2 text-[12.5px] font-bold ${copied ? "text-lime-200" : "text-white"} hover:bg-white/10 ${FOCUS}`}>
          {copied ? <Check className="h-3.5 w-3.5 text-lime-300" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}{copied ? "Copied" : "Copy"}
        </button>
      </div>
      <code className={`block select-all ${big ? "break-words" : "break-all"} px-3 py-2 font-mono leading-relaxed ${quiet ? "text-white/70" : "text-lime-100"} ${big ? "text-[14px]" : "text-[12.5px]"}`}>{value}</code>
    </div>
  );
}
