import dotenv from "dotenv";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/* ─── Name parser ────────────────────────────────────────────────── */
function firstName(email = "") {
  const raw = email.split("@")[0].replace(/[._\-\d]/g, " ").trim().split(" ")[0];
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/* ═══════════════════════════════════════════════════════════════════
   EMAIL 1  —  sent ~5 min after abandonment
   Tone: personal, empathetic, zero pressure
   Goal: remove friction / find out what stopped them
═══════════════════════════════════════════════════════════════════ */
function emailOneHtml(user) {
  const name = firstName(user.email);
  const plan = user.plan_name || "Pro";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Did something go wrong?</title>
</head>
<body style="margin:0;padding:0;background:#f0f0f2;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f0f2;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:520px;">

        <!-- Header -->
        <tr>
          <td style="background:#0a0a0a;padding:20px 32px;border-radius:12px 12px 0 0;">
            <span style="font-family:Arial,sans-serif;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.4px;">Zyvo</span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:36px 32px 28px;font-family:Arial,sans-serif;font-size:15px;line-height:1.75;color:#1a1a1a;border-radius:0;">

            <p style="margin:0 0 18px;">Hi ${name},</p>

            <p style="margin:0 0 18px;">
              I noticed you were setting up your Zyvo ${plan} account a few minutes ago — and then it stopped.
            </p>

            <p style="margin:0 0 18px;">
              A few things I've seen get in the way:
            </p>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
              <tr>
                <td style="padding:14px 18px;background:#fafafa;border-radius:10px;border:1px solid #eeeeee;font-family:Arial,sans-serif;font-size:14px;color:#333;">
                  <div style="margin-bottom:8px;">
                    <span style="color:#7A3BFF;font-weight:700;margin-right:8px;">→</span> Payment didn't go through
                  </div>
                  <div style="margin-bottom:8px;">
                    <span style="color:#7A3BFF;font-weight:700;margin-right:8px;">→</span> Page timed out or froze
                  </div>
                  <div>
                    <span style="color:#7A3BFF;font-weight:700;margin-right:8px;">→</span> Not sure if it was the right plan
                  </div>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 24px;">
              If any of those hit — just reply to this email and I'll sort it personally. Takes 2 minutes.
            </p>

            <!-- CTA -->
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="border-radius:9px;background:#7A3BFF;">
                  <a href="https://tryzyvo.com/workspace/pricing"
                     style="display:inline-block;padding:14px 28px;font-family:Arial,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">
                    Pick up where you left off →
                  </a>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Sign-off -->
        <tr>
          <td style="background:#ffffff;padding:0 32px 28px;font-family:Arial,sans-serif;font-size:15px;color:#555555;line-height:1.7;">
            <p style="margin:0;">
              — <strong style="color:#1a1a1a;">Niko</strong><br>
              <span style="font-size:12px;color:#aaaaaa;">Founder, Zyvo</span>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8f8f8;padding:18px 32px;border-top:1px solid #eeeeee;border-radius:0 0 12px 12px;font-family:Arial,sans-serif;font-size:12px;color:#aaaaaa;line-height:1.6;">
            <p style="margin:0;">You started a checkout at tryzyvo.com — that's why I'm reaching out.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/* ═══════════════════════════════════════════════════════════════════
   EMAIL 2  —  sent ~30 min after abandonment
   Tone: value-focused, urgency, social proof
   Goal: show exactly what they're missing, make upgrading feel obvious
═══════════════════════════════════════════════════════════════════ */
function emailTwoHtml(user) {
  const name = firstName(user.email);
  const plan = user.plan_name || "Pro";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>What you were about to unlock</title>
</head>
<body style="margin:0;padding:0;background:#f0f0f2;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f0f2;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:520px;">

        <!-- Header with offer banner -->
        <tr>
          <td style="background:#0a0a0a;padding:20px 32px 0;border-radius:12px 12px 0 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td><span style="font-family:Arial,sans-serif;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.4px;">Zyvo</span></td>
                <td align="right"><span style="font-family:Arial,sans-serif;font-size:11px;font-weight:600;color:#9D6BFF;letter-spacing:1px;text-transform:uppercase;">Your cart is waiting</span></td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:linear-gradient(135deg,#5b1fd1 0%,#7A3BFF 60%,#9f5cff 100%);padding:24px 32px 22px;">
            <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:13px;font-weight:600;color:rgba(255,255,255,0.7);letter-spacing:0.8px;text-transform:uppercase;">You're one click away from</p>
            <p style="margin:0;font-family:Arial,sans-serif;font-size:24px;font-weight:800;color:#ffffff;line-height:1.2;letter-spacing:-0.5px;">Zyvo ${plan}</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:32px 32px 8px;font-family:Arial,sans-serif;font-size:15px;line-height:1.75;color:#1a1a1a;">

            <p style="margin:0 0 18px;">Hey ${name},</p>

            <p style="margin:0 0 20px;">
              Here's what was literally one click away when you stopped:
            </p>

            <!-- Feature list -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
              <tr>
                <td style="padding:16px 20px;background:#fafafa;border-radius:10px;border:1px solid #eeeeee;">
                  <p style="margin:0 0 10px;font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:#888888;letter-spacing:0.8px;text-transform:uppercase;">${plan} unlocks</p>
                  <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                    <tr><td style="padding:5px 0;font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;"><span style="color:#7A3BFF;font-weight:700;margin-right:8px;">✓</span> Unlimited AI image &amp; video generation</td></tr>
                    <tr><td style="padding:5px 0;font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;"><span style="color:#7A3BFF;font-weight:700;margin-right:8px;">✓</span> Priority queue — results in seconds, not minutes</td></tr>
                    <tr><td style="padding:5px 0;font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;"><span style="color:#7A3BFF;font-weight:700;margin-right:8px;">✓</span> HD exports with full commercial rights</td></tr>
                    <tr><td style="padding:5px 0;font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;"><span style="color:#7A3BFF;font-weight:700;margin-right:8px;">✓</span> Every style, every model, no limits</td></tr>
                    <tr><td style="padding:5px 0;font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;"><span style="color:#7A3BFF;font-weight:700;margin-right:8px;">✓</span> Cancel anytime — no commitment</td></tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Social proof -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
              <tr>
                <td style="padding:14px 18px;background:#f0ebff;border-radius:10px;border-left:3px solid #7A3BFF;">
                  <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:#333;line-height:1.55;font-style:italic;">
                    &ldquo;Went from 0 to 40K followers in 6 weeks using Zyvo. The content quality is insane.&rdquo;
                  </p>
                  <p style="margin:6px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#7A3BFF;font-weight:600;">— Sarah M., content creator</p>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="background:#ffffff;padding:0 32px 32px;" align="center">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="border-radius:9px;background:#7A3BFF;">
                  <a href="https://tryzyvo.com/workspace/pricing"
                     style="display:inline-block;padding:15px 36px;font-family:Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.2px;">
                    Complete your ${plan} upgrade →
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:10px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#aaaaaa;">Takes 30 seconds · Cancel anytime</p>
          </td>
        </tr>

        <!-- Sign-off -->
        <tr>
          <td style="background:#ffffff;padding:0 32px 28px;font-family:Arial,sans-serif;font-size:15px;color:#555555;line-height:1.7;border-top:1px solid #f5f5f5;">
            <p style="margin:16px 0 0;">
              — <strong style="color:#1a1a1a;">Niko</strong><br>
              <span style="font-size:12px;color:#aaaaaa;">Founder, Zyvo</span>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8f8f8;padding:18px 32px;border-top:1px solid #eeeeee;border-radius:0 0 12px 12px;font-family:Arial,sans-serif;font-size:12px;color:#aaaaaa;line-height:1.6;">
            <p style="margin:0;">You started a checkout at tryzyvo.com — that's why I'm reaching out.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/* ═══════════════════════════════════════════════════════════════════
   EMAIL 3  —  sent ~6 hours after abandonment
   Tone: final, personal, genuine last chance — no fake urgency
   Goal: convert with a real offer or close the loop completely
═══════════════════════════════════════════════════════════════════ */
function emailThreeHtml(user) {
  const name = firstName(user.email);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>One last thing</title>
</head>
<body style="margin:0;padding:0;background:#f0f0f2;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f0f2;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:520px;">

        <!-- Header -->
        <tr>
          <td style="background:#0a0a0a;padding:20px 32px;border-radius:12px 12px 0 0;">
            <span style="font-family:Arial,sans-serif;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.4px;">Zyvo</span>
          </td>
        </tr>

        <!-- Offer strip -->
        <tr>
          <td style="background:linear-gradient(135deg,#1a0533,#2d0b5c);padding:22px 32px;border-bottom:1px solid rgba(122,59,255,0.3);">
            <p style="margin:0 0 3px;font-family:Arial,sans-serif;font-size:12px;font-weight:600;color:rgba(255,255,255,0.55);letter-spacing:0.8px;text-transform:uppercase;">Exclusive offer</p>
            <p style="margin:0;font-family:Arial,sans-serif;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;line-height:1.1;">40% off — this link only</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:32px 32px 0;font-family:Arial,sans-serif;font-size:15px;line-height:1.75;color:#1a1a1a;">

            <p style="margin:0 0 18px;">Hi ${name},</p>

            <p style="margin:0 0 18px;">
              This is the last email I'll send on this. I promise.
            </p>

            <p style="margin:0 0 18px;">
              I genuinely want you to try Zyvo. So I'm cutting the price — <strong>40% off your first month</strong>, applied automatically when you click below.
            </p>

            <p style="margin:0 0 24px;">
              No code needed. No catch. If it's not right for you after trying it, cancel in one click.
            </p>

            <!-- Offer box -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
              <tr>
                <td style="padding:20px 24px;background:linear-gradient(135deg,rgba(122,59,255,0.08),rgba(157,107,255,0.06));border-radius:12px;border:1px solid rgba(122,59,255,0.2);text-align:center;">
                  <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:13px;color:#7A3BFF;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;">Your exclusive offer</p>
                  <p style="margin:0 0 2px;font-family:Arial,sans-serif;font-size:36px;font-weight:800;color:#1a1a1a;letter-spacing:-1px;line-height:1;">40% off</p>
                  <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:#888888;">First month of any plan · No commitment</p>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="background:#ffffff;padding:0 32px 32px;" align="center">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="border-radius:9px;background:#7A3BFF;box-shadow:0 4px 20px rgba(122,59,255,0.4);">
                  <a href="https://tryzyvo.com/workspace/pricing"
                     style="display:inline-block;padding:15px 36px;font-family:Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.2px;">
                    Claim 40% off now →
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:10px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#aaaaaa;">Offer expires in 24 hours · Cancel anytime</p>
          </td>
        </tr>

        <!-- Sign-off -->
        <tr>
          <td style="background:#ffffff;padding:0 32px 28px;border-top:1px solid #f5f5f5;font-family:Arial,sans-serif;font-size:15px;color:#555555;line-height:1.7;">
            <p style="margin:16px 0 0;">
              Good luck out there either way,<br>
              <strong style="color:#1a1a1a;">Niko</strong><br>
              <span style="font-size:12px;color:#aaaaaa;">Founder, Zyvo</span>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8f8f8;padding:18px 32px;border-top:1px solid #eeeeee;border-radius:0 0 12px 12px;font-family:Arial,sans-serif;font-size:12px;color:#aaaaaa;line-height:1.6;">
            <p style="margin:0;">You started a checkout at tryzyvo.com — that's why I'm reaching out. This is the last email in this series.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/* ═══════════════════════════════════════════════════════════════════
   SEND + STAGE LOGIC  (unchanged)
═══════════════════════════════════════════════════════════════════ */
async function sendStageEmail(user) {
  const stages = [
    { subject: "did something go wrong?",        html: emailOneHtml(user)   },
    { subject: "what you were about to unlock",  html: emailTwoHtml(user)   },
    { subject: "one last thing (40% off)",        html: emailThreeHtml(user) },
  ];

  const stage = stages[user.recovery_stage];
  if (!stage) return;

  // Double-check still unpaid before sending
  const { data: check } = await supabase
    .from("abandoned_checkouts")
    .select("paid")
    .eq("id", user.id)
    .single();

  if (check?.paid) return;

  const { error } = await resend.emails.send({
    from: "Niko from Zyvo <niko@tryzyvo.com>",
    to: user.email,
    subject: stage.subject,
    html: stage.html,
    reply_to: "niko@tryzyvo.com",
  });

  if (error) {
    console.error("❌ SEND ERROR:", error);
    return;
  }

  await supabase
    .from("abandoned_checkouts")
    .update({
      recovery_stage: user.recovery_stage + 1,
      last_email_sent_at: new Date().toISOString(),
      status: user.recovery_stage + 1 >= 3 ? "finished" : "in_sequence",
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  console.log("✅ Sent stage", user.recovery_stage, "→", user.email);
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN HANDLER  (logic unchanged)
═══════════════════════════════════════════════════════════════════ */
export default async function handler(req, res) {
  console.log("🔥 ABANDONED EMAIL CRON TRIGGERED");

  try {
    const { data: users } = await supabase
      .from("abandoned_checkouts")
      .select("*")
      .eq("paid", false)
      .in("status", ["pending", "in_sequence"])
      .lt("recovery_stage", 3);

    console.log("📊 Eligible abandoned checkouts:", users?.length);

    let allProfiles = [];
    let from = 0;
    const batchSize = 1000;

    while (true) {
      const { data } = await supabase
        .from("profiles")
        .select("email, email_updates")
        .range(from, from + batchSize - 1);

      if (!data || data.length === 0) break;
      allProfiles.push(...data);
      from += batchSize;
    }

    const profileMap = new Map(
      allProfiles.map((p) => [p.email?.toLowerCase().trim(), p.email_updates])
    );

    const now = Date.now();

    for (const user of users) {
      if (!user.email) continue;

      const consent = profileMap.get(user.email.toLowerCase().trim());
      if (consent === false && consent !== null) {
        console.log("⛔ opted out:", user.email);
        continue;
      }

      const createdAt = new Date(user.created_at).getTime();
      const lastSent  = user.last_email_sent_at
        ? new Date(user.last_email_sent_at).getTime()
        : 0;

      const shouldSendStage1 = user.recovery_stage === 0 && now - createdAt  >= 5  * 60 * 1000;       // 5 min
      const shouldSendStage2 = user.recovery_stage === 1 && lastSent && now - lastSent >= 30 * 60 * 1000;  // 30 min
      const shouldSendStage3 = user.recovery_stage === 2 && lastSent && now - lastSent >= 6  * 60 * 60 * 1000; // 6 h

      if (shouldSendStage1 || shouldSendStage2 || shouldSendStage3) {
        console.log(`🚀 Stage ${user.recovery_stage} → ${user.email}`);
        await sendStageEmail(user);
        await new Promise((r) => setTimeout(r, 800 + Math.random() * 800));
      }
    }

    console.log("✅ CRON DONE");
    return res.status(200).json({ success: true });

  } catch (err) {
    console.error("❌ handler error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
}
