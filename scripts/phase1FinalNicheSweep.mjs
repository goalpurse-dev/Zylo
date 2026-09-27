// Phase 1 FINAL, Section 5d — Story Plan sweep across all 25 niches.
// Cheap (gpt-5-mini, Story Plan only, no research/script), one realistic
// topic per niche, checked automatically: title rules, beat-sheet
// shape/budgets, callback plan, thumbnail concept, angle selection.
// Prints a niche/title/angles/pass-fail table. Never deletes projects.
import { createTestUser, callFn, admin, VOICE } from "./phase1cLib.mjs";

// Mirrors src/pages/workspace/long-form/niches.js exactly (25 niches, 5
// groups) — using each niche's own exampleTopic for a realistic sweep input.
const NICHES = [
  { id: "ancient_humans_prehistory", topic: "How did early humans survive their first winters without fire?" },
  { id: "dark_brutal_history", topic: "What really happened to sailors lost at sea for months?" },
  { id: "daily_life_past_eras", topic: "What did a normal Tuesday look like in medieval Europe?" },
  { id: "military_logistics_history", topic: "How did Rome feed a marching army of 30,000 soldiers?" },
  { id: "ancient_medicine_science", topic: "Did ancient doctors actually perform brain surgery?" },
  { id: "timeline_history", topic: "How did a single assassination lead to a world war?" },
  { id: "myth_vs_reality", topic: "Did Vikings really wear horned helmets?" },
  { id: "psychology_human_behavior", topic: "Why does your brain replay embarrassing moments?" },
  { id: "the_body_explained", topic: "Why do you get goosebumps when you're not cold?" },
  { id: "sleep_health_habits", topic: "What happens to your brain after 72 hours without sleep?" },
  { id: "evolution_quirks", topic: "Why do humans still have a tailbone?" },
  { id: "why_dont_we_eat_x", topic: "Why don't humans eat horses in most Western countries?" },
  { id: "animal_behavior_predator_prey", topic: "How does a gazelle decide when to outrun a cheetah?" },
  { id: "survival_scenarios", topic: "Could you survive a night alone in the Arctic?" },
  { id: "extinct_animals", topic: "Why did the woolly mammoth actually go extinct?" },
  { id: "space_cosmic_scale", topic: "How big is our galaxy compared to the observable universe?" },
  { id: "what_if_hypotheticals", topic: "What if you suddenly inherited a million dollars?" },
  { id: "mysteries_unexplained", topic: "What's really at the bottom of the deepest part of the ocean?" },
  { id: "everyday_science", topic: "How does Wi-Fi actually travel through your walls?" },
  { id: "money_psychology_economics", topic: "Why does losing $100 hurt more than winning $100 feels good?" },
  { id: "technology_attention_economy", topic: "How do apps actually keep you scrolling for hours?" },
  { id: "how_systems_work", topic: "How does the electrical grid balance supply every second?" },
  { id: "countries_cultures", topic: "Why does Japan have vending machines on every corner?" },
  { id: "jobs_careers", topic: "What does an air traffic controller actually do all day?" },
  { id: "you_vs_x", topic: "How would you fare against a chimpanzee in a fight?" },
];

const STICKMAN_BEAT_RANGES = {
  cold_open: [40, 70],
  stakes: [1, 15],
  core_question: [1, 25],
  twist: [100, 160],
  callback_payoff: [60, 100],
  closer: [40, 80],
};

function validateSectionShape(sections) {
  const roles = sections.map((s) => s.role);
  const issues = [];
  let i = 0;
  const expect = (role, label) => {
    if (roles[i] !== role) issues.push(`Expected section ${i + 1} to be "${role}" (${label}), got "${roles[i] ?? "<missing>"}".`);
    i += 1;
  };
  expect("cold_open", "cold open");
  expect("stakes", "stakes");
  expect("core_question", "core question");
  let evidenceCount = 0;
  while (roles[i] === "evidence") {
    evidenceCount += 1;
    i += 1;
  }
  if (evidenceCount < 3 || evidenceCount > 6) issues.push(`Expected 3-6 consecutive "evidence" sections after core_question, found ${evidenceCount}.`);
  if (roles[i] === "twist") i += 1;
  expect("callback_payoff", "callback payoff");
  expect("closer", "closer");
  if (i !== roles.length) issues.push(`Found ${roles.length - i} extra section(s) after the expected closer.`);
  return issues;
}

function checkTitle(title) {
  const issues = [];
  if (!title || !title.trim()) issues.push("empty title");
  if (title.length > 60) issues.push(`title too long (${title.length} chars)`);
  if (title.includes(":")) issues.push("title contains a colon");
  return issues;
}

