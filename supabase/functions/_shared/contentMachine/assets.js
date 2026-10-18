// Content Machine: the asset library's tagging. Real Zyvo outputs and UI from the repo (uploaded by
// scripts/contentMachine/importAssets.mjs) are looked at by CM_MODEL_FAST, a few images per call: which
// Zyvo tool made it, its style and subject, tags, and whether it may be used at all. Usable by default;
// EXCLUDED when it shows a real or realistic human (a real person, a celebrity, a lookalike) or a
// third-party character, brand or logo (owner, 2026-10-18). The owner can block anything in admin.

export const ZYVO_TOOLS = ["ai_fruit_story", "blocky_stories", "long_form", "cutaway_explainer", "clay_rescue", "micro_camera", "cartoon_drive_by",
  "behind_the_scenes", "two_am_worlds", "thirty_days", "face_asmr", "kit_swap", "image_generator", "cooking", "ui", "other"];
export const ASSET_KINDS = ["output", "ui", "character", "thumbnail", "scene"];
export const TAG_BATCH = 8;
// Burned-in subtitles (owner, 2026-10-18): none, full (a whole line is readable) or cut (cut off mid-sentence,
// e.g. "Why is there a…"). The writer never gets a "cut" frame and prefers "none".
export const SUBTITLES = ["none", "full", "cut"];

const nullable = (t) => ({ type: [t, "null"] });
export const TAG_SCHEMA = {
  type: "object", additionalProperties: false, required: ["images"],
  properties: {
    images: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["ref", "tool", "kind", "style", "subject", "tags", "realistic_human", "celebrity_or_lookalike", "third_party_character_or_brand", "text_heavy", "subtitles", "usable", "reason"],
        properties: {
          ref: { type: "string" },
          tool: { type: "string", enum: ZYVO_TOOLS },
          kind: { type: "string", enum: ASSET_KINDS },
          style: { type: "string" },
          subject: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          realistic_human: { type: "boolean" },
          celebrity_or_lookalike: { type: "boolean" },
          third_party_character_or_brand: { type: "boolean" },
          text_heavy: { type: "boolean" },
          subtitles: { type: "string", enum: SUBTITLES },
          usable: { type: "boolean" },
          reason: nullable("string"),
        },
      },
    },
  },
};

export const TAG_SYSTEM = `You catalogue images made with Zyvo (an AI video and image app) so they can be reused in Zyvo's own social posts as proof of what Zyvo makes.
For every image you are given (each with its ref and the repo path it came from, which hints at the tool):
- tool: which Zyvo tool made it, from the list (the path is a strong hint: "fruit" → ai_fruit_story, "stickman"/"longform" → long_form, "blocky" → blocky_stories, "clayrescue" → clay_rescue, "2am" → two_am_worlds, "micro-camera" → micro_camera, "cooking" → cooking, "image-generator" → image_generator; website and app screens → ui).
- kind: output (a finished frame or poster), ui (a screen of the app or site), character (a character sheet or cut-out), thumbnail, scene.
- style (2–4 words), subject (at most 12 words, what is shown), tags (3–8 short words).
- realistic_human: true if the image shows a photographic or photoreal human face or body (even an AI-made one).
- celebrity_or_lookalike: true if anyone shown is, or looks like, a real public figure.
- third_party_character_or_brand: true if it shows a character, logo, mascot, sports kit or brand that belongs to someone else (not Zyvo).
- text_heavy: true if it is mostly text.
- subtitles: burned-in subtitles or captions on the picture (spoken lines, story captions). "none" if there are none; "full" if the caption shown is a complete sentence or phrase; "cut" if it stops mid-sentence or mid-word ("Why is there a…"), is cropped by the edge, or is only part of a line.
- usable: false if realistic_human, celebrity_or_lookalike or third_party_character_or_brand is true; otherwise true. Cartoon, clay, fruit, blocky, stickman and other stylised characters ARE usable.
- reason: one short line when usable is false, else null.
Return only the JSON object, one entry per image, in the order given.`;

export function tagRequest({ model, items }) {
  const content = [];
  for (const it of items) {
    content.push({ type: "text", text: `ref ${it.ref} · from ${it.source_path}` });
    content.push({ type: "image", source: { type: "url", url: it.url } });
  }
  content.push({ type: "text", text: `Catalogue these ${items.length} images.` });
  return {
    model, max_tokens: 4000,
    system: [{ type: "text", text: TAG_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content }],
    output_config: { effort: "low", format: { type: "json_schema", schema: TAG_SCHEMA } },
  };
}

/** The row update for one tagged image. The model's "usable" is not trusted alone: any flag excludes it. */
export function assetUpdate(t, now) {
  const flags = [t.realistic_human && "shows a realistic human", t.celebrity_or_lookalike && "a real person or a lookalike", t.third_party_character_or_brand && "a third-party character or brand"].filter(Boolean);
  const excluded = flags.length > 0 || t.usable === false;
  return {
    tool: ZYVO_TOOLS.includes(t.tool) ? t.tool : "other",
    kind: ASSET_KINDS.includes(t.kind) ? t.kind : "output",
    style: String(t.style ?? "").slice(0, 60) || null,
    subject: String(t.subject ?? "").slice(0, 160) || null,
    tags: (t.tags ?? []).map((x) => String(x).toLowerCase().slice(0, 30)).slice(0, 8),
    subtitles: SUBTITLES.includes(t.subtitles) ? t.subtitles : null,
    status: excluded ? "excluded" : "active",
    exclude_reason: excluded ? (flags.join("; ") || t.reason || "not usable") : null,
    tagged_at: now,
  };
}
