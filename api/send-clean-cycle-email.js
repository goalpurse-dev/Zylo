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
<body style="margin:0;padding:0;background:#f0f0f2;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f0f2;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:540px;">

          <!-- Header bar -->
          <tr>
            <td style="background:#0a0a0a;padding:20px 32px;border-radius:12px 12px 0 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-family:Arial,sans-serif;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.4px;">Zyvo</span>
                  </td>
                  <td align="right">
                    <span style="font-family:Arial,sans-serif;font-size:11px;font-weight:600;color:#7A3BFF;letter-spacing:1px;text-transform:uppercase;">Member Offer</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Offer banner -->
          <tr>
            <td style="background:linear-gradient(135deg,#5b1fd1 0%,#7A3BFF 60%,#9f5cff 100%);padding:32px 32px 28px;">
              <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:13px;font-weight:600;color:rgba(255,255,255,0.7);letter-spacing:0.8px;text-transform:uppercase;">Limited time</p>
              <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:42px;font-weight:700;color:#ffffff;line-height:1;letter-spacing:-1px;">40% off</p>
              <p style="margin:0;font-family:Arial,sans-serif;font-size:16px;font-weight:500;color:rgba(255,255,255,0.85);">Zyvo Pro — for you, this week only</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:36px 32px 12px;">

              <p style="margin:0 0 18px;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#1a1a1a;">Hi ${displayName},</p>

              <p style="margin:0 0 18px;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#1a1a1a;">
                You signed up for Zyvo — and I wanted to reach out personally before this offer expires.
              </p>

              <p style="margin:0 0 18px;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#1a1a1a;">
                We’re giving a small group of members <strong>40% off their first month of Pro</strong>. That’s the full toolkit — unlimited image generation, priority processing, HD exports, and commercial usage rights — at less than the price of a coffee.
              </p>

              <!-- Feature list -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 28px;">
                <tr>
                  <td style="padding:16px 20px;background:#fafafa;border-radius:10px;border:1px solid #eeeeee;">
                    <p style="margin:0 0 10px;font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:#888888;letter-spacing:0.8px;text-transform:uppercase;">What’s included in Pro</p>
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="padding:5px 0;font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;">
                          <span style="color:#7A3BFF;font-weight:700;margin-right:8px;">✓</span> Unlimited AI image &amp; video generation
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;">
                          <span style="color:#7A3BFF;font-weight:700;margin-right:8px;">✓</span> Priority queue — results in seconds
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;">
                          <span style="color:#7A3BFF;font-weight:700;margin-right:8px;">✓</span> Full HD exports &amp; commercial rights
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:5px 0;font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;">
                          <span style="color:#7A3BFF;font-weight:700;margin-right:8px;">✓</span> Access to every style &amp; model
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom:12px;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="border-radius:9px;background:#7A3BFF;">
                          <a href="https://tryzyvo.com/workspace/pricing"
                             style="display:inline-block;padding:15px 36px;font-family:Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.2px;">
                            Claim 40% off Pro →
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <p style="margin:0 0 24px;font-family:Arial,sans-serif;font-size:12px;color:#aaaaaa;">Offer applies at checkout · No commitment, cancel anytime</p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Sign-off -->
          <tr>
            <td style="background:#ffffff;padding:0 32px 32px;">
              <p style="margin:0;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#555555;">
                Talk soon,<br />
                <strong style="color:#1a1a1a;">Niko</strong><br />
                <span style="font-size:13px;color:#aaaaaa;">Founder, Zyvo</span>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8f8f8;padding:20px 32px;border-top:1px solid #eeeeee;border-radius:0 0 12px 12px;">
              <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:12px;color:#aaaaaa;line-height:1.6;">You received this because you have an account at tryzyvo.com and opted in to product updates.</p>
              <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#aaaaaa;">Zyvo &middot; <a href="https://tryzyvo.com" style="color:#aaaaaa;text-decoration:underline;">tryzyvo.com</a></p>
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
      subject: "your 40% off — just for you",
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
      const { data, error } = await supabase
        .from("profiles")
        .select("email, email_updates, last_email_sent_at")
        .eq("email_updates", true)
        .or(`last_email_sent_at.is.null,last_email_sent_at.lt.${cutoff}`)
        .range(from, from + batchSize - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      allUsers.push(...data);

      if (data.length < batchSize) break;
      from += batchSize;
    }

    console.log(`👥 Eligible users: ${allUsers.length}`);

    let sent = 0;
    let skipped = 0;

    for (const user of allUsers) {
      if (sent >= MAX_SEND) break;
      if (!user.email) {
        skipped++;
        continue;
      }

      console.log(`➡️ Sending to: ${user.email}`);
      const ok = await sendEmail(user);

      if (ok) sent++;
      else skipped++;

      await sleep(DELAY_MS);
    }

    console.log(`🎯 Done — Sent ${sent}`);

    return res?.status?.(200)?.json({
      success: true,
      sent,
      skipped,
    });

  } catch (err) {
    console.error("🔥 Error:", err);
    return res?.status?.(500)?.json({ error: "fail" });
  }
}

// 🧪 Local run
if (process.argv[1]?.includes("send-next-batch.js")) {
  handler({}, { status: c => ({ json: d => console.log(c, d) }) });
}
// ================= LOCAL RUN =================
if (process.argv[1]?.includes("send-clean-cycle-email.js")) {
  console.log("🟢 Running email batch...");

  handler(
    {},
    {
      status: (code) => ({
        json: (data) => {
          console.log("📤 Response:", code, data);
          process.exit(0);
        },
      }),
    }
  );
}