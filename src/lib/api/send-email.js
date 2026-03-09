import { Resend } from "resend";

const resend = new Resend(import.meta.env.VITE_RESEND_API_KEY);

export async function sendSupportEmail() {
  try {
    const { data, error } = await resend.emails.send({
      from: "Zyvo Support <support@tryzyvo.com>",
      to: ["hillaryscott684@gmail.com"],
      subject: "Your Zyvo Subscription Is Active",
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:auto">
        
        <h2 style="color:#7A3BFF;">Welcome to Zyvo 🚀</h2>

        <p>Hello,</p>

        <p>
        Thank you for subscribing to <strong>Zyvo</strong>.
        Your subscription has been successfully activated.
        </p>

        <p>
        To access your dashboard and start generating AI images and videos,
        please create or log in to your account using the same email address you used for payment.
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
          Access Your Zyvo Account
          </a>
        </p>

        <p>
        Once logged in, your subscription will automatically activate.
        </p>

        <p>
        If you have any questions or need assistance, simply reply to this email
        and our support team will be happy to help.
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