import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";

const ring = "ring-1 ring-white/10";
const card = `rounded-2xl bg-[#111] ${ring}`;

export default function SupportContact() {

  const [form, setForm] = useState({
    email: "",
    topic: "general",
    subject: "",
    message: "",
  });

  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();

      if (data?.user?.email) {
        setForm((f) => ({
          ...f,
          email: data.user.email,
        }));
      }
    };

    loadUser();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {

      const { data } = await supabase.auth.getUser();
      const user = data.user;

      const { error } = await supabase
        .from("support_tickets")
        .insert([
          {
            user_id: user?.id || null,
            email: form.email,
            topic: form.topic,
            subject: form.subject,
            message: form.message,
            status: "open",
          },
        ]);

      if (error) throw error;

      setSent(true);

    } catch (err) {
      console.error(err);
      alert("Failed to submit ticket.");
    }

    setLoading(false);
  };

  if (sent) {
    return (
      <div className="max-w-xl mx-auto text-center py-20">
        <h1 className="text-2xl font-bold">Ticket submitted 🎉</h1>
        <p className="text-white/70 mt-2">
          Our team will respond within 24 hours.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr,340px]">

      <form onSubmit={submit} className={card + " p-5 grid gap-3"}>

        <h1 className="text-xl font-extrabold">Contact support</h1>
        <p className="text-sm text-white/70">
          We typically reply within 24h on business days.
        </p>

        <label className="grid gap-1">
          <span className="text-xs text-white/60">Email</span>
          <input
            required
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            className="rounded-lg bg-[#0b0b0b] border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30"
            placeholder="you@company.com"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-xs text-white/60">Topic</span>
          <select
            value={form.topic}
            onChange={(e) => set("topic", e.target.value)}
            className="rounded-lg bg-[#0b0b0b] border border-white/10 px-3 py-2"
          >
            <option value="general">General</option>
            <option value="billing">Billing & plans</option>
            <option value="account">Account</option>
            <option value="bug">Bug / issue</option>
            <option value="feature">Feature request</option>
            <option value="policy">Policy / legal</option>
          </select>
        </label>

        <label className="grid gap-1">
          <span className="text-xs text-white/60">Subject</span>
          <input
            required
            value={form.subject}
            onChange={(e) => set("subject", e.target.value)}
            className="rounded-lg bg-[#0b0b0b] border border-white/10 px-3 py-2"
            placeholder="Short summary"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-xs text-white/60">Message</span>
          <textarea
            required
            rows={6}
            value={form.message}
            onChange={(e) => set("message", e.target.value)}
            className="rounded-lg bg-[#0b0b0b] border border-white/10 px-3 py-2"
            placeholder="Describe the issue and steps to reproduce…"
          />
        </label>

        <div className="flex gap-2">
          <button
            disabled={loading}
            className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-sm font-semibold hover:opacity-95 disabled:opacity-60"
          >
            {loading ? "Sending..." : "Submit ticket"}
          </button>

          <button
            type="button"
            onClick={() =>
              setForm({
                email: "",
                topic: "general",
                subject: "",
                message: "",
              })
            }
            className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
          >
            Reset
          </button>
        </div>

      </form>

      <aside className="grid gap-4">

        <div className={card + " p-4"}>
          <div className="text-sm font-semibold mb-1">Office hours</div>
          <div className="text-sm text-white/70">
            Mon–Fri, 9:00–18:00 (local time)
          </div>
        </div>

        <div className={card + " p-4"}>
          <div className="text-sm font-semibold mb-1">Self-service</div>
          <ul className="text-sm list-disc pl-4 text-white/70 space-y-1">
            <li><a className="underline" href="/support/article/troubleshooting">Troubleshooting</a></li>
            <li><a className="underline" href="/support/article/billing">Billing & refunds</a></li>
            <li><a className="underline" href="/support/policies">Policies</a></li>
          </ul>
        </div>

      </aside>

    </div>
  );
}