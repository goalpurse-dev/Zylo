// src/pages/settings/Settings.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  User,
  CreditCard,
  Bell,
  Shield,
  Info,
  LogOut,
  UploadCloud,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import Billing from "./Billing";

const tabs = [
  { id: "account", label: "Account", icon: User },
  { id: "billing", label: "Billing & plans", icon: CreditCard },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "privacy", label: "Privacy & security", icon: Shield },
  { id: "about", label: "About", icon: Info },
];

const card =
  "rounded-2xl border border-white/10 bg-[#111] p-5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]";

/* ===================== ROOT ===================== */
export default function Settings() {

  useEffect(() => {
  document.title = "Manage Account And Preferences";
}, []);



  const [active, setActive] = useState("account");
  const [loggingOut, setLoggingOut] = useState(false);
  const nav = useNavigate();

  useEffect(() => setActive("account"), []);

  async function handleLogout() {
    try {
      setLoggingOut(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      nav("/home", { replace: true });
    } catch (e) {
      console.error("Logout failed:", e);
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0b0f14] text-white font-sans">
      <div className="mx-auto max-w-6xl px-4 py-8 flex gap-6">
        {/* LEFT MENU (desktop) */}
        <aside className="hidden md:block w-[240px] shrink-0">
          <nav className="space-y-2">
            {tabs.map(({ id, label, icon: Icon }) => {
              const isActive = active === id;
              return (
                <button
                  key={id}
                  onClick={() => setActive(id)}
                  className={[
                    "w-full flex items-center gap-2 rounded-xl px-3 py-2 text-[15px] font-bold",
                    "border border-white/10 transition",
                    isActive
                      ? "bg-white/10 text-white"
                      : "bg-transparent text-white/90 hover:bg-white/5",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4 opacity-95" />
                  {label}
                </button>
              );
            })}

            {/* logout at the bottom of the list */}
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="mt-2 w-full flex items-center gap-2 rounded-xl px-3 py-2 text-sm border border-red-900/40 bg-red-900/30 text-red-200 hover:bg-red-900/40 disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" />
              {loggingOut ? "Logging out…" : "Log out"}
            </button>
          </nav>
        </aside>

        {/* CONTENT */}
        <section className="flex-1">
          {/* TOP SELECTORS (mobile/tablet) */}
          <div className="md:hidden mb-4 grid grid-cols-2 gap-2">
            {tabs.map(({ id, label, icon: Icon }) => {
              const isActive = active === id;
              return (
                <button
                  key={id}
                  onClick={() => setActive(id)}
                  className={[
                    "flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-[14px] font-extrabold",
                    "border border-white/10 transition",
                    isActive
                      ? "bg-white/10"
                      : "bg-transparent text-white/90 hover:bg-white/5",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4 opacity-95" />
                  {label}
                </button>
              );
            })}
          </div>

          {/* PANELS */}
          {active === "account" && <AccountPanel />}
          {active === "billing" && <Billing />}
          {active === "notifications" && <NotificationsPanel />}
          {active === "privacy" && <PrivacyPanel />}
          {active === "about" && <AboutPanel />}
        </section>
      </div>
    </div>
  );
}

/* ===================== PANELS ===================== */

function AccountPanel() {
  // Prefill from Supabase user
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");

  // Save status
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState("");
  const [nameErr, setNameErr] = useState("");

  // Change password local state
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data?.user) {
        const u = data.user;
        setEmail(u.email ?? "");
        setDisplayName(
          u.user_metadata?.display_name ??
            u.user_metadata?.full_name ??
            u.user_metadata?.name ??
            ""
        );
      }
    })();
  }, []);

  async function handleSaveName() {
    setNameErr("");
    setNameMsg("");
    setSavingName(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { display_name: displayName, full_name: displayName, name: displayName },
      });
      if (error) throw error;
      setNameMsg("Profile updated.");
    } catch (e) {
      setNameErr(e.message || "Could not save profile.");
    } finally {
      setSavingName(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPwErr("");
    setPwMsg("");

    if (pw1.length < 6) return setPwErr("Password must be at least 6 characters.");
    if (pw1 !== pw2) return setPwErr("Passwords do not match.");

    setSavingPw(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw1 });
      if (error) throw error;
      setPwMsg("Password updated.");
      setPw1(""); setPw2("");
    } catch (err) {
      setPwErr(err.message || "Could not update password.");
    } finally {
      setSavingPw(false);
    }
  }

  function handleDeleteAccount() {
    // TODO: implement a real delete flow (confirm + Edge Function).
    alert("Delete account flow coming soon.");
  }

  return (
    <div className="grid gap-4">
      <div className={card}>
        <div className="mb-4">
          <h2 className="text-lg font-black tracking-tight">Account</h2>
          <p className="text-xs text-white/60">Manage your profile and login details.</p>
        </div>

        {/* avatar */}
        <div className="mb-6 flex flex-col items-center">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white/5 text-xs text-white/60">
            IMG
          </div>
          <button className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15">
            <UploadCloud className="h-4 w-4" />
            Upload avatar
          </button>
        </div>

        {/* display name */}
        <label className="mb-1 block text-[11px] font-semibold tracking-wide text-white/60">Display name</label>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="mb-4 w-full rounded-xl border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/30"
        />

        {/* email (read-only) */}
        <label className="mb-1 block text-[11px] font-semibold tracking-wide text-white/60">Email</label>
        <input
          value={email}
          readOnly
          className="mb-4 w-full cursor-not-allowed rounded-xl border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-white/80"
        />

        <div className="flex flex-wrap items-center gap-2 mb-6">
          <button
            onClick={handleSaveName}
            disabled={savingName}
            className="rounded-xl bg-gradient-to-r from-[#7A3BFF] via-[#9B4DFF] to-[#FF57B2] px-4 py-2 text-sm font-extrabold text-white hover:opacity-95 disabled:opacity-60"
          >
            {savingName ? "Saving…" : "Save changes"}
          </button>
          <button
            onClick={() => { setNameErr(""); setNameMsg(""); }}
            className="rounded-xl border border-white/10 bg-white/10 px-3 py-1.5 text-sm font-bold text-white hover:bg-white/15"
          >
            Reset
          </button>
        </div>
        {nameErr && <div className="mb-4 text-xs text-red-400">{nameErr}</div>}
        {nameMsg && <div className="mb-4 text-xs text-green-400">{nameMsg}</div>}

        {/* change password */}
        <div className="mt-2 rounded-xl border border-white/10 bg-[#0b0f14] p-3">
          <div className="mb-2 text-sm font-extrabold">Change password</div>
          <form onSubmit={handleChangePassword} className="space-y-2">
            <input
              type="password"
              placeholder="New password (min 6 chars)"
              value={pw1}
              onChange={(e) => setPw1(e.target.value)}
              minLength={6}
              required
              className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/30"
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              minLength={6}
              required
              className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/30"
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={savingPw}
                className="rounded-xl bg-gradient-to-r from-[#7A3BFF] via-[#9B4DFF] to-[#FF57B2] px-4 py-2 text-sm font-extrabold text-white hover:opacity-95 disabled:opacity-60"
              >
                {savingPw ? "Updating…" : "Update password"}
              </button>
            </div>
            {pwErr && <p className="text-xs text-red-400">{pwErr}</p>}
            {pwMsg && <p className="text-xs text-green-400">{pwMsg}</p>}
          </form>
        </div>
      </div>

      {/* Danger zone moved here */}
      <div className={card}>
        <div className="mb-2 text-sm font-extrabold text-red-400">Danger zone</div>
        <button
          onClick={handleDeleteAccount}
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-extrabold text-red-300 hover:bg-red-500/15"
        >
          Delete account
        </button>
      </div>
    </div>
  );
}

