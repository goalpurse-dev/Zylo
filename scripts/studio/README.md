# Zyvo Studio (v1, local)

Animated "how I made this with Zyvo" videos (owner's brief, 2026-10-29). The format was learned from the reference
breakdown in `content/reference-videos/reports/` (that folder is gitignored); nothing from that video is reused.

Runs on this laptop: three.js in headless Chrome on the GPU, $0 per render.

- `cast.js`: the two original characters.
  - The creator: teal beanie, round glasses, denim jacket.
  - Zee, the Zyvo mascot: a hovering violet block with a face screen, lime pixel eyes and a lime "Z" antenna.
  - Each has expressions (neutral, happy, sad, shocked, smug, thinking), blinks, mouth flaps from loudness (0..1) and arm poses (rest, point, shrug, wave, holdCard, type).
- `look.js` + `look.html`: the M1 look frames.
  - `?look=A`: night studio.
  - `?look=B`: violet stage with a wall of real outputs.
  - `?look=C`: clay studio.
  - `?look=E`: the expression sheet. renderAt(t) shows expression floor(t).
- `render.mjs`: stills or a clip. It serves three/n8ao/postprocessing and the CC0 textures from the Cutaway render folder (`PROTO_DIR`), and real Zyvo outputs from `PICS_DIR`. `PICS_DIR` holds `manifest.json` plus the files. Those are real active assets from the Content Machine asset library, downloaded read-only.

Example render:

    PROTO_DIR=<cutaway render folder> PICS_DIR=<real outputs> PAGE="look.html?look=A" node render.mjs <ffmpeg> out/lookA 1 30 0.5

Honesty: screens, walls and cards show only real Zyvo outputs (never UI crops presented as outputs, never AI images presented as Zyvo output). Tool labels are real tool names. No Claude or third-party branding.
