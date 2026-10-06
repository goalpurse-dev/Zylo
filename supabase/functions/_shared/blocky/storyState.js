// Story state machine for Blocky Stories and the mapping from database
// rows to the UI contract (src/.../blocky-stories/api/blockyStoriesApi.js).
//
//   draft ──pictures──▶ pictures ──(all pictures terminal)──▶ pictures_ready
//   pictures_ready ──edit/regenerate/retry one picture──▶ pictures
//   pictures_ready ──animate (every picture ready)──▶ animating ──(all clips terminal)──▶ clips_ready
//   clips_ready | final_ready ──regenerate one clip──▶ animating
//   clips_ready | final_ready ──build final──▶ building ──▶ final_ready | clips_ready (final failed)
//
// The per-kind "all terminal" transitions happen in SQL
// (blocky_refresh_story_status) so they are atomic with the job update.

export const STORY_STATUSES = ["draft", "pictures", "pictures_ready", "animating", "clips_ready", "building", "final_ready", "failed"];

/** Where each user step may start from, and the status it moves the story to. */
export const STEPS = Object.freeze({
  pictures:      { from: ["draft"], to: "pictures" },
  edit:          { from: ["pictures", "pictures_ready"], to: "pictures" },
  regenerate:    { from: ["pictures", "pictures_ready"], to: "pictures" },
  retry_picture: { from: ["pictures", "pictures_ready"], to: "pictures" },
  free_regenerate: { from: ["pictures", "pictures_ready"], to: "pictures" },
  animate:       { from: ["pictures_ready"], to: "animating" },
  reclip:        { from: ["animating", "clips_ready", "final_ready"], to: "animating" },
  final:         { from: ["clips_ready", "final_ready"], to: "building" },
});

const TOO_LATE = "Scenes can't be changed after animating.";

/**
 * Checks a step against the current story and scenes. Returns null when the
 * step may run, otherwise a plain-language reason (shown to the user).
 * @param {string} step @param {{status:string}} story @param {object[]} scenes contract scenes
 * @param {object} [scene] the target scene for single-scene steps
 */
export function stepBlocker(step, story, scenes, scene) {
  const rule = STEPS[step];
  if (!rule) return "Unknown step.";
  if (step === "free_regenerate" && scene && (scene.imageCheck?.status !== "failed" || !scene.imageCheck?.freeRegenerate)) return "This picture has no free regenerate.";
  if (["edit", "regenerate", "retry_picture", "free_regenerate"].includes(step)) {
    if (!rule.from.includes(story.status)) return TOO_LATE;
    if (scene && ["queued", "generating"].includes(scene.imageStatus)) return "This picture is still being made.";
    return null;
  }
  if (step === "pictures") return rule.from.includes(story.status) ? null : "The pictures have already been started.";
  if (step === "animate") {
    if (story.status !== "pictures_ready") return "Finish the scene pictures first.";
    if (scenes.some((s) => s.imageStatus !== "ready")) return "Every scene needs a picture before animating.";
    return null;
  }
  if (step === "reclip") {
    if (!rule.from.includes(story.status)) return "Animate the scenes first.";
    if (scene && ["queued", "generating"].includes(scene.clipStatus)) return "This clip is still being made.";
    return null;
  }
  if (step === "final") {
    if (!rule.from.includes(story.status)) return "Animate every scene first.";
    if (scenes.some((s) => s.clipStatus !== "ready")) return "Every scene needs a clip before the final video.";
    return null;
  }
  return null;
}

/** Job status → scene status shown in the UI. */
export const sceneStatusForJob = (jobStatus) =>
  jobStatus === "queued" ? "queued"
    : ["submitting", "submitted", "provider_done"].includes(jobStatus) ? "generating"
      : jobStatus === "succeeded" ? "ready" : "failed";

/** @returns {import("../../../../src/components/viral-tools/blocky-stories/api/blockyStoriesApi.js").Scene} */
export function toScene(row) {
  return {
    id: row.id,
    index: row.idx,
    title: row.title,
    speakerId: row.speaker_id,
    line: row.line,
    presentIds: row.present_ids,
    durationSec: row.duration_sec,
    imageStatus: row.image_status,
    imageUrl: row.image_url ?? null,
    imagePrompt: row.image_prompt ?? "",
    clipStatus: row.clip_status,
    clipUrl: row.clip_url ?? null,
    error: row.error ?? null,
    // Automatic picture check: "none" | "passed" | "failed" (+ what was wrong, and
    // whether the one free regenerate for a flagged picture is still available).
    imageCheck: {
      status: row.image_check ?? "none",
      notes: row.image_check_notes ?? null,
      freeRegenerate: row.image_check === "failed" && !row.free_regen_used,
    },
  };
}

/** @returns {import("../../../../src/components/viral-tools/blocky-stories/api/blockyStoriesApi.js").Story} */
/** Credits a story has cost so far: every charge minus every refund (blocky_credit_ledger rows). */
export function spentFromLedger(rows) {
  return (rows ?? []).reduce((sum, r) => sum + (r.operation === "refund" ? -1 : 1) * (Number(r.credits) || 0), 0);
}

export function toStory(row, sceneRows, spentCredits = null) {
  const scenes = [...sceneRows].sort((a, b) => a.idx - b.idx).map(toScene);
  const story = {
    id: row.id,
    title: row.title,
    castIds: row.cast_ids,
    castRoles: row.cast_roles ?? {},
    spentCredits,
    quality: row.quality,
    lengthSec: row.length_sec,
    aspect: row.aspect,
    status: row.status,
    scenes,
    final: {
      status: row.final_status,
      url: row.final_url ?? null,
      trimmedSec: Number(row.final_trimmed_sec ?? 0),
      captions: row.final_captions ?? true,
      trimmedPerClipSec: (row.final_trimmed_per_clip ?? []).map(Number),
      error: row.final_error ?? null,
      // Series options (on for episodes until the user changes them) and the cover image.
      partLabel: row.final_status === "none" || row.final_status == null ? Boolean(row.series_id) : Boolean(row.final_part_label),
      endCard: row.final_status === "none" || row.final_status == null ? Boolean(row.series_id) : Boolean(row.final_end_card),
      coverUrl: row.cover_url ?? null,
    },
    createdAt: row.created_at,
  };
  if (row.series_id) {
    story.seriesId = row.series_id;
    story.episodeNumber = row.episode_number;
  }
  return story;
}

/** Recent-list card for a single story. */
export function toRecentSingle(row, sceneRows) {
  return {
    type: "single",
    id: row.id,
    title: row.title,
    castIds: row.cast_ids,
    lengthSec: row.length_sec,
    thumbUrls: [...sceneRows].sort((a, b) => a.idx - b.idx).map((s) => s.image_url).filter(Boolean).slice(0, 3),
    status: row.status,
    createdAt: row.created_at,
  };
}

/** Episodes unlock in order: every made one, then exactly one "next". */
export function episodeStatuses(episodes, storyStatusById) {
  let nextGiven = false;
  return [...episodes].sort((a, b) => a.number - b.number).map((ep) => {
    const made = ep.story_id && storyStatusById.get(ep.story_id) === "final_ready";
    let status = "locked";
    if (made) status = "made";
    else if (!nextGiven) { status = "next"; nextGiven = true; }
    return { number: ep.number, title: ep.title, summary: ep.summary, cliffhanger: ep.cliffhanger, status, ...(ep.story_id ? { storyId: ep.story_id } : {}) };
  });
}
