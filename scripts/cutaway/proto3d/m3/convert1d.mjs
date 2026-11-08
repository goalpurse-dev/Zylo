// M3: recorded planner answers in the scene language v2 step 1d format (free, no calls).
// 1. facts: the old two calls (fact research: web search notes; fact-check: the verdicts) become the one "facts" call's
//    answer: the fact-check's verdicts, with the research's search count. Every case folder with a fact_check answer.
// 2. --sentences (the stand-ins, whose answers are hand-written): the final narration (the last words or words repair
//    answer) goes into the plan replies' "sentences", as the merged plan reply carries it; the words answers stay (an
//    older replay of the same case still finds them).
//   node m3/convert1d.mjs <case folder>... [--sentences]
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2), withSentences = args.includes("--sentences");
const read = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
for (const dir of args.filter((a) => !a.startsWith("--"))) {
  const A = path.join(dir, "answers");
  if (!fs.existsSync(A)) continue;
  const files = fs.readdirSync(A), done = [];
  // 1. the facts answer
  const check = files.filter((f) => /^fact_check__\d+\.json$/.test(f)).sort().at(-1);
  if (check && !files.includes("facts__1.json")) {
    const searches = Math.max(0, ...files.filter((f) => /^fact_research/.test(f)).map((f) => read(path.join(A, f)).searches ?? 0));
    const c = read(path.join(A, check));
    fs.writeFileSync(path.join(A, "facts__1.json"), JSON.stringify({ hash: "*", by: `converted (convert1d) from ${check} and the research's ${searches} searches`, searches, data: c.data }, null, 1));
    done.push("facts");
  }
  // 2. the narration in the plan replies
  if (withSentences) {
    const order = ["words_repair_2__1.json", "words_repair__1.json", "words__1.json"], last = order.find((f) => files.includes(f));
    if (last) {
      const sentences = read(path.join(A, last)).data.sentences;
      for (const f of files.filter((x) => /^beats_(plan|repair)__\d+\.json$/.test(x))) {
        const a = read(path.join(A, f));
        if (Array.isArray(a.data?.sentences)) continue;
        a.data = { why: a.data.why, story: a.data.story, sentences, sceneJson: a.data.sceneJson };
        fs.writeFileSync(path.join(A, f), JSON.stringify(a, null, 1));
        done.push(`${f} <- ${last}`);
      }
    }
  }
  console.log(`${path.basename(dir)}: ${done.join(", ") || "nothing to do"}`);
}
