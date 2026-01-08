// src/components/storage/AssetPicker.tsx
import React, { useEffect, useState } from "react";
import {
  uploadUserFile,
  listUserFiles,
  getSignedUrl,
  deleteUserFile,
} from "../../lib/storage";

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (asset: { path: string; url: string }) => void; // return signed url + path
  projectId?: string;
  title?: string;
};

export default function AssetPicker({ open, onClose, onPick, projectId, title }: Props) {
  const [files, setFiles] = useState<{ name: string; path: string; url?: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    try {
      setBusy(true);
      setErr(null);
      const rows = await listUserFiles(projectId ? `projects/${projectId}/uploads` : "uploads");
      // produce signed urls for thumbnails
      const withUrls = await Promise.all(
        rows.map(async (r) => {
          try {
            const url = await getSignedUrl(r.path, 60 * 10);
            return { name: r.name, path: r.path, url };
          } catch {
            return { name: r.name, path: r.path };
          }
        })
      );
      setFiles(withUrls);
    } catch (e: any) {
      setErr(e.message || "Failed to list files");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (open) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      await uploadUserFile(file, { projectId, prefix: "uploads" });
      await refresh();
    } catch (e: any) {
      setErr(e.message || "Upload failed");
    } finally {
      setUploading(false);
      e.currentTarget.value = ""; // reset input
    }
  }

  async function handleDelete(path: string) {
    if (!confirm("Delete this file?")) return;
    try {
      await deleteUserFile(path);
      await refresh();
    } catch (e: any) {
      setErr(e.message || "Delete failed");
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-4xl rounded-2xl bg-white p-4 sm:p-6 shadow-xl ring-1 ring-black/5">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-black">
            {title || "Your assets"}
          </h3>
          <button
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1.5 text-sm font-semibold text-black/70 hover:bg-black/5"
          >
            Close
          </button>
        </div>

        {/* Upload */}
        <div className="mb-4 flex items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-black/70 hover:bg-black/5">
            <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            {uploading ? "Uploading…" : "Upload image"}
          </label>

          <button
            className="rounded-full border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-black/70 hover:bg-black/5"
            onClick={refresh}
            disabled={busy}
          >
            {busy ? "Refreshing…" : "Refresh"}
          </button>

          {err && <div className="text-sm text-red-600">{err}</div>}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {files.map((f) => (
            <div
              key={f.path}
              className="group relative overflow-hidden rounded-xl border border-black/10 bg-white"
            >
              <button
                onClick={async () => {
                  const url = f.url || (await getSignedUrl(f.path, 60 * 10));
                  onPick({ path: f.path, url });
                }}
                className="block w-full"
                title="Pick"
              >
                {f.url ? (
                  <img
                    src={f.url}
                    alt={f.name}
                    className="h-40 w-full object-cover transition group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="flex h-40 items-center justify-center text-xs text-black/50">
                    {f.name}
                  </div>
                )}
              </button>

              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-white/90 p-1 text-xs">
                <div className="truncate px-1 text-black/80" title={f.name}>
                  {f.name}
                </div>
                <button
                  onClick={() => handleDelete(f.path)}
                  className="rounded-full px-2 py-1 font-semibold text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}

          {files.length === 0 && !busy && (
            <div className="col-span-full rounded-xl border border-dashed border-black/10 p-8 text-center text-black/60">
              No assets yet. Upload an image to get started.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
