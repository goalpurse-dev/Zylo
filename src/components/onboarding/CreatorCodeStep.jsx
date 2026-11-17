// The survey's "Which creator sent you?" step: a creator code (prefilled from a ?ref link), checked live, and
// 5 free credits when it is applied. Skippable. A typed code wins over the link (lib/affiliate.js).
import { useEffect, useRef, useState } from "react";
import { Check, Gift, Loader2, X } from "lucide-react";
import { AFFILIATE } from "../../../supabase/functions/_shared/affiliate/config.js";
import { cleanCode } from "../../../supabase/functions/_shared/affiliate/rules.js";
import { affiliateApi, clearStoredRef, readStoredRef } from "../../lib/affiliate";

const DONE = new Set(["claimed", "already_attributed", "self", "too_old", "already_paid", "unknown_code", "no_profile"]);
const MESSAGES = {
  self: "That's your own code — it can't be used on your account.",
  already_attributed: "A creator code is already on your account.",
  too_old: "Creator codes can only be added to new accounts.",
  already_paid: "Creator codes can only be added before your first purchase.",
  unknown_code: "We couldn't find that code.",
};

export default function CreatorCodeStep({ preview, onNext, onAnswered }) {
  const stored = useRef(readStoredRef());
  const [value, setValue] = useState(stored.current ?? "");
  const [check, setCheck] = useState({ state: "idle" }); // idle | checking | valid | invalid | self
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null); // { bonus, name } after a claim
  const [note, setNote] = useState(null);
  const code = cleanCode(value);

  useEffect(() => {
    setNote(null);
    if (code.length < AFFILIATE.codeMinLength) { setCheck({ state: "idle" }); return undefined; }
    setCheck({ state: "checking" });
    let live = true;
    const t = setTimeout(() => {
      affiliateApi("lookup", { code })
        .then((r) => { if (live) setCheck(r?.valid ? { state: "valid", name: r.displayName, code: r.code } : { state: r?.reason === "self" ? "self" : "invalid" }); })
        .catch(() => { if (live) setCheck({ state: "idle" }); });
    }, 350);
    return () => { live = false; clearTimeout(t); };
  }, [code]);

  const apply = async () => {
    if (busy) return;
    if (check.state !== "valid") { onAnswered(code ? "invalid" : "empty"); onNext(); return; }
    if (preview) { setDone({ bonus: AFFILIATE.signupBonusCredits, name: check.name }); setTimeout(onNext, 1100); return; }
    setBusy(true);
    try {
      const source = stored.current && stored.current === code ? "link" : "code";
      const r = await affiliateApi("claim", { code, source });
      if (DONE.has(r?.result)) clearStoredRef();
      onAnswered(r?.result ?? "error", r?.result === "claimed" ? r.code ?? code : null);
      if (r?.result === "claimed") {
        setDone({ bonus: r.bonusCredits, name: r.displayName ?? check.name });
        setTimeout(onNext, 1300);
      } else {
        setNote(MESSAGES[r?.result] ?? "That didn't work. You can carry on without it.");
      }
    } catch {
      setNote("Couldn't check the code right now. You can carry on without it.");
    }
    setBusy(false);
  };

  if (done) {
    return (
      <div className="text-center" data-testid="creator-code-done">
        <span className="ob-check mx-auto grid h-16 w-16 place-items-center rounded-full bg-lime-300 text-[#11150D]"><Check className="h-8 w-8" strokeWidth={3.5} aria-hidden="true" /></span>
        <h1 className="mt-5 text-[27px] font-black leading-tight tracking-tight text-white">{done.bonus > 0 ? `+${done.bonus} free credits` : "Code applied"}</h1>
        <p className="mt-1.5 text-[14.5px] text-white/60">Thanks to {done.name}. Enjoy!</p>
      </div>
    );
  }

  const status = check.state === "valid"
    ? <span className="flex items-center gap-1.5 text-lime-300" data-testid="creator-code-valid"><Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />{check.name}'s code</span>
    : check.state === "checking" ? <span className="flex items-center gap-1.5 text-white/45"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Checking…</span>
      : check.state === "self" ? <span className="flex items-center gap-1.5 text-amber-300"><X className="h-4 w-4" aria-hidden="true" />That's your own code</span>
        : check.state === "invalid" ? <span className="flex items-center gap-1.5 text-white/50"><X className="h-4 w-4" aria-hidden="true" />No creator with that code</span>
          : null;

  return (
    <>
      <h1 className="text-[27px] font-black leading-tight tracking-tight text-white sm:text-[32px]">Which creator sent you?</h1>
      <p className="mt-1.5 flex items-center gap-1.5 text-[14px] text-white/55">Enter their code or username — get {AFFILIATE.signupBonusCredits} free credits <Gift className="h-4 w-4 text-lime-300" aria-hidden="true" /></p>
      <div className={`mt-5 flex items-center rounded-2xl border-2 bg-white/[0.05] transition ${check.state === "valid" ? "border-lime-300/80 shadow-[0_0_24px_rgba(190,242,100,0.2)]" : "border-white/10 focus-within:border-lime-300/60"}`}>
        <input value={value} onChange={(e) => setValue(e.target.value)} maxLength={40} autoCapitalize="characters" autoComplete="off" spellCheck={false}
          placeholder="e.g. MAYA" aria-label="Creator code" data-testid="creator-code-input" onKeyDown={(e) => { if (e.key === "Enter") apply(); }}
          className="h-14 min-w-0 flex-1 bg-transparent px-4 text-[18px] font-bold uppercase tracking-[0.06em] text-white outline-none placeholder:font-semibold placeholder:normal-case placeholder:tracking-normal placeholder:text-white/30" />
        {check.state === "valid" && <span className="ob-check mr-3 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-lime-300 text-[#11150D]"><Check className="h-4 w-4" strokeWidth={3.5} aria-hidden="true" /></span>}
      </div>
      <div className="mt-2 min-h-[20px] text-[13.5px] font-semibold" aria-live="polite">{status}</div>
      {note && <p className="mt-1 text-[13.5px] text-amber-200/90" role="status">{note}</p>}
      <button type="button" disabled={busy || check.state === "checking"} data-testid="survey-next" onClick={note ? onNext : apply}
        className="mt-4 min-h-[54px] w-full rounded-2xl bg-lime-300 text-[16px] font-black text-[#11150D] transition hover:bg-lime-200 disabled:opacity-60">
        {busy ? "Applying…" : note ? "Continue" : check.state === "valid" ? `Apply code · +${AFFILIATE.signupBonusCredits} credits` : "Next"}
      </button>
      <button type="button" data-testid="creator-code-skip" onClick={() => { onAnswered("skipped"); onNext(); }}
        className="mx-auto mt-3 block px-2 py-1 text-[13.5px] font-semibold text-white/50 underline-offset-2 transition hover:text-white/80 hover:underline">Skip</button>
    </>
  );
}
