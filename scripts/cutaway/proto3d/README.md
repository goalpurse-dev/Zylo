# Blocky 3D prototype (research, not production)

The 10 s landfill opening from research/seamless-niche/PRODUCTION_PLAN.md: three.js scene (scene.js), rendered frame by frame in headless Chrome (render.mjs) and piped to ffmpeg. Costs nothing to run.

It needs three@0.169.0 and puppeteer-core@23.5.0 next to it (not added to the repo's package.json on purpose):

    npm install three@0.169.0 puppeteer-core@23.5.0 n8ao@1.9.4 postprocessing@6.36.3
    node render.mjs <ffmpeg> out.mp4 10 30          # full clip
    node render.mjs <ffmpeg> shots/s 10 30 1.0,5.6   # stills at given times
    SOFTWARE_GL=1 node render.mjs ...                # CPU-only render (what a GPU-less server does)
    PAGE="look.html?look=A" node render.mjs <ffmpeg> shots/lookA 1 30 0   # M1 look frames A, B, C

look.js is the M1 look-frame scene (bevelled blocks, N8AO ambient occlusion, soft shadows, image-based light). Debug query flags: noao, nobloom, aodebug, hide=<tag>, range=a-b.

preview.js is the M1 10 s preview (look B tuned, timeline keyed to voice_A_30s's words): PAGE=preview.html node render.mjs <ffmpeg> preview_silent.mp4 11.46 30, then mux test3b's mix_20.mp3 and burn its captions.ass. Grade override: preview.html?sat=0.85&con=1.12

world.js: smooth diorama ground (continuous grass with a rounded lip, strata shader on the cut face and pit walls, clay-crumb clumps, mound). smooth.js: the three smooth style frames, PAGE="smooth.html?s=1|2|3".

real.js: the four realistic looks R1-R4 (PAGE="real.html?r=1..4"). Needs the CC0 Poly Haven textures and HDRI in ./assets: node fetchAssets.mjs ./assets (about 63 MB, not committed). Sources and authors in ASSET_SOURCES.md. render.mjs prints the GPU frame time for stills.

Full landfill (M1): node fullAudio.mjs <worktree> <ffmpeg> <outDir> (times, captions, mixes; the end card pops 0.4 s after the voice audibly stops, measured by speechEnd.mjs), copy outDir/times.json here as times_full.json, node makeFull.mjs, PAGE=full.html node render.mjs <ffmpeg> out.mp4 <lengthEnd> 30, then burn outDir/captions.ass and mux outDir/mix_end.mp3.

French drain (second topic): node drainVoice.mjs <worktree> <voiceDir> (one paid ElevenLabs take; refuses if it could pass $0.15 or if a take already exists), SECTION_WORDS="And|Wrap|Water" node voiceSilence.mjs <ffmpeg> raw.mp3 raw.words.json voice_final.mp3, node drainAudio.mjs <worktree> <ffmpeg> <outDir>, copy outDir/times.json here as times_drain.json, node makeDrain.mjs, PAGE=drain.html node render.mjs <ffmpeg> out.mp4 <lengthEnd> 30 (drain.html?endcard=0 drops the sign; ?cam=px,py,pz,tx,ty,tz fixes the camera for stills).

kit/: the M2 parts kit, reusable across topics: verbs (easings), camera (key path), digCut (any box cut dug with flying dirt and a mound), fill (rising/lifting blocks, pebbles on the section, a water level inside a material, pouring particles, wipe-in blocks), pipe (any path, perforated or solid, flow dots), overlay (arrows, also flat; outlines), weather (rain, runoff streams, storm light), sheet (fabric/liner wraps), props (printed sheet or book, flag with a "no" cross, shrubs, puddle, crack, the end sign).

R1 preview: node voiceCut.mjs <worktree> <ffmpeg> <outDir> (voice_A's read with pauses cut to 80 ms, word times, captions.ass, -20 dB mix), copy outDir/times.json here, node makePreview2.mjs (builds preview2.js = R1 home world from real.js + anim_r1.js), then PAGE=preview2.html node render.mjs <ffmpeg> out.mp4 <lengthSec> 30.
