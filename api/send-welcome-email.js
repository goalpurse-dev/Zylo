import { Resend } from "resend";
import { welcomeEmail } from "../src/lib/emails/welcomeEmail.js";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// The welcome email of the signed-in user, once per account.
// The caller proves who they are with their Supabase session token
// (Authorization: Bearer <access token>); the email goes to THAT account's own
// address. Nothing in the request body is read: no address, no user id, so
// this endpoint cannot be used to send mail to anyone else.
export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // ✅ 1. WHO IS ASKING: the session token, checked by Supabase Auth
    const token = String(req.headers?.authorization || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return res.status(401).json({ error: "Not signed in" });
    }
    const { data: auth, error: authError } = await supabase.auth.getUser(token);
    const user = auth?.user;
    if (authError || !user?.id || !user.email) {
      return res.status(401).json({ error: "Not signed in" });
    }

    // ✅ 2. PREVENT DUPLICATES: only the request that flips the flag sends
    const { data: claimed, error: claimError } = await supabase
      .from("profiles")
      .update({ welcome_email_sent: true })
      .eq("id", user.id)
      .eq("welcome_email_sent", false)
      .select("id");
    if (claimError) throw claimError;

    if (!claimed?.length) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();
      if (!profile) {
        console.log("Profile not ready yet");
        return res.status(200).json({ retry: true });
      }
      return res.status(200).json({ already_sent: true });
    }

    // ✅ 3. SEND TO THE ACCOUNT'S OWN ADDRESS + CHECK RESULT
    const { error } = await resend.emails.send(
      welcomeEmail(user.email)
    );

    if (error) {
      console.error("Email failed:", error);
      // Not sent: give the flag back so a later attempt can send it.
      await supabase
        .from("profiles")
        .update({ welcome_email_sent: false })
        .eq("id", user.id);
      return res.status(500).json({ error: "Email failed" });
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to send email" });
  }
}
