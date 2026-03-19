import { Resend } from "resend";
import { welcomeEmail } from "../src/lib/emails/welcomeEmail.js";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY);

// 🔥 ADMIN CLIENT (needs service role key)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email } = req.body;

    // ✅ 1. CHECK IF ALREADY SENT
    const { data } = await supabase
      .from("profiles")
      .select("welcome_email_sent")
      .eq("email", email)
      .single();

    if (data?.welcome_email_sent) {
      return res.status(200).json({ already_sent: true });
    }

    // ✅ 2. SEND EMAIL
    await resend.emails.send(
      welcomeEmail(email)
    );

    // ✅ 3. UPDATE FLAG
    await supabase
      .from("profiles")
      .update({ welcome_email_sent: true })
      .eq("email", email);

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to send email" });
  }
}