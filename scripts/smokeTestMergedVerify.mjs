// One-off smoke test: does OpenAI's Responses API actually support
// web_search tool use TOGETHER with strict json_schema structured output in
// one call, and do the model's own `url` field values in the structured
// output match the citations captured via annotations? Prints the FULL raw
// response so we can see exactly what's happening.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });

const OPENAI_KEY = process.env.OPENAI_API_KEY;

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["facts"],
  properties: {
    facts: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["questionId", "claim", "sourceName", "number", "unit", "url", "quoteOrEvidence", "confidence"],
        properties: {
          questionId: { type: "string", enum: ["q0"] },
          claim: { type: "string" },
          sourceName: { type: "string" },
          number: { type: ["number", "null"] },
          unit: { type: ["string", "null"] },
          url: { type: "string" },
          quoteOrEvidence: { type: "string" },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
        },
      },
    },
  },
};

async function main() {
  const request = {
    model: "gpt-5-mini",
    store: false,
    instructions: `You are verifying specific factual claims for a short video — you are NOT conducting broad research. You will be given up to 3 specific questions and ONE search query. Search the web and report ONLY facts you can verify with a real, citable source found via your search.

For each question you can confidently answer, produce ONE fact: the specific claim, the source's name (site, study, institution, or person), a precise number if the question calls for one (or null), its unit if applicable (or null), the exact URL of the source you found via search, a short supporting quote or evidence excerpt (25 words or fewer) taken from that source, and your honest confidence.

CRITICAL: the url field MUST be a real URL from a source you actually found through search this call — never write a URL from memory, never guess one, never invent one. If you cannot find a confident, citable answer to a question, simply omit it from facts — do not fabricate a source or a number to fill the gap, and never pad with an off-topic fact just to have something to report.`,
    input: `SECTION: evidence1\nQUESTIONS TO VERIFY:\n- [q0] What is the current estimated global wild population of African lions (Panthera leo), according to the IUCN Red List?\nSEARCH QUERY TO RUN: IUCN Red List African lion Panthera leo population estimate`,
    tools: [{ type: "web_search", search_context_size: "medium" }],
    max_tool_calls: 1,
    text: { format: { type: "json_schema", name: "stickman_verify", strict: true, schema } },
  };

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const payload = await res.json();
  console.log("HTTP status:", res.status);
  console.log("\n=== FULL RAW RESPONSE ===");
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
