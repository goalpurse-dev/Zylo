// src/components/UploadTest.tsx (or .jsx)
import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function UploadTest() {
  const [status, setStatus] = useState<string>("");

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus("Getting user…");
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      setStatus("You must be signed in first.");
      return;
    }
    const userId = userData.user.id;

    const path = `${userId}/${crypto.randomUUID()}-${file.name}`;

    setStatus("Uploading…");
    const { data: uploaded, error: upErr } = await supabase
      .storage
      .from('user-assets')
      .upload(path, file, { upsert: true, cacheControl: '3600' });

    if (upErr) {
      setStatus(`Upload error: ${upErr.message}`);
      return;
    }

    // Because the bucket is private, create a short-lived URL for preview:
    const { data: signed, error: sErr } = await supabase
      .storage
      .from('user-assets')
      .createSignedUrl(path, 60 * 10); // 10 mins

    if (sErr) {
      setStatus(`Uploaded. Failed to sign URL: ${sErr.message}`);
      return;
    }

    setStatus(`Uploaded: ${path}\nPreview: ${signed?.signedUrl}`);
  }

  return (
    <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
      <p>Upload to Supabase Storage (private bucket):</p>
      <input type="file" onChange={handleFileChange} />
      <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{status}</pre>
    </div>
  );
}
