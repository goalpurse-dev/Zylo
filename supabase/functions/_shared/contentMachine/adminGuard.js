// Content Machine: who may use it. One rule, on the server, for every request: a signed-in user whose
// email is VERIFIED and listed in ADMIN_EMAILS (comma-separated). Not the ops page's fallbacks
// (ALERT_EMAIL, CONTACT_TO_EMAIL): this list is the whole list.
//
// Everyone else, signed out or not, gets the same plain 404 an unknown function gets, so the API does not
// reveal that it exists. CORS preflights (OPTIONS) are answered normally before this check: they carry no
// token, and refusing them would break the owner's own page.

export const NOT_FOUND_BODY = { code: "NOT_FOUND", message: "Requested function was not found" };

export function adminEmailList(raw) {
  return String(raw ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export function isAdmin(user, emails) {
  if (!user || !user.email || !user.email_confirmed_at) return false;
  return emails.includes(String(user.email).trim().toLowerCase());
}

export function bearerToken(req) {
  return (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
}

/** The admin user, or null. getUser(token) → {data: {user}, error} as supabase-js returns it. Never throws. */
export async function adminFromRequest(req, { getUser, emails }) {
  const token = bearerToken(req);
  if (!token || !emails.length) return null;
  try {
    const { data, error } = await getUser(token);
    const user = error ? null : data?.user ?? null;
    return isAdmin(user, emails) ? user : null;
  } catch {
    return null;
  }
}
