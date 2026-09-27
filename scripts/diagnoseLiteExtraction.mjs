// One-off diagnostic run: research-lite is producing ZERO facts across all 4
// successful Phase 1b samples despite real search spend. This creates ONE
// fresh topic, runs Story Plan + Research-Lite + Script, and INSPECTS the
// raw intermediate state (claim-plan questions, search findings/citations,
// extraction batches) before any cleanup, to root-cause where facts are
// being lost.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function callFn(name, accessToken, body) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}`, apikey: ANON_KEY },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${name} failed (${res.status}): ${JSON.stringify(json)}`);
  return json;
}

async function pollUntilTerminal(table, id, terminalStatuses, { timeoutMs, intervalMs, label }) {
  const start = Date.now();
  console.log(`  [pollUntilTerminal] starting poll for ${label}, id=${id}, timeoutMs=${timeoutMs}`);
  while (Date.now() - start < timeoutMs) {
    const { data } = await admin.from(table).select("*").eq("id", id).maybeSingle();
    if (data && terminalStatuses.includes(data.status)) return data;
    console.log(`  ...${label}: status=${data?.status} stage=${data?.stage} (${Math.round((Date.now() - start) / 1000)}s)`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`${label} timed out`);
}

async function main() {
  const email = `phase1b-diagnose-${Date.now()}@zyvo-internal.test`;
  const password = randomUUID();
  const { data: created } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  const userId = created.user.id;
  await admin.from("profiles").upsert({ id: userId, email, credit_balance: 5000, plan_code: "free" });
  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data: signIn } = await anon.auth.signInWithPassword({ email, password });
  const accessToken = signIn.session.access_token;
  console.log(`Signed in as ${userId}.`);

  const { data: session } = await admin.from("long_form_discovery_sessions").insert({ user_id: userId }).select("id").single();
  const project = await callFn("create-long-form-project", accessToken, {
    discoverySessionId: session.id, topic: "What Did Ancient Humans Do After Dark?", source: "custom", selectedIdea: null,
    lengthMode: "custom", customLengthMinutes: 10, depthMode: "custom", customExplanationDepth: "balanced",
    onScreenTextDensity: "balanced", initialStatus: "draft",
  });
  const projectId = project.id;
  console.log(`Project: ${projectId}`);

  await callFn("create-long-form-production-setup", accessToken, {
    projectId, visualRecipe: "stickman_doodle_explainer", recipeVersion: "STICKMAN_DOODLE_EXPLAINER_V1",
    renderTier: "v2", targetDurationMinutes: 10, explanationDepth: "balanced",
    voiceProvider: "elevenlabs", voiceId: "TxGEqnHWrfWFTfGW9XjX", voiceModel: "eleven_flash_v2_5",
    niche: "ancient_humans_prehistory",
  });

  const storyPlanResult = await callFn("generate-long-form-story-plan", accessToken, { projectId });
  console.log(`Story plan ready: "${storyPlanResult.storyPlan.recommendedTitle}"`);

  const researchStart = await callFn("start-long-form-research", accessToken, { projectId });
  const researchRow = await pollUntilTerminal("long_form_research_versions", researchStart.research.id, ["ready", "needs_attention", "failed"], { timeoutMs: 12 * 60 * 1000, intervalMs: 5000, label: "research" });

  console.log("\n=== RESEARCH DIAGNOSTIC ===");
  console.log("status:", researchRow.status);
  console.log("research_plan.researchQuestions count:", researchRow.research_plan?.researchQuestions?.length);
  console.log("First 3 questions:", JSON.stringify(researchRow.research_plan?.researchQuestions?.slice(0, 3), null, 2));
  console.log("\nintermediate.liteFindings count:", researchRow.intermediate?.liteFindings?.length);
  const findings = researchRow.intermediate?.liteFindings ?? [];
  for (const f of findings.slice(0, 3)) {
    console.log(`\n--- finding: ${f.focus} ---`);
    console.log("text length:", f.text?.length);
    console.log("text:", f.text?.slice(0, 500));
    console.log("citations count:", f.citations?.length, JSON.stringify(f.citations));
  }
  console.log("\nfact_graph.facts count:", researchRow.fact_graph?.facts?.length);
  console.log("meta.callLedger (search entries):", JSON.stringify((researchRow.meta?.callLedger ?? []).filter((c) => c.stage?.includes("search")).slice(0, 3), null, 2));

  // Cleanup
  await callFn("delete-long-form-project", accessToken, { projectId });
  await admin.auth.admin.deleteUser(userId);
  console.log("\nCleaned up.");
}

main().then(() => process.exit(0)).catch((e) => { console.error("FATAL:", e); process.exit(1); });
