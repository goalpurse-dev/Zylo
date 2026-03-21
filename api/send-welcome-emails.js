import dotenv from "dotenv";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function welcomeEmailHtml(user) {
  return `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:20px;color:#111;line-height:1.6;">
    
    <p>Hey ${user.email.split("@")[0]},</p>

    <p>Welcome to <strong>Zyvo</strong> — one of the most viral AI content tools right now.</p>

    <p>You’ve got <strong>3 free image generations</strong> ready to go.</p>

    <p>Most people use Zyvo to create content that actually gets attention — not just random AI images.</p>

    <p>Start here:</p>

    <p>
      <a href="https://tryzyvo.com/workspace/home">
        Open Zyvo
      </a>
    </p>

    <p>If anything feels confusing or doesn’t work, just reply — I read everything.</p>

    <p>— Niko</p>

  </div>
  `;
}

async function sendWelcomeEmail(user) {
  const { error } = await resend.emails.send({
    from: "Niko from Zyvo <niko@tryzyvo.com>",
    to: user.email,
    subject: "you’re in",
    html: welcomeEmailHtml(user),
    reply_to: "niko@tryzyvo.com",
  });

  if (error) {
    console.error("❌ Email error:", user.email, error);
    return;
  }

  await supabase
    .from("profiles")
    .update({ welcome_email_sent: true })
    .eq("id", user.id);

  console.log("✅ Sent welcome:", user.email);
}

async function main() {
  const cutoffDate = new Date("2026-03-19T23:59:59Z").toISOString();

  const { data: users, error } = await supabase
    .from("profiles")
    .select("*")
    .lte("created_at", cutoffDate)
    .eq("welcome_email_sent", false)
    .eq("email_updates", true)
    .limit(400); // 🔥 ONLY FIRST 400

  if (error) {
    console.error("❌ Fetch error:", error);
    return;
  }

  console.log(`🔥 Sending to ${users.length} users (batch 1)`);

  let count = 0;

  for (const user of users) {
    await sendWelcomeEmail(user);
    count++;

    console.log(`📤 Progress: ${count}/${users.length}`);

    // 🔥 2–3 sec delay (randomized = even safer)
    const delay = 2000 + Math.random() * 1000;
    await new Promise((r) => setTimeout(r, delay));
  }

  console.log("🚀 Batch 1 done (0–400)");
}

main();