import dotenv from "dotenv";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/* ================= CONFIG ================= */

const DELAY_MS        = 400;
const RETRY_DELAY_MS  = 2000;
const BATCH_SIZE      = 1000;
const MAX_SEND        = 50000;          // effectively "everyone"
const MIN_HOURS_SINCE_LAST_EMAIL = 24;  // don't double-blast within a day
const DRY_RUN         = false;

/* ================= HELPERS ================= */

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function sentTooRecently(lastSentAt) {
  if (!lastSentAt) return false;
  const hoursSince = (Date.now() - new Date(lastSentAt).getTime()) / 36e5;
  return hoursSince < MIN_HOURS_SINCE_LAST_EMAIL;
}

/* ================= EMAIL TEMPLATE ================= */

function buildEmail(user) {
  const name = (user.email?.split("@")[0] || "creator")
    .replace(/[._\-+]/g, " ")
    .split(" ")[0];

  const displayName = name.charAt(0).toUpperCase() + name.slice(1);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Pick your creator style</title>
</head>
<body style="margin:0;padding:0;background:#0d0d0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

  <!-- preview text -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#0d0d0f;">
    8 AI script engines. one for every creator style. which one are you? 👀&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0f;">
    <tr>
      <td align="center" style="padding:40px 16px 60px;">

        <!-- CARD -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;background:#16181f;border-radius:24px;border:1px solid rgba(255,255,255,0.07);overflow:hidden;">

          <!-- TOP ACCENT BAR -->
          <tr>
            <td style="height:3px;background:linear-gradient(90deg,#f59e0b,#ec4899,#7A3BFF,#3b82f6,#10b981);"></td>
          </tr>

          <!-- LOGO ROW -->
          <tr>
            <td style="padding:28px 32px 0;">
              <span style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Z<span style="color:#7A3BFF;">yvo</span></span>
            </td>
          </tr>

          <!-- HERO -->
          <tr>
            <td style="padding:28px 32px 0;">

              <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.12em;color:#a07bff;text-transform:uppercase;">
                viral script builder · 8 styles
              </p>

              <h1 style="margin:0 0 20px;font-size:28px;font-weight:800;color:#ffffff;line-height:1.25;letter-spacing:-0.5px;">
                Stop starting from scratch.<br/>
                <span style="background:linear-gradient(90deg,#f59e0b,#ec4899,#7A3BFF);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">
                  Pick your style. Get your script.
                </span>
              </h1>

              <p style="margin:0 0 20px;font-size:15px;line-height:1.8;color:rgba(255,255,255,0.65);">
                Hey ${displayName} — we rebuilt the Viral Script Builder from the ground up.<br/>
                Instead of a blank box, you now pick from <strong style="color:#fff;">8 tuned AI engines</strong>, each built around a specific creator style. Tell it your idea. Get a full structured script in seconds.
              </p>

              <!-- STYLE GRID -->
              <p style="margin:0 0 14px;font-size:11px;font-weight:700;letter-spacing:0.1em;color:rgba(255,255,255,0.3);text-transform:uppercase;">choose your style</p>

              <!-- row 1 -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
                <tr>
                  <td width="49%" style="padding-right:4px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0f14;border:1px solid rgba(148,163,184,0.2);border-radius:14px;overflow:hidden;">
                      <tr><td style="height:2px;background:rgba(148,163,184,0.6);"></td></tr>
                      <tr>
                        <td style="padding:14px 16px;">
                          <p style="margin:0 0 4px;font-size:18px;">💀</p>
                          <p style="margin:0 0 3px;font-size:13px;font-weight:700;color:#fff;">Viral Skeleton</p>
                          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.35);line-height:1.5;">Cinematic 3D prompts · 1 scene + 5 b-rolls</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td width="49%" style="padding-left:4px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0f14;border:1px solid rgba(245,158,11,0.2);border-radius:14px;overflow:hidden;">
                      <tr><td style="height:2px;background:rgba(245,158,11,0.7);"></td></tr>
                      <tr>
                        <td style="padding:14px 16px;">
                          <p style="margin:0 0 4px;font-size:18px;">💥</p>
                          <p style="margin:0 0 3px;font-size:13px;font-weight:700;color:#fff;">MrBeast Mode</p>
                          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.35);line-height:1.5;">Insane stakes · retention hooks · epic energy</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- row 2 -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
                <tr>
                  <td width="49%" style="padding-right:4px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0f14;border:1px solid rgba(236,72,153,0.2);border-radius:14px;overflow:hidden;">
                      <tr><td style="height:2px;background:rgba(236,72,153,0.7);"></td></tr>
                      <tr>
                        <td style="padding:14px 16px;">
                          <p style="margin:0 0 4px;font-size:18px;">📱</p>
                          <p style="margin:0 0 3px;font-size:13px;font-weight:700;color:#fff;">TikTok Viral</p>
                          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.35);line-height:1.5;">Fast hooks · trend-aware · curiosity-driven</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td width="49%" style="padding-left:4px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0f14;border:1px solid rgba(59,130,246,0.2);border-radius:14px;overflow:hidden;">
                      <tr><td style="height:2px;background:rgba(59,130,246,0.7);"></td></tr>
                      <tr>
                        <td style="padding:14px 16px;">
                          <p style="margin:0 0 4px;font-size:18px;">🎭</p>
                          <p style="margin:0 0 3px;font-size:13px;font-weight:700;color:#fff;">Story Arc</p>
                          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.35);line-height:1.5;">3-act structure · emotional · character-driven</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- row 3 -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                <tr>
                  <td width="49%" style="padding-right:4px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0f14;border:1px solid rgba(249,115,22,0.2);border-radius:14px;overflow:hidden;">
                      <tr><td style="height:2px;background:rgba(249,115,22,0.7);"></td></tr>
                      <tr>
                        <td style="padding:14px 16px;">
                          <p style="margin:0 0 4px;font-size:18px;">😂</p>
                          <p style="margin:0 0 3px;font-size:13px;font-weight:700;color:#fff;">Comedy Skit</p>
                          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.35);line-height:1.5;">Setup · punchline · relatable chaos</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td width="49%" style="padding-left:4px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0f14;border:1px solid rgba(16,185,129,0.2);border-radius:14px;overflow:hidden;">
                      <tr><td style="height:2px;background:rgba(16,185,129,0.7);"></td></tr>
                      <tr>
                        <td style="padding:14px 16px;">
                          <p style="margin:0 0 4px;font-size:18px;">💰</p>
                          <p style="margin:0 0 3px;font-size:13px;font-weight:700;color:#fff;">Finance Edu</p>
                          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.35);line-height:1.5;">Authority · data · simple breakdowns</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- DIVIDER -->
              <hr style="border:none;border-top:1px solid rgba(255,255,255,0.07);margin:0 0 24px;" />

              <!-- WHAT EACH SCRIPT INCLUDES -->
              <p style="margin:0 0 16px;font-size:14px;line-height:1.8;color:rgba(255,255,255,0.65);">
                Every single style spits out the same thing:
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(122,59,255,0.06);border:1px solid rgba(122,59,255,0.15);border-radius:14px;margin-bottom:24px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding:5px 0;">
                          <span style="font-size:13px;color:rgba(255,255,255,0.8);">🪝&nbsp;&nbsp;<strong style="color:#fff;">Viral hook</strong> — written for your platform</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;">
                          <span style="font-size:13px;color:rgba(255,255,255,0.8);">🎬&nbsp;&nbsp;<strong style="color:#fff;">Scene-by-scene breakdown</strong> — ready to film</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;">
                          <span style="font-size:13px;color:rgba(255,255,255,0.8);">📸&nbsp;&nbsp;<strong style="color:#fff;">Image & video prompts</strong> — one per scene</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;">
                          <span style="font-size:13px;color:rgba(255,255,255,0.8);">📣&nbsp;&nbsp;<strong style="color:#fff;">CTA that converts</strong> — not a throwaway line</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;">
                          <span style="font-size:13px;color:rgba(255,255,255,0.8);">🔀&nbsp;&nbsp;<strong style="color:#fff;">3 alternate hooks</strong> — A/B test before you post</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 28px;font-size:15px;line-height:1.8;color:rgba(255,255,255,0.65);">
                The AI doesn't just write words — it understands the <em>format</em> of what makes each style work. MrBeast Mode knows escalation. Story Arc knows the emotional beat. Comedy Skit knows the punchline timing.<br/><br/>
                Pick your style. Type your idea. Get a script.
              </p>

              <!-- CTA BUTTON -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;">
                <tr>
                  <td style="border-radius:14px;background:linear-gradient(135deg,#7A3BFF,#c044ff);box-shadow:0 8px 28px rgba(122,59,255,0.45);">
                    <a href="https://tryzyvo.com/workspace/viral-script"
                       style="display:inline-block;padding:16px 36px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:-0.3px;">
                      Pick my style →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 28px;font-size:12px;color:rgba(255,255,255,0.25);">
                uses credits · free credits included on every plan
              </p>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding:20px 32px 28px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.25);line-height:1.7;">
                You're getting this because you opted in to Zyvo updates.<br/>
                <a href="https://tryzyvo.com/settings" style="color:rgba(255,255,255,0.35);text-decoration:underline;">Manage preferences</a>
                &nbsp;·&nbsp;
                <a href="https://tryzyvo.com" style="color:rgba(255,255,255,0.35);text-decoration:underline;">tryzyvo.com</a>
              </p>
            </td>
          </tr>

        </table>
        <!-- /CARD -->

      </td>
    </tr>
  </table>

