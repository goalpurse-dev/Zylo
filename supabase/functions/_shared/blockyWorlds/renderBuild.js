// Blocky Worlds: the oldest worker build the server lets run a job (written by
// scripts/blockyWorlds/engine/runpod/setup.mjs when it switches the endpoint to a new image; never by hand).
// Every job carries it as job.minBuild; a worker on an older image answers STALE_WORKER before any paid work
// (runpod/worker.mjs staleBuild) and the server retries the piece on another worker (render.js retryOf).
// null: no check (an image built before BUILD_ID existed is still live).
export const WORKER_BUILD = "20261106T085847-7819b41f11dd";