function checkBudgets(chapters, targetWords) {
  const issues = [];
  let evidenceSum = 0;
  for (const c of chapters) {
    if (c.role === "evidence") {
      evidenceSum += c.targetWords ?? 0;
      if ((c.targetWords ?? 0) < 60) issues.push(`evidence section "${c.id}" under 60 words (${c.targetWords})`);
      continue;
    }
    const range = STICKMAN_BEAT_RANGES[c.role];
    if (range && ((c.targetWords ?? 0) < range[0] || (c.targetWords ?? 0) > range[1])) {
      issues.push(`"${c.role}" targetWords ${c.targetWords} outside [${range[0]}, ${range[1]}]`);
    }
  }
  const evidenceShare = targetWords ? evidenceSum / targetWords : 0;
  if (evidenceShare < 0.55 || evidenceShare > 0.85) issues.push(`evidence share ${(evidenceShare * 100).toFixed(0)}% outside expected ~70% band (55-85%)`);
  return issues;
}

function checkCallback(callbackPlan, chapters) {
  const issues = [];
  if (!callbackPlan?.detail?.trim()) issues.push("callback detail empty");
  const payoffChapter = chapters.find((c) => c.role === "callback_payoff");
  if (!payoffChapter) issues.push("no callback_payoff chapter found");
  else if (callbackPlan?.payoffSectionId !== payoffChapter.id) issues.push(`callback payoffSectionId "${callbackPlan?.payoffSectionId}" does not match callback_payoff chapter id "${payoffChapter.id}"`);

  const plantIdx = chapters.findIndex((c) => c.id === callbackPlan?.plantSectionId);
  if (plantIdx === -1) issues.push(`callback plantSectionId "${callbackPlan?.plantSectionId}" not found among chapters`);
  else {
    const totalMinutes = chapters.reduce((s, c) => s + (c.estimatedMinutes ?? 0), 0) || 1;
    const cumulativeThroughPlant = chapters.slice(0, plantIdx + 1).reduce((s, c) => s + (c.estimatedMinutes ?? 0), 0);
    const frac = cumulativeThroughPlant / totalMinutes;
    if (frac > 0.3) issues.push(`callback plant lands at ${(frac * 100).toFixed(0)}% of runtime, expected within ~first 25%`);
  }
  return issues;
}

function checkThumbnail(thumbnailConcept) {
  const issues = [];
  const headline = thumbnailConcept?.headline?.trim() ?? "";
  const scene = thumbnailConcept?.scene?.trim() ?? "";
  if (!headline) issues.push("thumbnail headline empty");
  else {
    const wordCount = headline.split(/\s+/).filter(Boolean).length;
    if (wordCount < 1 || wordCount > 3) issues.push(`thumbnail headline has ${wordCount} words, expected 1-3`);
  }
  if (!scene) issues.push("thumbnail scene empty");
  return issues;
}

function checkAngles(candidateAngles, chapters) {
  const issues = [];
  if (!Array.isArray(candidateAngles) || candidateAngles.length !== 5) issues.push(`expected exactly 5 candidateAngles, got ${candidateAngles?.length ?? 0}`);
  const scoreFields = ["surpriseScore", "relatabilityScore", "visualPotentialScore", "payoffScore"];
  for (const a of candidateAngles ?? []) {
    for (const f of scoreFields) {
      const v = a?.[f];
      if (typeof v !== "number" || v < 1 || v > 10) issues.push(`angle "${(a?.angle ?? "").slice(0, 30)}..." has invalid ${f}=${v}`);
    }
  }
  const twistCount = (candidateAngles ?? []).filter((a) => a.isTwistOrPayoffAngle).length;
  if (twistCount !== 1) issues.push(`expected exactly 1 isTwistOrPayoffAngle, got ${twistCount}`);
  const selectedCount = (candidateAngles ?? []).filter((a) => a.selected).length;
  if (selectedCount < 3 || selectedCount > 5) issues.push(`expected 3-5 selected angles (evidence + possibly twist), got ${selectedCount}`);
  const nonTwistSelected = (candidateAngles ?? []).filter((a) => a.selected && !a.isTwistOrPayoffAngle).length;
  const evidenceCount = chapters.filter((c) => c.role === "evidence").length;
  if (nonTwistSelected !== evidenceCount) issues.push(`${nonTwistSelected} non-twist selected angles but ${evidenceCount} evidence chapters (should match 1:1)`);
  return issues;
}

// Retry-mode: pass niche ids as argv to re-run only those (used after the
// first full sweep hit two unrelated test-harness limits, not real content
// bugs: a shared test user's credit_balance ceiling — each project's
// production setup reserves 304 credits, so ~16 projects exhausted the
// default 5000 — and two 150s Supabase edge-function idle timeouts on slow
// gpt-5-mini responses. A fresh, highly-funded test user avoids the first;
// simple per-niche retry handles the second (transient).
const requestedNiches = process.argv.slice(2);
const niches = requestedNiches.length ? NICHES.filter((n) => requestedNiches.includes(n.id)) : NICHES;

