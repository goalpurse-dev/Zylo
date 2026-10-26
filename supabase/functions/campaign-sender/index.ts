// deno-lint-ignore-file no-explicit-any
// campaign-sender/index.ts — sends the scheduled campaigns, one email per 8 seconds at most.
//
// Called every 10 seconds by the cron job email-campaign-sender (x-campaign-secret;
// verify_jwt = false). Each call, for every campaign that is allowed to send
// (status approved or sending, inside its window):
//   0. depends_on: the campaign before it must have finished with 0 spam
//      complaints and bounces under 2%, or this one does not start; and a day
//      does not start while Runware or the voice provider failed in the last 3 hours
//   1. the stop rules (_shared/campaigns.js): any spam complaint, or bounces
//      over 2% of what was sent → the campaign is stopped and the owner is told
//   2. ONE email that is due: the profile must still be ON with the same
//      address, then the email gate (claim_email_send, as marketing), then the
//      send through _shared/userEmail.ts
//   3. nothing left → done, and the owner gets the numbers by email
// A campaign in status "waiting" is never touched: the owner has not said go.
//   POST { action: "tick" }                         the cron call
//   POST { action: "test", campaign, to }           ONE proof copy to one address (subject "[TEST] …")
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { alertAdmin } from "../_shared/adminAlert.ts";
import { CAMPAIGNS, CUTAWAY_URL, campaignNumbers, campaignReportText, campaignStopReason, previousCampaignProblem, providerProblem } from "../_shared/campaigns.js";
import { APP_URL } from "../_shared/emailRules.js";
import { claimEmail, sendClaimedEmailWithId } from "../_shared/userEmail.ts";

const SECRET = Deno.env.get("CAMPAIGN_SENDER_SECRET") ?? "";
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

async function finish(c: any, status: "done" | "stopped", reason: string | null) {
  const { data: changed } = await sb.from("email_campaigns").update({ status, stop_reason: reason, finished_at: new Date().toISOString() })
    .eq("id", c.id).in("status", ["approved", "sending"]).select("id");
  if (!changed?.length) return; // another call got there first: one email to the owner, not two
  const n = await campaignNumbers(sb, c.id, c.starts_at, { withPurchases: true });
  const head = status === "stopped" ? `Zyvo campaign ${c.id} STOPPED: ${reason}` : `Zyvo campaign ${c.id} finished: ${n.sent} sent, ${n.opened} opened, ${n.bounced} bounced, ${n.complained} complaints`;
  await alertAdmin(head, `${campaignReportText(c.id, { ...c, status, stop_reason: reason }, n)}\n\n${status === "stopped" ? "Nothing more will be sent for this campaign." : "Opens, purchases, late bounces and unsubscribes still come in: you get these numbers again 48 hours after the last email."}`, "campaign");
}

// The one link of a campaign that sends people to the Cutaway Explainer (linkTo "cutaway"): that page
// while the template is switched on for users (the CUTAWAY_ENABLED secret, the server's twin of the
// page's switch), otherwise tryzyvo.com. Decided for every email at the moment it is sent.
function linkFor(def: any): string {
  return def.linkTo === "cutaway" && (Deno.env.get("CUTAWAY_ENABLED") ?? "").trim().toLowerCase() === "true" ? CUTAWAY_URL : APP_URL;
}

// The owner's rule of 2026-10-26: no day STARTS while the owner alerts show Runware or the voice
// provider failing in the last 3 hours (_shared/campaigns.js: providerProblem).
async function providersFailing(): Promise<string | null> {
  const since = new Date(Date.now() - 3 * 3600_000).toISOString();
  const [{ data: runware }, { data: voiceLogs }] = await Promise.all([
    sb.from("provider_balance_guard").select("paused, alerted_at, last_error").eq("provider", "runware").maybeSingle(),
    sb.from("system_logs").select("event, details").eq("source", "generate-long-form-narration-audio").in("event", ["narration_failed", "narration_paused"]).gte("created_at", since).limit(1000),
  ]);
  return providerProblem({ runware, voiceLogs: voiceLogs ?? [], sinceIso: since });
}

