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
  <title>40% off Pro — today only</title>
</head>
<body style="margin:0;padding:0;background:#0d0d0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

  <!-- preview text -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#0d0d0f;">
    we're cutting Pro to €15/mo for the next 48 hours. here's why it's worth it 👇&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0f;">
    <tr>
      <td align="center" style="padding:40px 16px 60px;">

        <!-- CARD -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#16181f;border-radius:24px;border:1px solid rgba(255,255,255,0.07);overflow:hidden;">

          <!-- TOP ACCENT BAR -->
          <tr>
            <td style="height:3px;background:linear-gradient(90deg,#7A3BFF,#c077ff,#ff57b2,#c077ff,#7A3BFF);"></td>
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

              <!-- URGENCY BADGE -->
              <div style="display:inline-block;background:rgba(255,77,109,0.12);border:1px solid rgba(255,77,109,0.3);border-radius:100px;padding:5px 14px;margin-bottom:18px;">
                <span style="font-size:11px;font-weight:700;color:#ff6b8a;letter-spacing:0.08em;text-transform:uppercase;">⏳ 48-hour offer</span>
              </div>

              <h1 style="margin:0 0 16px;font-size:30px;font-weight:800;color:#ffffff;line-height:1.2;letter-spacing:-0.5px;">
                Pro for <span style="background:linear-gradient(90deg,#7A3BFF,#c077ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">€15/mo.</span><br/>Normal price: <span style="color:rgba(255,255,255,0.35);text-decoration:line-through;font-size:22px;">€32</span>
              </h1>

              <p style="margin:0 0 22px;font-size:15px;line-height:1.8;color:rgba(255,255,255,0.65);">
                Hey ${displayName} — for the next 48 hours we're running a limited deal on Pro. No code needed, just click below. Here's what you get:
              </p>

              <!-- WHAT'S INCLUDED BOX -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(122,59,255,0.07);border:1px solid rgba(122,59,255,0.2);border-radius:16px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 22px;">

                    <!-- Row -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;">
                      <tr>
                        <td width="28" valign="top"><div style="width:22px;height:22px;background:rgba(122,59,255,0.2);border:1px solid rgba(122,59,255,0.35);border-radius:7px;text-align:center;line-height:22px;font-size:11px;">⚡</div></td>
                        <td style="padding-left:10px;">
                          <p style="margin:0;font-size:13px;color:#ffffff;font-weight:600;">1,200 credits / month</p>
                          <p style="margin:2px 0 0;font-size:11px;color:rgba(255,255,255,0.4);">Up to 400 AI images or 60 AI videos</p>
                        </td>
                      </tr>
                    </table>

                    <!-- Row -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;">
                      <tr>
                        <td width="28" valign="top"><div style="width:22px;height:22px;background:rgba(122,59,255,0.2);border:1px solid rgba(122,59,255,0.35);border-radius:7px;text-align:center;line-height:22px;font-size:11px;">🎬</div></td>
                        <td style="padding-left:10px;">
                          <p style="margin:0;font-size:13px;color:#ffffff;font-weight:600;">All AI video & image models</p>
                          <p style="margin:2px 0 0;font-size:11px;color:rgba(255,255,255,0.4);">Including Nano Banana, Kling, MiniMax & more</p>
                        </td>
                      </tr>
                    </table>

                    <!-- Row -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;">
                      <tr>
                        <td width="28" valign="top"><div style="width:22px;height:22px;background:rgba(122,59,255,0.2);border:1px solid rgba(122,59,255,0.35);border-radius:7px;text-align:center;line-height:22px;font-size:11px;">✍️</div></td>
                        <td style="padding-left:10px;">
                          <p style="margin:0;font-size:13px;color:#ffffff;font-weight:600;">Viral Script Builder — all 8 styles</p>
                          <p style="margin:2px 0 0;font-size:11px;color:rgba(255,255,255,0.4);">MrBeast Mode, TikTok Viral, Story Arc & more</p>
                        </td>
                      </tr>
                    </table>

                    <!-- Row -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;">
                      <tr>
                        <td width="28" valign="top"><div style="width:22px;height:22px;background:rgba(122,59,255,0.2);border:1px solid rgba(122,59,255,0.35);border-radius:7px;text-align:center;line-height:22px;font-size:11px;">🚀</div></td>
                        <td style="padding-left:10px;">
                          <p style="margin:0;font-size:13px;color:#ffffff;font-weight:600;">Priority generation queue</p>
                          <p style="margin:2px 0 0;font-size:11px;color:rgba(255,255,255,0.4);">Your jobs process before free tier users</p>
                        </td>
                      </tr>
                    </table>

                    <!-- Row -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="28" valign="top"><div style="width:22px;height:22px;background:rgba(122,59,255,0.2);border:1px solid rgba(122,59,255,0.35);border-radius:7px;text-align:center;line-height:22px;font-size:11px;">🖼</div></td>
                        <td style="padding-left:10px;">
                          <p style="margin:0;font-size:13px;color:#ffffff;font-weight:600;">Watermark-free exports</p>
                          <p style="margin:2px 0 0;font-size:11px;color:rgba(255,255,255,0.4);">Post directly — no Zyvo branding</p>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>

              <!-- PRICE COMPARISON -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#111318;border:1px solid rgba(255,255,255,0.07);border-radius:14px;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td>
                          <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Original price</p>
                          <p style="margin:4px 0 0;font-size:22px;font-weight:800;color:rgba(255,255,255,0.3);text-decoration:line-through;">€32/mo</p>
                        </td>
                        <td style="text-align:center;">
                          <div style="display:inline-block;background:rgba(255,77,109,0.15);border:1px solid rgba(255,77,109,0.3);border-radius:8px;padding:4px 10px;">
                            <span style="font-size:13px;font-weight:800;color:#FF4D6D;">LIMITED</span>
                          </div>
                        </td>
                        <td style="text-align:right;">
                          <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Today only</p>
                          <p style="margin:4px 0 0;font-size:22px;font-weight:800;color:#ffffff;">€15<span style="font-size:13px;font-weight:400;color:rgba(255,255,255,0.4);">/mo</span></p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- SOCIAL PROOF -->
              <p style="margin:0 0 24px;font-size:14px;line-height:1.8;color:rgba(255,255,255,0.55);">
                This offer expires in 48 hours and won't come back. If you've been thinking about upgrading, this is the moment. Cancel anytime — no questions asked.
              </p>

              <!-- CTA BUTTON -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;width:100%;">
                <tr>
                  <td style="border-radius:14px;background:linear-gradient(135deg,#7A3BFF,#9d4eff);box-shadow:0 8px 28px rgba(122,59,255,0.45);">
                    <a href="https://tryzyvo.com/workspace/pricing"
                       style="display:block;text-align:center;padding:17px 32px;font-size:17px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:-0.3px;">
                      Get Pro for €15/mo →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 28px;text-align:center;font-size:12px;color:rgba(255,255,255,0.25);">
                Instant access · Cancel anytime · Offer ends in 48h
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
      subject: "40% off Pro — 48 hours only ⚡",
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
            last_email_type: "pro_40off_48h",
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