async function main() {
  const { userId, accessToken } = await createTestUser("phase1final-nichesweep");
  await admin.from("profiles").update({ credit_balance: 200000 }).eq("id", userId);
  const results = [];

  for (const n of niches) {
    process.stdout.write(`\n=== ${n.id} — "${n.topic}" ===\n`);
    try {
      const { data: session } = await admin.from("long_form_discovery_sessions").insert({ user_id: userId }).select("id").single();
      const project = await callFn("create-long-form-project", accessToken, {
        discoverySessionId: session.id, topic: n.topic, source: "custom", selectedIdea: null,
        lengthMode: "custom", customLengthMinutes: 10, depthMode: "custom", customExplanationDepth: "balanced",
        onScreenTextDensity: "balanced", initialStatus: "draft",
      });
      const projectId = project.id;

      await callFn("create-long-form-production-setup", accessToken, {
        projectId, visualRecipe: "stickman_doodle_explainer", recipeVersion: "STICKMAN_DOODLE_EXPLAINER_V1",
        renderTier: "v2", targetDurationMinutes: 10, explanationDepth: "balanced",
        voiceProvider: "elevenlabs", voiceId: VOICE.voiceId, voiceModel: VOICE.voiceModel, niche: n.id,
      });

      const t0 = Date.now();
      const storyPlanResult = await callFn("generate-long-form-story-plan", accessToken, { projectId });
      const storyPlan = storyPlanResult.storyPlan;
      const ms = Date.now() - t0;

      const { data: freshProject } = await admin.from("long_form_projects").select("target_words").eq("id", projectId).maybeSingle();
      const targetWords = freshProject?.target_words ?? 0;

      const issues = [
        ...checkTitle(storyPlan.recommendedTitle).map((m) => `TITLE: ${m}`),
        ...validateSectionShape(storyPlan.chapters).map((m) => `SHAPE: ${m}`),
        ...checkBudgets(storyPlan.chapters, targetWords).map((m) => `BUDGET: ${m}`),
        ...checkCallback(storyPlan.callbackPlan, storyPlan.chapters).map((m) => `CALLBACK: ${m}`),
        ...checkThumbnail(storyPlan.thumbnailConcept).map((m) => `THUMBNAIL: ${m}`),
        ...checkAngles(storyPlan.candidateAngles, storyPlan.chapters).map((m) => `ANGLES: ${m}`),
      ];

      const selectedAngleSummary = (storyPlan.candidateAngles ?? [])
        .filter((a) => a.selected)
        .map((a) => `${a.isTwistOrPayoffAngle ? "[T]" : ""}${(a.angle ?? "").slice(0, 40)}`)
        .join(" | ");

      console.log(`  title: "${storyPlan.recommendedTitle}" (${ms}ms)`);
      console.log(`  selected angles: ${selectedAngleSummary}`);
      console.log(`  ${issues.length === 0 ? "PASS" : `FAIL (${issues.length} issue(s)):`}`);
      for (const i of issues) console.log(`    - ${i}`);

      results.push({ niche: n.id, title: storyPlan.recommendedTitle, angles: selectedAngleSummary, pass: issues.length === 0, issues, projectId });
    } catch (e) {
      console.log(`  ERROR: ${e.message}`);
      results.push({ niche: n.id, title: "(error)", angles: "", pass: false, issues: [`ERROR: ${e.message}`], projectId: null });
    }
  }

  console.log("\n\n=== SUMMARY TABLE ===");
  console.log("niche".padEnd(32), "pass".padEnd(6), "title");
  for (const r of results) {
    console.log(r.niche.padEnd(32), (r.pass ? "PASS" : "FAIL").padEnd(6), r.title);
  }
  const passCount = results.filter((r) => r.pass).length;
  console.log(`\n${passCount}/${results.length} niches passed all automated checks.`);
  console.log(`Estimated OpenAI cost: ~$0.015-0.03 per niche x ${results.length} = ~$${(results.length * 0.02).toFixed(2)} (gpt-5-mini, topic model + story plan, Story Plan stage has no per-call cost tracking so this is a flat estimate consistent with phase1cLib.mjs's existing convention).`);

  const failed = results.filter((r) => !r.pass);
  if (failed.length) {
    console.log("\n=== FAILURES DETAIL ===");
    for (const r of failed) {
      console.log(`\n${r.niche}:`);
      for (const i of r.issues) console.log(`  - ${i}`);
    }
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error("FATAL:", e); process.exit(1); });
