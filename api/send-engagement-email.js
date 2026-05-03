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

const DELAY_MS                = 400;
const RETRY_DELAY_MS          = 2000;
const BATCH_SIZE              = 1000;
const DRY_RUN                 = false;

/* ================= HELPERS ================= */

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/* ================= EMAIL TEMPLATE ================= */

function buildEmail(user) {
  const raw = (user.email?.split("@")[0] || "")
    .replace(/[._\-+\d]/g, " ").trim().split(" ")[0] || "there";
  const displayName = raw.charAt(0).toUpperCase() + raw.slice(1);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>You still haven't upgraded.</title>
</head>
<body style="margin:0;padding:0;background:#0d0d0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

  <!-- preview text -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#0d0d0f;">
    You signed up. You never upgraded. Here's exactly what you're leaving on the table.&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0f;">
    <tr><td align="center" style="padding:40px 16px 60px;">

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#16181f;border-radius:24px;border:1px solid rgba(255,255,255,0.07);overflow:hidden;">

        <!-- accent bar -->
        <tr><td style="height:3px;background:linear-gradient(90deg,#7A3BFF,#c077ff,#ff57b2,#c077ff,#7A3BFF);"></td></tr>

        <!-- logo -->
        <tr><td style="padding:28px 32px 0;">
          <span style="font-size:20px;font-weight:800;color:#fff;letter-spacing:-0.5px;">Z<span style="color:#7A3BFF;">yvo</span></span>
        </td></tr>

        <!-- body -->
        <tr><td style="padding:24px 32px 0;">

          <h1 style="margin:0 0 20px;font-size:26px;font-weight:800;color:#fff;line-height:1.25;letter-spacing:-0.4px;">
            ${displayName}, you signed up — but never came back.
          </h1>

          <p style="margin:0 0 14px;font-size:15px;line-height:1.85;color:rgba(255,255,255,0.65);">
            I'm not going to pretend this is just a newsletter. I'm reaching out because you made an account on Zyvo, used your free generations, and then stopped. I've seen this pattern with thousands of users and I know exactly what happened — the free tier just isn't enough to show you what this platform actually does.
          </p>

          <p style="margin:0 0 28px;font-size:15px;line-height:1.85;color:rgba(255,255,255,0.65);">
            So let me make it impossible to say no.
          </p>

          <!-- offer box -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(122,59,255,0.1);border:1px solid rgba(122,59,255,0.35);border-radius:16px;margin-bottom:28px;">
            <tr><td style="padding:22px 24px;">
              <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(168,85,247,0.8);">This week only</p>
              <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;">
                <tr>
                  <td style="vertical-align:middle;padding-right:10px;">
                    <span style="font-size:16px;color:rgba(255,255,255,0.3);text-decoration:line-through;font-weight:600;">€32/mo</span>
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="font-size:38px;font-weight:800;color:#fff;letter-spacing:-1px;">€25</span><span style="font-size:14px;color:rgba(255,255,255,0.4);">/mo</span>
                  </td>
                  <td style="vertical-align:middle;padding-left:10px;">
                    <span style="font-size:11px;font-weight:700;color:#C084FC;background:rgba(168,85,247,0.18);border:1px solid rgba(168,85,247,0.35);border-radius:20px;padding:4px 10px;">SAVE 22%</span>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.5);line-height:1.6;">
                Pro plan · 1,200 credits/mo · cancel anytime · no hidden fees
              </p>
            </td></tr>
          </table>

          <!-- what they get -->
          <p style="margin:0 0 14px;font-size:13px;font-weight:700;letter-spacing:0.08em;color:rgba(255,255,255,0.3);text-transform:uppercase;">what you unlock today</p>

          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;">
            <tr>
              <td width="28" valign="top"><div style="width:22px;height:22px;background:rgba(122,59,255,0.15);border:1px solid rgba(122,59,255,0.3);border-radius:7px;text-align:center;line-height:22px;font-size:11px;">🖼️</div></td>
              <td style="padding-left:10px;">
                <p style="margin:0;font-size:14px;color:#fff;font-weight:600;">400 AI images per month</p>
                <p style="margin:3px 0 0;font-size:12px;color:rgba(255,255,255,0.4);line-height:1.5;">Premium models, no watermarks, every style. Product photos, viral visuals, ads.</p>
              </td>
            </tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;">
            <tr>
              <td width="28" valign="top"><div style="width:22px;height:22px;background:rgba(122,59,255,0.15);border:1px solid rgba(122,59,255,0.3);border-radius:7px;text-align:center;line-height:22px;font-size:11px;">🎬</div></td>
              <td style="padding-left:10px;">
                <p style="margin:0;font-size:14px;color:#fff;font-weight:600;">60 AI videos per month</p>
                <p style="margin:3px 0 0;font-size:12px;color:rgba(255,255,255,0.4);line-height:1.5;">Cinematic short-form clips for TikTok, Reels, and YouTube Shorts. From one prompt.</p>
              </td>
            </tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;">
            <tr>
              <td width="28" valign="top"><div style="width:22px;height:22px;background:rgba(122,59,255,0.15);border:1px solid rgba(122,59,255,0.3);border-radius:7px;text-align:center;line-height:22px;font-size:11px;">✍️</div></td>
              <td style="padding-left:10px;">
                <p style="margin:0;font-size:14px;color:#fff;font-weight:600;">600 viral scripts per month</p>
                <p style="margin:3px 0 0;font-size:12px;color:rgba(255,255,255,0.4);line-height:1.5;">Hook → scenes → CTA in 60 seconds. With image and video prompts per scene.</p>
              </td>
            </tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
            <tr>
              <td width="28" valign="top"><div style="width:22px;height:22px;background:rgba(122,59,255,0.15);border:1px solid rgba(122,59,255,0.3);border-radius:7px;text-align:center;line-height:22px;font-size:11px;">🚀</div></td>
              <td style="padding-left:10px;">
                <p style="margin:0;font-size:14px;color:#fff;font-weight:600;">Priority queue + every new tool</p>
                <p style="margin:3px 0 0;font-size:12px;color:rgba(255,255,255,0.4);line-height:1.5;">Skip the free-user queue. Get access to every feature we ship, on day one.</p>
              </td>
            </tr>
          </table>

          <!-- social proof -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(122,59,255,0.07);border-left:3px solid #7A3BFF;border-radius:0 12px 12px 0;margin-bottom:10px;">
            <tr><td style="padding:16px 18px;">
              <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.75);line-height:1.7;font-style:italic;">
                "I was on free for two months thinking I'd upgrade 'later.' The week I finally upgraded I got my first 100K view Reel using the AI video + script combo. I should have done it on day one."
              </p>
              <p style="margin:8px 0 0;font-size:12px;color:rgba(255,255,255,0.35);">— Marcus T., now on Pro</p>
            </td></tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(122,59,255,0.07);border-left:3px solid rgba(168,85,247,0.5);border-radius:0 12px 12px 0;margin-bottom:28px;">
            <tr><td style="padding:16px 18px;">
              <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.75);line-height:1.7;font-style:italic;">
                "I cancel tools that don't pay for themselves. Zyvo paid for itself in the first week — one product image campaign alone brought in more than the monthly cost."
              </p>
              <p style="margin:8px 0 0;font-size:12px;color:rgba(255,255,255,0.35);">— Priya S., e-commerce brand on Pro</p>
            </td></tr>
          </table>

          <!-- CTA -->
          <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;width:100%;">
            <tr>
              <td style="border-radius:14px;background:linear-gradient(135deg,#7A3BFF,#9d4eff);box-shadow:0 8px 32px rgba(122,59,255,0.5);">
                <a href="https://tryzyvo.com/workspace/pricing"
                   style="display:block;text-align:center;padding:18px 32px;font-size:18px;font-weight:800;color:#fff;text-decoration:none;letter-spacing:-0.3px;">
                  Upgrade to Pro — 25% off →
                </a>
              </td>
            </tr>
          </table>

          <p style="margin:0 0 26px;text-align:center;font-size:12px;color:rgba(255,255,255,0.25);">
            €25/mo this week only · Cancel anytime · Instant access
          </p>

          <hr style="border:none;border-top:1px solid rgba(255,255,255,0.07);margin:0 0 20px;"/>

          <p style="margin:0 0 6px;font-size:14px;line-height:1.8;color:rgba(255,255,255,0.55);">
            <strong style="color:rgba(255,255,255,0.8);">P.S.</strong> — This 25% discount is genuinely time-limited. I'm not going to keep re-sending this. If you've been thinking about it, now is the time.
          </p>

          <p style="margin:16px 0 0;font-size:13px;color:rgba(255,255,255,0.3);">— Niko, Zyvo</p>

        </td></tr>

        <!-- footer -->
        <tr><td style="padding:20px 32px 28px;border-top:1px solid rgba(255,255,255,0.06);">
          <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.25);line-height:1.7;">
            You created a free Zyvo account — that's why you're hearing from us.<br/>
            <a href="https://tryzyvo.com/settings" style="color:rgba(255,255,255,0.35);text-decoration:underline;">Unsubscribe</a>
            &nbsp;·&nbsp;
            <a href="https://tryzyvo.com" style="color:rgba(255,255,255,0.35);text-decoration:underline;">tryzyvo.com</a>
          </p>
        </td></tr>

      </table>

    </td></tr>
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
      subject: "you signed up but never upgraded — Pro is on sale right now",
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
    console.log(`   dry_run=${DRY_RUN}  target=plan_code:free (all free users)`);

    let allUsers = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from("profiles")
        .select("email")
        .eq("plan_code", "free")
        .not("email", "is", null)
        .range(from, from + BATCH_SIZE - 1);

      if (error) {
        console.error("❌ Supabase fetch error:", error);
        return res.status(500).json({ error: "Failed to fetch users" });
      }

      if (data?.length) {
        allUsers.push(...data);
      }

      hasMore = !!data && data.length === BATCH_SIZE;
      from += BATCH_SIZE;
    }

    console.log(`📊 Total free users to email: ${allUsers.length}`);

    let sent = 0, failed = 0, skipped = 0;

    for (const user of allUsers) {
      if (!user.email) { skipped++; continue; }

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
            last_email_type: "free_conversion_wake_up",
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
