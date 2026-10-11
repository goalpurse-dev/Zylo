import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FREE_MARK_TEXT, isFreePlanAccount } from "../../lib/freeWatermark.js";

/** True once we know the signed-in account is on the free plan (false for paid plans and guests). */
export function useFreePlanMark() {
  const [free, setFree] = useState(false);
  useEffect(() => {
    let cancelled = false;
    isFreePlanAccount().then((value) => { if (!cancelled) setFree(value); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return free;
}

/** The mark as it will be on the saved file: bottom-right corner of the picture it sits on. */
export function FreeMarkPreview() {
  return (
    <span className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-black/50 px-2 py-1 text-[11px] font-semibold leading-none text-white/95 sm:bottom-3 sm:right-3 sm:text-[12px]">
      {FREE_MARK_TEXT}
    </span>
  );
}

/** One line under the save button that says what the free plan saves, with the way to remove it. */
export function FreeMarkNote() {
  return (
    <p className="basis-full text-center text-[12px] text-white/45">
      Free plan: saved images carry a small &quot;{FREE_MARK_TEXT}&quot; mark.{" "}
      <Link to="/pricing" className="font-semibold text-lime-300 underline-offset-4 hover:underline">Paid plans save without it</Link>
    </p>
  );
}
