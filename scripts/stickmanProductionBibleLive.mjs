// 2026-10-02 "Production Bible" pass — LIVE validation script. Makes REAL
// gpt-5-mini text calls (never an image/video provider) against 8 synthetic,
// non-Atlantis fixtures covering every case Section 10 requires. Zero
// project/DB writes — calls compileStickmanProductionBible directly, the
// same shared module the real edge function uses, and only prints/asserts
// on the result. Safe to re-run; each run is a fresh, independent LLM call.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });
import { compileStickmanProductionBible, validateBible, warnBible } from "../supabase/functions/_shared/stickman/productionBible.ts";

const OPENAI_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_KEY) { console.error("Missing OPENAI_API_KEY in .env.local"); process.exit(1); }

const FIXTURES = [
  {
    key: "A_survival_history",
    topic: "How Early Humans Survived Winter",
    viewerPromise: "Discover the small, clever tricks that kept early humans alive through brutal ice-age winters.",
    script: "Picture a small band of early humans, maybe twenty people, huddled at the mouth of a shallow cave as the first snow falls. Winter here isn't a season — it's a test. Their leader, an older woman who has survived more winters than anyone else in the group, has already decided where they'll shelter and how the food they gathered all autumn will be rationed. She teaches the younger hunters how to layer hide wraps for warmth, how to keep a fire burning through the coldest nights, and how to read the sky for the storms that could kill anyone caught outside. One young hunter, eager but inexperienced, nearly wanders too far chasing a hare and has to be called back before dusk. By the time spring finally arrives, the group has lost no one — not through luck, but through the accumulated, hard-won knowledge the elder carried and passed down.",
  },
  {
    key: "B_mechanism_no_protagonist",
    topic: "How Wi-Fi Actually Works",
    viewerPromise: "A clear explanation of the invisible radio waves carrying your internet connection through the walls of your home.",
    script: "Every time you load a page on your phone, an invisible conversation happens in the air around you. Your router constantly broadcasts radio waves in two main frequency bands, encoding data as rapid changes in the wave's pattern. Your phone's antenna picks up that signal, decodes it back into ones and zeros, and hands it off to the operating system. When you're far from the router, or a wall gets in the way, the signal weakens and the connection has to fall back to slower, more robust encoding to get the same data through reliably. Multiple devices share the same airwaves by taking turns in tiny slices of time, invisible to any of the humans in the room.",
  },
  {
    key: "C_hypothetical_millionaire",
    topic: "What If You Became a Millionaire Overnight?",
    viewerPromise: "Walk through exactly what would happen to your life, your habits, and your relationships if you suddenly had a million dollars.",
    script: "You wake up on an ordinary Tuesday, check your banking app out of habit, and freeze. There's a seven-figure balance staring back at you. At first you assume it's a glitch, but three phone calls later, it's real — a lottery ticket you forgot you bought. The first week, you keep going to your old job, unsure what else to do, sitting through the same meetings while a life-changing secret sits in your pocket. Slowly, you start making decisions: paying off the apartment, telling your closest friend, resisting the urge to quit everything at once. By the end of the month, the biggest change isn't the money itself — it's the exhausting number of new decisions you suddenly have to make every single day.",
  },
  {
    key: "D_business_timeline",
    topic: "The Rise and Fall of Blockbuster Video",
    viewerPromise: "Trace exactly how the biggest video rental chain in the world collapsed in less than a decade.",
    script: "In the late 1990s, Blockbuster had over nine thousand stores and a brand recognized in nearly every American town. Then, in 2000, a small mail-order DVD startup called Netflix offered to sell itself to Blockbuster for fifty million dollars. Blockbuster's executives turned them down, confident that late fees and physical stores were the future. Over the next decade, streaming technology matured while Blockbuster kept expanding its physical footprint, burying itself under real-estate costs a purely digital competitor never had to carry. By 2010, the company filed for bankruptcy, and by 2014, nearly every store had closed. Today, exactly one Blockbuster store remains open, kept alive largely as a curiosity for tourists rather than a real rental business.",
  },
  {
    key: "E_geography_documentary",
    topic: "Why the Amazon Rainforest Matters to the Whole Planet",
    viewerPromise: "Understand why a forest on one continent affects rainfall and climate patterns thousands of miles away.",
    script: "The Amazon rainforest generates so much of its own rainfall that scientists call the phenomenon 'flying rivers' — moisture pulled up from the ocean, released by billions of trees, and carried across the entire South American continent. This cycle doesn't just water the forest itself; it influences rainfall patterns as far away as the American Midwest and even parts of Europe. When large sections of the forest are cleared for agriculture, this recycling engine weakens, and the reduced rainfall can push the remaining forest toward a drier, more fire-prone state. Researchers now warn the Amazon may be approaching a tipping point, where enough deforestation could cause the ecosystem to shift permanently from lush rainforest to dry savanna.",
  },
  {
    key: "F_emotional_narrative",
    topic: "The Last Voicemail",
    viewerPromise: "A quiet, personal story about a voicemail someone couldn't bring themselves to delete for three years.",
    script: "She still has forty seconds of her father's voice saved on her phone — an old voicemail reminding her to bring an umbrella, recorded two days before he passed away. For the first year, she couldn't listen to it at all, just kept it because deleting it felt like losing him twice. In the second year, she'd play it occasionally, late at night, just to hear him say her name. By the third year, something shifted — she found herself smiling instead of crying, using it to remember the small, ordinary version of him rather than the loss. She still hasn't deleted it, and now she doesn't think she ever will.",
  },
  {
    key: "G_color_important",
    topic: "Why Coral Reefs Are Bursting With Color",
    viewerPromise: "Discover the surprising biological reason coral reefs display some of the most vivid colors in nature.",
    script: "A healthy coral reef looks less like a rock formation and more like an underwater carnival — electric purples, glowing greens, and deep oranges packed into a single square meter of reef. That color doesn't come from the coral itself, but from microscopic algae living inside coral tissue in a mutually beneficial partnership. The algae produce pigments as a byproduct of photosynthesis, and different species and stress levels produce wildly different hues. When water gets too warm, corals expel these colorful algae in a process called bleaching, and the vivid reef turns ghostly white almost overnight — a visible warning sign of an invisible chemical stress.",
  },
  {
    key: "H_monochrome_appropriate",
    topic: "The Night the Lights Went Out: London's Wartime Blackout",
    viewerPromise: "Step into the eerie, silent darkness of London during the nightly blackouts of the Second World War.",
    script: "Every evening at dusk, an entire city of eight million people deliberately disappeared. Streetlights switched off, windows were sealed behind thick blackout curtains, and even the glow of a lit cigarette on a street corner could earn a stern warning from a passing air-raid warden. The blackout was meant to deny enemy bombers any visible reference points over the city, but it turned ordinary nights into a genuine hazard — pedestrian deaths from traffic accidents spiked sharply in the blackout's first months, more dangerous, some said, than the bombs themselves. Londoners adapted with painted white curbs, dimmed torch lights, and a grim new nighttime choreography, moving through a city that had willingly gone dark.",
  },
];

