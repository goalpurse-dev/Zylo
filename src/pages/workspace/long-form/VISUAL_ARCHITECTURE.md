# Long Form: Visual/Script production architecture (committed, not yet built)

Status: architecture decision only, adopted from an external review. No
VisualBeat Director, Entity Registry, Canonical Reference pipeline, scene
generation, or any image/video generation for this system exists yet. This
document — and `visual.js` alongside it — exist so Research and Script Engine
work happening now doesn't foreclose this design later. **Nothing here
triggers or should be read as authorizing any visual generation call.**

Engineering order (do not reorder): Research reliability (current work) →
Script Engine → Visual Interpretation / VisualBeat Director → minimal
Look/Visual Bible → canonical references → scene generation/editing →
TTS/Audio → timeline/render/export. Schemas below are written now so later
phases fit together without a rewrite, not because any phase past Research is
starting.

## The end goal

A user types one idea ("How did Vikings stay warm on freezing ships?") and
Zyvo autonomously produces research, story, narration, a visual world,
references, illustrations, TTS, camera movement, graphics, music/SFX, a
timeline, and a finished video. This is explicitly **not** a generic AI
slideshow generator — it is an automated illustrated-documentary / 2D-story
production system. The user-facing flow stays simple (`IDEA → STORY → LOOK →
GENERATE → EDIT`, eventually with an AUTO MODE toggle); the internal pipeline
is where all of this complexity lives.

## Replacing the old visual pipeline concept

Old concept (superseded): `Style Bible → Visual Bible → Reference Assets →
Storyboard → Scenes`.

New pipeline:

```
FINISHED RESEARCHED SCRIPT
  → VISUAL INTERPRETATION
  → VISUAL BEATS / ROUGH STORYBOARD
  → ENTITY + CONTINUITY EXTRACTION
  → REFERENCE PRIORITY SCORING
  → MINIMUM REQUIRED VISUAL BIBLE
  → CANONICAL REFERENCES
  → SHOT PLANS
  → SCENE GENERATION / EDITING / REUSE
  → VISUAL QA
  → TIMELINE
```

Critical principle: **storyboard demand comes before full reference
generation.** Never generate large reference packs speculatively — the
VisualBeats decide what references are actually needed, then references get
built to satisfy that demand, not the other way around.

## The core question the Visual Director must ask

Not "what image illustrates this sentence?" Instead, for every narration
interval: **what does the viewer need to SEE right now** that —

- improves understanding,
- advances the story,
- shows a state change,
- creates or resolves a payoff,
- refreshes attention, or
- preserves continuity?

If a beat doesn't serve one of these, it doesn't earn a new expensive image.

## Three foundational systems

### 1. VisualBeat

What should appear during a narration interval, **and why**. See
`VisualBeat` in `visual.js` for the full field-level shape. The two fields
that matter most:

- `meaning.informationToCommunicate` — what information the image must
  convey (e.g. "contrast between warmth at the hearth and exposure outside"),
  never a literal sentence restatement ("show a Viking").
- `meaning.revealConstraints` — anti-spoiler constraints: don't show a secret
  before the narration reveals it. Considered a major anti-AI-slop feature.

### 2. WorldState / Continuity

Mandatory explicit tracking for continuity-heavy sequences: temporal state,
environment, character state, prop state, vehicle/machine state. Sparse and
topic-aware — not every field is mandatory for every video. A scene inherits
the previous stable WorldState rather than silently resetting it. See
`WorldState` / `ContinuityGroup` in `visual.js`.

### 3. Canonical References

Immutable, approved identity anchors (`character_viking_01`,
`outfit_viking_winter_01`, etc.) — the machine-readable source of truth for
what an entity looks like. Kept separate from the human-facing **Reference
Board** (a UX summary/fallback model, not the primary identity database — see
"Reference Board UX" below). See `CanonicalReference` in `visual.js`.

## Reference generation is storyboard-driven

```
SCRIPT → VISUAL BEATS → ENTITY REGISTRY → REFERENCE IMPORTANCE SCORE → ONLY NECESSARY REFERENCES
```

Entity categories for V1: `CHARACTER`, `LOCATION`, `IMPORTANT_PROP_OR_OBJECT`,
`VEHICLE_OR_MACHINE`, `DIAGRAM_SUBJECT` (see `ENTITY_CATEGORIES` in
`visual.js`). Entity importance is `HERO` / `RECURRING` / `INCIDENTAL`
(`ENTITY_IMPORTANCE`), driven by a conceptual (never user-exposed)
`referenceNeedScore = recurrence × screenProminence × identitySensitivity ×
narrativeImportance × driftRisk`.

