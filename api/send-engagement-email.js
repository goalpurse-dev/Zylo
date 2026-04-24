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
  <title>Kling 3.0 Pro just landed on Zyvo</title>
</head>
<body style="margin:0;padding:0;background:#0d0d0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

  <!-- preview text -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#0d0d0f;">
    the most cinematic AI video model just got added. here's what it can do 🎬&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0f;">
    <tr>
      <td align="center" style="padding:40px 16px 60px;">

        <!-- CARD -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#16181f;border-radius:24px;border:1px solid rgba(255,255,255,0.07);overflow:hidden;">

          <!-- TOP ACCENT BAR -->
          <tr>
            <td style="height:3px;background:linear-gradient(90deg,#0ea5e9,#6366f1,#7A3BFF,#6366f1,#0ea5e9);"></td>
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

              <!-- NEW badge -->
              <div style="display:inline-block;background:rgba(14,165,233,0.12);border:1px solid rgba(14,165,233,0.35);border-radius:100px;padding:5px 14px;margin-bottom:18px;">
                <span style="font-size:11px;font-weight:700;color:#38bdf8;letter-spacing:0.08em;text-transform:uppercase;">🎬 new model drop</span>
              </div>

              <h1 style="margin:0 0 16px;font-size:30px;font-weight:800;color:#ffffff;line-height:1.2;letter-spacing:-0.5px;">
                Kling 3.0 Pro is live.<br/>
                <span style="background:linear-gradient(90deg,#0ea5e9,#7A3BFF);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">
                  The best AI video model just got added.
                </span>
              </h1>

              <p style="margin:0 0 24px;font-size:15px;line-height:1.8;color:rgba(255,255,255,0.65);">
                Hey ${displayName} — we just added Kling AI 3.0 Pro to Zyvo. This is the model behind the most cinematic AI videos on TikTok and Reels right now. Here's what makes it different from everything else:
              </p>

              <!-- FEATURE CARDS -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
                <tr>
                  <td width="49%" style="padding-right:4px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0f14;border:1px solid rgba(14,165,233,0.2);border-radius:14px;overflow:hidden;">
                      <tr><td style="height:2px;background:rgba(14,165,233,0.7);"></td></tr>
                      <tr>
                        <td style="padding:14px 16px;">
                          <p style="margin:0 0 4px;font-size:18px;">🎬</p>
                          <p style="margin:0 0 3px;font-size:13px;font-weight:700;color:#fff;">3–15 second clips</p>
                          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.35);line-height:1.5;">Slider control · any duration in range</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td width="49%" style="padding-left:4px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0f14;border:1px solid rgba(99,102,241,0.2);border-radius:14px;overflow:hidden;">
                      <tr><td style="height:2px;background:rgba(99,102,241,0.7);"></td></tr>
                      <tr>
                        <td style="padding:14px 16px;">
                          <p style="margin:0 0 4px;font-size:18px;">🔊</p>
                          <p style="margin:0 0 3px;font-size:13px;font-weight:700;color:#fff;">AI-generated sound</p>
                          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.35);line-height:1.5;">First model on Zyvo with sound toggle</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                <tr>
                  <td width="49%" style="padding-right:4px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0f14;border:1px solid rgba(122,59,255,0.2);border-radius:14px;overflow:hidden;">
                      <tr><td style="height:2px;background:rgba(122,59,255,0.7);"></td></tr>
                      <tr>
                        <td style="padding:14px 16px;">
                          <p style="margin:0 0 4px;font-size:18px;">📐</p>
                          <p style="margin:0 0 3px;font-size:13px;font-weight:700;color:#fff;">1080p + 1440p output</p>
                          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.35);line-height:1.5;">9:16 · 16:9 · 1:1 · ultra sharp</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td width="49%" style="padding-left:4px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0f14;border:1px solid rgba(16,185,129,0.2);border-radius:14px;overflow:hidden;">
                      <tr><td style="height:2px;background:rgba(16,185,129,0.7);"></td></tr>
                      <tr>
                        <td style="padding:14px 16px;">
                          <p style="margin:0 0 4px;font-size:18px;">🖼️</p>
                          <p style="margin:0 0 3px;font-size:13px;font-weight:700;color:#fff;">Reference image input</p>
                          <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.35);line-height:1.5;">Consistent subjects across all clips</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- DIVIDER -->
              <hr style="border:none;border-top:1px solid rgba(255,255,255,0.07);margin:0 0 22px;" />

              <p style="margin:0 0 22px;font-size:15px;line-height:1.8;color:rgba(255,255,255,0.65);">
                The motion realism on this model is genuinely different. Cinematic camera moves, stable subjects, physically plausible motion — it's the one creators use when they need a clip that actually looks expensive.
              </p>

              <!-- WHO IT'S FOR -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(122,59,255,0.06);border:1px solid rgba(122,59,255,0.15);border-radius:14px;margin-bottom:24px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:0.1em;color:rgba(255,255,255,0.3);text-transform:uppercase;">Perfect for</p>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr><td style="padding:4px 0;"><span style="font-size:13px;color:rgba(255,255,255,0.8);">✦&nbsp;&nbsp;Cinematic storytelling and POV content</span></td></tr>
                      <tr><td style="padding:4px 0;"><span style="font-size:13px;color:rgba(255,255,255,0.8);">✦&nbsp;&nbsp;Faceless channels that need premium visual quality</span></td></tr>
                      <tr><td style="padding:4px 0;"><span style="font-size:13px;color:rgba(255,255,255,0.8);">✦&nbsp;&nbsp;Brand and product content with consistent reference images</span></td></tr>
                      <tr><td style="padding:4px 0;"><span style="font-size:13px;color:rgba(255,255,255,0.8);">✦&nbsp;&nbsp;Any video where the visual quality IS the hook</span></td></tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 26px;font-size:14px;line-height:1.8;color:rgba(255,255,255,0.5);">
                Available now inside the Zyvo video generator. Pro plan required — it's a premium model.
              </p>

              <!-- CTA BUTTON -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;width:100%;">
                <tr>
                  <td style="border-radius:14px;background:linear-gradient(135deg,#0ea5e9,#7A3BFF);box-shadow:0 8px 28px rgba(99,102,241,0.4);">
                    <a href="https://tryzyvo.com/workspace/video-generator"
                       style="display:block;text-align:center;padding:17px 32px;font-size:17px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:-0.3px;">
                      Try Kling 3.0 Pro →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 28px;text-align:center;font-size:12px;color:rgba(255,255,255,0.25);">
                Pro plan · credits charged only after your video renders
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
      subject: "the most cinematic AI video model just landed on Zyvo 🎬",
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
            last_email_type: "kling_pro_drop",
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
