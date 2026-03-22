import { Resend } from "resend";
import { welcomeEmail } from "../src/lib/emails/welcomeEmail.js";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email, user_id } = req.body;

    // ✅ 1. FETCH USER SAFELY
    const { data } = await supabase
      .from("profiles")
      .select("id, welcome_email_sent")
      .eq("id", user_id)
      .maybeSingle();

    if (!data) {
      console.log("Profile not ready yet");
      return res.status(200).json({ retry: true });
    }

    // ✅ 2. PREVENT DUPLICATES
    if (data.welcome_email_sent) {
      return res.status(200).json({ already_sent: true });
    }

    // ✅ 3. SEND EMAIL + CHECK RESULT
    const { error } = await resend.emails.send(
      welcomeEmail(email)
    );

    if (error) {
      console.error("Email failed:", error);
      return res.status(500).json({ error: "Email failed" });
    }

    // ✅ 4. UPDATE USING ID (SAFE)
    await supabase
      .from("profiles")
      .update({ welcome_email_sent: true })
      .eq("id", user_id);

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to send email" });
  }
}