## Hero character reference strategy

3/4 front neutral + profile + face closeup (optionally a rear 3/4) —
**not** full turnaround sheets, **not** 7-expression packs. Character
identity, outfit, and physical state stay separate concepts that compose:

```
Rendered Character = CharacterIdentity + OutfitState + PhysicalState
```

This separation is what makes chronology/POV/wealth-transformation/survival/
biography stories work — the same identity can wear different outfits and
carry different physical states (injured, exhausted, older) without needing a
new character reference each time. No universal pose libraries — only
repeated, identity-defining poses get referenced; incidental performance
poses are generated on demand.

## Location architecture

Treat locations like animation sets: a small number of camera anchors (e.g.
`longhouse_cam_A` through `E`), not unlimited views — returning to a familiar
anchor is good continuity, not a limitation. An internal floor-plan can exist
as reasoning/continuity metadata only; it is never expected to make an image
model produce exact matching architecture.

Two distinct kinds of location change, handled differently:

- **Structural transformation** (e.g. `apartment_poor` → `apartment_luxury`)
  deserves its own separate canonical reference set.
- **Environmental WorldState delta** (day/night/rain) is not its own
  canonical set by default — only promoted to a cached canonical variant if
  it gets reused repeatedly.

## Three visual production modes, one Visual Director

`STORY`, `EXPLAINER`, `HYBRID` (see `VISUAL_MODES` in `visual.js`) are
weightings of one shared Visual Director, not separate codebases:

- **STORY** — character/location/prop/continuity-heavy.
- **EXPLAINER** — mechanisms/diagrams/cutaways, minimal character continuity.
- **HYBRID** — both (e.g. a Vikings topic: recurring humans + ship + clothing
  + environments, plus maps + thermal explanation + cutaways).

The Narrative/Topic system recommends a mode; the Visual Director determines
the final mix per-beat. Never an enforced exact quota.

## Shot strategies

Minimum set for V1 (`SHOT_STRATEGIES` in `visual.js`): `NEW_SETUP`,
`REUSE_WITH_DELTA`, `INSERT`, `DETAIL`, `DIAGRAM`, `MAP`, `COMPARISON`,
`TEXT_INFOGRAPHIC`. Later: `ARCHIVAL_STYLE`, `TIMELINE`, `CUTAWAY`.

`INSERT` is high-leverage and should be used aggressively — documents,
screens, tools, hands, objects — instead of regenerating a whole scene for a
small detail.

## Rendering methods

Not GENERATE-only. `RENDER_METHODS` in `visual.js`: `GENERATE`, `EDIT`,
`REUSE`, `CROP`, `COMPOSITE`, `PROGRAMMATIC_GRAPHIC`.

- Editing/inpainting is first-class for exact continuity: expression changes,
  prop add/remove, screen state, fire on/off, minor clothing/posture/lighting
  changes.
- Use the previous approved image as the edit/image-to-image base for
  same-room/composition/character continuity.
- Regenerate from canonical references for major camera/pose/composition
  changes.
- **Never cascade frame-to-frame indefinitely** (scene2 → scene1, scene3 →
  scene2, …). Periodically re-anchor to canonical references + the approved
  continuity base + current WorldState + the current delta, so drift can't
  compound silently across a long video.

## Visual pacing

Distinguish a **meaningful visual event** from a **new expensive image** —
most visual events should be motion/emphasis on an existing image, not a new
generation.

Rough pacing (not rigid timers — narrative purpose always wins):

- High-energy/explanation sections: ~3–8s per meaningful change.
- Slower narrative sections: ~6–15s.
- Static image hold: 6–12s normally, 12–20s for an important/emotional image
  with evolving meaning, achieved via push/pan/crop/focal-emphasis/overlay —
  never a mechanical "replace every 5s" timer.

## Target visual economics (a ~10-minute V1 video)

Rough targets, not hard quotas — topic drives actual composition:

| Category | Rough count |
|---|---|
| Unique base setups | 25–40 |
| Meaningful edits/variants | 20–40 |
| Inserts/details | 15–30 |
| Diagrams/maps/graphics | 8–18 |
| Total VisualBeats | ~70–120 |
| **Expensive full base generations** | **~25–40** |

Shot-size variation (WIDE/MEDIUM/CLOSE/DETAIL/INSERT) lets multiple shots
derive from one high-res master via crop/pan/push/focal movement, which is
most of how the ~70-120 beat count stays affordable at only ~25-40 real
generations.

## Programmatic text

Never ask an image model to generate important text — titles, labels,
numbers, arrows, captions, timelines, UI, a bank balance, a phone screen, a
chart. Render all of that programmatically. AI image generation only produces
illustration/background.

