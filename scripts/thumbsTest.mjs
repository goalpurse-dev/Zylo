// Thumbnail V2: list / start / regenerate the Myth vs Reality TEST project's
// thumbnails through the real long-form-thumbnails function, as the internal
// test account (a regenerate charges that account's credits).
//   node --env-file=.env.local scripts/thumbsTest.mjs <list|start|regenerate|publish>
import { createClient } from "@supabase/supabase-js";

const TEST_PROJECT = "f6ee3eb2-726b-4faa-9d25-1ed957eb46ae";
const [action = "list"] = process.argv.slice(2);
const URL_ = process.env.SUPABASE_URL;
const admin = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const TEST_USER = "d66a0ea9-3574-4fad-94ed-c82aea15061f";
const { data: u } = await admin.auth.admin.getUserById(TEST_USER);
if (!u?.user?.email?.endsWith("@zyvo-internal.test")) throw new Error("not the internal test user");
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
const client = createClient(URL_, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: sess } = await client.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
const user = createClient(URL_, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${sess.session.access_token}` } } });
const call = async (fn, body) => { const { data, error } = await user.functions.invoke(fn, { body: { projectId: TEST_PROJECT, ...body } }); if (error) { const t = await error.context?.text?.(); throw new Error(`${error.message}: ${t}`); } return data; };
const r = action === "publish" ? await call("long-form-publish-start", {})
  : await call("long-form-thumbnails", action === "list" ? { action: "list" } : { action: "start", regenerate: action === "regenerate" });
console.log(JSON.stringify(r, null, 1));
