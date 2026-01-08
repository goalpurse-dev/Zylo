// supabase/functions/contact-email/index.ts
// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import nodemailer from "npm:nodemailer@6";

function cors(req: Request) {
  const origin = req.headers.get("Origin") ?? "*";
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers":
      "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
    "access-control-allow-credentials": "true",
    vary: "Origin",
  };
}

export const handler = async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(req) });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { ...cors(req), "content-type": "application/json" },
    });
  }

  const SMTP_HOST = Deno.env.get("SMTP_HOST") || "smtp.gmail.com";
  const SMTP_PORT = Number(Deno.env.get("SMTP_PORT") || 465);
  const SMTP_USER = Deno.env.get("SMTP_USER");
  const SMTP_PASS = Deno.env.get("SMTP_PASS");
  const CONTACT_TO_EMAIL = Deno.env.get("CONTACT_TO_EMAIL") || SMTP_USER;
  const SMTP_FROM = Deno.env.get("SMTP_FROM") || `Zylo Support <${SMTP_USER}>`;

  if (!SMTP_USER || !SMTP_PASS) {
    return new Response(JSON.stringify({ error: "SMTP config missing" }), {
      status: 500,
      headers: { ...cors(req), "content-type": "application/json" },
    });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch (_) {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...cors(req), "content-type": "application/json" },
    });
  }

  const { name, email, company, subject, message } = body;

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465, // true for Gmail 465
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    // Verify credentials / connection first (surfacing the real error)
    await transporter.verify();

    await transporter.sendMail({
      from: SMTP_FROM,
      to: CONTACT_TO_EMAIL,
      replyTo: email,
      subject: `Contact: ${subject || "New message"}`,
      html: `
        <h3>New contact message</h3>
        <p><b>Name:</b> ${name}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Company:</b> ${company || "-"}</p>
        <p><b>Subject:</b> ${subject || "-"}</p>
        <pre>${(message || "").toString()}</pre>
      `,
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...cors(req), "content-type": "application/json" },
    });
  } catch (e) {
    // Return detailed error for quick debugging
    const err = e as any;
    const payload = {
      error: "email_error",
      name: err?.name,
      code: err?.code,
      command: err?.command,
      response: err?.response,
      message: String(err),
    };
    console.error("contact-email error:", payload);
    return new Response(JSON.stringify(payload), {
      status: 500,
      headers: { ...cors(req), "content-type": "application/json" },
    });
  }
};

Deno.serve(handler);