## Research-grounded art direction

Visual entities connect to the FactGraph (evidence fact IDs / source IDs,
`historicallyImportant`, `uncertainty`, `artDirectionConstraints` — e.g.
"avoid unsupported popular myths"). Research determines factual constraints;
the Visual Director translates those into art direction; the image model
renders within them. Never "make an accurate Viking" with no evidence-aware
constraint attached — this is the same evidence-preservation discipline
Research now enforces on facts (see `advance-long-form-research`), carried
forward into the visual layer.

## Visual payoffs

Narrative props get tracked end-to-end via `setupBeatId`/`payoffBeatId` pairs
(e.g. cracked boots shown early, snow enters the crack later, boots fail even
later). The Visual Director must preserve a prop's established state until
its payoff beat, the same way Research now preserves a fact's uncertainty
until it's actually resolved by evidence rather than by convenient omission.

## Visual QA

Two QA passes, never a single GOOD/BAD boolean:

- **Reference asset QA** (before lock): character — identity/face/hair/
  proportions/outfit/palette/style/silhouette/anatomy/unwanted text;
  location — architecture/door-window placement/hero props/palette/style/
  camera usability/contradictory geometry.
- **Scene QA** (per generated scene, evaluated independently across multiple
  dimensions): VisualBeat adherence, character identity, outfit state,
  location identity, WorldState continuity, required props, forbidden
  elements, historical/factual correctness, style, composition, text
  artifacts.

Automatic regeneration policy: attempt 1 normal, attempt 2 targeted
correction, attempt 3 alternate strategy, then accept-above-floor or flag for
manual review. Max 2-3 expensive automatic attempts — mirrors the
`MAX_STAGE_ATTEMPTS` circuit-breaker discipline already used in Research.

## Reference Board UX

Even though canonical references are internally separate machine-readable
records, the Look stage should still generate a beautiful combined reference
board for the user — this is a major perceived-value moment ("Zyvo
understands your world"), with a loading sequence like:

```
Building your visual world...
  ✓ Art direction
  ✓ Main character
  ✓ Locations
  ✓ Important objects
  ✓ Reference Bible
```

before revealing the board. The board is a UX summary/fallback model adapter
over the canonical references — never itself the primary identity source.

## Series Style Bible stays separate from per-video Visual Bible

Same split already established in `SERIES_ARCHITECTURE.md` for the
Series/Project hierarchy: `SeriesStyleBible` (linework/face
construction/palette behavior — how the universe is drawn, shared across a
series) stays architecturally separate from the per-video Visual Bible
(specific people/places/vehicles/props/historical constraints/motifs for
*this* video). Series doesn't exist yet; this is schema-compatibility
groundwork only, same as `series.js`.

## V1 scope

Build only after Research and Script Engine are validated:

- One excellent Zyvo 2D Style
- VisualBeat Director
- STORY/EXPLAINER/HYBRID weighting
- Entity Registry with HERO/RECURRING/INCIDENTAL classification
- Minimal character/location references + important prop references
- ContinuityGroup + WorldState
- Shot strategies: `NEW_SETUP`, `REUSE_WITH_DELTA`, `INSERT`, `DIAGRAM`
- Programmatic text/graphics
- Simple scene QA
- Push/pull/pan/crop motion only

**Explicitly postponed** (do not build, do not design around needing):
full turnaround sheets, 7-expression packs, pose libraries, sprite sheets,
rigging/skeletal animation, lip sync, a precise 3D floorplan pipeline, dozens
of camera anchors, parallax, multiple art styles, a universal prop library,
3D-to-2D reconstruction, perfect hand/finger QA, infinite regeneration, a
complex reference-sheet editor.

## Long-term autonomous workflow (for context, not a build target)

```
Idea → Discovery → Project → Topic Understanding → Narrative Strategy
  → Story Plan → Research → FactGraph → SCRIPT
  → Retention/Naturalness Critics → Approved Narration
  → VisualBeat Director → Entity Registry → WorldState → Reference Priority
  → Look/Visual Bible → Canonical References → Shot Plans
  → Scene generation/editing → Scene QA → TTS → Audio direction → Timeline
  → motion/graphics/music/SFX → render → FINISHED VIDEO
```

Every expensive artifact in this chain should eventually be versioned,
checkpointed, dependency-aware, and retry-safe — the same durable
stage-machine pattern already proven in Research (see the "Turns Research
from one long synchronous edge-function request into a durable async stage
machine" comment block in the `20260910120000_long_form_research_async.sql`
migration). Do not implement universal orchestration now; just don't make
choices in Script Engine or early Visual work that would prevent adopting it
later.
