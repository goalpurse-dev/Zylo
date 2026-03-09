import { Resend } from "resend";

const resend = new Resend("re_K4JvgbzX_48iw2GLMc9nBDP3gFNigyGP6");

async function send() {
  const { data, error } = await resend.emails.send({
    from: "Zyvo Support <support@tryzyvo.com>",
    to: ["hillaryscott684@gmail.com"],
    subject: "Your Zyvo Subscription Is Active",
    html: `
      <h2>Welcome to Zyvo 🚀</h2>
      <p>Your subscription has been successfully activated.</p>

      <p>Please create or log in to your account using the same email:</p>

      <a href="https://tryzyvo.com/signup">
      https://tryzyvo.com/signup
      </a>

      <p>If you need help just reply to this email.</p>

      <p>— Zyvo Support</p>
    `,
  });

  if (error) {
    console.error(error);
  } else {
    console.log("Email sent:", data);
  }
}

send();