function NotificationsPanel() {
  const [email, setEmail] = useState({
    product: true,
    mentions: true,
    marketing: false,
    security: true,
  });

  return (
    <div className="grid gap-4">
      {/* Email notifications */}
      <div className={card}>
        <div className="mb-3 text-sm font-extrabold">Email</div>
        <ToggleRow
          label="Product updates"
          value={email.product}
          onChange={(v) => setEmail((s) => ({ ...s, product: v }))}
        />
        <ToggleRow
          label="Mentions & replies"
          value={email.mentions}
          onChange={(v) => setEmail((s) => ({ ...s, mentions: v }))}
        />
        <ToggleRow
          label="Marketing"
          value={email.marketing}
          onChange={(v) => setEmail((s) => ({ ...s, marketing: v }))}
        />
        <ToggleRow
          label="Security alerts"
          value={email.security}
          onChange={(v) => setEmail((s) => ({ ...s, security: v }))}
        />
      </div>

      {/* Push notifications */}
      <div className={card}>
        <div className="mb-3 text-sm font-extrabold">Push</div>
        <EmptyRow text="Coming soon." />
      </div>
    </div>
  );
}

function PrivacyPanel() {
  const link =
    "inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-extrabold " +
    "text-blue-300/95 hover:text-white bg-blue-500/10 hover:bg-blue-500/15 " +
    "ring-1 ring-inset ring-blue-400/25 transition";

  return (
    <div className="grid gap-4">
      <div className={card}>
        <div className="mb-2 text-sm font-extrabold">Privacy</div>
        <p className="mb-3 text-sm text-white/70">
          Learn how we handle your data, retention, and user controls.
        </p>
        <a href="/blog/privacy" className={link}>
          Read our Privacy practices →
        </a>
      </div>

      <div className={card}>
        <div className="mb-2 text-sm font-extrabold">Security</div>
        <p className="mb-3 text-sm text-white/70">
          Overview of our security model, storage, and operational safeguards.
        </p>
        <a href="/blog/security" className={link}>
          Read our Security overview →
        </a>
      </div>
    </div>
  );
}

function AboutPanel() {
  return (
    <div className="grid gap-4">
      <div className={card}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-[11px] uppercase text-white/60">App</div>
            <div className="text-lg font-black tracking-tight">ZyloAI Studio</div>
            <div className="text-sm text-white/60">Version 1.0.0</div>
          </div>
          <div className="grid gap-2">
            <Badge>Beat-synced edits</Badge>
            <Badge>Brand Kit ready</Badge>
            <Badge>No watermark on paid</Badge>
          </div>
        </div>
      </div>

      <div className={card}>
        <div className="text-sm">© {new Date().getFullYear()} ZyloAI. All rights reserved.</div>
      </div>
    </div>
  );
}

/* ===================== SMALL PIECES ===================== */

function ToggleRow({ label, value, onChange }) {
  return (
    <div className="mb-2 flex items-center justify-between rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
      <div className="text-sm font-bold">{label}</div>
      <button
        onClick={() => onChange(!value)}
        className={[
          "relative h-6 w-11 rounded-full transition",
          value ? "bg-blue-600" : "bg-white/15",
        ].join(" ")}
        aria-pressed={value}
      >
        <span
          className={[
            "absolute top-0.5 h-5 w-5 rounded-full bg-white transition",
            value ? "left-6" : "left-0.5",
          ].join(" ")}
        />
      </button>
    </div>
  );
}

function Badge({ children }) {
  return (
    <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs ring-1 ring-white/10 font-bold">
      {children}
    </span>
  );
}

function EmptyRow({ text }) {
  return (
    <div className="rounded-xl bg-white/5 p-4 text-sm text-white/70 ring-1 ring-white/10">
      {text}
    </div>
  );
}
