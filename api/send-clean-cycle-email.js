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
  const name = user.email?.split("@")[0] || "there";

  return `
  <div style="font-family:Arial;max-width:520px;margin:auto;padding:20px;">
    <p>Hey ${name},</p>

    <p>Quick one —</p>

    <p>You already have the tools to start getting real results with Zyvo.</p>

    <p>The biggest difference we see between creators who win and those who don’t:</p>

    <p><strong>they simply generate more.</strong></p>

    <p>More ideas → more tests → more wins.</p>

    <p>Right now the Pro plan is <strong>25% off</strong>.</p>

    <p><a href="https://tryzyvo.com/workspace/pricing">Upgrade here →</a></p>

    <p>— Zyvo</p>
  </div>
  `;
}

async function sendEmail(user) {
  let sendError = null;

  for (let i = 1; i <= 2; i++) {
    const { error } = await resend.emails.send({
      from: "Zyvo <niko@tryzyvo.com>",
      to: user.email,
      subject: "you’re sitting on something",
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