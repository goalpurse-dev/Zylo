// "Made with Zyvo" on Home: which templates and videos show, from src/data/communityShowcase.json.
// Pure (no React, no env) so tests can run it.

const NEW_DAYS = 30;

/**
 * @param data the parsed communityShowcase.json
 * @param opts.base     public folder the file names live in (…/storage/v1/object/public/showcase/community)
 * @param opts.hidden   template names never shown (homeContent HIDDEN_TEMPLATES: real people / brands)
 * @param opts.off      template ids switched off right now (Blocky before its global switch, Cutaway when off)
 * @returns templates newest first, each with videos [{ id, src, poster, sound }]; no template without videos
 */
export function showcaseTemplates(data, { base = "", hidden = [], off = [], now = Date.now() } = {}) {
  return (data?.templates ?? [])
    .filter((t) => !hidden.includes(t.name) && !off.includes(t.id))
    .map((t) => ({
      id: t.id,
      name: t.name,
      path: t.path,
      desc: t.desc,
      addedAt: t.addedAt,
      isNew: Boolean(t.addedAt) && now - Date.parse(t.addedAt) < NEW_DAYS * 86_400_000,
      videos: (t.videos ?? [])
        .filter((v) => v?.file)
        .map((v) => ({ id: v.file, src: `${base}/${v.file}.mp4`, poster: `${base}/${v.file}.webp`, sound: v.sound !== false })),
    }))
    .filter((t) => t.videos.length > 0)
    .sort((a, b) => (Date.parse(b.addedAt) || 0) - (Date.parse(a.addedAt) || 0));
}

/** Every video of the given templates in order, each with its template (the viewer's list). */
export function flatVideos(templates) {
  return templates.flatMap((t) => t.videos.map((v) => ({ ...v, template: t })));
}
