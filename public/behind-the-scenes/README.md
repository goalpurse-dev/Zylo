# Behind the Scenes — example asset slots

Drop your real "Behind the Scenes" footage in here using these **exact filenames** — the app reads them straight from this folder, so no code changes are needed after you swap them in (just overwrite and hard-refresh).

| Filename | Used for | Spec |
|---|---|---|
| `example-1.mp4` | First example clip shown on the idle/empty results screen (before a user's first creation) — visible on mobile and desktop | Vertical 9:16, ~8s, muted loop, H.264 mp4 |
| `example-2.mp4` | Second example clip, shown next to example-1 — **desktop only** (hidden on mobile to keep the empty state to one clip there) | Vertical 9:16, ~8s, muted loop, H.264 mp4 |
| `poster.webp` | Fallback thumbnail — used as the soft blurred background behind the idle-state headline, and as the placeholder image in "Your Series" list items that don't have their own generated thumbnail yet | Vertical 9:16, webp |

Right now these three files are placeholders borrowed from another template (a road-trip photo/clip) just so the page isn't broken — swap them for real miniature-disaster shots/clips from this niche whenever you have them.