async function sendOne(c: any, def: any): Promise<string> {
  const { data: rows, error } = await sb.rpc("claim_campaign_email", { p_campaign: c.id });
  if (error) { console.error("[campaign-sender] claim failed:", error.message); return "claim_failed"; }
  const row = rows?.[0];
  if (!row) return "nothing_due";
  if (c.status === "approved") await sb.from("email_campaigns").update({ status: "sending" }).eq("id", c.id).eq("status", "approved");
  const settle = (status: string, extra: Record<string, unknown> = {}) => sb.from("email_campaign_queue").update({ status, ...extra }).eq("id", row.id);

  // Still ON, still the same address? (The gate checks consent again; this also catches a changed address.)
  const { data: p } = await sb.from("profiles").select("id, email, email_updates").eq("id", row.profile_id).maybeSingle();
  if (!p || p.email_updates !== true) { await settle("skipped", { reason: "no_consent" }); return "skipped"; }
  if (String(p.email ?? "").trim().toLowerCase() !== row.email) { await settle("skipped", { reason: "address_changed" }); return "skipped"; }

  const claim = await claimEmail(sb, row.email, `campaign:${c.id}`, "marketing");
  if (!claim.ok) {
    // The gate is down: put it back, a later minute tries again. Any rule of the gate: skipped for good.
    if (claim.reason === "gate_unavailable") { await settle("queued", { claimed_at: null }); return "gate_unavailable"; }
    await settle("skipped", { reason: claim.reason });
    return "skipped";
  }
  const resendId = await sendClaimedEmailWithId(sb, {
    claimId: claim.id, to: row.email, userId: p.id,
    from: def.from, replyTo: def.replyTo, subject: def.subject, why: def.why, plain: def.plain === true, render: (footer: any) => def.render(footer, { link: linkFor(def) }),
    tags: [{ name: "campaign", value: c.id }],
  });
  if (resendId === null) { await settle("failed", { reason: "send_failed" }); return "failed"; } // the claim was released by the sender
  await settle("sent", { resend_id: resendId, sent_at: new Date().toISOString() });
  return "sent";
}

async function tick() {
  const now = new Date().toISOString();
  const { data: campaigns } = await sb.from("email_campaigns").select("*").in("status", ["approved", "sending"]).lte("starts_at", now);
  const out: Record<string, string> = {};
  for (const c of campaigns ?? []) {
    const def = (CAMPAIGNS as any)[c.id];
    if (!def) { await finish(c, "stopped", "no template for this campaign in _shared/campaigns.js"); out[c.id] = "stopped"; continue; }
    // A campaign that depends on the one before it: 0 spam complaints and bounces under 2% there,
    // or this one does not start (and stops, if a complaint about the earlier one arrives later).
    if (c.depends_on) {
      const { data: prev } = await sb.from("email_campaigns").select("*").eq("id", c.depends_on).maybeSingle();
      const problem = previousCampaignProblem(prev, prev ? await campaignNumbers(sb, prev.id, prev.starts_at) : null);
      if (problem) {
        const why = `${c.status === "approved" ? "not started" : "stopped part-way"}: ${problem}`;
        await finish(c, "stopped", why); out[c.id] = `stopped: ${why}`; continue;
      }
    }
    // Not started yet: Runware or the voice provider failing in the last 3 hours → this day does not start, and the owner is told.
    if (c.status === "approved") {
      const down = await providersFailing();
      if (down) { const why = `not started: ${down} in the last 3 hours`; await finish(c, "stopped", why); out[c.id] = `stopped: ${why}`; continue; }
    }
    const n = await campaignNumbers(sb, c.id, c.starts_at);
    const stop = campaignStopReason(n);
    if (stop) { await finish(c, "stopped", stop); out[c.id] = `stopped: ${stop}`; continue; }
    // Past the window: what is still waiting is dropped, never sent late.
    if (now >= c.ends_at) {
      await sb.from("email_campaign_queue").update({ status: "skipped", reason: "window_closed" }).eq("campaign", c.id).eq("status", "queued");
      await sb.from("email_campaign_queue").update({ status: "failed", reason: "interrupted" }).eq("campaign", c.id).eq("status", "sending");
      await finish(c, "done", null); out[c.id] = "done (window closed)"; continue;
    }
    out[c.id] = await sendOne(c, def);
    if (out[c.id] === "nothing_due" && n.queued === 0) { await finish(c, "done", null); out[c.id] = "done"; }
  }
  await followUpReports(out);
  return out;
}

