import dotenv from "dotenv";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MAX_SEND = 300;
const DELAY_MS = 3000;
const RETRY_DELAY_MS = 1500;
const COOLDOWN_HOURS = 72; // ⏳ only resend after 3 days

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function emailHtml(user) {
  const raw = user.email?.split("@")[0] || "there";
  const name = raw.replace(/[._\-\d]/g, " ").trim().split(" ")[0];
  const displayName = name.charAt(0).toUpperCase() + name.slice(1);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Zyvo Pro offer</title>
</head>
<body style="margin:0;padding:0;background:#ebebed;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ebebed;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:540px;">

          <!-- Header -->
          <tr>
            <td style="background:#0a0a0a;padding:22px 32px;border-radius:14px 14px 0 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td><span style="font-family:Arial,sans-serif;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Zyvo</span></td>
                  <td align="right"><span style="font-family:Arial,sans-serif;font-size:11px;font-weight:700;color:#9D6BFF;letter-spacing:1.3px;text-transform:uppercase;">For You</span></td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero -->
          <tr>
            <td style="background:linear-gradient(140deg,#12003a 0%,#3a0fa8 45%,#7A3BFF 100%);padding:44px 32px 38px;">
              <p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:rgba(255,255,255,0.5);letter-spacing:1.6px;text-transform:uppercase;">Limited offer</p>
              <p style="margin:0 0 10px;font-family:Arial,sans-serif;font-size:48px;font-weight:800;color:#ffffff;line-height:1;letter-spacing:-2px;">40% off Pro</p>
              <p style="margin:0;font-family:Arial,sans-serif;font-size:16px;color:rgba(255,255,255,0.7);line-height:1.6;font-weight:400;">The fastest way to create viral content — now at the lowest price we offer.</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px 32px 14px;">

              <p style="margin:0 0 22px;font-family:Arial,sans-serif;font-size:16px;line-height:1.75;color:#1a1a1a;">Hi ${displayName},</p>

              <p style="margin:0 0 18px;font-family:Arial,sans-serif;font-size:15px;line-height:1.8;color:#333333;">
                I noticed you’re still on the free plan. I wanted to write personally — not just send a generic blast — because I think you’re leaving a lot on the table.
              </p>

              <p style="margin:0 0 18px;font-family:Arial,sans-serif;font-size:15px;line-height:1.8;color:#333333;">
                The people getting real traction with Zyvo are the ones using Pro: generating cinematic AI videos, publishing HD content every day, moving faster than everyone else in their niche. <strong style="color:#1a1a1a;">That can be you.</strong>
              </p>

              <p style="margin:0 0 28px;font-family:Arial,sans-serif;font-size:15px;line-height:1.8;color:#333333;">
                This week I’m offering <strong style="color:#1a1a1a;">40% off your first month</strong> — no code needed, applied automatically at checkout.
              </p>

              <!-- Feature list -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 32px;">
                <tr>
                  <td style="padding:22px 24px;background:#f8f7ff;border-radius:12px;border:1px solid #e4deff;">
                    <p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:11px;font-weight:700;color:#9D6BFF;letter-spacing:1.2px;text-transform:uppercase;">What Pro unlocks</p>
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="padding:8px 0;font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.6;border-bottom:1px solid #eeebff;">
                          <span style="color:#7A3BFF;font-weight:900;margin-right:12px;">✦</span>AI video generation from text or image
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.6;border-bottom:1px solid #eeebff;">
                          <span style="color:#7A3BFF;font-weight:900;margin-right:12px;">✦</span>Unlimited HD images with commercial rights
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.6;border-bottom:1px solid #eeebff;">
                          <span style="color:#7A3BFF;font-weight:900;margin-right:12px;">✦</span>Priority processing — results in seconds
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.6;">
                          <span style="color:#7A3BFF;font-weight:900;margin-right:12px;">✦</span>Every model and style, zero restrictions
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 10px;">
                <tr>
                  <td align="center" style="padding-bottom:14px;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="border-radius:12px;background:#7A3BFF;box-shadow:0 8px 28px rgba(122,59,255,0.45);">
                          <a href="https://tryzyvo.com/workspace/pricing"
                             style="display:inline-block;padding:18px 48px;font-family:Arial,sans-serif;font-size:16px;font-weight:800;color:#ffffff;text-decoration:none;letter-spacing:0.3px;">
                            Get 40% off Pro Now →
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <p style="margin:0 0 30px;font-family:Arial,sans-serif;font-size:12px;color:#bbbbbb;">Discount applied automatically &middot; Cancel anytime</p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Sign-off -->
          <tr>
            <td style="background:#ffffff;padding:0 32px 38px;border-top:1px solid #f0f0f0;">
              <p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:14px;line-height:1.75;color:#777777;">
                If you ever have questions about what plan is right for you, just reply to this email. I read every one.
              </p>
              <p style="margin:0;font-family:Arial,sans-serif;font-size:15px;line-height:1.8;color:#555555;">
                Talk soon,<br />
                <strong style="color:#1a1a1a;">Niko</strong><br />
                <span style="font-size:13px;color:#aaaaaa;">Founder, Zyvo</span>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f5f5f7;padding:20px 32px;border-top:1px solid #e8e8e8;border-radius:0 0 14px 14px;">
              <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:12px;color:#bbbbbb;line-height:1.6;">You received this because you have an account at tryzyvo.com and opted in to product updates.</p>
              <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#bbbbbb;">Zyvo &middot; <a href="https://tryzyvo.com" style="color:#bbbbbb;text-decoration:underline;">tryzyvo.com</a></p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendEmail(user) {
  let sendError = null;

  for (let i = 1; i <= 2; i++) {
    const { error } = await resend.emails.send({
      from: "Zyvo <niko@tryzyvo.com>",
      to: user.email,
      subject: "still on free? here's why people upgrade",
      html: emailHtml(user),
    });

    if (!error) {
      sendError = null;
      break;
    }

    sendError = error;
    await sleep(RETRY_DELAY_MS);
  }

  if (sendError) return false;

  // 🔥 mark user as sent
  await supabase
    .from("profiles")
    .update({ last_email_sent_at: new Date().toISOString() })
    .eq("email", user.email);

  return true;
}

