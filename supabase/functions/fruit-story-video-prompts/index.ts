// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENAI_KEY  = Deno.env.get("OPENAI_API_KEY")!;
const OPENAI_CHAT = "https://api.openai.com/v1/chat/completions";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function ok(data: any) {
  return new Response(JSON.stringify({ ok: true, ...data }), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
function fail(msg: string, status = 400) {
  return new Response(JSON.stringify({ ok: false, error: msg }), {
    status, headers: { ...CORS, "Content-Type": "application/json" },
  });
}

interface CastEntry {
  id: string;
  displayName?: string;
  referenceLabel?: string;
  fruitType?: string;
  narrativeRole?: string;
  role?: string;
}

interface SceneInput {
  sceneNumber: number;
  imageUrl: string;
  title?: string;
  storyPurpose?: string;
  beatType?: string;
  emotionDirection?: string;
  characterIdsInScene?: string[];
}

interface DialogueLine {
  speaker: string;
  line: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return fail("Method not allowed", 405);
  if (!OPENAI_KEY) return fail("OpenAI key not configured", 500);

  let body: any;
  try { body = await req.json(); } catch { return fail("Invalid JSON"); }

  const { scenes, form } = body as { scenes: SceneInput[]; form: any };
  if (!Array.isArray(scenes) || scenes.length === 0) return fail("scenes array required");

  const castBible: CastEntry[] = Array.isArray(form?.castBible) ? form.castBible : [];
  const storyPreset: string = form?.storyPreset ?? "";

  const results = await Promise.all(
    scenes.map((scene) => generateSceneDialogue(scene, castBible, storyPreset)),
  );

  return ok({ scenes: results });
});

async function generateSceneDialogue(
  scene: SceneInput,
  castBible: CastEntry[],
  storyPreset: string,
): Promise<{ sceneNumber: number; dialogue: DialogueLine[]; imageObservations: string }> {
  const sceneNum = Number(scene.sceneNumber ?? 1);
  if (!scene.imageUrl) return { sceneNumber: sceneNum, dialogue: [], imageObservations: "" };

  const sceneCharIds = scene.characterIdsInScene ?? [];
  const sceneCast = castBible.filter((e) => sceneCharIds.includes(e.id));

  const castLines = sceneCast.length > 0
    ? sceneCast.map((e) => {
        const name = e.displayName ?? e.referenceLabel ?? e.id;
        const fruit = e.fruitType ?? "unknown fruit";
        const role = e.narrativeRole ?? e.role ?? "";
        return `- "${name}" — expected species: ${fruit}${role ? ` (${role})` : ""}`;
      }).join("\n")
    : "- (no cast info)";

  const speakerNames = sceneCast
    .map((e) => `"${e.displayName ?? e.referenceLabel ?? e.id}"`)
    .join(" and ");

  const systemPrompt =
    `You are a dialogue writer for a fruit character drama. Write dialogue based on what you ACTUALLY SEE in the scene image.

RULES:
- Carefully look at every character: count them, identify each one's fruit species (orange, pineapple, banana, etc.)
- If any character looks DIFFERENT from expected (wrong species, unexpected appearance), the other characters MUST notice and react — this is the most important rule
- Example: if pineapple parents have an orange baby, they say "Why is this baby an orange?! We are pineapples!"
- Dialogue must feel like a real back-and-forth conversation
- 3-4 lines total, alternating speakers (A, B, A, B)
- Each line: max 8 words, punchy and dramatic
- Use the exact character names provided
- Return JSON only`;

  const userText =
    `Scene ${sceneNum}: "${scene.title ?? ""}"
Story type: ${storyPreset}
Scene purpose: ${scene.storyPurpose ?? ""}
Emotional tone: ${scene.emotionDirection ?? "shock and drama"}

Expected cast in this scene:
${castLines}

Speaker names to use: ${speakerNames || "the visible characters"}

Look carefully at the image. Do the characters match their expected fruit species?
Write dialogue where the characters react to what's actually happening in the scene.

Return JSON:
{
  "imageObservations": "one sentence: what you see, noting any species mismatches or surprises",
  "dialogue": [
    {"speaker": "Character Name", "line": "short punchy line"},
    {"speaker": "Other Character", "line": "short punchy line"},
    {"speaker": "Character Name", "line": "short punchy line"},
    {"speaker": "Other Character", "line": "short punchy line"}
  ]
}`;

  try {
    const response = await fetch(OPENAI_CHAT, {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: scene.imageUrl, detail: "high" } },
              { type: "text", text: userText },
            ],
          },
        ],
        max_tokens: 400,
        temperature: 0.8,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const txt = await response.text();
      console.error(`[fruit-video-prompts] scene ${sceneNum} GPT error`, txt.slice(0, 200));
      return { sceneNumber: sceneNum, dialogue: [], imageObservations: "" };
    }

    const gpt = await response.json();
    const raw = gpt.choices?.[0]?.message?.content ?? "";

    let parsed: any;
    try { parsed = JSON.parse(raw); } catch {
      console.warn(`[fruit-video-prompts] scene ${sceneNum} parse error`, raw.slice(0, 200));
      return { sceneNumber: sceneNum, dialogue: [], imageObservations: "" };
    }

    const dialogue: DialogueLine[] = Array.isArray(parsed.dialogue)
      ? parsed.dialogue
          .filter((r: any) => r?.speaker && r?.line)
          .map((r: any) => ({ speaker: String(r.speaker).trim(), line: String(r.line).trim() }))
          .slice(0, 4)
      : [];

    return {
      sceneNumber: sceneNum,
      dialogue,
      imageObservations: String(parsed.imageObservations ?? "").trim().slice(0, 200),
    };
  } catch (e) {
    console.error(`[fruit-video-prompts] scene ${sceneNum} error`, e);
    return { sceneNumber: sceneNum, dialogue: [], imageObservations: "" };
  }
}
