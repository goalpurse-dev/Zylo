# Sun visual fix — duplicate analysis after

Dry-run only. Provider submissions: **0**. Credits charged: **0**.

Semantic near-duplicate families use the same tested normalization and **0.9** threshold as the pre-render quality assertion. Style, camera, punctuation, whitespace, render rules, text-safe rules, and reference boilerplate are excluded before comparison.

| Metric | Before | After |
|---|---:|---:|
| Total beats | 214 | 214 |
| GENERATE | 153 | 78 |
| EDIT | 0 | 33 |
| REUSE | 34 | 71 |
| CROP | 0 | 24 |
| COMPOSITE | 0 | 0 |
| PROGRAMMATIC_GRAPHIC | 27 | 8 |
| Estimated provider image operations | 153 | 111 |
| Unique exact raster prompts | 48 | 89 |
| Exact duplicate prompt families | 28 | 6 |
| Largest exact duplicate family | 19 | 8 |
| Near-duplicate GENERATE families | 14 | 0 |
| Largest near-duplicate GENERATE family | 47 | 1 |

## Chapter 5

- Beats: 66
- Render methods: {"GENERATE":10,"REUSE":25,"CROP":14,"PROGRAMMATIC_GRAPHIC":1,"EDIT":16}
- Unique GENERATE prompts: 10/10
- Largest near-duplicate GENERATE family: 1

## Historical style-reference constraint

This preserved Sun world predates the style-only asset role. Its dry-run prompts still carry the full textual Style Bible. Newly planned worlds require a canonical STYLE_REFERENCE asset before GENERATE preflight can pass.
