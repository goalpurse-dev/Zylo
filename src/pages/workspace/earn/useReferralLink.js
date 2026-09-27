import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { SITE_URL } from "../../../data/publicSeoMetadata";

export function useReferralLink(user) {
  const [code, setCode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error: rpcErr } = await supabase.rpc("get_or_create_referral_code");
      if (cancelled) return;
      if (rpcErr) {
        setError("Couldn't load your referral link. Please try again.");
      } else {
        setCode(data);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const link = code ? `${SITE_URL}/r/${code}` : "";
  return { code, link, loading, error };
}
