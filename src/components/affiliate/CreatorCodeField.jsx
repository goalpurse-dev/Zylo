// "Have a creator code?" on the sign-up forms (pages/Signup.jsx and AuthModal). One small row; a tap opens one
// field with the same live server check as the survey. Open and prefilled when the visitor came through a ?ref link.
// The parent saves the code with the sign-up (lib/affiliate.js saveSignupCode + signupCodeData); the credits come
// once, after the first sign-in, whichever place the code was entered.
import { useEffect, useRef, useState } from "react";
import { Check, Gift, Loader2, X } from "lucide-react";
import { AFFILIATE } from "../../../supabase/functions/_shared/affiliate/config.js";
import { cleanCode } from "../../../supabase/functions/_shared/affiliate/rules.js";
import { affiliateApi, readStoredRef } from "../../lib/affiliate";

export default function CreatorCodeField({ onChange }) {
  const ref = useRef(typeof window === "undefined" ? null : readStoredRef());
  const [open, setOpen] = useState(Boolean(ref.current));
  const [value, setValue] = useState(ref.current ?? "");
  const [check, setCheck] = useState({ state: "idle" });
  const code = cleanCode(value);
  const report = useRef(onChange);
  report.current = onChange;

  useEffect(() => {
    if (code.length < AFFILIATE.codeMinLength) { setCheck({ state: "idle" }); return undefined; }
    setCheck({ state: "checking" });
    let live = true;
    const t = setTimeout(() => {
      affiliateApi("lookup", { code })
        .then((r) => {
          if (!live) return;
          if (r?.valid) setCheck({ state: "valid", name: r.displayName });
          else setCheck({ state: r?.reason === "rate_limited" ? "limited" : r?.reason === "self" ? "self" : "invalid" });
        })
        .catch(() => { if (live) setCheck({ state: "idle" }); });
    }, 450);
    return () => { live = false; clearTimeout(t); };
  }, [code]);

  useEffect(() => { report.current?.({ code: open ? code : "", state: check.state }); }, [code, check.state, open]);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} data-testid="signup-creator-toggle"
        className="flex items-center gap-1.5 text-[13px] font-semibold text-white/55 transition hover:text-white/85">
        <Gift className="h-4 w-4 text-lime-300" aria-hidden="true" />Have a creator code?
      </button>
    );
  }

  return (
    <div data-testid="signup-creator-field">
      <div className="flex items-center justify-between">
        <label htmlFor="signup-creator-code" className="flex items-center gap-1.5 text-[13px] font-semibold text-white/70">
          <Gift className="h-4 w-4 text-lime-300" aria-hidden="true" />Creator code · {AFFILIATE.signupBonusCredits} free credits
        </label>
        <button type="button" aria-label="Remove creator code" onClick={() => { setValue(""); setOpen(false); }} className="grid h-7 w-7 place-items-center rounded-full text-white/40 hover:bg-white/10 hover:text-white/80">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className={`mt-1.5 flex items-center rounded-xl border bg-white/[0.04] transition ${check.state === "valid" ? "border-lime-300/70" : "border-white/10 focus-within:border-lime-300/50"}`}>
        <input id="signup-creator-code" value={value} onChange={(e) => setValue(e.target.value)} maxLength={40} autoComplete="off" autoCapitalize="characters" spellCheck={false}
          placeholder="e.g. MAYA" data-testid="signup-creator-input"
          className="h-11 min-w-0 flex-1 bg-transparent px-3.5 text-[15px] font-bold uppercase tracking-[0.05em] text-white outline-none placeholder:font-medium placeholder:normal-case placeholder:tracking-normal placeholder:text-white/30" />
        {check.state === "valid" && <span className="mr-2.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-lime-300 text-[#11150D]"><Check className="h-3.5 w-3.5" strokeWidth={3.5} aria-hidden="true" /></span>}
      </div>
      <p className="mt-1.5 min-h-[18px] text-[12.5px] font-semibold" aria-live="polite">
        {check.state === "valid" && <span className="flex items-center gap-1 text-lime-300" data-testid="signup-creator-valid"><Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />{check.name}</span>}
        {check.state === "checking" && <span className="flex items-center gap-1 text-white/45"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />Checking…</span>}
        {check.state === "invalid" && <span className="text-white/55">We couldn't find that creator</span>}
        {check.state === "self" && <span className="text-amber-300">That's your own code</span>}
        {check.state === "limited" && <span className="text-amber-300">Too many tries. Wait a minute.</span>}
      </p>
    </div>
  );
}
