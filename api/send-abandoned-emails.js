import dotenv from "dotenv";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function emailOneHtml(user) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#111;">
      <p>Hey,</p>

      <p>You were <b>1 step away</b> from unlocking Zyvo.</p>

      <p>Most people never finish this part — but the ones who do start creating content <b>10x faster</b>.</p>

      <p>Right now you can generate:</p>
      <ul>
        <li>🔥 viral TikTok videos</li>
        <li>🔥 high-end product photos</li>
        <li>🔥 cinematic AI visuals</li>
      </ul>

      <p style="font-size:13px;color:#666;">Secure checkout powered by Stripe</p>

      <p>
        <a href="https://tryzyvo.com/workspace/pricing"
        style="background:#7A3BFF;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;display:inline-block;">
        Continue on Zyvo →
        </a>
      </p>

      ${
        user.checkout_url
          ? `<p style="margin-top:10px;">
              <a href="${user.checkout_url}" style="font-size:12px;color:#666;">
                Or complete instantly
              </a>
            </p>`
          : ""
      }

      <p>— Niko<br/>Zyvo</p>
    </div>
  `;
}

function emailTwoHtml(user) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#111;">
      <p>Hey,</p>

      <p>Quick truth:</p>

      <p>Most people sign up… but never actually use tools like Zyvo properly.</p>

      <p>The few who do?</p>

      <p><b>They post more, test faster, and grow faster.</b></p>

      <p>You already did the hard part — you just didn’t finish.</p>

      <p style="font-size:13px;color:#666;">Secure checkout powered by Stripe</p>

      <p>
        <a href="https://tryzyvo.com/workspace/pricing"
        style="background:#7A3BFF;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;display:inline-block;">
        Finish setup →
        </a>
      </p>

      ${
        user.checkout_url
          ? `<p style="margin-top:10px;">
              <a href="${user.checkout_url}" style="font-size:12px;color:#666;">
                Skip and complete instantly
              </a>
            </p>`
          : ""
      }

      <p>Don’t leave it half done.</p>

      <p>— Niko</p>
    </div>
  `;
}

function emailThreeHtml(user) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#111;">
      <p>Hey,</p>

      <p>I’ll keep this short.</p>

      <p>This is the last reminder about your Zyvo setup.</p>

      <p>If you still want to create content faster and test ideas quickly — now’s your chance.</p>

      <p style="font-size:13px;color:#666;">Secure checkout powered by Stripe</p>

      <p>
        <a href="https://tryzyvo.com/workspace/pricing"
        style="background:#7A3BFF;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;display:inline-block;">
        Continue →
        </a>
      </p>

      ${
        user.checkout_url
          ? `<p style="margin-top:10px;">
              <a href="${user.checkout_url}" style="font-size:12px;color:#666;">
                Complete instantly
              </a>
            </p>`
          : ""
      }

      <p>If not, no worries — I won’t send anything else 👍</p>

      <p>— Niko</p>
    </div>
  `;
}

async function sendStageEmail(user) {
  let subject = "";
  let html = "";

  if (user.recovery_stage === 0) {
    subject = "you were 1 step away";
    html = emailOneHtml(user);
  }
  else if (user.recovery_stage === 1) {
    subject = "most people miss this";
    html = emailTwoHtml(user);
  }
  else if (user.recovery_stage === 2) {
    subject = "last call";
    html = emailThreeHtml(user);
  }

  if (!html) return;

  const { error } = await resend.emails.send({
    from: "Zyvo <support@tryzyvo.com>",
    to: user.email,
    subject,
    html,
  });

  if (error) {
    console.error("Resend error:", user.email, error);
    return;
  }

  const { error: updateError } = await supabase
    .from("abandoned_checkouts")
    .update({
      recovery_stage: user.recovery_stage + 1,
      last_email_sent_at: new Date().toISOString(),
      status: user.recovery_stage + 1 >= 3 ? "finished" : "in_sequence",
    })
    .eq("id", user.id);

  if (updateError) {
    console.error("Supabase update error:", user.email, updateError);
  } else {
    console.log(`Sent stage ${user.recovery_stage + 1} to ${user.email}`);
  }
}

export default async function handler(req, res) {
  try {
    const { data: users, error } = await supabase
      .from("abandoned_checkouts")
      .select("*")
      .eq("paid", false)
      .in("status", ["pending", "in_sequence"])
      .lt("recovery_stage", 3);

    if (error) {
      console.error(error);
      return res.status(500).json({ error: "Failed to fetch users" });
    }

    const now = Date.now();

    for (const user of users) {
      const createdAt = new Date(user.created_at).getTime();
      const lastSent = user.last_email_sent_at
        ? new Date(user.last_email_sent_at).getTime()
        : null;

      const shouldSendStage1 =
        user.recovery_stage === 0 &&
        now - createdAt >= 30 * 60 * 1000

      const shouldSendStage2 =
        user.recovery_stage === 1 &&
        lastSent &&
        now - lastSent >= 24 * 60 * 60 * 1000;

      const shouldSendStage3 =
        user.recovery_stage === 2 &&
        lastSent &&
        now - lastSent >= 48 * 60 * 60 * 1000;

      if (shouldSendStage1 || shouldSendStage2 || shouldSendStage3) {
        await sendStageEmail(user);
        await new Promise((r) => setTimeout(r, 1200));
      }
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("send-abandoned-emails error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}