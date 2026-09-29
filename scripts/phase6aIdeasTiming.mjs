// Phase 6a — time one real "Get ideas" batch (parallel shards) as the internal test user, with a steer.
import { createClient } from "@supabase/supabase-js";
const URL_ = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const admin = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const TEST_USER = "d66a0ea9-3574-4fad-94ed-c82aea15061f";
const { data: u } = await admin.auth.admin.getUserById(TEST_USER);
if (!u?.user?.email?.endsWith("@zyvo-internal.test")) throw new Error("not the internal test user");
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
const client = createClient(URL_, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
await client.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
const { data: s } = await client.functions.invoke("create-long-form-discovery-session", { body: {} });
const t0 = Date.now();
const { data, error } = await client.functions.invoke("generate-long-form-ideas", { body: { category: "all", direction: "high_curiosity", count: 10, existingIdeas: [], discoverySessionId: s.id, nicheHint: "History", styleId: "stickman", steer: "pirates, weapons, kid-friendly" } });
const ms = Date.now() - t0;
console.log(JSON.stringify({ ms, error: error?.message ?? null, ideas: (data?.ideas ?? []).length, charged: data?.charged ?? null, titles: (data?.ideas ?? []).map((i) => i.title) }, null, 1));
