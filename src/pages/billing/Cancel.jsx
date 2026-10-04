import React, { useEffect } from "react";
import { Link } from "react-router-dom";

// Where Stripe Checkout returns when the customer closes it or presses Back.
// Nothing was paid, so this says so plainly and leads back to the plans.
export default function Cancel() {
  useEffect(() => { document.title = "Checkout closed | Zyvo"; }, []);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0B0D0F] px-4 text-center text-white" data-testid="billing-cancel">
      <div className="w-full max-w-md rounded-[24px] border border-white/[0.08] bg-[#111314] p-7 sm:p-8">
        <h1 className="text-[24px] font-extrabold leading-tight">No worries, you weren&apos;t charged</h1>
        <p className="mt-2 text-[14.5px] leading-6 text-white/65">
          The checkout was closed before any payment, so your account is exactly as it was. You can pick a plan whenever you&apos;re ready.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/pricing" className="inline-flex h-11 items-center justify-center rounded-xl bg-lime-300 px-5 text-[14px] font-bold text-[#11150D] hover:bg-lime-200">Back to pricing</Link>
          <Link to="/" className="inline-flex h-11 items-center justify-center rounded-xl border border-white/15 px-5 text-[14px] font-bold text-white/75 hover:text-white">Go to the app</Link>
        </div>
      </div>
    </div>
  );
}
