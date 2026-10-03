// Makes sure a Long Form project's edit exists and shows the scenes' current
// pictures, through the deployed long-form-edit function (action "ensure",
// service key). Free: no provider call, nothing is rendered or charged.
// Every script that changes a project's scenes calls this when it is done.
export async function ensureProjectEdit(projectId) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const res = await fetch(`${process.env.SUPABASE_URL}/functions/v1/long-form-edit`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, action: "ensure" }),
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, ...(body ?? {}) };
}
