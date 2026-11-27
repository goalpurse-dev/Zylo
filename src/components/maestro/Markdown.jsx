// Maestro's answers: a small, SAFE markdown (no HTML is ever injected): paragraphs, - and 1. lists, **bold**, *italic*,
// `code`. Everything else is shown as plain text.
function inline(text, key) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0, m, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("**")) out.push(<strong key={`${key}-${i++}`} className="font-bold text-white">{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) out.push(<code key={`${key}-${i++}`} className="rounded bg-white/[0.08] px-1 py-0.5 text-[0.92em]">{t.slice(1, -1)}</code>);
    else out.push(<em key={`${key}-${i++}`}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function Markdown({ text }) {
  const blocks = [];
  let list = null;
  const flush = () => { if (list) { blocks.push(list); list = null; } };
  String(text ?? "").split(/\n/).forEach((raw, n) => {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const num = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
    if (bullet || num) {
      const kind = bullet ? "ul" : "ol";
      if (!list || list.kind !== kind) { flush(); list = { kind, items: [] }; }
      list.items.push(inline(bullet ? bullet[1] : num[2], `li${n}`));
      return;
    }
    flush();
    if (line.trim()) blocks.push({ kind: "p", body: inline(line, `p${n}`) });
  });
  flush();
  return (
    <div className="space-y-2.5">
      {blocks.map((b, i) => b.kind === "p"
        ? <p key={i}>{b.body}</p>
        : b.kind === "ul"
          ? <ul key={i} className="list-disc space-y-1 pl-5 marker:text-lime-300">{b.items.map((it, j) => <li key={j}>{it}</li>)}</ul>
          : <ol key={i} className="list-decimal space-y-1 pl-5 marker:font-bold marker:text-lime-300">{b.items.map((it, j) => <li key={j}>{it}</li>)}</ol>)}
    </div>
  );
}
