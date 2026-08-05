function stripInlineMarkdown(value) {
  return value.replace(/\*\*/g, "").trim();
}

export function extractFaqs(markdown) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === "## FAQ");
  if (start < 0) return [];

  const faqs = [];
  let question = null;
  let answer = [];
  const flush = () => {
    if (question && answer.length) faqs.push([question, stripInlineMarkdown(answer.join(" "))]);
    question = null;
    answer = [];
  };

  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line.startsWith("## ")) break;
    if (line.startsWith("### ")) {
      flush();
      question = stripInlineMarkdown(line.slice(4));
    } else if (line) {
      answer.push(line);
    }
  }
  flush();
  return faqs;
}

export function extractRelatedLinks(markdown) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === "## Related links");
  if (start < 0) return [];

  const links = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line.startsWith("## ") || line === "---") break;
    const match = line.replace(/^-\s*/, "").match(/^(.*?)\s*→\s*(\/\S+)$/);
    if (match) links.push([match[2], match[1], "Continue exploring the 2AM Worlds topic cluster."]);
  }
  return links;
}
