import { supabase } from "@/lib/supabaseClient";
import { ComponentProps } from "react";

export async function signInWithGoogle() {
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });
}

export default function GoogleButton(props: ComponentProps<"button">) {
  return (
    <button
      onClick={signInWithGoogle}
      className="w-full rounded-md border px-4 py-2 font-medium hover:bg-white/5"
      {...props}
    >
      Continue with Google
    </button>
  );
}
