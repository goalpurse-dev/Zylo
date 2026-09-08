# Long Form: Series architecture (committed, not yet built)

Status: architecture decision only. No Series/Channel UI, tables, or
migrations exist yet. See `series.js` for the frontend-facing anchor
(constants + JSDoc shapes) that this doc backs.

## Hierarchy

```
User
└── Channel (optional, future — connecting a real YouTube channel)
    └── Series (a reusable creative identity)
        └── Project / Video
```

A Channel can have multiple Series. A Series belongs to exactly one
Format. A Project/Video optionally belongs to one Series.

## Why Series exists

Without it, every video is styled independently — video 1 looks one way,
video 2 another, video 3 another. That makes it impossible for a creator
to build a recognizable faceless channel. With a Series, a locked
**Style Bible** gives every video in it the same production DNA.

## The critical distinction: Series Style Bible vs. Project Visual Bible

- **Series Style Bible — HOW the universe is drawn.** Line thickness,
  proportions, rendering, palette behavior, diagram style, texture,
  lighting language, narrator voice, pacing defaults, explanation-depth
  default, music direction, thumbnail direction, recurring assets. Shared
  across every video in the series.
- **Project Visual Bible — WHAT exists in *this* video.** The specific
  subjects, props, and setting for one video's topic.

`Final video look = Series Style Bible + Project Visual Bible`. A video
with no Series simply has no Style Bible layer — its own Visual Bible
alone determines its look (today's behavior, unchanged).

Example — one Series ("Ancient Survival"), two videos:

| | Video 1 | Video 2 |
|---|---|---|
| Visual Bible (what) | Viking sailor, longship, North Atlantic, wool clothing | 18th-century sailor, wooden cargo ship, food barrels, ship galley |
| Style Bible (how) | *same* | *same* |

Different content, same recognizable identity.

## Naming (do not conflate)

| Term | Example | Meaning |
|---|---|---|
| **Format** | 2D Explainer | a creation workflow |
| **Series** | Ancient Survival | a reusable creative identity, belongs to one Format |
| **Project** | How Vikings Survived Freezing Seas | one video |

## When a Series gets created

Never forced before a first video. Flow stays: `New Video → Topic →
Story → Look`. During Look, once Zyvo establishes and the user approves a
Style Bible, offer "Save this style as a Series" (or auto-create one with
an editable default name). Only after a Series exists does future video
creation offer "Create in: [Series ▼]" or "+ New Series". None of this UI
exists yet — this section documents the trigger point, not a build task.

## Idea previews + Series (future)

If the user is generating ideas from inside an existing Series, each
concept preview should render using that Series' visual style, so a new
idea already looks like it belongs to the creator's channel. With no
Series, previews use the default Zyvo 2D Explainer style. Today, before
Series exist, this is moot — all previews use the one default style — but
`IdeaCard`'s concept-preview renderer (`shared.jsx`) is the eventual
integration point: a Series ID passed in would swap style there.

## Future persistence sketch (no migrations yet)

```
Channel(id, userId, name, youtubeChannelId?)
Series(id, channelId?, name, formatId, activeStyleBibleVersionId)
SeriesStyleBible(id, seriesId, version, visualStyle, palette, renderingRules,
                 lineworkRules, characterConventions, diagramConventions,
                 mapConventions, narratorVoice, pacingDefaults,
                 explanationDepthDefault, musicDirection, thumbnailDirection,
                 recurringAssets)
Project(id, userId, seriesId?, seriesStyleBibleVersionId?,
        projectVisualBibleVersionId, topic, requestedLength,
        explanationDepth, ideaCategory, ideaDirection, source, selectedIdea)
```

`seriesId` and `seriesStyleBibleVersionId` are nullable on Project — a
video never requires a Series. Exact column types/constraints get
designed properly when persistence work actually begins.
