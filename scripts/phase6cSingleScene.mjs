// Phase 6c — ONE live scene render on the Myth vs Reality test project
// (~$0.003): the real "Regenerate" action as the test user -> the autopilot's
// scene loop -> render-long-form-scene (V2 render + code check + upscale +
// text layer) -> stored. Reports the row, the cost and the timing.
//   node --env-file=.env.local scripts/phase6cSingleScene.mjs [sceneNumber]
import { createClient } from "@supabase/supabase-js";

const PROJECT = "f6ee3eb2-726b-4faa-9d25-1ed957eb46ae";
const N = Number(process.argv[2] ?? 26);
const URL_ = process.env.SUPABASE_URL;
const admin = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const TEST_USER = "d66a0ea9-3574-4fad-94ed-c82aea15061f";
const { data: u } = await admin.auth.admin.getUserById(TEST_USER);
if (!u?.user?.email?.endsWith("@zyvo-internal.test")) throw new Error("not the internal test user");
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
const client = createClient(URL_, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: sess } = await client.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
const user = createClient(URL_, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${sess.session.access_token}` } } });

const t0 = Date.now();
const { data: res, error } = await user.functions.invoke("update-long-form-scene", { body: { projectId: PROJECT, action: "regenerate", sceneNumber: N } });
console.log("regenerate:", error ? `ERROR ${error.message}` : JSON.stringify(res));
if (error) process.exit(1);
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 3000));
  const { data: row } = await admin.from("long_form_scene_images").select("id, version, status, image_url, master_url, overlay_text, overlay, cost_usd, credits_charged, qa, error, attempts").eq("project_id", PROJECT).eq("beat_sequence", N).eq("is_current", true).single();
  if (row.status === "ready" || row.status === "failed") {
    const { data: p } = await admin.from("long_form_projects").select("autopilot").eq("id", PROJECT).single();
    console.log(JSON.stringify({ wallS: Math.round((Date.now() - t0) / 1000), ...row, overlay: row.overlay ? { text: row.overlay.text, box: row.overlay.box } : null, autopilot: { status: p.autopilot.status, phase: p.autopilot.phase, scenes: p.autopilot.scenes } }, null, 1));
    process.exit(0);
  }
  if (i % 5 === 0) console.log("…", Math.round((Date.now() - t0) / 1000), "s", row.status);
}
console.log("TIMEOUT after 180 s");