// 48 hours after a campaign ended the owner gets its numbers again: by then the opens, the
// purchases within 48 hours of each email, the late bounces and the unsubscribes are in.
// Once per campaign; none if it sent nothing.
async function followUpReports(out: Record<string, string>) {
  const cutoff = new Date(Date.now() - 48 * 3600_000).toISOString();
  const { data: ended } = await sb.from("email_campaigns").select("*").in("status", ["done", "stopped"]).is("followup_report_at", null).lt("finished_at", cutoff);
  for (const c of ended ?? []) {
    const { data: mine } = await sb.from("email_campaigns").update({ followup_report_at: new Date().toISOString() }).eq("id", c.id).is("followup_report_at", null).select("id");
    if (!mine?.length) continue; // another call sent it
    const n = await campaignNumbers(sb, c.id, c.starts_at, { withPurchases: true });
    if (n.sent === 0) { out[c.id] = "no follow-up (nothing was sent)"; continue; }
    await alertAdmin(`Zyvo campaign ${c.id}, 48 hours later: ${n.sent} sent, ${n.opened} opened, ${n.purchases?.people ?? 0} bought, ${n.bounced} bounced, ${n.complained} complaints, ${n.unsubscribed} unsubscribed`,
      `${campaignReportText(c.id, c, n)}\n\nThese are the numbers 48 hours after the last email.`, "campaign");
    out[c.id] = "follow-up report sent";
  }
}

// One proof copy for the owner, through the same template, sender and gate (category "test": 20 a day, no consent needed).
async function test(campaign: string, to: string) {
  const def = (CAMPAIGNS as any)[campaign];
  const address = String(to ?? "").trim().toLowerCase();
  if (!def || !address) return { sent: false, reason: "unknown campaign or no address" };
  const { data: p } = await sb.from("profiles").select("id").ilike("email", address.replace(/[%_\\]/g, (ch) => `\\${ch}`)).limit(1).maybeSingle();
  const claim = await claimEmail(sb, address, `test:${campaign}:${Date.now()}`, "test");
  if (!claim.ok) return { sent: false, reason: claim.reason };
  const resendId = await sendClaimedEmailWithId(sb, {
    claimId: claim.id, to: address, userId: p?.id ?? crypto.randomUUID(), // no profile: the unsubscribe page will say the link isn't valid
    from: def.from, replyTo: def.replyTo, subject: `[TEST] ${def.subject}`, why: def.why, plain: def.plain === true, render: (footer: any) => def.render(footer, { link: linkFor(def) }),
    tags: [{ name: "campaign_test", value: campaign }],
  });
  return resendId === null ? { sent: false, reason: "send_failed" } : { sent: true, resendId };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!SECRET || req.headers.get("x-campaign-secret") !== SECRET) return json({ error: "Unauthorized" }, 401);
  const body = await req.json().catch(() => ({}));
  try {
    if (body?.action === "test") return json(await test(String(body.campaign ?? ""), String(body.to ?? "")));
    return json({ ok: true, campaigns: await tick() });
  } catch (e) {
    console.error("[campaign-sender] failed:", String((e as any)?.message ?? e));
    return json({ error: "failed" }, 500);
  }
});
