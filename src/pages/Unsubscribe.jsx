// /unsubscribe?u=&t= — the footer link of Zyvo product emails. Opening it
// unsubscribes (one click from the email): the signed link is checked by the
// email-unsubscribe edge function, which sets profiles.email_updates = false.
// Undo resubscribes with the same link. No login needed.
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

const FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-unsubscribe`;

async function call(u, t, action) {
  try {
    const r = await fetch(`${FN}?u=${encodeURIComponent(u)}&t=${encodeURIComponent(t)}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action ? { action } : {}),
    });
    const j = await r.json().catch(() => null);
    return r.ok && j?.ok ? { ok: true } : { ok: false, message: j?.error ?? "Something went wrong. Try again." };
  } catch {
    return { ok: false, message: "Couldn't reach Zyvo. Check your connection and try again." };
  }
}

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const u = params.get("u") ?? "";
  const t = params.get("t") ?? "";
  const [state, setState] = useState(u && t ? "working" : "invalid"); // working | out | in | error | invalid
  const [message, setMessage] = useState(null);
  const started = useRef(false); // StrictMode runs effects twice in dev

  useEffect(() => {
    document.title = "Unsubscribe | Zyvo";
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  useEffect(() => {
    if (!u || !t || started.current) return;
    started.current = true;
    call(u, t).then((r) => { if (r.ok) setState("out"); else { setMessage(r.message); setState("error"); } });
  }, [u, t]);

  const toggle = async (action) => {
    setState("working");
    const r = await call(u, t, action);
    if (r.ok) setState(action === "resubscribe" ? "in" : "out"); else { setMessage(r.message); setState("error"); }
  };

  const title = { working: "One moment…", out: "You're unsubscribed", in: "You're subscribed again", error: "That didn't work", invalid: "This link isn't complete" }[state];
  const body = {
    working: "Updating your email settings.",
    out: "You won't get Zyvo product updates anymore. Emails about your account, like receipts, still arrive.",
    in: "You'll keep getting Zyvo product updates.",
    error: message,
    invalid: "Open the unsubscribe link from the email again, or change this in your account settings.",
  }[state];

  return (
    <main className="grid min-h-screen place-items-center bg-[#0A0B0D] px-4 py-10 text-white">
      <div className="w-full max-w-[440px] rounded-2xl border border-white/10 bg-[#131518] p-7 text-center" data-testid="unsubscribe">
        <p className="text-[22px] font-black tracking-tight"><span className="text-lime-300">Z</span>yvo</p>
        <h1 className="mt-5 text-[22px] font-bold">{title}</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-white/60">{body}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {state === "out" && (
            <button type="button" onClick={() => toggle("resubscribe")} className="rounded-xl border border-white/15 px-4 py-2.5 text-[13.5px] font-semibold text-white hover:bg-white/5">
              Undo, keep me subscribed
            </button>
          )}
          {state === "in" && (
            <button type="button" onClick={() => toggle()} className="rounded-xl border border-white/15 px-4 py-2.5 text-[13.5px] font-semibold text-white hover:bg-white/5">
              Unsubscribe
            </button>
          )}
          {state === "error" && u && t && (
            <button type="button" onClick={() => toggle()} className="rounded-xl bg-lime-300 px-4 py-2.5 text-[13.5px] font-bold text-[#11150D] hover:bg-lime-200">
              Try again
            </button>
          )}
          <Link to="/" className="rounded-xl px-4 py-2.5 text-[13.5px] font-semibold text-white/60 hover:text-white">Go to Zyvo</Link>
        </div>
      </div>
    </main>
  );
}