</body>
</html>`;

  return html;
}

/* ================= SEND WITH RETRY ================= */

async function sendEmail(user) {
  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const { error } = await resend.emails.send({
      from: "Niko from Zyvo <niko@tryzyvo.com>",
      to: user.email,
      subject: "which creator are you? 👀",
      html: buildEmail(user),
    });

    if (!error) return true;

    lastError = error;
    console.error(`⚠️  Attempt ${attempt} failed for ${user.email}:`, error.message);
    if (attempt < 2) await sleep(RETRY_DELAY_MS);
  }

  console.error(`❌ Giving up on ${user.email}:`, lastError?.message);
  return false;
}

/* ================= MAIN HANDLER ================= */

export default async function handler(req, res) {
  try {
    console.log("🚀 Starting engagement email campaign...");
    console.log(`   dry_run=${DRY_RUN}  max_send=${MAX_SEND}  cooldown=${MIN_HOURS_SINCE_LAST_EMAIL}h`);

    let allUsers = [];
    let from = 0;

    while (true) {
      const { data, error } = await supabase
        .from("profiles")
        .select("email, last_email_sent_at")
        .eq("email_updates", true)
        .range(from, from + BATCH_SIZE - 1);

      if (error) {
        console.error("❌ Supabase fetch error:", error);
        return res.status(500).json({ error: "Failed to fetch users" });
      }

      if (!data || data.length === 0) break;
      allUsers.push(...data);
      if (data.length < BATCH_SIZE) break;
      from += BATCH_SIZE;
    }

    console.log(`📊 Total opted-in users: ${allUsers.length}`);

    let sent = 0, failed = 0, skipped = 0;

    for (const user of allUsers) {
      if (sent >= MAX_SEND) {
        console.log(`🛑 Reached MAX_SEND (${MAX_SEND}) — stopping.`);
        break;
      }

      if (!user.email) { skipped++; continue; }

      if (sentTooRecently(user.last_email_sent_at)) {
        skipped++;
        console.log(`⏭️  Skipping (emailed < ${MIN_HOURS_SINCE_LAST_EMAIL}h ago): ${user.email}`);
        continue;
      }

      if (DRY_RUN) {
        console.log(`🧪 DRY RUN: would send to ${user.email}`);
        sent++;
        continue;
      }

      console.log(`➡️  Sending to: ${user.email}`);

      const ok = await sendEmail(user);

      if (ok) {
        sent++;
        await supabase
          .from("profiles")
          .update({
            last_email_sent_at: new Date().toISOString(),
            last_email_type: "viral_styles_drop",
          })
          .eq("email", user.email);
      } else {
        failed++;
      }

      await sleep(DELAY_MS);
    }

    console.log("🎯 Campaign complete");
    console.log(`✅ Sent:    ${sent}`);
    console.log(`❌ Failed:  ${failed}`);
    console.log(`⏭️  Skipped: ${skipped}`);

    return res.status(200).json({ success: true, sent, failed, skipped });

  } catch (err) {
    console.error("🔥 Unexpected error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
}

/* ================= LOCAL RUN ================= */

if (process.argv[1]?.includes("send-engagement-email.js")) {
  console.log("🟢 Running engagement email locally...");
  handler(
    {},
    {
      status: (code) => ({ json: (data) => console.log("📤 Response:", code, data) }),
    }
  );
}
