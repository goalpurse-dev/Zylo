// thirty-days-scene-qa/index.ts
// Lightweight vision QA gate for a just-generated scene still, run BEFORE the
// video-animation credit spend. Not a deep art critique — just: does this
// broadly match the planned scene (protagonist/key characters present,
// correct environment, no catastrophic style drift, usable for animation)?
// POST { generationId, imageUrl, scene: {title, location, characters, visualEvent}, worldBible: {franchise, characters, creatures} }
// Returns { usable: boolean, reason: string }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "content-type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: CORS });

  let body: {
    generationId?: string;
    imageUrl?: string;
    scene?: { index?: number; title?: string; location?: string; characters?: string[]; visualEvent?: string; mainAction?: string; reaction?: string; camera?: string; shotType?: string; protagonistAction?: string };
    worldBible?: {
      franchise?: string; characters?: string[]; creatures?: string[];
      visualStyle?: string; styleMode?: string; styleDirective?: string;
      viewerProtagonist?: { identity?: string; visualIdentity?: string };
    };
    requiredEntities?: string[];
    forbiddenEntities?: string[];
    requiredProps?: string[];
    expectedReferences?: Array<{ entityId?: string; referenceId?: string; label?: string; visualLock?: string; imageUrl?: string }>;
    previousSceneImages?: Array<{ sceneIndex?: number; imageUrl?: string }>;
  } = {};
  try { body = await req.json(); } catch { /* empty body handled below */ }

  const generationId = String(body.generationId ?? "").trim();
  const imageUrl = String(body.imageUrl ?? "").trim();
  if (!generationId || !imageUrl.startsWith("https://")) {
    return new Response(JSON.stringify({ error: "Missing generationId or imageUrl" }), { status: 400, headers: CORS });
  }

  // Ownership check via RLS — no credit/rate-limit RPC for this: it's a
  // cheap, low-detail, single-image, defensive quality gate, not a paid
  // user-facing feature that needs its own reservation ledger.
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: req.headers.get("authorization") ?? "" } },
    auth: { persistSession: false },
  });
  const { data: owned, error: ownershipError } = await supabase
    .from("thirty_days_generations")
    .select("id,scenes")
    .eq("id", generationId)
    .maybeSingle();
  if (ownershipError || !owned) {
    return new Response(JSON.stringify({ error: "Creation access denied" }), { status: 403, headers: CORS });
  }

  const scene = body.scene ?? {};
  const worldBible = body.worldBible ?? {};
  const expectedCharacters = (scene.characters ?? []).filter(Boolean).slice(0, 8);
  const expectedReferences = (body.expectedReferences ?? []).filter((reference) => reference.imageUrl?.startsWith("https://")).slice(0, 4);
  const storedPrevious = (Array.isArray(owned.scenes) ? owned.scenes : [])
    .filter((item: any) => Number(item?.index) < Number(scene.index ?? 0) && String(item?.imageUrl || "").startsWith("https://"))
    .map((item: any) => ({ sceneIndex: Number(item.index), imageUrl: String(item.imageUrl) }));
  const previousByIndex = new Map([...storedPrevious, ...(body.previousSceneImages ?? [])]
    .filter((item) => item.imageUrl?.startsWith("https://"))
    .map((item) => [Number(item.sceneIndex), item]));
  const previousScenes = [...previousByIndex.values()].sort((a, b) => Number(a.sceneIndex) - Number(b.sceneIndex)).slice(-3);

  const prompt = [
    `You are a fast quality gate for an AI-generated scene image, about to be spent on video animation credits. Do NOT deeply critique the art. Just answer: is this image broadly usable?`,
    `Franchise: ${worldBible.franchise || "(unspecified)"}.`,
    `Planned scene ${Number(scene.index ?? 0) + 1}: "${scene.title || ""}" at "${scene.location || ""}". Main action: ${scene.mainAction || scene.visualEvent || "(unspecified)"}. Reaction: ${scene.reaction || "(unspecified)"}. Camera/framing: ${scene.camera || scene.shotType || "(unspecified)"}.`,
    `Mandatory viewer protagonist: ${worldBible.viewerProtagonist?.identity || "YOU, the viewer-insert protagonist"}. Visual lock: ${worldBible.viewerProtagonist?.visualIdentity || "the supplied protagonist/POV reference"}. Required action: ${scene.protagonistAction || "actively participates in this scene"}.`,
    `Required visual style mode: ${worldBible.styleMode || "auto / Franchise Accurate"}. Style interpretation: ${worldBible.styleDirective || worldBible.visualStyle || "preserve the franchise's native visual language"}.`,
    expectedCharacters.length ? `Expected characters/creatures that should be identifiable if present in this scene: ${expectedCharacters.join(", ")}.` : "",
    body.requiredEntities?.length ? `Required entity IDs: ${body.requiredEntities.join(", ")}. Each must match its separately supplied identity reference, canonical type/form, and visual lock.` : "",
    body.forbiddenEntities?.length ? `Forbidden entity IDs: ${body.forbiddenEntities.join(", ")}. Fail if any appear.` : "",
    body.requiredProps?.length ? `Required props: ${body.requiredProps.join(", ")}.` : "",
    expectedReferences.length ? `Identity reference order after the generated scene: ${expectedReferences.map((reference, index) => `image ${index + 2} = ${reference.entityId} / ${reference.label}; lock: ${reference.visualLock}`).join(" | ")}.` : "",
    previousScenes.length ? `Previous episode-scene comparison images follow the identity references: ${previousScenes.map((item, index) => `comparison image ${index + 1} = earlier scene ${Number(item.sceneIndex) + 1}`).join("; ")}. They are only for DUPLICATE detection, never identity guidance.` : "",
    `Check the exact protagonist and every recurring entity against its source image. A wrong species/form/person is a catastrophic identity failure, not a minor imperfection. Also check forbidden entities, main action, props, and environment.`,
    `CAST-INTEGRITY GATE: set identityDrift=true and usable=false if any character masquerades as another, has another character's clothing/body/species/role, a creature or mascot is turned into a humanlike stand-in, an unplanned character appears, or a required character's exact form is wrong. Allow only a transformation/costume change explicitly required by the planned scene.`,
    `SINGLE-FRAME GATE: the result must be one continuous full-frame shot. A comic page, manga page, storyboard, contact sheet, split screen, collage, grid, inset, sequential panels, or multiple variations inside one image is unusable.`,
    `CANVAS GATE: set multiPanel=true and usable=false ONLY if visible borders, dividers, insets, or separate framed images divide the canvas horizontally/vertically, stack it into strips, or combine an establishing view and an action view. Multiple characters, creatures, objects, or actions inside ONE uninterrupted location are NOT panels. Never infer panels merely because several subjects appear in the same frame.`,
    `ZERO-TEXT GATE: set hasReadableText=true and usable=false if the generated scene contains any title/day/location card, subtitle, caption, dialogue, speech bubble, lower third, label, logo, watermark, UI/HUD, or other readable/pseudo-readable letters or numbers. Ignore only unavoidable tiny canonical symbols that are part of an identity reference, never scene narration or interface text.`,
    `POV GATE: when camera/framing is first-person or POV, set povViolation=true and usable=false if an outside view of the protagonist, a new stand-in protagonist, or a third-person camera appears.`,
    `DUPLICATE GATE: compare the generated scene with every earlier-scene comparison image. Set nearDuplicate=true and usable=false if it substantially repeats the same background/location view, pose, subject placement, camera angle, staging, lighting motif, and composition so it reads like a copy rather than the next story shot. Shared character identity alone is NOT duplication. Continuity in the same location is allowed only when framing, action, and staging visibly progress.`,
    `Return structured results. observedEvent must be a concrete factual description of what the generated image actually shows; never copy an unobserved plan claim.`,
  ].filter(Boolean).join("\n");

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
            ...expectedReferences.map((reference) => ({ type: "image_url", image_url: { url: reference.imageUrl, detail: "low" } })),
            ...previousScenes.map((item) => ({ type: "image_url", image_url: { url: item.imageUrl, detail: "low" } })),
          ],
        }],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "thirty_days_scene_qa",
            strict: true,
            schema: {
              type: "object",
              properties: {
                usable: { type: "boolean" }, reason: { type: "string" }, observedEvent: { type: "string" },
                nearDuplicate: { type: "boolean" }, duplicateOfSceneIndex: { type: ["integer", "null"] }, similarityReason: { type: "string" },
                hasReadableText: { type: "boolean" }, multiPanel: { type: "boolean" }, identityDrift: { type: "boolean" }, povViolation: { type: "boolean" },
                identityChecks: { type: "array", items: { type: "object", additionalProperties: false, properties: { entityId: { type: "string" }, matched: { type: "boolean" }, observedIdentity: { type: "string" } }, required: ["entityId", "matched", "observedIdentity"] } },
              },
              required: ["usable", "reason", "observedEvent", "nearDuplicate", "duplicateOfSceneIndex", "similarityReason", "identityChecks", "hasReadableText", "multiPanel", "identityDrift", "povViolation"],
              additionalProperties: false,
            },
          },
        },
        max_tokens: 220,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      // A QA outage must never block generation.
      return new Response(JSON.stringify({ usable: true, status: "unavailable", reason: "qa_unavailable", observedEvent: "", identityChecks: [], nearDuplicate: false, duplicateOfSceneIndex: null, similarityReason: "" }), { status: 200, headers: CORS });
    }

    const json = await res.json();
    const content = String(json.choices?.[0]?.message?.content ?? "{}");
    const parsed = JSON.parse(content);
    // A vision model may call a custom-named Pokémon by its species or make
    // a subjective style judgment. Preserve that feedback for the creator,
    // but only reject defects that are objectively unsafe to animate.
    const qaReason = String(parsed?.reason ?? "").slice(0, 200);
    // multiPanel is explicitly defined as a divided canvas in the vision
    // contract. It is not inferred from the number of characters, so trust
    // it here and block comic strips, including vertical triptychs.
    const strongPanelDefect = parsed?.multiPanel === true
      || /\b(split[- ]?screen|split[- ]?panel|comic page|manga page|storyboard|contact sheet|collage|grid|inset(?: panel)?|divided canvas|stacked strips|separate framed images|triptych|three[- ]panel|three[- ]strip|panel layout|horizontal (?:divider|split|border)|vertical (?:divider|split|border))\b/i.test(qaReason);
    const structuralDefect = strongPanelDefect || parsed?.hasReadableText === true
      || parsed?.nearDuplicate === true
      || /\b(watermark|readable text|caption|subtitle|speech bubble|logo|ui\/hud)\b/i.test(qaReason);
    return new Response(JSON.stringify({
      usable: !structuralDefect,
      reason: qaReason,
      status: "checked",
      observedEvent: String(parsed?.observedEvent ?? "").slice(0, 600),
      identityChecks: Array.isArray(parsed?.identityChecks) ? parsed.identityChecks.slice(0, 8) : [],
      nearDuplicate: parsed?.nearDuplicate === true,
      duplicateOfSceneIndex: Number.isInteger(parsed?.duplicateOfSceneIndex) ? parsed.duplicateOfSceneIndex : null,
      similarityReason: String(parsed?.similarityReason ?? "").slice(0, 300),
      hasReadableText: parsed?.hasReadableText === true,
      multiPanel: parsed?.multiPanel === true || strongPanelDefect,
      // Retained as diagnostics, not automatic rejection signals. Identity
      // mismatches in low-detail vision are especially unreliable for named
      // creatures and viewer-insert POV characters.
      identityDrift: parsed?.identityDrift === true || (Array.isArray(parsed?.identityChecks) && parsed.identityChecks.some((check: any) => check?.matched === false)),
      povViolation: parsed?.povViolation === true,
    }), { status: 200, headers: CORS });
  } catch (error) {
    console.error("[thirty-days-scene-qa] error:", String(error));
    return new Response(JSON.stringify({ usable: true, status: "unavailable", reason: "qa_unavailable", observedEvent: "", identityChecks: [], nearDuplicate: false, duplicateOfSceneIndex: null, similarityReason: "" }), { status: 200, headers: CORS });
  }
});
