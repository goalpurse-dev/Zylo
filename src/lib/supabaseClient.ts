// src/lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
console.log("SUPABASE URL:", import.meta.env.VITE_SUPABASE_URL);
console.log(
  "SUPABASE ANON:",
  import.meta.env.VITE_SUPABASE_ANON_KEY?.slice(0, 20)
);