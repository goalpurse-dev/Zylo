import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

async function run() {

  const { data: users } = await supabase
    .from("profiles")
    .select("email");

  for (const user of users) {

    console.log("Sending to:", user.email);

   const result = await resend.emails.send({
      from: "Zyvo <hello@tryzyvo.com>",
      to: user.email,
      subject: "Welcome to Zyvo 🚀",
      html: `
        <div style="font-family:Arial, sans-serif; max-width:600px; margin:auto;">
          
          <h2>Welcome to Zyvo</h2>

          <p>
          Zyvo keeps expanding and growing. 
          You can now generate AI images directly inside the platform.
          </p>

          <p>
          Start creating images for free and explore the possibilities.
          Upgrade anytime to unlock more generations and advanced models.
          </p>

          <div style="margin:30px 0;">
            <a 
              href="https://tryzyvo.com/workspace/image-generator"
              style="
                background:#6d28d9;
                color:white;
                padding:12px 22px;
                text-decoration:none;
                border-radius:8px;
                font-weight:bold;
                display:inline-block;
              "
            >
              Generate Images
            </a>
          </div>

          <p style="font-size:12px;color:#666;">
          Thank you for being an early Zyvo user.
          </p>

        </div>
      `
    });

    console.log("Resend response:", result);

    await new Promise(r => setTimeout(r, 1500));
  }

 
}

run();