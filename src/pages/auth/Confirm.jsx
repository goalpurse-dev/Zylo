// /auth/confirm?token_hash=…&type=… — where the links in Zyvo's auth emails
// land (Supabase → Authentication → Emails → Templates point here, so the link
// in the email is a tryzyvo.com address). The link is checked with Supabase,
// which signs the browser in; a reset link then goes on to "set a new password".
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { authError } from "../../lib/authErrors";
import { isRememberedRecoveryLink, rememberRecoveryLink, verifyEmailLink } from "../../lib/recoveryLink";
import AuthPage from "../../components/auth/AuthPage.jsx";
import ForgotPassword from "../../components/auth/ForgotPassword.jsx";

// The link types Supabase emails (the `type` in the template's link).
const LINK_TYPES = new Set(["recovery", "email_change", "magiclink", "email", "signup", "invite"]);

const primary = "block w-full py-[11px] rounded-xl bg-gradient-to-r from-[#7A3BFF] to-[#9F5CFF] text-white text-center font-semibold text-sm hover:opacity-90 transition";

export default function Confirm() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const tokenHash = params.get("token_hash") ?? "";
  const type = params.get("type") ?? "";
  const valid = Boolean(tokenHash) && LINK_TYPES.has(type);
  // checking | failed | email_changed | email_change_pending
  const [stage, setStage] = useState(valid ? "checking" : "failed");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!valid) return undefined;
    let active = true;
    (async () => {
      const { data, error } = await verifyEmailLink(tokenHash, type);
      if (!active) return;

      if (error) {
        // The same reset link opened again in this browser before a password was chosen.
        if (type === "recovery" && isRememberedRecoveryLink(tokenHash)) {
          const { data: current } = await supabase.auth.getSession();
          if (!active) return;
          if (current.session) { navigate("/auth/reset", { replace: true }); return; }
        }
        setMessage(authError(error, "This link has expired or was already used.").message);
        setStage("failed");
        return;
      }

      if (type === "recovery") {
        rememberRecoveryLink(tokenHash);
        navigate("/auth/reset", { replace: true });
      } else if (type === "email_change") {
        // With "secure email change" on, Supabase asks both addresses: the first link gives no session yet.
        setStage(data?.session || data?.user ? "email_changed" : "email_change_pending");
      } else {
        navigate("/", { replace: true });
      }
    })();
    return () => { active = false; };
  }, [valid, tokenHash, type, navigate]);

  if (stage === "checking") {
    return (
      <AuthPage title="Checking your link">
        <div className="flex items-center gap-3 text-white/60 text-sm" role="status">
          <span className="w-4 h-4 border-2 border-white/25 border-t-white rounded-full animate-spin" />
          Checking your link…
        </div>
      </AuthPage>
    );
  }

  if (stage === "email_changed" || stage === "email_change_pending") {
    const done = stage === "email_changed";
    return (
      <AuthPage title={done ? "Email updated" : "One more step"}>
        <h1 className="text-white text-[20px] font-bold mb-2">{done ? "Your email is updated" : "One more step"}</h1>
        <p className="text-white/60 text-sm leading-relaxed mb-6">
          {done
            ? "From now on you sign in to Zyvo with your new email address."
            : "Thanks. We also sent a link to your other email address. Open that one too and the change is complete."}
        </p>
        <a href="/" className={primary}>Continue to Zyvo</a>
      </AuthPage>
    );
  }

  // failed
  if (type === "recovery" || !valid) {
    return (
      <AuthPage title="Reset your password">
        <ForgotPassword
          notice={valid ? "That reset link has expired or was already used. Enter your email and we'll send a new one." : "That link isn't complete. Enter your email and we'll send a new reset link."}
          onBack={() => navigate("/login")}
        />
      </AuthPage>
    );
  }
  return (
    <AuthPage title="Link expired">
      <h1 className="text-white text-[20px] font-bold mb-2">This link no longer works</h1>
      <p className="text-white/60 text-sm leading-relaxed mb-6">{message || "This link has expired or was already used."} Start again from Zyvo and we'll send you a fresh one.</p>
      <a href="/" className={primary}>Back to Zyvo</a>
    </AuthPage>
  );
}
