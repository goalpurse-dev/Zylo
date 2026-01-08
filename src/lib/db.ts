// src/lib/db.ts
import { supabase } from "./supabaseClient";

type UUID = string;

export async function getMyProfile() {
  const { data: { user }, error: uErr } = await supabase.auth.getUser();
  if (uErr || !user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) throw error;
  return data;
}

export async function updateMyProfile(patch: Partial<{display_name: string; avatar_url: string;}>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// -------- Projects --------
export async function listMyProjects() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createProject(payload: { name: string; description?: string }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("projects")
    .insert({ user_id: user.id, ...payload })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteProject(projectId: UUID) {
  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId);
  if (error) throw error;
}

// -------- Assets & Storage --------
export async function uploadUserAsset(file: File, opts: {
  projectId?: UUID;
  kind: "image" | "video" | "audio" | "other";
  bucket?: "user-assets" | "public-assets";
  upsert?: boolean;
}) {
  const bucket = opts.bucket ?? "user-assets";
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const ext = file.name.split(".").pop() || "bin";
  const filename = `${crypto.randomUUID()}.${ext}`;
  const objectPath = `${user.id}/${filename}`; // matches storage policy

  const { data: up, error: upErr } = await supabase
    .storage
    .from(bucket)
    .upload(objectPath, file, { upsert: opts.upsert ?? true });

  if (upErr) throw upErr;

  // Optional: generate a 1-hour signed URL for private bucket previews
  let signedUrl: string | null = null;
  if (bucket === "user-assets") {
    const { data: s, error: sErr } = await supabase
      .storage
      .from(bucket)
      .createSignedUrl(objectPath, 60 * 60);
    if (!sErr) signedUrl = s?.signedUrl ?? null;
  }

  // Create row in assets
  const { data: row, error: rowErr } = await supabase
    .from("assets")
    .insert({
      user_id: user.id,
      project_id: opts.projectId ?? null,
      kind: opts.kind,
      storage_bucket: bucket,
      storage_path: objectPath,
      metadata: { original_name: file.name, size: file.size, type: file.type }
    })
    .select()
    .single();

  if (rowErr) throw rowErr;
  return { asset: row, previewUrl: signedUrl };
}

export async function listAssets(params?: { projectId?: UUID }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  let q = supabase.from("assets").select("*").eq("user_id", user.id);
  if (params?.projectId) q = q.eq("project_id", params.projectId);
  const { data, error } = await q.order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

// -------- Tool runs --------
export async function createToolRun(payload: {
  projectId?: UUID;
  tool: string;
  input: Record<string, any>;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("tool_runs")
    .insert({
      user_id: user.id,
      project_id: payload.projectId ?? null,
      tool: payload.tool,
      status: "queued",
      input: payload.input
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateToolRun(runId: UUID, patch: Partial<{status: "running"|"succeeded"|"failed"; output: any;}>) {
  const { data, error } = await supabase
    .from("tool_runs")
    .update(patch)
    .eq("id", runId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
