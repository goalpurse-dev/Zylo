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
