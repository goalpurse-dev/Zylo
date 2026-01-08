// src/components/AuthBox.tsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import React from "react";

export default function AuthBox() {
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (user) {
    return (
      <div style={{ marginBottom: 12 }}>
        <div>Signed in as <b>{user.email}</b></div>
        <button onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
      <input
        placeholder="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        placeholder="password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button onClick={() => supabase.auth.signUp({ email, password })}>Sign up</button>
      <button onClick={() => supabase.auth.signInWithPassword({ email, password })}>
        Sign in
      </button>
      <button onClick={() => supabase.auth.signInWithOAuth({ provider: "google" })}>
        Google
      </button>
    </div>
  );
}
