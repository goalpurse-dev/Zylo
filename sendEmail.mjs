import { Resend } from "resend";

const resend = new Resend("re_K4JvgbzX_48iw2GLMc9nBDP3gFNigyGP6");

// read emails from terminal
const arg = process.argv.find((a) => a.startsWith("to="));
const emails = arg ? arg.replace("to=", "").split(",") : [];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function send() {

  if (emails.length === 0) {
    console.log("No emails provided. Use:");
    console.log("node sendemail.mjs to=email1,email2,email3");
    return;
  }

  console.log(`Sending ${emails.length} emails...\n`);

  for (const email of emails) {

    const { data, error } = await resend.emails.send({
      from: "Zyvo <updates@tryzyvo.com>",
      to: email,
      subject: "🚨 Zyvo Pro just dropped to $11.99",
      html: `
      <div style="font-family:Arial;max-width:600px;margin:auto">

      <h1>🚨 Zyvo Pro Price Drop</h1>

      <p>We just made Zyvo <b>much more accessible</b>.</p>

      <p><b>Zyvo Pro is now only $11.99/month.</b></p>

      <h3>What you get:</h3>

      <ul>
      <li>600 credits / month</li>
      <li>AI Image Generator</li>
      <li>AI Video Generator</li>
      <li>≈ 200 AI images / month</li>
      <li>≈ 30 AI videos / month</li>
      <li>Watermark-free exports</li>
      <li>Private creation library</li>
      <li>Standard generation speed</li>
      <li>Email support</li>
      <li>30 generations / day</li>
      </ul>

      <div style="text-align:center;margin-top:30px">
      <a href="https://tryzyvo.com/workspace/pricing"
      style="background:#7A3BFF;color:white;padding:14px 26px;
      text-decoration:none;border-radius:8px;font-weight:bold">
      Upgrade to Zyvo Pro
      </a>
      </div>

      <p style="margin-top:30px;color:#666">
      You're receiving this because you enabled product updates.
      </p>

      <p style="color:#666">— Zyvo Team 🚀</p>

      </div>
      `,
    });

    if (error) {
      console.error(`❌ Failed: ${email}`, error);
    } else {
      console.log(`✅ Sent to: ${email}`);
    }

    await delay(800); // prevents spam burst
  }

  console.log("\nAll emails processed 🚀");
}

send();