async function main() {
  const results = [];
  for (const fixture of FIXTURES) {
    const startedAt = Date.now();
    const result = await compileStickmanProductionBible({
      openaiKey: OPENAI_KEY,
      projectId: `test-${fixture.key}`, generationProfileId: `test-profile-${fixture.key}`, scriptVersionId: `test-script-${fixture.key}`,
      productionBibleVersion: 1,
      topic: fixture.topic, viewerPromise: fixture.viewerPromise, narrativeStrategy: "", finalScript: fixture.script, researchNotes: "", targetAudience: "",
    });
    const elapsedMs = Date.now() - startedAt;
    if (!result.ok) {
      results.push({ key: fixture.key, ok: false, errors: result.errors, stats: result.stats, elapsedMs });
      console.error(`[${fixture.key}] FAILED validation:`, result.errors);
      continue;
    }
    const extraErrors = validateBible(result.bible);
    const warnings = warnBible(result.bible);
    results.push({
      key: fixture.key, ok: true, elapsedMs, stats: result.stats,
      continuityMode: result.bible.continuityMode, heroExists: result.bible.hero.exists, heroSubjectType: result.bible.hero.subjectType,
      heroReasoning: result.bible.hero.reasoning, recurringCharacterCount: result.bible.recurringCharacters.length,
      colorApproach: result.bible.palette.colorApproach, monochromeJustification: result.bible.palette.monochromeJustification,
      primaryColors: result.bible.palette.primaryColors, visualPremise: result.bible.visualPremise,
      graphicCharacterUseInsideGraphics: result.bible.graphicLanguage.characterUseInsideGraphics,
      extraValidationErrors: extraErrors, warnings,
      fullBible: result.bible,
    });
    console.log(`[${fixture.key}] ok — continuityMode=${result.bible.continuityMode} hero=${result.bible.hero.exists} colorApproach=${result.bible.palette.colorApproach} llmCalls=${result.stats.llmCalls} repairCalls=${result.stats.repairCalls} cost=$${result.stats.estimatedModelCostUsd} (${elapsedMs}ms)`);
  }

  const totalCost = results.reduce((sum, r) => sum + (r.stats?.estimatedModelCostUsd ?? 0), 0);
  const totalCalls = results.reduce((sum, r) => sum + (r.stats?.llmCalls ?? 0), 0);
  const totalRepairs = results.reduce((sum, r) => sum + (r.stats?.repairCalls ?? 0), 0);
  console.log("\n=== SUMMARY ===");
  console.log(JSON.stringify({ totalFixtures: FIXTURES.length, allOk: results.every((r) => r.ok), totalLlmCalls: totalCalls, totalRepairCalls: totalRepairs, totalEstimatedCostUsd: Number(totalCost.toFixed(4)) }, null, 2));

  console.log("\n=== PER-FIXTURE DETAIL ===");
  console.log(JSON.stringify(results.map((r) => ({ ...r, fullBible: undefined })), null, 2));

  // Save full bibles for report evidence (one non-Atlantis example per Section 12 item 4).
  const fs = await import("node:fs");
  fs.writeFileSync("scripts/.stickman_bible_fixtures.json", JSON.stringify(results, null, 2));
  console.log("\nFull bibles written to scripts/.stickman_bible_fixtures.json");
}

main().catch((e) => { console.error(e); process.exit(1); });
