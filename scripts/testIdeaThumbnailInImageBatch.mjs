// Final-polish round 4, Section 4 — one-off validation batch (NOT a
// permanent feature): generates 10 idea thumbnails in IN_IMAGE mode (Flux 9B
// draws the headline itself) using the EXACT same deterministic prompt
// assembly ProductionSetup.jsx's thumbnail pipeline uses (style header +
// concept + text rules — see src/lib/longFormIdeaThumbnails.ts), so the
// user can decide whether IN_IMAGE is reliable enough to ship instead of
// the OVERLAY default.
//
// Routes through the already-deployed generate-style-preview-asset function
// (temporarily extended with an optional model/negativePrompt override —
// see that file's own comment) rather than calling Runware directly, since
// RUNWARE_API_KEY is a server-only Supabase secret not available to a local
// script. That function calls Runware directly and skips the jobs/credits
// pipeline entirely (a real, already-reviewed pattern for one-off internal
// asset generation — see scripts/generateNicheThumbnailsV2.mjs for the same
// approach used for the niche thumbnail v2 batch).
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(SUPABASE_URL, SERVICE_KEY);
const TEST_EMAIL = "upwardlift6@gmail.com";
const MODEL_AIR_TAG = "runware:400@6"; // Flux 9B (FLUX.2 [klein] 9B KV) — image:flux2.klein9bkv

async function mintSession() {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: TEST_EMAIL });
  if (error) throw error;
  const anon = createClient(SUPABASE_URL, process.env.SUPABASE_ANON_KEY ?? SERVICE_KEY);
  const { data: verify, error: verifyError } = await anon.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: "email" });
  if (verifyError) throw verifyError;
  return verify.session.access_token;
}
async function callFn(name, accessToken, body) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, apikey: process.env.SUPABASE_ANON_KEY ?? SERVICE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, json };
}

// Verbatim from src/lib/longFormIdeaThumbnails.ts
const STYLE_HEADER =
  "YouTube thumbnail in flat-color 2D doodle/stickman explainer style, 16:9. Bold, simple, and very high contrast so it reads instantly at 120 pixels wide. Uniform thick clean black outlines; flat solid color fills only; no shading, no gradients, no texture, no 3D. Characters are stickmen: a perfect circle head with no neck, thin black stick limbs, rounded black mitten hands and feet, clothing as simple flat color shapes. Thumbnail faces are exaggerated for impact: large round white eyes with black pupils, thick strongly angled eyebrows, and a big expressive mouth — the emotion must be extreme and readable at tiny size.";

function buildInImagePrompt(headline, scene) {
  return [
    STYLE_HEADER,
    `Scene: ${scene}`,
    `Bold text in the top third reading exactly "${headline}", in heavy bold rounded all-caps yellow letters with a thick black outline. No other text anywhere in the image.`,
    "Flat 2-3 tone background. No boxes, panels, frames, or blank rectangles.",
  ].join(" ");
}

const NEGATIVE_PROMPT_IN_IMAGE = "misspelled text, garbled text, extra letters, watermark, logo, UI, low-quality artifacts, bad anatomy";

// 10 varied concepts — mix of short/long headlines, an apostrophe, and a
// number, since those are the cases smaller/faster models most often
// misspell or garble.
const BATCH = [
  { id: "no_fire", headline: "NO FIRE?", scene: "A shivering caveman stickman huddles beside a cold, unlit pile of sticks in the snow, teeth chattering, while glowing eyes watch from the dark trees behind him." },
  { id: "who_wins", headline: "WHO WINS?", scene: "A lion stickman and a zebra stickman face off across a hard dividing line, one snarling low, the other rearing up defiantly." },
  { id: "addicted", headline: "ADDICTED?", scene: "A stickman stands hypnotized in front of a giant smartphone taller than himself, eyes spiraling, as a fishing hook from the screen pulls him forward." },
  { id: "how_big", headline: "HOW BIG?", scene: "A tiny astronaut stickman floats stunned in front of an enormous star that dwarfs a small Earth beside it for scale." },
  { id: "thirty_days", headline: "30 DAYS HERE?", scene: "A castaway stickman waves frantically from a tiny sand island with one palm tree, shark fins circling in the water around him." },
  { id: "why_broke", headline: "WHY YOU'RE BROKE?", scene: "A stickman holds open an empty wallet with a moth fluttering out of it while winged gold coins fly away above his despairing face." },
  { id: "could_you_win", headline: "COULD YOU WIN?", scene: "A nervous modern stickman raises his fists shakily across from a confident armored gladiator stickman with a smug grin." },
  { id: "3am_again", headline: "3 AM AGAIN?", scene: "A stickman sits bolt upright in bed at night, eyes huge with exhaustion, beside a glowing alarm clock on the nightstand." },
  { id: "fake_horns", headline: "FAKE HORNS?", scene: "A heroic viking stickman wearing a horned helmet on the left is crossed out with a red X, while the same viking wearing a plain helmet stands confused on the right." },
  { id: "survive_this", headline: "SURVIVE THIS?", scene: "A terrified peasant stickman recoils from a towering plague doctor stickman in a long black cloak and beaked mask looming over him." },
];

async function main() {
  console.log(`Generating ${BATCH.length} IN_IMAGE test thumbnails via ${MODEL_AIR_TAG}...\n`);
  const accessToken = await mintSession();
  console.log("Session minted.\n");

  const results = [];
  let totalCost = 0;
  for (const item of BATCH) {
    process.stdout.write(`  ${item.id} ("${item.headline}") ... `);
    const prompt = buildInImagePrompt(item.headline, item.scene);
    const res = await callFn("generate-style-preview-asset", accessToken, {
      styleId: `idea-thumb-test__${item.id}`,
      prompt,
      model: MODEL_AIR_TAG,
      negativePrompt: NEGATIVE_PROMPT_IN_IMAGE,
      width: 1280,
      height: 720,
    });
    if (!res.ok) {
      console.log("FAILED", res.status, JSON.stringify(res.json));
      results.push({ ...item, ok: false, error: res.json });
      continue;
    }
    console.log("OK", res.json.publicUrl);
    totalCost += res.json.costUSD ?? 0;
    results.push({ ...item, ok: true, publicUrl: res.json.publicUrl, costUSD: res.json.costUSD });
  }

  console.log("\n=== RESULTS (for manual visual spelling check) ===");
  console.log(JSON.stringify(results.map((r) => ({ id: r.id, headline: r.headline, ok: r.ok, publicUrl: r.publicUrl ?? null, costUSD: r.costUSD ?? null })), null, 2));
  console.log(`\nSucceeded: ${results.filter((r) => r.ok).length}/${BATCH.length}. Total cost: $${totalCost.toFixed(4)}`);
}
main().catch((e) => { console.error("BATCH FAILED:", e); process.exit(1); });
