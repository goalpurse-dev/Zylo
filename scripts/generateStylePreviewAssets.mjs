// 2026-10-02 "Production Setup redesign" pass, Section 8 — one-time
// engineering script. Generates ONE permanent 16:9 Nano Banana 2 preview per
// Visual Style variant via the internal generate-style-preview-asset
// function (no jobs row, no user credit charge — see that function's own
// header comment). Same canonical neutral scene held constant across all 10
// so the visual difference reflects STYLE, not subject, per the explicit
// instruction. Prints each result's public URL + cost; run once, then paste
// the URLs into visualStyles.js.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(SUPABASE_URL, SERVICE_KEY);
const TEST_EMAIL = "upwardlift6@gmail.com";

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

const SCENE = "16:9 widescreen illustration. A single person stands beside a small campfire in an open, simple landscape at dusk. They raise one arm and point up toward a small glowing abstract diagram shape floating in the sky above them — a simple explanatory icon made of a few basic geometric lines and a circle, not readable text or numbers. Wide, uncluttered composition, subject clearly centered-left, diagram icon upper-right, campfire between them and slightly foreground.";

const STYLES = [
  {
    id: "classic_flat_stickman",
    prompt: `${SCENE}\n\nSTYLE: Flat-color 2D doodle/stickman illustration. Simplified stickman/doodle explainer construction — circle head, dot eyes, stick limbs, mitten hands — never a detailed or semi-realistic character. Uniform thin, clean black outlines of identical weight everywhere, no sketchiness, no variable line weight. Simple geometric primitives — circles, rounded rectangles, straight or gently curved lines. Flat solid fills only, no gradients, no shading, no highlights, no texture. 2D flat, no 3D rendering, no depth shading. Non-realistic, iconographic identity. Background: 2-3 flat color layers (sky, ground, campfire glow), never photographic.\n\nComposition: wide flat 2D explainer framing, subject and diagram icon both clearly readable, generous flat color background.\n\nNo text, no captions, no photorealism, no 3D render, no anime, no painterly texture, no sketchy hand-drawn lines, no gradients, no drop shadows.`,
  },
  {
    id: "crude_paint_doodle",
    prompt: `${SCENE}\n\nSTYLE: Crude basic-paint-program doodle, intentionally uneven mouse-drawn outlines, rough bucket-fill colors slightly overflowing their lines, amateur comedy MS-Paint aesthetic, deliberately unpolished linework, flat crude shapes.\n\nComposition: same wide scene, subject and diagram icon both clearly readable despite the intentionally crude linework.\n\nNo text, no captions, no photorealism, no 3D render, no anime, no smooth vector lines, no professional polish.`,
  },
  {
    id: "whiteboard_marker",
    prompt: `${SCENE}\n\nSTYLE: Clean white background, black marker illustration linework, sparse red and blue marker accent colors, hand-drawn educational whiteboard-diagram aesthetic, visible marker-stroke texture, minimal color fill.\n\nComposition: whiteboard-style explainer framing, diagram icon rendered as a simple marker sketch in the sky.\n\nNo text, no captions, no photorealism, no 3D render, no anime, no flat vector fills, no gradients.`,
  },
  {
    id: "chalkboard",
    prompt: `${SCENE}\n\nSTYLE: Dark green-black chalkboard background, white and pastel chalk-drawn illustration, slight chalk dust/grain texture, hand-drawn educational chalk-diagram aesthetic.\n\nComposition: chalkboard explainer framing, diagram icon drawn in light chalk lines against the dark board.\n\nNo text, no captions, no photorealism, no 3D render, no anime, no flat vector fills, no smooth digital shading.`,
  },
  {
    id: "paper_cutout",
    prompt: `${SCENE}\n\nSTYLE: Layered construction-paper cutout shapes, clean cut and torn paper edges, subtle paper grain texture, handmade layered depth with soft drop shadows between paper layers, flat paper-colored shapes for figure, campfire, ground and sky.\n\nComposition: layered paper-cutout scene, diagram icon rendered as a small cut-paper shape floating above.\n\nNo readable text, no photorealism, no 3D render, no anime, no smooth vector gradients, no glossy finish.`,
  },
  {
    id: "silhouette_accent",
    prompt: `${SCENE}\n\nSTYLE: Black simplified silhouette figure, flat two-tone environment (dark ground/horizon, one strong warm accent color for sky and campfire glow), high contrast, minimal internal detail, iconic bold shapes.\n\nComposition: strong silhouette compositional framing, diagram icon rendered as a simple glowing accent-color icon against the flat sky.\n\nNo text, no photorealism, no 3D render, no anime, no multi-color palette, no fine detail.`,
  },
  {
    id: "vintage_parchment_ink",
    prompt: `${SCENE}\n\nSTYLE: Warm aged parchment background, simple brown ink linework, muted flat watercolor-like washes, historical map-and-journal illustration language, subtle paper aging texture.\n\nComposition: antique-illustration framing, diagram icon rendered as a simple ink-drawn emblem in the sky, like an old journal sketch.\n\nNo text, no photorealism, no 3D render, no anime, no bright saturated colors, no glossy modern finish.`,
  },
  {
    id: "bold_flat_vector",
    prompt: `${SCENE}\n\nSTYLE: Rounded geometric shapes, no outlines, vibrant flat saturated color blocks, no gradients, clean modern flat-vector illustration, smooth simplified forms.\n\nComposition: bold flat-vector framing, diagram icon rendered as a clean geometric flat-color icon in the sky.\n\nNo text, no photorealism, no 3D render, no anime, no outlines, no texture, no gradients.`,
  },
  {
    id: "comic_doodle",
    prompt: `${SCENE}\n\nSTYLE: Bold expressive simplified ink outlines, flat comic-book colors, dynamic pose with subtle action/motion lines, energetic hand-drawn comic-doodle aesthetic.\n\nComposition: dynamic comic-panel framing, diagram icon rendered as a bold comic-style icon with a few motion lines in the sky.\n\nNo text, no speech bubbles, no photorealism, no 3D render, no anime, no painterly texture.`,
  },
  {
    id: "blueprint_schematic",
    prompt: `${SCENE}\n\nSTYLE: Flat blue technical blueprint background, thin white schematic linework, cutaway/diagram-style rendering, technical-drawing aesthetic, faint grid lines.\n\nComposition: technical blueprint framing, diagram icon rendered as a simple white schematic line-icon in the sky.\n\nNo text, no photorealism, no 3D render, no anime, no color beyond blue and white, no photographic shading.`,
  },
];

async function main() {
  const accessToken = await mintSession();
  console.log("Session minted. Generating", STYLES.length, "style previews (Nano Banana 2, 1K, 16:9)...\n");

  const results = [];
  let totalCost = 0;
  for (const style of STYLES) {
    process.stdout.write(`  ${style.id} ... `);
    const res = await callFn("generate-style-preview-asset", accessToken, { styleId: style.id, prompt: style.prompt });
    if (!res.ok) {
      console.log("FAILED", res.status, JSON.stringify(res.json));
      results.push({ id: style.id, ok: false, error: res.json });
      continue;
    }
    console.log("OK", res.json.publicUrl);
    totalCost += res.json.costUSD;
    results.push({ id: style.id, ok: true, ...res.json });
  }

  console.log("\n=== SUMMARY ===");
  console.log(JSON.stringify(results, null, 2));
  console.log("\nTotal cost: $" + totalCost.toFixed(4), `(${results.filter((r) => r.ok).length}/${STYLES.length} succeeded)`);
}

main().catch((e) => { console.error("STYLE PREVIEW GENERATION FAILED:", e); process.exit(1); });