export default async function handler(req, res) {
  try {
    console.log("🚀 Starting batch send...");

    const cutoff = new Date(
      Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000
    ).toISOString();

    let allUsers = [];
    let from = 0;
    const batchSize = 1000;

    // 🔥 FETCH WITH COOLDOWN FILTER
    while (true) {
      console.log(`   Fetching profiles ${from}–${from + batchSize - 1}...`);

      const { data, error } = await supabase
        .from("profiles")
        .select("email, email_updates, last_email_sent_at")
        .eq("email_updates", true)
        .or(`last_email_sent_at.is.null,last_email_sent_at.lt.${cutoff}`)
        .range(from, from + batchSize - 1);

      if (error) {
        console.error("❌ Supabase fetch error:", error.message);
        throw error;
      }

      if (!data || data.length === 0) break;

      allUsers.push(...data);
      console.log(`   → Got ${data.length} rows (total so far: ${allUsers.length})`);

      if (data.length < batchSize) break;
      from += batchSize;
    }

    console.log(`\n👥 Eligible users: ${allUsers.length}`);

    let sent = 0;
    let skipped = 0;

    for (const user of allUsers) {
      if (sent >= MAX_SEND) break;
      if (!user.email) { skipped++; continue; }

      console.log(`➡️  [${sent + 1}] Sending to: ${user.email}`);
      const ok = await sendEmail(user);

      if (ok) sent++;
      else skipped++;

      await sleep(DELAY_MS);
    }

    console.log(`\n🎯 Done — Sent: ${sent} | Skipped: ${skipped}`);

    res?.status?.(200)?.json({ success: true, sent, skipped });

  } catch (err) {
    console.error("🔥 Error:", err);
    res?.status?.(500)?.json({ error: "fail" });
  } finally {
    process.exit(0);
  }
}

// ================= LOCAL RUN =================
if (process.argv[1]?.includes("send-clean-cycle-email.js")) {
  console.log("🟢 Running clean cycle email batch...\n");
  handler({}, { status: (code) => ({ json: (data) => console.log("📤", code, data) }) });
}
