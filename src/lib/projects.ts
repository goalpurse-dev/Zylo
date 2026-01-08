// src/lib/projects.ts
import { supabase } from "./supabaseClient";

export type Project = {
  id: string;
  user_id: string;
  name: string;
  kind: string;           // your enum; use a valid value like 'video'/'image'/etc.
  settings: any;          // json
  created_at: string;
};

/** List all projects for the signed-in user */
export async function listProjects(userId: string) {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Project[];
}

/** Create a project for the current user */
export async function createProject(userId: string, payload: {
  name: string;
  kind: string;
  settings?: any;
}) {
  const row = {
    user_id: userId,
    name: payload.name,
    kind: payload.kind,
    settings: payload.settings ?? {},
  };
  const { data, error } = await supabase
    .from("projects")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return data as Project;
}

/** Update a project (RLS will ensure you own it) */
export async function updateProject(projectId: string, changes: Partial<Pick<Project, "name" | "kind" | "settings">>) {
  const { data, error } = await supabase
    .from("projects")
    .update(changes)
    .eq("id", projectId)
    .select("*")
    .single();
  if (error) throw error;
  return data as Project;
}

/** Delete a project (RLS will ensure you own it) */
export async function deleteProject(projectId: string) {
  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId);
  if (error) throw error;
  return true;
}
