// Phase 6c-polish 2 (< $0.01): the QA check's cost on a full-size scene image
// vs its 768 px transform — same prompt, same image, read-only.
//   node --env-file=.env.local scripts/phase6cQaCostCheck.mjs <publicImageUrl>
const url = process.argv[2];
const small = `${url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/")}?width=768&height=432&resize=contain&quality=85`;
const key = process.env.OPENAI_API_KEY ?? process.env.VITE_OPENAI_API_KEY;
const SCHEMA = { type: "object", additionalProperties: false, required: ["ocr", "style", "cast", "concept"], properties: { ocr: { type: "string" }, style: { type: "boolean" }, cast: { type: "boolean" }, concept: { type: "boolean" } } };
async function qa(imageUrl) {
  // Inline both copies (base64) so the comparison measures tokens, not download speed.
  const bytes = Buffer.from(await (await fetch(imageUrl)).arrayBuffer());
  const dataUrl = `data:image/jpeg;base64,${bytes.toString("base64")}`;
  const res = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "gpt-4o-mini", temperature: 0, messages: [{ role: "user", content: [{ type: "text", text: "Frame from a flat 2D stickman explainer. ocr: transcribe ALL readable text ('' if none). style/cast/concept: true." }, { type: "image_url", image_url: { url: dataUrl, detail: "high" } }] }], response_format: { type: "json_schema", json_schema: { name: "qa", strict: true, schema: SCHEMA } } }) });
  const j = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(j).slice(0, 200));
  const cost = (j.usage.prompt_tokens * 0.15 + j.usage.completion_tokens * 0.6) / 1e6;
  return { promptTokens: j.usage.prompt_tokens, costUsd: Number(cost.toFixed(5)), answer: JSON.parse(j.choices[0].message.content) };
}
const full = await qa(url);
const s768 = await qa(small);
console.log(JSON.stringify({ full, s768, savingPerCheck: Number((full.costUsd - s768.costUsd).toFixed(5)), savingPer148: Number(((full.costUsd - s768.costUsd) * 148).toFixed(3)) }, null, 1));
