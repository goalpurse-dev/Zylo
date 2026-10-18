// Content Machine: the vision QA check (owner, 2026-10-18). After a slideshow is rendered, CM_MODEL_FAST
// looks at every final slide and flags what a program can't see: a cut-off head or subject, letters or
// garbled text inside a generated picture, distorted hands or faces, unreadable text, a large empty
// area, anything that resembles a real person or a brand. Strict about logos on objects (owner, 2026-10-18: an Apple-like logo on a laptop was missed once). A flagged slide gets ONE regenerate (its
// generated picture is made again); if it is still flagged, it is marked in admin.

export const QA_FLAGS = ["cut_off_subject", "garbled_text_in_image", "distorted_hands_or_faces", "unreadable_text", "large_empty_area", "resembles_real_person_or_brand", "logo_on_object"];
export const QA_LABELS = {
  cut_off_subject: "a head or subject is cut off", garbled_text_in_image: "letters or garbled text inside the picture",
  distorted_hands_or_faces: "distorted hands or faces", unreadable_text: "text is hard to read", large_empty_area: "a large empty area",
  resembles_real_person_or_brand: "resembles a real person or a brand", logo_on_object: "a logo or brand mark on an object",
};

export const QA_SCHEMA = {
  type: "object", additionalProperties: false, required: ["slides"],
  properties: {
    slides: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["slide", ...QA_FLAGS, "note"],
        properties: { slide: { type: "integer" }, ...Object.fromEntries(QA_FLAGS.map((k) => [k, { type: "boolean" }])), note: { type: ["string", "null"] } },
      },
    },
  },
};

export const QA_SYSTEM = `You are the final quality check for social-media slides (1080×1920) before they are posted. For each slide image, answer each question true or false, judging what a viewer on a phone would see:
- cut_off_subject: a person's or character's head, or the picture's main subject, is cut off by the frame edge.
- garbled_text_in_image: the PICTURE (not the slide's own clean headline/body text) contains letters, words or garbled pseudo-text.
- distorted_hands_or_faces: hands, fingers or faces in the picture look malformed.
- unreadable_text: some of the slide's text is too small, too low-contrast or covered, so it is hard to read on a phone.
- large_empty_area: a large part of the slide is empty and looks unfinished (normal margins are fine).
- resembles_real_person_or_brand: anything looks like a real, identifiable person, a celebrity, or a real brand's logo or product (the tool names and small official logos next to tool names on tool cards are fine; Zyvo's own screens are fine).
- logo_on_object: the PICTURE shows any logo, brand mark or symbol on an object: a laptop lid, the back of a phone, a shirt, a cap, a cup, a bag. Be strict: a small or simplified one counts (an apple shape on a laptop lid, a swoosh on a shoe, a bitten fruit, three stripes). Not the official logos drawn next to tool names on tool cards.
note: one short line when anything is true, else null. Be strict about real faces and garbled text; don't flag stylised cartoon characters for being cartoons.
Return only the JSON object, one entry per slide, numbered as given.`;

export function qaRequest({ model, slides }) {
  const content = [];
  for (const s of slides) {
    content.push({ type: "text", text: `slide ${s.slide}: ${s.kind}; its picture is ${s.picture}` });
    content.push({ type: "image", source: { type: "url", url: s.url } });
  }
  content.push({ type: "text", text: `Check these ${slides.length} slides.` });
  return {
    model, max_tokens: 3000,
    system: [{ type: "text", text: QA_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content }],
    output_config: { effort: "low", format: { type: "json_schema", schema: QA_SCHEMA } },
  };
}

/** {slide (1-based): [flag labels]} for the flagged slides only. */
export function qaFindings(result) {
  const out = {};
  for (const s of result?.slides ?? []) {
    const flags = QA_FLAGS.filter((k) => s[k] === true).map((k) => QA_LABELS[k]);
    if (flags.length) out[s.slide] = { flags, note: s.note ?? null };
  }
  return out;
}
