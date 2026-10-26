import { supabase } from "./supabaseClient";

// Kept equal to SCRIPT_CREDIT_COST in supabase/functions/generate-script (which takes the credits).
export const SCRIPT_CREDIT_COST = 2;

// The script is written on the server (supabase/functions/generate-script): it checks the login,
// takes the credits (and gives them back if writing fails) and holds the OpenAI key. No key, and no
// OpenAI call, ever happens in the browser.
export async function generateScript(form, stylePreset) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in");

  const { data, error } = await supabase.functions.invoke("generate-script", { body: { form, stylePreset } });
  if (error) {
    const body = await error.context?.json?.().catch(() => null);
    throw new Error(body?.error || "Request failed. Please try again.");
  }
  return data;
}
