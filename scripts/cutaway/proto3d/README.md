# Blocky 3D prototype (research, not production)

The 10 s landfill opening from research/seamless-niche/PRODUCTION_PLAN.md: three.js scene (scene.js), rendered frame by frame in headless Chrome (render.mjs) and piped to ffmpeg. Costs nothing to run.

It needs three@0.169.0 and puppeteer-core@23.5.0 next to it (not added to the repo's package.json on purpose):

    npm install three@0.169.0 puppeteer-core@23.5.0
    node render.mjs <ffmpeg> out.mp4 10 30          # full clip
    node render.mjs <ffmpeg> shots/s 10 30 1.0,5.6   # stills at given times
    SOFTWARE_GL=1 node render.mjs ...                # CPU-only render (what a GPU-less server does)
