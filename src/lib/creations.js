// src/lib/creations.js
import { supabase } from "./supabaseClient"; // your existing client

// TABLE: creations (see SQL below)
export const CREATION_TYPES = {
  PHOTO: "photo",
  VIDEO: "video",
  PRODUCT_AD: "product_ad",
  PRODUCT_PHOTO: "product_photo",
};

export async function addCreation({
  user_id,
  type,            // one of CREATION_TYPES
  prompt = "",
  file_url,        // public or signed URL to display/download
  storage_bucket = null,
  storage_path = null, // if you want us to delete from Storage on remove
  meta = {},       // {width,height,duration,model,tier,credits,...}
}) {
  const { data, error } = await supabase
    .from("creations")
    .insert([{ user_id, type, prompt, file_url, storage_bucket, storage_path, meta }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Upsert a creation row by primary key (id). If `id` exists, the row is updated,
 * otherwise a new row is inserted. All fields are optional except `user_id` and `type`
 * when inserting a new row.
 */
export async function upsertCreation({  
  id = null,       // pass an id to update an existing row; omit/null to insert
  user_id,
  type,            // one of CREATION_TYPES
  prompt = "",
  file_url,
  storage_bucket = null,
  storage_path = null,
  meta = {},
}) {
  const payload = {
    ...(id ? { id } : {}),
    user_id,
    type,
    prompt,
    file_url,
    storage_bucket,
    storage_path,
    meta,
  };

  const { data, error } = await supabase
    .from("creations")
    // relies on primary key conflict (id) by default
    .upsert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function listCreationsByType(user_id, type, { limit = 60, from = 0 } = {}) {
  const { data, error } = await supabase
    .from("creations")
    .select("*")
    .eq("user_id", user_id)
    .eq("type", type)
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1);
  if (error) throw error;
  return data || [];
}

export function subscribeCreations(user_id, cb) {
  // Live inserts for *this user's* creations
  const channel = supabase
    .channel(`creations-user-${user_id}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "creations", filter: `user_id=eq.${user_id}` },
      (payload) => cb(payload.new)
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export async function deleteCreation(row) {
  // Remove DB row first
  const { error } = await supabase.from("creations").delete().eq("id", row.id);
  if (error) throw error;

  // Optionally also remove the file from Storage if we know where it is
  if (row.storage_bucket && row.storage_path) {
    await supabase.storage.from(row.storage_bucket).remove([row.storage_path]);
  }
}
