// src/pages/Contact.jsx
import React, { useState } from "react";
import DownFooter from "../components/DownFooter";

export default function Contact() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ email: "", topic: "", message: "" });

  function onChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  function onSubmit(e) {
    e.preventDefault();
    // TODO: send to backend/email service
    setSent(true);
  }

  if (sent) {
    return (
      <section className="max-w-xl mx-auto px-6 py-14 text-center">
        <h1 className="text-2xl font-bold text-black">Thanks for reaching out! 🎉</h1>
        <p className="mt-2 text-black/70">
          Our team will contact you soon at <span className="font-medium">{form.email}</span>.
        </p>
      </section>
    );
  }

  return (
    <section className="max-w-xl mx-auto px-6 py-14">
      <h1 className="text-3xl font-extrabold text-black mb-6">Contact us</h1>

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-black">Email</span>
          <input
            type="email"
            name="email"
            required
            value={form.email}
            onChange={onChange}
            className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="you@example.com"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-black">Topic</span>
          <input
            type="text"
            name="topic"
            required
            value={form.topic}
            onChange={onChange}
            className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="What’s this about?"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-black">Description</span>
          <textarea
            name="message"
            required
            rows={5}
            value={form.message}
            onChange={onChange}
            className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Tell us a bit more…"
          />
        </label>
      <DownFooter />
        <button
          type="submit"
          className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-3 hover:opacity-95"
        >
          Send
        </button>
      </form>
    </section>
          
  );
}
