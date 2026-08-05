import { Fragment } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { trackSeoEvent } from "../../lib/seoAnalytics.js";

const CTA_PATTERN = /^\[(?:Primary|Secondary|Final) CTA:\s*(.*?)\s*→\s*(\/[^\]]+)\]$/;
function stripInlineMarkdown(value) {
  return value.replace(/\*\*/g, "").trim();
}

function renderInline(value) {
  const chunks = value.split(/(\*\*[^*]+\*\*|https?:\/\/[^\s)]+)/g).filter(Boolean);

  return chunks.map((chunk, index) => {
    if (chunk.startsWith("**") && chunk.endsWith("**")) {
      return <strong key={`${chunk}-${index}`} className="font-bold text-white/85">{chunk.slice(2, -2)}</strong>;
    }
    if (/^https?:\/\//.test(chunk)) {
      return <a key={`${chunk}-${index}`} href={chunk} target="_blank" rel="noreferrer" className="text-lime-300 underline decoration-lime-300/30 underline-offset-4">{chunk}</a>;
    }
    return <Fragment key={`${chunk}-${index}`}>{chunk}</Fragment>;
  });
}

function getBodyLines(markdown) {
  const lines = markdown.split(/\r?\n/);
  const stop = lines.findIndex((line) => line.trim() === "## FAQ");
  return (stop < 0 ? lines : lines.slice(0, stop)).filter((line) => line.trim() !== "---");
}

function CtaCallout({ label, to, slug, secondary = false }) {
  return (
    <aside className={`my-10 rounded-2xl border p-5 sm:flex sm:items-center sm:justify-between sm:gap-5 ${secondary ? "border-white/10 bg-white/[0.03]" : "border-lime-300/20 bg-lime-300/[0.06]"}`}>
      <p className="text-[15px] font-bold text-white">{label}</p>
      <Link
        to={to}
        onClick={() => trackSeoEvent("seo_cta_click", { slug: `blog:${slug}`, destination: to })}
        className="mt-4 inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-lime-300/25 bg-lime-300/[0.10] px-4 py-2.5 text-[13px] font-black text-lime-100 sm:mt-0"
      >
        Open Zyvo <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </aside>
  );
}

export default function MarkdownArticle({ markdown, slug, ctaHref, promptCards = false, sectionImages = {} }) {
  const lines = getBodyLines(markdown);
  const blocks = [];

  for (let index = 0; index < lines.length;) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }

    const cta = line.match(CTA_PATTERN);
    if (cta) {
      blocks.push(<CtaCallout key={`cta-${index}`} label={cta[1]} to={cta[2]} slug={slug} secondary={line.startsWith("[Secondary")} />);
      index += 1;
      continue;
    }

    if (line.startsWith("## ")) {
      const heading = stripInlineMarkdown(line.slice(3));
      const sectionImage = sectionImages[heading];
      blocks.push(<h2 id={`section-${index}`} key={`h2-${index}`} className="mb-4 mt-12 scroll-mt-24 text-[24px] font-black tracking-[-0.02em] text-white">{renderInline(line.slice(3))}</h2>);
      if (sectionImage) {
        blocks.push(
          <figure key={`image-${index}`} className="my-7 mx-auto max-w-lg overflow-hidden rounded-[22px] border border-white/10 bg-black">
            <img
              src={sectionImage.src}
              alt={sectionImage.alt}
              width={sectionImage.width}
              height={sectionImage.height}
              loading="lazy"
              className="h-auto w-full object-cover"
            />
          </figure>,
        );
      }
      index += 1;
      continue;
    }

    if (line.startsWith("### ")) {
      blocks.push(<h3 key={`h3-${index}`} className="mb-3 mt-8 text-[18px] font-black text-white/90">{renderInline(line.slice(4))}</h3>);
      index += 1;
      continue;
    }

    if (line.startsWith("> ")) {
      const quote = [];
      const start = index;
      while (index < lines.length && lines[index].trim().startsWith("> ")) {
        quote.push(lines[index].trim().slice(2));
        index += 1;
      }
      const prompt = stripInlineMarkdown(quote.join(" "));
      blocks.push(
        <blockquote key={`quote-${start}`} className="my-5 rounded-2xl border border-lime-300/15 bg-lime-300/[0.045] p-5 text-[14px] leading-7 text-white/70">
          <p>{renderInline(quote.join(" "))}</p>
          {promptCards && (
            <Link
              to={`${ctaHref}?prompt=${encodeURIComponent(prompt)}`}
              onClick={() => trackSeoEvent("seo_prompt_interaction", { slug: `blog:${slug}`, templateId: "two-am" })}
              className="mt-4 inline-flex items-center gap-1 text-[12px] font-bold text-lime-300"
            >
              Try this prompt <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </blockquote>,
      );
      continue;
    }

    if (line.startsWith("|") && index + 1 < lines.length && /^\|?[\s|:-]+\|?$/.test(lines[index + 1].trim())) {
      const start = index;
      const splitRow = (row) => row.split("|").slice(1, -1).map((cell) => cell.trim());
      const headers = splitRow(lines[index].trim());
      const rows = [];
      index += 2;
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        rows.push(splitRow(lines[index].trim()));
        index += 1;
      }
      blocks.push(
        <div key={`table-${start}`} className="my-7 overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[520px] border-collapse text-left text-[14px]">
            <thead className="bg-white/[0.06] text-white/85">
              <tr>{headers.map((header) => <th key={header} className="px-4 py-3 font-bold">{renderInline(header)}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-white/[0.07] text-white/60">
              {rows.map((row, rowIndex) => (
                <tr key={`row-${rowIndex}`}>
                  {row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`} className="px-4 py-3">{renderInline(cell)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      const ordered = /^\d+\.\s+/.test(line);
      const items = [];
      const start = index;
      const pattern = ordered ? /^\d+\.\s+/ : /^[-*]\s+/;
      while (index < lines.length && pattern.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(pattern, ""));
        index += 1;
      }
      const List = ordered ? "ol" : "ul";
      blocks.push(
        <List key={`list-${start}`} className={`my-5 space-y-2 pl-6 text-[15px] leading-7 text-white/60 ${ordered ? "list-decimal" : "list-disc"}`}>
          {items.map((item, itemIndex) => <li key={`${item}-${itemIndex}`}>{renderInline(item)}</li>)}
        </List>,
      );
      continue;
    }

    const paragraph = [];
    const start = index;
    while (index < lines.length) {
      const candidate = lines[index].trim();
      if (!candidate || candidate.startsWith("#") || candidate.startsWith("> ") || candidate.startsWith("|") || CTA_PATTERN.test(candidate) || /^[-*]\s+/.test(candidate) || /^\d+\.\s+/.test(candidate)) break;
      paragraph.push(candidate);
      index += 1;
    }
    blocks.push(<p key={`p-${start}`} className="my-5 text-[16px] leading-8 text-white/60">{renderInline(paragraph.join(" "))}</p>);
  }

  return <div>{blocks}</div>;
}
