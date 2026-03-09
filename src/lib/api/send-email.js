import { Resend } from "resend";

const resend = new Resend(import.meta.env.VITE_RESEND_API_KEY);

export async function sendSupportEmail() {
  try {
    const { data, error } = await resend.emails.send({
      from: "Zyvo Support <support@tryzyvo.com>",
      to: ["hillaryscott684@gmail.com"],
      subject: "Quick Update About Your Zyvo Credits",
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:auto">

        <h2 style="color:#7A3BFF;">Zyvo Support</h2>

        <p>Hello William,</p>

        <p>
        Thank you for subscribing to <strong>Zyvo</strong>. We can confirm that your payment and subscription were successfully processed.
        </p>

        <p>
        It appears that your account may not have received the credits automatically due to a small technical issue on our side.
        </p>

        <p>
        We are currently reviewing this and will make sure your credits are added as soon as possible.
        </p>

        <p>
        If you haven't created your Zyvo account yet, please sign up using the same email address you used for payment:
        </p>

        <p style="margin:25px 0;">
          <a href="https://tryzyvo.com/signup"
          style="
          background:#7A3BFF;
          color:white;
          padding:12px 20px;
          border-radius:6px;
          text-decoration:none;
          font-weight:bold;
          ">
          Create / Access Your Zyvo Account
          </a>
        </p>

        <p>
        Once your account is confirmed, we will ensure that your subscription and credits are correctly applied.
        </p>

        <p>
        Thank you for your patience and for supporting Zyvo.
        </p>

        <br>

        <p>
        Best regards,<br>
        <strong>Zyvo Support Team</strong><br>
        support@tryzyvo.com
        </p>

        </div>
      `,
    });

    if (error) {
      console.error("Email error:", error);
      return { success: false, error };
    }

    console.log("Email sent:", data);
    return { success: true };

  } catch (err) {
    console.error("Email send failed:", err);
    return { success: false, error: err };
  }
}