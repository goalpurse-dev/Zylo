// Privacy check for Blocky Stories on the live project: a SECOND account tries to read, list and download
// the owner's stories, pictures, clips and videos. Free: it calls no provider and writes nothing but a
// throwaway account, which is deleted at the end (the same kind the smoke check makes).
//   node scripts/blocky/privacyCheck.mjs
import { SUPABASE_URL, TEST_EMAIL, admin, anonKey, api, userSession } from "./lib.mjs";

const db = admin();
const results = [];
const ok = (name, pass, detail = "") => { results.push(Boolean(pass)); console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); };

// What the owner has: a story with pictures, clips and a final video.
const { client: ownerClient } = await userSession(TEST_EMAIL);
const owner = (await ownerClient.auth.getUser()).data.user;
const { data: story } = await db.from("blocky_stories").select("id, final_url").eq("user_id", owner.id).not("final_url", "is", null).order("created_at", { ascending: false }).limit(1).single();
const { data: scenes } = await db.from("blocky_story_scenes").select("id, image_url, clip_url").eq("story_id", story.id).order("idx");
const files = [["a scene picture", scenes.find((s) => s.image_url)?.image_url], ["a clip", scenes.find((s) => s.clip_url)?.clip_url], ["the final video", story.final_url]].filter(([, url]) => url);
console.log(`The owner's story ${story.id}: ${scenes.length} scenes, ${files.length} kinds of file.\n`);

const email = "upwardlift6+blockyprivacytest@gmail.com";
const made = await db.auth.admin.createUser({ email, password: `${crypto.randomUUID()}Aa1!`, email_confirm: true });
if (made.error) { console.error(`Couldn't make the second account: ${made.error.message}`); process.exit(1); }
try {
  const other = await userSession(email);
  // 1. Through Blocky's own API.
  for (const [action, body] of [["getStory", { storyId: story.id }], ["listRecent", { type: "single" }], ["uploadPackage", { storyId: story.id }], ["generateScenePictures", { storyId: story.id }], ["buildFinal", { storyId: story.id }]]) {
    const r = await api(other.accessToken, action, body);
    const leaked = JSON.stringify(r.data ?? "").includes(story.id) || JSON.stringify(r.data ?? "").includes("/blocky/");
    ok(`the API: ${action} gives the second account nothing of the owner's`, !r.ok && !leaked, `${r.code}`);
  }
  // 2. Straight at the tables, with the second account's own sign-in (row-level security is the guard).
  for (const [table, column] of [["blocky_stories", "id"], ["blocky_story_scenes", "story_id"], ["blocky_jobs", "story_id"], ["blocky_charges", "story_id"], ["blocky_credit_ledger", "story_id"], ["blocky_ai_calls", "story_id"]]) {
    const r = await other.client.from(table).select("*").eq(column, story.id);
    ok(`the database: ${table} shows the second account no row of the owner's story`, Boolean(r.error) || (r.data ?? []).length === 0, r.error ? r.error.message : "0 rows");
    const any = await other.client.from(table).select("*").limit(5);
    ok(`the database: ${table} shows the second account no row at all`, Boolean(any.error) || (any.data ?? []).length === 0, any.error ? any.error.message : "0 rows");
  }
  for (const table of ["blocky_drafts", "blocky_plans", "blocky_settings", "blocky_provider_alerts"]) {
    const r = await other.client.from(table).select("*").limit(5);
    ok(`the database: ${table} is closed to the second account`, Boolean(r.error) || (r.data ?? []).length === 0, r.error ? r.error.message : "0 rows");
  }
  const write = await other.client.from("blocky_stories").update({ title: "taken over" }).eq("id", story.id).select("id");
  ok("the database: the second account can't change the owner's story", Boolean(write.error) || (write.data ?? []).length === 0, write.error ? write.error.message : "0 rows changed");
  // 3. The files. Listing: can the second account find out what the owner's files are called?
  for (const prefix of [`blocky/${owner.id}`, `blocky/${owner.id}/${story.id}`, "blocky"]) {
    const signedIn = await other.client.storage.from("generated").list(prefix, { limit: 20 });
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/generated`, { method: "POST", headers: { apikey: anonKey(), Authorization: `Bearer ${anonKey()}`, "Content-Type": "application/json" }, body: JSON.stringify({ prefix, limit: 20 }) });
    const anon = await res.json().catch(() => []);
    ok(`the files: "${prefix}/" can't be listed by the second account, or by a visitor who isn't signed in`, (Boolean(signedIn.error) || (signedIn.data ?? []).length === 0) && (!Array.isArray(anon) || anon.length === 0), `signed in: ${signedIn.error ? signedIn.error.message : `${signedIn.data.length} entries`}; not signed in: ${Array.isArray(anon) ? `${anon.length} entries` : anon.message ?? res.status}`);
  }
  // Downloading: the files sit in a public folder, so the question is whether a file's address can be had.
  for (const [what, url] of files) {
    const head = await fetch(url, { method: "HEAD" });
    const name = url.split("/").pop();
    console.log(`NOTE  ${what} opens for anyone who has its exact address (HTTP ${head.status}); the address ends in ${name.length > 20 ? `a random name ${name.length} characters long` : name}`);
  }
} finally {
  await db.auth.admin.deleteUser(made.data.user.id);
  const gone = (await db.from("profiles").select("id").eq("id", made.data.user.id)).data?.length === 0;
  ok("the throwaway account is deleted", gone);
}
console.log(`\n${results.filter(Boolean).length} of ${results.length} checks passed`);
process.exitCode = results.every(Boolean) ? 0 : 1;
