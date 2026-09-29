// Phase 6f ($0): queue / inspect a render of the Myth vs Reality TEST project
// through the real long-form-render function, as the internal test account.
//   node --env-file=.env.local scripts/renderQueueTest.mjs <start|status|dry|download> [1080p|1440p]
import { createClient } from "@supabase/supabase-js";

const TEST_PROJECT = "f6ee3eb2-726b-4faa-9d25-1ed957eb46ae";
const [action = "status", resolution = "1080p"] = process.argv.slice(2);
const URL_ = process.env.SUPABASE_URL;
const admin = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const TEST_USER = "d66a0ea9-3574-4fad-94ed-c82aea15061f";
const { data: u } = await admin.auth.admin.getUserById(TEST_USER);
if (!u?.user?.email?.endsWith("@zyvo-internal.test")) throw new Error("not the internal test user");
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
const client = createClient(URL_, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: sess } = await client.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
const user = createClient(URL_, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${sess.session.access_token}` } } });
const call = async (body) => { const { data, error } = await user.functions.invoke("long-form-render", { body: { projectId: TEST_PROJECT, ...body } }); if (error) { const t = await error.context?.text?.(); throw new Error(`${error.message}: ${t}`); } return data; };
const r = action === "dry" ? await call({ action: "start", resolution, dryRun: true }) : action === "start" ? await call({ action: "start", resolution }) : action === "download" ? await call({ action: "download" }) : await call({ action: "status" });
console.log(JSON.stringify(r, null, 1));
