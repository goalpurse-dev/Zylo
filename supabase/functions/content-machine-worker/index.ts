// content-machine-worker — runs the Content Machine's jobs (_shared/contentMachine/worker.js, pipeline.js).
// Called by the database's minute tick (private.trigger_content_machine) and by the admin API's "Make
// slideshows", always with the x-cm-worker-secret header; anyone else gets a plain 404. It answers at once
// and works in the background (EdgeRuntime.waitUntil), so the tick's 5-second call never waits.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createBudgetGuard } from "../_shared/contentMachine/budgetGuard.js";
import { createStore } from "../_shared/contentMachine/store.js";
import { createFiles, createPipelineDb } from "../_shared/contentMachine/pipelineDb.js";
import { createWorkerHandler } from "../_shared/contentMachine/worker.js";
import { batchResults, createBatch, createMessage, getBatch } from "../_shared/contentMachine/providers/anthropic.js";
import { generateImage } from "../_shared/contentMachine/providers/runware.js";
import { startRender } from "../_shared/contentMachine/providers/fly.js";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const store = createStore(admin);
const FLY_APP = Deno.env.get("FLY_RENDER_APP") ?? "zyvo-render";

Deno.serve(createWorkerHandler({
  secret: Deno.env.get("CM_WORKER_SECRET") ?? "",
  background: (p: Promise<unknown>) => (globalThis as any).EdgeRuntime?.waitUntil?.(p),
  deps: {
    db: createPipelineDb(admin),
    files: createFiles(admin),
    guard: createBudgetGuard({ store, envDryRun: Deno.env.get("DRY_RUN") }),
    ai: { createMessage, createBatch, getBatch, batchResults },
    images: { generateImage },
    fly: { startRender },
    env: {
      anthropicKey: Deno.env.get("ANTHROPIC_API_KEY") ?? "",
      runwareKey: Deno.env.get("RUNWARE_API_KEY") ?? "",
      runwareBase: Deno.env.get("RUNWARE_BASE_URL") || undefined,   // undefined: the provider module's own default
      flyToken: Deno.env.get("FLY_API_TOKEN") ?? "",
      flyApp: FLY_APP,
      flyImage: Deno.env.get("CM_SLIDES_IMAGE") ?? `registry.fly.io/${FLY_APP}:cm-slides`,
      modelMain: Deno.env.get("CM_MODEL_MAIN") ?? "",
      modelFast: Deno.env.get("CM_MODEL_FAST") ?? "",
      // On a refusal: one retry on a model that costs no more than the main one (pipeline.js fallbackModel),
      // through the Budget Guard. CM_MODEL_FALLBACK picks it (default claude-sonnet-5); CM_FALLBACKS=off turns it off.
      fallbacks: (Deno.env.get("CM_FALLBACKS") ?? "on") !== "off",
      modelFallback: Deno.env.get("CM_MODEL_FALLBACK") ?? "",
      // The renderer accepts pictures only from these hosts: our own storage and the image provider's CDN.
      allowedImageHosts: [new URL(Deno.env.get("SUPABASE_URL")!).hostname, ".runware.ai"],
    },
    now: () => new Date(),
    log: (m: string) => console.log(m),
  },
}));
