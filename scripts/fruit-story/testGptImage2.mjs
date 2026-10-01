// Isolated image tests through a given runware-image function slug, the way
// job-worker hands a job off: insert a job for the owner account, claim it as
// a test worker, POST the handoff, wait for the result. No credits are charged
// (job-worker's charge step is skipped). Cases clone a real recent job's
// request (prompt, size, negative) or use the tool's real prompt template.
//   node scripts/fruit-story/testGptImage2.mjs <function-slug> <case,case,...>
// cases: mug, kitswap, clay, face, micro, cooking, flux, nano
import { randomUUID } from "crypto";
import { admin, SUPABASE_URL } from "./lib.mjs";

const [slug = "runware-image-test", list = "mug"] = process.argv.slice(2);
const OWNER = "a8ad2f35-6ad4-4071-bdae-4555afd13f51";
const a = admin();
const NEG = "text, letters, watermark, logo, caption, blurry, low-res, oversharpen, artifact";
const PUB = `${SUPABASE_URL}/storage/v1/object/public/`;
const CLAY_BASE = "miniature claymation diorama, handmade polymer clay characters, visible soft clay texture, tiny handcrafted props, macro photography look, realistic shallow depth of field, cinematic lighting";

async function cloneJob(id) {
  const { data } = await a.from("jobs").select("prompt,input,settings").eq("id", id).single();
  return { prompt: data.prompt, negative: data.input?.negative ?? NEG, w: data.input?.width ?? 768, h: data.input?.height ?? 1376 };
}
const CASES = {
  mug: async () => ({ tool: "image:fruit-v2", air: "openai:gpt-image@2", prompt: "A white ceramic coffee mug on a wooden kitchen table, soft morning window light, photorealistic product photo.", negative: NEG, w: 768, h: 1376 }),
  kitswap: async () => ({ tool: "image:fruit-v2", air: "openai:gpt-image@2", ...(await cloneJob("1d7f401c-24a4-4031-b636-1f18493cb2cf")) }),
  micro: async () => ({ tool: "image:fruit-v2", air: "openai:gpt-image@2", ...(await cloneJob("f44639cf-e533-4b7a-8980-2da31a946d2e")) }),
  cooking: async () => ({ tool: "image:fruit-v2", air: "openai:gpt-image@2", ...(await cloneJob("28d2c1b8-1868-4ef8-90a8-2fa1c7683483")) }),
  clay: async () => ({
    tool: "image:fruit-v2", air: "openai:gpt-image@2", negative: NEG, w: 768, h: 1376,
    prompt: `${CLAY_BASE}. A tiny clay kitchen on a countertop. Crisis: the sink overflows and floods the floor. Water spreads across the tiles and soaks the rug. Tiny clay people are scared, pointing, freezing, running, or clinging to each other. Make the problem large, obvious, and still unsolved. No one is happy yet. Macro claymation drama, expressive faces.`,
  }),
  face: async () => ({
    tool: "image:fruit-v2", air: "openai:gpt-image@2", negative: NEG, w: 768, h: 1376,
    prompt: "the person in the reference photo as a surreal slime face, head made of glossy semi-transparent jelly-like slime, preserving realistic skin tone, eye color, and lip color, soft gooey texture, wet shine, smooth melted contours, only the head visible, clean outline, no surrounding slime puddle, no spilled slime, clean white marble background, top-down composition, soft studio lighting, ultra detailed, 8k",
    refs: [`${PUB}public-assets/fruit-characters/core/kai-a3.jpg`],
  }),
  flux: async () => ({ tool: "image:flux.base", air: "runware:400@4", prompt: "A red bicycle leaning against a brick wall, golden hour, photorealistic.", negative: NEG, w: 1024, h: 1024 }),
  nano: async () => ({ tool: "image:nano.2", air: null, prompt: "A red bicycle leaning against a brick wall, golden hour, photorealistic.", negative: NEG, w: 1024, h: 1024 }),
};

async function airTagFor(toolKey) {
  // The model id job-worker would send, from a recent job of that tool (provider_hint.airTag).
  const { data } = await a.from("jobs").select("settings").eq("tool_key", toolKey).not("settings->provider_hint->>airTag", "is", null).order("created_at", { ascending: false }).limit(1);
  return data?.[0]?.settings?.provider_hint?.airTag ?? null;
}

async function run(name) {
  const c = await CASES[name]();
  const air = c.air ?? (await airTagFor(c.tool));
  const { data: tmpl } = await a.from("jobs").select("settings").eq("tool_key", c.tool).order("created_at", { ascending: false }).limit(1).single();
  const id = randomUUID();
  const settings = { ...tmpl.settings, provider_job_id: randomUUID(), test: `runware-image fix check: ${name}` };
  const input = { tool: "image", width: c.w, height: c.h, subject: c.prompt, negative: c.negative, creation_type: "photo" };
  const ins = await a.from("jobs").insert({ id, user_id: OWNER, type: "image", tool_key: c.tool, status: "queued", prompt: c.prompt, settings, input, plan_code: "pro", provider: "runware", charged: false });
  if (ins.error) return { name, ok: false, why: `insert: ${ins.error.message}` };
  const worker = `img-test-${name}-${Date.now()}`;
  const claim = await a.rpc("claim_generation_job", { p_worker_id: worker, p_job_id: id, p_lease_seconds: 300 });
  if (claim.error) return { name, ok: false, why: `claim: ${claim.error.message}` };
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${slug}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-job-worker-key": process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
    body: JSON.stringify({ ...input, jobId: id, airTag: air, prompt: c.prompt, negative: c.negative, referenceImages: c.refs ?? [], settings: { ...settings, width: c.w, height: c.h }, recoverExistingProvider: false, workerId: worker }),
  });
  if (res.status >= 300) return { name, ok: false, why: `handoff ${res.status} ${(await res.text()).slice(0, 120)}` };
  for (let i = 0; i < 80; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const { data } = await a.from("jobs").select("status,error_code,error,result_url").eq("id", id).single();
    if (["succeeded", "failed"].includes(data.status)) return { name, air, promptLen: c.prompt.length, refs: (c.refs ?? []).length, job: id, ok: data.status === "succeeded", status: data.status, error_code: data.error_code, error: data.error, url: data.result_url };
  }
  return { name, ok: false, why: "timeout", job: id };
}

const results = [];
for (const name of list.split(",")) { const r = await run(name); results.push(r); console.log(JSON.stringify(r)); }
process.exit(results.every((r) => r.ok) ? 0 : 1);
