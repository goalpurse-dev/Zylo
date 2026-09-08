// Naming/architecture anchor for the future Channel → Series → Video
// hierarchy. Nothing here is persisted yet — no Series/Channel UI or tables
// exist. This module exists so "format" and "series" never collapse into
// the same concept in frontend code, and so the eventual Series wiring has
// an obvious home instead of a later rename. Full reasoning in
// SERIES_ARCHITECTURE.md alongside this file.

// A FORMAT is a creation workflow (how a video gets made). Only one exists
// today; more (e.g. a kids-cartoon format) would be added here later.
export const LONG_FORM_FORMATS = [
  { id: "2d-explainer", label: "2D Explainer" },
];

// A SERIES is a reusable creative identity spanning multiple videos in one
// format (e.g. "Ancient Survival"). Not implemented yet — no series exist,
// so there is nothing to list. Kept as an explicit empty export (rather than
// omitted) so callers importing "the current series list" get a stable,
// obviously-temporary answer instead of undefined.
export const USER_SERIES = [];

/**
 * Conceptual shapes for the future persistence layer (not implemented):
 *
 * Channel {
 *   id, userId, name, youtubeChannelId (nullable, set once connected)
 * }
 *
 * Series {
 *   id, channelId (nullable — a series can exist before a channel is connected),
 *   name,                      // e.g. "Ancient Survival"
 *   formatId,                  // e.g. "2d-explainer" — a series belongs to one format
 *   activeStyleBibleVersionId,
 * }
 *
 * SeriesStyleBible (versioned) {
 *   id, seriesId, version,
 *   // HOW the universe is drawn — shared across every video in the series:
 *   visualStyle, palette, renderingRules, lineworkRules, characterConventions,
 *   diagramConventions, mapConventions, narratorVoice, pacingDefaults,
 *   explanationDepthDefault, musicDirection, thumbnailDirection, recurringAssets,
 * }
 *
 * Project (a Video) {
 *   id, userId,
 *   seriesId,                       // nullable — a video may not belong to a series
 *   seriesStyleBibleVersionId,      // nullable — locked at creation time if seriesId is set
 *   projectVisualBibleVersionId,    // WHAT exists in *this* video (subjects/props/setting)
 *   topic, requestedLength, explanationDepth, ideaCategory, ideaDirection,
 *   source, selectedIdea,
 * }
 *
 * FINAL VIDEO LOOK = SeriesStyleBible (how) + ProjectVisualBible (what).
 * A video with no series just has no SeriesStyleBible — its ProjectVisualBible
 * alone determines its look, same as today.
 */
