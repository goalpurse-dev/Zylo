// Runs the test suite with the Claude backup forced on (owner, 2026-11-05: "test each feature with the
// backup forced on"):  node --import ./tests/setup.mjs --import ./tests/backupForced.preload.mjs --test tests/*.test.mjs
// Every OpenAI chat/responses call the features make goes through openaiBackup.js as if OpenAI were down:
// the real request is translated for Claude, and "Claude" answers with what the test's own OpenAI stand-in
// would have answered. That answer then has to pass the schema check and come back in OpenAI's shape
// through each feature's own parsing. Nothing leaves the machine.
// Both copies are switched: the shared one, and Blocky's own (its engine imports only from its folder).
// BACKUP_STATS_FILE: each test process appends what happened (used / failed / unavailable) as one JSON line.
import fs from "node:fs";
import * as shared from "../supabase/functions/_shared/openaiBackup.js";
import * as blocky from "../supabase/functions/_shared/blocky/openaiBackup.js";

process.env.ANTHROPIC_API_KEY ||= "test-key";
const standIn = async (plan, url, init) => {
  const r = await fetch(url, init);   // the test's OpenAI stand-in
  if (!r.ok) return { status: r.status, json: null, error: `stand-in answered ${r.status}`, ms: 0 };
  const j = await r.json();
  const text = plan.kind === "chat" ? j?.choices?.[0]?.message?.content
    : j?.output_text ?? (j?.output ?? []).flatMap((o) => o?.content ?? []).find((c) => c?.type === "output_text")?.text;
  const usage = { input_tokens: j?.usage?.prompt_tokens ?? j?.usage?.input_tokens ?? 0, output_tokens: j?.usage?.completion_tokens ?? j?.usage?.output_tokens ?? 0 };
  return { status: 200, json: { id: "msg_test", type: "message", role: "assistant", content: [{ type: "text", text: text ?? "" }], stop_reason: "end_turn", usage }, error: null, ms: 0 };
};
for (const m of [shared, blocky]) { m.setBackupModeForTests("force"); m.setClaudeTransportForTests(standIn); }

const statsFile = process.env.BACKUP_STATS_FILE;
let written = false;
const writeStats = () => {
  if (!statsFile || written) return;
  written = true;
  const sum = (k) => shared.backupStats[k] + blocky.backupStats[k];
  const used = sum("backup_used_forced"), failed = sum("backup_failed_forced"), unavailable = sum("backup_unavailable");
  const notes = [...shared.backupStats.notes, ...blocky.backupStats.notes].filter((n) => !n.startsWith("backup_used"));
  const file = process.argv.find((a) => /\.test\.(mjs|ts)$/.test(a)) ?? process.argv.at(-1);
  fs.appendFileSync(statsFile, JSON.stringify({ file, used, failed, unavailable, notes }) + "\n");
};
process.on("exit", writeStats);
globalThis.addEventListener?.("unload", writeStats);   // Deno's test runner (--preload)
