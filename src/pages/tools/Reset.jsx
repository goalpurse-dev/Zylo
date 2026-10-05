// /auth/reset — "set a new password". Reached from the link in the reset email
// (through /auth/confirm, which signs the browser in). Needs that session; with
// none, the link was old or already used and the page offers a new one.
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CheckCircle2, Eye, EyeOff } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { authError, formatCountdown } from "../../lib/authErrors";
import { forgetRecoveryLink } from "../../lib/recoveryLink";
import { useCooldown } from "../../hooks/useCooldown";
import AuthPage from "../../components/auth/AuthPage.jsx";
import ForgotPassword from "../../components/auth/ForgotPassword.jsx";

const PASSWORD_MIN = 6; // the same rule as sign-up

const input = "w-full bg-[#121314] rounded-xl px-4 py-[11px] text-white text-sm placeholder-white/20 outline-none transition focus:ring-1 focus:ring-[#9F5CFF]/60 [&:-webkit-autofill]:shadow-[0_0_0_1000px_#121314_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:white]";
const primary = "w-full py-[11px] rounded-xl bg-gradient-to-r from-[#7A3BFF] to-[#9F5CFF] text-white font-semibold text-sm hover:opacity-90 transition disabled:opacity-50";

export default function Reset() {
  const navigate = useNavigate();
  const location = useLocation();
  // checking | ready | expired | done
  const [stage, setStage] = useState(location.state?.expired ? "expired" : "checking");
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [othersSignedOut, setOthersSignedOut] = useState(false);
  const cooldown = useCooldown();

  useEffect(() => {
    if (stage !== "checking") return undefined;
    let active = true;
    // getSession waits for the client to finish reading a session out of the
    // address bar (links from the older email template arrive that way).
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setAccount(data.session?.user?.email ?? "");
      setStage(data.session ? "ready" : "expired");
    });
    return () => { active = false; };
  }, [stage]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password.length < PASSWORD_MIN) { setError(`Use at least ${PASSWORD_MIN} characters.`); return; }
    if (password !== confirm) { setError("The two passwords don't match."); return; }

    setSaving(true);
    const { error: failed } = await supabase.auth.updateUser({ password });
    if (failed) {
      setSaving(false);
      const problem = authError(failed, "Couldn't update your password. Try again.");
      if (problem.rateLimited) cooldown.start(problem.waitSeconds);
      else if (failed.code === "session_not_found" || /session missing/i.test(failed.message ?? "")) setStage("expired");
      else setError(problem.message);
      return;
    }
    // A reset is also what someone does when another person may know the old
    // password: every other device is signed out, this one stays signed in.
    const { error: othersFailed } = await supabase.auth.signOut({ scope: "others" }).catch((err) => ({ error: err }));
    setOthersSignedOut(!othersFailed);
    forgetRecoveryLink();
    setSaving(false);
    setStage("done");
  }

  if (stage === "checking") {
    return (
      <AuthPage title="Set a new password">
        <div className="flex items-center gap-3 text-white/60 text-sm" role="status">
          <span className="w-4 h-4 border-2 border-white/25 border-t-white rounded-full animate-spin" />
          Checking your link…
        </div>
      </AuthPage>
    );
  }

  if (stage === "expired") {
    return (
      <AuthPage title="Reset your password">
        <ForgotPassword
          notice="That reset link has expired or was already used. Enter your email and we'll send a new one."
          onBack={() => navigate("/login")}
        />
      </AuthPage>
    );
  }

  if (stage === "done") {
    return (
      <AuthPage title="Password updated">
        <div data-testid="reset-done">
          <div className="w-11 h-11 rounded-full bg-emerald-400/15 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <h1 className="text-white text-[20px] font-bold mb-2">Your password is updated</h1>
          <p className="text-white/60 text-sm leading-relaxed mb-6">
            You're signed in{account ? <> as <span className="text-white font-medium break-all">{account}</span></> : null}. Use your new password the next time you sign in.
            {othersSignedOut ? " Your other devices were signed out." : ""}
          </p>
          <button type="button" onClick={() => navigate("/", { replace: true })} className={primary}>Continue to Zyvo</button>
        </div>
      </AuthPage>
    );
  }

  const waiting = cooldown.secondsLeft > 0;
  return (
    <AuthPage title="Set a new password">
      <form onSubmit={handleSubmit} data-testid="reset-password-form">
        <h1 className="text-white text-[20px] font-bold mb-1">Set a new password</h1>
        <p className="text-white/45 text-sm mb-6">
          {account ? <>For <span className="text-white/80 break-all">{account}</span>.</> : "Choose a new password for your Zyvo account."}
        </p>
        {/* Tells password managers which saved login to update. */}
        <input type="email" name="email" autoComplete="username" value={account} readOnly hidden />

        <label className="text-white/50 text-xs mb-1.5 block" htmlFor="new-password">New password</label>
        <div className="relative">
          <input
            id="new-password"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            autoFocus
            required
            minLength={PASSWORD_MIN}
            placeholder={`At least ${PASSWORD_MIN} characters`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${input} pr-11`}
          />
          <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/70 transition">
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <label className="text-white/50 text-xs mt-3 mb-1.5 block" htmlFor="confirm-password">Repeat new password</label>
        <input
          id="confirm-password"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN}
          placeholder="Type it once more"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={input}
        />

        {error && <p role="alert" className="text-red-400 text-xs mt-3">{error}</p>}
        {waiting && <p role="status" className="text-white/55 text-xs mt-3">Too many tries in a short time. It's nothing you did.</p>}

        <button type="submit" disabled={saving || waiting} className={`${primary} mt-5`}>
          {saving ? "Saving…" : waiting ? `Try again in ${formatCountdown(cooldown.secondsLeft)}` : "Save new password"}
        </button>
      </form>
    </AuthPage>
  );
}
