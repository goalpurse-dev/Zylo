// The fix for a real reported bug: a client network hiccup (offline laptop,
// ERR_INTERNET_DISCONNECTED, a Supabase auth refresh-token request failing
// while offline) was being silently collapsed into the same "null" result
// as "this row genuinely doesn't exist" — which then made polling loops
// treat "we don't know" as "Research doesn't exist / has nothing to show",
// landing on a false "We couldn't complete the research" screen for a run
// that was still healthy server-side. The frontend is NEVER authoritative
// for workflow status — only a successfully fetched persisted row is.
//
// safeResult distinguishes the two cases every Long Form fetcher in a
// generation polling path must use:
//   { ok: true,  data: row|null } — the query genuinely succeeded (a null
//                                   row means "truly doesn't exist yet").
//   { ok: false, data: null }     — an error occurred (network, auth,
//                                   timeout, anything) — we simply don't
//                                   know the real state, and must never
//                                   guess by treating this as not-found.
export function safeResult(data, error) {
  if (error) return { ok: false, data: null };
  return { ok: true, data: data ?? null };
}

import { useEffect, useRef, useState } from "react";

// Tracks browser online/offline as a UX signal only (never as workflow
// source of truth) and exposes a `reconnectedAt` tick so a caller can do
// ONE controlled re-fetch when connectivity returns, rather than polling
// more aggressively or spamming requests while offline.
export function useConnectionStatus() {
  const [online, setOnline] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));
  const [reconnectedAt, setReconnectedAt] = useState(null);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      setReconnectedAt(Date.now());
    };
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return { online, reconnectedAt };
}

// Simple exponential-ish backoff for retrying a poll after a transient
// fetch error — never hammers, never gives up (a generation the user is
// watching should keep quietly trying to resync for as long as the page is
// open), caps at a reasonable ceiling.
export function nextBackoffMs(consecutiveFailures) {
  const base = 2000;
  const capped = Math.min(consecutiveFailures, 5);
  return Math.min(base * 2 ** capped, 30000);
}

// Small helper hook for a "connection lost, retrying" banner: true once a
// polling loop has recorded at least one transient failure, cleared the
// instant a poll succeeds again. Kept trivial on purpose — the actual
// retry/backoff scheduling stays in each page's own poll loop so this file
// never becomes a second orchestration system.
export function useTransientConnectionFlag() {
  const [hasIssue, setHasIssue] = useState(false);
  const failureCountRef = useRef(0);

  const recordFailure = () => {
    failureCountRef.current += 1;
    setHasIssue(true);
    return failureCountRef.current;
  };
  const recordSuccess = () => {
    failureCountRef.current = 0;
    setHasIssue(false);
  };

  return { hasIssue, recordFailure, recordSuccess };
}
